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

export type PayoutStatus = 'En attente' | 'Validé' | 'Versé';
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
}

export interface TeamStatRecord {
  uid: string;
  orgScope: 'orange_pro_team';
  displayName: string;
  role: 'super_admin' | 'manager' | 'commercial';
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

export type TeamRole = 'super_admin' | 'manager' | 'commercial';

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
    shortLabel: 'SUPER-ADMIN',
    description: 'Direction & accès total (utilisateurs, payouts, clés API, badges)',
    className:
      'bg-gradient-to-r from-orange-600 to-amber-500 text-white border border-orange-500 shadow-2xs',
  },
  manager: {
    label: 'Superviseur / Manager',
    shortLabel: 'MANAGER',
    description: 'Pilotage commercial & suivi d’équipe Orange Pro',
    className: 'bg-violet-100 text-violet-900 border border-violet-300',
  },
  commercial: {
    label: 'Commercial B2B',
    shortLabel: 'COMMERCIAL',
    description: 'Prospection terrain, qualification & signature Orange Pro',
    className: 'bg-sky-100 text-sky-900 border border-sky-300',
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
  // COMMUN (6)
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

  // PEU COMMUN (6)
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

  // RARE (5)
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

  // ÉPIQUE (4)
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

  // LÉGENDAIRE (3)
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
    const ym = (c.signedAt || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(ym)) continue;
    const prev = byMonth.get(ym) || { count: 0, payout: 0 };
    prev.count += 1;
    prev.payout += Number(c.payoutMad) || 0;
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

  const relevantContracts =
    selectedUid === 'all' ? contracts : contracts.filter((c) => c.ownerId === selectedUid);

  if (relevantContracts.length > 0) {
    for (const c of relevantContracts) {
      const ym = (c.signedAt || '').slice(0, 7);
      const pt = monthMap.get(ym);
      if (pt) {
        pt.contracts += 1;
        pt.payoutMad += Number(c.payoutMad) || 0;
      }
    }
    return months;
  }

  // Fallback to aggregated monthlyHistory stored on team_stats (allows collaborators to see global team trend)
  const relevantMembers =
    selectedUid === 'all' ? members : members.filter((m) => m.uid === selectedUid);
  for (const m of relevantMembers) {
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
  role: 'super_admin' | 'manager' | 'commercial';
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
  // Overlay live contract sums when available (Admin has full contracts ledger)
  const contractsByOwner = new Map<string, { count: number; payout: number }>();
  for (const c of contracts) {
    const prev = contractsByOwner.get(c.ownerId) || { count: 0, payout: 0 };
    prev.count += 1;
    prev.payout += Number(c.payoutMad) || 0;
    contractsByOwner.set(c.ownerId, prev);
  }

  const rows: Omit<LeaderboardRow, 'rank'>[] = members.map((m) => {
    const ledger = contractsByOwner.get(m.uid);
    const contractsCount = Math.max(m.totalContracts, ledger?.count ?? 0);
    const payoutMad = Math.max(m.totalPayoutMad, ledger?.payout ?? 0);
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

  rows.sort(
    (a, b) =>
      b.contractsCount - a.contractsCount ||
      b.payoutMad - a.payoutMad ||
      b.xp - a.xp ||
      a.displayName.localeCompare(b.displayName)
  );

  return rows.map((row, idx) => ({ ...row, rank: idx + 1 }));
}

export function formatMad(amount: number): string {
  return `${Math.round(amount || 0).toLocaleString('fr-FR')} MAD`;
}
