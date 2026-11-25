import type { FicheEntreprise, SecteurCode, SegmentCouleur, StatutCRM } from '../App';

export type TrendPeriod = '7d' | '30d' | '90d';
export type TrendMetricMode = 'pipeline' | 'maturity' | 'segments';

export interface TrendPoint {
  dateKey: string;
  label: string;
  totalFiches: number;
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
}

export const KANBAN_STAGES: KanbanStageMeta[] = [
  {
    statut: 'À contacter',
    shortLabel: 'À contacter',
    description: 'Nouveaux comptes à appeler ou qualifier',
    accentBarCls: 'bg-stone-500',
    headerBgCls: 'bg-stone-50',
    badgeTextCls: 'text-stone-700',
  },
  {
    statut: 'Appel en cours',
    shortLabel: 'Appel en cours',
    description: 'Contact initié ou relance décideur',
    accentBarCls: 'bg-sky-600',
    headerBgCls: 'bg-sky-50/70',
    badgeTextCls: 'text-sky-800',
  },
  {
    statut: 'RDV pris',
    shortLabel: 'RDV pris',
    description: 'Visite terrain ou audit facture planifié',
    accentBarCls: 'bg-amber-500',
    headerBgCls: 'bg-amber-50/70',
    badgeTextCls: 'text-amber-900',
  },
  {
    statut: 'Devis envoyé',
    shortLabel: 'Devis envoyé',
    description: 'Proposition Fibre / Flotte transmise',
    accentBarCls: 'bg-orange-600',
    headerBgCls: 'bg-orange-50/70',
    badgeTextCls: 'text-orange-900',
  },
  {
    statut: 'Signé Orange Pro',
    shortLabel: 'Signé Orange Pro',
    description: 'Contrat validé et portabilité lancée',
    accentBarCls: 'bg-emerald-600',
    headerBgCls: 'bg-emerald-50/70',
    badgeTextCls: 'text-emerald-900',
  },
  {
    statut: 'Pas intéressé',
    shortLabel: 'Pas intéressé',
    description: 'Réactivation ultérieure fin de contrat',
    accentBarCls: 'bg-red-500',
    headerBgCls: 'bg-red-50/60',
    badgeTextCls: 'text-red-800',
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
    const inBucket = parsedFiches.filter((item) => item.addedDayMs <= bucketEndMs);

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

export interface KanbanColumnData {
  meta: KanbanStageMeta;
  items: FicheEntreprise[];
  totalEffectif: number;
  avgMaturity: number;
}

export function groupFichesByStatut(fiches: FicheEntreprise[]): KanbanColumnData[] {
  return KANBAN_STAGES.map((meta) => {
    const items = fiches.filter((f) => f.statut === meta.statut);
    const totalEffectif = items.reduce((acc, f) => acc + (parseInt(f.effectif, 10) || 0), 0);
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
  targetStatut: StatutCRM
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
    movedFiche = { ...f, statut: targetStatut };
    return movedFiche;
  });

  return { updated, movedFiche, changed };
}

export function buildPortfolioAiSummary(fiches: FicheEntreprise[]): string {
  const total = fiches.length;
  if (total === 0) return 'Portefeuille vide (0 fiche).';

  const cols = groupFichesByStatut(fiches);
  const pipelineLine = cols.map((c) => `${c.meta.statut}: ${c.items.length}`).join(' | ');
  const avgMat = Math.round(
    fiches.reduce((acc, f) => acc + computeFicheMaturityPure(f), 0) / total
  );
  const readyCount = fiches.filter((f) => f.telephone && f.contact).length;
  const citiesMap: Record<string, number> = {};
  fiches.forEach((f) => {
    const v = f.ville || 'Inconnue';
    citiesMap[v] = (citiesMap[v] || 0) + 1;
  });
  const topCities = Object.entries(citiesMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([v, n]) => `${v} (${n})`)
    .join(', ');

  const topAccounts = [...fiches]
    .sort((a, b) => (parseInt(b.effectif, 10) || 0) - (parseInt(a.effectif, 10) || 0))
    .slice(0, 8)
    .map(
      (f) =>
        `- ${f.societe} (${f.secteur}, ${f.ville || 'Maroc'}, eff: ${f.effectif || 'N/A'}, statut: ${f.statut}, contact: ${f.contact || 'absent'}, tél: ${f.telephone || 'absent'})`
    )
    .join('\n');

  return `Total fiches : ${total} | Prêtes à appeler (Tél+Décideur) : ${readyCount} | Maturité moyenne : ${avgMat}%
Pipeline Kanban : ${pipelineLine}
Villes principales : ${topCities}
Principaux comptes :
${topAccounts}`;
}
