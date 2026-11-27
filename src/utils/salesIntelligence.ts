// Pure B2B Sales Intelligence engine:
// 1. Lead Scoring (0..100 + Grade A/B/C)
// 2. Deal Rotting / SLA inactivity detection
// 3. Weighted Pipeline Forecast (MAD)
// 100% client-side, zero AI cost, GitHub Pages & Express compatible.

import {
  computeMaturityScore,
  getOrangeProRecommendation,
  parseSafeHeadcount,
  type FicheEntreprise,
  type SecteurCode,
  type StatutCRM,
} from './crmDomain';
import type { AdvancedAccountPreferences } from './accountPreferences';
import { DEFAULT_ORG_SETTINGS, type OrgSettingsConfig } from './securityHardening';

export type LeadGrade = 'A' | 'B' | 'C';

export interface LeadScoreResult {
  score: number;
  grade: LeadGrade;
  reasons: string[];
}

export interface DealRottingResult {
  isRotting: boolean;
  elapsedHours: number;
  elapsedDays: number;
  thresholdHours: number;
  label: string;
}

export const PIPELINE_STAGE_PROBABILITIES: Record<StatutCRM, number> = {
  'À contacter': 0.1,
  'Appel en cours': 0.25,
  'RDV pris': 0.5,
  'Devis envoyé': 0.75,
  'Signé Orange Pro': 1.0,
  'Pas intéressé': 0,
};

const ACTIVE_PIPELINE_STATUTS = new Set<StatutCRM>([
  'À contacter',
  'Appel en cours',
  'RDV pris',
  'Devis envoyé',
]);

const HIGH_VALUE_SECTEURS = new Set<SecteurCode>([
  'clinique',
  'riad_hotellerie',
  'industrie',
  'fiduciaire',
  'gros',
  'enseignement',
]);

const MID_VALUE_SECTEURS = new Set<SecteurCode>([
  'notaire',
  'immobilier',
  'btp',
  'pme',
  'liberal',
]);

export function parseFollowUpDelayToHours(
  delay?: AdvancedAccountPreferences['followUpAlertDelay'] | number | null,
  fallbackHours = DEFAULT_ORG_SETTINGS.defaultSlaRottingHours
): number {
  if (typeof delay === 'number' && Number.isFinite(delay) && delay >= 1) {
    return Math.round(delay);
  }
  switch (delay) {
    case '24h':
      return 24;
    case '48h':
      return 48;
    case '72h':
      return 72;
    case '7d':
      return 168;
    default:
      return Math.max(12, Math.round(fallbackHours || 72));
  }
}

/**
 * Computes a deterministic 0..100 B2B Lead Score + Grade A/B/C for Orange Pro Morocco prospects.
 */
export function computeLeadScore(
  fiche: FicheEntreprise,
  prefs?: Partial<AdvancedAccountPreferences> | null
): LeadScoreResult {
  const reasons: string[] = [];

  if (fiche.optOut) {
    return {
      score: 0,
      grade: 'C',
      reasons: ['Prospect sur Liste Rouge CNDP (ne plus contacter)'],
    };
  }

  if (fiche.statut === 'Pas intéressé') {
    return {
      score: 8,
      grade: 'C',
      reasons: ['Prospect classé « Pas intéressé »'],
    };
  }

  let score = 0;

  // 1. Effectif / taille entreprise (jusqu'à 25 pts)
  const headcount = parseSafeHeadcount(fiche.effectif);
  if (headcount >= 30) {
    score += 25;
    reasons.push(`Grand Compte (${headcount} sal.)`);
  } else if (headcount >= 10) {
    score += 18;
    reasons.push(`PME (${headcount} sal.)`);
  } else if (headcount >= 3) {
    score += 10;
    reasons.push(`TPE structurée (${headcount} sal.)`);
  } else if (headcount > 0) {
    score += 6;
  }

  // 2. Potentiel secteur Orange Pro (jusqu'à 20 pts)
  if (HIGH_VALUE_SECTEURS.has(fiche.secteur)) {
    score += 20;
    reasons.push('Secteur forte valeur Fibre & Flotte');
  } else if (MID_VALUE_SECTEURS.has(fiche.secteur)) {
    score += 13;
  } else {
    score += 8;
  }

  // 3. Complétude / Maturité fiche (jusqu'à 20 pts)
  const maturity = computeMaturityScore(fiche);
  const targetMaturity = prefs?.targetMaturityPct || 85;
  score += Math.round((maturity / 100) * 20);
  if (maturity >= targetMaturity) {
    reasons.push(`Fiche complète (${maturity}%)`);
  }

  // 4. Décideur + Téléphone valide joignable (jusqu'à 15 pts)
  const hasPhone = Boolean((fiche.telephone || '').replace(/\D/g, '').length >= 8);
  const hasContact = Boolean((fiche.contact || '').trim().length >= 2);
  if (hasPhone && hasContact) {
    score += 15;
    reasons.push('Décideur + téléphone direct');
  } else if (hasPhone) {
    score += 8;
    reasons.push('Téléphone joignable');
  } else if (hasContact) {
    score += 4;
  }

  // 5. Dynamique pipeline / statut actif (jusqu'à 20 pts)
  switch (fiche.statut) {
    case 'Signé Orange Pro':
      score += 20;
      reasons.push('Client signé Orange Pro');
      break;
    case 'Devis envoyé':
      score += 18;
      reasons.push('Devis en cours de closing');
      break;
    case 'RDV pris':
      score += 15;
      reasons.push('RDV qualifié planifié');
      break;
    case 'Appel en cours':
      score += 10;
      reasons.push('Échange commercial engagé');
      break;
    case 'À contacter':
    default:
      score += 6;
      break;
  }

  if (fiche.verifieWeb) {
    score += 4;
  }

  const bounded = Math.max(0, Math.min(100, Math.round(score)));
  const grade: LeadGrade = bounded >= 72 ? 'A' : bounded >= 45 ? 'B' : 'C';

  return {
    score: bounded,
    grade,
    reasons: reasons.slice(0, 4),
  };
}

/**
 * Detects rotting/dormant active deals whose last status update exceeds the configured SLA delay.
 */
export function computeDealRotting(
  fiche: FicheEntreprise,
  delayOrHours?: AdvancedAccountPreferences['followUpAlertDelay'] | number | null,
  nowMs: number = Date.now()
): DealRottingResult {
  const thresholdHours = parseFollowUpDelayToHours(delayOrHours);

  if (!ACTIVE_PIPELINE_STATUTS.has(fiche.statut) || fiche.optOut) {
    return {
      isRotting: false,
      elapsedHours: 0,
      elapsedDays: 0,
      thresholdHours,
      label: '',
    };
  }

  const refIso = fiche.statutUpdatedAt || fiche.dateAjout || '';
  const refMs = Date.parse(refIso);
  if (!Number.isFinite(refMs)) {
    return {
      isRotting: false,
      elapsedHours: 0,
      elapsedDays: 0,
      thresholdHours,
      label: '',
    };
  }

  const elapsedHours = Math.max(0, (nowMs - refMs) / (1000 * 60 * 60));
  const elapsedDays = Math.max(1, Math.floor(elapsedHours / 24));
  const isRotting = elapsedHours > thresholdHours;

  return {
    isRotting,
    elapsedHours: Math.round(elapsedHours * 10) / 10,
    elapsedDays,
    thresholdHours,
    label: isRotting ? `Dormant ${elapsedDays}j` : '',
  };
}

/**
 * Estimates the standard MAD payout/value of a fiche based on its Orange Pro tier and org commission config.
 */
export function estimateFicheDealValueMad(
  fiche: FicheEntreprise,
  orgSettings?: Partial<OrgSettingsConfig> | null
): number {
  const rec = getOrangeProRecommendation(fiche);
  const gcMad =
    typeof orgSettings?.defaultPayoutGrandCompteMad === 'number' &&
    orgSettings.defaultPayoutGrandCompteMad >= 0
      ? orgSettings.defaultPayoutGrandCompteMad
      : DEFAULT_ORG_SETTINGS.defaultPayoutGrandCompteMad;
  const pmeMad =
    typeof orgSettings?.defaultPayoutPmeMad === 'number' && orgSettings.defaultPayoutPmeMad >= 0
      ? orgSettings.defaultPayoutPmeMad
      : DEFAULT_ORG_SETTINGS.defaultPayoutPmeMad;
  const tpeMad =
    typeof orgSettings?.defaultPayoutTpeMad === 'number' && orgSettings.defaultPayoutTpeMad >= 0
      ? orgSettings.defaultPayoutTpeMad
      : DEFAULT_ORG_SETTINGS.defaultPayoutTpeMad;

  if (rec.tier === 'Grand Compte') return gcMad;
  if (rec.tier === 'PME') return pmeMad;
  return tpeMad;
}

export interface PipelineForecastSummary {
  grossPipelineMad: number;
  weightedForecastMad: number;
  signedRevenueMad: number;
  activeDealsCount: number;
  rottingDealsCount: number;
  monthlyGoalMad: number;
  goalProgressPct: number;
  byStage: Record<
    StatutCRM,
    { count: number; grossMad: number; weightedMad: number; probability: number }
  >;
}

export function computeWeightedPipelineForecast(
  fiches: FicheEntreprise[],
  options?: {
    orgSettings?: Partial<OrgSettingsConfig> | null;
    monthlyGoalPayoutMad?: number;
    rottingThresholdHours?: AdvancedAccountPreferences['followUpAlertDelay'] | number | null;
    nowMs?: number;
  }
): PipelineForecastSummary {
  const byStage: PipelineForecastSummary['byStage'] = {
    'À contacter': { count: 0, grossMad: 0, weightedMad: 0, probability: 0.1 },
    'Appel en cours': { count: 0, grossMad: 0, weightedMad: 0, probability: 0.25 },
    'RDV pris': { count: 0, grossMad: 0, weightedMad: 0, probability: 0.5 },
    'Devis envoyé': { count: 0, grossMad: 0, weightedMad: 0, probability: 0.75 },
    'Signé Orange Pro': { count: 0, grossMad: 0, weightedMad: 0, probability: 1.0 },
    'Pas intéressé': { count: 0, grossMad: 0, weightedMad: 0, probability: 0 },
  };

  let grossPipelineMad = 0;
  let weightedForecastMad = 0;
  let signedRevenueMad = 0;
  let activeDealsCount = 0;
  let rottingDealsCount = 0;

  const threshold =
    options?.rottingThresholdHours ??
    options?.orgSettings?.defaultSlaRottingHours ??
    DEFAULT_ORG_SETTINGS.defaultSlaRottingHours;
  const nowMs = options?.nowMs ?? Date.now();

  for (const f of fiches) {
    if (!f || f.optOut) continue;
    const stage = byStage[f.statut] ? f.statut : 'À contacter';
    const prob = PIPELINE_STAGE_PROBABILITIES[stage] ?? 0;
    const dealValue = estimateFicheDealValueMad(f, options?.orgSettings);
    const weighted = Math.round(dealValue * prob);

    byStage[stage].count += 1;
    byStage[stage].grossMad += dealValue;
    byStage[stage].weightedMad += weighted;

    if (stage === 'Signé Orange Pro') {
      signedRevenueMad += dealValue;
      weightedForecastMad += dealValue;
    } else if (ACTIVE_PIPELINE_STATUTS.has(stage)) {
      activeDealsCount += 1;
      grossPipelineMad += dealValue;
      weightedForecastMad += weighted;
      if (computeDealRotting(f, threshold, nowMs).isRotting) {
        rottingDealsCount += 1;
      }
    }
  }

  const monthlyGoalMad =
    typeof options?.monthlyGoalPayoutMad === 'number' && options.monthlyGoalPayoutMad > 0
      ? Math.round(options.monthlyGoalPayoutMad)
      : 15000;
  const goalProgressPct = Math.min(
    999,
    Math.round((weightedForecastMad / Math.max(1, monthlyGoalMad)) * 100)
  );

  return {
    grossPipelineMad: Math.round(grossPipelineMad),
    weightedForecastMad: Math.round(weightedForecastMad),
    signedRevenueMad: Math.round(signedRevenueMad),
    activeDealsCount,
    rottingDealsCount,
    monthlyGoalMad,
    goalProgressPct,
    byStage,
  };
}
