// Pure CRM DIVERSIFIA Orange Pro B2B domain types, constants, and helpers.
// Extracted from App.tsx to eliminate circular dependencies and enable clean React.lazy code-splitting.

export type SecteurCode =
  | 'fiduciaire'
  | 'clinique'
  | 'notaire'
  | 'immobilier'
  | 'riad_hotellerie'
  | 'auto_ecole'
  | 'pme'
  | 'industrie'
  | 'btp'
  | 'gros'
  | 'enseignement'
  | 'liberal'
  | 'commerce';

export type SegmentCouleur = 'bleu' | 'vert' | 'orange' | 'jaune' | 'violet' | 'cyan';

export type StatutCRM =
  | 'À contacter'
  | 'Appel en cours'
  | 'RDV pris'
  | 'Devis envoyé'
  | 'Signé Orange Pro'
  | 'Pas intéressé';

export interface FicheEntreprise {
  id: string;
  numeroFiche?: string;
  societe: string;
  secteur: SecteurCode;
  ville: string;
  telephone: string;
  telephonesSupplementaires?: string[];
  email: string;
  emailsSupplementaires?: string[];
  contact: string;
  role: string;
  source: string;
  effectif: string;
  statut: StatutCRM;
  siteWeb?: string;
  verifieWeb?: boolean;
  pistesEnrichissement?: string[];
  dateAjout: string;
  statutUpdatedAt?: string;
  prochaineRelanceAt?: string;
  rdvAt?: string;
  rdvLieu?: string;
  assignedByUid?: string;
  assignedByName?: string;
  assignedAt?: string;
  restoredByName?: string;
  restoredAt?: string;
  restoredReason?: string;
}

export interface CrawlLog {
  id: string;
  time: string;
  level: 'info' | 'ok' | 'warn' | 'err';
  message: string;
}

export const SECTEURS_META: Record<
  SecteurCode,
  { label: string; couleur: SegmentCouleur; keywords: string[] }
> = {
  fiduciaire: {
    label: 'Fiduciaire / Comptable',
    couleur: 'bleu',
    keywords: [
      'fiduciaire', 'comptable', 'comptabilite', 'expert comptable', 'expertise comptable',
      'commissaire aux comptes', 'audit', 'conseil fiscal', 'fiscalite', 'conseil juridique et fiscal',
    ],
  },
  clinique: {
    label: 'Clinique privée',
    couleur: 'bleu',
    keywords: [
      'clinique', 'polyclinique', 'centre hospitalier', 'centre de radiologie', 'radiologie',
      'centre d imagerie', 'imagerie medicale', 'centre de dialyse', 'dialyse', 'maternite',
    ],
  },
  notaire: {
    label: 'Notaire',
    couleur: 'bleu',
    keywords: ['notaire', 'etude notariale', 'office notarial', 'notariat', 'adoul'],
  },
  immobilier: {
    label: 'Immobilier / Promoteur',
    couleur: 'vert',
    keywords: [
      'immobilier', 'immobiliere', 'promoteur', 'promotion immobiliere', 'agence immobiliere',
      'lotissement', 'syndic', 'gestion immobiliere', 'foncier', 'residence',
    ],
  },
  riad_hotellerie: {
    label: 'Riad / Hôtel',
    couleur: 'orange',
    keywords: [
      'riad', 'hotel', 'hotellerie', 'maison d hotes', 'chambres d hotes', 'auberge',
      'resort', 'palais d hotes', 'complexe touristique', 'camping', 'gite', 'dar',
    ],
  },
  auto_ecole: {
    label: 'Auto-école',
    couleur: 'jaune',
    keywords: ['auto ecole', 'autoecole', 'ecole de conduite', 'permis de conduire', 'conduite'],
  },
  pme: {
    label: 'PME Services',
    couleur: 'violet',
    keywords: [
      'pme', 'consulting', 'digital', 'informatique', 'developpement web', 'agence web',
      'agence de communication', 'publicite', 'imprimerie', 'logistique', 'transport',
      'transitaire', 'securite', 'gardiennage', 'nettoyage', 'centre d appel', 'call center',
      'assurance', 'courtier', 'agence de voyage', 'location de voitures', 'location voiture',
    ],
  },
  industrie: {
    label: 'Industrie / Agro',
    couleur: 'violet',
    keywords: [
      'industrie', 'industriel', 'industrielle', 'agroalimentaire', 'agro industrie', 'huilerie',
      'conserverie', 'minoterie', 'usine', 'manufacture', 'plasturgie', 'textile', 'confection',
      'cooperative agricole', 'moulin', 'abattoir', 'emballage', 'metallurgie', 'chaudronnerie',
    ],
  },
  btp: {
    label: 'BTP / Construction',
    couleur: 'violet',
    keywords: [
      'btp', 'travaux publics', 'travaux divers', 'construction', 'genie civil', 'beton',
      'carriere', 'batiment', 'terrassement', 'menuiserie', 'aluminium', 'plomberie',
      'electricite batiment', 'climatisation', 'etancheite', 'charpente', 'ferronnerie',
      'marbre', 'carrelage', 'ascenseur', 'peinture batiment', 'amenagement',
    ],
  },
  gros: {
    label: 'Commerce de gros',
    couleur: 'violet',
    keywords: [
      'grossiste', 'commerce de gros', 'distribution', 'distributeur', 'negoce',
      'import export', 'materiaux de construction', 'sanitaire', 'quincaillerie gros',
      'pieces auto', 'pieces de rechange', 'fournitures industrielles', 'centrale d achat',
    ],
  },
  enseignement: {
    label: 'Enseignement / École',
    couleur: 'violet',
    keywords: [
      'ecole privee', 'ecole', 'institut', 'groupe scolaire', 'universite', 'creche',
      'maternelle', 'garderie', 'centre de formation', 'formation professionnelle',
      'centre de langues', 'soutien scolaire', 'lycee', 'college', 'academie',
    ],
  },
  liberal: {
    label: 'Profession libérale',
    couleur: 'cyan',
    keywords: [
      'avocat', 'avocate', 'barreau', 'huissier', 'architecte', 'architecture', 'bureau d etudes',
      'bet', 'ingenierie', 'medecin', 'cabinet medical', 'maison medicale', 'ophtalmologie',
      'ophtalmologue', 'dentiste', 'cabinet dentaire', 'chirurgien', 'pediatre', 'gynecologue',
      'cardiologue', 'dermatologue', 'veterinaire', 'laboratoire d analyses', 'laboratoire',
      'analyses medicales', 'geometre', 'topographe', 'kinesitherapeute', 'kine',
      'orthodontiste', 'osteopathe', 'psychologue', 'docteur', 'dr',
    ],
  },
  commerce: {
    label: 'Pharmacie & Commerce',
    couleur: 'cyan',
    keywords: [
      'pharmacie', 'parapharmacie', 'commerce', 'boutique', 'magasin', 'supermarche',
      'restaurant', 'snack', 'cafe', 'boulangerie', 'patisserie', 'traiteur', 'optique',
      'opticien', 'librairie', 'papeterie', 'bijouterie', 'quincaillerie', 'garage', 'station service',
    ],
  },
};

export const SEGMENTS_COULEUR: Record<
  SegmentCouleur,
  {
    label: string;
    description: string;
    secteurs: SecteurCode[];
    badgeCls: string;
    dotCls: string;
    ringCls: string;
    topBarCls: string;
  }
> = {
  bleu: {
    label: 'Bleu',
    description: 'Fiduciaires, Cliniques, Notaires',
    secteurs: ['fiduciaire', 'clinique', 'notaire'],
    badgeCls: 'bg-blue-50 text-blue-800 border-blue-200',
    dotCls: 'bg-blue-600',
    ringCls: 'ring-blue-600 border-blue-600',
    topBarCls: 'border-t-2 border-t-blue-600',
  },
  vert: {
    label: 'Vert',
    description: 'Immobilier & Promoteurs',
    secteurs: ['immobilier'],
    badgeCls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dotCls: 'bg-emerald-600',
    ringCls: 'ring-emerald-600 border-emerald-600',
    topBarCls: 'border-t-2 border-t-emerald-600',
  },
  orange: {
    label: 'Orange',
    description: 'Riads, Hôtels & Maisons d’hôtes',
    secteurs: ['riad_hotellerie'],
    badgeCls: 'bg-orange-50 text-orange-800 border-orange-200',
    dotCls: 'bg-orange-500',
    ringCls: 'ring-orange-500 border-orange-500',
    topBarCls: 'border-t-2 border-t-orange-500',
  },
  jaune: {
    label: 'Jaune',
    description: 'Auto-écoles',
    secteurs: ['auto_ecole'],
    badgeCls: 'bg-amber-50 text-amber-800 border-amber-200',
    dotCls: 'bg-amber-500',
    ringCls: 'ring-amber-500 border-amber-500',
    topBarCls: 'border-t-2 border-t-amber-500',
  },
  violet: {
    label: 'Violet',
    description: 'PME, Industrie, BTP, Gros, Écoles',
    secteurs: ['pme', 'industrie', 'btp', 'gros', 'enseignement'],
    badgeCls: 'bg-violet-50 text-violet-800 border-violet-200',
    dotCls: 'bg-violet-600',
    ringCls: 'ring-violet-600 border-violet-600',
    topBarCls: 'border-t-2 border-t-violet-600',
  },
  cyan: {
    label: 'Cyan',
    description: 'Libéral, Labos, Pharmacies, Commerces',
    secteurs: ['liberal', 'commerce'],
    badgeCls: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    dotCls: 'bg-cyan-600',
    ringCls: 'ring-cyan-600 border-cyan-600',
    topBarCls: 'border-t-2 border-t-cyan-600',
  },
};

export const STATUTS_CRM: StatutCRM[] = [
  'À contacter',
  'Appel en cours',
  'RDV pris',
  'Devis envoyé',
  'Signé Orange Pro',
  'Pas intéressé',
];

export const DEFAULT_VILLES_MEKNES = [
  'Meknès',
  'El Hajeb',
  'Ifrane',
  'Azrou',
  'Moulay Idriss Zerhoun',
  'Boufekrane',
  'Agouraï',
  'Sebaa Ayoune',
];

export function stripAccents(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizeMoroccanPhone(raw: string): string {
  let digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('002120') && digits.length >= 15) digits = '0' + digits.slice(6);
  else if (digits.startsWith('00212')) digits = '0' + digits.slice(5);
  else if (digits.startsWith('2120') && digits.length >= 13) digits = '0' + digits.slice(4);
  else if (digits.startsWith('212') && digits.length >= 12) digits = '0' + digits.slice(3);
  if (digits.length === 9 && /^[567]/.test(digits)) digits = '0' + digits;
  if (/^0[567]\d{8}$/.test(digits)) return digits;
  return '';
}

export function parseSafeHeadcount(raw: string | number | undefined | null): number {
  if (raw === undefined || raw === null) return 0;
  const cleaned = String(raw).trim();
  if (!cleaned || !/^\d+$/.test(cleaned)) return 0;
  const n = Number.parseInt(cleaned, 10);
  if (!Number.isFinite(n) || n <= 0 || n > 50000) return 0;
  return n;
}

export function getOrangeProRecommendation(f: FicheEntreprise): {
  tier: 'Grand Compte' | 'PME' | 'TPE / Libéral';
  offre: string;
  badgeCls: string;
} {
  const eff = parseSafeHeadcount(f.effectif);
  if (eff >= 30 || f.secteur === 'clinique' || f.secteur === 'industrie') {
    return {
      tier: 'Grand Compte',
      offre: 'Fibre Dédiée + Flotte Mobile Corporate + Standard Cloud',
      badgeCls: 'bg-stone-900 text-amber-50',
    };
  }
  if (eff >= 10 && eff <= 29) {
    return {
      tier: 'PME',
      offre: 'Fibre Pro + Pack Flotte 5-20 lignes + Fixe VoIP',
      badgeCls: 'bg-orange-100 text-orange-900',
    };
  }
  return {
    tier: 'TPE / Libéral',
    offre: 'Fibre Pro Essentiel + Forfait Mobile Pro + Nom de domaine',
    badgeCls: 'bg-stone-100 text-stone-800',
  };
}

export function computeMaturityScore(f: FicheEntreprise): number {
  let pts = 0;
  if (f.societe.trim()) pts += 15;
  if (f.secteur) pts += 10;
  if (f.ville.trim()) pts += 10;
  if (f.telephone.trim()) pts += 25;
  if (f.contact.trim()) pts += 15;
  if (f.email.trim()) pts += 10;
  if (f.role.trim()) pts += 5;
  if (f.effectif.trim()) pts += 5;
  if (f.source.trim()) pts += 5;
  return Math.min(100, pts);
}

export function isReadyToCall(f: FicheEntreprise): boolean {
  return Boolean(f.telephone.trim() && f.contact.trim());
}

export function toWa212(tel: string): string {
  const norm = normalizeMoroccanPhone(tel);
  if (!norm) return '';
  return '212' + norm.slice(1);
}

export function makeId(prefix = 'op'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36)}`;
}
