import {
  parseSafeHeadcount,
  type FicheEntreprise,
  type SecteurCode,
  type SegmentCouleur,
  type StatutCRM,
} from './crmDomain';

export { parseSafeHeadcount };

export type TrendPeriod = '7d' | '30d' | '90d';
export type TrendMetricMode = 'pipeline' | 'funnel' | 'cities' | 'maturity' | 'segments';

export interface TrendPoint {
  dateKey: string;
  label: string;
  totalFiches: number;
  newFiches: number;
  qualified: number;
  signed: number;
  avgMaturity: number;
  segments: Record<SegmentCouleur, number>;
}

export interface KpiTrendSummary {
  points: TrendPoint[];
  totalNow: number;
  totalDelta: number;
  qualifiedNow: number;
  signedNow: number;
  conversionRate: number;
  avgMaturityNow: number;
  maturityDelta: number;
}

export interface KanbanStageMeta {
  statut: StatutCRM;
  shortLabel: string;
  description: string;
  accentBarCls: string;
  headerBgCls: string;
  badgeTextCls: string;
  hexColor: string;
}

export const KANBAN_STAGES: KanbanStageMeta[] = [
  {
    statut: 'À contacter',
    shortLabel: 'À contacter',
    description: 'Nouveaux comptes à appeler ou qualifier',
    accentBarCls: 'bg-stone-500',
    headerBgCls: 'bg-stone-50',
    badgeTextCls: 'text-stone-700',
    hexColor: '#78716c',
  },
  {
    statut: 'Appel en cours',
    shortLabel: 'Appel en cours',
    description: 'Contact initié ou relance décideur',
    accentBarCls: 'bg-sky-600',
    headerBgCls: 'bg-sky-50/70',
    badgeTextCls: 'text-sky-800',
    hexColor: '#0284c7',
  },
  {
    statut: 'RDV pris',
    shortLabel: 'RDV pris',
    description: 'Visite terrain ou audit facture planifié',
    accentBarCls: 'bg-amber-500',
    headerBgCls: 'bg-amber-50/70',
    badgeTextCls: 'text-amber-900',
    hexColor: '#d97706',
  },
  {
    statut: 'Devis envoyé',
    shortLabel: 'Devis envoyé',
    description: 'Proposition Fibre / Flotte transmise',
    accentBarCls: 'bg-orange-600',
    headerBgCls: 'bg-orange-50/70',
    badgeTextCls: 'text-orange-900',
    hexColor: '#ea580c',
  },
  {
    statut: 'Signé Orange Pro',
    shortLabel: 'Signé Orange Pro',
    description: 'Contrat validé et portabilité lancée',
    accentBarCls: 'bg-emerald-600',
    headerBgCls: 'bg-emerald-50/70',
    badgeTextCls: 'text-emerald-900',
    hexColor: '#059669',
  },
  {
    statut: 'Pas intéressé',
    shortLabel: 'Pas intéressé',
    description: 'Réactivation ultérieure fin de contrat',
    accentBarCls: 'bg-red-500',
    headerBgCls: 'bg-red-50/60',
    badgeTextCls: 'text-red-800',
    hexColor: '#dc2626',
  },
];

const SECTEUR_TO_COULEUR: Record<SecteurCode, SegmentCouleur> = {
  fiduciaire: 'bleu',
  clinique: 'bleu',
  notaire: 'bleu',
  immobilier: 'vert',
  riad_hotellerie: 'orange',
  auto_ecole: 'jaune',
  pme: 'violet',
  industrie: 'violet',
  btp: 'violet',
  gros: 'violet',
  enseignement: 'violet',
  liberal: 'cyan',
  commerce: 'cyan',
};

export function computeFicheMaturityPure(f: FicheEntreprise): number {
  let score = 0;
  if (f.societe.trim()) score += 15;
  if (f.ville.trim()) score += 10;
  if (f.telephone.trim()) score += 25;
  if (f.email.trim()) score += 20;
  if (f.contact.trim()) score += 15;
  if (f.role.trim()) score += 5;
  if (f.effectif.trim()) score += 10;
  return Math.min(100, score);
}

// parseSafeHeadcount est ré-exporté depuis ./crmDomain pour préserver la compatibilité des imports existants.

function getOfferTierPure(f: FicheEntreprise): 'Grand Compte' | 'PME' | 'TPE / Libéral' {
  const eff = parseSafeHeadcount(f.effectif);
  if (eff >= 30 || f.secteur === 'clinique' || f.secteur === 'industrie') {
    return 'Grand Compte';
  }
  if (
    eff >= 10 ||
    f.secteur === 'pme' ||
    f.secteur === 'btp' ||
    f.secteur === 'gros' ||
    f.secteur === 'immobilier' ||
    f.secteur === 'riad_hotellerie' ||
    f.secteur === 'enseignement'
  ) {
    return 'PME';
  }
  return 'TPE / Libéral';
}

function toDayStartUtc(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function formatShortFrDate(ms: number): string {
  const d = new Date(ms);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
  return `${day} ${months[d.getUTCMonth()]}`;
}

export function buildKpiTrendSeries(
  fiches: FicheEntreprise[],
  period: TrendPeriod,
  referenceDate: Date = new Date()
): KpiTrendSummary {
  const daysTotal = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const bucketCount = period === '7d' ? 7 : period === '30d' ? 10 : 12;
  const endDayMs = toDayStartUtc(referenceDate);
  const startDayMs = endDayMs - (daysTotal - 1) * 86400000;
  const stepMs = bucketCount > 1 ? (endDayMs - startDayMs) / (bucketCount - 1) : 86400000;

  const parsedFiches = fiches.map((f) => {
    const parsedTime = Date.parse(f.dateAjout || '');
    const addedDayMs = Number.isFinite(parsedTime) ? toDayStartUtc(new Date(parsedTime)) : endDayMs;
    return {
      fiche: f,
      addedDayMs,
      maturity: computeFicheMaturityPure(f),
      couleur: SECTEUR_TO_COULEUR[f.secteur] || 'violet',
      isQualified:
        f.statut === 'RDV pris' || f.statut === 'Devis envoyé' || f.statut === 'Signé Orange Pro',
      isSigned: f.statut === 'Signé Orange Pro',
    };
  });

  const points: TrendPoint[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const bucketEndMs = i === bucketCount - 1 ? endDayMs : Math.round(startDayMs + i * stepMs);
    const prevBucketEndMs = i === 0 ? startDayMs - 86400000 : Math.round(startDayMs + (i - 1) * stepMs);
    const inBucket = parsedFiches.filter((item) => item.addedDayMs <= bucketEndMs);
    const newFiches = parsedFiches.filter(
      (item) => item.addedDayMs > prevBucketEndMs && item.addedDayMs <= bucketEndMs
    ).length;

    const segments: Record<SegmentCouleur, number> = {
      bleu: 0,
      vert: 0,
      orange: 0,
      jaune: 0,
      violet: 0,
      cyan: 0,
    };

    let qualified = 0;
    let signed = 0;
    let matSum = 0;

    for (const item of inBucket) {
      segments[item.couleur]++;
      if (item.isQualified) qualified++;
      if (item.isSigned) signed++;
      matSum += item.maturity;
    }

    const totalFiches = inBucket.length;
    const avgMaturity = totalFiches > 0 ? Math.round(matSum / totalFiches) : 0;

    points.push({
      dateKey: new Date(bucketEndMs).toISOString().slice(0, 10),
      label: formatShortFrDate(bucketEndMs),
      totalFiches,
      newFiches,
      qualified,
      signed,
      avgMaturity,
      segments,
    });
  }

  const first = points[0];
  const firstNonEmpty = points.find((p) => p.totalFiches > 0) || first;
  const last = points[points.length - 1];
  const totalNow = last?.totalFiches ?? 0;
  const totalDelta = totalNow - (first?.totalFiches ?? 0);
  const qualifiedNow = last?.qualified ?? 0;
  const signedNow = last?.signed ?? 0;
  const conversionRate = totalNow > 0 ? Math.round((qualifiedNow / totalNow) * 100) : 0;
  const avgMaturityNow = last?.avgMaturity ?? 0;
  const maturityDelta = avgMaturityNow - (firstNonEmpty?.avgMaturity ?? avgMaturityNow);

  return {
    points,
    totalNow,
    totalDelta,
    qualifiedNow,
    signedNow,
    conversionRate,
    avgMaturityNow,
    maturityDelta,
  };
}

export interface FunnelStageStat {
  statut: StatutCRM;
  shortLabel: string;
  count: number;
  cumulativeReached: number;
  sharePct: number;
  conversionPct: number;
  totalEffectif: number;
  avgMaturity: number;
  hexColor: string;
  isExitStage: boolean;
}

export function buildPipelineFunnelStats(fiches: FicheEntreprise[]): FunnelStageStat[] {
  const total = fiches.length;
  const activeOrder: StatutCRM[] = [
    'À contacter',
    'Appel en cours',
    'RDV pris',
    'Devis envoyé',
    'Signé Orange Pro',
  ];

  const byStage = new Map<StatutCRM, FicheEntreprise[]>();
  for (const s of KANBAN_STAGES) {
    byStage.set(s.statut, []);
  }
  for (const f of fiches) {
    const bucket = byStage.get(f.statut);
    if (bucket) bucket.push(f);
  }

  const reachedMap = new Map<StatutCRM, number>();
  let runningReached = 0;
  for (let i = activeOrder.length - 1; i >= 0; i--) {
    const st = activeOrder[i];
    runningReached += byStage.get(st)?.length ?? 0;
    reachedMap.set(st, runningReached);
  }

  return KANBAN_STAGES.map((stage) => {
    const items = byStage.get(stage.statut) ?? [];
    const count = items.length;
    const isExitStage = stage.statut === 'Pas intéressé';
    const cumulativeReached = isExitStage ? count : (reachedMap.get(stage.statut) ?? count);
    const sharePct = total > 0 ? Math.round((count / total) * 100) : 0;

    let conversionPct = 100;
    if (isExitStage) {
      conversionPct = total > 0 ? Math.round((count / total) * 100) : 0;
    } else {
      const activeIdx = activeOrder.indexOf(stage.statut);
      if (activeIdx === 0) {
        conversionPct = total > 0 ? Math.round((cumulativeReached / total) * 100) : 0;
      } else {
        const prevReached = reachedMap.get(activeOrder[activeIdx - 1]) ?? 0;
        conversionPct = prevReached > 0 ? Math.round((cumulativeReached / prevReached) * 100) : 0;
      }
    }

    const totalEffectif = items.reduce((acc, f) => acc + parseSafeHeadcount(f.effectif), 0);
    const avgMaturity =
      count > 0
        ? Math.round(items.reduce((acc, f) => acc + computeFicheMaturityPure(f), 0) / count)
        : 0;

    return {
      statut: stage.statut,
      shortLabel: stage.shortLabel,
      count,
      cumulativeReached,
      sharePct,
      conversionPct,
      totalEffectif,
      avgMaturity,
      hexColor: stage.hexColor,
      isExitStage,
    };
  });
}

export interface CityStat {
  ville: string;
  total: number;
  qualified: number;
  signed: number;
  totalEffectif: number;
  sharePct: number;
}

export interface OfferTierStat {
  tier: 'Grand Compte' | 'PME' | 'TPE / Libéral';
  count: number;
  sharePct: number;
  totalEffectif: number;
  hexColor: string;
}

export interface ContactabilitySummary {
  total: number;
  withPhone: number;
  withMultiPhone: number;
  withEmail: number;
  withMultiEmail: number;
  withDecideur: number;
  readyToCall: number;
  totalPhonesCount: number;
  totalEmailsCount: number;
}

export interface CityOfferBreakdown {
  topCities: CityStat[];
  offerTiers: OfferTierStat[];
  contactability: ContactabilitySummary;
}

export function buildCityAndOfferBreakdown(fiches: FicheEntreprise[]): CityOfferBreakdown {
  const total = fiches.length;
  const cityMap = new Map<string, { total: number; qualified: number; signed: number; totalEffectif: number }>();

  const tierAcc: Record<'Grand Compte' | 'PME' | 'TPE / Libéral', { count: number; totalEffectif: number }> = {
    'Grand Compte': { count: 0, totalEffectif: 0 },
    PME: { count: 0, totalEffectif: 0 },
    'TPE / Libéral': { count: 0, totalEffectif: 0 },
  };

  let withPhone = 0;
  let withMultiPhone = 0;
  let withEmail = 0;
  let withMultiEmail = 0;
  let withDecideur = 0;
  let readyToCall = 0;
  let totalPhonesCount = 0;
  let totalEmailsCount = 0;

  for (const f of fiches) {
    const ville = (f.ville || 'Non précisée').trim() || 'Non précisée';
    const eff = parseSafeHeadcount(f.effectif);
    const isQual =
      f.statut === 'RDV pris' || f.statut === 'Devis envoyé' || f.statut === 'Signé Orange Pro';
    const isSigned = f.statut === 'Signé Orange Pro';

    const cur = cityMap.get(ville) || { total: 0, qualified: 0, signed: 0, totalEffectif: 0 };
    cur.total += 1;
    if (isQual) cur.qualified += 1;
    if (isSigned) cur.signed += 1;
    cur.totalEffectif += eff;
    cityMap.set(ville, cur);

    const tier = getOfferTierPure(f);
    tierAcc[tier].count += 1;
    tierAcc[tier].totalEffectif += eff;

    const extraPhones = Array.isArray(f.telephonesSupplementaires)
      ? f.telephonesSupplementaires.filter(Boolean).length
      : 0;
    const extraEmails = Array.isArray(f.emailsSupplementaires)
      ? f.emailsSupplementaires.filter(Boolean).length
      : 0;

    const phoneCount = (f.telephone?.trim() ? 1 : 0) + extraPhones;
    const emailCount = (f.email?.trim() ? 1 : 0) + extraEmails;

    totalPhonesCount += phoneCount;
    totalEmailsCount += emailCount;

    if (phoneCount > 0) withPhone++;
    if (phoneCount > 1) withMultiPhone++;
    if (emailCount > 0) withEmail++;
    if (emailCount > 1) withMultiEmail++;
    if (f.contact?.trim()) withDecideur++;
    if (phoneCount > 0 && f.contact?.trim()) readyToCall++;
  }

  const topCities: CityStat[] = Array.from(cityMap.entries())
    .map(([ville, s]) => ({
      ville,
      total: s.total,
      qualified: s.qualified,
      signed: s.signed,
      totalEffectif: s.totalEffectif,
      sharePct: total > 0 ? Math.round((s.total / total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total || b.totalEffectif - a.totalEffectif)
    .slice(0, 6);

  const offerTiers: OfferTierStat[] = [
    {
      tier: 'Grand Compte',
      count: tierAcc['Grand Compte'].count,
      sharePct: total > 0 ? Math.round((tierAcc['Grand Compte'].count / total) * 100) : 0,
      totalEffectif: tierAcc['Grand Compte'].totalEffectif,
      hexColor: '#1c1917',
    },
    {
      tier: 'PME',
      count: tierAcc.PME.count,
      sharePct: total > 0 ? Math.round((tierAcc.PME.count / total) * 100) : 0,
      totalEffectif: tierAcc.PME.totalEffectif,
      hexColor: '#ea580c',
    },
    {
      tier: 'TPE / Libéral',
      count: tierAcc['TPE / Libéral'].count,
      sharePct: total > 0 ? Math.round((tierAcc['TPE / Libéral'].count / total) * 100) : 0,
      totalEffectif: tierAcc['TPE / Libéral'].totalEffectif,
      hexColor: '#0284c7',
    },
  ];

  return {
    topCities,
    offerTiers,
    contactability: {
      total,
      withPhone,
      withMultiPhone,
      withEmail,
      withMultiEmail,
      withDecideur,
      readyToCall,
      totalPhonesCount,
      totalEmailsCount,
    },
  };
}

export interface KanbanColumnData {
  meta: KanbanStageMeta;
  items: FicheEntreprise[];
  totalEffectif: number;
  avgMaturity: number;
}

export function groupFichesByStatut(fiches: FicheEntreprise[]): KanbanColumnData[] {
  return KANBAN_STAGES.map((meta) => {
    const items = fiches.filter((f) => f.statut === meta.statut);
    const totalEffectif = items.reduce((acc, f) => acc + parseSafeHeadcount(f.effectif), 0);
    const avgMaturity =
      items.length > 0
        ? Math.round(items.reduce((acc, f) => acc + computeFicheMaturityPure(f), 0) / items.length)
        : 0;
    return {
      meta,
      items,
      totalEffectif,
      avgMaturity,
    };
  });
}

export function moveFicheToStatut(
  fiches: FicheEntreprise[],
  ficheId: string,
  targetStatut: StatutCRM,
  transitionAt: string = new Date().toISOString()
): { updated: FicheEntreprise[]; movedFiche: FicheEntreprise | null; changed: boolean } {
  let movedFiche: FicheEntreprise | null = null;
  let changed = false;

  const updated = fiches.map((f) => {
    if (f.id !== ficheId) return f;
    if (f.statut === targetStatut) {
      movedFiche = f;
      return f;
    }
    changed = true;
    movedFiche = { ...f, statut: targetStatut, statutUpdatedAt: transitionAt };
    return movedFiche;
  });

  return { updated, movedFiche, changed };
}

export type VelocityLevel = 'fast' | 'normal' | 'slow' | 'bottleneck' | 'terminal';

export interface FicheVelocityInfo {
  ficheId: string;
  statut: StatutCRM;
  elapsedHours: number;
  elapsedDays: number;
  stageAvgHours: number;
  stageSampleCount: number;
  ratioToAvg: number;
  deltaPct: number;
  level: VelocityLevel;
  label: string;
  durationLabel: string;
  avgLabel: string;
  comparisonLabel: string;
  isBottleneck: boolean;
}

export interface StageVelocitySummary {
  statut: StatutCRM;
  count: number;
  avgHours: number;
  avgLabel: string;
  bottleneckCount: number;
  slowCount: number;
  isTerminal: boolean;
}

export interface PortfolioVelocityReport {
  byFicheId: Map<string, FicheVelocityInfo>;
  byStage: Record<StatutCRM, StageVelocitySummary>;
  totalBottlenecks: number;
  totalSlow: number;
  topBottleneckStage: StatutCRM | null;
}

const TERMINAL_VELOCITY_STAGES = new Set<StatutCRM>(['Signé Orange Pro', 'Pas intéressé']);

export function formatVelocityDuration(hours: number): string {
  if (!Number.isFinite(hours) || hours < 1) return '< 1h';
  if (hours < 24) {
    const rounded = Math.round(hours);
    return rounded >= 24 ? '1j' : `${rounded}h`;
  }
  const days = hours / 24;
  if (days < 10) {
    const roundedTenth = Math.round(days * 10) / 10;
    return `${String(roundedTenth).replace(/\.0$/, '').replace('.', ',')}j`;
  }
  return `${Math.round(days)}j`;
}

export function computePortfolioVelocity(
  fiches: FicheEntreprise[],
  referenceNowMs: number = Date.now()
): PortfolioVelocityReport {
  const stageAcc = new Map<StatutCRM, { sumHours: number; count: number }>();
  for (const s of KANBAN_STAGES) {
    stageAcc.set(s.statut, { sumHours: 0, count: 0 });
  }

  const elapsedByFiche = new Map<string, number>();

  for (const f of fiches) {
    const rawIso = f.statutUpdatedAt || f.dateAjout || '';
    const parsedMs = Date.parse(rawIso);
    const elapsedHours = Number.isFinite(parsedMs)
      ? Math.max(0, (referenceNowMs - parsedMs) / 3600000)
      : 0;
    elapsedByFiche.set(f.id, elapsedHours);

    const acc = stageAcc.get(f.statut);
    if (acc) {
      acc.sumHours += elapsedHours;
      acc.count += 1;
    }
  }

  const byStage = {} as Record<StatutCRM, StageVelocitySummary>;
  for (const s of KANBAN_STAGES) {
    const acc = stageAcc.get(s.statut) || { sumHours: 0, count: 0 };
    const avgHours = acc.count > 0 ? acc.sumHours / acc.count : 0;
    byStage[s.statut] = {
      statut: s.statut,
      count: acc.count,
      avgHours,
      avgLabel: acc.count > 0 ? formatVelocityDuration(avgHours) : '—',
      bottleneckCount: 0,
      slowCount: 0,
      isTerminal: TERMINAL_VELOCITY_STAGES.has(s.statut),
    };
  }

  const byFicheId = new Map<string, FicheVelocityInfo>();
  let totalBottlenecks = 0;
  let totalSlow = 0;

  for (const f of fiches) {
    const elapsedHours = elapsedByFiche.get(f.id) ?? 0;
    const elapsedDays = Number((elapsedHours / 24).toFixed(1));
    const stageSummary = byStage[f.statut];
    const stageAvgHours = stageSummary ? stageSummary.avgHours : 0;
    const stageSampleCount = stageSummary ? stageSummary.count : 1;
    const avgLabel = stageSummary ? stageSummary.avgLabel : '—';
    const durationLabel = formatVelocityDuration(elapsedHours);
    const ratioToAvg = stageAvgHours > 0 ? elapsedHours / stageAvgHours : 1;
    const deltaPct = stageAvgHours > 0 ? Math.round((ratioToAvg - 1) * 100) : 0;

    let level: VelocityLevel = 'normal';
    let label = 'Dans la moyenne';
    let isBottleneck = false;

    if (TERMINAL_VELOCITY_STAGES.has(f.statut)) {
      level = 'terminal';
      label = f.statut === 'Signé Orange Pro' ? 'Signé' : 'Clôturé';
    } else if (elapsedHours < 12) {
      level = 'fast';
      label = 'Rapide';
    } else if (stageSampleCount >= 2 && stageAvgHours > 0 && ratioToAvg >= 1.35 && elapsedHours >= 24) {
      level = 'bottleneck';
      label = 'Blocage';
      isBottleneck = true;
      totalBottlenecks += 1;
      if (stageSummary) stageSummary.bottleneckCount += 1;
    } else if (stageSampleCount >= 2 && stageAvgHours > 0 && ratioToAvg >= 1.1 && elapsedHours >= 18) {
      level = 'slow';
      label = 'Ralentissement';
      totalSlow += 1;
      if (stageSummary) stageSummary.slowCount += 1;
    } else if (stageSampleCount >= 2 && stageAvgHours > 0 && ratioToAvg <= 0.75) {
      level = 'fast';
      label = 'Rapide';
    }

    const deltaText =
      deltaPct > 0 ? `+${deltaPct}%` : deltaPct < 0 ? `${deltaPct}%` : 'dans la moy.';
    const comparisonLabel = TERMINAL_VELOCITY_STAGES.has(f.statut)
      ? stageSampleCount > 0
        ? `moy. ${avgLabel}`
        : '—'
      : stageSampleCount > 1 && stageAvgHours > 0
      ? `${deltaText} · moy. ${avgLabel}`
      : stageAvgHours > 0
      ? `moy. ${avgLabel}`
      : '—';

    byFicheId.set(f.id, {
      ficheId: f.id,
      statut: f.statut,
      elapsedHours,
      elapsedDays,
      stageAvgHours,
      stageSampleCount,
      ratioToAvg,
      deltaPct,
      level,
      label,
      durationLabel,
      avgLabel,
      comparisonLabel,
      isBottleneck,
    });
  }

  let topBottleneckStage: StatutCRM | null = null;
  let maxBottlenecks = 0;
  for (const s of KANBAN_STAGES) {
    const st = byStage[s.statut];
    if (st && st.bottleneckCount > maxBottlenecks) {
      maxBottlenecks = st.bottleneckCount;
      topBottleneckStage = s.statut;
    }
  }

  return {
    byFicheId,
    byStage,
    totalBottlenecks,
    totalSlow,
    topBottleneckStage,
  };
}

export function buildPortfolioAiSummary(fiches: FicheEntreprise[]): string {
  const total = fiches.length;
  if (total === 0) return 'Portefeuille vide (0 fiche).';

  const cols = groupFichesByStatut(fiches);
  const pipelineLine = cols.map((c) => `${c.meta.statut}: ${c.items.length}`).join(' | ');
  const avgMat = Math.round(
    fiches.reduce((acc, f) => acc + computeFicheMaturityPure(f), 0) / total
  );
  const breakdown = buildCityAndOfferBreakdown(fiches);
  const topCities = breakdown.topCities.map((c) => `${c.ville} (${c.total})`).join(', ');
  const offersLine = breakdown.offerTiers.map((t) => `${t.tier}: ${t.count}`).join(' | ');

  const topAccounts = [...fiches]
    .sort((a, b) => parseSafeHeadcount(b.effectif) - parseSafeHeadcount(a.effectif))
    .slice(0, 10)
    .map((f) => {
      const code = f.numeroFiche ? `[${f.numeroFiche}] ` : '';
      const extraP = f.telephonesSupplementaires?.length ? ` (+${f.telephonesSupplementaires.length})` : '';
      const extraE = f.emailsSupplementaires?.length ? ` (+${f.emailsSupplementaires.length})` : '';
      return `- ${code}${f.societe} (${f.secteur}, ${f.ville || 'Maroc'}, eff: ${f.effectif || 'N/A'}, statut: ${f.statut}, contact: ${f.contact || 'absent'}, tél: ${f.telephone || 'absent'}${extraP}, email: ${f.email || 'absent'}${extraE})`;
    })
    .join('\n');

  return `Total fiches : ${total} | Prêtes à appeler : ${breakdown.contactability.readyToCall} | Maturité moyenne : ${avgMat}% | Contacts : ${breakdown.contactability.totalPhonesCount} tél., ${breakdown.contactability.totalEmailsCount} emails
Pipeline Kanban : ${pipelineLine}
Offres Orange Pro : ${offersLine}
Villes principales : ${topCities}
Principaux comptes :
${topAccounts}`;
}
