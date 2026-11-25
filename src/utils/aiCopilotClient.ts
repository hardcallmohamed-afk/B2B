export interface CommercialBrief {
  priorite: string;
  resume: string;
  pitch3Points: string[];
  objectionPrincipale: string;
  reponseObjection: string;
  canalRecommande: string;
  prochaineAction: string;
}

export interface PortfolioInsights {
  scoreSante: number;
  constatCle: string;
  alertePipeline: string;
  actionsPrioritaires: string[];
  opportunitesCibles: Array<{
    numeroFiche: string;
    societe: string;
    raison: string;
    action: string;
  }>;
}

export interface JsonFetchResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string;
  isNetworkFailure: boolean;
  shouldFallback: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function extractFriendlyApiError(
  status: number,
  rawBody: string,
  parsed: Record<string, unknown> | null,
  fallbackLabel: string
): { message: string; isHtmlOrNonJson: boolean } {
  const jsonErr = typeof parsed?.error === 'string' ? parsed.error.trim() : '';
  if (jsonErr) {
    return { message: jsonErr, isHtmlOrNonJson: false };
  }
  const trimmed = rawBody.trim();
  const looksLikeHtml =
    /^<!doctype\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed) || trimmed.startsWith('<');
  if (looksLikeHtml) {
    return {
      message: `${fallbackLabel} (réponse serveur non JSON, HTTP ${status || 502}).`,
      isHtmlOrNonJson: true,
    };
  }
  if (status >= 500) {
    return {
      message: `${fallbackLabel} (erreur serveur HTTP ${status}).`,
      isHtmlOrNonJson: parsed === null,
    };
  }
  if (status === 404) {
    return {
      message: `Point d’accès IA introuvable sur le serveur (HTTP 404).`,
      isHtmlOrNonJson: parsed === null,
    };
  }
  return {
    message: `${fallbackLabel} (HTTP ${status || 'inconnu'}).`,
    isHtmlOrNonJson: parsed === null,
  };
}

export async function fetchJsonWithRetry<T = Record<string, unknown>>(
  url: string,
  init: RequestInit,
  options?: {
    timeoutMs?: number;
    maxNetworkRetries?: number;
    fallbackLabel?: string;
  }
): Promise<JsonFetchResult<T>> {
  const timeoutMs = options?.timeoutMs ?? 28000;
  const maxRetries = options?.maxNetworkRetries ?? 1;
  const fallbackLabel = options?.fallbackLabel || 'Impossible de joindre le serveur IA';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const parentSignal = init.signal;
    const onParentAbort = () => controller.abort();
    if (parentSignal) {
      if (parentSignal.aborted) {
        clearTimeout(timer);
        return {
          ok: false,
          status: 0,
          data: null,
          error: 'Requête annulée.',
          isNetworkFailure: true,
          shouldFallback: false,
        };
      }
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }

    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      const rawText = await res.text();
      let parsed: Record<string, unknown> | null = null;
      if (rawText.trim()) {
        try {
          const j = JSON.parse(rawText);
          if (j && typeof j === 'object') {
            parsed = j as Record<string, unknown>;
          }
        } catch {
          parsed = null;
        }
      }

      const isTransientGateway = res.status === 502 || res.status === 503 || res.status === 504;
      if ((!res.ok || !parsed) && isTransientGateway && attempt < maxRetries) {
        await sleep(450 * (attempt + 1));
        continue;
      }

      if (res.ok && parsed) {
        return {
          ok: true,
          status: res.status,
          data: parsed as T,
          error: '',
          isNetworkFailure: false,
          shouldFallback: false,
        };
      }

      const extracted = extractFriendlyApiError(res.status, rawText, parsed, fallbackLabel);
      const shouldFallback =
        extracted.isHtmlOrNonJson ||
        res.status === 404 ||
        res.status === 429 ||
        res.status >= 500;

      return {
        ok: false,
        status: res.status,
        data: parsed as T | null,
        error: extracted.message,
        isNetworkFailure: extracted.isHtmlOrNonJson,
        shouldFallback,
      };
    } catch (err) {
      if (attempt < maxRetries && !parentSignal?.aborted) {
        await sleep(450 * (attempt + 1));
        continue;
      }
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      return {
        ok: false,
        status: 0,
        data: null,
        error: isTimeout
          ? `${fallbackLabel} (délai d’attente dépassé).`
          : `${fallbackLabel} (connexion interrompue ou serveur indisponible).`,
        isNetworkFailure: true,
        shouldFallback: true,
      };
    } finally {
      clearTimeout(timer);
      if (parentSignal) {
        parentSignal.removeEventListener('abort', onParentAbort);
      }
    }
  }

  return {
    ok: false,
    status: 0,
    data: null,
    error: fallbackLabel,
    isNetworkFailure: true,
    shouldFallback: true,
  };
}

export function parseJsonObjectFromLlmText<T = Record<string, unknown>>(rawText: string): T | null {
  const cleaned = String(rawText || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  if (!cleaned) return null;
  try {
    const direct = JSON.parse(cleaned);
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
      return direct as T;
    }
  } catch {
    // Try extracting the outermost JSON object
  }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const extracted = JSON.parse(match[0]);
    if (extracted && typeof extracted === 'object' && !Array.isArray(extracted)) {
      return extracted as T;
    }
  } catch {
    return null;
  }
  return null;
}

export function normalizePortfolioInsights(raw: unknown): PortfolioInsights | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const constatCle = typeof obj.constatCle === 'string' ? obj.constatCle.trim() : '';
  const alertePipeline = typeof obj.alertePipeline === 'string' ? obj.alertePipeline.trim() : '';
  const scoreNum = Number(obj.scoreSante);
  const scoreSante = Number.isFinite(scoreNum)
    ? Math.max(0, Math.min(100, Math.round(scoreNum)))
    : 50;
  const actionsPrioritaires = Array.isArray(obj.actionsPrioritaires)
    ? obj.actionsPrioritaires.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 6)
    : [];
  const opportunitesCibles = Array.isArray(obj.opportunitesCibles)
    ? obj.opportunitesCibles
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const rec = item as Record<string, unknown>;
          const societe = String(rec.societe || '').trim();
          const raison = String(rec.raison || '').trim();
          const action = String(rec.action || '').trim();
          const numeroFiche = String(rec.numeroFiche || '').trim();
          if (!societe && !action) return null;
          return { numeroFiche, societe: societe || 'Compte cible', raison, action };
        })
        .filter((x): x is PortfolioInsights['opportunitesCibles'][number] => Boolean(x))
        .slice(0, 5)
    : [];

  if (!constatCle && actionsPrioritaires.length === 0 && opportunitesCibles.length === 0) {
    return null;
  }

  return {
    scoreSante,
    constatCle: constatCle || 'Analyse du portefeuille générée.',
    alertePipeline,
    actionsPrioritaires,
    opportunitesCibles,
  };
}

export function normalizeCommercialBrief(raw: unknown): CommercialBrief | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const resume = typeof obj.resume === 'string' ? obj.resume.trim() : '';
  const prochaineAction = typeof obj.prochaineAction === 'string' ? obj.prochaineAction.trim() : '';
  const pitch3Points = Array.isArray(obj.pitch3Points)
    ? obj.pitch3Points.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 5)
    : [];
  if (!resume && !prochaineAction && pitch3Points.length === 0) {
    return null;
  }
  return {
    priorite: typeof obj.priorite === 'string' && obj.priorite.trim() ? obj.priorite.trim() : 'Moyenne',
    resume: resume || 'Préparation commerciale générée pour ce compte.',
    pitch3Points,
    objectionPrincipale:
      typeof obj.objectionPrincipale === 'string' ? obj.objectionPrincipale.trim() : '',
    reponseObjection:
      typeof obj.reponseObjection === 'string' ? obj.reponseObjection.trim() : '',
    canalRecommande:
      typeof obj.canalRecommande === 'string' && obj.canalRecommande.trim()
        ? obj.canalRecommande.trim()
        : 'Téléphone',
    prochaineAction: prochaineAction || 'Contacter le décideur principal.',
  };
}

export function buildFallbackInsightsPrompt(portfolioSummary: string): string {
  return `Tu es Directeur des Ventes B2B Orange Pro Maroc. Réalise un diagnostic commercial exécutif basé STRICTEMENT sur ces données réelles :

${portfolioSummary}

Réponds UNIQUEMENT par un objet JSON valide (sans texte avant/après) au format exact :
{"scoreSante":72,"constatCle":"...","alertePipeline":"...","actionsPrioritaires":["...","...","..."],"opportunitesCibles":[{"numeroFiche":"OP-0001","societe":"...","raison":"...","action":"..."}]}`;
}

export function buildFallbackBriefPrompt(input: {
  societe: string;
  secteur: string;
  ville: string;
  effectif: string;
  statut: string;
  contact: string;
  role: string;
  tier: string;
  offre: string;
  maturite: number;
}): string {
  return `Tu es Directeur Commercial B2B Orange Pro Maroc. Génère une battlecard pour :
- Société : ${input.societe}
- Secteur : ${input.secteur}
- Ville : ${input.ville || 'Meknès'}
- Effectif : ${input.effectif || 'Non renseigné'}
- Décideur : ${input.contact || 'Inconnu'} (${input.role || 'Non précisé'})
- Statut : ${input.statut}
- Offre : ${input.tier} — ${input.offre}
- Maturité : ${input.maturite}%

Réponds UNIQUEMENT par un objet JSON valide (sans texte avant/après) au format exact :
{"priorite":"Haute","resume":"...","pitch3Points":["...","...","..."],"objectionPrincipale":"...","reponseObjection":"...","canalRecommande":"Téléphone","prochaineAction":"..."}`;
}

export function buildFallbackChatPrompt(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  portfolioSummary: string,
  focusedFiche: string
): string {
  const transcript = history
    .slice(-8)
    .map((m) => `${m.role === 'assistant' ? 'Copilote' : 'Commercial'}: ${m.content}`)
    .join('\n\n');
  return `Tu es le Copilote Commercial B2B Orange Pro Maroc (Meknès, El Hajeb, Ifrane, Azrou & tout le Maroc).
Réponds en français professionnel, concret et orienté action terrain (max 220 mots), en t'appuyant uniquement sur le portefeuille ci-dessous.

=== RÉSUMÉ PORTEFEUILLE ===
${portfolioSummary || 'Aucune fiche fournie.'}
${focusedFiche ? `\n=== FICHE CIBLÉE ===\n${focusedFiche}` : ''}

=== CONVERSATION ===
${transcript}

Réponse du Copilote :`;
}
