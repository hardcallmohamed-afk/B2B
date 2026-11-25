import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const AI_MODEL = 'gemini-4-hydrogen';

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
      message: 'Clé Gemini invalide ou autorisations insuffisantes. Vérifiez votre clé dans Settings > Secrets.',
    };
  }
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(raw)) {
    return {
      status: 429,
      message: 'Quota API Gemini atteint temporairement. Vérifiez votre quota dans Settings > Secrets ou réessayez plus tard.',
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '512kb' }));

  // 1. Statut de l'intégration IA serveur (sans jamais exposer la clé)
  app.get('/api/ai/status', (_req, res) => {
    const available = isValidConfiguredKey(process.env.GEMINI_API_KEY);
    res.json({ available, model: AI_MODEL });
  });

  // 2. Copilote Commercial IA Orange Pro (Chat multi-tours contextualisé sur le portefeuille)
  app.post('/api/ai/chat', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Service Gemini IA non configuré sur le serveur. Vérifiez GEMINI_API_KEY dans Settings > Secrets.',
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

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: AI_MODEL,
          contents,
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })
      );

      const reply = (response.text ?? '').trim();
      if (!reply) {
        res.status(502).json({ error: 'Réponse vide du modèle Gemini.' });
        return;
      }
      res.json({ reply, model: AI_MODEL });
    } catch (err) {
      const formatted = formatAiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 3. Génération d'email B2B Orange Pro avec Skill (JSON structuré garanti)
  app.post('/api/ai/generate-email', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Service Gemini IA non configuré sur le serveur. Vérifiez GEMINI_API_KEY dans Settings > Secrets.',
      });
      return;
    }

    const prompt = clampString(req.body?.prompt, 6000);
    if (!prompt) {
      res.status(400).json({ error: 'Prompt email manquant.' });
      return;
    }

    try {
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: AI_MODEL,
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
        })
      );

      const text = (response.text ?? '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
      const parsed = JSON.parse(text);
      if (!parsed?.objet || !parsed?.corps) {
        res.status(502).json({ error: 'Format de réponse email IA incomplet.' });
        return;
      }

      res.json({
        objet: String(parsed.objet).trim(),
        corps: String(parsed.corps).trim(),
        model: AI_MODEL,
      });
    } catch (err) {
      const formatted = formatAiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 4. Brief Commercial IA (Battlecard structurée sur une fiche prospect)
  app.post('/api/ai/next-action', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Service Gemini IA non configuré sur le serveur. Vérifiez GEMINI_API_KEY dans Settings > Secrets.',
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
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: AI_MODEL,
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
        })
      );

      const cleanText = (response.text ?? '{}').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
      const parsed = JSON.parse(cleanText);
      res.json({ brief: parsed, model: AI_MODEL });
    } catch (err) {
      const formatted = formatAiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 5. Enrichissement Web IA via Google Search Grounding (serveur)
  app.post('/api/ai/enrich-web', async (req, res) => {
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

    const prompt = `Tu es un enquêteur B2B au Maroc. Fais une recherche Google vérifiée (site officiel, Telecontact.ma, Kerix.net, LinkedIn Maroc, Google Maps) pour l'entreprise exacte :
- Nom : "${societe}"
- Ville : "${ville}", Maroc
- Secteur actuel : "${secteur}"

Trouve UNIQUEMENT des données réellement trouvées sur le web (ne rien inventer, laisser "" si absent) :
- telephone (format marocain 05XXXXXXXX, 06XXXXXXXX ou 07XXXXXXXX)
- email (email professionnel officiel uniquement)
- contact (nom complet du décideur : Gérant, DG, Associé, Fondateur, Dr, Me, Arch)
- role (fonction du décideur)
- effectif (nombre entier uniquement si prouvé, sinon "")
- siteWeb (URL officielle)
- secteur (un code parmi : ${allowedSecteurs})

Réponds UNIQUEMENT par un objet JSON valide :
{"telephone":"","email":"","contact":"","role":"","effectif":"","siteWeb":"","secteur":""}`;

    try {
      const response = await ai.models.generateContent({
        model: AI_MODEL,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const rawText = (response.text ?? '').trim();
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = chunks
        .map((c: { web?: { uri?: string; title?: string } }) => ({
          uri: safeHttpUrl(c?.web?.uri),
          title: clampString(c?.web?.title, 120),
        }))
        .filter((s: { uri: string }) => Boolean(s.uri))
        .slice(0, 5);

      res.json({ text: rawText, sources, model: AI_MODEL });
    } catch (err) {
      const formatted = formatAiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
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
