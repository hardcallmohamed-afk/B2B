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
  isStaticOrHtml: boolean;
  shouldFallback: boolean;
}

export interface CopilotFicheInput {
  id: string;
  numeroFiche?: string;
  societe: string;
  secteur: string;
  secteurLabel?: string;
  ville: string;
  telephone: string;
  telephonesSupplementaires?: string[];
  email: string;
  emailsSupplementaires?: string[];
  contact: string;
  role: string;
  effectif: string;
  statut: string;
  dateAjout?: string;
  statutUpdatedAt?: string;
}

export function isStaticHostingEnvironment(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  const host = (window.location.hostname || '').toLowerCase();
  const proto = (window.location.protocol || '').toLowerCase();
  if (proto === 'file:' || proto === 'capacitor:' || proto === 'ionic:') return true;
  if (host.endsWith('.github.io')) return true;
  return false;
}

let globalAiAuthTokenGetter: (() => Promise<string | null>) | null = null;

export function setAiAuthTokenGetter(getter: (() => Promise<string | null>) | null): void {
  globalAiAuthTokenGetter = getter;
}

export async function getAiAuthToken(): Promise<string | null> {
  if (!globalAiAuthTokenGetter) return null;
  try {
    return await globalAiAuthTokenGetter();
  } catch {
    return null;
  }
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
      message: `Point d’accès IA indisponible sur cet hébergement (HTTP 404).`,
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
  const fallbackLabel = options?.fallbackLabel || 'Service IA serveur indisponible';

  if (url.startsWith('/api/') && isStaticHostingEnvironment()) {
    return {
      ok: false,
      status: 404,
      data: null,
      error: 'Hébergement statique détecté — bascule multi-IA ou analyse CRM locale activée.',
      isNetworkFailure: true,
      isStaticOrHtml: true,
      shouldFallback: true,
    };
  }

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
          isStaticOrHtml: false,
          shouldFallback: false,
        };
      }
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }

    try {
      const mergedHeaders = new Headers(init.headers);
      if (!mergedHeaders.has('Accept')) {
        mergedHeaders.set('Accept', 'application/json');
      }

      if (url.startsWith('/api/ai/') && url !== '/api/ai/status' && !mergedHeaders.has('Authorization')) {
        const token = await getAiAuthToken();
        if (!token) {
          clearTimeout(timer);
          return {
            ok: false,
            status: 401,
            data: null,
            error: 'Session requise pour utiliser l’IA serveur. Veuillez vous connecter.',
            isNetworkFailure: false,
            isStaticOrHtml: false,
            shouldFallback: true,
          };
        }
        mergedHeaders.set('Authorization', `Bearer ${token}`);
      }

      const res = await fetch(url, {
        credentials: init.credentials ?? 'same-origin',
        ...init,
        headers: mergedHeaders,
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
          isStaticOrHtml: false,
          shouldFallback: false,
        };
      }

      const extracted = extractFriendlyApiError(res.status, rawText, parsed, fallbackLabel);
      const redirectedToProxyCheck = Boolean(res.url && /__cookie_check/i.test(res.url));
      const isStaticOrHtml = extracted.isHtmlOrNonJson || redirectedToProxyCheck || res.status === 404;
      const shouldFallback =
        isStaticOrHtml || res.status === 401 || res.status === 403 || res.status === 429 || res.status >= 500;

      return {
        ok: false,
        status: res.status,
        data: parsed as T | null,
        error: extracted.message,
        isNetworkFailure: isStaticOrHtml,
        isStaticOrHtml,
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
          : `${fallbackLabel} (serveur distant injoignable).`,
        isNetworkFailure: true,
        isStaticOrHtml: false,
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
    isStaticOrHtml: false,
    shouldFallback: true,
  };
}

export function parseJsonObjectFromLlmText<T = Record<string, unknown>>(rawText: string): T | null {
  const cleaned = String(rawText || '')
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
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
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  const slice = cleaned.slice(start, end + 1);
  try {
    const extracted = JSON.parse(slice);
    if (extracted && typeof extracted === 'object' && !Array.isArray(extracted)) {
      return extracted as T;
    }
  } catch {
    // Attempt light repair for trailing commas before } or ]
    try {
      const repaired = slice.replace(/,\s*([}\]])/g, '$1');
      const extracted = JSON.parse(repaired);
      if (extracted && typeof extracted === 'object' && !Array.isArray(extracted)) {
        return extracted as T;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function parseGeneratedEmailFromLlmText(
  rawText: string,
  fallbackObjet?: string
): { objet?: string; corps?: string } | null {
  const jsonParsed = parseJsonObjectFromLlmText<{
    objet?: unknown;
    subject?: unknown;
    corps?: unknown;
    body?: unknown;
    message?: unknown;
  }>(rawText);

  if (jsonParsed) {
    const rawObjet = jsonParsed.objet ?? jsonParsed.subject;
    const rawCorps = jsonParsed.corps ?? jsonParsed.body ?? jsonParsed.message;
    const objet = typeof rawObjet === 'string' ? rawObjet.trim() : '';
    const corps = typeof rawCorps === 'string' ? rawCorps.trim() : '';
    if (objet || corps) {
      return {
        ...(objet ? { objet } : {}),
        ...(corps ? { corps } : {}),
      };
    }
  }

  const cleaned = String(rawText || '')
    .replace(/```(?:[a-z]+)?/gi, '')
    .replace(/```/g, '')
    .trim();
  if (!cleaned || cleaned.length < 20) return null;

  const subjectLineMatch = cleaned.match(
    /^\s*(?:\*{0,2})(?:objet|sujet|subject)(?:\*{0,2})\s*[:\-]\s*(.+)$/im
  );
  if (subjectLineMatch) {
    const objet = subjectLineMatch[1].replace(/\*{1,2}/g, '').trim();
    const afterSubject = cleaned
      .replace(subjectLineMatch[0], '')
      .replace(/^\s*(?:\*{0,2})(?:corps|message|body)(?:\*{0,2})\s*[:\-]\s*/im, '')
      .trim();
    if (objet || afterSubject) {
      return {
        ...(objet ? { objet } : {}),
        ...(afterSubject ? { corps: afterSubject } : {}),
      };
    }
  }

  return {
    ...(fallbackObjet?.trim() ? { objet: fallbackObjet.trim() } : {}),
    corps: cleaned,
  };
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

function getFicheMaturityPct(f: CopilotFicheInput): number {
  let score = 0;
  if (f.societe?.trim()) score += 15;
  if (f.ville?.trim()) score += 10;
  if (f.telephone?.trim()) score += 25;
  if (f.email?.trim()) score += 20;
  if (f.contact?.trim()) score += 15;
  if (f.role?.trim()) score += 5;
  if (f.effectif?.trim()) score += 10;
  return Math.min(100, score);
}

function getRecommendedOrangeProOffer(f: CopilotFicheInput): {
  tier: 'Grand Compte' | 'PME' | 'TPE / Libéral';
  offre: string;
} {
  const eff = parseInt(f.effectif || '0', 10) || 0;
  if (eff >= 30 || f.secteur === 'clinique' || f.secteur === 'industrie') {
    return {
      tier: 'Grand Compte',
      offre: 'Fibre Dédiée SLA + Flotte Mobile Corporate + Standard Cloud VoIP',
    };
  }
  if (
    eff >= 10 ||
    ['pme', 'btp', 'gros', 'immobilier', 'riad_hotellerie', 'enseignement'].includes(f.secteur)
  ) {
    return {
      tier: 'PME',
      offre: 'Pack Fibre Pro + 5 à 25 Lignes Forfaits Pro + Téléphonie IP',
    };
  }
  return {
    tier: 'TPE / Libéral',
    offre: 'Fibre Pro Essentiel + Ligne Mobile Pro illimitée + Backup 4G/5G',
  };
}

function computeElapsedHours(f: CopilotFicheInput, nowMs: number): number {
  const rawIso = f.statutUpdatedAt || f.dateAjout || '';
  const parsed = Date.parse(rawIso);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, (nowMs - parsed) / 3600000);
}

function formatAgeDaysOrHours(hours: number): string {
  if (hours < 24) return `${Math.max(1, Math.round(hours))}h`;
  return `${Math.round(hours / 24)}j`;
}

export function buildLocalDeterministicInsights(
  fiches: CopilotFicheInput[],
  nowMs: number = Date.now()
): PortfolioInsights {
  const total = fiches.length;
  if (total === 0) {
    return {
      scoreSante: 0,
      constatCle: 'Aucune fiche présente dans le portefeuille pour le moment.',
      alertePipeline: 'Importez ou créez des prospects B2B afin de démarrer le suivi pipeline.',
      actionsPrioritaires: [
        'Importer un fichier de prospects ou ajouter un premier compte entreprise.',
        'Renseigner le numéro de téléphone et le nom du décideur sur chaque fiche.',
      ],
      opportunitesCibles: [],
    };
  }

  const readyToCall = fiches.filter((f) => f.telephone?.trim() && f.contact?.trim());
  const withPhone = fiches.filter((f) => f.telephone?.trim());
  const withEmail = fiches.filter((f) => f.email?.trim());
  const incomplete = fiches.filter((f) => !f.telephone?.trim() || !f.email?.trim());
  const devisList = fiches.filter((f) => f.statut === 'Devis envoyé');
  const rdvList = fiches.filter((f) => f.statut === 'RDV pris');
  const appelList = fiches.filter((f) => f.statut === 'Appel en cours');
  const aContacterList = fiches.filter((f) => f.statut === 'À contacter');
  const signedList = fiches.filter((f) => f.statut === 'Signé Orange Pro');

  const avgMaturity = Math.round(
    fiches.reduce((acc, f) => acc + getFicheMaturityPct(f), 0) / total
  );
  const qualifiedCount = rdvList.length + devisList.length + signedList.length;
  const pipelineRatioPct = Math.round((qualifiedCount / total) * 100);
  const scoreSante = Math.max(
    15,
    Math.min(98, Math.round(avgMaturity * 0.65 + pipelineRatioPct * 0.35))
  );

  const stageAverages = new Map<string, number>();
  for (const st of ['À contacter', 'Appel en cours', 'RDV pris', 'Devis envoyé']) {
    const group = fiches.filter((f) => f.statut === st);
    if (group.length > 0) {
      const avg = group.reduce((sum, f) => sum + computeElapsedHours(f, nowMs), 0) / group.length;
      stageAverages.set(st, avg);
    }
  }

  const stalledFiches = fiches
    .filter((f) => f.statut !== 'Signé Orange Pro' && f.statut !== 'Pas intéressé')
    .map((f) => {
      const ageH = computeElapsedHours(f, nowMs);
      const stageAvg = stageAverages.get(f.statut) || 0;
      const isBlocked = ageH >= 24 && stageAvg > 0 && ageH / stageAvg >= 1.35;
      return { f, ageH, isBlocked };
    })
    .filter((x) => x.isBlocked)
    .sort((a, b) => b.ageH - a.ageH);

  const activeOrdered = fiches
    .filter((f) => f.statut !== 'Signé Orange Pro' && f.statut !== 'Pas intéressé')
    .map((f) => {
      const eff = parseInt(f.effectif || '0', 10) || 0;
      const mat = getFicheMaturityPct(f);
      const ageH = computeElapsedHours(f, nowMs);
      const stageWeight =
        f.statut === 'Devis envoyé'
          ? 45
          : f.statut === 'RDV pris'
          ? 35
          : f.statut === 'Appel en cours'
          ? 20
          : 10;
      const priorityScore =
        stageWeight +
        (f.telephone?.trim() ? 20 : 0) +
        (f.contact?.trim() ? 10 : 0) +
        Math.min(25, eff) +
        Math.round(mat * 0.2);
      return { f, eff, mat, ageH, priorityScore };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const constatCle = `${total} comptes actifs : ${withPhone.length} joignables par téléphone (${readyToCall.length} avec décideur identifié), ${withEmail.length} avec email et ${qualifiedCount} comptes en phase avancée (${rdvList.length} RDV, ${devisList.length} devis, ${signedList.length} signés). Maturité moyenne des fiches : ${avgMaturity}%.`;

  let alertePipeline = '';
  if (stalledFiches.length > 0) {
    const topStalled = stalledFiches[0];
    alertePipeline = `${stalledFiches.length} fiche(s) en ralentissement/blocage détecté, dont ${topStalled.f.numeroFiche ? `[${topStalled.f.numeroFiche}] ` : ''}${topStalled.f.societe} (${topStalled.f.statut} depuis ${formatAgeDaysOrHours(topStalled.ageH)}).`;
  } else if (devisList.length > 0) {
    alertePipeline = `${devisList.length} devis envoyé(s) à relancer prioritairement pour sécuriser la signature Orange Pro.`;
  } else if (incomplete.length > Math.ceil(total * 0.35)) {
    alertePipeline = `${incomplete.length} fiches manquent encore de téléphone ou d’email — enrichissement conseillé avant campagne d’appels.`;
  } else {
    alertePipeline = `${aContacterList.length} comptes en attente de premier contact et ${appelList.length} appels en cours à convertir en RDV.`;
  }

  const actionsPrioritaires: string[] = [];
  if (devisList.length > 0) {
    const topDevis = devisList.slice(0, 2).map((f) => `${f.numeroFiche ? `${f.numeroFiche} ` : ''}${f.societe}`).join(' & ');
    actionsPrioritaires.push(`Relancer en priorité les devis ouverts (${topDevis}) pour verrouiller la signature.`);
  }
  if (rdvList.length > 0) {
    actionsPrioritaires.push(
      `Préparer les ${rdvList.length} RDV planifiés avec audit facture télécom et plan de portabilité sans coupure.`
    );
  }
  if (readyToCall.filter((f) => f.statut === 'À contacter').length > 0) {
    const c = readyToCall.filter((f) => f.statut === 'À contacter').length;
    actionsPrioritaires.push(`Lancer une session d’appels sur les ${c} fiches « À contacter » déjà complètes (téléphone + décideur).`);
  }
  if (incomplete.length > 0) {
    actionsPrioritaires.push(`Compléter les ${incomplete.length} fiches incomplètes via l’assistant d’enrichissement avant relance.`);
  }
  if (actionsPrioritaires.length === 0) {
    actionsPrioritaires.push('Maintenir la cadence de prospection quotidienne sur les PME et Grands Comptes de votre zone.');
  }

  const opportunitesCibles = activeOrdered.slice(0, 3).map(({ f, eff, mat }) => {
    const reco = getRecommendedOrangeProOffer(f);
    const hasPhone = Boolean(f.telephone?.trim());
    const hasEmail = Boolean(f.email?.trim());
    const raison = `${f.statut} · ${reco.tier}${eff > 0 ? ` (${eff} sal.)` : ''} · Maturité ${mat}% · ${f.ville || 'Maroc'}`;
    const action =
      f.statut === 'Devis envoyé'
        ? `Relancer ${f.contact || 'le décideur'} (${f.telephone || f.email || 'canal à compléter'}) pour closing.`
        : f.statut === 'RDV pris'
        ? `Présenter l’offre ${reco.offre} lors du RDV.`
        : hasPhone
        ? `Appeler ${f.contact || 'le standard'} au ${f.telephone} pour qualifier les lignes actuelles.`
        : hasEmail
        ? `Envoyer une approche email ciblée (${f.email}) puis rappeler.`
        : `Enrichir le numéro direct du décideur avant prise de contact.`;
    return {
      numeroFiche: f.numeroFiche || '',
      societe: f.societe,
      raison,
      action,
    };
  });

  return {
    scoreSante,
    constatCle,
    alertePipeline,
    actionsPrioritaires: actionsPrioritaires.slice(0, 4),
    opportunitesCibles,
  };
}

export function buildLocalDeterministicBrief(fiche: CopilotFicheInput): CommercialBrief {
  const reco = getRecommendedOrangeProOffer(fiche);
  const eff = parseInt(fiche.effectif || '0', 10) || 0;
  const mat = getFicheMaturityPct(fiche);
  const hasPhone = Boolean(fiche.telephone?.trim());
  const hasEmail = Boolean(fiche.email?.trim());
  const priorite =
    fiche.statut === 'Devis envoyé' || fiche.statut === 'RDV pris' || reco.tier === 'Grand Compte' || eff >= 20
      ? 'Haute'
      : mat >= 60
      ? 'Moyenne'
      : 'À enrichir';

  const canalRecommande = hasPhone
    ? 'Téléphone'
    : hasEmail
    ? 'Email'
    : 'Enrichissement / Visite terrain';

  const resume = `${fiche.societe} (${fiche.secteurLabel || fiche.secteur}, ${fiche.ville || 'Maroc'}) est en statut « ${fiche.statut} » avec une maturité fiche de ${mat}%${eff > 0 ? ` et un effectif estimé à ${eff} salariés` : ''}. Offre ciblée : ${reco.tier} (${reco.offre}).`;

  const pitch3Points = [
    `Continuité d’activité garantie grâce à la ${reco.tier === 'Grand Compte' ? 'Fibre Dédiée avec SLA et bascule automatique' : 'Fibre Pro Orange + secours 4G/5G'}.`,
    `Portabilité fluide de vos lignes fixes et mobiles existantes sans coupure pour vos équipes${fiche.ville ? ` à ${fiche.ville}` : ''}.`,
    `Optimisation budgétaire sur facture unique entreprise (${eff >= 10 ? 'flotte mobile corporate + standard Cloud VoIP' : 'forfaits Pro et fixe professionnel'}).`,
  ];

  const objectionPrincipale =
    fiche.statut === 'Devis envoyé'
      ? 'Nous comparons encore les tarifs ou attendons la validation de la direction.'
      : 'Nous sommes déjà engagés chez un autre opérateur et craignons une coupure lors du changement.';

  const reponseObjection =
    fiche.statut === 'Devis envoyé'
      ? 'Proposez un point rapide de 10 minutes pour comparer ligne par ligne les économies mensuelles et fixer la date de mise en service.'
      : 'Rassurez sur l’audit gratuit de la facture actuelle, le calendrier de fin d’engagement et la portabilité pilotée sans interruption de service.';

  const prochaineAction =
    fiche.statut === 'Devis envoyé'
      ? `Relancer ${fiche.contact || 'le décideur'}${hasPhone ? ` au ${fiche.telephone}` : ''} pour valider la signature Orange Pro.`
      : fiche.statut === 'RDV pris'
      ? `Préparer la proposition chiffrée « ${reco.offre} » et vérifier le relevé de lignes avant le RDV.`
      : hasPhone
      ? `Appeler ${fiche.contact || 'le responsable'}${fiche.role ? ` (${fiche.role})` : ''} au ${fiche.telephone} pour qualifier le nombre de lignes et fixer un RDV.`
      : hasEmail
      ? `Envoyer un email personnalisé via le Studio Email à ${fiche.email} et rechercher un numéro direct.`
      : `Utiliser « Assistant Coller / Web » pour trouver le téléphone et le décideur de ${fiche.societe}.`;

  return {
    priorite,
    resume,
    pitch3Points,
    objectionPrincipale,
    reponseObjection,
    canalRecommande,
    prochaineAction,
  };
}

export function buildLocalDeterministicChatReply(
  query: string,
  fiches: CopilotFicheInput[],
  focusedFiche?: CopilotFicheInput | null
): string {
  const q = (query || '').trim().toLowerCase();
  if (fiches.length === 0) {
    return 'Votre portefeuille est actuellement vide. Ajoutez ou importez des fiches entreprises pour obtenir des recommandations personnalisées.';
  }

  // 1. Vérifier si un code OP-XXXX ou un nom d'entreprise précis est mentionné
  const codeMatch = q.match(/\bop-\d{1,6}\b/i);
  const byCode = codeMatch
    ? fiches.find((f) => (f.numeroFiche || '').toLowerCase() === codeMatch[0].toLowerCase())
    : undefined;
  const byName =
    byCode ||
    fiches.find((f) => f.societe.trim().length >= 3 && q.includes(f.societe.trim().toLowerCase()));
  const targetFiche = byName || (focusedFiche && /cette fiche|ce compte|argumentaire|brief|lui/i.test(q) ? focusedFiche : undefined);

  if (targetFiche) {
    const b = buildLocalDeterministicBrief(targetFiche);
    return `Analyse locale — ${targetFiche.numeroFiche ? `[${targetFiche.numeroFiche}] ` : ''}${targetFiche.societe} (${targetFiche.ville || 'Maroc'}) :
• Statut : ${targetFiche.statut} · Priorité : ${b.priorite}
• Diagnostic : ${b.resume}
• Argumentaire clé : ${b.pitch3Points.slice(0, 2).join(' | ')}
• Action immédiate (${b.canalRecommande}) : ${b.prochaineAction}`;
  }

  // 2. Script d'appel à froid
  if (/script|appel à froid|cold call|téléphone/i.test(q)) {
    const sampleVille = focusedFiche?.ville || fiches.find((f) => f.ville?.trim())?.ville || 'Meknès';
    return `Script appel à froid B2B Orange Pro (${sampleVille}) — ~30 sec :
« Bonjour [Prénom/Nom], conseiller Entreprises Orange Pro sur ${sampleVille}. J’accompagne les dirigeants du secteur [Secteur] pour fiabiliser leur connexion Fibre Pro avec secours 4G et regrouper leurs lignes mobiles sur une facture optimisée sans coupure lors de la portabilité. Est-ce que vous gérez aujourd’hui vos abonnements télécoms ou est-ce plutôt votre direction administrative ? Je vous propose un audit express de 10 min cette semaine sur votre facture actuelle. »`;
  }

  // 3. Relance Devis / RDV
  if (/relance|devis|rdv|closing|bloqué/i.test(q)) {
    const hot = fiches.filter((f) => f.statut === 'Devis envoyé' || f.statut === 'RDV pris');
    if (hot.length === 0) {
      const calls = fiches.filter((f) => f.statut === 'Appel en cours' || f.statut === 'À contacter').slice(0, 3);
      return `Aucun compte en « RDV pris » ou « Devis envoyé » pour le moment. Priorisez ces ${calls.length} comptes pour générer des RDV :\n${calls
        .map((f) => `• ${f.numeroFiche ? `${f.numeroFiche} · ` : ''}${f.societe} (${f.statut}) — ${f.telephone || f.email || 'À enrichir'}`)
        .join('\n')}`;
    }
    return `Plan de relance pipeline (${hot.length} comptes en RDV / Devis) :\n${hot
      .slice(0, 5)
      .map(
        (f) =>
          `• ${f.numeroFiche ? `${f.numeroFiche} · ` : ''}${f.societe} [${f.statut}] — ${f.contact || 'Décideur'} (${f.telephone || f.email || 'coordonnée à compléter'})`
      )
      .join('\n')}\nConseil : verrouillez une date de portabilité sans coupure et proposez un point facture de 10 minutes.`;
  }

  // 4. Plan Fibre & Flotte / Grand Compte / PME
  if (/fibre|flotte|grand compte|pme|potentiel/i.test(q)) {
    const ranked = [...fiches]
      .filter((f) => f.statut !== 'Pas intéressé')
      .map((f) => ({ f, reco: getRecommendedOrangeProOffer(f), eff: parseInt(f.effectif || '0', 10) || 0 }))
      .sort((a, b) => {
        const tierScore = (t: string) => (t === 'Grand Compte' ? 3 : t === 'PME' ? 2 : 1);
        return tierScore(b.reco.tier) - tierScore(a.reco.tier) || b.eff - a.eff;
      })
      .slice(0, 4);
    return `Top comptes Fibre Dédiée & Flotte Mobile :\n${ranked
      .map(
        ({ f, reco, eff }) =>
          `• ${f.numeroFiche ? `${f.numeroFiche} · ` : ''}${f.societe} (${reco.tier}${eff ? `, ${eff} sal.` : ''}) → ${reco.offre}${f.telephone ? ` · Tél : ${f.telephone}` : ''}`
      )
      .join('\n')}`;
  }

  // 5. Par défaut : priorités du jour & synthèse portefeuille
  const insights = buildLocalDeterministicInsights(fiches);
  return `Synthèse locale portefeuille (Score santé : ${insights.scoreSante}/100) :
${insights.constatCle}

Vigilance : ${insights.alertePipeline}

Top comptes prioritaires :
${insights.opportunitesCibles
  .map((o) => `• ${o.numeroFiche ? `${o.numeroFiche} · ` : ''}${o.societe} — ${o.action}`)
  .join('\n')}`;
}

export function buildPortfolioInsightsFromTextFallback(
  rawLlmText: string,
  fiches: CopilotFicheInput[]
): PortfolioInsights {
  const parsed = normalizePortfolioInsights(parseJsonObjectFromLlmText(rawLlmText));
  if (parsed) return parsed;
  const base = buildLocalDeterministicInsights(fiches);
  const cleaned = String(rawLlmText || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return base;
  return {
    ...base,
    constatCle: cleaned.slice(0, 420),
  };
}

export function buildCommercialBriefFromTextFallback(
  rawLlmText: string,
  fiche: CopilotFicheInput
): CommercialBrief {
  const parsed = normalizeCommercialBrief(parseJsonObjectFromLlmText(rawLlmText));
  if (parsed) return parsed;
  const base = buildLocalDeterministicBrief(fiche);
  const cleaned = String(rawLlmText || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return base;
  return {
    ...base,
    resume: cleaned.slice(0, 360),
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
