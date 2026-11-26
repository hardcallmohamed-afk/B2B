import 'dotenv/config';
import fs from 'fs';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import {
  initializeApp as initializeAdminApp,
  getApps as getAdminApps,
  getApp as getAdminApp,
} from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import dns from 'dns';
import {
  checkAndIncrementAiUsage,
  AI_DAILY_LIMIT_PER_UID,
  checkAndIncrementCrawlUsage,
  CRAWL_HOURLY_LIMIT_PER_UID,
  validatePublicHttpUrl,
  extractVisibleTextFromHtml,
} from './src/utils/aiRateLimiter.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const AI_MODEL = 'gemini-4-hydrogen';
const AI_FALLBACK_MODELS = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;
const SUPER_ADMIN_EMAIL = 'hardcallmohamed@gmail.com';

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

const SECURE_LLM_PROVIDERS: Record<string, { url: string; defaultModel: string; label: string }> = {
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.3-70b-versatile',
    label: 'Groq',
  },
  mistral: {
    url: 'https://api.mistral.ai/v1/chat/completions',
    defaultModel: 'mistral-small-latest',
    label: 'Mistral AI',
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'openai/gpt-4o-mini',
    label: 'OpenRouter',
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    label: 'OpenAI',
  },
  deepseek: {
    url: 'https://api.deepseek.com/chat/completions',
    defaultModel: 'deepseek-chat',
    label: 'DeepSeek',
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-3-5-haiku-latest',
    label: 'Anthropic Claude',
  },
};

function loadFirebaseAppletConfig(): FirebaseAppletConfig | null {
  try {
    const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as FirebaseAppletConfig;
    if (!parsed?.projectId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getFirebaseAdminServices() {
  const config = loadFirebaseAppletConfig();
  if (!config) return null;

  const adminApp = getAdminApps().length
    ? getAdminApp()
    : initializeAdminApp({ projectId: config.projectId });

  const adminAuth = getAdminAuth(adminApp);
  const adminDb = config.firestoreDatabaseId
    ? getAdminFirestore(adminApp, config.firestoreDatabaseId)
    : getAdminFirestore(adminApp);

  return { adminApp, adminAuth, adminDb, config };
}

function isValidConfiguredKey(val: string | undefined): val is string {
  if (!val) return false;
  const trimmed = val.trim();
  if (!trimmed || trimmed === 'MY_GEMINI_API_KEY') return false;
  return true;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!isValidConfiguredKey(apiKey)) return null;
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isRetryable = /503|500|UNAVAILABLE|ECONNRESET|ETIMEDOUT|fetch failed/i.test(msg);
      if (!isRetryable || attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
    }
  }
  throw lastErr;
}

async function generateContentWithFallback(
  ai: GoogleGenAI,
  buildRequest: (model: string) => Parameters<GoogleGenAI['models']['generateContent']>[0]
) {
  let lastErr: unknown;
  for (let i = 0; i < AI_FALLBACK_MODELS.length; i++) {
    const model = AI_FALLBACK_MODELS[i];
    try {
      const response = await withRetry(() => ai.models.generateContent(buildRequest(model)));
      return { response, usedModel: model };
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const canFallbackModel = /429|RESOURCE_EXHAUSTED|quota|404|NOT_FOUND|503|UNAVAILABLE/i.test(msg);
      if (!canFallbackModel || i === AI_FALLBACK_MODELS.length - 1) {
        throw err;
      }
    }
  }
  throw lastErr;
}

function clampString(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function safeHttpUrl(url: unknown): string {
  if (typeof url !== 'string') return '';
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

function formatAiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (/403|PERMISSION_DENIED|API_KEY_INVALID|API key not valid|invalid api key/i.test(raw)) {
    return {
      status: 502,
      message:
        'Clé Gemini intégrée invalide ou expirée. Bascule automatique vers les autres fournisseurs IA du Hub API / Coffre Cloud.',
    };
  }
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(raw)) {
    return {
      status: 429,
      message:
        'Quota Gemini intégré atteint temporairement. Bascule automatique vers les autres IA disponibles (Hub API / Coffre Cloud).',
    };
  }
  if (/404|NOT_FOUND/i.test(raw)) {
    return {
      status: 502,
      message: `Modèle IA (${AI_MODEL}) momentanément indisponible.`,
    };
  }
  if (/400|INVALID_ARGUMENT/i.test(raw)) {
    return {
      status: 400,
      message: 'Requête IA rejetée par le modèle. Vérifiez les paramètres envoyés.',
    };
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network/i.test(raw)) {
    return {
      status: 503,
      message: 'Service Gemini IA temporairement injoignable depuis le serveur.',
    };
  }
  return {
    status: 502,
    message: 'Erreur lors de la communication avec le service Gemini IA.',
  };
}

interface AuthenticatedCaller {
  uid: string;
  email: string;
  isSuperAdmin: boolean;
}

async function authenticateAndRateLimitAiCaller(
  req: express.Request,
  res: express.Response
): Promise<AuthenticatedCaller | null> {
  const services = getFirebaseAdminServices();
  if (!services) {
    res.status(503).json({
      error: 'Configuration Firebase Admin introuvable sur le serveur.',
    });
    return null;
  }

  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentification requise (jeton Bearer manquant). Reconnectez-vous.' });
    return null;
  }
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken || idToken.length > 8192) {
    res.status(401).json({ error: 'Jeton d’authentification invalide.' });
    return null;
  }

  let decoded: Awaited<ReturnType<typeof services.adminAuth.verifyIdToken>>;
  try {
    decoded = await services.adminAuth.verifyIdToken(idToken);
  } catch {
    res.status(401).json({ error: 'Session Firebase invalide ou expirée. Reconnectez-vous.' });
    return null;
  }

  const callerEmail = (decoded.email || '').toLowerCase();
  const isSuperAdmin = decoded.email_verified === true && callerEmail === SUPER_ADMIN_EMAIL;

  if (!decoded.email_verified) {
    res.status(403).json({ error: 'Veuillez vérifier votre adresse e-mail avant d’utiliser le service IA.' });
    return null;
  }

  if (!isSuperAdmin) {
    try {
      const memberSnap = await services.adminDb.doc(`app_users/${decoded.uid}`).get();
      if (!memberSnap.exists || memberSnap.data()?.active !== true) {
        res.status(403).json({ error: 'Accès refusé : compte non autorisé ou désactivé.' });
        return null;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/PERMISSION_DENIED|7 PERMISSION_DENIED|Could not load the default credentials/i.test(msg)) {
        res.status(503).json({
          error:
            'Droits IAM Firestore manquants sur le serveur. Accordez le rôle roles/datastore.viewer au compte de service d’aperçu dans Google Cloud IAM.',
        });
        return null;
      }
      res.status(500).json({ error: 'Impossible de vérifier les autorisations utilisateur côté serveur.' });
      return null;
    }
  }

  const rateLimit = checkAndIncrementAiUsage(decoded.uid, AI_DAILY_LIMIT_PER_UID);
  if (!rateLimit.allowed) {
    res.status(429).json({
      error: `Plafond d'appels IA atteint : 40 requêtes autorisées par jour calendaire (fuseau Afrique/Casablanca, date du jour : ${rateLimit.dateKey}). Veuillez réessayer demain.`,
      limit: rateLimit.limit,
      remaining: 0,
      dateKey: rateLimit.dateKey,
    });
    return null;
  }

  return {
    uid: decoded.uid,
    email: callerEmail,
    isSuperAdmin,
  };
}

async function authenticateAndRateLimitCrawlCaller(
  req: express.Request,
  res: express.Response
): Promise<AuthenticatedCaller | null> {
  const services = getFirebaseAdminServices();
  if (!services) {
    res.status(503).json({
      error: 'Configuration Firebase Admin introuvable sur le serveur.',
    });
    return null;
  }

  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentification requise (jeton Bearer manquant). Reconnectez-vous.' });
    return null;
  }
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken || idToken.length > 8192) {
    res.status(401).json({ error: 'Jeton d’authentification invalide.' });
    return null;
  }

  let decoded: Awaited<ReturnType<typeof services.adminAuth.verifyIdToken>>;
  try {
    decoded = await services.adminAuth.verifyIdToken(idToken);
  } catch {
    res.status(401).json({ error: 'Session Firebase invalide ou expirée. Reconnectez-vous.' });
    return null;
  }

  const callerEmail = (decoded.email || '').toLowerCase();
  const isSuperAdmin = decoded.email_verified === true && callerEmail === SUPER_ADMIN_EMAIL;

  if (!decoded.email_verified) {
    res.status(403).json({ error: 'Veuillez vérifier votre adresse e-mail avant d’utiliser le service de crawl.' });
    return null;
  }

  if (!isSuperAdmin) {
    try {
      const memberSnap = await services.adminDb.doc(`app_users/${decoded.uid}`).get();
      if (!memberSnap.exists || memberSnap.data()?.active !== true) {
        res.status(403).json({ error: 'Accès refusé : compte non autorisé ou désactivé.' });
        return null;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/PERMISSION_DENIED|7 PERMISSION_DENIED|Could not load the default credentials/i.test(msg)) {
        res.status(503).json({
          error:
            'Droits IAM Firestore manquants sur le serveur. Accordez le rôle roles/datastore.viewer au compte de service d’aperçu dans Google Cloud IAM.',
        });
        return null;
      }
      res.status(500).json({ error: 'Impossible de vérifier les autorisations utilisateur côté serveur.' });
      return null;
    }
  }

  const rateLimit = checkAndIncrementCrawlUsage(decoded.uid, CRAWL_HOURLY_LIMIT_PER_UID);
  if (!rateLimit.allowed) {
    res.status(429).json({
      error: `Plafond de crawl atteint : 30 pages autorisées par heure et par utilisateur. Veuillez patienter avant la prochaine session d'extraction.`,
      limit: rateLimit.limit,
      remaining: 0,
    });
    return null;
  }

  return {
    uid: decoded.uid,
    email: callerEmail,
    isSuperAdmin,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // 1. Statut de l'intégration IA serveur (sans jamais exposer la clé)
  app.get('/api/ai/status', (_req, res) => {
    const available = isValidConfiguredKey(process.env.GEMINI_API_KEY);
    res.json({ available, model: AI_MODEL });
  });

  // 2. Copilote Commercial IA Orange Pro (Chat multi-tours contextualisé sur le portefeuille)
  app.post('/api/ai/chat', async (req, res) => {
    const caller = await authenticateAndRateLimitAiCaller(req, res);
    if (!caller) return;

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Service Gemini intégré non configuré. Bascule automatique vers les autres fournisseurs IA du Hub API / Coffre Cloud.',
      });
      return;
    }

    const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const portfolioSummary = clampString(req.body?.portfolioSummary, 4000);
    const focusedFiche = clampString(req.body?.focusedFiche, 1500);

    const sanitizedHistory = rawMessages
      .slice(-12)
      .map((m: { role?: unknown; content?: unknown }) => ({
        role: m?.role === 'assistant' ? 'model' : 'user',
        text: clampString(m?.content, 2000),
      }))
      .filter((m: { text: string }) => m.text.length > 0);

    if (sanitizedHistory.length === 0) {
      res.status(400).json({ error: 'Veuillez saisir un message pour le Copilote IA.' });
      return;
    }

    const systemInstruction = `Tu es le Copilote Commercial B2B Orange Pro Maroc (spécialisé Meknès, El Hajeb, Ifrane, Azrou & tout le Maroc).
Tu assistes un conseiller commercial B2B dans la gestion de son portefeuille CRM, la qualification d'offres (Fibre Dédiée, Fibre Pro, Flotte Mobile Corporate, Standard Cloud VoIP), la gestion du pipeline Kanban et la prospection.

Règles strictes :
- Réponds en français professionnel, direct, concret et orienté action terrain (pas de blabla générique).
- Appuie-toi EXCLUSIVEMENT sur les données réelles du portefeuille fournies ci-dessous. Ne fabrique jamais de noms d'entreprises ou de chiffres absents du contexte.
- Utilise des listes courtes et structurées faciles à lire entre deux appels.
- Limite tes réponses à 220 mots maximum sauf demande explicite de script complet.

=== RÉSUMÉ EN TEMPS RÉEL DU PORTEFEUILLE ===
${portfolioSummary || 'Aucune fiche fournie.'}
${focusedFiche ? `\n=== FICHE CIBLÉE ===\n${focusedFiche}` : ''}`;

    try {
      const contents = sanitizedHistory.map((m: { role: string; text: string }) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));

      const { response, usedModel } = await generateContentWithFallback(ai, (model) => ({
        model,
        contents,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      }));

      const reply = (response.text ?? '').trim();
      if (!reply) {
        res.status(502).json({ error: 'Réponse vide du modèle Gemini.' });
        return;
      }
      res.json({ reply, model: usedModel });
    } catch (err) {
      const formatted = formatAiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 3. Génération d'email B2B Orange Pro avec Skill (JSON structuré garanti)
  app.post('/api/ai/generate-email', async (req, res) => {
    const caller = await authenticateAndRateLimitAiCaller(req, res);
    if (!caller) return;

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Service Gemini intégré non configuré. Bascule automatique vers les autres fournisseurs IA du Hub API / Coffre Cloud.',
      });
      return;
    }

    const prompt = clampString(req.body?.prompt, 6000);
    if (!prompt) {
      res.status(400).json({ error: 'Prompt email manquant.' });
      return;
    }

    try {
      const { response, usedModel } = await generateContentWithFallback(ai, (model) => ({
        model,
        contents: prompt,
        config: {
          systemInstruction:
            'Tu es un expert en rédaction commerciale B2B Orange Pro Maroc. Retourne uniquement un objet JSON valide avec les champs "objet" et "corps" en français naturel et percutant.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              objet: { type: Type.STRING, description: "Objet concis de l'email B2B" },
              corps: { type: Type.STRING, description: "Corps complet de l'email prêt à envoyer avec la signature" },
            },
            required: ['objet', 'corps'],
          },
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      }));

      const text = (response.text ?? '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
      const parsed = JSON.parse(text);
      if (!parsed?.objet || !parsed?.corps) {
        res.status(502).json({ error: 'Format de réponse email IA incomplet.' });
        return;
      }

      res.json({
        objet: String(parsed.objet).trim(),
        corps: String(parsed.corps).trim(),
        model: usedModel,
      });
    } catch (err) {
      const formatted = formatAiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 4. Brief Commercial IA (Battlecard structurée sur une fiche prospect)
  app.post('/api/ai/next-action', async (req, res) => {
    const caller = await authenticateAndRateLimitAiCaller(req, res);
    if (!caller) return;

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Service Gemini intégré non configuré. Bascule automatique vers les autres fournisseurs IA du Hub API / Coffre Cloud.',
      });
      return;
    }

    const societe = clampString(req.body?.societe, 200);
    const secteur = clampString(req.body?.secteur, 100);
    const ville = clampString(req.body?.ville, 100);
    const effectif = clampString(req.body?.effectif, 20);
    const statut = clampString(req.body?.statut, 60);
    const contact = clampString(req.body?.contact, 120);
    const role = clampString(req.body?.role, 120);
    const offre = clampString(req.body?.offre, 200);
    const tier = clampString(req.body?.tier, 60);
    const maturite = Number(req.body?.maturite) || 0;

    if (!societe) {
      res.status(400).json({ error: 'Nom de société requis.' });
      return;
    }

    const prompt = `Génère une fiche de préparation commerciale (battlecard) B2B Orange Pro Maroc pour ce prospect :
- Société : ${societe}
- Secteur : ${secteur}
- Ville : ${ville || 'Meknès'}
- Effectif : ${effectif ? `${effectif} salariés` : 'Non renseigné'}
- Décideur : ${contact || 'Inconnu'} (${role || 'Non précisé'})
- Statut CRM actuel : ${statut}
- Offre Orange Pro ciblée : ${tier} — ${offre}
- Maturité fiche : ${maturite}%`;

    try {
      const { response, usedModel } = await generateContentWithFallback(ai, (model) => ({
        model,
        contents: prompt,
        config: {
          systemInstruction:
            'Tu es Directeur Commercial B2B Orange Pro Maroc. Fournis une battlecard ultra-concrète, adaptée au tissu économique marocain (continuité fiscale/opérationnelle, portabilité Maroc Telecom/inwi sans coupure, Fibre Pro & Flotte Mobile).',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              priorite: { type: Type.STRING, description: 'Haute, Moyenne ou Opportuniste' },
              resume: { type: Type.STRING, description: 'Diagnostic en 1-2 phrases courtes' },
              pitch3Points: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 arguments commerciaux concrets adaptés au secteur et à la taille',
              },
              objectionPrincipale: { type: Type.STRING, description: 'Objection la plus probable du décideur' },
              reponseObjection: { type: Type.STRING, description: 'Réponse terrain courte et crédible' },
              canalRecommande: { type: Type.STRING, description: 'Téléphone, WhatsApp Pro, Email ou Visite terrain' },
              prochaineAction: { type: Type.STRING, description: 'Action immédiate concrète à exécuter maintenant' },
            },
            required: [
              'priorite',
              'resume',
              'pitch3Points',
              'objectionPrincipale',
              'reponseObjection',
              'canalRecommande',
              'prochaineAction',
            ],
          },
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      }));

      const cleanText = (response.text ?? '{}').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
      const parsed = JSON.parse(cleanText);
      res.json({ brief: parsed, model: usedModel });
    } catch (err) {
      const formatted = formatAiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 5. Enrichissement Web IA via Google Search Grounding (serveur) — multi-téléphones & multi-emails
  app.post('/api/ai/enrich-web', async (req, res) => {
    const caller = await authenticateAndRateLimitAiCaller(req, res);
    if (!caller) return;

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Service Gemini IA non configuré sur le serveur.',
      });
      return;
    }

    const societe = clampString(req.body?.societe, 200);
    const ville = clampString(req.body?.ville, 100) || 'Meknès';
    const secteur = clampString(req.body?.secteur, 80);
    const allowedSecteurs = clampString(req.body?.allowedSecteurs, 300);

    if (!societe) {
      res.status(400).json({ error: 'Société manquante.' });
      return;
    }

    const prompt = `Tu es un enquêteur B2B au Maroc. Fais une recherche Google vérifiée (Aperçu IA Google, site officiel, Telecontact.ma, Kerix.net, LinkedIn Maroc, Google Maps) pour l'entreprise exacte :
- Nom : "${societe}"
- Ville : "${ville}", Maroc
- Secteur actuel : "${secteur}"

Trouve UNIQUEMENT des données réellement trouvées sur le web (ne rien inventer, laisser "" ou [] si absent) :
- telephone (numéro principal au format marocain 05XXXXXXXX, 06XXXXXXXX ou 07XXXXXXXX)
- telephones (tableau de TOUS les numéros marocains trouvés pour cette entreprise, fixe + GSM + standard)
- email (email professionnel principal officiel)
- emails (tableau de TOUTES les adresses email professionnelles trouvées pour cette entreprise)
- contact (nom complet du décideur : Gérant, DG, Associé, Fondateur, Dr, Me, Arch)
- role (fonction du décideur)
- effectif (nombre entier uniquement si prouvé, sinon "")
- siteWeb (URL officielle)
- secteur (un code parmi : ${allowedSecteurs})

Réponds UNIQUEMENT par un objet JSON valide :
{"telephone":"","telephones":[],"email":"","emails":[],"contact":"","role":"","effectif":"","siteWeb":"","secteur":""}`;

    try {
      const { response, usedModel } = await generateContentWithFallback(ai, (model) => ({
        model,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      }));

      const rawText = (response.text ?? '').trim();
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = chunks
        .map((c: { web?: { uri?: string; title?: string } }) => ({
          uri: safeHttpUrl(c?.web?.uri),
          title: clampString(c?.web?.title, 120),
        }))
        .filter((s: { uri: string }) => Boolean(s.uri))
        .slice(0, 5);

      res.json({ text: rawText, sources, model: usedModel });
    } catch (err) {
      const formatted = formatAiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 6. Extraction structurée IA de texte collé (Aperçu IA Google, Google Maps, LinkedIn, sites web, annuaires)
  app.post('/api/ai/parse-paste', async (req, res) => {
    const caller = await authenticateAndRateLimitAiCaller(req, res);
    if (!caller) return;

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Service Gemini IA non configuré sur le serveur. Utilisez l’extraction locale instantanée.',
      });
      return;
    }

    const rawText = clampString(req.body?.rawText, 12000);
    const societe = clampString(req.body?.societe, 200);
    const ville = clampString(req.body?.ville, 100);
    const secteur = clampString(req.body?.secteur, 80);
    const allowedSecteurs = clampString(req.body?.allowedSecteurs, 300);

    if (!rawText) {
      res.status(400).json({ error: 'Texte collé vide.' });
      return;
    }

    const prompt = `Analyse ce contenu brut copié-collé depuis Google (y compris un "Aperçu IA / AI Overview"), Google Maps, LinkedIn, un site officiel ou un annuaire marocain pour l'entreprise "${societe || 'Inconnue'}" (${ville || 'Maroc'}, secteur actuel: ${secteur || 'pme'}).

Extrais EXCLUSIVEMENT les informations réellement présentes dans le texte ci-dessous (ne rien inventer, laisse "" ou [] si absent) :
- Tous les numéros de téléphone marocains (convertis en 10 chiffres 05XXXXXXXX, 06XXXXXXXX ou 07XXXXXXXX)
- Toutes les adresses email valides
- Le décideur principal (nom complet) et sa fonction/rôle
- L'effectif (nombre entier si mentionné, ex: "environ 35 salariés" -> "35")
- Le site web officiel (hors google/linkedin/facebook/telecontact/kerix)
- Le code secteur le plus pertinent parmi : ${allowedSecteurs}
- La ville marocaine si explicitement mentionnée

=== TEXTE COLLÉ ===
${rawText}`;

    try {
      const { response, usedModel } = await generateContentWithFallback(ai, (model) => ({
        model,
        contents: prompt,
        config: {
          systemInstruction:
            'Tu es un extracteur de données CRM B2B ultra-précis pour le Maroc. Tu sais lire les synthèses Google Aperçu IA, les fiches Google Maps et les profils LinkedIn. Ne fabrique aucune donnée.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              telephones: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Liste de tous les numéros marocains au format 05/06/07XXXXXXXX',
              },
              emails: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Liste de toutes les adresses email extraites',
              },
              contact: { type: Type.STRING, description: 'Nom complet du décideur ou chaîne vide' },
              role: { type: Type.STRING, description: 'Fonction du décideur ou chaîne vide' },
              effectif: { type: Type.STRING, description: 'Nombre entier en texte ou chaîne vide' },
              siteWeb: { type: Type.STRING, description: 'URL officielle ou chaîne vide' },
              secteur: { type: Type.STRING, description: 'Code secteur valide ou chaîne vide' },
              ville: { type: Type.STRING, description: 'Ville marocaine détectée ou chaîne vide' },
              resume: { type: Type.STRING, description: 'Courte synthèse (1 phrase) des éléments trouvés' },
            },
            required: ['telephones', 'emails', 'contact', 'role', 'effectif', 'siteWeb', 'secteur', 'ville', 'resume'],
          },
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      }));

      const cleanText = (response.text ?? '{}').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
      const parsed = JSON.parse(cleanText);
      res.json({ extracted: parsed, model: usedModel });
    } catch (err) {
      const formatted = formatAiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 7. Diagnostic Exécutif IA du Portefeuille (Score santé, goulots pipeline & comptes cibles)
  app.post('/api/ai/portfolio-insights', async (req, res) => {
    const caller = await authenticateAndRateLimitAiCaller(req, res);
    if (!caller) return;

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Service Gemini intégré non configuré. Bascule automatique vers les autres fournisseurs IA du Hub API / Coffre Cloud.',
      });
      return;
    }

    const portfolioSummary = clampString(req.body?.portfolioSummary, 5000);
    if (!portfolioSummary) {
      res.status(400).json({ error: 'Résumé du portefeuille manquant.' });
      return;
    }

    const prompt = `Réalise un diagnostic commercial exécutif Orange Pro B2B Maroc basé STRICTEMENT sur ces données réelles de portefeuille :

${portfolioSummary}

Produis un audit structuré, actionnable immédiatement sur le terrain (Meknès & Région / Maroc), en citant les vrais codes fiche (OP-XXXX) et noms d'entreprises présents ci-dessus.`;

    try {
      const { response, usedModel } = await generateContentWithFallback(ai, (model) => ({
        model,
        contents: prompt,
        config: {
          systemInstruction:
            'Tu es Directeur des Ventes B2B Orange Pro Maroc. Analyse le portefeuille CRM et livre un diagnostic chiffré, honnête et orienté signature Fibre Pro, Fibre Dédiée & Flotte Mobile. Ne fabrique aucun compte.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              scoreSante: {
                type: Type.INTEGER,
                description: 'Score global de santé commerciale du portefeuille de 0 à 100',
              },
              constatCle: {
                type: Type.STRING,
                description: 'Constat exécutif en 2 phrases courtes sur la qualité et la dynamique du pipeline',
              },
              alertePipeline: {
                type: Type.STRING,
                description: 'Principal point de friction ou risque détecté dans le tunnel de conversion',
              },
              actionsPrioritaires: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 à 4 actions terrain immédiates à fort impact',
              },
              opportunitesCibles: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    numeroFiche: { type: Type.STRING, description: 'Code OP-XXXX de la fiche si présent' },
                    societe: { type: Type.STRING, description: 'Nom exact de l entreprise dans le portefeuille' },
                    raison: { type: Type.STRING, description: 'Pourquoi ce compte est prioritaire' },
                    action: { type: Type.STRING, description: 'Prochaine action concrète recommandée' },
                  },
                  required: ['numeroFiche', 'societe', 'raison', 'action'],
                },
                description: 'Top 3 des comptes à prioriser maintenant',
              },
            },
            required: [
              'scoreSante',
              'constatCle',
              'alertePipeline',
              'actionsPrioritaires',
              'opportunitesCibles',
            ],
          },
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      }));

      const cleanText = (response.text ?? '{}').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
      const parsed = JSON.parse(cleanText);
      res.json({ insights: parsed, model: usedModel });
    } catch (err) {
      const formatted = formatAiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 8. Proxy IA sécurisé via Firebase Admin SDK (/api_keys/{provider} dans Firestore)
  // Vérifie le token Firebase ID + contrôle d'accès (Super-Admin ou collaborateur actif dans /app_users)
  app.post('/api/ai/groq-secure', async (req, res) => {
    const caller = await authenticateAndRateLimitAiCaller(req, res);
    if (!caller) return;

    const services = getFirebaseAdminServices()!;

    const rawProvider = clampString(req.body?.provider, 40).toLowerCase() || 'groq';
    const providerConfig = SECURE_LLM_PROVIDERS[rawProvider];
    if (!providerConfig) {
      res.status(400).json({
        error: `Fournisseur non supporté. Fournisseurs autorisés : ${Object.keys(SECURE_LLM_PROVIDERS).join(', ')}.`,
      });
      return;
    }

    const prompt = clampString(req.body?.prompt, 6000);
    if (!prompt) {
      res.status(400).json({ error: 'Veuillez fournir un prompt valide.' });
      return;
    }

    const requestedModel = clampString(req.body?.model, 120);
    const model =
      requestedModel && /^[a-zA-Z0-9._:/-]{2,120}$/.test(requestedModel)
        ? requestedModel
        : providerConfig.defaultModel;

    let apiKey = '';
    try {
      const keySnap = await services.adminDb.doc(`api_keys/${rawProvider}`).get();
      if (!keySnap.exists) {
        res.status(404).json({
          error: `La clé API ${providerConfig.label} n'est pas encore configurée dans le coffre-fort Cloud (/api_keys/${rawProvider}).`,
        });
        return;
      }
      const keyData = keySnap.data();
      if (keyData?.active === false) {
        res.status(403).json({
          error: `La clé API ${providerConfig.label} est actuellement désactivée dans le coffre-fort Cloud.`,
        });
        return;
      }
      apiKey = typeof keyData?.key === 'string' ? keyData.key.trim() : '';
      if (!apiKey) {
        res.status(404).json({
          error: `La clé API ${providerConfig.label} enregistrée dans Firestore est vide.`,
        });
        return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/PERMISSION_DENIED|7 PERMISSION_DENIED|Could not load the default credentials/i.test(msg)) {
        res.status(503).json({
          error:
            'Permissions IAM Firestore manquantes côté serveur : accordez le rôle roles/datastore.viewer au compte de service d’aperçu dans Google Cloud IAM.',
        });
        return;
      }
      res.status(502).json({
        error: 'Impossible de récupérer la clé API depuis Firestore côté serveur.',
      });
      return;
    }

    const systemInstruction = clampString(req.body?.systemInstruction, 2500);
    const messages = systemInstruction
      ? [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt },
        ]
      : [{ role: 'user', content: prompt }];

    try {
      let upstream: Response;
      if (rawProvider === 'anthropic') {
        upstream = await fetch(providerConfig.url, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: 1400,
            ...(systemInstruction ? { system: systemInstruction } : {}),
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: AbortSignal.timeout(25000),
        });
      } else {
        upstream = await fetch(providerConfig.url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.4,
            max_tokens: 1400,
          }),
          signal: AbortSignal.timeout(25000),
        });
      }

      const payload = (await upstream.json().catch(() => ({}))) as {
        choices?: Array<{ message?: { content?: string } }>;
        content?: Array<{ text?: string }>;
        error?: { message?: string };
      };

      if (!upstream.ok) {
        const providerErr = clampString(payload?.error?.message, 220);
        res.status(upstream.status >= 400 && upstream.status < 500 ? 502 : 503).json({
          error: providerErr
            ? `Erreur ${providerConfig.label} : ${providerErr}`
            : `Le fournisseur ${providerConfig.label} a renvoyé le statut HTTP ${upstream.status}.`,
        });
        return;
      }

      const rawReply =
        rawProvider === 'anthropic'
          ? (Array.isArray(payload?.content)
              ? payload.content.map((p) => p?.text || '').join('\n')
              : '')
          : payload?.choices?.[0]?.message?.content;
      const reply = clampString(rawReply, 8000);
      if (!reply) {
        res.status(502).json({ error: `Réponse vide renvoyée par ${providerConfig.label}.` });
        return;
      }

      res.json({
        reply,
        provider: rawProvider,
        providerLabel: providerConfig.label,
        model,
      });
    } catch {
      res.status(503).json({
        error: `Impossible de joindre ${providerConfig.label} depuis le serveur.`,
      });
    }
  });

  // 9. Détection automatique du distributeur d'une clé API (sans jamais logger ni renvoyer la clé)
  // Utilise uniquement des URL officielles codées en dur (aucune URL client acceptée)
  app.post('/api/ai/detect-provider', async (req, res) => {
    const caller = await authenticateAndRateLimitAiCaller(req, res);
    if (!caller) return;

    const rawKey = clampString(req.body?.apiKey, 512);
    if (!rawKey || rawKey.length < 8) {
      res.status(400).json({ error: 'Clé API trop courte pour détecter le distributeur.' });
      return;
    }

    const ALL_PROVIDERS = [
      'groq',
      'openrouter',
      'gemini',
      'tavily',
      'openai',
      'deepseek',
      'mistral',
      'anthropic',
    ] as const;
    type ProbeId = (typeof ALL_PROVIDERS)[number];

    const rawAllowed = Array.isArray(req.body?.allowedProviders) ? req.body.allowedProviders : null;
    const allowedSet = new Set<ProbeId>(
      rawAllowed
        ? (rawAllowed
            .map((x: unknown) => clampString(x, 32).toLowerCase())
            .filter((x: string): x is ProbeId => (ALL_PROVIDERS as readonly string[]).includes(x)) as ProbeId[])
        : ALL_PROVIDERS
    );

    const LABELS: Record<ProbeId, string> = {
      groq: 'Groq',
      openrouter: 'OpenRouter',
      gemini: 'Google Gemini',
      tavily: 'Tavily Search',
      openai: 'OpenAI',
      deepseek: 'DeepSeek',
      mistral: 'Mistral AI',
      anthropic: 'Anthropic Claude',
    };

    const probeOne = async (provider: ProbeId): Promise<boolean> => {
      try {
        const timeout = AbortSignal.timeout(4500);
        if (provider === 'groq') {
          const r = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { Authorization: `Bearer ${rawKey}` },
            signal: timeout,
          });
          return r.ok;
        }
        if (provider === 'openrouter') {
          const r = await fetch('https://openrouter.ai/api/v1/auth/key', {
            headers: { Authorization: `Bearer ${rawKey}` },
            signal: timeout,
          });
          return r.ok;
        }
        if (provider === 'openai') {
          const r = await fetch('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${rawKey}` },
            signal: timeout,
          });
          return r.ok;
        }
        if (provider === 'deepseek') {
          const r = await fetch('https://api.deepseek.com/models', {
            headers: { Authorization: `Bearer ${rawKey}` },
            signal: timeout,
          });
          return r.ok;
        }
        if (provider === 'mistral') {
          const r = await fetch('https://api.mistral.ai/v1/models', {
            headers: { Authorization: `Bearer ${rawKey}` },
            signal: timeout,
          });
          return r.ok;
        }
        if (provider === 'gemini') {
          const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(rawKey)}`,
            { signal: timeout }
          );
          return r.ok;
        }
        if (provider === 'anthropic') {
          const r = await fetch('https://api.anthropic.com/v1/models', {
            headers: {
              'x-api-key': rawKey,
              'anthropic-version': '2023-06-01',
            },
            signal: timeout,
          });
          return r.ok;
        }
        if (provider === 'tavily') {
          const r = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: rawKey, query: 'test', max_results: 1 }),
            signal: timeout,
          });
          return r.ok;
        }
      } catch {
        return false;
      }
      return false;
    };

    // Déterminer les candidats probables d'après le format pour répondre très rapidement
    let candidates: ProbeId[] = [];
    if (/^gsk_/.test(rawKey)) candidates = ['groq'];
    else if (/^sk-or-/i.test(rawKey)) candidates = ['openrouter'];
    else if (/^sk-ant-/i.test(rawKey)) candidates = ['anthropic'];
    else if (/^tvly-/i.test(rawKey)) candidates = ['tavily'];
    else if (/^(AIza|AQ\.)/.test(rawKey)) candidates = ['gemini'];
    else if (/^sk-(?:proj|svcacct|admin)-/.test(rawKey)) candidates = ['openai'];
    else if (/^mis_/i.test(rawKey)) candidates = ['mistral'];
    else if (/^sk-[a-f0-9]{24,}$/.test(rawKey)) candidates = ['deepseek', 'openai', 'openrouter'];
    else if (/^sk-/.test(rawKey)) candidates = ['openai', 'deepseek', 'openrouter'];
    else if (/^[A-Za-z0-9]{32}$/.test(rawKey)) candidates = ['mistral', 'groq', 'gemini', 'deepseek', 'openai'];
    else candidates = [...ALL_PROVIDERS];

    candidates = candidates.filter((p) => allowedSet.has(p));

    if (candidates.length > 0) {
      const results = await Promise.all(
        candidates.map(async (p) => ({ p, ok: await probeOne(p) }))
      );
      const verifiedMatch = results.find((r) => r.ok);
      if (verifiedMatch) {
        res.json({
          detectedProvider: verifiedMatch.p,
          label: LABELS[verifiedMatch.p],
          verified: true,
          confidence: 'verified',
        });
        return;
      }
    }

    // Repli sur la liste complète si le format était inhabituel
    if (candidates.length < allowedSet.size) {
      const remaining = Array.from(allowedSet).filter((p) => !candidates.includes(p));
      const restResults = await Promise.all(
        remaining.map(async (p) => ({ p, ok: await probeOne(p) }))
      );
      const verifiedRest = restResults.find((r) => r.ok);
      if (verifiedRest) {
        res.json({
          detectedProvider: verifiedRest.p,
          label: LABELS[verifiedRest.p],
          verified: true,
          confidence: 'verified',
        });
        return;
      }
    }

    // Aucun appel distant n'a confirmé : renvoyer la meilleure estimation par motif s'il y en a une
    const fallbackPattern = candidates[0] || null;
    res.json({
      detectedProvider: fallbackPattern,
      label: fallbackPattern ? LABELS[fallbackPattern] : '',
      verified: false,
      confidence: fallbackPattern ? 'pattern' : 'unknown',
    });
  });

  // 10. LOT 3: Statut de la configuration SMTP serveur (sans exposer de secrets)
  app.get('/api/email/status', (_req, res) => {
    const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'] as const;
    const missing = required.filter((key) => !process.env[key] || !process.env[key]!.trim());
    const available = missing.length === 0;

    res.json({
      available,
      missing,
      fromAddress: available ? process.env.SMTP_FROM!.trim() : null,
    });
  });

  // 11. LOT 3: Envoi d'email serveur sécurisé (uniquement si les 5 variables SMTP sont présentes)
  app.post('/api/email/send', async (req, res) => {
    const caller = await authenticateAndRateLimitAiCaller(req, res);
    if (!caller) return;

    const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'] as const;
    const missing = required.filter((key) => !process.env[key] || !process.env[key]!.trim());
    if (missing.length > 0) {
      res.status(503).json({
        error: `Envoi d'email direct non disponible : variables SMTP serveur manquantes (${missing.join(', ')}). Utilisez le bouton « Ouvrir dans la messagerie » pour envoyer depuis votre client de messagerie.`,
        missing,
      });
      return;
    }

    const to = clampString(req.body?.to, 160);
    const subject = clampString(req.body?.subject, 200);
    const body = clampString(req.body?.body, 10000);

    if (!to || !to.includes('@') || !to.includes('.')) {
      res.status(400).json({ error: 'Adresse email destinataire invalide.' });
      return;
    }
    if (!subject) {
      res.status(400).json({ error: 'Objet de l’email requis.' });
      return;
    }
    if (!body) {
      res.status(400).json({ error: 'Corps du message requis.' });
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST!.trim(),
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER!.trim(),
          pass: process.env.SMTP_PASS!.trim(),
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM!.trim(),
        to,
        subject,
        text: body,
      });

      res.json({
        success: true,
        to,
        subject,
        sentAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur SMTP lors de l’envoi.';
      res.status(502).json({ error: `Échec de l'envoi SMTP : ${msg}` });
    }
  });

  // 12. LOT 7: Crawl serveur souverain et anti-SSRF (DNS resolution check, redirect: error, timeout 12s, max 1 Mo)
  app.post('/api/crawl', async (req, res) => {
    const caller = await authenticateAndRateLimitCrawlCaller(req, res);
    if (!caller) return;

    const rawUrl = req.body?.url;
    const urlValidation = validatePublicHttpUrl(rawUrl);
    if (!urlValidation.valid || !urlValidation.normalizedUrl) {
      res.status(400).json({
        error: urlValidation.error || 'URL invalide ou interdite (anti-SSRF).',
      });
      return;
    }

    const targetUrl = urlValidation.normalizedUrl;
    const parsedUrl = new URL(targetUrl);

    try {
      const lookup = await dns.promises.lookup(parsedUrl.hostname);
      const ip = lookup.address;
      const ipValidation = validatePublicHttpUrl(`${parsedUrl.protocol}//${ip}${parsedUrl.pathname}${parsedUrl.search}`);
      if (!ipValidation.valid) {
        res.status(400).json({ error: 'Accès interdit : résolution DNS sur une adresse IP privée ou interne (anti-SSRF).' });
        return;
      }
    } catch {
      res.status(400).json({ error: 'Impossible de résoudre le nom de domaine de l’URL cible.' });
      return;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);

      const upstream = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (DIVERSIFIA-B2B-Crawler/1.0)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,ar-MA;q=0.8,en;q=0.7',
        },
        redirect: 'error',
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!upstream.ok) {
        res.status(502).json({
          error: `Le site distant a répondu avec le statut HTTP ${upstream.status} (${upstream.statusText || 'Erreur'}).`,
        });
        return;
      }

      const contentLength = upstream.headers.get('content-length');
      if (contentLength && Number(contentLength) > 1048576) {
        res.status(413).json({
          error: 'Page trop volumineuse : la taille dépasse la limite autorisée de 1 Mo.',
        });
        return;
      }

      const buffer = await upstream.arrayBuffer();
      if (buffer.byteLength > 1048576) {
        res.status(413).json({
          error: 'Page trop volumineuse : la taille dépasse la limite autorisée de 1 Mo.',
        });
        return;
      }

      const decoder = new TextDecoder('utf-8');
      const html = decoder.decode(buffer);
      const text = extractVisibleTextFromHtml(html, 300000);

      res.json({
        url: targetUrl,
        text,
        bytes: text.length,
        fetchedAt: new Date().toISOString(),
      });
    } catch (err) {
      const isTimeout =
        (err as { name?: string })?.name === 'AbortError' ||
        (err as { name?: string })?.name === 'TimeoutError';
      if (isTimeout) {
        res.status(504).json({
          error: 'Délai d’attente dépassé (timeout 12s) lors de la récupération de la page distante.',
        });
        return;
      }
      res.status(502).json({
        error: 'Impossible de joindre le site distant depuis le serveur.',
      });
    }
  });

  // 13. API Keys Vault Server-Side Management (Super-Admin Only via Firebase Admin SDK)
  app.get('/api/admin/api-keys', async (req, res) => {
    const caller = await authenticateAndRateLimitAiCaller(req, res);
    if (!caller || !caller.isSuperAdmin) {
      res.status(403).json({ error: 'Accès réservé au Super-Admin.' });
      return;
    }
    const services = getFirebaseAdminServices()!;
    try {
      const snap = await services.adminDb.collection('api_keys').get();
      const keys = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        const fullKey = typeof d.key === 'string' ? d.key : '';
        const last4 = fullKey.length > 4 ? fullKey.slice(-4) : '****';
        return {
          provider: d.provider || docSnap.id,
          label: d.label || docSnap.id,
          key: fullKey ? `••••••••${last4}` : '',
          active: d.active !== false,
          updatedBy: d.updatedBy || '',
          updatedAt: d.updatedAt?.toDate ? d.updatedAt.toDate().toISOString() : new Date().toISOString(),
        };
      });
      res.json({ keys });
    } catch {
      res.status(500).json({ error: 'Impossible de lire le coffre des clés API.' });
    }
  });

  app.post('/api/admin/api-keys', async (req, res) => {
    const caller = await authenticateAndRateLimitAiCaller(req, res);
    if (!caller || !caller.isSuperAdmin) {
      res.status(403).json({ error: 'Accès réservé au Super-Admin.' });
      return;
    }
    const services = getFirebaseAdminServices()!;
    const provider = clampString(req.body?.provider, 40).toLowerCase();
    const label = clampString(req.body?.label, 120);
    const key = clampString(req.body?.key, 512);
    const active = Boolean(req.body?.active);

    if (!provider || !key) {
      res.status(400).json({ error: 'Fournisseur et clé API requis.' });
      return;
    }

    try {
      const ref = services.adminDb.doc(`api_keys/${provider}`);
      await ref.set({
        provider,
        label: label || provider,
        key,
        active,
        updatedBy: caller.uid,
        createdAt: getAdminFirestore.FieldValue?.serverTimestamp?.() || new Date(),
        updatedAt: getAdminFirestore.FieldValue?.serverTimestamp?.() || new Date(),
      }, { merge: true });

      res.json({ success: true, provider });
    } catch {
      res.status(500).json({ error: 'Échec de l’enregistrement de la clé API.' });
    }
  });

  app.delete('/api/admin/api-keys/:provider', async (req, res) => {
    const caller = await authenticateAndRateLimitAiCaller(req, res);
    if (!caller || !caller.isSuperAdmin) {
      res.status(403).json({ error: 'Accès réservé au Super-Admin.' });
      return;
    }
    const services = getFirebaseAdminServices()!;
    const provider = clampString(req.params.provider, 40).toLowerCase();
    if (!provider) {
      res.status(400).json({ error: 'Fournisseur requis.' });
      return;
    }

    try {
      await services.adminDb.doc(`api_keys/${provider}`).delete();
      res.json({ success: true, provider });
    } catch {
      res.status(500).json({ error: 'Échec de la suppression de la clé API.' });
    }
  });

  // 14. Tavily Search Proxy (Server-side)
  app.post('/api/ai/tavily-search', async (req, res) => {
    const caller = await authenticateAndRateLimitAiCaller(req, res);
    if (!caller) return;
    const services = getFirebaseAdminServices()!;

    const queryStr = clampString(req.body?.query, 400);
    if (!queryStr) {
      res.status(400).json({ error: 'Requête de recherche requise.' });
      return;
    }

    try {
      const keySnap = await services.adminDb.doc('api_keys/tavily').get();
      if (!keySnap.exists || keySnap.data()?.active === false) {
        res.status(404).json({ error: 'Clé Tavily non configurée ou inactive dans le coffre Cloud.' });
        return;
      }
      const apiKey = typeof keySnap.data()?.key === 'string' ? keySnap.data()!.key.trim() : '';
      if (!apiKey) {
        res.status(404).json({ error: 'Clé Tavily vide.' });
        return;
      }

      const upstream = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, query: queryStr, max_results: 5, search_depth: 'advanced' }),
        signal: AbortSignal.timeout(20000),
      });

      const payload = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        res.status(502).json({ error: 'Erreur lors de la recherche Tavily.' });
        return;
      }

      res.json(payload);
    } catch {
      res.status(503).json({ error: 'Impossible de joindre Tavily depuis le serveur.' });
    }
  });

  // Garantir que toute route /api/* inconnue ou erreur de parsing JSON renvoie du JSON (jamais du HTML)
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'Point de terminaison API introuvable.' });
  });

  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api/')) {
      const status = typeof (err as { status?: number })?.status === 'number' ? (err as { status: number }).status : 400;
      res.status(status >= 400 && status < 600 ? status : 500).json({
        error:
          status === 413
            ? 'Requête IA trop volumineuse pour le serveur.'
            : 'Requête JSON invalide ou erreur interne du serveur IA.',
      });
      return;
    }
    next(err);
  });

  // Montage Vite en développement / fichiers statiques en production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Orange Pro B2B server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
