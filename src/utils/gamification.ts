// Pure Gamification (Badges, 5 Rarity Tiers, XP, Ranks), Commission Payouts & Team Leaderboard Engine.

export type BadgeRarity = 'commun' | 'peu_commun' | 'rare' | 'epique' | 'legendaire';

export interface RarityMeta {
  id: BadgeRarity;
  label: string;
  tierBonusXp: number;
  headerBg: string;
  headerText: string;
  pillBg: string;
  pillText: string;
  barColor: string;
  borderColor: string;
}

export const RARITY_ORDER: BadgeRarity[] = [
  'commun',
  'peu_commun',
  'rare',
  'epique',
  'legendaire',
];

export const RARITY_META: Record<BadgeRarity, RarityMeta> = {
  commun: {
    id: 'commun',
    label: 'Commun',
    tierBonusXp: 500,
    headerBg: 'bg-amber-200/90',
    headerText: 'text-amber-950',
    pillBg: 'bg-amber-200',
    pillText: 'text-amber-950',
    barColor: 'bg-amber-500',
    borderColor: 'border-amber-300',
  },
  peu_commun: {
    id: 'peu_commun',
    label: 'Peu commun',
    tierBonusXp: 1000,
    headerBg: 'bg-emerald-500',
    headerText: 'text-white',
    pillBg: 'bg-emerald-500',
    pillText: 'text-white',
    barColor: 'bg-emerald-500',
    borderColor: 'border-emerald-300',
  },
  rare: {
    id: 'rare',
    label: 'Rare',
    tierBonusXp: 2500,
    headerBg: 'bg-sky-500',
    headerText: 'text-white',
    pillBg: 'bg-sky-500',
    pillText: 'text-white',
    barColor: 'bg-sky-500',
    borderColor: 'border-sky-300',
  },
  epique: {
    id: 'epique',
    label: 'Épique',
    tierBonusXp: 5000,
    headerBg: 'bg-violet-500',
    headerText: 'text-white',
    pillBg: 'bg-violet-500',
    pillText: 'text-white',
    barColor: 'bg-violet-500',
    borderColor: 'border-violet-300',
  },
  legendaire: {
    id: 'legendaire',
    label: 'Légendaire',
    tierBonusXp: 10000,
    headerBg: 'bg-orange-500',
    headerText: 'text-white',
    pillBg: 'bg-orange-500',
    pillText: 'text-white',
    barColor: 'bg-orange-600',
    borderColor: 'border-orange-300',
  },
};

export type PayoutStatus = 'En attente' | 'Validé' | 'Versé' | 'Refusé';
export type OrangeProTier = 'Grand Compte' | 'PME' | 'TPE / Libéral';

export const ORANGE_PRO_PRODUCTS: Array<{
  label: string;
  tier: OrangeProTier;
  basePayoutMad: number;
}> = [
  {
    label: 'Fibre Pro Essentiel + Forfait Mobile Pro + Nom de domaine',
    tier: 'TPE / Libéral',
    basePayoutMad: 650,
  },
  {
    label: 'Pack Dar Box Pro 4G/5G + Ligne Fixe VoIP',
    tier: 'TPE / Libéral',
    basePayoutMad: 500,
  },
  {
    label: 'Fibre Pro + Pack Flotte 5-20 lignes + Fixe VoIP',
    tier: 'PME',
    basePayoutMad: 1500,
  },
  {
    label: 'Flotte Mobile Business (10+ lignes) + Roaming Pro',
    tier: 'PME',
    basePayoutMad: 1200,
  },
  {
    label: 'Fibre Dédiée + Flotte Mobile Corporate + Standard Cloud',
    tier: 'Grand Compte',
    basePayoutMad: 3500,
  },
  {
    label: 'Solution Multi-Sites SD-WAN + Fibre Dédiée + Cloud Sécurisé',
    tier: 'Grand Compte',
    basePayoutMad: 4500,
  },
];

export function computeDefaultPayoutMad(
  tier: OrangeProTier,
  effectifStr?: string,
  produit?: string
): number {
  const matched = ORANGE_PRO_PRODUCTS.find((p) => p.label === produit);
  let base =
    matched?.basePayoutMad ??
    (tier === 'Grand Compte' ? 3500 : tier === 'PME' ? 1500 : 650);

  const eff = parseInt(String(effectifStr || '').replace(/\D+/g, ''), 10) || 0;
  if (eff >= 50) base += 1000;
  else if (eff >= 30) base += 500;
  else if (eff >= 15) base += 250;

  return base;
}

export interface DiversifiaFixeCommissionItem {
  id: string;
  label: string;
  category: 'Fibre / Fixe' | 'Box 4G / 5G';
  commissionTotal: number;
  firstInvoiceMad: number;
  fourthInvoiceMad: number;
  tier: OrangeProTier;
}

export interface DiversifiaMobileForfaitItem {
  id: string;
  label: string;
  commissionTotal: number;
  firstInvoiceMad: number;
  fourthInvoiceMad: number;
}

export const DIVERSIFIA_FIXE_LINES: DiversifiaFixeCommissionItem[] = [
  {
    id: 'ftth_200',
    label: 'FTTH 200 Mega / PARTAGE',
    category: 'Fibre / Fixe',
    commissionTotal: 400,
    firstInvoiceMad: 400,
    fourthInvoiceMad: 0,
    tier: 'Grand Compte',
  },
  {
    id: 'ftth_100',
    label: 'FTTH 100 Mega / PARTAGE',
    category: 'Fibre / Fixe',
    commissionTotal: 300,
    firstInvoiceMad: 300,
    fourthInvoiceMad: 0,
    tier: 'PME',
  },
  {
    id: 'ftth_50',
    label: 'FTTH 50 Mega / PARTAGE',
    category: 'Fibre / Fixe',
    commissionTotal: 250,
    firstInvoiceMad: 250,
    fourthInvoiceMad: 0,
    tier: 'PME',
  },
  {
    id: 'ftth_20',
    label: 'FTTH 20Mega / PARTAGE',
    category: 'Fibre / Fixe',
    commissionTotal: 200,
    firstInvoiceMad: 200,
    fourthInvoiceMad: 0,
    tier: 'TPE / Libéral',
  },
  {
    id: 'tdlte',
    label: 'TDLTE',
    category: 'Fibre / Fixe',
    commissionTotal: 250,
    firstInvoiceMad: 250,
    fourthInvoiceMad: 0,
    tier: 'PME',
  },
  {
    id: 'box_5g',
    label: 'BOX 5G',
    category: 'Box 4G / 5G',
    commissionTotal: 250,
    firstInvoiceMad: 125,
    fourthInvoiceMad: 125,
    tier: 'PME',
  },
  {
    id: 'box_30_4g_prem',
    label: 'BOX 30MG / 4G Prem',
    category: 'Box 4G / 5G',
    commissionTotal: 250,
    firstInvoiceMad: 125,
    fourthInvoiceMad: 125,
    tier: 'PME',
  },
  {
    id: 'box_12_4g',
    label: 'BOX 12 MG / 4G',
    category: 'Box 4G / 5G',
    commissionTotal: 150,
    firstInvoiceMad: 100,
    fourthInvoiceMad: 50,
    tier: 'TPE / Libéral',
  },
  {
    id: 'adsl',
    label: 'ADSL',
    category: 'Fibre / Fixe',
    commissionTotal: 99,
    firstInvoiceMad: 99,
    fourthInvoiceMad: 0,
    tier: 'TPE / Libéral',
  },
];

export const DIVERSIFIA_MOBILE_FORFAITS: DiversifiaMobileForfaitItem[] = [
  {
    id: 'illimite_inter',
    label: 'ILLIMITE INTER',
    commissionTotal: 250,
    firstInvoiceMad: 125,
    fourthInvoiceMad: 125,
  },
  {
    id: 'illimite_na',
    label: 'ILLIMITE NA',
    commissionTotal: 200,
    firstInvoiceMad: 100,
    fourthInvoiceMad: 100,
  },
  {
    id: '31_heure',
    label: '31 HEURE',
    commissionTotal: 200,
    firstInvoiceMad: 100,
    fourthInvoiceMad: 100,
  },
  {
    id: '21_heure',
    label: '21 HEURE',
    commissionTotal: 150,
    firstInvoiceMad: 75,
    fourthInvoiceMad: 75,
  },
  {
    id: '15_heure',
    label: '15 HEURE',
    commissionTotal: 120,
    firstInvoiceMad: 60,
    fourthInvoiceMad: 60,
  },
  {
    id: '6_heure',
    label: '6 HEURE',
    commissionTotal: 80,
    firstInvoiceMad: 40,
    fourthInvoiceMad: 40,
  },
];

export interface SectorCommissionProfile {
  secteur: string;
  label: string;
  defaultEffectif: number;
  mobileAdoptionRate: number;
  preferredMobileForfaitId: string;
  highBandwidthBias: boolean;
}

export const COMMISSION_SECTOR_PROFILES: Record<string, SectorCommissionProfile> = {
  clinique: {
    secteur: 'clinique',
    label: 'Clinique privée',
    defaultEffectif: 35,
    mobileAdoptionRate: 0.35,
    preferredMobileForfaitId: 'illimite_na',
    highBandwidthBias: true,
  },
  industrie: {
    secteur: 'industrie',
    label: 'Industrie / Agro',
    defaultEffectif: 30,
    mobileAdoptionRate: 0.35,
    preferredMobileForfaitId: 'illimite_inter',
    highBandwidthBias: true,
  },
  btp: {
    secteur: 'btp',
    label: 'BTP / Construction',
    defaultEffectif: 20,
    mobileAdoptionRate: 0.45,
    preferredMobileForfaitId: 'illimite_na',
    highBandwidthBias: true,
  },
  gros: {
    secteur: 'gros',
    label: 'Commerce de gros',
    defaultEffectif: 15,
    mobileAdoptionRate: 0.45,
    preferredMobileForfaitId: 'illimite_inter',
    highBandwidthBias: false,
  },
  pme: {
    secteur: 'pme',
    label: 'PME Services',
    defaultEffectif: 15,
    mobileAdoptionRate: 0.4,
    preferredMobileForfaitId: 'illimite_na',
    highBandwidthBias: true,
  },
  enseignement: {
    secteur: 'enseignement',
    label: 'Enseignement / École',
    defaultEffectif: 18,
    mobileAdoptionRate: 0.25,
    preferredMobileForfaitId: '21_heure',
    highBandwidthBias: true,
  },
  riad_hotellerie: {
    secteur: 'riad_hotellerie',
    label: 'Riad / Hôtel',
    defaultEffectif: 14,
    mobileAdoptionRate: 0.3,
    preferredMobileForfaitId: 'illimite_inter',
    highBandwidthBias: true,
  },
  fiduciaire: {
    secteur: 'fiduciaire',
    label: 'Fiduciaire / Comptable',
    defaultEffectif: 8,
    mobileAdoptionRate: 0.35,
    preferredMobileForfaitId: '21_heure',
    highBandwidthBias: false,
  },
  immobilier: {
    secteur: 'immobilier',
    label: 'Immobilier / Promoteur',
    defaultEffectif: 8,
    mobileAdoptionRate: 0.4,
    preferredMobileForfaitId: '31_heure',
    highBandwidthBias: false,
  },
  notaire: {
    secteur: 'notaire',
    label: 'Notaire',
    defaultEffectif: 6,
    mobileAdoptionRate: 0.35,
    preferredMobileForfaitId: '21_heure',
    highBandwidthBias: false,
  },
  liberal: {
    secteur: 'liberal',
    label: 'Profession libérale',
    defaultEffectif: 4,
    mobileAdoptionRate: 0.3,
    preferredMobileForfaitId: '21_heure',
    highBandwidthBias: false,
  },
  commerce: {
    secteur: 'commerce',
    label: 'Pharmacie & Commerce',
    defaultEffectif: 4,
    mobileAdoptionRate: 0.25,
    preferredMobileForfaitId: '15_heure',
    highBandwidthBias: false,
  },
  auto_ecole: {
    secteur: 'auto_ecole',
    label: 'Auto-école',
    defaultEffectif: 3,
    mobileAdoptionRate: 0.35,
    preferredMobileForfaitId: '6_heure',
    highBandwidthBias: false,
  },
};

export interface ForecastCommissionInput {
  secteur: string;
  effectifNum: number;
  fixeLineId: string;
  fixeQty: number;
  mobileForfaitId: string;
  mobileQty: number;
}

export interface ForecastCommissionBreakdown {
  secteurLabel: string;
  effectifUsed: number;
  isEffectifEstimated: boolean;
  fixeLine: DiversifiaFixeCommissionItem;
  fixeQty: number;
  fixeTotalMad: number;
  fixeFirstInvoiceMad: number;
  fixeFourthInvoiceMad: number;
  mobileForfait: DiversifiaMobileForfaitItem;
  mobileQty: number;
  mobileTotalMad: number;
  mobileFirstInvoiceMad: number;
  mobileFourthInvoiceMad: number;
  totalCommissionMad: number;
  firstInvoiceMad: number;
  fourthInvoiceMad: number;
  recommendedTier: OrangeProTier;
  summaryLabel: string;
}

export function getSectorCommissionProfile(secteur: string): SectorCommissionProfile {
  return COMMISSION_SECTOR_PROFILES[secteur] || COMMISSION_SECTOR_PROFILES.pme;
}

export function parseEffectifNumber(effectifStr?: string): number {
  const digits = String(effectifStr || '').replace(/\D+/g, '');
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(5000, n) : 0;
}

export function buildDefaultForecastParams(
  secteur: string,
  effectifStr?: string
): ForecastCommissionInput & { isEffectifEstimated: boolean } {
  const profile = getSectorCommissionProfile(secteur);
  const parsedEff = parseEffectifNumber(effectifStr);
  const isEffectifEstimated = parsedEff <= 0;
  const effectifNum = isEffectifEstimated ? profile.defaultEffectif : parsedEff;

  let fixeLineId = 'ftth_50';
  if (effectifNum >= 30 || (effectifNum >= 15 && profile.highBandwidthBias)) {
    fixeLineId = 'ftth_200';
  } else if (
    effectifNum >= 10 ||
    ['fiduciaire', 'notaire', 'immobilier', 'gros', 'btp'].includes(profile.secteur)
  ) {
    fixeLineId = 'ftth_100';
  } else if (effectifNum >= 4) {
    fixeLineId = 'ftth_50';
  } else {
    fixeLineId = 'ftth_20';
  }

  const fixeQty = effectifNum >= 60 ? 2 : 1;
  const mobileQty = Math.max(1, Math.min(80, Math.round(effectifNum * profile.mobileAdoptionRate)));

  return {
    secteur: profile.secteur,
    effectifNum,
    isEffectifEstimated,
    fixeLineId,
    fixeQty,
    mobileForfaitId: profile.preferredMobileForfaitId,
    mobileQty,
  };
}

export function calculateForecastCommission(
  input: ForecastCommissionInput & { isEffectifEstimated?: boolean }
): ForecastCommissionBreakdown {
  const profile = getSectorCommissionProfile(input.secteur);
  const effectifUsed = Math.max(1, Math.min(5000, Math.round(Number(input.effectifNum) || 1)));
  const fixeLine =
    DIVERSIFIA_FIXE_LINES.find((l) => l.id === input.fixeLineId) || DIVERSIFIA_FIXE_LINES[1];
  const mobileForfait =
    DIVERSIFIA_MOBILE_FORFAITS.find((m) => m.id === input.mobileForfaitId) ||
    DIVERSIFIA_MOBILE_FORFAITS[1];

  const fixeQty = Math.max(0, Math.min(50, Math.round(Number(input.fixeQty) || 0)));
  const mobileQty = Math.max(0, Math.min(200, Math.round(Number(input.mobileQty) || 0)));

  const fixeTotalMad = fixeLine.commissionTotal * fixeQty;
  const fixeFirstInvoiceMad = fixeLine.firstInvoiceMad * fixeQty;
  const fixeFourthInvoiceMad = fixeLine.fourthInvoiceMad * fixeQty;

  const mobileTotalMad = mobileForfait.commissionTotal * mobileQty;
  const mobileFirstInvoiceMad = mobileForfait.firstInvoiceMad * mobileQty;
  const mobileFourthInvoiceMad = mobileForfait.fourthInvoiceMad * mobileQty;

  const totalCommissionMad = fixeTotalMad + mobileTotalMad;
  const firstInvoiceMad = fixeFirstInvoiceMad + mobileFirstInvoiceMad;
  const fourthInvoiceMad = fixeFourthInvoiceMad + mobileFourthInvoiceMad;

  const recommendedTier: OrangeProTier =
    effectifUsed >= 30 || totalCommissionMad >= 2000
      ? 'Grand Compte'
      : effectifUsed >= 10 || totalCommissionMad >= 700
      ? 'PME'
      : 'TPE / Libéral';

  const parts: string[] = [];
  if (fixeQty > 0) parts.push(`${fixeQty}× ${fixeLine.label}`);
  if (mobileQty > 0) parts.push(`${mobileQty}× Forfait ${mobileForfait.label}`);
  const summaryLabel = parts.length > 0 ? parts.join(' + ') : 'Aucune ligne sélectionnée';

  return {
    secteurLabel: profile.label,
    effectifUsed,
    isEffectifEstimated: Boolean(input.isEffectifEstimated),
    fixeLine,
    fixeQty,
    fixeTotalMad,
    fixeFirstInvoiceMad,
    fixeFourthInvoiceMad,
    mobileForfait,
    mobileQty,
    mobileTotalMad,
    mobileFirstInvoiceMad,
    mobileFourthInvoiceMad,
    totalCommissionMad,
    firstInvoiceMad,
    fourthInvoiceMad,
    recommendedTier,
    summaryLabel,
  };
}

export interface SignedContractRecord {
  id: string;
  orgScope: 'orange_pro_team';
  ownerId: string;
  ownerName: string;
  ficheId: string;
  numeroFiche: string;
  societe: string;
  ville: string;
  secteur: string;
  produitOrangePro: string;
  tier: OrangeProTier;
  effectif: string;
  payoutMad: number;
  payoutStatus: PayoutStatus;
  signedAt: string;
  referenceVirement?: string;
  refusMotif?: string;
}

export interface TeamStatRecord {
  uid: string;
  orgScope: 'orange_pro_team';
  displayName: string;
  role: TeamRole;
  zone: string;
  active: boolean;
  totalProspects: number;
  totalQualified: number;
  totalContracts: number;
  totalPayoutMad: number;
  xp: number;
  unlockedCount: number;
  manualBadges: string[];
  monthlyHistory: string[]; // "YYYY-MM:contracts:payout"
  avatarDataUrl?: string;
}

export interface CollaboratorMetrics {
  totalProspects: number;
  qualifiedCount: number; // RDV + Devis + Signés
  contractsCount: number;
  grandCompteContracts: number;
  pmeContracts: number;
  totalPayoutMad: number;
  multiContactFiches: number;
  highMaturityFiches: number; // >= 85%
  distinctCities: number;
}

export interface ManualBadgeDefinition {
  id: string;
  title: string;
  description: string;
  rarity: BadgeRarity;
  xpBoost: number;
  iconKey: string;
  category?: 'distinction' | 'role';
}

export type TeamRole = 'super_admin' | 'manager' | 'team_lead' | 'grand_compte' | 'commercial';

export const TEAM_ROLE_ORDER: TeamRole[] = [
  'super_admin',
  'manager',
  'team_lead',
  'grand_compte',
  'commercial',
];

export const ROLE_BADGE_META: Record<
  TeamRole,
  {
    label: string;
    shortLabel: string;
    description: string;
    className: string;
  }
> = {
  super_admin: {
    label: 'Super-Admin',
    shortLabel: 'Admin',
    description: 'Direction & accès total (utilisateurs, payouts, clés API, badges)',
    className: 'bg-orange-600 text-white border border-orange-700',
  },
  manager: {
    label: 'Superviseur / Manager',
    shortLabel: 'Manager',
    description: 'Pilotage commercial & suivi d’équipe Orange Pro',
    className: 'bg-violet-50 text-violet-900 border border-violet-300',
  },
  team_lead: {
    label: 'Chef d’Équipe',
    shortLabel: 'Chef Équipe',
    description: 'Animation d’escouade terrain & accompagnement commercial',
    className: 'bg-indigo-50 text-indigo-900 border border-indigo-300',
  },
  grand_compte: {
    label: 'Expert Grand Compte',
    shortLabel: 'Grand Compte',
    description: 'Négociation Fibre Dédiée, flottes corporate & dossiers grands comptes',
    className: 'bg-amber-50 text-amber-900 border border-amber-300',
  },
  commercial: {
    label: 'Commercial B2B',
    shortLabel: 'Commercial',
    description: 'Prospection terrain, qualification & signature Orange Pro',
    className: 'bg-sky-50 text-sky-900 border border-sky-300',
  },
};

export const ADMIN_DISTINCTION_BADGES: ManualBadgeDefinition[] = [
  // Badges de Rôles & Fonctions (attribuables par le Super-Admin)
  {
    id: 'role_chef_equipe',
    title: 'Rôle : Chef d’Équipe',
    description: 'Badge de rôle officiel reconnaissant la coordination d’une escouade terrain.',
    rarity: 'epique',
    xpBoost: 500,
    iconKey: 'crown',
    category: 'role',
  },
  {
    id: 'role_expert_gc',
    title: 'Rôle : Expert Grand Compte',
    description: 'Badge de rôle dédié aux négociations Fibre Dédiée & flottes corporate.',
    rarity: 'rare',
    xpBoost: 400,
    iconKey: 'briefcase',
    category: 'role',
  },
  {
    id: 'role_responsable_zone',
    title: 'Rôle : Responsable de Zone',
    description: 'Badge de rôle attribué au référent territorial (Meknès, Fès, Ifrane, Région).',
    rarity: 'rare',
    xpBoost: 350,
    iconKey: 'map',
    category: 'role',
  },
  {
    id: 'role_mentor_b2b',
    title: 'Rôle : Mentor Commercial',
    description: 'Badge de rôle décerné aux collaborateurs qui forment et accompagnent les recrues.',
    rarity: 'peu_commun',
    xpBoost: 200,
    iconKey: 'shield',
    category: 'role',
  },
  {
    id: 'role_superviseur_diversifia',
    title: 'Rôle : Superviseur DIVERSIFIA',
    description: 'Badge de rôle officiel des superviseurs et directeurs de plateau DIVERSIFIA.',
    rarity: 'epique',
    xpBoost: 550,
    iconKey: 'crown',
    category: 'role',
  },
  // Distinctions de Performance (attribuables par le Super-Admin)
  {
    id: 'admin_mvp_mois',
    title: 'MVP du Mois',
    description: 'Distinction attribuée par la direction au meilleur vendeur du mois.',
    rarity: 'epique',
    xpBoost: 600,
    iconKey: 'crown',
    category: 'distinction',
  },
  {
    id: 'admin_best_closer',
    title: 'Meilleur Closer Terrain',
    description: 'Performance exceptionnelle de signature et maîtrise de la négociation.',
    rarity: 'rare',
    xpBoost: 350,
    iconKey: 'flame',
    category: 'distinction',
  },
  {
    id: 'admin_fibre_champion',
    title: 'Champion Fibre Dédiée',
    description: 'Excellence reconnue sur les dossiers Fibre Dédiée & Standard Cloud.',
    rarity: 'rare',
    xpBoost: 300,
    iconKey: 'zap',
    category: 'distinction',
  },
  {
    id: 'admin_box5g_expert',
    title: 'Expert Box 5G & FTTH',
    description: 'Distinction décernée pour la maîtrise des déploiements Box 5G et Fibre FTTH 100M/200M.',
    rarity: 'rare',
    xpBoost: 350,
    iconKey: 'zap',
    category: 'distinction',
  },
  {
    id: 'admin_flotte_master',
    title: 'Maître Flotte Mobile Pro',
    description: 'Performance remarquable sur les forfaits Flotte Mobile 15H, 31H et Illimité.',
    rarity: 'rare',
    xpBoost: 400,
    iconKey: 'phone',
    category: 'distinction',
  },
  {
    id: 'admin_crm_quality',
    title: 'Excellence Qualité CRM',
    description: 'Portefeuille exemplaire : fiches complètes, décideurs et suivi rigoureux.',
    rarity: 'peu_commun',
    xpBoost: 150,
    iconKey: 'shield',
    category: 'distinction',
  },
  {
    id: 'admin_team_spirit',
    title: 'Esprit d’Équipe Orange Pro',
    description: 'Entraide terrain et partage de bonnes pratiques salués par l’administrateur.',
    rarity: 'commun',
    xpBoost: 100,
    iconKey: 'heart',
    category: 'distinction',
  },
  {
    id: 'admin_diversifia_ambassador',
    title: 'Ambassadeur DIVERSIFIA',
    description: 'Distinction d’honneur attribuée aux piliers incarnant l’excellence DIVERSIFIA.',
    rarity: 'legendaire',
    xpBoost: 1200,
    iconKey: 'star',
    category: 'distinction',
  },
  {
    id: 'admin_legend_hall',
    title: 'Hall of Fame Orange Pro',
    description: 'Reconnaissance ultime décernée par la direction commerciale.',
    rarity: 'legendaire',
    xpBoost: 1500,
    iconKey: 'trophy',
    category: 'distinction',
  },
];

interface AutoAchievementDefinition {
  id: string;
  title: string;
  description: string;
  rarity: BadgeRarity;
  xpBoost: number;
  xpType: string;
  iconKey: string;
  target: number;
  unit?: string;
  getValue: (m: CollaboratorMetrics) => number;
}

const AUTO_ACHIEVEMENTS: AutoAchievementDefinition[] = [
  // COMMUN (8)
  {
    id: 'first_prospect',
    title: 'Premier Prospect',
    description: 'Enregistrez votre première entreprise dans le portefeuille CRM.',
    rarity: 'commun',
    xpBoost: 50,
    xpType: 'Prospection',
    iconKey: 'building',
    target: 1,
    getValue: (m) => m.totalProspects,
  },
  {
    id: 'prospect_5',
    title: 'Décollage Terrain',
    description: 'Ajoutez vos 5 premières entreprises prospects dans le portefeuille.',
    rarity: 'commun',
    xpBoost: 60,
    xpType: 'Prospection',
    iconKey: 'building',
    target: 5,
    getValue: (m) => m.totalProspects,
  },
  {
    id: 'prospect_10',
    title: 'Chasseur Actif',
    description: 'Constituez un portefeuille d’au moins 10 entreprises qualifiables.',
    rarity: 'commun',
    xpBoost: 75,
    xpType: 'Prospection',
    iconKey: 'target',
    target: 10,
    getValue: (m) => m.totalProspects,
  },
  {
    id: 'first_qualified',
    title: 'Premier RDV / Devis',
    description: 'Faites progresser votre premier prospect en RDV pris ou Devis envoyé.',
    rarity: 'commun',
    xpBoost: 80,
    xpType: 'Pipeline',
    iconKey: 'calendar',
    target: 1,
    getValue: (m) => m.qualifiedCount,
  },
  {
    id: 'qualified_2',
    title: 'Double Ouverture',
    description: 'Obtenez 2 comptes qualifiés (RDV pris, Devis envoyé ou Signé).',
    rarity: 'commun',
    xpBoost: 90,
    xpType: 'Pipeline',
    iconKey: 'calendar',
    target: 2,
    getValue: (m) => m.qualifiedCount,
  },
  {
    id: 'first_contract',
    title: 'Première Signature',
    description: 'Signez votre tout premier contrat Orange Pro.',
    rarity: 'commun',
    xpBoost: 150,
    xpType: 'Ventes',
    iconKey: 'award',
    target: 1,
    getValue: (m) => m.contractsCount,
  },
  {
    id: 'multi_contact_3',
    title: 'Réseau Multi-Contacts',
    description: 'Enrichissez 3 fiches avec plusieurs téléphones ou emails.',
    rarity: 'commun',
    xpBoost: 60,
    xpType: 'Qualité CRM',
    iconKey: 'phone',
    target: 3,
    getValue: (m) => m.multiContactFiches,
  },
  {
    id: 'payout_500',
    title: 'Premier Jour de Paie',
    description: 'Cumulez 500 MAD ou plus de payout validé/signé.',
    rarity: 'commun',
    xpBoost: 75,
    xpType: 'Payout',
    iconKey: 'wallet',
    target: 500,
    unit: 'MAD',
    getValue: (m) => m.totalPayoutMad,
  },

  // PEU COMMUN (8)
  {
    id: 'prospect_30',
    title: 'Bâtisseur de Secteur',
    description: 'Atteignez 30 entreprises qualifiées dans votre portefeuille.',
    rarity: 'peu_commun',
    xpBoost: 150,
    xpType: 'Prospection',
    iconKey: 'layers',
    target: 30,
    getValue: (m) => m.totalProspects,
  },
  {
    id: 'qualified_5',
    title: 'Pipeline en Feu',
    description: 'Maintenez 5 comptes qualifiés (RDV, Devis ou Signés).',
    rarity: 'peu_commun',
    xpBoost: 150,
    xpType: 'Pipeline',
    iconKey: 'trending',
    target: 5,
    getValue: (m) => m.qualifiedCount,
  },
  {
    id: 'contracts_3',
    title: 'Triplé Orange Pro',
    description: 'Signez 3 contrats Orange Pro.',
    rarity: 'peu_commun',
    xpBoost: 250,
    xpType: 'Ventes',
    iconKey: 'medal',
    target: 3,
    getValue: (m) => m.contractsCount,
  },
  {
    id: 'first_pme',
    title: 'Spécialiste PME',
    description: 'Signez votre premier dossier PME (Fibre Pro + Flotte).',
    rarity: 'peu_commun',
    xpBoost: 200,
    xpType: 'Offres Pro',
    iconKey: 'briefcase',
    target: 1,
    getValue: (m) => m.pmeContracts,
  },
  {
    id: 'multi_contact_10',
    title: 'Maître de l’Enrichissement',
    description: 'Enrichissez 10 fiches avec plusieurs numéros ou adresses email.',
    rarity: 'peu_commun',
    xpBoost: 160,
    xpType: 'Qualité CRM',
    iconKey: 'phone',
    target: 10,
    getValue: (m) => m.multiContactFiches,
  },
  {
    id: 'maturity_10',
    title: 'Fiches Haute Précision',
    description: 'Atteignez 10 fiches avec une maturité CRM supérieure ou égale à 85%.',
    rarity: 'peu_commun',
    xpBoost: 180,
    xpType: 'Qualité CRM',
    iconKey: 'shield',
    target: 10,
    getValue: (m) => m.highMaturityFiches,
  },
  {
    id: 'cities_4',
    title: 'Couverture Régionale',
    description: 'Prospectez activement sur au moins 4 villes différentes.',
    rarity: 'peu_commun',
    xpBoost: 120,
    xpType: 'Territoire',
    iconKey: 'map',
    target: 4,
    getValue: (m) => m.distinctCities,
  },
  {
    id: 'payout_3000',
    title: 'Cap des 3 000 MAD',
    description: 'Cumulez 3 000 MAD de payout sur vos contrats signés.',
    rarity: 'peu_commun',
    xpBoost: 200,
    xpType: 'Payout',
    iconKey: 'wallet',
    target: 3000,
    unit: 'MAD',
    getValue: (m) => m.totalPayoutMad,
  },

  // RARE (9)
  {
    id: 'contracts_5',
    title: 'Quintuplé Commercial',
    description: 'Signez 5 contrats B2B validés dans le portefeuille.',
    rarity: 'rare',
    xpBoost: 350,
    xpType: 'Ventes',
    iconKey: 'medal',
    target: 5,
    getValue: (m) => m.contractsCount,
  },
  {
    id: 'contracts_10',
    title: 'Closer Confirmé',
    description: 'Signez 10 contrats Orange Pro.',
    rarity: 'rare',
    xpBoost: 500,
    xpType: 'Ventes',
    iconKey: 'star',
    target: 10,
    getValue: (m) => m.contractsCount,
  },
  {
    id: 'pme_5',
    title: 'Pilier PME',
    description: 'Signez 5 contrats sur le segment PME (Fibre Pro & Flotte).',
    rarity: 'rare',
    xpBoost: 420,
    xpType: 'Offres Pro',
    iconKey: 'briefcase',
    target: 5,
    getValue: (m) => m.pmeContracts,
  },
  {
    id: 'first_gc',
    title: 'Chasseur Grand Compte',
    description: 'Signez votre premier contrat Grand Compte (Fibre Dédiée / Corporate).',
    rarity: 'rare',
    xpBoost: 500,
    xpType: 'Grand Compte',
    iconKey: 'crown',
    target: 1,
    getValue: (m) => m.grandCompteContracts,
  },
  {
    id: 'maturity_20',
    title: 'Chirurgien de la Donnée',
    description: 'Disposez de 20 fiches avec une maturité CRM supérieure ou égale à 85%.',
    rarity: 'rare',
    xpBoost: 300,
    xpType: 'Qualité CRM',
    iconKey: 'shield',
    target: 20,
    getValue: (m) => m.highMaturityFiches,
  },
  {
    id: 'cities_6',
    title: 'Conquérant Multi-Villes',
    description: 'Déployez votre prospection active sur au moins 6 villes.',
    rarity: 'rare',
    xpBoost: 320,
    xpType: 'Territoire',
    iconKey: 'map',
    target: 6,
    getValue: (m) => m.distinctCities,
  },
  {
    id: 'prospect_100',
    title: 'Centurion B2B',
    description: 'Dépassez les 100 entreprises suivies dans votre portefeuille.',
    rarity: 'rare',
    xpBoost: 400,
    xpType: 'Prospection',
    iconKey: 'building',
    target: 100,
    getValue: (m) => m.totalProspects,
  },
  {
    id: 'payout_5000',
    title: 'Cap des 5 000 MAD',
    description: 'Cumulez 5 000 MAD de commissions sur vos contrats signés.',
    rarity: 'rare',
    xpBoost: 350,
    xpType: 'Payout',
    iconKey: 'wallet',
    target: 5000,
    unit: 'MAD',
    getValue: (m) => m.totalPayoutMad,
  },
  {
    id: 'payout_10000',
    title: 'Club des 10 000 MAD',
    description: 'Cumulez 10 000 MAD de payout commissions.',
    rarity: 'rare',
    xpBoost: 500,
    xpType: 'Payout',
    iconKey: 'wallet',
    target: 10000,
    unit: 'MAD',
    getValue: (m) => m.totalPayoutMad,
  },

  // ÉPIQUE (6)
  {
    id: 'contracts_25',
    title: 'Machine à Signer',
    description: 'Signez 25 contrats Orange Pro.',
    rarity: 'epique',
    xpBoost: 1000,
    xpType: 'Ventes',
    iconKey: 'flame',
    target: 25,
    getValue: (m) => m.contractsCount,
  },
  {
    id: 'gc_5',
    title: 'Architecte Corporate',
    description: 'Signez 5 contrats Grand Compte Fibre Dédiée & Flotte.',
    rarity: 'epique',
    xpBoost: 1200,
    xpType: 'Grand Compte',
    iconKey: 'crown',
    target: 5,
    getValue: (m) => m.grandCompteContracts,
  },
  {
    id: 'qualified_40',
    title: 'Maître du Tunnel',
    description: 'Qualifiez 40 opportunités commerciales (RDV/Devis/Signés).',
    rarity: 'epique',
    xpBoost: 800,
    xpType: 'Pipeline',
    iconKey: 'trending',
    target: 40,
    getValue: (m) => m.qualifiedCount,
  },
  {
    id: 'prospect_200',
    title: 'Baron du Portefeuille',
    description: 'Constituez un portefeuille de 200 entreprises B2B suivies.',
    rarity: 'epique',
    xpBoost: 900,
    xpType: 'Prospection',
    iconKey: 'layers',
    target: 200,
    getValue: (m) => m.totalProspects,
  },
  {
    id: 'payout_30000',
    title: 'Top Performer 30k MAD',
    description: 'Atteignez 30 000 MAD de payout cumulé.',
    rarity: 'epique',
    xpBoost: 1000,
    xpType: 'Payout',
    iconKey: 'wallet',
    target: 30000,
    unit: 'MAD',
    getValue: (m) => m.totalPayoutMad,
  },
  {
    id: 'payout_50000',
    title: 'Élite 50k MAD',
    description: 'Franchissez le cap des 50 000 MAD de commissions cumulées.',
    rarity: 'epique',
    xpBoost: 1400,
    xpType: 'Payout',
    iconKey: 'wallet',
    target: 50000,
    unit: 'MAD',
    getValue: (m) => m.totalPayoutMad,
  },

  // LÉGENDAIRE (5)
  {
    id: 'contracts_50',
    title: 'Légende Orange Pro',
    description: 'Signez 50 contrats B2B Orange Pro et rejoignez le cercle d’élite.',
    rarity: 'legendaire',
    xpBoost: 2500,
    xpType: 'Ventes',
    iconKey: 'trophy',
    target: 50,
    getValue: (m) => m.contractsCount,
  },
  {
    id: 'contracts_100',
    title: 'Centurion des Signatures',
    description: 'Signez 100 contrats B2B et inscrivez un record historique chez DIVERSIFIA.',
    rarity: 'legendaire',
    xpBoost: 4500,
    xpType: 'Ventes',
    iconKey: 'trophy',
    target: 100,
    getValue: (m) => m.contractsCount,
  },
  {
    id: 'gc_15',
    title: 'Titan Grand Compte',
    description: 'Signez 15 contrats Grand Compte sur votre territoire.',
    rarity: 'legendaire',
    xpBoost: 3000,
    xpType: 'Grand Compte',
    iconKey: 'crown',
    target: 15,
    getValue: (m) => m.grandCompteContracts,
  },
  {
    id: 'payout_100000',
    title: 'Bâtisseur d’Empire (100k MAD)',
    description: 'Cumulez 100 000 MAD de payout commissions Orange Pro.',
    rarity: 'legendaire',
    xpBoost: 4000,
    xpType: 'Payout',
    iconKey: 'trophy',
    target: 100000,
    unit: 'MAD',
    getValue: (m) => m.totalPayoutMad,
  },
  {
    id: 'payout_250000',
    title: 'Empereur DIVERSIFIA (250k MAD)',
    description: 'Cumulez 250 000 MAD de payouts commissions sur l’ensemble de vos signatures.',
    rarity: 'legendaire',
    xpBoost: 6000,
    xpType: 'Payout',
    iconKey: 'crown',
    target: 250000,
    unit: 'MAD',
    getValue: (m) => m.totalPayoutMad,
  },
];

export interface EvaluatedAchievement {
  id: string;
  title: string;
  description: string;
  rarity: BadgeRarity;
  xpBoost: number;
  xpType: string;
  iconKey: string;
  unlocked: boolean;
  isManualAdminBadge: boolean;
  current: number;
  target: number;
  progressPct: number;
  unit?: string;
}

export interface AchievementSummary {
  items: EvaluatedAchievement[];
  unlockedCount: number;
  totalCount: number;
  completionPct: number;
  totalXp: number;
  rankNumber: number;
  rankTitle: string;
  byRarity: Record<BadgeRarity, { unlocked: number; total: number; pct: number }>;
  nextToUnlock: EvaluatedAchievement[];
}

export function computeRankFromXp(xp: number): { rankNumber: number; rankTitle: string } {
  const rankNumber = Math.max(1, Math.floor(xp / 350) + 1);
  if (xp >= 12000) return { rankNumber, rankTitle: 'Légende Commerciale' };
  if (xp >= 6000) return { rankNumber, rankTitle: 'Directeur Élite B2B' };
  if (xp >= 3000) return { rankNumber, rankTitle: 'Closer Senior' };
  if (xp >= 1200) return { rankNumber, rankTitle: 'Conseiller Confirmé' };
  if (xp >= 400) return { rankNumber, rankTitle: 'Chasseur Actif' };
  return { rankNumber, rankTitle: 'Recrue Orange Pro' };
}

export function evaluateAchievements(
  metrics: CollaboratorMetrics,
  manualBadgeIds: string[] = []
): AchievementSummary {
  const manualSet = new Set(manualBadgeIds);

  const autoItems: EvaluatedAchievement[] = AUTO_ACHIEVEMENTS.map((def) => {
    const rawVal = Math.max(0, Math.round(def.getValue(metrics)));
    const unlocked = rawVal >= def.target;
    const progressPct = Math.min(100, Math.round((rawVal / Math.max(1, def.target)) * 100));
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      rarity: def.rarity,
      xpBoost: def.xpBoost,
      xpType: def.xpType,
      iconKey: def.iconKey,
      unlocked,
      isManualAdminBadge: false,
      current: Math.min(rawVal, def.target),
      target: def.target,
      progressPct,
      unit: def.unit,
    };
  });

  const manualItems: EvaluatedAchievement[] = ADMIN_DISTINCTION_BADGES.map((def) => {
    const unlocked = manualSet.has(def.id);
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      rarity: def.rarity,
      xpBoost: def.xpBoost,
      xpType: def.category === 'role' ? 'Badge de Rôle' : 'Distinction Admin',
      iconKey: def.iconKey,
      unlocked,
      isManualAdminBadge: true,
      current: unlocked ? 1 : 0,
      target: 1,
      progressPct: unlocked ? 100 : 0,
    };
  });

  const items = [...autoItems, ...manualItems];

  const byRarity: Record<BadgeRarity, { unlocked: number; total: number; pct: number }> = {
    commun: { unlocked: 0, total: 0, pct: 0 },
    peu_commun: { unlocked: 0, total: 0, pct: 0 },
    rare: { unlocked: 0, total: 0, pct: 0 },
    epique: { unlocked: 0, total: 0, pct: 0 },
    legendaire: { unlocked: 0, total: 0, pct: 0 },
  };

  let unlockedCount = 0;
  let totalXp = 0;

  // Base activity XP (prospects + contracts) plus unlocked badge XP boosts
  totalXp += metrics.totalProspects * 5 + metrics.qualifiedCount * 20 + metrics.contractsCount * 120;

  for (const item of items) {
    byRarity[item.rarity].total++;
    if (item.unlocked) {
      byRarity[item.rarity].unlocked++;
      unlockedCount++;
      totalXp += item.xpBoost;
    }
  }

  for (const r of RARITY_ORDER) {
    const bucket = byRarity[r];
    bucket.pct = bucket.total > 0 ? Math.round((bucket.unlocked / bucket.total) * 100) : 0;
  }

  const totalCount = items.length;
  const completionPct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;
  const { rankNumber, rankTitle } = computeRankFromXp(totalXp);

  // Top 3 closest locked achievements (matching "À suivre - Proche du déverrouillage")
  const nextToUnlock = items
    .filter((i) => !i.unlocked && !i.isManualAdminBadge)
    .sort((a, b) => b.progressPct - a.progressPct || a.target - b.target)
    .slice(0, 3);

  return {
    items,
    unlockedCount,
    totalCount,
    completionPct,
    totalXp,
    rankNumber,
    rankTitle,
    byRarity,
    nextToUnlock,
  };
}

export function buildMonthlyHistoryStrings(contracts: SignedContractRecord[]): string[] {
  const byMonth = new Map<string, { count: number; payout: number }>();
  for (const c of contracts) {
    if (c.payoutStatus === 'Refusé') continue;
    const ym = (c.signedAt || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(ym)) continue;
    const prev = byMonth.get(ym) || { count: 0, payout: 0 };
    prev.count += 1;
    prev.payout += Math.max(0, Number(c.payoutMad) || 0);
    byMonth.set(ym, prev);
  }
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-18)
    .map(([ym, v]) => `${ym}:${v.count}:${Math.round(v.payout)}`);
}

export interface MonthlyEvolutionPoint {
  ym: string;
  label: string;
  contracts: number;
  payoutMad: number;
}

const SHORT_MONTHS_FR = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Jun',
  'Jul',
  'Aoû',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
];

export function buildTeamMonthlyEvolution(
  members: TeamStatRecord[],
  contracts: SignedContractRecord[],
  selectedUid: string | 'all',
  now = new Date()
): MonthlyEvolutionPoint[] {
  // Build last 6 calendar months
  const months: MonthlyEvolutionPoint[] = [];
  const monthMap = new Map<string, MonthlyEvolutionPoint>();

  for (let offset = 5; offset >= 0; offset--) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${SHORT_MONTHS_FR[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
    const point: MonthlyEvolutionPoint = { ym, label, contracts: 0, payoutMad: 0 };
    months.push(point);
    monthMap.set(ym, point);
  }

  const scopedContracts =
    selectedUid === 'all' ? contracts : contracts.filter((c) => c.ownerId === selectedUid);
  const ownersWithContractDocs = new Set(scopedContracts.map((c) => c.ownerId));

  for (const c of scopedContracts) {
    if (c.payoutStatus === 'Refusé') continue;
    const ym = (c.signedAt || '').slice(0, 7);
    const pt = monthMap.get(ym);
    if (pt) {
      pt.contracts += 1;
      pt.payoutMad += Math.max(0, Number(c.payoutMad) || 0);
    }
  }

  // Fallback to aggregated monthlyHistory ONLY for members whose individual contract docs aren't loaded
  const relevantMembers =
    selectedUid === 'all' ? members : members.filter((m) => m.uid === selectedUid);
  for (const m of relevantMembers) {
    if (ownersWithContractDocs.has(m.uid)) continue;
    for (const entry of m.monthlyHistory || []) {
      const [ym, cStr, pStr] = entry.split(':');
      const pt = monthMap.get(ym);
      if (pt) {
        pt.contracts += parseInt(cStr, 10) || 0;
        pt.payoutMad += parseInt(pStr, 10) || 0;
      }
    }
  }

  return months;
}

export interface LeaderboardRow {
  rank: number;
  uid: string;
  displayName: string;
  role: TeamRole;
  zone: string;
  active: boolean;
  contractsCount: number;
  payoutMad: number;
  qualifiedCount: number;
  prospectsCount: number;
  xp: number;
  badgesCount: number;
  manualBadges: string[];
  conversionPct: number;
  avatarDataUrl?: string;
}

export function buildTeamLeaderboard(
  members: TeamStatRecord[],
  contracts: SignedContractRecord[]
): LeaderboardRow[] {
  // Track ALL owners that have loaded contract docs (including Refusé) so refusals immediately reduce totals
  const ownersWithContractDocs = new Set<string>();
  const contractsByOwner = new Map<string, { count: number; payout: number }>();
  for (const c of contracts) {
    if (c.ownerId) ownersWithContractDocs.add(c.ownerId);
    if (c.payoutStatus === 'Refusé') continue;
    const prev = contractsByOwner.get(c.ownerId) || { count: 0, payout: 0 };
    prev.count += 1;
    prev.payout += Math.max(0, Number(c.payoutMad) || 0);
    contractsByOwner.set(c.ownerId, prev);
  }

  const rows: Omit<LeaderboardRow, 'rank'>[] = members.map((m) => {
    const hasLiveLedger = ownersWithContractDocs.has(m.uid);
    const ledger = contractsByOwner.get(m.uid);
    const contractsCount = hasLiveLedger ? (ledger?.count ?? 0) : m.totalContracts;
    const payoutMad = hasLiveLedger ? (ledger?.payout ?? 0) : m.totalPayoutMad;
    const denom = Math.max(1, m.totalProspects + contractsCount);
    const conversionPct = Math.min(100, Math.round((contractsCount / denom) * 100));

    return {
      uid: m.uid,
      displayName: m.displayName || 'Collaborateur',
      role: m.role,
      zone: m.zone || 'Meknès',
      active: m.active,
      contractsCount,
      payoutMad,
      qualifiedCount: m.totalQualified,
      prospectsCount: m.totalProspects,
      xp: m.xp,
      badgesCount: m.unlockedCount,
      manualBadges: m.manualBadges || [],
      conversionPct,
      avatarDataUrl: m.avatarDataUrl || undefined,
    };
  });

  // Classement prioritaire sur le Payout (MAD), puis contrats signés, puis XP
  rows.sort(
    (a, b) =>
      b.payoutMad - a.payoutMad ||
      b.contractsCount - a.contractsCount ||
      b.xp - a.xp ||
      a.displayName.localeCompare(b.displayName)
  );

  return rows.map((row, idx) => ({ ...row, rank: idx + 1 }));
}

export interface CurrentMonthPayoutSummary {
  ym: string;
  monthLabel: string;
  currentMonthPayoutMad: number;
  currentMonthContractsCount: number;
  totalSignedPayoutMad: number;
  totalSignedContractsCount: number;
  effectiveDisplayPayoutMad: number;
  verseMad: number;
  valideMad: number;
  enAttenteMad: number;
  refusedContractsCount: number;
  refusedPayoutMad: number;
  avgPayoutPerContractMad: number;
  previousMonthPayoutMad: number;
  growthPct: number | null;
}

const FULL_MONTHS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

export function computeCurrentMonthPayoutSummary(
  contracts: SignedContractRecord[],
  members: TeamStatRecord[],
  selectedUid: string | 'all' = 'all',
  now = new Date()
): CurrentMonthPayoutSummary {
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYm = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = `${FULL_MONTHS_FR[now.getMonth()]} ${now.getFullYear()}`;

  const scopedContracts =
    selectedUid === 'all' ? contracts : contracts.filter((c) => c.ownerId === selectedUid);
  const activeContracts = scopedContracts.filter((c) => c.payoutStatus !== 'Refusé');
  const refusedContracts = scopedContracts.filter((c) => c.payoutStatus === 'Refusé');
  const scopedMembers =
    selectedUid === 'all' ? members : members.filter((m) => m.uid === selectedUid);

  let currentMonthPayoutMad = 0;
  let currentMonthContractsCount = 0;
  let previousMonthPayoutMad = 0;

  let verseMad = 0;
  let valideMad = 0;
  let enAttenteMad = 0;

  let contractsTotalPayoutMad = 0;
  for (const c of activeContracts) {
    const amount = Math.max(0, Number(c.payoutMad) || 0);
    contractsTotalPayoutMad += amount;
    if (c.payoutStatus === 'Versé') verseMad += amount;
    else if (c.payoutStatus === 'Validé') valideMad += amount;
    else enAttenteMad += amount;

    const cYm = (c.signedAt || '').slice(0, 7);
    if (cYm === ym) {
      currentMonthPayoutMad += amount;
      currentMonthContractsCount += 1;
    } else if (cYm === prevYm) {
      previousMonthPayoutMad += amount;
    }
  }

  const refusedContractsCount = refusedContracts.length;
  const refusedPayoutMad = refusedContracts.reduce(
    (sum, c) => sum + Math.max(0, Number(c.payoutMad) || 0),
    0
  );

  // Fallback / complement from TeamStatRecord ONLY for members whose individual contract docs aren't loaded locally
  const ownersWithContractDocs = new Set(scopedContracts.map((c) => c.ownerId));
  let fallbackMembersTotalPayoutMad = 0;
  let fallbackMembersTotalContracts = 0;

  for (const m of scopedMembers) {
    if (ownersWithContractDocs.has(m.uid)) continue;
    fallbackMembersTotalPayoutMad += Math.max(0, Number(m.totalPayoutMad) || 0);
    fallbackMembersTotalContracts += Math.max(0, Number(m.totalContracts) || 0);
    for (const entry of m.monthlyHistory || []) {
      const [eYm, cStr, pStr] = entry.split(':');
      if (eYm === ym) {
        currentMonthContractsCount += parseInt(cStr, 10) || 0;
        currentMonthPayoutMad += parseInt(pStr, 10) || 0;
      } else if (eYm === prevYm) {
        previousMonthPayoutMad += parseInt(pStr, 10) || 0;
      }
    }
  }

  const totalSignedPayoutMad = contractsTotalPayoutMad + fallbackMembersTotalPayoutMad;
  const totalSignedContractsCount = activeContracts.length + fallbackMembersTotalContracts;

  // If no contracts carry a dated entry for the current month yet, fall back to totalSignedPayoutMad so the cumulative indicator always reflects TotalPayoutMad of signed contracts
  const effectiveDisplayPayoutMad =
    currentMonthPayoutMad > 0 ? currentMonthPayoutMad : totalSignedPayoutMad;

  const activeCountForAvg =
    currentMonthContractsCount > 0 ? currentMonthContractsCount : totalSignedContractsCount;
  const avgPayoutPerContractMad =
    activeCountForAvg > 0 ? Math.round(effectiveDisplayPayoutMad / activeCountForAvg) : 0;

  const growthPct =
    previousMonthPayoutMad > 0
      ? Math.round(((currentMonthPayoutMad - previousMonthPayoutMad) / previousMonthPayoutMad) * 100)
      : null;

  return {
    ym,
    monthLabel,
    currentMonthPayoutMad,
    currentMonthContractsCount,
    totalSignedPayoutMad,
    totalSignedContractsCount,
    effectiveDisplayPayoutMad,
    verseMad,
    valideMad,
    enAttenteMad,
    refusedContractsCount,
    refusedPayoutMad,
    avgPayoutPerContractMad,
    previousMonthPayoutMad,
    growthPct,
  };
}

export function formatMad(amount: number): string {
  return `${Math.round(amount || 0).toLocaleString('fr-FR')} MAD`;
}

export function parseDateAjoutTimestamp(dateAjout?: string): number {
  if (!dateAjout || typeof dateAjout !== 'string') return 0;
  const ts = Date.parse(dateAjout.trim());
  return Number.isFinite(ts) ? ts : 0;
}

export function formatDateAjoutShort(dateAjout?: string): string {
  const ts = parseDateAjoutTimestamp(dateAjout);
  if (ts <= 0) return '—';
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function sortByDateAjout<T extends { dateAjout?: string; societe?: string }>(
  items: readonly T[],
  direction: 'asc' | 'desc' = 'desc'
): T[] {
  const copy = [...items];
  copy.sort((a, b) => {
    const diff = parseDateAjoutTimestamp(a.dateAjout) - parseDateAjoutTimestamp(b.dateAjout);
    const cmp = diff !== 0 ? diff : (a.societe || '').localeCompare(b.societe || '');
    return direction === 'asc' ? cmp : -cmp;
  });
  return copy;
}
