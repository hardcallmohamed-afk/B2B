import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Globe,
  Play,
  Square,
  Download,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Phone,
  MessageSquare,
  Mail,
  Plus,
  Trash2,
  GitMerge,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Building2,
  FileText,
  ArrowUpDown,
  Copy,
  Check,
  X,
  Zap,
  KeyRound,
  Layers,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Power,
  Cpu,
  Bot,
  KanbanSquare,
  Table2,
  Cloud,
  LogOut,
  ClipboardPaste,
  Users,
  Trophy,
  Award,
} from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot, query, where } from 'firebase/firestore';
import { KpiTrendChart } from './components/KpiTrendChart';
import { KanbanBoard } from './components/KanbanBoard';
import { AiCopilotDrawer } from './components/AiCopilotDrawer';
import { LoginScreen, AccessGateNotice } from './components/LoginScreen';
import { AdminUsersPanel } from './components/AdminUsersPanel';
import { TeamPerformancePanel } from './components/TeamPerformancePanel';
import { AchievementsPanel } from './components/AchievementsPanel';
import { SignContractModal, type SignContractTarget } from './components/SignContractModal';
import { moveFicheToStatut } from './utils/analytics';
import { findSmartDuplicateGroups } from './utils/deduplication';
import {
  evaluateUserAccess,
  isSuperAdminEmail,
  type ManagedAppUser,
} from './utils/authAccess';
import {
  buildMonthlyHistoryStrings,
  evaluateAchievements,
  type CollaboratorMetrics,
  type OrangeProTier,
  type PayoutStatus,
  type SignedContractRecord,
  type TeamStatRecord,
} from './utils/gamification';
import {
  extractAllFromAssistedPaste,
  extractAllMoroccanPhones,
  extractAllEmails,
  mergeMultiPhones,
  mergeMultiEmails,
  generateNextNumeroFiche,
  ensureUniqueNumeroFiches,
} from './utils/pasteExtractor';
import {
  auth,
  db,
  signOutUser,
  ensureUserWorkspace,
  syncWorkspaceToFirestore,
  syncFichesDiffToFirestore,
  syncSkillsDiffToFirestore,
  getUserFichesCollection,
  getUserSkillsCollection,
  fetchAppUserProfile,
  getAppUsersQuery,
  getTeamStatsQuery,
  getSignedContractsQuery,
  syncMyTeamStat,
  adminUpdateUserManualBadges,
  createSignedContract,
  adminUpdateSignedContract,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  sanitizeFichePayload,
  sanitizeSkillPayload,
  sanitizeWorkspacePayload,
  serializeDocCanonical,
  computeCollectionSyncDiff,
  type SanitizedFicheDoc,
  type SanitizedEmailSkillDoc,
} from './utils/firestoreSanitize';

// ============================================================================
// 1. TYPES, SCHÉMA STRICT (9 COLONNES) & CODE COULEUR ORANGE PRO (6 SEGMENTS)
// ============================================================================

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

const ALL_MOROCCAN_CITIES = [
  ...DEFAULT_VILLES_MEKNES,
  'Fès', 'Rabat', 'Salé', 'Témara', 'Casablanca', 'Mohammedia', 'Kénitra', 'Tanger',
  'Tétouan', 'Marrakech', 'Agadir', 'Oujda', 'Sefrou', 'Khémisset', 'Sidi Kacem',
  'Sidi Slimane', 'Béni Mellal', 'Khénifra', 'Errachidia', 'El Jadida', 'Safi',
  'Essaouira', 'Nador', 'Settat', 'Berrechid',
];

// ============================================================================
// 2. NETTOYAGE, NORMALISATION, FILTRAGE ANTI-BRUIT & SCORING ORANGE PRO
// ============================================================================

export function stripAccents(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizeCompanyForDedup(name: string): string {
  return stripAccents(name)
    .replace(/\b(sarl|s\.a\.r\.l|sarl au|sa|s\.a|sas|snc|ste|societe|ets|etablissement|cabinet|groupe|group|maroc|ma)\b/g, ' ')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const UI_NOISE_PATTERNS = [
  /^https?:\/\//i,
  /^www\./i,
  /^\[!\[.*\]\(.*\)\]/,
  /^(voir le num|appeler|itinéraire|itineraire|en savoir plus|contact|contacter|accueil|suivant|précédent|precedent|fermer|ouvrir|partager|envoyer|site web|plus d'infos|plus d’infos|demander un devis|avis|horaires|ouvert|fermé|ferme|trouver un pro|localisation|afficher le num|tel|téléphone|email|mail|menu|rechercher|connexion|se connecter|s'inscrire|inscrire|cookies?|accepter|refuser|mentions légales|politique de confidentialité|qui sommes|à propos|plan du site|retour|filtrer|trier|tous les résultats|page \d+|©|copyright)/i,
  /^(rue|bd|boulevard|av\.?|avenue|lot\.?|lotissement|imm\.?|immeuble|résidence|residence|quartier|n°|bp|b\.p|zone industrielle|zi|hay|derb|place|angle|route de|km \d)/i,
  /^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i,
  /^\d{1,2}[h:]\d{2}/i,
  /\b(\d+\s*(mad|dh|dhs|€|\$|avis|étoiles|etoiles|résultats|resultats))\b/i,
  /^\d+[.,]\d+\s*\/\s*5\b/,
  /^(vous cherchez|trouvez les|découvrez|decouvrez|comparez|liste des|annuaire des|cliquez ici|merci de)/i,
];

const GENERIC_CATEGORY_LABELS = new Set([
  'entreprises', 'entreprise', 'professionnels', 'annuaire', 'categories', 'catégories',
  'fiduciaires', 'cliniques', 'notaires', 'immobilier', 'agences immobilieres',
  'hotels', 'hôtels', 'riads', 'auto-ecoles', 'auto ecoles', 'avocats', 'architectes',
  'pharmacies', 'commerces', 'restaurants', 'btp', 'industrie', 'pme', 'services',
  'maroc', 'region', 'région', 'accueil', 'contact', 'a propos', 'blog', 'actualites',
]);

export function cleanExtractedCompanyName(raw: string): string {
  let s = (raw || '').trim();
  const mdLink = s.match(/^\s*(?:[-*•#>]+\s*)?\[([^\]]+)\]\([^)]+\)/);
  if (mdLink) s = mdLink[1];
  s = s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\*\*|__|#+|`/g, '')
    .replace(/^\s*(?:\d+[.)]|[-*•▸►→])\s+/, '')
    .replace(/\s*[-–—|•]\s*(Pages Jaunes|Telecontact|Kerix|Google Maps|Maroc|Annuaire|Meknès|Meknes|Rabat|Casablanca|Fès|Fes|Ifrane|Azrou|El Hajeb).*$/i, '')
    .replace(/\s*\((?:Voir le numéro|Appeler|Ouvert|Fermé|\d+\s*avis)\)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

export const cleanCompanyName = cleanExtractedCompanyName;

export function isValidCompanyName(raw: string): boolean {
  const s = cleanExtractedCompanyName(raw);
  if (s.length < 3 || s.length > 85) return false;
  if (!/[a-zA-ZÀ-ÿ]{2,}/.test(s)) return false;
  if (/^\d[\d\s\-+.()/]+$/.test(s)) return false;
  if (s.includes('@') || /https?:\/\//i.test(s)) return false;
  if ((s.match(/\./g) || []).length >= 2 && s.length > 42) return false;
  const words = s.split(/\s+/);
  if (words.length > 10) return false;
  if (/[.!?]$/.test(s) && words.length >= 6) return false;
  if (/\b(est un|est une|vous propose|spécialisée dans|specialisee dans|situé à|situe a|nous sommes)\b/i.test(s)) return false;
  for (const rx of UI_NOISE_PATTERNS) {
    if (rx.test(s)) return false;
  }
  const norm = stripAccents(s);
  if (GENERIC_CATEGORY_LABELS.has(norm)) return false;
  if (ALL_MOROCCAN_CITIES.some((c) => stripAccents(c) === norm)) return false;
  return true;
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

export function htmlToReadableText(raw: string): string {
  if (!raw) return '';
  let s = raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ');

  s = s
    .replace(/<a\b[^>]*href\s*=\s*["']mailto:([^"'?]+)[^"']*["'][^>]*>/gi, ' $1 ')
    .replace(/<a\b[^>]*href\s*=\s*["']tel:([^"']+)["'][^>]*>/gi, ' $1 ');

  s = s
    .replace(/<\/?(?:p|div|li|tr|td|th|br|h[1-6]|section|article|dd|dt)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  s = s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#64;|&#x40;/gi, '@')
    .replace(/&eacute;/gi, 'é')
    .replace(/&egrave;/gi, 'è')
    .replace(/&ecirc;/gi, 'ê')
    .replace(/&agrave;/gi, 'à')
    .replace(/&ccedil;/gi, 'ç')
    .replace(/&rsquo;|&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s*\[\s*at\s*\]\s*|\s*\(\s*at\s*\)\s*/gi, '@')
    .replace(/\s*\[\s*dot\s*\]\s*|\s*\(\s*dot\s*\)\s*/gi, '.')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');

  return s.trim();
}

export function extractRelevantWindows(text: string, societe: string): string {
  if (!text || !societe) return text;
  const stopWords = new Set([
    'sarl', 'sa', 'sas', 'ste', 'ets', 'soc', 'societe', 'cabinet', 'etude', 'groupe',
    'maroc', 'morocco', 'centre', 'clinique', 'agence', 'bureau', 'maison', 'atelier',
    'pour', 'avec', 'dans', 'les', 'des', 'aux', 'sur', 'par', 'the', 'and', 'pro',
  ]);
  const tokens = stripAccents(societe)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !stopWords.has(t));

  if (tokens.length === 0) return text.slice(0, 6000);

  const normText = stripAccents(text);
  const ranges: [number, number][] = [];

  for (const tok of tokens.slice(0, 3)) {
    let pos = 0;
    let hits = 0;
    while (hits < 5) {
      const idx = normText.indexOf(tok, pos);
      if (idx === -1) break;
      ranges.push([Math.max(0, idx - 350), Math.min(text.length, idx + 850)]);
      pos = idx + tok.length;
      hits++;
    }
  }

  if (ranges.length === 0) return '';
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const prev = merged[merged.length - 1];
    if (ranges[i][0] <= prev[1]) prev[1] = Math.max(prev[1], ranges[i][1]);
    else merged.push(ranges[i]);
  }
  return merged.map(([a, b]) => text.slice(a, b)).join('\n---\n');
}

export function extractPhonesFromReadableText(text: string): string[] {
  const rx = /(?:(?:\(\s*)?(?:\+|00)\s*212(?:\s*\))?[\s.-]*(?:\(?0\)?[\s.-]*)?|\b0)[567](?:[\s.-]?\d){8}\b/g;
  const matches = text.match(rx) || [];
  const out: string[] = [];
  for (const m of matches) {
    const norm = normalizeMoroccanPhone(m);
    if (norm && !out.includes(norm)) out.push(norm);
  }
  return out;
}

export function extractBestEmailFromText(text: string, societe: string): string {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const valid = Array.from(new Set(matches.map(normalizeProEmail).filter(Boolean)));
  if (valid.length === 0) return '';
  const tokens = stripAccents(societe)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
  const matched = valid.find((e) => tokens.some((t) => stripAccents(e).includes(t)));
  return matched || valid[0];
}

const EXCLUDED_EMAIL_DOMAINS = [
  'telecontact.ma',
  'kerix.net',
  'pagesjaunes',
  'annuaire',
  'example.com',
  'sentry.io',
  'wixpress.com',
  'google.com',
  'facebook.com',
];

const EXCLUDED_EMAIL_PREFIXES = [
  'noreply', 'no-reply', 'donotreply', 'mailer-daemon', 'abuse',
  'postmaster', 'webmaster', 'privacy', 'support@telecontact',
];

export function normalizeProEmail(raw: string): string {
  const s = (raw || '').trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) return '';
  if (EXCLUDED_EMAIL_PREFIXES.some((p) => s.startsWith(p))) return '';
  if (EXCLUDED_EMAIL_DOMAINS.some((d) => s.includes(d))) return '';
  return s;
}

function hasWholeWordOrPhrase(normHaystack: string, rawKeyword: string): boolean {
  const kw = stripAccents(rawKeyword).replace(/[^a-z0-9]+/g, ' ').trim();
  if (!kw) return false;
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`).test(normHaystack);
}

export function inferSecteur(text: string, fallback: SecteurCode = 'pme', email = ''): SecteurCode {
  const emailDomain = (email || '').includes('@') ? email.split('@')[1].replace(/\.[a-z]{2,}$/i, '') : '';
  const normMain = stripAccents(text).replace(/['’\-_.\/]+/g, ' ');
  const normEmail = stripAccents(emailDomain).replace(/['’\-_.]+/g, ' ');

  const scores: Partial<Record<SecteurCode, number>> = {};
  const codes = Object.keys(SECTEURS_META) as SecteurCode[];

  for (const code of codes) {
    let score = 0;
    for (const kw of SECTEURS_META[code].keywords) {
      const isPhrase = kw.trim().includes(' ');
      const weight = isPhrase ? 6 : kw.length >= 6 ? 3 : 2;
      if (hasWholeWordOrPhrase(normMain, kw)) score += weight;
      if (normEmail && hasWholeWordOrPhrase(normEmail, kw)) score += Math.max(2, weight - 1);
    }
    if (score > 0) scores[code] = score;
  }

  // Règles de priorité métier marocaines
  if (scores.auto_ecole && scores.enseignement) scores.auto_ecole += 8;
  if (scores.fiduciaire && scores.pme) scores.fiduciaire += 4;
  if (scores.clinique && scores.liberal) scores.clinique += 4;

  const combined = `${normMain} ${normEmail}`;
  if (Object.keys(scores).length === 0) {
    if (/\b(fidu|compta|expert)\b/.test(combined)) return 'fiduciaire';
    if (/\b(immo|foncier)\b/.test(combined)) return 'immobilier';
    if (/\b(pharma|parapharma|optiq|boulanger|patisser|resto)\b/.test(combined)) return 'commerce';
    if (/\b(archi|labo|dentaire|ophtalmo|topo)\b/.test(combined)) return 'liberal';
    if (/\b(riad|hotel|auberge)\b/.test(combined)) return 'riad_hotellerie';
    return fallback;
  }

  let bestCode: SecteurCode = fallback;
  let bestScore = 0;
  const tieBreakOrder: SecteurCode[] = [
    'notaire', 'auto_ecole', 'clinique', 'fiduciaire', 'riad_hotellerie',
    'immobilier', 'liberal', 'btp', 'industrie', 'gros', 'enseignement', 'commerce', 'pme',
  ];
  for (const code of tieBreakOrder) {
    const sc = scores[code] || 0;
    if (sc > bestScore) {
      bestScore = sc;
      bestCode = code;
    }
  }
  return bestCode;
}

export function cleanHtmlAndMarkdownBeforeParsing(raw: string): { cleaned: string; isHtml: boolean } {
  const trimmed = (raw || '').replace(/^\uFEFF/, '').trim();
  const isHtml = /<(html|body|div|article|li|section|table|h1|h2|h3|a|p)\b/i.test(trimmed);
  if (isHtml) {
    const cleaned = trimmed
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<!--([\s\S]*?)-->/g, ' ');
    return { cleaned, isHtml: true };
  }
  const lines = trimmed.split(/\r?\n/);
  const kept: string[] = [];
  for (const line of lines) {
    const l = line.trim();
    if (!l) {
      kept.push('');
      continue;
    }
    if (/^(Title:|URL Source:|Markdown Content:|Published Time:)/i.test(l)) continue;
    if (/^[-*_]{3,}$/.test(l)) continue;
    if (/^!\[.*\]\(.*\)$/.test(l)) continue;
    if (/^(accept(er)?\s+(tous\s+les\s+)?cookies|en poursuivant votre navigation|nous utilisons des cookies|politique de confidentialité|tous droits réservés|copyright ©)/i.test(l)) continue;
    kept.push(line);
  }
  return { cleaned: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(), isHtml: false };
}

export function postExtractionCleanup(
  items: FicheEntreprise[],
  villesCibles: string[],
  modeVille: 'filter' | 'default',
  defaultVille: string,
  ignoredPhones: string[] = []
): FicheEntreprise[] {
  const normActive = villesCibles.map(stripAccents);
  const out: FicheEntreprise[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const cleanName = cleanExtractedCompanyName(item.societe);
    if (!isValidCompanyName(cleanName)) continue;

    let phone = item.telephone ? normalizeMoroccanPhone(item.telephone) : '';
    if (phone && ignoredPhones.includes(phone)) phone = '';
    const email = item.email ? normalizeProEmail(item.email) : '';
    let ville = (item.ville || '').trim();
    if (!ville && modeVille === 'default' && defaultVille) ville = defaultVille;
    if (modeVille === 'filter' && normActive.length > 0) {
      if (!ville || !normActive.includes(stripAccents(ville))) continue;
    }

    const secteur = inferSecteur(`${cleanName} ${item.role} ${item.secteur}`, item.secteur || 'pme', email);
    const dedupKey = normalizeCompanyForDedup(cleanName);
    if (!dedupKey || seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    out.push({
      ...item,
      societe: cleanName,
      secteur,
      ville,
      telephone: phone,
      email,
      effectif: item.effectif && /^\d+$/.test(String(item.effectif).trim()) ? String(item.effectif).trim() : '',
    });
  }
  return out;
}

export function parseSecteurCode(raw: string, fallbackText = ''): SecteurCode {
  const n = stripAccents(raw);
  if (n && (Object.keys(SECTEURS_META) as SecteurCode[]).includes(n as SecteurCode)) {
    return n as SecteurCode;
  }
  return inferSecteur(`${raw} ${fallbackText}`, 'pme');
}

export function detectVilleInText(text: string, knownVilles: string[]): string {
  const n = stripAccents(text);
  const all = Array.from(new Set([...knownVilles, ...ALL_MOROCCAN_CITIES]));
  all.sort((a, b) => b.length - a.length);
  for (const v of all) {
    const nv = stripAccents(v);
    if (nv.length < 3) continue;
    const rx = new RegExp(`(^|[^a-z])${nv.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i');
    if (rx.test(n)) return v;
  }
  return '';
}

const NON_PERSON_WORDS = new Set([
  'maroc', 'morocco', 'meknes', 'rabat', 'sale', 'casablanca', 'fes', 'tanger', 'marrakech', 'agadir', 'ifrane', 'azrou',
  'contact', 'accueil', 'services', 'service', 'telephone', 'email', 'adresse', 'societe', 'entreprise', 'sarl', 'ste',
  'voir', 'plus', 'infos', 'pages', 'jaunes', 'google', 'linkedin', 'facebook', 'instagram', 'orange', 'pro', 'site',
  'web', 'officiel', 'cabinet', 'clinique', 'agence', 'groupe', 'general', 'generale', 'commercial', 'commerciale',
  'technique', 'administratif', 'financier', 'notre', 'votre', 'avec', 'pour', 'dans', 'chez', 'tous', 'toutes',
]);

export function isPlausiblePersonName(name: string): boolean {
  const clean = (name || '').trim().replace(/[.,;:()|]+$/g, '');
  if (clean.length < 4 || clean.length > 48 || /\d/.test(clean)) return false;
  const parts = clean.split(/\s+/);
  if (parts.length < 2 || parts.length > 4) return false;
  const badCount = parts.filter((p) => NON_PERSON_WORDS.has(stripAccents(p))).length;
  if (badCount >= parts.length) return false;
  if (NON_PERSON_WORDS.has(stripAccents(parts[0]))) return false;
  return true;
}

export function extractDecideurFromText(text: string, emailHint = ''): { contact: string; role: string } {
  const cleanText = text || '';
  const rolePatterns: { rx: RegExp; role: string }[] = [
    { rx: /\b(Dr\.?|Docteur)\s+([A-ZÀ-Ý][A-Za-zÀ-ÿ'-]+(?:\s+[A-ZÀ-Ý]?[A-Za-zÀ-ÿ'-]+){1,2})/g, role: 'Médecin' },
    { rx: /\b(Me\.?|Maître|Maitre)\s+([A-ZÀ-Ý][A-Za-zÀ-ÿ'-]+(?:\s+[A-ZÀ-Ý]?[A-Za-zÀ-ÿ'-]+){1,2})/g, role: 'Maître' },
    { rx: /\b(Arch\.?|Architecte)\s*[:\-]?\s*([A-ZÀ-Ý][A-Za-zÀ-ÿ'-]+(?:\s+[A-ZÀ-Ý]?[A-Za-zÀ-ÿ'-]+){1,2})/g, role: 'Architecte' },
    {
      rx: /\b(Gérant|Gérante|Gerant|Directeur Général|Directrice Générale|Directeur|Directrice|Dirigeant|Dirigeante|Président|Présidente|PDG|DG|Associé|Associée|Expert-Comptable|Fondateur|Fondatrice|Co-fondateur|Co-fondatrice|Administrateur|Responsable|Manager|Propriétaire|Notaire|Avocat|Avocate|Pharmacien|Pharmacienne)\s*[:\-–|]?\s*(?:M\.|Mme|Mr|Monsieur|Madame)?\s*([A-ZÀ-Ý][A-Za-zÀ-ÿ'-]+(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ'-]+){1,2})/gi,
      role: '',
    },
    { rx: /\bby\s+([A-Za-zÀ-ÿ'-]+\s+[A-Za-zÀ-ÿ'-]+)/gi, role: 'Fondateur / Responsable' },
  ];

  for (const p of rolePatterns) {
    let m: RegExpExecArray | null;
    while ((m = p.rx.exec(cleanText)) !== null) {
      const prefix = (m[1] || '').trim();
      const rawName = (m[2] || m[1] || '').trim().replace(/[.,;:()|]+$/g, '');
      if (isPlausiblePersonName(rawName)) {
        if (/^by\s+/i.test(m[0])) return { contact: rawName, role: p.role };
        const full = /^(Dr|Me|Maître|Maitre)/i.test(prefix) ? `${prefix} ${rawName}` : rawName;
        return { contact: full, role: p.role || prefix };
      }
    }
  }

  const invertedRx = /\b([A-ZÀ-Ý][a-zà-ÿ'-]{2,}\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ'-]{2,}(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ'-]{2,})?)\s*(?:[-–—,|•]|\()\s*(Gérant|Gérante|Directeur Général|Directrice Générale|Directeur|Directrice|Dirigeant|Président|PDG|DG|Fondateur|Fondatrice|Associé|Expert-Comptable|Architecte|Notaire|Avocat|Avocate|Pharmacien|Médecin|Manager|Responsable)/g;
  let inv: RegExpExecArray | null;
  while ((inv = invertedRx.exec(cleanText)) !== null) {
    const rawName = (inv[1] || '').trim();
    const role = (inv[2] || '').trim();
    if (isPlausiblePersonName(rawName)) return { contact: rawName, role };
  }

  if (emailHint && emailHint.includes('@')) {
    const localPart = emailHint.split('@')[0].toLowerCase();
    const genericLocal = /^(contact|info|infos|admin|direction|commercial|accueil|secretariat|rh|support|service|devis|ventes|hello|bonjour|bureau|cabinet|comptabilite|compta|facturation|marketing|communication|recrutement|web|mail|agence|clinique|pharmacie|hotel|riad|reservation|booking)$/;
    const sepMatch = localPart.match(/^([a-z]{3,})[._-]([a-z]{3,})$/);
    if (sepMatch && !genericLocal.test(sepMatch[1]) && !genericLocal.test(sepMatch[2])) {
      const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
      const candidate = `${cap(sepMatch[1])} ${cap(sepMatch[2])}`;
      if (isPlausiblePersonName(candidate)) return { contact: candidate, role: 'Contact identifié' };
    }
  }

  return { contact: '', role: '' };
}

export function extractEffectifFromText(text: string): string {
  const m = text.match(/\b(\d{1,4})\s*(?:salariés|salaries|employés|employes|collaborateurs|personnes)\b/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n > 0 && n <= 5000) return String(n);
  }
  return '';
}

export function getOrangeProRecommendation(f: FicheEntreprise): {
  tier: 'Grand Compte' | 'PME' | 'TPE / Libéral';
  offre: string;
  badgeCls: string;
} {
  const eff = parseInt(f.effectif, 10) || 0;
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

// ============================================================================
// 3. PARSEUR CHIRURGICAL HTML / MARKDOWN / TEXTE + ANTI-CALL-CENTER
// ============================================================================

export function parseRawInputToFiches(
  rawInput: string,
  sourceUrl: string,
  villesCibles: string[],
  modeVille: 'filter' | 'default',
  defaultVille: string
): { fiches: FicheEntreprise[]; ignoredCallCenterPhones: string[]; detailLinks: string[]; nextPages: string[] } {
  const { cleaned: trimmed, isHtml } = cleanHtmlAndMarkdownBeforeParsing(rawInput);
  if (!trimmed) {
    return { fiches: [], ignoredCallCenterPhones: [], detailLinks: [], nextPages: [] };
  }

  const candidates: FicheEntreprise[] = [];
  const detailLinks: string[] = [];
  const nextPages: string[] = [];

  const registerLink = (href: string, label = '') => {
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    let abs = href;
    try {
      if (sourceUrl && /^https?:\/\//i.test(sourceUrl)) {
        abs = new URL(href, sourceUrl).toString();
      }
    } catch {
      // Keep raw
    }
    if (!/^https?:\/\//i.test(abs)) return;
    if (
      /([?&](page|p|pg)=\d+|\/page\/\d+|&page=\d+)/i.test(abs) ||
      /^(suivant|next|»|›|page\s*\d+|\d{1,3})$/i.test(label.trim())
    ) {
      if (!nextPages.includes(abs)) nextPages.push(abs);
    }
    if (/\/(entreprise|societe|fiche|pro|annuaire-entreprise|etablissement|cabinet|detail|company|place)\//i.test(abs)) {
      if (!detailLinks.includes(abs)) detailLinks.push(abs);
    }
  };

  if (isHtml && typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(trimmed, 'text/html');
    doc.querySelectorAll('a[href]').forEach((a) => {
      registerLink(a.getAttribute('href') || '', a.textContent || '');
    });

    doc
      .querySelectorAll(
        'header, nav, footer, aside, form, script, style, noscript, iframe, svg, .sidebar, .related, .similar, .cookie, #cookie, [class*="cookie"], [class*="consent"], [class*="banner"], [role="navigation"], [role="banner"], [role="contentinfo"]'
      )
      .forEach((el) => el.remove());

    const cardSelectors = [
      'article', '[itemtype*="Organization"]', '[itemtype*="LocalBusiness"]', '.card', '.listing',
      '.result', '.search-result', '.pro-card', '.company', '.entreprise', '.fiche', '.item',
      'li.result-item', 'section', 'tr',
    ].join(', ');

    let rawCards = Array.from(doc.querySelectorAll(cardSelectors)).filter((el) => {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t.length < 15 || t.length > 2200) return false;
      const nestedCards = el.querySelectorAll('article, .card, .listing, .result, .entreprise').length;
      return nestedCards === 0;
    });

    if (rawCards.length < 2) {
      const headings = Array.from(doc.querySelectorAll('h2, h3, h4'));
      const headingParents = Array.from(
        new Set(
          headings
            .map((h) => h.parentElement)
            .filter((p): p is HTMLElement => Boolean(p && (p.textContent || '').trim().length <= 2200))
        )
      );
      if (headingParents.length >= 2) rawCards = headingParents;
    }

    const blocks = rawCards.length >= 2 ? rawCards : [doc.body];

    blocks.forEach((el) => {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) return;

      const headingEl = el.querySelector('h1, h2, h3, h4, .title, .name, .company-name, [itemprop="name"], strong, a');
      const heading = headingEl?.textContent || '';
      const cleanedName = cleanExtractedCompanyName(heading || text.split(/[\n|•]/)[0]);
      if (!isValidCompanyName(cleanedName)) return;

      const phones = extractPhonesFromReadableText(text);
      const email = extractBestEmailFromText(text, cleanedName);
      const { contact, role } = extractDecideurFromText(text, email);
      const effectif = extractEffectifFromText(text);
      const detectedVille = detectVilleInText(text, villesCibles);

      let siteWeb = '';
      el.querySelectorAll('a[href^="http"]').forEach((a) => {
        const h = a.getAttribute('href') || '';
        registerLink(h, a.textContent || '');
        if (
          !h.includes('telecontact.ma') &&
          !h.includes('kerix.net') &&
          !h.includes('facebook.com') &&
          !h.includes('google.com') &&
          !h.includes('instagram.com')
        ) {
          if (!siteWeb) siteWeb = h;
        }
      });

      candidates.push({
        id: makeId(),
        societe: cleanedName,
        secteur: inferSecteur(`${cleanedName} ${text}`, 'pme', email),
        ville: detectedVille,
        telephone: phones[0] || '',
        email,
        contact,
        role,
        source: sourceUrl || 'HTML Collé',
        effectif,
        statut: 'À contacter',
        siteWeb,
        dateAjout: new Date().toISOString(),
      });
    });
  } else {
    const mdLinkRx = /\[([^\]]{1,120})\]\((https?:\/\/[^)\s]+)\)/g;
    let mLink: RegExpExecArray | null;
    while ((mLink = mdLinkRx.exec(trimmed)) !== null) {
      registerLink(mLink[2], mLink[1]);
    }
    const bareUrls = trimmed.match(/https?:\/\/[^\s)"'>]+/g) || [];
    bareUrls.forEach((u) => registerLink(u, ''));

    const chunks = trimmed
      .split(/\n{2,}|(?=^#{1,4}\s+)|(?=^\*\*[^*]{3,80}\*\*)/m)
      .filter((c) => c.trim().length >= 6);
    const blocks = chunks.length >= 2 ? chunks : trimmed.split(/\n/).filter((l) => l.trim().length >= 6);

    blocks.forEach((chunk) => {
      const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) return;

      let name = '';
      let blockDetailUrl = '';
      for (const l of lines.slice(0, 4)) {
        const mdHeadingLink = l.match(/^(?:#{1,4}\s+)?\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
        if (mdHeadingLink) {
          const cand = cleanExtractedCompanyName(mdHeadingLink[1]);
          if (isValidCompanyName(cand)) {
            name = cand;
            blockDetailUrl = mdHeadingLink[2];
            break;
          }
        }
        const cand = cleanExtractedCompanyName(l);
        if (isValidCompanyName(cand)) {
          name = cand;
          break;
        }
      }
      if (!name) return;

      const phones = extractPhonesFromReadableText(chunk);
      const email = extractBestEmailFromText(chunk, name);
      const { contact, role } = extractDecideurFromText(chunk, email);
      const effectif = extractEffectifFromText(chunk);
      const detectedVille = detectVilleInText(chunk, villesCibles);

      candidates.push({
        id: makeId(),
        societe: name,
        secteur: inferSecteur(`${name} ${chunk}`, 'pme', email),
        ville: detectedVille,
        telephone: phones[0] || '',
        email,
        contact,
        role,
        source: blockDetailUrl || sourceUrl || 'Texte Collé',
        effectif,
        statut: 'À contacter',
        dateAjout: new Date().toISOString(),
      });
    });
  }

  const phoneCounts: Record<string, number> = {};
  candidates.forEach((c) => {
    if (c.telephone) phoneCounts[c.telephone] = (phoneCounts[c.telephone] || 0) + 1;
  });
  const ignoredCallCenterPhones = Object.entries(phoneCounts)
    .filter(([, count]) => count >= 3)
    .map(([phone]) => phone);

  const finalFiches = postExtractionCleanup(
    candidates,
    villesCibles,
    modeVille,
    defaultVille,
    ignoredCallCenterPhones
  );

  return { fiches: finalFiches, ignoredCallCenterPhones, detailLinks, nextPages };
}

export function expandPaginationUrls(
  foundUrls: string[],
  paginationMode: 'unlimited' | 'range' = 'unlimited',
  pageStart = 1,
  pageEnd = 20
): string[] {
  const expanded = new Set<string>();
  const pageGroups: Record<string, { nums: number[]; build: (n: number) => string }> = {};

  const inRange = (n: number) =>
    paginationMode === 'unlimited' ? true : n >= Math.max(1, pageStart) && n <= Math.max(pageStart, pageEnd);

  for (const u of foundUrls) {
    const mQuery = u.match(/^(.*[?&](?:page|p|pg)=)(\d+)(.*)$/i);
    if (mQuery) {
      const num = parseInt(mQuery[2], 10);
      if (inRange(num)) expanded.add(u);
      const k = mQuery[1] + '|' + mQuery[3];
      if (!pageGroups[k]) pageGroups[k] = { nums: [], build: (n) => `${mQuery[1]}${n}${mQuery[3]}` };
      pageGroups[k].nums.push(num);
      continue;
    }
    const mPath = u.match(/^(.*\/page\/)(\d+)(.*)$/i);
    if (mPath) {
      const num = parseInt(mPath[2], 10);
      if (inRange(num)) expanded.add(u);
      const k = mPath[1] + '|' + mPath[3];
      if (!pageGroups[k]) pageGroups[k] = { nums: [], build: (n) => `${mPath[1]}${n}${mPath[3]}` };
      pageGroups[k].nums.push(num);
      continue;
    }
    if (paginationMode === 'unlimited') expanded.add(u);
  }

  Object.values(pageGroups).forEach((g) => {
    const start = paginationMode === 'range' ? Math.max(2, pageStart) : 2;
    const maxDetected = Math.max(...g.nums);
    const end = paginationMode === 'range' ? Math.max(start, pageEnd) : Math.min(maxDetected, 200);
    for (let i = start; i <= end; i++) {
      expanded.add(g.build(i));
    }
  });

  return Array.from(expanded);
}

// ============================================================================
// 4. ENTITY RESOLUTION (MDM DÉDUPLICATION MULTI-CRITÈRES & FUSION)
// ============================================================================

export interface DuplicateGroup {
  key: string;
  motif: string;
  confidence: number;
  ids: string[];
  fiches: FicheEntreprise[];
}

export function findDuplicateGroups(
  fiches: FicheEntreprise[],
  options: { includePhoneOnly?: boolean } = {}
): DuplicateGroup[] {
  return findSmartDuplicateGroups(fiches, options);
}

export function mergeFicheGroup(group: FicheEntreprise[]): FicheEntreprise {
  const sorted = [...group].sort((a, b) => computeMaturityScore(b) - computeMaturityScore(a));
  const base = { ...sorted[0] };
  const sources = new Set<string>();
  if (base.source) sources.add(base.source);

  let maxEff = parseInt(base.effectif, 10) || 0;
  const allIncomingPhones: string[] = [];
  const allIncomingEmails: string[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i];
    if (!base.numeroFiche && d.numeroFiche) base.numeroFiche = d.numeroFiche;
    if (d.telephone) allIncomingPhones.push(d.telephone);
    if (d.telephonesSupplementaires?.length) allIncomingPhones.push(...d.telephonesSupplementaires);
    if (d.email) allIncomingEmails.push(d.email);
    if (d.emailsSupplementaires?.length) allIncomingEmails.push(...d.emailsSupplementaires);
    if (!base.contact && d.contact) base.contact = d.contact;
    if (!base.role && d.role) base.role = d.role;
    if (!base.ville && d.ville) base.ville = d.ville;
    if (!base.siteWeb && d.siteWeb) base.siteWeb = d.siteWeb;
    const eff = parseInt(d.effectif, 10) || 0;
    if (eff > maxEff) maxEff = eff;
    if (d.source) sources.add(d.source);
  }

  const mergedPhones = mergeMultiPhones(base.telephone, base.telephonesSupplementaires, allIncomingPhones);
  base.telephone = mergedPhones.primary;
  if (mergedPhones.extras.length > 0) base.telephonesSupplementaires = mergedPhones.extras;
  else delete base.telephonesSupplementaires;

  const mergedEmails = mergeMultiEmails(base.email, base.emailsSupplementaires, allIncomingEmails);
  base.email = mergedEmails.primary;
  if (mergedEmails.extras.length > 0) base.emailsSupplementaires = mergedEmails.extras;
  else delete base.emailsSupplementaires;

  base.effectif = maxEff > 0 ? String(maxEff) : '';
  base.source = Array.from(sources).join(' + ');
  return base;
}

// ============================================================================
// 5. DONNÉES INITIALES MEKNÈS & RÉGION + EXPORT/IMPORT CSV & JSON
// ============================================================================

export const STORAGE_KEY_PORTFOLIO = 'orange-pro-mdm-v1';
export const STORAGE_KEY_VILLES = 'orange_pro_villes_v1';

export function createInitialPortfolio(): FicheEntreprise[] {
  const daysAgoIso = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
  return [
    {
      id: 'mk-1',
      numeroFiche: 'OP-0001',
      societe: 'Fiduciaire Ismailia Expertise',
      secteur: 'fiduciaire',
      ville: 'Meknès',
      telephone: '0535521840',
      telephonesSupplementaires: ['0661224580'],
      email: 'contact@fiduciaire-ismailia.ma',
      emailsSupplementaires: ['k.bennani@fiduciaire-ismailia.ma'],
      contact: 'Khalid Bennani',
      role: 'Expert-Comptable',
      source: 'Pages Jaunes',
      effectif: '14',
      statut: 'RDV pris',
      siteWeb: 'https://fiduciaire-ismailia.ma',
      dateAjout: daysAgoIso(24),
    },
    {
      id: 'mk-2',
      numeroFiche: 'OP-0002',
      societe: 'Clinique Privée Atlas Meknès',
      secteur: 'clinique',
      ville: 'Meknès',
      telephone: '0535519022',
      telephonesSupplementaires: ['0535519023'],
      email: 'direction@clinique-atlas-meknes.ma',
      contact: 'Dr Mohamed Tazi',
      role: 'Directeur Médical',
      source: 'Kerix',
      effectif: '48',
      statut: 'Devis envoyé',
      dateAjout: daysAgoIso(21),
    },
    {
      id: 'mk-3',
      numeroFiche: 'OP-0003',
      societe: 'Étude Notariale Me Salma Chraïbi',
      secteur: 'notaire',
      ville: 'Meknès',
      telephone: '0535403311',
      email: 'etude@chraibi-notaire.ma',
      contact: 'Me Salma Chraïbi',
      role: 'Notaire',
      source: 'Google Maps',
      effectif: '6',
      statut: 'À contacter',
      dateAjout: daysAgoIso(18),
    },
    {
      id: 'mk-4',
      numeroFiche: 'OP-0004',
      societe: 'Saïss Promotion Immobilière',
      secteur: 'immobilier',
      ville: 'Meknès',
      telephone: '0661482910',
      email: 'commercial@saiss-immo.ma',
      contact: 'Youssef El Alami',
      role: 'Directeur Commercial',
      source: 'LinkedIn',
      effectif: '19',
      statut: 'Appel en cours',
      dateAjout: daysAgoIso(15),
    },
    {
      id: 'mk-5',
      numeroFiche: 'OP-0005',
      societe: 'Riad Zitouna Palais',
      secteur: 'riad_hotellerie',
      ville: 'Meknès',
      telephone: '0535530488',
      email: 'direction@riadzitouna.ma',
      contact: 'Nadia Berrada',
      role: 'Gérante',
      source: 'Pages Jaunes',
      effectif: '12',
      statut: 'À contacter',
      dateAjout: daysAgoIso(12),
    },
    {
      id: 'mk-6',
      numeroFiche: 'OP-0006',
      societe: 'Auto-École Al Mansour',
      secteur: 'auto_ecole',
      ville: 'Meknès',
      telephone: '0663712045',
      email: '',
      contact: 'Hassan Amrani',
      role: 'Gérant',
      source: 'Porte à porte',
      effectif: '4',
      statut: 'À contacter',
      dateAjout: daysAgoIso(10),
    },
    {
      id: 'mk-7',
      numeroFiche: 'OP-0007',
      societe: 'Huileries du Moyen Atlas',
      secteur: 'industrie',
      ville: 'El Hajeb',
      telephone: '0535542190',
      email: 'achats@huileries-moyenatlas.ma',
      contact: 'Omar Lahlou',
      role: 'Directeur Général',
      source: 'Kerix',
      effectif: '65',
      statut: 'RDV pris',
      dateAjout: daysAgoIso(8),
    },
    {
      id: 'mk-8',
      numeroFiche: 'OP-0008',
      societe: 'Sogetra Travaux & BTP',
      secteur: 'btp',
      ville: 'Ifrane',
      telephone: '0661904412',
      email: 'direction@sogetra-ifrane.ma',
      contact: 'Karim Idrissi',
      role: 'Gérant',
      source: 'Pages Jaunes',
      effectif: '28',
      statut: 'Signé Orange Pro',
      dateAjout: daysAgoIso(6),
    },
    {
      id: 'mk-9',
      numeroFiche: 'OP-0009',
      societe: 'Laboratoire d’Analyses Cèdres',
      secteur: 'liberal',
      ville: 'Azrou',
      telephone: '0535561174',
      email: 'labo.cedres@labocedres.ma',
      contact: 'Dr Amina Fassi',
      role: 'Biologiste',
      source: 'Google Maps',
      effectif: '9',
      statut: 'À contacter',
      dateAjout: daysAgoIso(4),
    },
    {
      id: 'mk-10',
      numeroFiche: 'OP-0010',
      societe: 'Pharmacie Zerhoun',
      secteur: 'commerce',
      ville: 'Moulay Idriss Zerhoun',
      telephone: '0535544210',
      email: '',
      contact: '',
      role: '',
      source: 'Porte à porte',
      effectif: '',
      statut: 'À contacter',
      dateAjout: daysAgoIso(3),
    },
    {
      id: 'mk-11',
      numeroFiche: 'OP-0011',
      societe: 'STE Fiduciaire Ismailia Expertise SARL',
      secteur: 'fiduciaire',
      ville: 'Meknès',
      telephone: '0535521840',
      email: '',
      contact: '',
      role: '',
      source: 'LinkedIn',
      effectif: '16',
      statut: 'À contacter',
      dateAjout: daysAgoIso(1),
    },
    {
      id: 'mk-12',
      numeroFiche: 'OP-0012',
      societe: 'Distribution Agro Boufekrane',
      secteur: 'gros',
      ville: 'Boufekrane',
      telephone: '0662348891',
      email: 'contact@distri-boufekrane.ma',
      contact: 'Rachid Alaoui',
      role: 'Associé',
      source: 'Pages Jaunes',
      effectif: '18',
      statut: 'À contacter',
      dateAjout: daysAgoIso(0),
    },
  ];
}

export function buildStrictCsv(fiches: FicheEntreprise[]): string {
  const header = 'societe;secteur;ville;telephone;email;contact;role;source;effectif';
  const rows = fiches.map((f) =>
    [f.societe, f.secteur, f.ville, f.telephone, f.email, f.contact, f.role, f.source, f.effectif]
      .map((v) => String(v ?? '').replace(/;/g, ',').replace(/\r?\n/g, ' ').trim())
      .join(';')
  );
  return '\uFEFF' + [header, ...rows].join('\n');
}

export function parseCsvOrJsonImport(raw: string, villesCibles: string[]): FicheEntreprise[] {
  const cleaned = raw.replace(/^\uFEFF/, '').trim();
  if (!cleaned) return [];
  if (cleaned.startsWith('[') || cleaned.startsWith('{')) {
    try {
      const parsed = JSON.parse(cleaned);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      return arr
        .map((item): FicheEntreprise | null => {
          const soc = cleanCompanyName(String(item.societe || item.company || item.name || ''));
          if (!isValidCompanyName(soc)) return null;
          return {
            id: makeId(),
            societe: soc,
            secteur: parseSecteurCode(String(item.secteur || ''), soc),
            ville: String(item.ville || item.city || '').trim(),
            telephone: normalizeMoroccanPhone(String(item.telephone || item.phone || '')),
            email: normalizeProEmail(String(item.email || '')),
            contact: String(item.contact || '').trim(),
            role: String(item.role || '').trim(),
            source: String(item.source || 'Import JSON').trim(),
            effectif: item.effectif && !isNaN(Number(item.effectif)) ? String(parseInt(String(item.effectif), 10)) : '',
            statut: 'À contacter',
            dateAjout: new Date().toISOString(),
          };
        })
        .filter((x): x is FicheEntreprise => x !== null);
    } catch {
      return [];
    }
  }

  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const headers = lines[0].split(sep).map((h) => stripAccents(h.replace(/^"|"$/g, '')));
  const idx = (names: string[]) => headers.findIndex((h) => names.includes(h));

  const iSoc = idx(['societe', 'company', 'raison sociale', 'entreprise', 'nom']);
  if (iSoc === -1) return [];
  const iSec = idx(['secteur', 'sector', 'activite']);
  const iVil = idx(['ville', 'city']);
  const iTel = idx(['telephone', 'tel', 'phone']);
  const iMail = idx(['email', 'mail']);
  const iCont = idx(['contact', 'decideur']);
  const iRole = idx(['role', 'fonction', 'poste']);
  const iSrc = idx(['source', 'url', 'origine']);
  const iEff = idx(['effectif', 'salaries', 'taille']);

  const out: FicheEntreprise[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.replace(/^"|"$/g, '').trim());
    const soc = cleanCompanyName(cols[iSoc] || '');
    if (!isValidCompanyName(soc)) continue;
    const rawEff = iEff >= 0 ? cols[iEff] : '';
    const effNum = parseInt(rawEff.replace(/\D/g, ''), 10);
    out.push({
      id: makeId(),
      societe: soc,
      secteur: parseSecteurCode(iSec >= 0 ? cols[iSec] : '', soc),
      ville: (iVil >= 0 ? cols[iVil] : '') || detectVilleInText(lines[i], villesCibles),
      telephone: normalizeMoroccanPhone(iTel >= 0 ? cols[iTel] : ''),
      email: normalizeProEmail(iMail >= 0 ? cols[iMail] : ''),
      contact: iCont >= 0 ? cols[iCont] : '',
      role: iRole >= 0 ? cols[iRole] : '',
      source: (iSrc >= 0 ? cols[iSrc] : '') || 'Import CSV',
      effectif: effNum > 0 ? String(effNum) : '',
      statut: 'À contacter',
      dateAjout: new Date().toISOString(),
    });
  }
  return out;
}


// ============================================================================
// 6. MOTEUR FETCH MULTI-FALLBACK CORS (ALLORIGINS / CORSPROXY / R.JINA.AI / DIRECT)
// ============================================================================

export type ProxyStrategy = 'auto' | 'allorigins' | 'corsproxy' | 'jina' | 'direct';

async function fetchTimed(
  url: string,
  parentSignal: AbortSignal,
  timeoutMs = 6000,
  init?: RequestInit
): Promise<Response> {
  const local = new AbortController();
  const onAbort = () => local.abort();
  parentSignal.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => local.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: local.signal });
  } finally {
    clearTimeout(timer);
    parentSignal.removeEventListener('abort', onAbort);
  }
}

async function fetchWithFallback(
  url: string,
  strategy: ProxyStrategy,
  signal: AbortSignal,
  timeoutMs = 6500
): Promise<{ text: string; usedStrategy: string }> {
  const cleanUrl = url.trim();
  const builders: Record<Exclude<ProxyStrategy, 'auto'>, (u: string) => string> = {
    allorigins: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    corsproxy: (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    jina: (u) => `https://r.jina.ai/${u}`,
    direct: (u) => u,
  };

  const order: Exclude<ProxyStrategy, 'auto'>[] =
    strategy === 'auto' ? ['allorigins', 'corsproxy', 'jina', 'direct'] : [strategy];

  let lastErr = 'Échec réseau';
  for (const mode of order) {
    if (signal.aborted) throw new Error('Arrêté par l’utilisateur');
    try {
      const target = builders[mode](cleanUrl);
      const res = await fetchTimed(target, signal, timeoutMs);
      if (!res.ok) {
        lastErr = `${mode} HTTP ${res.status}`;
        continue;
      }
      const text = await res.text();
      if (text && text.trim().length > 60) {
        return { text, usedStrategy: mode };
      }
    } catch (err: unknown) {
      if (signal.aborted) throw new Error('Arrêté par l’utilisateur');
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(lastErr);
}

async function fetchFastest(
  url: string,
  strategy: ProxyStrategy,
  signal: AbortSignal,
  timeoutMs = 3500
): Promise<{ text: string; usedStrategy: string }> {
  const cleanUrl = url.trim();
  const builders: Record<Exclude<ProxyStrategy, 'auto'>, (u: string) => string> = {
    allorigins: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    corsproxy: (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    jina: (u) => `https://r.jina.ai/${u}`,
    direct: (u) => u,
  };

  if (strategy !== 'auto') {
    return fetchWithFallback(cleanUrl, strategy, signal, timeoutMs);
  }

  const tryOne = async (mode: Exclude<ProxyStrategy, 'auto'>) => {
    const res = await fetchTimed(builders[mode](cleanUrl), signal, timeoutMs);
    if (!res.ok) throw new Error(`${mode} HTTP ${res.status}`);
    const text = await res.text();
    if (!text || text.trim().length <= 60) throw new Error(`${mode} vide`);
    return { text, usedStrategy: mode };
  };

  try {
    return await Promise.any([tryOne('allorigins'), tryOne('corsproxy')]);
  } catch {
    if (signal.aborted) throw new Error('Arrêté par l’utilisateur');
    return await tryOne('jina');
  }
}

// ============================================================================
// 7. HUB API MULTI-FOURNISSEURS, ROUTAGE PAR TÂCHE & ROTATION AUTO SUR QUOTA
// ============================================================================

export type ApiProvider = 'tavily' | 'openrouter' | 'groq' | 'mistral' | 'gemini';
export type ApiTask = 'search' | 'extract' | 'email';
export type ApiTaskScope = 'all' | ApiTask;
export type ApiKeyHealth = 'idle' | 'ok' | 'quota' | 'error';

export interface ApiKeyEntry {
  id: string;
  provider: ApiProvider;
  label: string;
  apiKey: string;
  model: string;
  taskScope: ApiTaskScope;
  priority: number;
  enabled: boolean;
  status: ApiKeyHealth;
  statusMessage?: string;
}

export const STORAGE_KEY_API_HUB = 'orange_pro_api_hub_v1';

export const PROVIDER_META: Record<
  ApiProvider,
  {
    name: string;
    defaultModel: string;
    defaultScope: ApiTaskScope;
    placeholderKey: string;
    modelHint: string;
    endpoint: string;
    capabilities: ApiTask[];
  }
> = {
  tavily: {
    name: 'Tavily Search',
    defaultModel: 'basic',
    defaultScope: 'search',
    placeholderKey: 'tvly-...',
    modelHint: 'basic ou advanced',
    endpoint: 'https://api.tavily.com/search',
    capabilities: ['search'],
  },
  openrouter: {
    name: 'OpenRouter',
    defaultModel: 'openrouter/free',
    defaultScope: 'all',
    placeholderKey: 'sk-or-v1-...',
    modelHint: 'openrouter/free ou modèle personnalisé',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    capabilities: ['extract', 'email'],
  },
  groq: {
    name: 'Groq',
    defaultModel: 'llama-3.3-70b-versatile',
    defaultScope: 'extract',
    placeholderKey: 'gsk_...',
    modelHint: 'llama-3.3-70b-versatile',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    capabilities: ['extract', 'email'],
  },
  mistral: {
    name: 'Mistral AI',
    defaultModel: 'mistral-small-latest',
    defaultScope: 'email',
    placeholderKey: 'Clé Mistral...',
    modelHint: 'mistral-small-latest',
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    capabilities: ['extract', 'email'],
  },
  gemini: {
    name: 'Google Gemini',
    defaultModel: 'auto-flash',
    defaultScope: 'all',
    placeholderKey: 'AIza... ou AQ....',
    modelHint: 'auto-flash (3.8 / 2.5 Flash)',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    capabilities: ['search', 'extract', 'email'],
  },
};

export const TASK_PROVIDER_ORDER: Record<ApiTask, ApiProvider[]> = {
  search: ['tavily', 'gemini'],
  extract: ['groq', 'openrouter', 'mistral', 'gemini'],
  email: ['mistral', 'openrouter', 'gemini', 'groq'],
};

export function getOrderedKeysForTask(
  keys: ApiKeyEntry[],
  task: ApiTask,
  options?: { onlyProvider?: ApiProvider; includeQuotaFallback?: boolean }
): ApiKeyEntry[] {
  const allowedProviders = TASK_PROVIDER_ORDER[task];
  const eligible = keys.filter((k) => {
    if (!k.enabled || !k.apiKey.trim()) return false;
    if (options?.onlyProvider && k.provider !== options.onlyProvider) return false;
    if (!allowedProviders.includes(k.provider)) return false;
    if (k.taskScope !== 'all' && k.taskScope !== task) return false;
    if (!options?.includeQuotaFallback && k.status === 'quota') return false;
    return true;
  });

  return [...eligible].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const rankA = allowedProviders.indexOf(a.provider);
    const rankB = allowedProviders.indexOf(b.provider);
    if (rankA !== rankB) return rankA - rankB;
    return a.label.localeCompare(b.label);
  });
}

function isQuotaError(status: number, errMsg: string): boolean {
  return (
    status === 429 ||
    /quota|rate[\s_-]?limit|resource_exhausted|too many requests|credit|exceeded/i.test(errMsg)
  );
}

let cachedWorkingGeminiModel = '';

async function discoverLatestFlashModel(apiKey: string, signal?: AbortSignal): Promise<string[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      { signal }
    );
    if (!res.ok) return [];
    const json = await res.json();
    const list: Array<{ name?: string; supportedGenerationMethods?: string[] }> = Array.isArray(json?.models)
      ? json.models
      : [];
    return list
      .filter(
        (m) =>
          m?.name &&
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent') &&
          /^models\/gemini-\d/i.test(m.name) &&
          /flash/i.test(m.name) &&
          !/omni|tts|image|audio|exp|robotics|computer/i.test(m.name)
      )
      .map((m) => String(m.name).replace(/^models\//, ''))
      .sort((a, b) => {
        const aLite = /lite/i.test(a) ? 1 : 0;
        const bLite = /lite/i.test(b) ? 1 : 0;
        if (aLite !== bLite) return aLite - bLite;
        return b.localeCompare(a, undefined, { numeric: true });
      });
  } catch {
    return [];
  }
}

async function callGeminiAutoModel(
  apiKey: string,
  payload: Record<string, unknown>,
  preferredModel = '',
  signal?: AbortSignal
): Promise<{
  ok: boolean;
  status: number;
  model: string;
  data: {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string } }> };
    }>;
  } | null;
  error: string;
}> {
  const key = apiKey.trim();
  if (!key) return { ok: false, status: 400, model: '', data: null, error: 'Clé API vide.' };

  const customModel = preferredModel && preferredModel !== 'auto-flash' ? preferredModel.trim() : '';
  const initialCandidates = Array.from(
    new Set(
      [
        customModel,
        cachedWorkingGeminiModel,
        'gemini-3.8-flash',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
      ].filter(Boolean)
    )
  );

  let lastErr = '';
  let lastStatus = 500;
  const tryModels = async (models: string[]) => {
    for (const model of models) {
      if (signal?.aborted) return null;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify(payload),
        }
      );
      lastStatus = res.status;
      if (res.ok) {
        cachedWorkingGeminiModel = model;
        const data = await res.json();
        return { ok: true, status: res.status, model, data, error: '' };
      }
      const errJson = await res.json().catch(() => ({}));
      lastErr = errJson?.error?.message || `HTTP ${res.status}`;
      if (res.status === 401 || /API key not valid|API_KEY_INVALID/i.test(lastErr)) {
        return { ok: false, status: res.status, model, data: null, error: lastErr };
      }
      if (isQuotaError(res.status, lastErr)) {
        // Continuer sur le prochain modèle Flash (ex. 2.5-flash-lite) avant d'abandonner la clé
        continue;
      }
    }
    return null;
  };

  const firstAttempt = await tryModels(initialCandidates);
  if (firstAttempt) return firstAttempt;

  const discovered = (await discoverLatestFlashModel(key, signal)).filter((m) => !initialCandidates.includes(m));
  if (discovered.length > 0) {
    const secondAttempt = await tryModels(discovered.slice(0, 3));
    if (secondAttempt) return secondAttempt;
  }

  return { ok: false, status: lastStatus, model: '', data: null, error: lastErr || 'Aucun modèle Gemini compatible trouvé.' };
}

type KeyStatusUpdater = (id: string, status: ApiKeyHealth, message: string) => void;

async function callSingleLLMKey(
  entry: ApiKeyEntry,
  prompt: string,
  signal?: AbortSignal
): Promise<{ ok: boolean; text: string; usedModel: string; status: number; error: string }> {
  const key = entry.apiKey.trim();

  if (entry.provider === 'gemini') {
    const res = await callGeminiAutoModel(
      key,
      { contents: [{ parts: [{ text: prompt }] }] },
      entry.model,
      signal
    );
    if (!res.ok || !res.data) {
      return { ok: false, text: '', usedModel: res.model || entry.model, status: res.status, error: res.error };
    }
    const parts = res.data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || '').join('\n').trim();
    return { ok: Boolean(text), text, usedModel: res.model, status: 200, error: text ? '' : 'Réponse vide' };
  }

  if (entry.provider === 'groq') {
    const groqModels = Array.from(
      new Set([entry.model.trim() || 'llama-3.3-70b-versatile', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'])
    );
    let lastStatus = 500;
    let lastErr = 'Erreur Groq';
    for (const model of groqModels) {
      if (signal?.aborted) break;
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        signal,
        body: JSON.stringify({
          model,
          temperature: 0.25,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      lastStatus = res.status;
      if (res.ok) {
        const json = await res.json();
        const text = String(json?.choices?.[0]?.message?.content || '').trim();
        if (text) return { ok: true, text, usedModel: model, status: 200, error: '' };
      } else {
        const errJson = await res.json().catch(() => ({}));
        lastErr = errJson?.error?.message || `HTTP ${res.status}`;
        if (res.status === 401) break;
      }
    }
    return { ok: false, text: '', usedModel: entry.model, status: lastStatus, error: lastErr };
  }

  if (entry.provider === 'openrouter') {
    const model = entry.model.trim() || 'openrouter/free';
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://orange-pro-mdm.local',
        'X-Title': 'Orange Pro B2B MDM Studio',
      },
      signal,
      body: JSON.stringify({
        model,
        temperature: 0.25,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return { ok: false, text: '', usedModel: model, status: res.status, error: errJson?.error?.message || `HTTP ${res.status}` };
    }
    const json = await res.json();
    const text = String(json?.choices?.[0]?.message?.content || '').trim();
    const actualModel = String(json?.model || model);
    return { ok: Boolean(text), text, usedModel: actualModel, status: 200, error: text ? '' : 'Réponse vide' };
  }

  if (entry.provider === 'mistral') {
    const model = entry.model.trim() || 'mistral-small-latest';
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      signal,
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return { ok: false, text: '', usedModel: model, status: res.status, error: errJson?.message || errJson?.error?.message || `HTTP ${res.status}` };
    }
    const json = await res.json();
    const text = String(json?.choices?.[0]?.message?.content || '').trim();
    return { ok: Boolean(text), text, usedModel: model, status: 200, error: text ? '' : 'Réponse vide' };
  }

  return { ok: false, text: '', usedModel: entry.model, status: 400, error: 'Fournisseur non LLM' };
}

export async function callRouterLLM(
  keys: ApiKeyEntry[],
  task: 'extract' | 'email',
  prompt: string,
  signal?: AbortSignal,
  onStatus?: KeyStatusUpdater
): Promise<{ ok: boolean; text: string; providerLabel: string; usedModel: string; error: string }> {
  const ordered = getOrderedKeysForTask(keys, task);
  if (ordered.length === 0) {
    return { ok: false, text: '', providerLabel: '', usedModel: '', error: 'Aucune clé IA active pour cette tâche.' };
  }

  let lastErr = '';
  for (const entry of ordered) {
    if (signal?.aborted) break;
    try {
      const res = await callSingleLLMKey(entry, prompt, signal);
      if (res.ok && res.text) {
        onStatus?.(entry.id, 'ok', `Actif (${res.usedModel})`);
        return {
          ok: true,
          text: res.text,
          providerLabel: `${entry.label} (${PROVIDER_META[entry.provider].name})`,
          usedModel: res.usedModel,
          error: '',
        };
      }
      lastErr = res.error;
      if (isQuotaError(res.status, res.error)) {
        onStatus?.(entry.id, 'quota', 'Quota (rotation auto)');
      } else {
        onStatus?.(entry.id, 'error', `Erreur: ${res.error.slice(0, 70)}`);
      }
    } catch (err: unknown) {
      if (signal?.aborted) break;
      lastErr = err instanceof Error ? err.message : String(err);
      onStatus?.(entry.id, 'error', `Erreur réseau: ${lastErr.slice(0, 60)}`);
    }
  }
  return { ok: false, text: '', providerLabel: '', usedModel: '', error: lastErr || 'Toutes les clés IA ont échoué.' };
}

export async function callTavilySearchPool(
  keys: ApiKeyEntry[],
  query: string,
  signal?: AbortSignal,
  onStatus?: KeyStatusUpdater
): Promise<{
  ok: boolean;
  combinedText: string;
  urls: string[];
  usedLabel: string;
  error: string;
}> {
  const tavilyKeys = getOrderedKeysForTask(keys, 'search', { onlyProvider: 'tavily' });
  if (tavilyKeys.length === 0) {
    return { ok: false, combinedText: '', urls: [], usedLabel: '', error: 'Aucune clé Tavily active.' };
  }

  let lastErr = '';
  for (const entry of tavilyKeys) {
    if (signal?.aborted) break;
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          api_key: entry.apiKey.trim(),
          query,
          search_depth: entry.model === 'advanced' ? 'advanced' : 'basic',
          max_results: 5,
          include_answer: true,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        lastErr = errJson?.detail || errJson?.error || `HTTP ${res.status}`;
        if (isQuotaError(res.status, String(lastErr))) {
          onStatus?.(entry.id, 'quota', 'Quota (rotation auto)');
        } else {
          onStatus?.(entry.id, 'error', `Erreur: ${String(lastErr).slice(0, 70)}`);
        }
        continue;
      }
      const data = await res.json();
      const results: Array<{ title?: string; url?: string; content?: string }> = Array.isArray(data?.results)
        ? data.results
        : [];
      const urls = results.map((r) => String(r.url || '')).filter((u) => /^https?:\/\//i.test(u));
      const parts = [
        data?.answer ? `Synthèse: ${data.answer}` : '',
        ...results.map((r) => `${r.title || ''}\n${r.url || ''}\n${r.content || ''}`),
      ].filter(Boolean);
      onStatus?.(entry.id, 'ok', `Actif (${entry.model || 'basic'})`);
      return { ok: true, combinedText: parts.join('\n\n'), urls, usedLabel: entry.label, error: '' };
    } catch (err: unknown) {
      if (signal?.aborted) break;
      lastErr = err instanceof Error ? err.message : String(err);
      onStatus?.(entry.id, 'error', `Erreur: ${lastErr.slice(0, 60)}`);
    }
  }
  return { ok: false, combinedText: '', urls: [], usedLabel: '', error: lastErr || 'Pool Tavily indisponible.' };
}

export async function callGeminiGroundingPool(
  keys: ApiKeyEntry[],
  prompt: string,
  signal?: AbortSignal,
  onStatus?: KeyStatusUpdater
): Promise<{
  ok: boolean;
  rawText: string;
  chunkUrls: string[];
  usedLabel: string;
  error: string;
}> {
  const geminiKeys = getOrderedKeysForTask(keys, 'search', { onlyProvider: 'gemini' });
  if (geminiKeys.length === 0) {
    return { ok: false, rawText: '', chunkUrls: [], usedLabel: '', error: 'Aucune clé Gemini active.' };
  }

  let lastErr = '';
  for (const entry of geminiKeys) {
    if (signal?.aborted) break;
    try {
      const gRes = await callGeminiAutoModel(
        entry.apiKey,
        {
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
        },
        entry.model,
        signal
      );
      if (gRes.ok && gRes.data) {
        const parts = gRes.data?.candidates?.[0]?.content?.parts || [];
        const rawText = parts.map((p) => p.text || '').join('\n');
        const chunks = gRes.data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const chunkUrls = chunks
          .map((ch) => ch?.web?.uri || '')
          .filter((uri) => /^https?:\/\//i.test(uri) && !/(google\.|vertexaisearch\.)/i.test(uri));
        onStatus?.(entry.id, 'ok', `Grounding actif (${gRes.model})`);
        return { ok: true, rawText, chunkUrls, usedLabel: entry.label, error: '' };
      }
      lastErr = gRes.error;
      if (isQuotaError(gRes.status, gRes.error)) {
        onStatus?.(entry.id, 'quota', 'Quota (rotation auto)');
      } else {
        onStatus?.(entry.id, 'error', `Erreur: ${gRes.error.slice(0, 70)}`);
      }
    } catch (err: unknown) {
      if (signal?.aborted) break;
      lastErr = err instanceof Error ? err.message : String(err);
      onStatus?.(entry.id, 'error', `Erreur: ${lastErr.slice(0, 60)}`);
    }
  }
  return { ok: false, rawText: '', chunkUrls: [], usedLabel: '', error: lastErr || 'Pool Gemini Grounding indisponible.' };
}

export async function testApiKeyEntry(entry: ApiKeyEntry): Promise<{ ok: boolean; status: ApiKeyHealth; msg: string }> {
  if (!entry.apiKey.trim()) {
    return { ok: false, status: 'error', msg: 'Clé API manquante.' };
  }
  try {
    if (entry.provider === 'tavily') {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: entry.apiKey.trim(),
          query: 'Orange Maroc entreprise',
          search_depth: entry.model === 'advanced' ? 'advanced' : 'basic',
          max_results: 1,
        }),
      });
      if (res.ok) return { ok: true, status: 'ok', msg: `Tavily connecté (${entry.model || 'basic'})` };
      const errJson = await res.json().catch(() => ({}));
      const msg = String(errJson?.detail || errJson?.error || `HTTP ${res.status}`);
      if (isQuotaError(res.status, msg)) return { ok: false, status: 'quota', msg: 'Quota (rotation auto)' };
      return { ok: false, status: 'error', msg: msg.slice(0, 90) };
    }

    if (entry.provider === 'gemini') {
      const gRes = await callGeminiAutoModel(
        entry.apiKey,
        { contents: [{ parts: [{ text: 'Réponds OK.' }] }], tools: [{ google_search: {} }] },
        entry.model
      );
      if (gRes.ok) return { ok: true, status: 'ok', msg: `Grounding + IA actif (${gRes.model})` };
      const plain = await callGeminiAutoModel(
        entry.apiKey,
        { contents: [{ parts: [{ text: 'Réponds OK.' }] }] },
        entry.model
      );
      if (plain.ok) return { ok: true, status: 'ok', msg: `IA active (${plain.model}) — Grounding limité` };
      if (isQuotaError(gRes.status, gRes.error)) return { ok: false, status: 'quota', msg: 'Quota (rotation auto)' };
      return { ok: false, status: 'error', msg: gRes.error.slice(0, 90) };
    }

    const res = await callSingleLLMKey(entry, 'Réponds uniquement OK.');
    if (res.ok) return { ok: true, status: 'ok', msg: `Connecté (${res.usedModel})` };
    if (isQuotaError(res.status, res.error)) return { ok: false, status: 'quota', msg: 'Quota (rotation auto)' };
    return { ok: false, status: 'error', msg: res.error.slice(0, 90) };
  } catch (err: unknown) {
    return { ok: false, status: 'error', msg: err instanceof Error ? err.message : String(err) };
  }
}

export async function auditAndCleanAllRowsWithAI(
  rows: FicheEntreprise[],
  apiKeys: ApiKeyEntry[],
  onKeyStatus?: KeyStatusUpdater
): Promise<{ cleaned: FicheEntreprise[]; removedCount: number; correctedSecteurCount: number; normalizedCount: number; usedAI: boolean }> {
  let removedCount = 0;
  let correctedSecteurCount = 0;
  let normalizedCount = 0;
  let usedAI = false;

  const survivors: FicheEntreprise[] = [];
  for (const f of rows) {
    const cleanName = cleanExtractedCompanyName(f.societe);
    if (!isValidCompanyName(cleanName)) {
      removedCount++;
      continue;
    }
    const nextPhone = f.telephone ? normalizeMoroccanPhone(f.telephone) : '';
    const nextEmail = f.email ? normalizeProEmail(f.email) : '';
    if (nextPhone !== f.telephone || nextEmail !== f.email || cleanName !== f.societe) normalizedCount++;

    const nextSec = inferSecteur(`${cleanName} ${f.role}`, f.secteur, nextEmail);
    if (nextSec !== f.secteur) correctedSecteurCount++;

    survivors.push({
      ...f,
      societe: cleanName,
      secteur: nextSec,
      telephone: nextPhone,
      email: nextEmail,
    });
  }

  const extractKeys = getOrderedKeysForTask(apiKeys, 'extract');
  if (extractKeys.length === 0 || survivors.length === 0) {
    return { cleaned: survivors, removedCount, correctedSecteurCount, normalizedCount, usedAI: false };
  }

  const validCodes = Object.keys(SECTEURS_META) as SecteurCode[];
  const aiMap = new Map<string, { keep: boolean; secteur?: SecteurCode }>();

  for (let i = 0; i < survivors.length; i += 25) {
    const batch = survivors.slice(i, i + 25).map((r) => ({
      id: r.id,
      societe: r.societe,
      secteur: r.secteur,
      email: r.email,
      role: r.role,
    }));
    try {
      const prompt = `Tu es un auditeur MDM B2B Orange Pro Maroc. Pour chaque entrée JSON ci-dessous, décide :
1) keep (boolean) : false si ce n'est PAS une vraie entreprise (ex: bouton UI, titre de catégorie, nom de ville, article, bruit navigation).
2) secteur : le code EXACT parmi [${validCodes.join(', ')}] en utilisant le nom de la société et le domaine email.
Réponds UNIQUEMENT en tableau JSON strict [{"id":"...","keep":true,"secteur":"..."}].
Données : ${JSON.stringify(batch)}`;

      const rRes = await callRouterLLM(apiKeys, 'extract', prompt, undefined, onKeyStatus);
      if (rRes.ok && rRes.text) {
        const arrMatch = rRes.text.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          const parsed = JSON.parse(arrMatch[0]);
          if (Array.isArray(parsed)) {
            usedAI = true;
            for (const item of parsed) {
              if (item && item.id) {
                aiMap.set(String(item.id), {
                  keep: item.keep !== false,
                  secteur: validCodes.includes(item.secteur) ? (item.secteur as SecteurCode) : undefined,
                });
              }
            }
          }
        }
      }
    } catch {
      // Fallback silencieux sur le résultat déterministe
    }
  }

  const finalList: FicheEntreprise[] = [];
  for (const f of survivors) {
    const verdict = aiMap.get(f.id);
    if (verdict && !verdict.keep) {
      removedCount++;
      continue;
    }
    if (verdict && verdict.secteur && verdict.secteur !== f.secteur) {
      correctedSecteurCount++;
      finalList.push({ ...f, secteur: verdict.secteur });
    } else {
      finalList.push(f);
    }
  }

  return { cleaned: finalList, removedCount, correctedSecteurCount, normalizedCount, usedAI };
}

// ============================================================================
// 8. STUDIO EMAIL IA & SKILLS DE RÉDACTION PERSONNALISÉS (7 CYCLES)
// ============================================================================

export type CycleContrat =
  | 'premier_contact'
  | 'suite_passage'
  | 'diagnostic'
  | 'relance_devis'
  | 'fin_contrat'
  | 'renouvellement'
  | 'reactivation';

export type TonEmail = 'terrain' | 'executif' | 'court';

export interface EmailSkill {
  id: string;
  nom: string;
  description: string;
  role: string;
  regles: string;
  ctaStyle: string;
  builtin?: boolean;
}

export const STORAGE_KEY_EMAIL_SKILLS = 'orange_pro_email_skills_v1';

export const DEFAULT_EMAIL_SKILLS: EmailSkill[] = [
  {
    id: 'terrain-orange',
    nom: 'Prospection Terrain Orange Pro',
    description: 'Direct, concret et calibré sur les enjeux métier locaux.',
    role: 'Conseiller Commercial Terrain Orange Pro Maroc expert des TPE/PME locales',
    regles:
      'Parle concret (continuité, débit, facture unique, interlocuteur local). Aucun blabla marketing creux. Cite explicitement le secteur, la ville et l’offre Orange Pro recommandée.',
    ctaStyle: 'Proposer un diagnostic rapide de 10 minutes sur place ou par téléphone cette semaine.',
    builtin: true,
  },
  {
    id: 'direction-gc',
    nom: 'Approche Direction / Grand Compte',
    description: 'Posture exécutive axée SLA, continuité d’activité et maîtrise budgétaire.',
    role: 'Account Executive B2B Orange Pro dédié aux dirigeants et directeurs administratifs',
    regles:
      'Ton sobre et structuré. Mettre en avant la fiabilité, la continuité de service, la consolidation des factures et la gouvernance flotte. Maximum 3 paragraphes courts.',
    ctaStyle: 'Solliciter un échange de 15 minutes avec le décideur ou le responsable administratif.',
    builtin: true,
  },
  {
    id: 'bascule-fin-contrat',
    nom: 'Bascule Fin de Contrat Concurrent',
    description: 'Optimisation coûts & portabilité sans coupure depuis Maroc Telecom / inwi.',
    role: 'Spécialiste migration et portabilité télécoms B2B Orange Pro Maroc',
    regles:
      'Insister sur la fenêtre sans pénalité de résiliation, la portabilité intégrale des numéros fixes/mobiles sans coupure et le chiffrage transparent de l’économie mensuelle.',
    ctaStyle: 'Demander la date d’échéance ou la dernière facture pour chiffrer l’économie nette sous 24h.',
    builtin: true,
  },
  {
    id: 'relance-eclair',
    nom: 'Relance Éclair (4 lignes)',
    description: 'Ultra-court, lisible sur mobile en 10 secondes, question fermée.',
    role: 'Commercial B2B direct qui respecte le temps du dirigeant',
    regles:
      'Maximum 4 à 5 lignes. Zéro formule lourde. Une phrase de contexte, une proposition claire, une question fermée appelant un oui/non ou un créneau.',
    ctaStyle: 'Question fermée simple (ex. Mardi matin ou jeudi après-midi pour 10 min ?).',
    builtin: true,
  },
];

export const CYCLES_CONTRAT: { id: CycleContrat; label: string; desc: string }[] = [
  { id: 'premier_contact', label: 'Premier contact', desc: 'Prise de contact initiale à froid' },
  { id: 'suite_passage', label: 'Suite à passage / appel', desc: 'Après visite terrain ou premier appel' },
  { id: 'diagnostic', label: 'Diagnostic / Qualification', desc: 'Collecte facture, irritants et besoins' },
  { id: 'relance_devis', label: 'Relance de devis', desc: 'Suivi proposition envoyée' },
  { id: 'fin_contrat', label: 'Fin de contrat proche', desc: 'Bascule opérateur sans pénalité' },
  { id: 'renouvellement', label: 'Client existant / Upgrade', desc: 'Montée en gamme Fibre ou Flotte' },
  { id: 'reactivation', label: 'Réactivation', desc: 'Reprise de contact après silence' },
];

const ANGLES_METIER: Record<SecteurCode, string> = {
  fiduciaire: 'la continuité de vos déclarations fiscales, échanges clients et standard fixe sans coupure',
  clinique: 'la haute disponibilité de vos accès internet, imagerie médicale et flotte de garde',
  notaire: 'la stabilité de vos actes dématérialisés et un standard fixe irréprochable',
  immobilier: 'la réactivité de vos commerciaux sur le terrain et la connexion fibre de vos bureaux de vente',
  riad_hotellerie: 'un Wi-Fi fluide pour vos clients et une réception joignable en continu',
  auto_ecole: 'une connexion fiable pour la gestion des dossiers et un numéro pro dédié',
  pme: 'le regroupement de votre fibre et de vos lignes mobiles sur une seule facture claire',
  industrie: 'un débit dédié garanti sur site industriel et une flotte mobile maîtrisée pour vos équipes',
  btp: 'une connectivité immédiate sur vos chantiers et des lignes pro fiables pour vos conducteurs de travaux',
  gros: 'la couverture de vos commerciaux/livreurs sur la route et la centralisation de vos factures',
  enseignement: 'un débit stable pour l’administration et les salles connectées',
  liberal: 'la stabilité de vos rendez-vous, envois de dossiers lourds et standard du cabinet',
  commerce: 'une installation rapide pour vos TPE, caméras et WhatsApp boutique',
};

export function generatePersonalizedEmail(
  f: FicheEntreprise,
  cycle: CycleContrat,
  ton: TonEmail,
  signature: string,
  skill?: EmailSkill
): { objet: string; corps: string } {
  const reco = getOrangeProRecommendation(f);
  const salut = f.contact.trim() ? `Bonjour ${f.contact.trim()},` : 'Bonjour Madame, Monsieur,';
  const ville = f.ville || 'votre région';
  const angle = ANGLES_METIER[f.secteur] || ANGLES_METIER.pme;
  const effInfo = f.effectif ? ` (${f.effectif} collaborateurs)` : '';
  const roleInfo = f.role ? ` en tant que ${f.role}` : '';
  const sig = signature.trim() || 'Cordialement,\nConseiller Commercial Orange Pro';

  let objet = '';
  let accroche = '';
  let proposition = '';
  let cta = '';

  if (cycle === 'premier_contact') {
    objet = `Orange Pro ${ville} — Solution ${reco.tier} pour ${f.societe}`;
    accroche = `J’accompagne les structures du secteur ${SECTEURS_META[f.secteur].label.toLowerCase()} sur ${ville}. Pour ${f.societe}${effInfo}, l’enjeu prioritaire reste ${angle}.`;
    proposition = `Nous proposons actuellement l’offre ${reco.offre}, calibrée pour votre profil avec un interlocuteur local dédié.`;
    cta = `Auriez-vous 10 minutes cette semaine pour un diagnostic rapide de votre installation actuelle ?`;
  } else if (cycle === 'suite_passage') {
    objet = `Suite à mon passage — ${f.societe} (${reco.tier} Orange Pro)`;
    accroche = `Merci pour votre accueil concernant ${f.societe}. Comme évoqué ensemble, notre priorité est de sécuriser ${angle}.`;
    proposition = `La piste la plus adaptée à votre organisation${effInfo} est : ${reco.offre}.`;
    cta = `Je vous propose qu’on passe en revue les conditions et la portabilité de vos numéros demain ou après-demain.`;
  } else if (cycle === 'diagnostic') {
    objet = `Diagnostic télécoms rapide — ${f.societe} (${ville})`;
    accroche = `Afin de vous préparer une étude chiffrée pertinente${roleInfo} pour ${f.societe}${effInfo}, je vous propose de faire le point sur vos accès actuels et ${angle}.`;
    proposition = `Sur votre profil ${reco.tier}, notre piste de travail porte sur ${reco.offre} avec facturation consolidée.`;
    cta = `Pouvez-vous me partager votre nombre de lignes actuel ou un créneau de 10 minutes pour finaliser le diagnostic ?`;
  } else if (cycle === 'fin_contrat') {
    objet = `Anticipation fin de contrat télécoms — ${f.societe}`;
    accroche = `La période de fin d’engagement est le meilleur moment pour optimiser vos coûts télécoms chez ${f.societe} sans frais de résiliation.`;
    proposition = `Nous pouvons préparer en amont la bascule vers ${reco.offre} avec portabilité sans coupure pour garantir ${angle}.`;
    cta = `Pouvez-vous me confirmer la date d’échéance afin que je vous chiffre l’économie nette ?`;
  } else if (cycle === 'relance_devis') {
    objet = `Suivi de votre proposition Orange Pro — ${f.societe}`;
    accroche = `Je reviens vers vous suite à notre proposition pour ${f.societe} (${reco.offre}).`;
    proposition = `Tout est prêt de notre côté pour planifier l’activation et sécuriser ${angle} dès votre feu vert.`;
    cta = `Souhaitez-vous ajuster un point technique ou tarifaire avant validation ?`;
  } else if (cycle === 'renouvellement') {
    objet = `Évolution de votre parc Orange Pro — ${f.societe}`;
    accroche = `En tant que client ou partenaire sur ${ville}, vous êtes éligible à une mise à niveau de vos accès pour ${f.societe}${effInfo}.`;
    proposition = `Le passage sur ${reco.offre} permet de renforcer ${angle} tout en consolidant votre facturation.`;
    cta = `Quand pouvons-nous faire un point de 10 minutes sur vos besoins actuels ?`;
  } else {
    objet = `Toujours d’actualité pour ${f.societe} ?`;
    accroche = `Je me permets de reprendre contact avec vous sur ${ville} au sujet des accès internet et lignes pro de ${f.societe}.`;
    proposition = `Si vous rencontrez des lenteurs, coupures ou factures éclatées, notre solution ${reco.offre} règle précisément ${angle}.`;
    cta = `Un simple retour suffit si vous souhaitez qu’on en reparle ce mois-ci.`;
  }

  if (skill?.id === 'relance-eclair' || ton === 'court') {
    return {
      objet,
      corps: `${salut}\n\n${accroche}\nPiste recommandée : ${reco.offre}.\n${cta}\n\n${sig}`,
    };
  }
  if (skill?.id === 'direction-gc' || ton === 'executif') {
    return {
      objet,
      corps: `${salut}\n\nDans le cadre de l’accompagnement des dirigeants sur ${ville}, je souhaite vous soumettre une optimisation dédiée à ${f.societe}${effInfo}.\n\nEnjeu ciblé : ${angle}.\nArchitecture recommandée : ${reco.offre}.\n\n${cta}\n\n${sig}`,
    };
  }
  if (skill?.id === 'bascule-fin-contrat') {
    return {
      objet: `Optimisation & portabilité sans coupure — ${f.societe}`,
      corps: `${salut}\n\n${accroche}\n\nNotre approche de migration sur ${reco.offre} garantit la portabilité intégrale de vos numéros sans interruption de service, tout en sécurisant ${angle}.\n\n${cta}\n\n${sig}`,
    };
  }

  return {
    objet,
    corps: `${salut}\n\n${accroche}\n\n${proposition}\n\n${cta}\n\n${sig}`,
  };
}


// ============================================================================
// 9. APPLICATION PRINCIPALE (EXECUTIVE B2B WORKSPACE)
// ============================================================================

export default function App() {
  // 1. Portefeuille CRM persistant (localStorage + synchronisation Cloud Firestore)
  const [fiches, setFiches] = useState<FicheEntreprise[]>(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_PORTFOLIO);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return ensureUniqueNumeroFiches(parsed);
      }
    } catch {
      // Fallback
    }
    return ensureUniqueNumeroFiches(createInitialPortfolio());
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_PORTFOLIO, JSON.stringify(fiches));
    } catch {
      // Ignore quota
    }
  }, [fiches]);

  // 2. Panneau Villes Cibles persistant
  const [villesState, setVillesState] = useState<{
    all: string[];
    active: string[];
    mode: 'filter' | 'default';
    defaultVille: string;
  }>(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_VILLES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.all) && parsed.all.length > 0) {
          return {
            all: parsed.all,
            active: Array.isArray(parsed.active) ? parsed.active : parsed.all,
            mode: parsed.mode === 'filter' ? 'filter' : 'default',
            defaultVille: typeof parsed.defaultVille === 'string' && parsed.defaultVille ? parsed.defaultVille : parsed.all[0],
          };
        }
      }
    } catch {
      // Fallback
    }
    return {
      all: DEFAULT_VILLES_MEKNES,
      active: DEFAULT_VILLES_MEKNES,
      mode: 'default',
      defaultVille: 'Meknès',
    };
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_VILLES, JSON.stringify(villesState));
    } catch {
      // Ignore quota
    }
  }, [villesState]);

  const allVilles = villesState.all;
  const activeVilles = villesState.active;
  const modeVille = villesState.mode;
  const defaultVille = villesState.defaultVille;
  const [newVilleInput, setNewVilleInput] = useState('');

  // 3. Hub API Multi-Fournisseurs persistant (orange_pro_api_hub_v1, strictement local, jamais dans le backup JSON)
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_API_HUB);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fallback
    }
    return [];
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_API_HUB, JSON.stringify(apiKeys));
    } catch {
      // Ignore quota
    }
  }, [apiKeys]);

  const apiKeysRef = useRef<ApiKeyEntry[]>(apiKeys);
  useEffect(() => {
    apiKeysRef.current = apiKeys;
  }, [apiKeys]);

  const [showApiHub, setShowApiHub] = useState(false);
  const [newKeyProvider, setNewKeyProvider] = useState<ApiProvider>('tavily');
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeySecret, setNewKeySecret] = useState('');
  const [newKeyModel, setNewKeyModel] = useState(PROVIDER_META.tavily.defaultModel);
  const [newKeyScope, setNewKeyScope] = useState<ApiTaskScope>(PROVIDER_META.tavily.defaultScope);
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [confirmClearHub, setConfirmClearHub] = useState(false);

  const activeApiCount = useMemo(
    () => apiKeys.filter((k) => k.enabled && k.apiKey.trim().length > 0).length,
    [apiKeys]
  );

  // 4. Navigation, Vue Kanban, Équipe/Payouts, Succès/Badges, Copilote IA & Filtres Portefeuille
  const [activeTab, setActiveTab] = useState<
    'portefeuille' | 'kanban' | 'team' | 'badges' | 'crawler' | 'paste' | 'dedup' | 'admin'
  >('portefeuille');
  const [teamStats, setTeamStats] = useState<TeamStatRecord[]>([]);
  const [signedContracts, setSignedContracts] = useState<SignedContractRecord[]>([]);
  const [signContractTarget, setSignContractTarget] = useState<SignContractTarget | null>(null);
  const [signingContractBusy, setSigningContractBusy] = useState(false);
  const [badgesFocusUid, setBadgesFocusUid] = useState<string | null>(null);
  const lastTeamStatHashRef = useRef<string>('');
  const [includePhoneOnlyDedup, setIncludePhoneOnlyDedup] = useState(false);
  const [dismissedDedupKeys, setDismissedDedupKeys] = useState<string[]>([]);
  const [crmViewMode, setCrmViewMode] = useState<'table' | 'kanban'>('table');
  const [showAiCopilot, setShowAiCopilot] = useState(false);
  const [copilotFiche, setCopilotFiche] = useState<FicheEntreprise | null>(null);
  const [serverAiStatus, setServerAiStatus] = useState<{ available: boolean; model: string }>({
    available: false,
    model: 'gemini-4-hydrogen',
  });

  useEffect(() => {
    let active = true;
    fetch('/api/ai/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data && typeof data.available === 'boolean') {
          setServerAiStatus({ available: data.available, model: data.model || 'gemini-4-hydrogen' });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const [search, setSearch] = useState('');
  const [couleurFilter, setCouleurFilter] = useState<SegmentCouleur | ''>('');
  const [secteurFilter, setSecteurFilter] = useState<SecteurCode | ''>('');
  const [villeFilter, setVilleFilter] = useState<string>('');
  const [tierFilter, setTierFilter] = useState<'' | 'Grand Compte' | 'PME' | 'TPE / Libéral'>('');
  const [effectifFilter, setEffectifFilter] = useState<'' | 'tpe' | 'pme' | 'gc' | 'vide'>('');
  const [completudeFilter, setCompletudeFilter] = useState<
    | ''
    | 'ready'
    | 'has_phone'
    | 'no_phone'
    | 'has_email'
    | 'no_email'
    | 'has_contact'
    | 'no_contact'
    | 'incomplete'
    | 'verified'
    | 'unverified'
  >('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [statutFilter, setStatutFilter] = useState<StatutCRM | ''>('');
  const [onlyReadyToCall, setOnlyReadyToCall] = useState(false);
  const [sortField, setSortField] = useState<'societe' | 'ville' | 'effectif' | 'maturite'>('maturite');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // 5. Refs & Modales
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const skillFileInputRef = useRef<HTMLInputElement | null>(null);

  const [assistModalFiche, setAssistModalFiche] = useState<FicheEntreprise | null>(null);
  const [assistPasteText, setAssistPasteText] = useState('');
  const [assistAiLoading, setAssistAiLoading] = useState(false);
  const [assistAiSummary, setAssistAiSummary] = useState('');
  const [assistExtraPhoneDraft, setAssistExtraPhoneDraft] = useState('');
  const [assistExtraEmailDraft, setAssistExtraEmailDraft] = useState('');
  const [lastVerifyDiag, setLastVerifyDiag] = useState('');

  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof FicheEntreprise } | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [inlineAddContact, setInlineAddContact] = useState<{ id: string; type: 'phone' | 'email' } | null>(null);
  const [inlineContactDraft, setInlineContactDraft] = useState('');

  // 6. Crawler Profond N1/N2
  const [crawlUrlsInput, setCrawlUrlsInput] = useState('');
  const [proxyStrategy, setProxyStrategy] = useState<ProxyStrategy>('auto');
  const [enablePagination, setEnablePagination] = useState(true);
  const [paginationMode, setPaginationMode] = useState<'unlimited' | 'range'>('unlimited');
  const [pageStart, setPageStart] = useState(1);
  const [pageEnd, setPageEnd] = useState(10);
  const [enableLevel2, setEnableLevel2] = useState(true);
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlProgress, setCrawlProgress] = useState({ done: 0, total: 0, captured: 0 });
  const [crawlLogs, setCrawlLogs] = useState<CrawlLog[]>([]);
  const [crawlPreview, setCrawlPreview] = useState<FicheEntreprise[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // 7. Audit & Enrichissement 8-Workers
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditProgress, setAuditProgress] = useState<{
    done: number;
    total: number;
    removed: number;
    secteurs: number;
    enriched: number;
    currentName: string;
  } | null>(null);
  const auditAbortRef = useRef<AbortController | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // 8. Extraction HTML / CSV / JSON & Saisie rapide
  const [pasteInput, setPasteInput] = useState('');
  const [pasteSource, setPasteSource] = useState('Pages Jaunes');
  const [pastePreview, setPastePreview] = useState<FicheEntreprise[]>([]);
  const [pasteIgnoredPhones, setPasteIgnoredPhones] = useState<string[]>([]);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddStatut, setQuickAddStatut] = useState<StatutCRM>('À contacter');
  const [quickForm, setQuickForm] = useState({
    societe: '',
    secteur: 'pme' as SecteurCode,
    ville: 'Meknès',
    telephone: '',
    telephonesSupplementaires: '',
    email: '',
    emailsSupplementaires: '',
    contact: '',
    role: '',
    source: 'Porte à porte',
    effectif: '',
  });

  // 9. Studio Email IA & Skills (orange_pro_email_skills_v1)
  const [emailSkills, setEmailSkills] = useState<EmailSkill[]>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_EMAIL_SKILLS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback
    }
    return DEFAULT_EMAIL_SKILLS;
  });
  const [activeSkillId, setActiveSkillId] = useState<string>('terrain-orange');
  const [showSkillEditor, setShowSkillEditor] = useState(false);
  const [editingSkill, setEditingSkill] = useState<EmailSkill | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_EMAIL_SKILLS, JSON.stringify(emailSkills));
    } catch {
      // Ignore quota
    }
  }, [emailSkills]);

  const activeSkill = useMemo(
    () => emailSkills.find((s) => s.id === activeSkillId) || emailSkills[0] || DEFAULT_EMAIL_SKILLS[0],
    [emailSkills, activeSkillId]
  );

  const [emailModalFiche, setEmailModalFiche] = useState<FicheEntreprise | null>(null);
  const [emailCycle, setEmailCycle] = useState<CycleContrat>('premier_contact');
  const [emailTon, setEmailTon] = useState<TonEmail>('terrain');
  const [emailSignature, setEmailSignature] = useState<string>(() => {
    try {
      const saved = window.localStorage.getItem('orange_pro_signature_v1');
      if (saved !== null) return saved;
    } catch {
      // Fallback
    }
    return 'Cordialement,\nConseiller Commercial Orange Pro';
  });
  useEffect(() => {
    try {
      window.localStorage.setItem('orange_pro_signature_v1', emailSignature);
    } catch {
      // Ignore quota
    }
  }, [emailSignature]);

  const [emailCustomPrompt, setEmailCustomPrompt] = useState('');
  const [emailObjet, setEmailObjet] = useState('');
  const [emailCorps, setEmailCorps] = useState('');
  const [emailProviderUsed, setEmailProviderUsed] = useState('');
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);

  // 10. Notifications toast non bloquantes
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'warn' | 'err' } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const notify = (msg: string, type: 'ok' | 'warn' | 'err' = 'ok') => {
    setToast({ msg, type });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4000);
  };

  // 11. Authentification Privée (Email/MDP + Google), Contrôle Super-Admin & Sauvegarde Cloud Firestore
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authReloadTick, setAuthReloadTick] = useState(0);
  const [appUserProfile, setAppUserProfile] = useState<ManagedAppUser | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [managedUsers, setManagedUsers] = useState<ManagedAppUser[]>([]);
  const [cloudSynced, setCloudSynced] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);

  const knownCloudFichesRef = useRef<Map<string, { hash: string; doc: SanitizedFicheDoc }>>(new Map());
  const knownCloudSkillsRef = useRef<Map<string, { hash: string; doc: SanitizedEmailSkillDoc }>>(new Map());
  const knownCloudWorkspaceHashRef = useRef<string>('');
  const latestLocalStateRef = useRef({ fiches, villesState, emailSignature, emailSkills });
  latestLocalStateRef.current = { fiches, villesState, emailSignature, emailSkills };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setCloudUser(u);
      setAuthReady(true);
      if (!u) {
        setCloudSynced(false);
        setAppUserProfile(null);
        setProfileChecked(true);
        setManagedUsers([]);
        setTeamStats([]);
        setSignedContracts([]);
        knownCloudFichesRef.current = new Map();
        knownCloudSkillsRef.current = new Map();
        knownCloudWorkspaceHashRef.current = '';
        lastTeamStatHashRef.current = '';
      } else {
        setCloudSynced(false);
        setProfileChecked(false);
      }
    });
    return () => unsub();
  }, []);

  // Vérification du profil /app_users/{uid} pour les comptes non-Super-Admin
  useEffect(() => {
    if (!authReady) return;
    if (!cloudUser) {
      setAppUserProfile(null);
      setProfileChecked(true);
      return;
    }
    if (isSuperAdminEmail(cloudUser.email)) {
      setAppUserProfile(null);
      setProfileChecked(true);
      return;
    }

    let cancelled = false;
    setProfileChecked(false);
    fetchAppUserProfile(cloudUser.uid)
      .then((profile) => {
        if (!cancelled) {
          setAppUserProfile(profile);
          setProfileChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAppUserProfile(null);
          setProfileChecked(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authReady, cloudUser, authReloadTick]);

  const accessDecision = useMemo(() => {
    if (!cloudUser || !profileChecked) return null;
    return evaluateUserAccess({
      email: cloudUser.email,
      emailVerified: cloudUser.emailVerified,
      appUserProfile,
    });
  }, [cloudUser, profileChecked, appUserProfile, authReloadTick]);

  const isSuperAdmin = accessDecision?.status === 'allowed' && accessDecision.isAdmin;
  const canAccessWorkspace = accessDecision?.status === 'allowed';

  // Empêche tout non-admin d'accéder à l'onglet Utilisateurs & Accès
  useEffect(() => {
    if (!isSuperAdmin && activeTab === 'admin') {
      setActiveTab('portefeuille');
    }
  }, [isSuperAdmin, activeTab]);

  // Liste temps réel /app_users réservée exclusivement au Super-Admin (filtrée par createdBy == adminUid)
  useEffect(() => {
    if (!authReady || !cloudUser || !isSuperAdmin) {
      setManagedUsers([]);
      return;
    }
    const unsub = onSnapshot(
      getAppUsersQuery(cloudUser.uid),
      (snap) => {
        const list: ManagedAppUser[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            uid: docSnap.id,
            email: typeof d.email === 'string' ? d.email : '',
            displayName: typeof d.displayName === 'string' ? d.displayName : '',
            role: d.role === 'manager' ? 'manager' : 'commercial',
            zone: typeof d.zone === 'string' ? d.zone : '',
            active: Boolean(d.active),
            createdBy: typeof d.createdBy === 'string' ? d.createdBy : '',
            createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : undefined,
          });
        });
        setManagedUsers(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'app_users');
        } catch {
          notify('Impossible de charger la liste des utilisateurs.', 'err');
        }
      }
    );
    return () => unsub();
  }, [authReady, cloudUser, isSuperAdmin]);

  // Liste temps réel /team_stats (classement équipe, XP, badges, évolution mensuelle)
  useEffect(() => {
    if (!authReady || !cloudUser || !canAccessWorkspace) {
      setTeamStats([]);
      return;
    }
    const unsub = onSnapshot(
      getTeamStatsQuery(),
      (snap) => {
        const list: TeamStatRecord[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            uid: docSnap.id,
            orgScope: 'orange_pro_team',
            displayName: typeof d.displayName === 'string' ? d.displayName : 'Collaborateur',
            role:
              d.role === 'super_admin' || d.role === 'manager' ? d.role : 'commercial',
            zone: typeof d.zone === 'string' ? d.zone : 'Meknès',
            active: typeof d.active === 'boolean' ? d.active : true,
            totalProspects: Number(d.totalProspects) || 0,
            totalQualified: Number(d.totalQualified) || 0,
            totalContracts: Number(d.totalContracts) || 0,
            totalPayoutMad: Number(d.totalPayoutMad) || 0,
            xp: Number(d.xp) || 0,
            unlockedCount: Number(d.unlockedCount) || 0,
            manualBadges: Array.isArray(d.manualBadges) ? d.manualBadges : [],
            monthlyHistory: Array.isArray(d.monthlyHistory) ? d.monthlyHistory : [],
          });
        });
        setTeamStats(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'team_stats');
        } catch {
          // Non-fatal fallback
        }
      }
    );
    return () => unsub();
  }, [authReady, cloudUser, canAccessWorkspace]);

  // Liste temps réel /signed_contracts (Super-Admin: toute l'équipe; Collaborateur: ses contrats + payouts sans PII)
  useEffect(() => {
    if (!authReady || !cloudUser || !canAccessWorkspace) {
      setSignedContracts([]);
      return;
    }
    const unsub = onSnapshot(
      getSignedContractsQuery(cloudUser.uid, isSuperAdmin),
      (snap) => {
        const list: SignedContractRecord[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: docSnap.id,
            orgScope: 'orange_pro_team',
            ownerId: typeof d.ownerId === 'string' ? d.ownerId : '',
            ownerName: typeof d.ownerName === 'string' ? d.ownerName : 'Collaborateur',
            ficheId: typeof d.ficheId === 'string' ? d.ficheId : '',
            numeroFiche: typeof d.numeroFiche === 'string' ? d.numeroFiche : '',
            societe: typeof d.societe === 'string' ? d.societe : '',
            ville: typeof d.ville === 'string' ? d.ville : '',
            secteur: typeof d.secteur === 'string' ? d.secteur : 'pme',
            produitOrangePro: typeof d.produitOrangePro === 'string' ? d.produitOrangePro : '',
            tier:
              d.tier === 'Grand Compte' || d.tier === 'TPE / Libéral' ? d.tier : 'PME',
            effectif: typeof d.effectif === 'string' ? d.effectif : '',
            payoutMad: Number(d.payoutMad) || 0,
            payoutStatus:
              d.payoutStatus === 'Validé' || d.payoutStatus === 'Versé'
                ? d.payoutStatus
                : 'En attente',
            signedAt: typeof d.signedAt === 'string' ? d.signedAt : '',
          });
        });
        setSignedContracts(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'signed_contracts');
        } catch {
          // Non-fatal fallback
        }
      }
    );
    return () => unsub();
  }, [authReady, cloudUser, canAccessWorkspace, isSuperAdmin]);

  useEffect(() => {
    if (!authReady || !cloudUser || !canAccessWorkspace) return;
    let cancelled = false;
    let unsubUser: (() => void) | null = null;
    let unsubFiches: (() => void) | null = null;
    let unsubSkills: (() => void) | null = null;

    const uid = cloudUser.uid;
    setCloudBusy(true);

    (async () => {
      try {
        const snapshotLocal = latestLocalStateRef.current;
        const { created } = await ensureUserWorkspace(
          uid,
          {
            villesAll: snapshotLocal.villesState.all,
            villesActive: snapshotLocal.villesState.active,
            modeVille: snapshotLocal.villesState.mode,
            defaultVille: snapshotLocal.villesState.defaultVille,
            emailSignature: snapshotLocal.emailSignature,
            seeded: true,
          },
          snapshotLocal.fiches,
          snapshotLocal.emailSkills
        );

        if (cancelled) return;

        if (created) {
          const initialWorkspace = sanitizeWorkspacePayload(uid, {
            villesAll: snapshotLocal.villesState.all,
            villesActive: snapshotLocal.villesState.active,
            modeVille: snapshotLocal.villesState.mode,
            defaultVille: snapshotLocal.villesState.defaultVille,
            emailSignature: snapshotLocal.emailSignature,
            seeded: true,
          });
          knownCloudWorkspaceHashRef.current = serializeDocCanonical(
            initialWorkspace as unknown as Record<string, unknown>
          );

          const fichesMap = new Map<string, { hash: string; doc: SanitizedFicheDoc }>();
          for (const f of snapshotLocal.fiches) {
            const clean = sanitizeFichePayload(uid, f);
            fichesMap.set(clean.id, {
              hash: serializeDocCanonical(clean as unknown as Record<string, unknown>),
              doc: clean,
            });
          }
          knownCloudFichesRef.current = fichesMap;

          const skillsMap = new Map<string, { hash: string; doc: SanitizedEmailSkillDoc }>();
          for (const s of snapshotLocal.emailSkills) {
            const clean = sanitizeSkillPayload(uid, s);
            skillsMap.set(clean.id, {
              hash: serializeDocCanonical(clean as unknown as Record<string, unknown>),
              doc: clean,
            });
          }
          knownCloudSkillsRef.current = skillsMap;
        }

        // Gate outbound sync until all 3 initial snapshots have hydrated knownCloud*Ref
        // (eliminates the race condition that previously triggered batch.set overwriting createdAt on existing docs).
        let userHydrated = created;
        let fichesHydrated = created;
        let skillsHydrated = created;
        const maybeEnableOutboundSync = () => {
          if (!cancelled && userHydrated && fichesHydrated && skillsHydrated) {
            setCloudSynced(true);
            setCloudBusy(false);
          }
        };

        unsubUser = onSnapshot(
          doc(db, 'users', uid),
          (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              const cleanWs = sanitizeWorkspacePayload(uid, {
                villesAll: Array.isArray(data.villesAll) ? data.villesAll : DEFAULT_VILLES_MEKNES,
                villesActive: Array.isArray(data.villesActive) ? data.villesActive : DEFAULT_VILLES_MEKNES,
                modeVille: data.modeVille === 'filter' ? 'filter' : 'default',
                defaultVille: typeof data.defaultVille === 'string' ? data.defaultVille : 'Meknès',
                emailSignature: typeof data.emailSignature === 'string' ? data.emailSignature : '',
                seeded: Boolean(data.seeded),
              });
              const nextHash = serializeDocCanonical(cleanWs as unknown as Record<string, unknown>);
              if (nextHash !== knownCloudWorkspaceHashRef.current) {
                knownCloudWorkspaceHashRef.current = nextHash;
                setVillesState({
                  all: cleanWs.villesAll.length > 0 ? cleanWs.villesAll : DEFAULT_VILLES_MEKNES,
                  active: cleanWs.villesActive,
                  mode: cleanWs.modeVille,
                  defaultVille: cleanWs.defaultVille,
                });
                setEmailSignature(cleanWs.emailSignature);
              }
            }
            userHydrated = true;
            maybeEnableOutboundSync();
          },
          (err) => {
            try {
              handleFirestoreError(err, OperationType.GET, `users/${uid}`);
            } catch {
              notify('Erreur de lecture de la configuration Cloud.', 'err');
            }
          }
        );

        unsubFiches = onSnapshot(
          query(getUserFichesCollection(uid), where('ownerId', '==', uid)),
          (snap) => {
            const remoteFiches: FicheEntreprise[] = [];
            const nextKnown = new Map<string, { hash: string; doc: SanitizedFicheDoc }>();

            snap.forEach((docSnap) => {
              const d = docSnap.data();
              const clean = sanitizeFichePayload(uid, {
                id: docSnap.id,
                numeroFiche: typeof d.numeroFiche === 'string' ? d.numeroFiche : undefined,
                societe: typeof d.societe === 'string' ? d.societe : '',
                secteur: typeof d.secteur === 'string' ? d.secteur : 'pme',
                ville: typeof d.ville === 'string' ? d.ville : '',
                telephone: typeof d.telephone === 'string' ? d.telephone : '',
                telephonesSupplementaires: Array.isArray(d.telephonesSupplementaires)
                  ? d.telephonesSupplementaires
                  : undefined,
                email: typeof d.email === 'string' ? d.email : '',
                emailsSupplementaires: Array.isArray(d.emailsSupplementaires)
                  ? d.emailsSupplementaires
                  : undefined,
                contact: typeof d.contact === 'string' ? d.contact : '',
                role: typeof d.role === 'string' ? d.role : '',
                source: typeof d.source === 'string' ? d.source : '',
                effectif: typeof d.effectif === 'string' ? d.effectif : '',
                statut: typeof d.statut === 'string' ? d.statut : 'À contacter',
                siteWeb: typeof d.siteWeb === 'string' ? d.siteWeb : undefined,
                verifieWeb: typeof d.verifieWeb === 'boolean' ? d.verifieWeb : undefined,
                pistesEnrichissement: Array.isArray(d.pistesEnrichissement) ? d.pistesEnrichissement : undefined,
                dateAjout: typeof d.dateAjout === 'string' ? d.dateAjout : new Date().toISOString(),
              });
              nextKnown.set(clean.id, {
                hash: serializeDocCanonical(clean as unknown as Record<string, unknown>),
                doc: clean,
              });
              remoteFiches.push({
                id: clean.id,
                ...(clean.numeroFiche !== undefined ? { numeroFiche: clean.numeroFiche } : {}),
                societe: clean.societe,
                secteur: clean.secteur as SecteurCode,
                ville: clean.ville,
                telephone: clean.telephone,
                ...(clean.telephonesSupplementaires !== undefined
                  ? { telephonesSupplementaires: clean.telephonesSupplementaires }
                  : {}),
                email: clean.email,
                ...(clean.emailsSupplementaires !== undefined
                  ? { emailsSupplementaires: clean.emailsSupplementaires }
                  : {}),
                contact: clean.contact,
                role: clean.role,
                source: clean.source,
                effectif: clean.effectif,
                statut: clean.statut as StatutCRM,
                ...(clean.siteWeb !== undefined ? { siteWeb: clean.siteWeb } : {}),
                ...(clean.verifieWeb !== undefined ? { verifieWeb: clean.verifieWeb } : {}),
                ...(clean.pistesEnrichissement !== undefined
                  ? { pistesEnrichissement: clean.pistesEnrichissement }
                  : {}),
                dateAjout: clean.dateAjout,
              });
            });

            remoteFiches.sort((a, b) => (b.dateAjout || '').localeCompare(a.dateAjout || ''));

            const prevKnown = knownCloudFichesRef.current;
            let same = prevKnown.size === nextKnown.size;
            if (same) {
              for (const [k, v] of nextKnown.entries()) {
                if (prevKnown.get(k)?.hash !== v.hash) {
                  same = false;
                  break;
                }
              }
            }
            knownCloudFichesRef.current = nextKnown;
            if (!same || !fichesHydrated) {
              // Avoid mutating already-signed fiches for non-Super-Admin collaborators (locked in firestore.rules)
              const hydratedList = isSuperAdmin
                ? ensureUniqueNumeroFiches(remoteFiches)
                : remoteFiches;
              setFiches(hydratedList);
            }
            fichesHydrated = true;
            maybeEnableOutboundSync();
          },
          (err) => {
            try {
              handleFirestoreError(err, OperationType.LIST, `users/${uid}/fiches`);
            } catch {
              notify('Erreur de synchronisation des fiches Cloud.', 'err');
            }
          }
        );

        unsubSkills = onSnapshot(
          query(getUserSkillsCollection(uid), where('ownerId', '==', uid)),
          (snap) => {
            const remoteSkills: EmailSkill[] = [];
            const nextKnown = new Map<string, { hash: string; doc: SanitizedEmailSkillDoc }>();

            snap.forEach((docSnap) => {
              const d = docSnap.data();
              const clean = sanitizeSkillPayload(uid, {
                id: docSnap.id,
                nom: typeof d.nom === 'string' ? d.nom : '',
                description: typeof d.description === 'string' ? d.description : '',
                role: typeof d.role === 'string' ? d.role : '',
                regles: typeof d.regles === 'string' ? d.regles : '',
                ctaStyle: typeof d.ctaStyle === 'string' ? d.ctaStyle : '',
                isBuiltin: typeof d.isBuiltin === 'boolean' ? d.isBuiltin : undefined,
              });
              nextKnown.set(clean.id, {
                hash: serializeDocCanonical(clean as unknown as Record<string, unknown>),
                doc: clean,
              });
              remoteSkills.push({
                id: clean.id,
                nom: clean.nom,
                description: clean.description,
                role: clean.role,
                regles: clean.regles,
                ctaStyle: clean.ctaStyle,
                ...(clean.isBuiltin !== undefined ? { isBuiltin: clean.isBuiltin } : {}),
              });
            });

            const prevKnown = knownCloudSkillsRef.current;
            let same = prevKnown.size === nextKnown.size;
            if (same) {
              for (const [k, v] of nextKnown.entries()) {
                if (prevKnown.get(k)?.hash !== v.hash) {
                  same = false;
                  break;
                }
              }
            }
            knownCloudSkillsRef.current = nextKnown;
            if ((!same || !skillsHydrated) && remoteSkills.length > 0) {
              setEmailSkills(remoteSkills);
            }
            skillsHydrated = true;
            maybeEnableOutboundSync();
          },
          (err) => {
            try {
              handleFirestoreError(err, OperationType.LIST, `users/${uid}/skills`);
            } catch {
              notify('Erreur de synchronisation des skills Cloud.', 'err');
            }
          }
        );

        maybeEnableOutboundSync();
      } catch {
        if (!cancelled) {
          notify('Impossible d’initialiser la synchronisation Cloud Firestore.', 'err');
          setCloudBusy(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      setCloudSynced(false);
      unsubUser?.();
      unsubFiches?.();
      unsubSkills?.();
    };
  }, [authReady, cloudUser, canAccessWorkspace, isSuperAdmin]);

  // Synchroniser automatiquement toute modification de fiches vers Firestore
  useEffect(() => {
    if (!cloudUser || !cloudSynced) return;
    const uid = cloudUser.uid;
    const sanitized = fiches.map((f) => sanitizeFichePayload(uid, f));
    const diff = computeCollectionSyncDiff(knownCloudFichesRef.current, sanitized);
    if (diff.toCreate.length === 0 && diff.toUpdate.length === 0 && diff.toDelete.length === 0) {
      return;
    }

    const nextKnown = new Map<string, { hash: string; doc: SanitizedFicheDoc }>();
    for (const docItem of sanitized) {
      if (!nextKnown.has(docItem.id)) {
        nextKnown.set(docItem.id, {
          hash: serializeDocCanonical(docItem as unknown as Record<string, unknown>),
          doc: docItem,
        });
      }
    }
    knownCloudFichesRef.current = nextKnown;

    syncFichesDiffToFirestore(uid, diff).catch(() => {
      notify('Échec de sauvegarde Cloud sur certaines fiches (copie locale conservée).', 'err');
    });
  }, [fiches, cloudUser, cloudSynced]);

  // Synchroniser automatiquement les skills Email IA vers Firestore
  useEffect(() => {
    if (!cloudUser || !cloudSynced) return;
    const uid = cloudUser.uid;
    const sanitized = emailSkills.map((s) => sanitizeSkillPayload(uid, s));
    const diff = computeCollectionSyncDiff(knownCloudSkillsRef.current, sanitized);
    if (diff.toCreate.length === 0 && diff.toUpdate.length === 0 && diff.toDelete.length === 0) {
      return;
    }

    const nextKnown = new Map<string, { hash: string; doc: SanitizedEmailSkillDoc }>();
    for (const docItem of sanitized) {
      if (!nextKnown.has(docItem.id)) {
        nextKnown.set(docItem.id, {
          hash: serializeDocCanonical(docItem as unknown as Record<string, unknown>),
          doc: docItem,
        });
      }
    }
    knownCloudSkillsRef.current = nextKnown;

    syncSkillsDiffToFirestore(uid, diff).catch(() => {
      notify('Échec de sauvegarde Cloud des skills Email.', 'err');
    });
  }, [emailSkills, cloudUser, cloudSynced]);

  // Synchroniser automatiquement les villes cibles et la signature email vers Firestore (debounce 450ms)
  useEffect(() => {
    if (!cloudUser || !cloudSynced) return;
    const uid = cloudUser.uid;
    const payload = sanitizeWorkspacePayload(uid, {
      villesAll: villesState.all,
      villesActive: villesState.active,
      modeVille: villesState.mode,
      defaultVille: villesState.defaultVille,
      emailSignature,
      seeded: true,
    });
    const nextHash = serializeDocCanonical(payload as unknown as Record<string, unknown>);
    if (nextHash === knownCloudWorkspaceHashRef.current) return;

    const timer = window.setTimeout(() => {
      knownCloudWorkspaceHashRef.current = nextHash;
      syncWorkspaceToFirestore(uid, payload).catch(() => {
        notify('Échec de sauvegarde Cloud de la configuration.', 'err');
      });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [villesState, emailSignature, cloudUser, cloudSynced]);

  // Calcul des métriques personnelles, badges automatiques et synchronisation /team_stats/{uid}
  const mySignedContracts = useMemo(() => {
    if (!cloudUser) return [];
    return signedContracts.filter((c) => c.ownerId === cloudUser.uid);
  }, [signedContracts, cloudUser]);

  const myTeamStatRecord = useMemo(() => {
    if (!cloudUser) return null;
    return teamStats.find((s) => s.uid === cloudUser.uid) || null;
  }, [teamStats, cloudUser]);

  const myCollaboratorMetrics = useMemo<CollaboratorMetrics>(() => {
    const signedFichesCount = fiches.filter((f) => f.statut === 'Signé Orange Pro').length;
    const contractsCount = Math.max(signedFichesCount, mySignedContracts.length);
    const qualifiedCount = fiches.filter(
      (f) =>
        f.statut === 'RDV pris' ||
        f.statut === 'Devis envoyé' ||
        f.statut === 'Signé Orange Pro'
    ).length;
    const grandCompteContracts = mySignedContracts.filter(
      (c) => c.tier === 'Grand Compte'
    ).length;
    const pmeContracts = mySignedContracts.filter((c) => c.tier === 'PME').length;
    const totalPayoutMad = mySignedContracts.reduce((sum, c) => sum + (Number(c.payoutMad) || 0), 0);
    const multiContactFiches = fiches.filter(
      (f) =>
        (f.telephonesSupplementaires?.length || 0) > 0 ||
        (f.emailsSupplementaires?.length || 0) > 0
    ).length;
    const highMaturityFiches = fiches.filter((f) => computeMaturityScore(f) >= 85).length;
    const distinctCities = new Set(
      fiches.map((f) => (f.ville || '').trim().toLowerCase()).filter(Boolean)
    ).size;

    return {
      totalProspects: fiches.length,
      qualifiedCount,
      contractsCount,
      grandCompteContracts,
      pmeContracts,
      totalPayoutMad,
      multiContactFiches,
      highMaturityFiches,
      distinctCities,
    };
  }, [fiches, mySignedContracts]);

  const myAchievementSummary = useMemo(
    () => evaluateAchievements(myCollaboratorMetrics, myTeamStatRecord?.manualBadges || []),
    [myCollaboratorMetrics, myTeamStatRecord]
  );

  const currentUserDisplayName = useMemo(() => {
    if (appUserProfile?.displayName) return appUserProfile.displayName;
    if (cloudUser?.displayName) return cloudUser.displayName;
    if (cloudUser?.email) return cloudUser.email.split('@')[0];
    return 'Collaborateur';
  }, [appUserProfile, cloudUser]);

  useEffect(() => {
    if (!cloudUser || !cloudSynced || !canAccessWorkspace) return;
    const uid = cloudUser.uid;
    const role: 'super_admin' | 'manager' | 'commercial' = isSuperAdmin
      ? 'super_admin'
      : appUserProfile?.role === 'manager'
        ? 'manager'
        : 'commercial';
    const zone = appUserProfile?.zone || villesState.defaultVille || 'Meknès';
    const monthlyHistory = buildMonthlyHistoryStrings(mySignedContracts);
    const payload = {
      uid,
      displayName: currentUserDisplayName,
      role,
      zone,
      active: true,
      totalProspects: myCollaboratorMetrics.totalProspects,
      totalQualified: myCollaboratorMetrics.qualifiedCount,
      totalContracts: myCollaboratorMetrics.contractsCount,
      totalPayoutMad: myCollaboratorMetrics.totalPayoutMad,
      xp: myAchievementSummary.totalXp,
      unlockedCount: myAchievementSummary.unlockedCount,
      manualBadges: myTeamStatRecord?.manualBadges || [],
      monthlyHistory,
    };
    const nextHash = serializeDocCanonical(payload as unknown as Record<string, unknown>);
    if (nextHash === lastTeamStatHashRef.current) return;

    const timer = window.setTimeout(() => {
      lastTeamStatHashRef.current = nextHash;
      syncMyTeamStat(uid, payload, isSuperAdmin).catch(() => {
        // Silent retry on next activity change
      });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [
    cloudUser,
    cloudSynced,
    canAccessWorkspace,
    isSuperAdmin,
    appUserProfile,
    villesState.defaultVille,
    currentUserDisplayName,
    myCollaboratorMetrics,
    myAchievementSummary,
    mySignedContracts,
    myTeamStatRecord,
  ]);

  const handleGoogleSignOut = async () => {
    try {
      await signOutUser();
      setActiveTab('portefeuille');
      notify('Session fermée en toute sécurité.');
    } catch {
      notify('Erreur lors de la déconnexion.', 'err');
    }
  };

  // Helper mise à jour statut d'une clé dans le Hub API (rotation temps réel)
  const updateApiKeyStatus: KeyStatusUpdater = (id, status, message) => {
    setApiKeys((prev) => {
      const next = prev.map((k) => (k.id === id ? { ...k, status, statusMessage: message } : k));
      apiKeysRef.current = next;
      return next;
    });
  };

  // Gestion CRUD Hub API Multi-Fournisseurs
  const handleProviderSelectChange = (p: ApiProvider) => {
    setNewKeyProvider(p);
    setNewKeyModel(PROVIDER_META[p].defaultModel);
    setNewKeyScope(PROVIDER_META[p].defaultScope);
  };

  const handleAddApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    const secret = newKeySecret.trim();
    if (!secret) {
      notify('Renseigne une clé API valide avant de l’ajouter.', 'warn');
      return;
    }
    const existingSameProvider = apiKeys.filter((k) => k.provider === newKeyProvider).length;
    const label = newKeyLabel.trim() || `${PROVIDER_META[newKeyProvider].name} #${existingSameProvider + 1}`;
    const maxPrio = apiKeys.reduce((acc, k) => Math.max(acc, k.priority), 0);
    const entry: ApiKeyEntry = {
      id: makeId('key'),
      provider: newKeyProvider,
      label,
      apiKey: secret,
      model: newKeyModel.trim() || PROVIDER_META[newKeyProvider].defaultModel,
      taskScope: newKeyScope,
      priority: maxPrio + 1,
      enabled: true,
      status: 'idle',
      statusMessage: 'Prête',
    };
    setApiKeys((prev) => [...prev, entry]);
    setNewKeyLabel('');
    setNewKeySecret('');
    notify(`Clé « ${label} » ajoutée au Hub API (P${entry.priority}).`);
  };

  const handleMoveKeyPriority = (id: string, dir: -1 | 1) => {
    setApiKeys((prev) => {
      const sorted = [...prev].sort((a, b) => a.priority - b.priority);
      const idx = sorted.findIndex((k) => k.id === id);
      if (idx === -1) return prev;
      const targetIdx = idx + dir;
      if (targetIdx < 0 || targetIdx >= sorted.length) return prev;
      const copy = [...sorted];
      const temp = copy[idx];
      copy[idx] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy.map((k, i) => ({ ...k, priority: i + 1 }));
    });
  };

  const handleToggleApiKey = (id: string) => {
    setApiKeys((prev) =>
      prev.map((k) =>
        k.id === id
          ? { ...k, enabled: !k.enabled, status: !k.enabled && k.status === 'quota' ? 'idle' : k.status }
          : k
      )
    );
  };

  const handleDeleteApiKey = (id: string) => {
    setApiKeys((prev) =>
      prev
        .filter((k) => k.id !== id)
        .sort((a, b) => a.priority - b.priority)
        .map((k, i) => ({ ...k, priority: i + 1 }))
    );
    notify('Clé supprimée du Hub API.');
  };

  const handleClearAllApiKeys = () => {
    setApiKeys([]);
    setConfirmClearHub(false);
    try {
      window.localStorage.removeItem(STORAGE_KEY_API_HUB);
    } catch {
      // ignore
    }
    notify('Toutes les clés du Hub API ont été effacées de ce navigateur.');
  };

  const handleTestApiKey = async (entry: ApiKeyEntry) => {
    setTestingKeyId(entry.id);
    try {
      const res = await testApiKeyEntry(entry);
      updateApiKeyStatus(entry.id, res.status, res.msg);
      notify(`${entry.label} : ${res.msg}`, res.ok ? 'ok' : res.status === 'quota' ? 'warn' : 'err');
    } finally {
      setTestingKeyId(null);
    }
  };

  const handleResetQuotaFlags = () => {
    setApiKeys((prev) => prev.map((k) => ({ ...k, status: 'idle', statusMessage: 'Réinitialisée' })));
    notify('Statuts de quota réinitialisés pour toutes les clés.');
  };

  const copyTextSafe = async (txt: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(txt);
        return true;
      }
    } catch {
      // fallback below
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  };

  // Extraction réactive temps réel dans Onglet 3
  useEffect(() => {
    if (!pasteInput.trim()) {
      setPastePreview([]);
      setPasteIgnoredPhones([]);
      return;
    }
    const isCsvOrJson =
      pasteInput.trim().startsWith('[') ||
      pasteInput.trim().startsWith('{') ||
      /^(societe|company|entreprise)[;,]/i.test(pasteInput.trim().replace(/^\uFEFF/, ''));

    if (isCsvOrJson) {
      const parsed = postExtractionCleanup(
        parseCsvOrJsonImport(pasteInput, activeVilles),
        activeVilles,
        modeVille,
        defaultVille
      );
      setPastePreview(parsed);
      setPasteIgnoredPhones([]);
    } else {
      const { fiches: extracted, ignoredCallCenterPhones } = parseRawInputToFiches(
        pasteInput,
        pasteSource,
        activeVilles,
        modeVille,
        defaultVille
      );
      setPastePreview(extracted);
      setPasteIgnoredPhones(ignoredCallCenterPhones);
    }
  }, [pasteInput, pasteSource, activeVilles, modeVille, defaultVille]);

  // Pour les collaborateurs non-admin, les fiches signées sont automatiquement verrouillées et masquées du portefeuille
  const accessibleFiches = useMemo(
    () => (isSuperAdmin ? fiches : fiches.filter((f) => f.statut !== 'Signé Orange Pro')),
    [fiches, isSuperAdmin]
  );

  // Données dérivées : doublons (priorité stricte au nom de société), KPIs, filtres
  const allDetectedDuplicateGroups = useMemo(
    () => findDuplicateGroups(accessibleFiches, { includePhoneOnly: includePhoneOnlyDedup }),
    [accessibleFiches, includePhoneOnlyDedup]
  );
  const duplicateGroups = useMemo(
    () =>
      allDetectedDuplicateGroups.filter((g) => {
        const signature = [...g.ids].sort().join('|');
        return !dismissedDedupKeys.includes(signature);
      }),
    [allDetectedDuplicateGroups, dismissedDedupKeys]
  );
  const duplicateIdSet = useMemo(() => {
    const s = new Set<string>();
    duplicateGroups.forEach((g) => g.ids.forEach((id) => s.add(id)));
    return s;
  }, [duplicateGroups]);

  const kpiByColor = useMemo(() => {
    const map: Record<SegmentCouleur, number> = { bleu: 0, vert: 0, orange: 0, jaune: 0, violet: 0, cyan: 0 };
    accessibleFiches.forEach((f) => {
      const col = SECTEURS_META[f.secteur]?.couleur || 'violet';
      map[col]++;
    });
    return map;
  }, [accessibleFiches]);

  const kpiByStatut = useMemo(() => {
    const map: Record<StatutCRM, number> = {
      'À contacter': 0,
      'Appel en cours': 0,
      'RDV pris': 0,
      'Devis envoyé': 0,
      'Signé Orange Pro': 0,
      'Pas intéressé': 0,
    };
    fiches.forEach((f) => {
      map[f.statut] = (map[f.statut] || 0) + 1;
    });
    return map;
  }, [fiches]);

  const availableVillesInData = useMemo(() => {
    const set = new Set<string>();
    fiches.forEach((f) => {
      if (f.ville.trim()) set.add(f.ville.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [fiches]);

  const availableSourcesInData = useMemo(() => {
    const set = new Set<string>();
    fiches.forEach((f) => {
      const s = f.source.trim();
      if (!s) return;
      if (/^https?:\/\//i.test(s)) {
        try {
          set.add(new URL(s).hostname.replace(/^www\./, ''));
          return;
        } catch {
          // fallback raw
        }
      }
      set.add(s.slice(0, 32));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [fiches]);

  const hasActiveFilters = Boolean(
    search.trim() ||
      couleurFilter ||
      secteurFilter ||
      villeFilter ||
      tierFilter ||
      effectifFilter ||
      completudeFilter ||
      sourceFilter ||
      statutFilter ||
      onlyReadyToCall
  );

  const resetAllFilters = () => {
    setSearch('');
    setCouleurFilter('');
    setSecteurFilter('');
    setVilleFilter('');
    setTierFilter('');
    setEffectifFilter('');
    setCompletudeFilter('');
    setSourceFilter('');
    setStatutFilter('');
    setOnlyReadyToCall(false);
  };

  const filteredFiches = useMemo(() => {
    const q = stripAccents(search);
    const list = accessibleFiches.filter((f) => {
      if (couleurFilter && SECTEURS_META[f.secteur]?.couleur !== couleurFilter) return false;
      if (secteurFilter && f.secteur !== secteurFilter) return false;
      if (villeFilter && stripAccents(f.ville) !== stripAccents(villeFilter)) return false;
      if (statutFilter && f.statut !== statutFilter) return false;
      if (tierFilter && getOrangeProRecommendation(f).tier !== tierFilter) return false;

      if (effectifFilter) {
        const eff = parseInt(f.effectif, 10) || 0;
        if (effectifFilter === 'vide' && eff > 0) return false;
        if (effectifFilter === 'tpe' && (eff <= 0 || eff >= 10)) return false;
        if (effectifFilter === 'pme' && (eff < 10 || eff >= 30)) return false;
        if (effectifFilter === 'gc' && eff < 30) return false;
      }

      if (completudeFilter) {
        if (completudeFilter === 'ready' && !isReadyToCall(f)) return false;
        if (completudeFilter === 'has_phone' && !f.telephone) return false;
        if (completudeFilter === 'no_phone' && Boolean(f.telephone)) return false;
        if (completudeFilter === 'has_email' && !f.email) return false;
        if (completudeFilter === 'no_email' && Boolean(f.email)) return false;
        if (completudeFilter === 'has_contact' && !f.contact) return false;
        if (completudeFilter === 'no_contact' && Boolean(f.contact)) return false;
        if (completudeFilter === 'incomplete' && Boolean(f.telephone && f.email && f.contact)) return false;
        if (completudeFilter === 'verified' && !f.verifieWeb) return false;
        if (completudeFilter === 'unverified' && Boolean(f.verifieWeb)) return false;
      }

      if (sourceFilter && !stripAccents(f.source).includes(stripAccents(sourceFilter))) return false;
      if (onlyReadyToCall && !isReadyToCall(f)) return false;

      if (q) {
        const hay = stripAccents(
          `${f.numeroFiche || ''} ${f.societe} ${f.secteur} ${SECTEURS_META[f.secteur]?.label} ${f.ville} ${f.telephone} ${(f.telephonesSupplementaires || []).join(' ')} ${f.email} ${(f.emailsSupplementaires || []).join(' ')} ${f.contact} ${f.role} ${f.source}`
        );
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'societe') cmp = a.societe.localeCompare(b.societe);
      else if (sortField === 'ville') cmp = a.ville.localeCompare(b.ville);
      else if (sortField === 'effectif') cmp = (parseInt(a.effectif, 10) || 0) - (parseInt(b.effectif, 10) || 0);
      else cmp = computeMaturityScore(a) - computeMaturityScore(b);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [
    accessibleFiches, search, couleurFilter, secteurFilter, villeFilter, tierFilter,
    effectifFilter, completudeFilter, sourceFilter, statutFilter, onlyReadyToCall,
    sortField, sortDir,
  ]);

  const incompleteFilteredFiches = useMemo(
    () => filteredFiches.filter((f) => !f.telephone || !f.email || !f.contact || !f.effectif),
    [filteredFiches]
  );

  // ============================================================================
  // MOTEUR D'ENRICHISSEMENT 7 PISTES EN PARALLÈLE + PHASE 2 SUIVI PROFOND
  // ============================================================================

  const enrichFicheMultiPistes = async (
    f: FicheEntreprise,
    parentSignal: AbortSignal
  ): Promise<{ patch: Partial<FicheEntreprise>; pistes: string[]; secteurCorrige: boolean }> => {
    const localController = new AbortController();
    const onParentAbort = () => localController.abort();
    parentSignal.addEventListener('abort', onParentAbort, { once: true });

    const patch: Partial<FicheEntreprise> = {};
    const pistesSet = new Set<string>();
    const discoveredUrls = new Set<string>();
    let secteurCorrige = false;

    const isCompleteNow = () =>
      Boolean(
        (f.telephone || patch.telephone) &&
          (f.email || patch.email) &&
          (f.contact || patch.contact) &&
          (f.effectif || patch.effectif)
      );

    const checkEarlyStop = () => {
      if (isCompleteNow()) localController.abort();
    };

    const mergeTextIntoPatch = (rawText: string, pisteLabel: string, isDedicatedPage: boolean) => {
      if (!rawText || rawText.length < 40) return;
      const readable = htmlToReadableText(rawText);
      const focused = isDedicatedPage ? readable : extractRelevantWindows(readable, f.societe);
      if (!focused) return;

      let foundSomething = false;

      if (!f.telephone && !patch.telephone) {
        const phones = extractPhonesFromReadableText(focused);
        if (phones[0]) {
          patch.telephone = phones[0];
          foundSomething = true;
        }
      }
      if (!f.email && !patch.email) {
        const bestE = extractBestEmailFromText(focused, f.societe);
        if (bestE) {
          patch.email = bestE;
          foundSomething = true;
        }
      }
      if (!f.contact && !patch.contact) {
        const dec = extractDecideurFromText(focused, f.email || patch.email || '');
        if (dec.contact) {
          patch.contact = dec.contact;
          if (!f.role && !patch.role && dec.role) patch.role = dec.role;
          foundSomething = true;
        }
      }
      if (!f.effectif && !patch.effectif) {
        const eff = extractEffectifFromText(focused);
        if (eff) {
          patch.effectif = eff;
          foundSomething = true;
        }
      }

      const rawUrls = rawText.match(/https?:\/\/(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s"'<>)]*)?/gi) || [];
      const companyTokens = stripAccents(f.societe)
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 4 && !['sarl', 'societe', 'cabinet', 'maroc', 'groupe', 'centre'].includes(t));

      for (const rawU of rawUrls) {
        const u = rawU.replace(/[.,;)]+$/, '');
        if (/(google\.|duckduckgo\.|bing\.|microsoft\.|w3\.org|schema\.org|facebook\.|instagram\.|youtube\.|wikipedia\.|allorigins\.|corsproxy\.|jina\.ai|cloudflare\.|fonts\.|gstatic\.)/i.test(u)) {
          continue;
        }
        const normU = stripAccents(u);
        const matchesCompany = companyTokens.some((t) => normU.includes(t));
        const isDirDetail = /(telecontact\.ma\/(annonceur|professionnel)|kerix\.net\/fr\/annuaire-entreprise\/[^?]+\.html)/i.test(u);
        if (matchesCompany && !/(telecontact\.|kerix\.|linkedin\.)/i.test(u)) {
          if (!f.siteWeb && !patch.siteWeb) {
            patch.siteWeb = u;
            foundSomething = true;
          }
          discoveredUrls.add(u);
        } else if (isDirDetail && matchesCompany) {
          discoveredUrls.add(u);
        }
      }

      if (foundSomething) {
        pistesSet.add(pisteLabel);
        checkEarlyStop();
      }
    };

    const applyStructuredJsonPatch = (rawJsonText: string, pisteLabel: string) => {
      const jm = rawJsonText.match(/\{[\s\S]*\}/);
      if (!jm) return;
      try {
        const parsed = JSON.parse(jm[0]);
        let hit = false;
        const incomingPhones: string[] = [];
        if (parsed.telephone) incomingPhones.push(String(parsed.telephone));
        if (Array.isArray(parsed.telephones)) {
          parsed.telephones.forEach((p: unknown) => incomingPhones.push(String(p || '')));
        }
        if (incomingPhones.length > 0) {
          const mp = mergeMultiPhones(
            patch.telephone || f.telephone,
            patch.telephonesSupplementaires || f.telephonesSupplementaires,
            incomingPhones
          );
          if (mp.addedCount > 0) {
            patch.telephone = mp.primary;
            if (mp.extras.length > 0) patch.telephonesSupplementaires = mp.extras;
            hit = true;
          }
        }
        const incomingEmails: string[] = [];
        if (parsed.email) incomingEmails.push(String(parsed.email));
        if (Array.isArray(parsed.emails)) {
          parsed.emails.forEach((em: unknown) => incomingEmails.push(String(em || '')));
        }
        if (incomingEmails.length > 0) {
          const me = mergeMultiEmails(
            patch.email || f.email,
            patch.emailsSupplementaires || f.emailsSupplementaires,
            incomingEmails
          );
          if (me.addedCount > 0) {
            patch.email = me.primary;
            if (me.extras.length > 0) patch.emailsSupplementaires = me.extras;
            hit = true;
          }
        }
        if (!f.contact && !patch.contact && parsed.contact && isPlausiblePersonName(String(parsed.contact))) {
          patch.contact = String(parsed.contact).trim();
          hit = true;
        }
        if (!f.role && !patch.role && parsed.role) {
          patch.role = String(parsed.role).trim();
          hit = true;
        }
        if (!f.effectif && !patch.effectif && parsed.effectif) {
          const n = parseInt(String(parsed.effectif).replace(/\D/g, ''), 10);
          if (n > 0) { patch.effectif = String(n); hit = true; }
        }
        if (!f.siteWeb && !patch.siteWeb && parsed.siteWeb && /^https?:\/\//i.test(String(parsed.siteWeb))) {
          patch.siteWeb = String(parsed.siteWeb).trim();
          discoveredUrls.add(patch.siteWeb);
          hit = true;
        }
        if (
          parsed.secteur &&
          (Object.keys(SECTEURS_META) as SecteurCode[]).includes(parsed.secteur) &&
          parsed.secteur !== f.secteur
        ) {
          patch.secteur = parsed.secteur as SecteurCode;
          secteurCorrige = true;
          hit = true;
        }
        if (hit) {
          pistesSet.add(pisteLabel);
          checkEarlyStop();
        }
      } catch {
        // Ignore invalid JSON
      }
    };

    try {
      const tasks: Promise<void>[] = [];
      const villeCible = f.ville || 'Meknès';
      const currentKeys = apiKeysRef.current;

      // Piste 0 : Pool Tavily Search (2 recherches ciblées en parallèle) + Extraction déterministe + Affinage LLM (extract)
      const activeTavily = getOrderedKeysForTask(currentKeys, 'search', { onlyProvider: 'tavily' });
      if (activeTavily.length > 0) {
        tasks.push(
          (async () => {
            const [resContact, resDecideur] = await Promise.all([
              callTavilySearchPool(
                apiKeysRef.current,
                `"${f.societe}" "${villeCible}" Maroc telephone email site officiel`,
                localController.signal,
                updateApiKeyStatus
              ),
              callTavilySearchPool(
                apiKeysRef.current,
                `"${f.societe}" "${villeCible}" Maroc gérant OR directeur OR fondateur LinkedIn`,
                localController.signal,
                updateApiKeyStatus
              ),
            ]);
            const combined = [resContact.combinedText, resDecideur.combinedText].filter(Boolean).join('\n\n');
            [...resContact.urls, ...resDecideur.urls].forEach((u) => {
              if (!/(linkedin\.|facebook\.|instagram\.)/i.test(u)) discoveredUrls.add(u);
            });
            if (combined) {
              mergeTextIntoPatch(combined, 'Tavily Search', false);
              // Affinage sémantique via Routeur LLM (tâche extract) si des champs manquent encore
              if (!localController.signal.aborted && !isCompleteNow() && getOrderedKeysForTask(apiKeysRef.current, 'extract').length > 0) {
                const extractPrompt = `Extrais UNIQUEMENT les données factuelles présentes dans les extraits web ci-dessous pour l'entreprise marocaine exacte "${f.societe}" à "${villeCible}". Ne rien inventer, laisser "" si absent.
Réponds UNIQUEMENT en JSON strict : {"telephone":"","email":"","contact":"","role":"","effectif":"","siteWeb":"","secteur":""}
Secteurs autorisés : ${Object.keys(SECTEURS_META).join(',')}
Extraits web :
${combined.slice(0, 4500)}`;
                const llmRes = await callRouterLLM(apiKeysRef.current, 'extract', extractPrompt, localController.signal, updateApiKeyStatus);
                if (llmRes.ok && llmRes.text) {
                  applyStructuredJsonPatch(llmRes.text, `Tavily + ${llmRes.providerLabel}`);
                }
              }
            }
          })().catch(() => {})
        );
      }

      // Piste 1 : Pool Gemini Google Search Grounding (rotation multi-clés)
      const activeGemini = getOrderedKeysForTask(currentKeys, 'search', { onlyProvider: 'gemini' });
      if (activeGemini.length > 0) {
        tasks.push(
          (async () => {
            const gAbort = new AbortController();
            const onStop = () => gAbort.abort();
            localController.signal.addEventListener('abort', onStop, { once: true });
            const timer = setTimeout(() => gAbort.abort(), 8000);
            try {
              const prompt = `Tu es un enquêteur B2B au Maroc. Fais une recherche Google approfondie (Google Maps, site officiel, LinkedIn Maroc, Telecontact.ma, Kerix.net, DirectInfo) pour l'entreprise exacte :
Nom : "${f.societe}"
Ville : "${villeCible}", Maroc
Secteur actuel : "${SECTEURS_META[f.secteur].label}"

Trouve UNIQUEMENT des données réelles et vérifiées (ne rien inventer, laisser "" si introuvable) :
- telephone : format 05XXXXXXXX, 06XXXXXXXX ou 07XXXXXXXX
- email : email professionnel officiel
- contact : nom complet du décideur (Gérant, DG, Fondateur, Associé, Dr, Me, Arch)
- role : fonction exacte du décideur
- effectif : nombre entier si connu, sinon ""
- siteWeb : URL officielle https://... si connue
- secteur : code exact parmi ${Object.keys(SECTEURS_META).join(',')}

Réponds UNIQUEMENT en JSON strict : {"telephone":"","email":"","contact":"","role":"","effectif":"","siteWeb":"","secteur":""}`;
              const gRes = await callGeminiGroundingPool(apiKeysRef.current, prompt, gAbort.signal, updateApiKeyStatus);
              if (gRes.ok) {
                gRes.chunkUrls.forEach((u) => discoveredUrls.add(u));
                applyStructuredJsonPatch(gRes.rawText, 'Google Grounding');
              }
            } finally {
              clearTimeout(timer);
              localController.signal.removeEventListener('abort', onStop);
            }
          })().catch(() => {})
        );
      } else if (serverAiStatus.available) {
        // Piste 1 intégrée : Google Search Grounding via Gemini côté serveur (sans clé client requise)
        tasks.push(
          (async () => {
            const res = await fetchTimed(
              '/api/ai/enrich-web',
              localController.signal,
              8500,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  societe: f.societe,
                  ville: villeCible,
                  secteur: SECTEURS_META[f.secteur].label,
                  allowedSecteurs: Object.keys(SECTEURS_META).join(','),
                }),
              }
            );
            if (!res.ok) return;
            const data = await res.json();
            if (Array.isArray(data.sources)) {
              data.sources.forEach((s: { uri?: string }) => {
                if (s?.uri) discoveredUrls.add(s.uri);
              });
            }
            if (data.text) {
              applyStructuredJsonPatch(String(data.text), 'Gemini Intégré (Search)');
            }
          })().catch(() => {})
        );
      }

      // Piste 2 : Site officiel (siteWeb / source) + sous-pages /contact et /a-propos
      const knownSiteUrl = f.siteWeb || (/^https?:\/\//i.test(f.source) ? f.source : '');
      if (knownSiteUrl) {
        tasks.push(
          (async () => {
            const { text } = await fetchFastest(knownSiteUrl, proxyStrategy, localController.signal, 5500);
            mergeTextIntoPatch(text, 'Site Web', true);
            if (!localController.signal.aborted && ((!f.email && !patch.email) || (!f.telephone && !patch.telephone) || (!f.contact && !patch.contact))) {
              try {
                const origin = new URL(knownSiteUrl).origin;
                await Promise.allSettled([
                  fetchFastest(`${origin}/contact`, proxyStrategy, localController.signal, 4200)
                    .then(({ text: cText }) => mergeTextIntoPatch(cText, 'Site /contact', true))
                    .catch(() => {}),
                  fetchFastest(`${origin}/a-propos`, proxyStrategy, localController.signal, 4200)
                    .then(({ text: aText }) => mergeTextIntoPatch(aText, 'Site /a-propos', true))
                    .catch(() => {}),
                ]);
              } catch {
                // ignore invalid origin
              }
            }
          })().catch(() => {})
        );
      }

      // Piste 3 : Recherche Web publique (DuckDuckGo HTML)
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
        `"${f.societe}" "${villeCible}" Maroc telephone OR email OR gérant OR directeur`
      )}`;
      tasks.push(
        fetchFastest(ddgUrl, proxyStrategy, localController.signal, 5500)
          .then(({ text }) => mergeTextIntoPatch(text, 'DuckDuckGo', false))
          .catch(() => {})
      );

      // Piste 4 : Annuaire Telecontact Maroc
      const tcUrl = `https://www.telecontact.ma/trouver/index.php?nxo=moteurs&nxs=process&string=${encodeURIComponent(
        f.societe
      )}&ou=${encodeURIComponent(villeCible)}`;
      tasks.push(
        fetchFastest(tcUrl, proxyStrategy, localController.signal, 5500)
          .then(({ text }) => mergeTextIntoPatch(text, 'Telecontact', false))
          .catch(() => {})
      );

      // Piste 5 : Annuaire Kerix Maroc
      const kerixUrl = `https://www.kerix.net/fr/annuaire-entreprise/recherche.html?q=${encodeURIComponent(
        `${f.societe} ${villeCible}`
      )}`;
      tasks.push(
        fetchFastest(kerixUrl, proxyStrategy, localController.signal, 5500)
          .then(({ text }) => mergeTextIntoPatch(text, 'Kerix Maroc', false))
          .catch(() => {})
      );

      // Piste 6 : Recherche Bing via r.jina.ai (sans clé)
      const bingJinaUrl = `https://r.jina.ai/https://www.bing.com/search?q=${encodeURIComponent(
        `"${f.societe}" "${villeCible}" Maroc contact email gérant`
      )}`;
      tasks.push(
        fetchTimed(bingJinaUrl, localController.signal, 5500)
          .then((res) => (res.ok ? res.text() : ''))
          .then((text) => {
            if (text && text.length > 80) mergeTextIntoPatch(text, 'Bing / Jina', false);
          })
          .catch(() => {})
      );

      await Promise.allSettled(tasks);

      // Phase 2 — Suivi profond automatique sur site officiel (/contact) ou fiche annuaire découverte
      if (!localController.signal.aborted && !isCompleteNow() && discoveredUrls.size > 0) {
        const toFollow = Array.from(discoveredUrls)
          .filter((u) => u !== knownSiteUrl)
          .slice(0, 2);

        await Promise.allSettled(
          toFollow.map(async (targetU) => {
            if (localController.signal.aborted) return;
            try {
              const { text } = await fetchFastest(targetU, proxyStrategy, localController.signal, 4500);
              mergeTextIntoPatch(text, 'Site / Fiche suivie', true);
              if (!localController.signal.aborted && ((!f.email && !patch.email) || (!f.telephone && !patch.telephone))) {
                const origin = new URL(targetU).origin;
                if (!/(telecontact\.|kerix\.)/i.test(origin)) {
                  const { text: cText } = await fetchFastest(`${origin}/contact`, proxyStrategy, localController.signal, 3500);
                  mergeTextIntoPatch(cText, 'Site /contact', true);
                }
              }
            } catch {
              // ignore
            }
          })
        );
      }

      if (!f.contact && !patch.contact && (f.email || patch.email)) {
        const fromMail = extractDecideurFromText('', f.email || patch.email || '');
        if (fromMail.contact) {
          patch.contact = fromMail.contact;
          if (!f.role && !patch.role) patch.role = fromMail.role;
          pistesSet.add('Email nominatif');
        }
      }

      return { patch, pistes: Array.from(pistesSet), secteurCorrige };
    } finally {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  };

  // ============================================================================
  // HANDLERS MÉTIER (CRAWLER, AUDIT 8-WORKERS, DEDUP, ASSISTÉ RAFALE, STUDIO EMAIL)
  // ============================================================================

  const pushLog = (level: CrawlLog['level'], message: string) => {
    const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setCrawlLogs((prev) => [{ id: makeId('log'), time, level, message }, ...prev].slice(0, 80));
  };

  const handleStartCrawl = async () => {
    const seedUrls = crawlUrlsInput
      .split(/\r?\n/)
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//i.test(u));

    if (seedUrls.length === 0) {
      notify('Colle au moins une URL valide commençant par https://', 'warn');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsCrawling(true);
    setCrawlPreview([]);
    setCrawlLogs([]);
    setCrawlProgress({ done: 0, total: seedUrls.length, captured: 0 });
    pushLog('info', `Démarrage crawl sur ${seedUrls.length} URL(s) — stratégie ${proxyStrategy}.`);

    const queue = [...seedUrls];
    const visited = new Set<string>();
    const detailQueue: string[] = [];
    const capturedMap = new Map<string, FicheEntreprise>();

    const upsertCaptured = (items: FicheEntreprise[]) => {
      items.forEach((f) => {
        const k = normalizeCompanyForDedup(f.societe) || f.id;
        const prev = capturedMap.get(k);
        capturedMap.set(k, prev ? mergeFicheGroup([prev, f]) : f);
      });
      const arr = Array.from(capturedMap.values());
      setCrawlPreview(arr);
      setCrawlProgress((p) => ({ ...p, captured: arr.length }));
    };

    try {
      let idx = 0;
      while (idx < queue.length) {
        if (controller.signal.aborted) break;
        const url = queue[idx++];
        if (visited.has(url)) continue;
        visited.add(url);

        setCrawlProgress((p) => ({ ...p, done: visited.size, total: Math.max(queue.length, visited.size) }));
        pushLog('info', `Niveau 1 : lecture ${url}`);

        try {
          const { text, usedStrategy } = await fetchFastest(url, proxyStrategy, controller.signal, 6500);
          const { fiches: found, ignoredCallCenterPhones, detailLinks, nextPages } = parseRawInputToFiches(
            text,
            url,
            activeVilles,
            modeVille,
            defaultVille
          );

          pushLog(
            'ok',
            `${found.length} fiche(s) extraites via ${usedStrategy}${
              ignoredCallCenterPhones.length ? ` (${ignoredCallCenterPhones.length} standard(s) annuaire ignorés)` : ''
            }.`
          );
          upsertCaptured(found);

          if (enablePagination && nextPages.length > 0) {
            const expanded = expandPaginationUrls(nextPages, paginationMode, pageStart, pageEnd);
            let addedPages = 0;
            expanded.forEach((pUrl) => {
              if (!visited.has(pUrl) && !queue.includes(pUrl)) {
                queue.push(pUrl);
                addedPages++;
              }
            });
            if (addedPages > 0) pushLog('info', `Pagination détectée : +${addedPages} page(s) ajoutée(s).`);
          }

          if (enableLevel2 && detailLinks.length > 0) {
            detailLinks.forEach((dUrl) => {
              if (!visited.has(dUrl) && !detailQueue.includes(dUrl)) detailQueue.push(dUrl);
            });
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          pushLog('err', `Erreur sur ${url} : ${msg}`);
        }
      }

      if (enableLevel2 && detailQueue.length > 0 && !controller.signal.aborted) {
        pushLog('info', `Niveau 2 : exploration de ${detailQueue.length} fiche(s) détail par lots parallèles de 3.`);
        const totalAll = visited.size + detailQueue.length;
        for (let i = 0; i < detailQueue.length; i += 3) {
          if (controller.signal.aborted) break;
          const batch = detailQueue.slice(i, i + 3);
          await Promise.all(
            batch.map(async (dUrl) => {
              if (controller.signal.aborted) return;
              try {
                const { text } = await fetchFastest(dUrl, proxyStrategy, controller.signal, 5500);
                const { fiches: found } = parseRawInputToFiches(text, dUrl, activeVilles, modeVille, defaultVille);
                if (found.length > 0) upsertCaptured(found);
              } catch {
                // ignore individual detail failure
              } finally {
                visited.add(dUrl);
                setCrawlProgress((p) => ({ ...p, done: visited.size, total: totalAll }));
              }
            })
          );
        }
      }

      pushLog(
        'ok',
        controller.signal.aborted
          ? `Crawl interrompu proprement. ${capturedMap.size} fiche(s) conservées.`
          : `Crawl terminé : ${capturedMap.size} fiche(s) prêtes à intégrer.`
      );
    } finally {
      setIsCrawling(false);
      abortRef.current = null;
    }
  };

  const handleStopCrawl = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      pushLog('warn', 'Arrêt demandé — conservation des fiches déjà extraites.');
    }
  };

  const handleCommitCaptured = (items: FicheEntreprise[], sourceLabel: string) => {
    if (items.length === 0) return;
    setFiches((prev) => ensureUniqueNumeroFiches([...items, ...prev]));
    notify(`${items.length} fiche(s) importées dans le portefeuille (${sourceLabel}).`);
    setActiveTab('portefeuille');
  };

  const handleStopAudit = () => {
    if (auditAbortRef.current) auditAbortRef.current.abort();
  };

  const handleBatchAudit = async (target: 'portfolio' | 'crawlPreview' | 'pastePreview') => {
    const sourceRows = target === 'portfolio' ? fiches : target === 'crawlPreview' ? crawlPreview : pastePreview;
    if (sourceRows.length === 0) {
      notify('Aucune fiche à vérifier.', 'warn');
      return;
    }

    const controller = new AbortController();
    auditAbortRef.current = controller;
    setIsAuditing(true);
    setAuditProgress({
      done: 0,
      total: sourceRows.length,
      removed: 0,
      secteurs: 0,
      enriched: 0,
      currentName: 'Audit MDM & normalisation des secteurs...',
    });

    const applyUpdate = (rows: FicheEntreprise[]) => {
      if (target === 'portfolio') setFiches(rows);
      else if (target === 'crawlPreview') setCrawlPreview(rows);
      else setPastePreview(rows);
    };

    try {
      const baseRes = await auditAndCleanAllRowsWithAI(sourceRows, apiKeysRef.current, updateApiKeyStatus);
      let enrichedCount = 0;
      const working: FicheEntreprise[] = baseRes.cleaned.map((f) => {
        const next = { ...f };
        if (!next.contact) {
          const dec = extractDecideurFromText(next.societe, next.email);
          if (dec.contact) {
            next.contact = dec.contact;
            if (!next.role && dec.role) next.role = dec.role;
            enrichedCount++;
          }
        }
        return next;
      });

      applyUpdate(working);
      const incompleteIndices = working
        .map((f, i) => ({ f, i }))
        .filter(({ f }) => !f.telephone || !f.email || !f.contact || !f.effectif);

      const totalSteps = Math.max(1, incompleteIndices.length);
      let processed = 0;
      let cursor = 0;
      const CONCURRENCY = 8;

      setAuditProgress({
        done: 0,
        total: totalSteps,
        removed: baseRes.removedCount,
        secteurs: baseRes.correctedSecteurCount,
        enriched: enrichedCount,
        currentName: incompleteIndices.length > 0 ? 'Pool 8 workers — enrichissement 7 pistes...' : 'Terminé',
      });

      const runWorker = async () => {
        while (cursor < incompleteIndices.length && !controller.signal.aborted) {
          const idxPos = cursor++;
          const { f, i } = incompleteIndices[idxPos];
          setAuditProgress((prev) => (prev ? { ...prev, currentName: f.societe } : prev));

          const { patch, pistes, secteurCorrige } = await enrichFicheMultiPistes(f, controller.signal);
          if (secteurCorrige) baseRes.correctedSecteurCount++;

          const hasNew = Object.values(patch).some((v) => Boolean(v));
          if (hasNew) {
            working[i] = {
              ...working[i],
              ...patch,
              verifieWeb: true,
              pistesEnrichissement: Array.from(new Set([...(working[i].pistesEnrichissement || []), ...pistes])),
            };
            enrichedCount++;
            applyUpdate([...working]);
          }
          processed++;
          setAuditProgress({
            done: processed,
            total: totalSteps,
            removed: baseRes.removedCount,
            secteurs: baseRes.correctedSecteurCount,
            enriched: enrichedCount,
            currentName: f.societe,
          });
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, incompleteIndices.length) }, () => runWorker())
      );

      notify(
        `Vérification terminée : ${enrichedCount} complétée(s), ${baseRes.correctedSecteurCount} secteur(s) corrigé(s), ${baseRes.removedCount} parasite(s) retiré(s).`
      );
    } finally {
      setIsAuditing(false);
      setAuditProgress(null);
      auditAbortRef.current = null;
    }
  };

  const handleVerifyWeb = async (f: FicheEntreprise) => {
    setVerifyingId(f.id);
    const controller = new AbortController();
    try {
      const { patch, pistes } = await enrichFicheMultiPistes(f, controller.signal);
      if (Object.keys(patch).length > 0) {
        setFiches((prev) =>
          prev.map((item) =>
            item.id === f.id
              ? {
                  ...item,
                  ...patch,
                  verifieWeb: true,
                  pistesEnrichissement: Array.from(new Set([...(item.pistesEnrichissement || []), ...pistes])),
                }
              : item
          )
        );
        notify(`${f.societe} enrichie via ${pistes.join(' + ')}.`);
      } else {
        setFiches((prev) => prev.map((item) => (item.id === f.id ? { ...item, verifieWeb: true } : item)));
        setAssistModalFiche(f);
        setAssistPasteText('');
        if (activeApiCount === 0) {
          setLastVerifyDiag(
            'Aucune clé active dans le Hub API et proxies publics limités. Utilise les 4 pistes rapides + Ctrl+V ci-dessous, ou ajoute une clé Tavily / Gemini dans le Hub API.'
          );
          notify('Enrichissement Assisté ouvert (mode rapide sans clé API).', 'warn');
        } else {
          setLastVerifyDiag(`Aucune nouvelle coordonnée automatique pour ${f.societe}. Utilise les liens directs ci-dessous.`);
          notify(`Aucune donnée auto pour ${f.societe} — mode Assisté ouvert.`, 'warn');
        }
      }
    } catch {
      notify(`Impossible de joindre les pistes web pour ${f.societe}.`, 'err');
    } finally {
      setVerifyingId(null);
    }
  };

  const assistLivePreview = useMemo(() => {
    if (!assistModalFiche || !assistPasteText.trim()) return null;
    return extractAllFromAssistedPaste(assistPasteText, assistModalFiche.societe);
  }, [assistModalFiche, assistPasteText]);

  const applyExtractedDataToAssistFiche = (
    extracted: {
      phones: string[];
      emails: string[];
      contact?: string;
      role?: string;
      effectif?: string;
      siteWeb?: string;
      secteur?: string;
      ville?: string;
    },
    sourceTag: string,
    rawForSecteur = ''
  ) => {
    if (!assistModalFiche) return;
    const patch: Partial<FicheEntreprise> = {};
    const foundLabels: string[] = [];

    const mergedPhones = mergeMultiPhones(
      assistModalFiche.telephone,
      assistModalFiche.telephonesSupplementaires,
      extracted.phones
    );
    if (mergedPhones.addedCount > 0) {
      patch.telephone = mergedPhones.primary;
      patch.telephonesSupplementaires = mergedPhones.extras;
      foundLabels.push(
        mergedPhones.addedCount === 1 ? '1 téléphone' : `${mergedPhones.addedCount} téléphones`
      );
    }

    const mergedEmails = mergeMultiEmails(
      assistModalFiche.email,
      assistModalFiche.emailsSupplementaires,
      extracted.emails
    );
    if (mergedEmails.addedCount > 0) {
      patch.email = mergedEmails.primary;
      patch.emailsSupplementaires = mergedEmails.extras;
      foundLabels.push(
        mergedEmails.addedCount === 1 ? '1 email' : `${mergedEmails.addedCount} emails`
      );
    }

    if (!assistModalFiche.contact && extracted.contact?.trim()) {
      patch.contact = extracted.contact.trim();
      foundLabels.push('décideur');
    }
    if (!assistModalFiche.role && extracted.role?.trim()) {
      patch.role = extracted.role.trim();
      foundLabels.push('rôle');
    }
    if (!assistModalFiche.effectif && extracted.effectif?.trim()) {
      const cleanEff = String(parseInt(extracted.effectif.replace(/\D/g, ''), 10) || '');
      if (cleanEff) {
        patch.effectif = cleanEff;
        foundLabels.push('effectif');
      }
    }
    if (!assistModalFiche.siteWeb && extracted.siteWeb?.trim()) {
      patch.siteWeb = extracted.siteWeb.trim();
      foundLabels.push('site web');
    }
    if (!assistModalFiche.ville && extracted.ville?.trim()) {
      patch.ville = extracted.ville.trim();
      foundLabels.push('ville');
    }

    if (extracted.secteur && (extracted.secteur as SecteurCode) in SECTEURS_META && extracted.secteur !== assistModalFiche.secteur) {
      patch.secteur = extracted.secteur as SecteurCode;
      foundLabels.push(`secteur → ${SECTEURS_META[patch.secteur].label}`);
    } else if (rawForSecteur) {
      const inferredSec = inferSecteur(
        `${assistModalFiche.societe} ${rawForSecteur.slice(0, 600)}`,
        assistModalFiche.secteur,
        patch.email || assistModalFiche.email
      );
      if (inferredSec !== assistModalFiche.secteur) {
        patch.secteur = inferredSec;
        foundLabels.push(`secteur → ${SECTEURS_META[inferredSec].label}`);
      }
    }

    if (foundLabels.length === 0) {
      notify(
        'Aucune nouvelle coordonnée inédite détectée (tous les numéros/emails trouvés sont déjà enregistrés ou absents du texte).',
        'warn'
      );
      return;
    }

    const updatedFiche: FicheEntreprise = {
      ...assistModalFiche,
      ...patch,
      verifieWeb: true,
      pistesEnrichissement: Array.from(
        new Set([...(assistModalFiche.pistesEnrichissement || []), sourceTag])
      ),
    };

    setFiches((prev) => prev.map((item) => (item.id === assistModalFiche.id ? updatedFiche : item)));
    setAssistModalFiche(updatedFiche);
    setAssistPasteText('');
    notify(`${assistModalFiche.societe} enrichie (${sourceTag}) : ${foundLabels.join(', ')}.`);
  };

  const handleAssistPasteEvent = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const plain = e.clipboardData.getData('text/plain') || '';
    const html = e.clipboardData.getData('text/html') || '';
    const htmlLinks: string[] = [];
    if (html) {
      const linkMatches = html.match(/href=["'](?:tel|mailto):([^"']+)["']/gi) || [];
      for (const m of linkMatches) {
        const val = m.replace(/^href=["'](?:tel|mailto):/i, '').replace(/["']$/, '').trim();
        if (val && !plain.includes(val)) htmlLinks.push(val);
      }
    }
    const combined = [plain, htmlLinks.length > 0 ? htmlLinks.join(' ') : ''].filter(Boolean).join('\n').trim();
    if (!combined && html) {
      e.preventDefault();
      const fallbackText = htmlToReadableText(html);
      setAssistPasteText((prev) => (prev ? `${prev}\n${fallbackText}` : fallbackText));
      return;
    }
    if (htmlLinks.length > 0) {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart ?? assistPasteText.length;
      const end = target.selectionEnd ?? assistPasteText.length;
      const next = `${assistPasteText.slice(0, start)}${combined}${assistPasteText.slice(end)}`;
      setAssistPasteText(next);
    }
  };

  const handleAssistClipboardRead = async () => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        const clip = await navigator.clipboard.readText();
        if (clip.trim()) {
          setAssistPasteText((prev) => (prev.trim() ? `${prev.trim()}\n${clip.trim()}` : clip.trim()));
          notify('Contenu du presse-papiers collé dans la zone d’extraction.');
          return;
        }
        notify('Le presse-papiers est vide.', 'warn');
        return;
      }
    } catch {
      // Clipboard API may be blocked in sandboxed iframe — guide user cleanly
    }
    const el = document.getElementById('assist-paste');
    if (el) el.focus();
    notify('Zone sélectionnée : appuyez sur Ctrl+V (ou Cmd+V) pour coller.', 'warn');
  };

  const handleApplyAssistedPaste = () => {
    if (!assistModalFiche || !assistPasteText.trim()) {
      notify('Colle d’abord le texte copié depuis Google (Aperçu IA, Maps), LinkedIn ou un annuaire.', 'warn');
      return;
    }
    const extracted = extractAllFromAssistedPaste(assistPasteText, assistModalFiche.societe);
    applyExtractedDataToAssistFiche(extracted, 'Assisté / Google IA', assistPasteText);
  };

  const handleAssistAiParse = async () => {
    if (!assistModalFiche || !assistPasteText.trim()) {
      notify('Colle d’abord un texte (ex. Aperçu IA Google, LinkedIn) avant de lancer l’extraction Gemini.', 'warn');
      return;
    }
    setAssistAiLoading(true);
    setAssistAiSummary('');
    try {
      const res = await fetch('/api/ai/parse-paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: assistPasteText,
          societe: assistModalFiche.societe,
          ville: assistModalFiche.ville,
          secteur: assistModalFiche.secteur,
          allowedSecteurs: Object.keys(SECTEURS_META).join(','),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data?.error || 'Extraction IA indisponible — bascule sur l’extracteur local.', 'warn');
        handleApplyAssistedPaste();
        return;
      }
      const ex = data.extracted || {};
      const localEx = extractAllFromAssistedPaste(assistPasteText, assistModalFiche.societe);
      const allPhones = Array.from(new Set([...(Array.isArray(ex.telephones) ? ex.telephones : []), ...localEx.phones]));
      const allEmails = Array.from(new Set([...(Array.isArray(ex.emails) ? ex.emails : []), ...localEx.emails]));
      if (ex.resume) setAssistAiSummary(String(ex.resume));
      applyExtractedDataToAssistFiche(
        {
          phones: allPhones,
          emails: allEmails,
          contact: ex.contact || localEx.contact,
          role: ex.role || localEx.role,
          effectif: ex.effectif || localEx.effectif,
          siteWeb: ex.siteWeb || localEx.siteWeb,
          secteur: ex.secteur || '',
          ville: ex.ville || '',
        },
        'Gemini Paste IA',
        assistPasteText
      );
    } catch {
      notify('Erreur réseau Gemini — extraction locale appliquée.', 'warn');
      handleApplyAssistedPaste();
    } finally {
      setAssistAiLoading(false);
    }
  };

  const handleAssistAiWebSearch = async () => {
    if (!assistModalFiche) return;
    setAssistAiLoading(true);
    setAssistAiSummary('');
    try {
      const res = await fetch('/api/ai/enrich-web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          societe: assistModalFiche.societe,
          ville: assistModalFiche.ville || defaultVille,
          secteur: SECTEURS_META[assistModalFiche.secteur].label,
          allowedSecteurs: Object.keys(SECTEURS_META).join(','),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data?.error || 'Recherche IA Google indisponible.', 'warn');
        return;
      }
      const rawText = String(data.text || '');
      const jm = rawText.match(/\{[\s\S]*\}/);
      let parsed: Record<string, unknown> = {};
      if (jm) {
        try {
          parsed = JSON.parse(jm[0]);
        } catch {
          parsed = {};
        }
      }
      const localFromText = extractAllFromAssistedPaste(rawText, assistModalFiche.societe);
      const phones = [
        ...(typeof parsed.telephone === 'string' ? [parsed.telephone] : []),
        ...(Array.isArray(parsed.telephones) ? parsed.telephones.map(String) : []),
        ...localFromText.phones,
      ];
      const emails = [
        ...(typeof parsed.email === 'string' ? [parsed.email] : []),
        ...(Array.isArray(parsed.emails) ? parsed.emails.map(String) : []),
        ...localFromText.emails,
      ];
      const srcCount = Array.isArray(data.sources) ? data.sources.length : 0;
      setAssistAiSummary(
        srcCount > 0
          ? `Recherche Google Search Grounding terminée (${srcCount} source(s) web analysée(s)).`
          : 'Recherche Google IA terminée.'
      );
      applyExtractedDataToAssistFiche(
        {
          phones,
          emails,
          contact: typeof parsed.contact === 'string' ? parsed.contact : localFromText.contact,
          role: typeof parsed.role === 'string' ? parsed.role : localFromText.role,
          effectif: typeof parsed.effectif === 'string' ? parsed.effectif : localFromText.effectif,
          siteWeb: typeof parsed.siteWeb === 'string' ? parsed.siteWeb : localFromText.siteWeb,
          secteur: typeof parsed.secteur === 'string' ? parsed.secteur : '',
        },
        'Google IA Grounding',
        rawText
      );
    } catch {
      notify('Impossible de contacter la recherche Google IA.', 'err');
    } finally {
      setAssistAiLoading(false);
    }
  };

  // Gestion multi-téléphones & multi-emails (inline tableau + modale assistée)
  const addAdditionalContactToFiche = (
    ficheId: string,
    type: 'phone' | 'email',
    rawValue: string
  ): boolean => {
    const target = fiches.find((x) => x.id === ficheId);
    if (!target) return false;
    if (type === 'phone') {
      const extracted = extractAllMoroccanPhones(rawValue);
      const fallback = normalizeMoroccanPhone(rawValue);
      const incoming = extracted.length > 0 ? extracted : fallback ? [fallback] : [];
      if (incoming.length === 0) {
        notify('Numéro marocain invalide (attendu 05/06/07XXXXXXXX ou +212...).', 'warn');
        return false;
      }
      const merged = mergeMultiPhones(target.telephone, target.telephonesSupplementaires, incoming);
      if (merged.addedCount === 0) {
        notify('Ce numéro est déjà présent sur cette fiche.', 'warn');
        return false;
      }
      const nextFiche: FicheEntreprise = {
        ...target,
        telephone: merged.primary,
        telephonesSupplementaires: merged.extras,
      };
      setFiches((prev) => prev.map((x) => (x.id === ficheId ? nextFiche : x)));
      if (assistModalFiche?.id === ficheId) setAssistModalFiche(nextFiche);
      notify(`Numéro ajouté sur ${target.societe}.`);
      return true;
    } else {
      const extracted = extractAllEmails(rawValue, target.societe);
      const fallback = normalizeProEmail(rawValue);
      const incoming = extracted.length > 0 ? extracted : fallback ? [fallback] : [];
      if (incoming.length === 0) {
        notify('Adresse email invalide.', 'warn');
        return false;
      }
      const merged = mergeMultiEmails(target.email, target.emailsSupplementaires, incoming);
      if (merged.addedCount === 0) {
        notify('Cette adresse email est déjà enregistrée sur cette fiche.', 'warn');
        return false;
      }
      const nextFiche: FicheEntreprise = {
        ...target,
        email: merged.primary,
        emailsSupplementaires: merged.extras,
      };
      setFiches((prev) => prev.map((x) => (x.id === ficheId ? nextFiche : x)));
      if (assistModalFiche?.id === ficheId) setAssistModalFiche(nextFiche);
      notify(`Adresse email ajoutée sur ${target.societe}.`);
      return true;
    }
  };

  const removeAdditionalContactFromFiche = (
    ficheId: string,
    type: 'phone' | 'email',
    valueToRemove: string
  ) => {
    setFiches((prev) =>
      prev.map((x) => {
        if (x.id !== ficheId) return x;
        const next: FicheEntreprise =
          type === 'phone'
            ? {
                ...x,
                telephonesSupplementaires: (x.telephonesSupplementaires || []).filter(
                  (p) => p !== valueToRemove
                ),
              }
            : {
                ...x,
                emailsSupplementaires: (x.emailsSupplementaires || []).filter(
                  (e) => e !== valueToRemove
                ),
              };
        if (assistModalFiche?.id === ficheId) setAssistModalFiche(next);
        return next;
      })
    );
  };

  // Mode Rafale : passer directement à la fiche incomplète suivante dans la vue filtrée
  const handleNextIncompleteRafale = () => {
    if (!assistModalFiche || incompleteFilteredFiches.length === 0) {
      notify('Toutes les fiches de la vue filtrée sont complètes.', 'ok');
      setAssistModalFiche(null);
      return;
    }
    const curIdx = incompleteFilteredFiches.findIndex((x) => x.id === assistModalFiche.id);
    const nextItem =
      curIdx === -1
        ? incompleteFilteredFiches[0]
        : incompleteFilteredFiches[(curIdx + 1) % incompleteFilteredFiches.length];
    if (nextItem.id === assistModalFiche.id) {
      notify('C’est la dernière fiche incomplète de la vue filtrée.', 'ok');
      return;
    }
    setAssistModalFiche(nextItem);
    setAssistPasteText('');
    setLastVerifyDiag('');
  };

  // Déduplication MDM
  const handleMergeGroup = (group: DuplicateGroup) => {
    const merged = mergeFicheGroup(group.fiches);
    const idSet = new Set(group.ids);
    setFiches((prev) => [merged, ...prev.filter((f) => !idSet.has(f.id))]);
    notify(`Fusion réussie : ${merged.societe} (${group.fiches.length} fiches réunies).`);
  };

  const handleMergeAllDuplicates = () => {
    if (duplicateGroups.length === 0) return;
    const allDupIds = new Set<string>();
    const mergedList: FicheEntreprise[] = [];
    duplicateGroups.forEach((g) => {
      g.ids.forEach((id) => allDupIds.add(id));
      mergedList.push(mergeFicheGroup(g.fiches));
    });
    setFiches((prev) => [...mergedList, ...prev.filter((f) => !allDupIds.has(f.id))]);
    notify(`${duplicateGroups.length} groupe(s) de doublons fusionnés.`);
  };

  // Exports CSV (3 modes + Copier CSV) & Backup JSON (SANS les clés API)
  const handleExportCsv = (mode: 'filtre' | 'propre' | 'complet') => {
    let target = fiches;
    let suffix = 'complet';
    if (mode === 'filtre') {
      target = filteredFiches;
      suffix = 'filtre';
    } else if (mode === 'propre') {
      const allDupIds = new Set<string>();
      const merged: FicheEntreprise[] = [];
      duplicateGroups.forEach((g) => {
        g.ids.forEach((id) => allDupIds.add(id));
        merged.push(mergeFicheGroup(g.fiches));
      });
      target = [...merged, ...fiches.filter((f) => !allDupIds.has(f.id))];
      suffix = 'base-propre';
    }
    const csv = buildStrictCsv(target);
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orange-pro-${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify(`CSV ${suffix} téléchargé (${target.length} fiches, 9 colonnes, UTF-8 BOM ;).`);
    } catch {
      copyTextSafe(csv);
      notify(`Export CSV copié (${target.length} fiches).`);
    }
  };

  const handleCopyCsvForBalise = async () => {
    const csv = buildStrictCsv(filteredFiches).replace(/^\uFEFF/, '');
    await copyTextSafe(csv);
    notify(`${filteredFiches.length} fiche(s) copiées au format CSV 9 colonnes pour Balise.`);
  };

  const handleDownloadPreviewCsv = (items: FicheEntreprise[], label: string) => {
    if (items.length === 0) return;
    const csv = buildStrictCsv(items);
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orange-pro-${label}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify(`CSV téléchargé (${items.length} fiches, 9 colonnes).`);
    } catch {
      copyTextSafe(csv);
      notify(`CSV copié (${items.length} fiches).`);
    }
  };

  const handleExportFullBackup = () => {
    // Sécurité : les clés du Hub API ne sont JAMAIS incluses dans le fichier JSON exporté
    const payload = {
      version: 3,
      exportedAt: new Date().toISOString(),
      fiches,
      allVilles,
      activeVilles,
      modeVille,
      defaultVille,
      emailSkills,
      emailSignature,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orange-pro-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify(`Backup JSON téléchargé (${fiches.length} fiches, villes & ${emailSkills.length} skills — sans clés API).`);
  };

  const handleImportFullBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (Array.isArray(parsed.fiches)) {
          setFiches(ensureUniqueNumeroFiches(parsed.fiches));
          if (Array.isArray(parsed.allVilles) && parsed.allVilles.length > 0) {
            setVillesState({
              all: parsed.allVilles,
              active: Array.isArray(parsed.activeVilles) ? parsed.activeVilles : parsed.allVilles,
              mode: parsed.modeVille === 'filter' ? 'filter' : 'default',
              defaultVille: typeof parsed.defaultVille === 'string' ? parsed.defaultVille : parsed.allVilles[0],
            });
          }
          if (Array.isArray(parsed.emailSkills) && parsed.emailSkills.length > 0) setEmailSkills(parsed.emailSkills);
          if (typeof parsed.emailSignature === 'string') setEmailSignature(parsed.emailSignature);
          notify(`Backup restauré : ${parsed.fiches.length} fiche(s) chargée(s).`);
        } else {
          notify('Fichier JSON de sauvegarde invalide.', 'err');
        }
      } catch {
        notify('Impossible de lire ce fichier de sauvegarde JSON.', 'err');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleFileUploadExtract = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPasteInput(String(reader.result || ''));
      setPasteSource(file.name);
      notify(`Fichier « ${file.name} » chargé pour extraction.`);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  // Saisie rapide & édition inline
  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cleanCompanyName(quickForm.societe);
    if (!isValidCompanyName(clean)) {
      notify('Nom de société invalide ou trop court.', 'warn');
      return;
    }
    const extraPhonesIn = extractAllMoroccanPhones(
      `${quickForm.telephone} ${quickForm.telephonesSupplementaires}`
    );
    const mergedPhones = mergeMultiPhones(
      normalizeMoroccanPhone(quickForm.telephone),
      [],
      extraPhonesIn
    );
    const extraEmailsIn = extractAllEmails(
      `${quickForm.email} ${quickForm.emailsSupplementaires}`,
      clean
    );
    const mergedEmails = mergeMultiEmails(
      normalizeProEmail(quickForm.email),
      [],
      extraEmailsIn
    );
    const nextCode = generateNextNumeroFiche(fiches);
    const f: FicheEntreprise = {
      id: makeId(),
      numeroFiche: nextCode,
      societe: clean,
      secteur: quickForm.secteur,
      ville: quickForm.ville.trim() || defaultVille,
      telephone: mergedPhones.primary,
      ...(mergedPhones.extras.length > 0 ? { telephonesSupplementaires: mergedPhones.extras } : {}),
      email: mergedEmails.primary,
      ...(mergedEmails.extras.length > 0 ? { emailsSupplementaires: mergedEmails.extras } : {}),
      contact: quickForm.contact.trim(),
      role: quickForm.role.trim(),
      source: quickForm.source.trim() || 'Saisie manuelle',
      effectif: quickForm.effectif ? String(parseInt(quickForm.effectif, 10) || '') : '',
      statut: quickAddStatut,
      dateAjout: new Date().toISOString(),
    };
    setFiches((prev) => ensureUniqueNumeroFiches([f, ...prev]));
    setQuickForm({
      societe: '',
      secteur: 'pme',
      ville: defaultVille,
      telephone: '',
      telephonesSupplementaires: '',
      email: '',
      emailsSupplementaires: '',
      contact: '',
      role: '',
      source: 'Porte à porte',
      effectif: '',
    });
    setQuickAddStatut('À contacter');
    setShowQuickAdd(false);
    notify(`Fiche ${nextCode} « ${f.societe} » ajoutée au portefeuille.`);
  };

  const startEdit = (f: FicheEntreprise, field: keyof FicheEntreprise) => {
    setEditingCell({ id: f.id, field });
    setEditDraft(String(f[field] ?? ''));
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    let val = editDraft.trim();
    if (field === 'telephone') val = val ? normalizeMoroccanPhone(val) : '';
    if (field === 'email') val = val ? normalizeProEmail(val) : '';
    if (field === 'effectif') val = val ? String(parseInt(val.replace(/\D/g, ''), 10) || '') : '';
    setFiches((prev) => prev.map((f) => (f.id === id ? { ...f, [field]: val } : f)));
    setEditingCell(null);
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const toggleVille = (v: string) => {
    setVillesState((prev) => ({
      ...prev,
      active: prev.active.includes(v) ? prev.active.filter((x) => x !== v) : [...prev.active, v],
    }));
  };

  const handleAddVille = () => {
    const v = newVilleInput.trim();
    if (!v) return;
    setVillesState((prev) => ({
      ...prev,
      all: prev.all.includes(v) ? prev.all : [...prev.all, v],
      active: prev.active.includes(v) ? prev.active : [...prev.active, v],
    }));
    setNewVilleInput('');
  };

  // Studio Email IA & Skills
  const openEmailStudio = (f: FicheEntreprise) => {
    const defaultCycle: CycleContrat =
      f.statut === 'Devis envoyé'
        ? 'relance_devis'
        : f.statut === 'RDV pris' || f.statut === 'Appel en cours'
        ? 'suite_passage'
        : f.statut === 'Signé Orange Pro'
        ? 'renouvellement'
        : f.statut === 'Pas intéressé'
        ? 'reactivation'
        : 'premier_contact';
    setEmailModalFiche(f);
    setEmailCycle(defaultCycle);
    setEmailCustomPrompt('');
    setEmailProviderUsed('Moteur local instantané');
    setShowSkillEditor(false);
    setEditingSkill(null);
    const draft = generatePersonalizedEmail(f, defaultCycle, emailTon, emailSignature, activeSkill);
    setEmailObjet(draft.objet);
    setEmailCorps(draft.corps);
  };

  const regenerateLocalEmail = (
    f: FicheEntreprise,
    nextCycle: CycleContrat,
    nextTon: TonEmail,
    nextSig: string,
    nextSkill?: EmailSkill
  ) => {
    const draft = generatePersonalizedEmail(f, nextCycle, nextTon, nextSig, nextSkill || activeSkill);
    setEmailObjet(draft.objet);
    setEmailCorps(draft.corps);
    setEmailProviderUsed('Moteur local instantané');
  };

  const handleSaveSkill = () => {
    if (!editingSkill || !editingSkill.nom.trim()) {
      notify('Donne un nom au skill de rédaction.', 'warn');
      return;
    }
    const cleanSkill: EmailSkill = {
      ...editingSkill,
      nom: editingSkill.nom.trim(),
      description: editingSkill.description.trim() || 'Skill personnalisé',
      role: editingSkill.role.trim() || 'Conseiller Commercial B2B Orange Pro Maroc',
      regles: editingSkill.regles.trim(),
      ctaStyle: editingSkill.ctaStyle.trim(),
    };
    setEmailSkills((prev) => {
      const exists = prev.some((s) => s.id === cleanSkill.id);
      return exists ? prev.map((s) => (s.id === cleanSkill.id ? cleanSkill : s)) : [...prev, cleanSkill];
    });
    setActiveSkillId(cleanSkill.id);
    setShowSkillEditor(false);
    setEditingSkill(null);
    if (emailModalFiche) {
      regenerateLocalEmail(emailModalFiche, emailCycle, emailTon, emailSignature, cleanSkill);
    }
    notify(`Skill « ${cleanSkill.nom} » enregistré.`);
  };

  const handleDeleteSkill = (id: string) => {
    if (emailSkills.length <= 1) {
      notify('Conserve au moins un skill actif.', 'warn');
      return;
    }
    const remaining = emailSkills.filter((s) => s.id !== id);
    setEmailSkills(remaining);
    if (activeSkillId === id) setActiveSkillId(remaining[0].id);
    notify('Skill supprimé.');
  };

  const handleImportSkillFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '').trim();
      if (!content) return;
      const baseName = file.name.replace(/\.(md|txt|json)$/i, '').replace(/[-_]+/g, ' ');
      const imported: EmailSkill = {
        id: `custom_${Date.now()}`,
        nom: baseName || 'Skill importé',
        description: `Importé depuis ${file.name}`,
        role: 'Expert rédaction commerciale Orange Pro Maroc (Skill importé)',
        regles: content.slice(0, 3000),
        ctaStyle: 'Selon les consignes du skill importé',
      };
      setEmailSkills((prev) => [...prev, imported]);
      setActiveSkillId(imported.id);
      notify(`Skill « ${imported.nom} » importé et activé.`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const openSignContractModal = (f: FicheEntreprise) => {
    const reco = getOrangeProRecommendation(f);
    setSignContractTarget({
      id: f.id,
      numeroFiche: f.numeroFiche,
      societe: f.societe,
      ville: f.ville,
      secteur: f.secteur,
      effectif: f.effectif,
      suggestedTier: reco.tier,
      suggestedProduit: reco.offre,
    });
  };

  const handleConfirmSignContract = async (payload: {
    produitOrangePro: string;
    tier: OrangeProTier;
    payoutMad: number;
  }) => {
    if (!signContractTarget || !cloudUser) return;
    setSigningContractBusy(true);
    try {
      const contractId = `ctr_${signContractTarget.id}_${Date.now().toString(36)}`;
      await createSignedContract({
        id: contractId,
        ownerId: cloudUser.uid,
        ownerName: currentUserDisplayName,
        ficheId: signContractTarget.id,
        numeroFiche: signContractTarget.numeroFiche || '',
        societe: signContractTarget.societe,
        ville: signContractTarget.ville,
        secteur: signContractTarget.secteur,
        produitOrangePro: payload.produitOrangePro,
        tier: payload.tier,
        effectif: signContractTarget.effectif,
        payoutMad: payload.payoutMad,
        payoutStatus: isSuperAdmin ? 'Validé' : 'En attente',
        signedAt: new Date().toISOString(),
      });

      setFiches((prev) =>
        prev.map((x) =>
          x.id === signContractTarget.id ? { ...x, statut: 'Signé Orange Pro' } : x
        )
      );
      setSignContractTarget(null);
      notify(
        isSuperAdmin
          ? `Contrat « ${signContractTarget.societe} » signé (${payload.payoutMad.toLocaleString('fr-FR')} MAD).`
          : `Contrat signé ! La fiche est verrouillée et votre payout (${payload.payoutMad.toLocaleString('fr-FR')} MAD) est visible dans Équipe & Payouts.`
      );
    } catch {
      notify('Erreur lors de l’enregistrement du contrat signé.', 'err');
    } finally {
      setSigningContractBusy(false);
    }
  };

  const handleAdminUpdateContract = async (
    contractId: string,
    updates: {
      produitOrangePro: string;
      tier: OrangeProTier;
      payoutMad: number;
      payoutStatus: PayoutStatus;
    }
  ) => {
    try {
      await adminUpdateSignedContract(contractId, updates);
      notify('Payout et statut de paiement mis à jour.');
    } catch {
      notify('Impossible de mettre à jour le payout.', 'err');
    }
  };

  const handleAdminToggleManualBadge = async (targetUid: string, nextBadges: string[]) => {
    try {
      const targetUser = managedUsers.find((u) => u.uid === targetUid);
      await adminUpdateUserManualBadges(
        targetUid,
        nextBadges,
        targetUser
          ? {
              displayName: targetUser.displayName,
              role: targetUser.role,
              zone: targetUser.zone,
              active: targetUser.active,
            }
          : undefined
      );
      notify('Badges de distinction mis à jour avec succès.');
    } catch {
      notify('Erreur lors de l’attribution du badge.', 'err');
    }
  };

  const handleMoveFicheKanban = (ficheId: string, targetStatut: StatutCRM) => {
    const target = fiches.find((f) => f.id === ficheId);
    if (!target || target.statut === targetStatut) return;
    if (targetStatut === 'Signé Orange Pro') {
      openSignContractModal(target);
      return;
    }
    const result = moveFicheToStatut(fiches, ficheId, targetStatut);
    if (!result.changed || !result.movedFiche) return;
    setFiches(result.updated);
    notify(`« ${result.movedFiche.societe} » déplacé vers ${targetStatut}.`);
  };

  const handleOpenAiBrief = (f: FicheEntreprise) => {
    setCopilotFiche(f);
    setShowAiCopilot(true);
  };

  const handleGenerateEmailWithAI = async () => {
    if (!emailModalFiche) return;
    const emailKeys = getOrderedKeysForTask(apiKeysRef.current, 'email');
    if (emailKeys.length === 0 && !serverAiStatus.available) {
      regenerateLocalEmail(emailModalFiche, emailCycle, emailTon, emailSignature, activeSkill);
      notify('Modèle du skill appliqué localement. Ajoute une clé dans le Hub API ou configure GEMINI_API_KEY pour la rédaction IA.', 'warn');
      return;
    }
    setIsGeneratingEmail(true);
    try {
      const f = emailModalFiche;
      const reco = getOrangeProRecommendation(f);
      const cycleObj = CYCLES_CONTRAT.find((c) => c.id === emailCycle);
      const cycleLabel = cycleObj ? `${cycleObj.label} (${cycleObj.desc})` : emailCycle;
      const prompt = `Tu appliques strictement le SKILL DE RÉDACTION suivant pour rédiger un email B2B Orange Pro au Maroc en français naturel et percutant.

=== SKILL ACTIF : ${activeSkill.nom} ===
Rôle / Posture : ${activeSkill.role}
Règles & Consignes du Skill : ${activeSkill.regles}
Style d'appel à l'action (CTA) : ${activeSkill.ctaStyle}

=== DONNÉES CLIENT ===
- Société : ${f.societe}
- Secteur : ${SECTEURS_META[f.secteur].label}
- Ville : ${f.ville || 'Maroc'}
- Contact / Décideur : ${f.contact || 'Non renseigné'} (${f.role || 'Décideur'})
- Effectif : ${f.effectif ? `${f.effectif} salariés` : 'Non précisé'}
- Statut CRM actuel : ${f.statut}
- Offre Orange Pro recommandée : ${reco.tier} — ${reco.offre}

=== SITUATION / CYCLE ===
${cycleLabel}
Ton : ${emailTon === 'court' ? 'Ultra-court (4-5 lignes max)' : emailTon === 'executif' ? 'Exécutif direction' : 'Direct terrain'}
Signature : ${emailSignature}
${emailCustomPrompt.trim() ? `Consigne ponctuelle : ${emailCustomPrompt.trim()}` : ''}

Réponds UNIQUEMENT en JSON strict : {"objet": "...", "corps": "..."}`;

      if (emailKeys.length > 0) {
        const rRes = await callRouterLLM(apiKeysRef.current, 'email', prompt, undefined, updateApiKeyStatus);
        if (rRes.ok && rRes.text) {
          const jm = rRes.text.match(/\{[\s\S]*\}/);
          if (jm) {
            const parsed = JSON.parse(jm[0]);
            if (parsed.objet) setEmailObjet(String(parsed.objet));
            if (parsed.corps) setEmailCorps(String(parsed.corps));
            setEmailProviderUsed(`${rRes.providerLabel} · ${rRes.usedModel}`);
            notify(`Email rédigé par ${rRes.providerLabel} (${rRes.usedModel}).`);
            return;
          }
        }
      }

      if (serverAiStatus.available) {
        const res = await fetch('/api/ai/generate-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
        const data = await res.json();
        if (res.ok && data?.objet && data?.corps) {
          setEmailObjet(String(data.objet));
          setEmailCorps(String(data.corps));
          setEmailProviderUsed(`Gemini IA intégré · ${data.model || serverAiStatus.model}`);
          notify(`Email rédigé par Gemini IA intégré (${data.model || serverAiStatus.model}).`);
          return;
        }
        notify(data?.error || 'Réponse IA indisponible — modèle du skill conservé.', 'warn');
        return;
      }

      notify('Réponse IA indisponible — modèle du skill conservé.', 'warn');
    } catch {
      notify('Erreur réseau IA — modèle du skill conservé.', 'err');
    } finally {
      setIsGeneratingEmail(false);
    }
  };


  const sortedApiKeys = useMemo(
    () => [...apiKeys].sort((a, b) => a.priority - b.priority),
    [apiKeys]
  );

  // ============================================================================
  // CONTRÔLE D'ACCÈS PRIVÉ (LOGIN MOT DE PASSE / VERIFICATION / RBAC)
  // ============================================================================

  if (!authReady || (cloudUser && !profileChecked)) {
    return (
      <div className="min-h-screen bg-[#F6F5F2] flex items-center justify-center p-4">
        <div className="flex items-center gap-2.5 text-sm font-medium text-stone-700">
          <RefreshCw className="w-4 h-4 text-orange-600 animate-spin" />
          Vérification de votre session sécurisée...
        </div>
      </div>
    );
  }

  if (!cloudUser) {
    return <LoginScreen onSuccessNotify={(msg) => notify(msg)} />;
  }

  if (accessDecision?.status === 'verify_email') {
    return (
      <AccessGateNotice
        mode="verify_email"
        email={accessDecision.email}
        onUserReloaded={async () => {
          setCloudUser(auth.currentUser);
          setAuthReloadTick((t) => t + 1);
        }}
      />
    );
  }

  if (!canAccessWorkspace) {
    return (
      <AccessGateNotice
        mode="denied"
        email={cloudUser.email || ''}
        reason={accessDecision?.status === 'denied' ? accessDecision.reason : undefined}
        onUserReloaded={async () => {
          setAuthReloadTick((t) => t + 1);
        }}
      />
    );
  }

  // ============================================================================
  // RENDU INTERFACE « EXECUTIVE B2B WORKSPACE » (#F7F5F0)
  // ============================================================================

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-stone-900 font-sans">
      {/* Toast non bloquant */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 right-4 z-[60] max-w-md px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2.5 ${
            toast.type === 'err'
              ? 'bg-red-900 text-white border-red-700'
              : toast.type === 'warn'
              ? 'bg-amber-900 text-amber-50 border-amber-700'
              : 'bg-stone-900 text-stone-50 border-stone-700'
          }`}
        >
          {toast.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* En-tête Executive B2B Workspace */}
      <header className="bg-white border-b border-stone-200 sm:sticky sm:top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-orange-600 text-white flex items-center justify-center font-extrabold text-lg shrink-0">
              O
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-stone-900 leading-tight truncate">
                Orange Pro B2B — Collecte, MDM, Hub API &amp; Studio Email IA
              </h1>
              <p className="text-xs text-stone-500 truncate">
                Portefeuille Meknès &amp; Région · 9 colonnes CSV (;) · Routage Multi-LLM
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-900 shrink-0">
              <Cloud className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span
                className="font-semibold max-w-[140px] truncate"
                title={`Connecté et synchronisé (${cloudUser.email || ''})`}
              >
                {cloudBusy
                  ? 'Synchro...'
                  : appUserProfile?.displayName ||
                    cloudUser.displayName?.split(' ')[0] ||
                    cloudUser.email?.split('@')[0] ||
                    'Connecté'}
              </span>
              {accessDecision?.status === 'allowed' && (
                <span
                  className={`hidden sm:inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isSuperAdmin ? 'bg-orange-600 text-white' : 'bg-emerald-200/80 text-emerald-950'
                  }`}
                >
                  {accessDecision.roleLabel}
                </span>
              )}
              <button
                type="button"
                onClick={handleGoogleSignOut}
                aria-label="Se déconnecter"
                title="Se déconnecter"
                className="ml-1 p-0.5 rounded hover:bg-emerald-200/70 text-emerald-800 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              type="button"
              disabled={isAuditing}
              onClick={() => handleBatchAudit('portfolio')}
              className="px-3 py-2 rounded-lg border border-stone-300 bg-stone-50 hover:bg-stone-100 disabled:opacity-60 text-xs font-semibold text-stone-800 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <ShieldCheck className={`w-4 h-4 text-emerald-600 ${isAuditing ? 'animate-spin' : ''}`} />
              {isAuditing ? 'Vérification...' : 'Vérifier & Corriger Tout'}
            </button>
            <button
              type="button"
              onClick={() => setShowApiHub((v) => !v)}
              aria-expanded={showApiHub}
              className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                showApiHub || activeApiCount > 0
                  ? 'border-orange-300 bg-orange-50 text-orange-900 hover:bg-orange-100'
                  : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-orange-600" />
              <span className="tabular-nums">Hub API ({activeApiCount} actives)</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAiCopilot(true)}
              className="px-3 py-2 rounded-lg border border-stone-900 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Bot className="w-4 h-4 text-orange-400" />
              Copilote IA
            </button>
            <button
              type="button"
              onClick={() => setShowQuickAdd(true)}
              className="px-3.5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nouvelle fiche
            </button>
          </div>
        </div>

        {/* Panneau Hub API Multi-Fournisseurs (localStorage orange_pro_api_hub_v1) */}
        {showApiHub && (
          <div className="bg-stone-50 border-t border-stone-200 px-4 py-4">
            <div className="max-w-[1440px] mx-auto space-y-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-[280px] max-w-4xl">
                  <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-orange-600 shrink-0" />
                    Hub API Multi-Fournisseurs &amp; Routage Automatique par Tâche
                  </h2>
                  <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                    Clés conservées uniquement dans ce navigateur (jamais exportées dans le Backup JSON). À priorité égale : Recherche (Tavily → Gemini) · Extraction/Audit (Groq → OpenRouter → Mistral → Gemini) · Email (Mistral → OpenRouter → Gemini → Groq). Rotation auto sur quota 429.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {apiKeys.some((k) => k.status === 'quota' || k.status === 'error') && (
                    <button
                      type="button"
                      onClick={handleResetQuotaFlags}
                      className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-xs font-semibold text-stone-700"
                    >
                      Réinitialiser quotas
                    </button>
                  )}
                  {apiKeys.length > 0 && !confirmClearHub && (
                    <button
                      type="button"
                      onClick={() => setConfirmClearHub(true)}
                      className="px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-700"
                    >
                      Effacer tout
                    </button>
                  )}
                  {confirmClearHub && (
                    <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1">
                      <span className="text-xs font-medium text-red-800">Supprimer toutes les clés ?</span>
                      <button
                        type="button"
                        onClick={handleClearAllApiKeys}
                        className="px-2 py-0.5 rounded bg-red-600 text-white text-xs font-semibold"
                      >
                        Confirmer
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearHub(false)}
                        className="px-2 py-0.5 rounded bg-white border border-stone-300 text-stone-700 text-xs font-semibold"
                      >
                        Annuler
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowApiHub(false)}
                    className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold"
                  >
                    Fermer
                  </button>
                </div>
              </div>

              {/* Formulaire d'ajout multi-clés */}
              <form
                onSubmit={handleAddApiKey}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 bg-white p-3 rounded-xl border border-stone-200 text-xs"
              >
                <div className="lg:col-span-2">
                  <label htmlFor="hub-provider" className="block font-semibold text-stone-600 mb-1">
                    Fournisseur
                  </label>
                  <select
                    id="hub-provider"
                    value={newKeyProvider}
                    onChange={(e) => handleProviderSelectChange(e.target.value as ApiProvider)}
                    className="w-full px-2.5 py-2 rounded-lg border border-stone-300 bg-stone-50 text-stone-900"
                  >
                    <option value="tavily">Tavily (Search Web)</option>
                    <option value="openrouter">OpenRouter (Free / Custom)</option>
                    <option value="groq">Groq (Llama 3.3 / Fast)</option>
                    <option value="mistral">Mistral AI (FR B2B)</option>
                    <option value="gemini">Google Gemini (Grounding + IA)</option>
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label htmlFor="hub-label" className="block font-semibold text-stone-600 mb-1">
                    Nom de la clé
                  </label>
                  <input
                    id="hub-label"
                    type="text"
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                    placeholder={`Ex. ${PROVIDER_META[newKeyProvider].name} #1`}
                    className="w-full px-2.5 py-2 rounded-lg border border-stone-300 bg-white"
                  />
                </div>

                <div className="lg:col-span-3">
                  <label htmlFor="hub-secret" className="block font-semibold text-stone-600 mb-1">
                    Clé API *
                  </label>
                  <input
                    id="hub-secret"
                    type="password"
                    value={newKeySecret}
                    onChange={(e) => setNewKeySecret(e.target.value)}
                    placeholder={PROVIDER_META[newKeyProvider].placeholderKey}
                    className="w-full px-2.5 py-2 rounded-lg border border-stone-300 bg-white font-mono"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label htmlFor="hub-model" className="block font-semibold text-stone-600 mb-1">
                    Modèle
                  </label>
                  {newKeyProvider === 'tavily' ? (
                    <select
                      id="hub-model"
                      value={newKeyModel}
                      onChange={(e) => setNewKeyModel(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg border border-stone-300 bg-stone-50"
                    >
                      <option value="basic">basic (rapide)</option>
                      <option value="advanced">advanced (approfondi)</option>
                    </select>
                  ) : (
                    <input
                      id="hub-model"
                      type="text"
                      value={newKeyModel}
                      onChange={(e) => setNewKeyModel(e.target.value)}
                      placeholder={PROVIDER_META[newKeyProvider].modelHint}
                      className="w-full px-2.5 py-2 rounded-lg border border-stone-300 bg-white font-mono"
                    />
                  )}
                </div>

                <div className="lg:col-span-2">
                  <label htmlFor="hub-scope" className="block font-semibold text-stone-600 mb-1">
                    Portée de tâche
                  </label>
                  <select
                    id="hub-scope"
                    value={newKeyScope}
                    onChange={(e) => setNewKeyScope(e.target.value as ApiTaskScope)}
                    className="w-full px-2.5 py-2 rounded-lg border border-stone-300 bg-stone-50"
                  >
                    <option value="all">Toutes tâches</option>
                    <option value="search">Recherche Web</option>
                    <option value="extract">Extraction / Audit</option>
                    <option value="email">Rédaction Email</option>
                  </select>
                </div>

                <div className="lg:col-span-1 flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2 px-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold flex items-center justify-center gap-1 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter
                  </button>
                </div>
              </form>

              {/* Liste des clés configurées avec priorité P1/P2, Active/Off, Tester, Supprimer */}
              {sortedApiKeys.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-stone-300 bg-white text-xs text-stone-500 text-center">
                  Aucune clé configurée. Ajoute une ou plusieurs clés (ex. Tavily #1, Tavily #2, OpenRouter #1, Groq, Mistral, Gemini) pour activer l’enrichissement multi-sources IA et la rotation automatique sur quota.
                </div>
              ) : (
                <div className="divide-y divide-stone-200 bg-white rounded-xl border border-stone-200 overflow-hidden">
                  {sortedApiKeys.map((entry, idx) => (
                    <div
                      key={entry.id}
                      className={`px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs ${
                        entry.enabled ? '' : 'bg-stone-50 opacity-65'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                        <span className="font-mono font-bold text-stone-900 tabular-nums w-7">
                          P{entry.priority}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveKeyPriority(entry.id, -1)}
                            aria-label={`Monter priorité de ${entry.label}`}
                            className="p-1 rounded border border-stone-200 hover:bg-stone-100 disabled:opacity-30"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === sortedApiKeys.length - 1}
                            onClick={() => handleMoveKeyPriority(entry.id, 1)}
                            aria-label={`Descendre priorité de ${entry.label}`}
                            className="p-1 rounded border border-stone-200 hover:bg-stone-100 disabled:opacity-30"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                        <div>
                          <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                            <span>{entry.label}</span>
                            <span className="text-stone-400 font-normal">·</span>
                            <span className="text-stone-600 font-normal">{PROVIDER_META[entry.provider].name}</span>
                          </div>
                          <div className="text-[11px] text-stone-500 font-mono flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span>{entry.model}</span>
                            <span>·</span>
                            <span>
                              {entry.taskScope === 'all'
                                ? 'Toutes tâches'
                                : entry.taskScope === 'search'
                                ? 'Recherche Web'
                                : entry.taskScope === 'extract'
                                ? 'Extraction / Audit'
                                : 'Rédaction Email'}
                            </span>
                            <span>·</span>
                            <span>••••{entry.apiKey.slice(-4)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                            entry.status === 'ok'
                              ? 'bg-emerald-50 text-emerald-700'
                              : entry.status === 'quota'
                              ? 'bg-amber-100 text-amber-900'
                              : entry.status === 'error'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {entry.status === 'quota'
                            ? 'Quota (rotation auto)'
                            : entry.statusMessage || 'Prête'}
                        </span>
                        <button
                          type="button"
                          disabled={testingKeyId === entry.id}
                          onClick={() => handleTestApiKey(entry)}
                          className="px-2.5 py-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-stone-800 font-semibold disabled:opacity-50"
                        >
                          {testingKeyId === entry.id ? 'Test...' : 'Tester'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleApiKey(entry.id)}
                          aria-label={`Basculer activation de ${entry.label}`}
                          className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 border ${
                            entry.enabled
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-stone-100 text-stone-600 border-stone-300'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          {entry.enabled ? 'Active' : 'Off'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteApiKey(entry.id)}
                          aria-label={`Supprimer clé ${entry.label}`}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation 4 Modules Principaux */}
        <nav
          aria-label="Modules principaux"
          className="max-w-[1440px] mx-auto px-4 flex gap-1 overflow-x-auto border-t border-stone-100"
        >
          {[
            { id: 'portefeuille', label: `Portefeuille CRM (${accessibleFiches.length})`, icon: Building2 },
            { id: 'kanban', label: 'Kanban Pipeline', icon: KanbanSquare },
            { id: 'team', label: `Équipe & Payouts (${signedContracts.length})`, icon: Trophy },
            { id: 'badges', label: `Succès & Badges (${myAchievementSummary.unlockedCount}/${myAchievementSummary.totalCount})`, icon: Award },
            { id: 'crawler', label: 'Crawler Profond N1/N2', icon: Globe },
            { id: 'paste', label: 'Extraction HTML / CSV / JSON', icon: FileText },
            { id: 'dedup', label: `Déduplication MDM (${duplicateGroups.length})`, icon: GitMerge },
            ...(isSuperAdmin
              ? [{ id: 'admin', label: `Utilisateurs & Accès (${managedUsers.length})`, icon: Users }]
              : []),
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(t.id as typeof activeTab)}
                className={`px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center gap-1.5 border-b-2 whitespace-nowrap shrink-0 transition-colors tabular-nums ${
                  active
                    ? 'border-orange-600 text-orange-700 bg-orange-50/40'
                    : 'border-transparent text-stone-600 hover:text-stone-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="max-w-[1440px] mx-auto p-4 space-y-4">
        {/* Barre de progression Audit & Enrichissement 8-Workers */}
        {auditProgress && (
          <section className="bg-stone-900 text-stone-50 rounded-xl p-3.5 border border-stone-700 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-semibold">
                <Sparkles className="w-4 h-4 text-orange-400" />
                <span className="tabular-nums">
                  Vérification &amp; enrichissement ({auditProgress.done}/{auditProgress.total}) —{' '}
                  <span className="text-orange-300">{auditProgress.currentName}</span>
                </span>
              </div>
              <div className="flex items-center gap-3 tabular-nums">
                <span className="text-emerald-300">{auditProgress.enriched} complétée(s)</span>
                <span className="text-sky-300">{auditProgress.secteurs} secteur(s) corrigé(s)</span>
                <span className="text-amber-300">{auditProgress.removed} parasite(s) retiré(s)</span>
                <button
                  type="button"
                  onClick={handleStopAudit}
                  className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center gap-1"
                >
                  <Square className="w-3 h-3" />
                  Stop
                </button>
              </div>
            </div>
            <div className="w-full h-1.5 bg-stone-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 transition-all"
                style={{
                  width: `${Math.min(100, Math.round((auditProgress.done / Math.max(1, auditProgress.total)) * 100))}%`,
                }}
              />
            </div>
          </section>
        )}

        {/* Panneau Villes Cibles Persistant */}
        <section className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-600" />
              <h2 className="text-xs font-bold text-stone-800 tabular-nums">
                Villes Cibles ({activeVilles.length}/{allVilles.length})
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer bg-stone-50 px-2.5 py-1 rounded-lg border border-stone-200">
                <input
                  type="radio"
                  name="modeVille"
                  checked={modeVille === 'filter'}
                  onChange={() => setVillesState((p) => ({ ...p, mode: 'filter' }))}
                  className="accent-orange-600"
                />
                <span>Filtrer uniquement les villes cochées</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer bg-stone-50 px-2.5 py-1 rounded-lg border border-stone-200">
                <input
                  type="radio"
                  name="modeVille"
                  checked={modeVille === 'default'}
                  onChange={() => setVillesState((p) => ({ ...p, mode: 'default' }))}
                  className="accent-orange-600"
                />
                <span>Ville par défaut :</span>
                <select
                  aria-label="Ville par défaut"
                  value={defaultVille}
                  onChange={(e) => setVillesState((p) => ({ ...p, defaultVille: e.target.value }))}
                  className="bg-transparent font-semibold text-orange-700 focus:outline-none"
                >
                  {allVilles.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {allVilles.map((v) => {
              const on = activeVilles.includes(v);
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => toggleVille(v)}
                  aria-pressed={on}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                    on
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-stone-50 text-stone-500 border-stone-200 hover:border-stone-400'
                  }`}
                >
                  {v}
                </button>
              );
            })}
            <div className="flex items-center gap-1 ml-1">
              <input
                type="text"
                value={newVilleInput}
                onChange={(e) => setNewVilleInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddVille()}
                placeholder="+ Ville ou ZI..."
                aria-label="Ajouter une ville ou zone industrielle"
                className="w-36 px-2.5 py-1 rounded-lg border border-stone-300 text-xs bg-stone-50 focus:bg-white focus:outline-none focus:border-orange-500"
              />
              <button
                type="button"
                onClick={handleAddVille}
                className="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold"
              >
                Ajouter
              </button>
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* ONGLET 1 : PORTEFEUILLE CRM, FILTRAGES & QUALIFICATION ORANGE PRO  */}
        {/* ================================================================== */}
        {activeTab === 'portefeuille' && (
          <>
            {/* 6 Cartes KPI Couleur Orange Pro Cliquables */}
            <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5" aria-label="Segments couleur Orange Pro">
              {(Object.keys(SEGMENTS_COULEUR) as SegmentCouleur[]).map((col) => {
                const seg = SEGMENTS_COULEUR[col];
                const active = couleurFilter === col;
                return (
                  <button
                    key={col}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCouleurFilter(active ? '' : col)}
                    className={`relative overflow-hidden text-left px-3.5 pt-4 pb-3.5 rounded-xl bg-white border transition-all ${
                      active ? `ring-2 ${seg.ringCls}` : 'border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    <span className={`absolute inset-x-0 top-0 h-[3px] ${seg.dotCls}`} aria-hidden="true" />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${seg.dotCls}`} aria-hidden="true" />
                        {seg.label}
                      </span>
                      <span className="text-xl font-bold text-stone-900 tabular-nums">{kpiByColor[col]}</span>
                    </div>
                    <p className="text-[11px] text-stone-500 mt-1 line-clamp-1">{seg.description}</p>
                  </button>
                );
              })}
            </section>

            {/* Graphique de Tendance KPI & Dynamique Pipeline */}
            <KpiTrendChart fiches={filteredFiches} totalUnfilteredCount={fiches.length} />

            {/* Barre Recherche, Filtres Avancés, Statuts CRM & Exports */}
            <section className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher société, secteur, ville, téléphone, email, contact, rôle, source..."
                    aria-label="Recherche multi-champs dans le portefeuille"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setOnlyReadyToCall((v) => !v)}
                  aria-pressed={onlyReadyToCall}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border flex items-center gap-1.5 whitespace-nowrap ${
                    onlyReadyToCall
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-stone-50 text-stone-700 border-stone-300 hover:bg-stone-100'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  Prêtes à appeler
                </button>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleExportCsv('filtre')}
                    className="px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap tabular-nums"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV Filtré ({filteredFiches.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportCsv('propre')}
                    className="px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV Base Propre
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportCsv('complet')}
                    className="px-3 py-2 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV Complet
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyCsvForBalise}
                    className="px-3 py-2 rounded-lg border border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-800 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copier CSV
                  </button>
                  <button
                    type="button"
                    onClick={handleExportFullBackup}
                    className="px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Backup JSON
                  </button>
                  <input
                    ref={backupInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImportFullBackup}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => backupInputRef.current?.click()}
                    className="px-3 py-2 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Restaurer
                  </button>
                </div>
              </div>

              {/* 6 Filtres Multi-Critères Combinables */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-stone-100 text-xs">
                <select
                  aria-label="Filtrer par secteur exact"
                  value={secteurFilter}
                  onChange={(e) => setSecteurFilter(e.target.value as SecteurCode | '')}
                  className="px-2.5 py-2 rounded-lg border border-stone-300 bg-stone-50 text-stone-800"
                >
                  <option value="">Tous les secteurs (13)</option>
                  {(Object.keys(SECTEURS_META) as SecteurCode[]).map((code) => (
                    <option key={code} value={code}>
                      {SECTEURS_META[code].label}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filtrer par ville"
                  value={villeFilter}
                  onChange={(e) => setVilleFilter(e.target.value)}
                  className="px-2.5 py-2 rounded-lg border border-stone-300 bg-stone-50 text-stone-800"
                >
                  <option value="">Toutes les villes ({availableVillesInData.length})</option>
                  {availableVillesInData.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filtrer par offre Orange Pro"
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value as '' | 'Grand Compte' | 'PME' | 'TPE / Libéral')}
                  className="px-2.5 py-2 rounded-lg border border-stone-300 bg-stone-50 text-stone-800"
                >
                  <option value="">Toutes les offres</option>
                  <option value="Grand Compte">Grand Compte</option>
                  <option value="PME">PME</option>
                  <option value="TPE / Libéral">TPE / Libéral</option>
                </select>

                <select
                  aria-label="Filtrer par effectif"
                  value={effectifFilter}
                  onChange={(e) => setEffectifFilter(e.target.value as '' | 'tpe' | 'pme' | 'gc' | 'vide')}
                  className="px-2.5 py-2 rounded-lg border border-stone-300 bg-stone-50 text-stone-800"
                >
                  <option value="">Tous les effectifs</option>
                  <option value="tpe">&lt; 10 salariés</option>
                  <option value="pme">10 – 29 salariés</option>
                  <option value="gc">30+ salariés</option>
                  <option value="vide">Effectif manquant</option>
                </select>

                <select
                  aria-label="Filtrer par complétude"
                  value={completudeFilter}
                  onChange={(e) =>
                    setCompletudeFilter(
                      e.target.value as
                        | ''
                        | 'ready'
                        | 'has_phone'
                        | 'no_phone'
                        | 'has_email'
                        | 'no_email'
                        | 'has_contact'
                        | 'no_contact'
                        | 'incomplete'
                        | 'verified'
                        | 'unverified'
                    )
                  }
                  className="px-2.5 py-2 rounded-lg border border-stone-300 bg-stone-50 text-stone-800"
                >
                  <option value="">Complétude : Tout</option>
                  <option value="ready">Prêtes à appeler (Tél + Décideur)</option>
                  <option value="has_phone">Avec téléphone</option>
                  <option value="no_phone">Sans téléphone</option>
                  <option value="has_email">Avec email</option>
                  <option value="no_email">Sans email</option>
                  <option value="has_contact">Avec décideur</option>
                  <option value="no_contact">Sans décideur</option>
                  <option value="incomplete">Incomplètes à enrichir</option>
                  <option value="verified">Vérifiées Web</option>
                  <option value="unverified">Non vérifiées</option>
                </select>

                <select
                  aria-label="Filtrer par source"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="px-2.5 py-2 rounded-lg border border-stone-300 bg-stone-50 text-stone-800"
                >
                  <option value="">Toutes les sources</option>
                  {availableSourcesInData.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pipeline Statuts CRM + Compteur X / Y fiches */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-stone-500 mr-1">Pipeline :</span>
                  <button
                    type="button"
                    onClick={() => setStatutFilter('')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold tabular-nums ${
                      statutFilter === '' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    Tous ({fiches.length})
                  </button>
                  {STATUTS_CRM.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatutFilter(statutFilter === st ? '' : st)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium tabular-nums ${
                        statutFilter === st
                          ? 'bg-orange-600 text-white'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      {st} ({kpiByStatut[st]})
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 text-xs tabular-nums">
                  <div
                    role="group"
                    aria-label="Mode d'affichage CRM"
                    className="inline-flex items-center p-0.5 bg-stone-100 rounded-lg border border-stone-200"
                  >
                    <button
                      type="button"
                      onClick={() => setCrmViewMode('table')}
                      aria-pressed={crmViewMode === 'table'}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                        crmViewMode === 'table'
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      <Table2 className="w-3.5 h-3.5" />
                      Tableau
                    </button>
                    <button
                      type="button"
                      onClick={() => setCrmViewMode('kanban')}
                      aria-pressed={crmViewMode === 'kanban'}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                        crmViewMode === 'kanban'
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      <KanbanSquare className="w-3.5 h-3.5" />
                      Kanban
                    </button>
                  </div>
                  <span className="text-stone-600 font-medium" data-testid="portfolio-count">
                    {filteredFiches.length} / {fiches.length} fiches
                  </span>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="text-orange-700 hover:text-orange-900 font-semibold flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      Réinitialiser tous les filtres
                    </button>
                  )}
                </div>
              </div>
            </section>

            {crmViewMode === 'kanban' ? (
              <KanbanBoard
                fiches={filteredFiches}
                verifyingId={verifyingId}
                onMoveFiche={handleMoveFicheKanban}
                onOpenEmail={openEmailStudio}
                onVerifyOne={handleVerifyWeb}
                onOpenAiBrief={handleOpenAiBrief}
                onOpenAssist={(f) => {
                  setAssistModalFiche(f);
                  setAssistPasteText('');
                  setAssistAiSummary('');
                  setLastVerifyDiag('');
                }}
                onQuickAddInStage={(statut) => {
                  setQuickAddStatut(statut);
                  setShowQuickAdd(true);
                }}
              />
            ) : (
            /* Tableau Haute Densité Éditable Inline */
            <section className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold">
                      <th className="p-3">
                        <button
                          type="button"
                          onClick={() => toggleSort('societe')}
                          className="flex items-center gap-1 hover:text-stone-900"
                        >
                          Société &amp; Secteur <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="p-3">
                        <button
                          type="button"
                          onClick={() => toggleSort('ville')}
                          className="flex items-center gap-1 hover:text-stone-900"
                        >
                          Ville <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="p-3">Téléphone &amp; Email</th>
                      <th className="p-3">Décideur &amp; Rôle</th>
                      <th className="p-3">
                        <button
                          type="button"
                          onClick={() => toggleSort('effectif')}
                          className="flex items-center gap-1 hover:text-stone-900"
                        >
                          Eff. &amp; Offre Orange Pro <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="p-3">
                        <button
                          type="button"
                          onClick={() => toggleSort('maturite')}
                          className="flex items-center gap-1 hover:text-stone-900"
                        >
                          Maturité <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="p-3">Statut CRM</th>
                      <th className="p-3 text-right">Actions terrain</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredFiches.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-10 text-center text-stone-500">
                          Aucune fiche ne correspond aux filtres actuels.
                        </td>
                      </tr>
                    ) : (
                      filteredFiches.map((f) => {
                        const secMeta = SECTEURS_META[f.secteur] || SECTEURS_META.pme;
                        const seg = SEGMENTS_COULEUR[secMeta.couleur];
                        const reco = getOrangeProRecommendation(f);
                        const maturity = computeMaturityScore(f);
                        const isDup = duplicateIdSet.has(f.id);
                        const wa = toWa212(f.telephone);
                        const waMsg = `Bonjour${
                          f.contact ? ` ${f.contact.split(' ')[0]}` : ''
                        }, conseiller Orange Pro sur ${f.ville || 'la région'}. Je souhaite faire un point rapide pour ${
                          f.societe
                        } sur ${reco.offre}.`;

                        const renderEditable = (field: keyof FicheEntreprise, display: string, placeholder: string) => {
                          if (editingCell?.id === f.id && editingCell.field === field) {
                            return (
                              <input
                                autoFocus
                                aria-label={`Modifier ${field} de ${f.societe}`}
                                value={editDraft}
                                onChange={(e) => setEditDraft(e.target.value)}
                                onBlur={commitEdit}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitEdit();
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                                className="w-full px-1.5 py-0.5 rounded border border-orange-500 bg-white text-xs text-stone-900"
                              />
                            );
                          }
                          return (
                            <button
                              type="button"
                              onClick={() => startEdit(f, field)}
                              title="Cliquer pour modifier"
                              className="text-left hover:underline decoration-dashed decoration-orange-400"
                            >
                              {display || <span className="text-stone-400 italic">{placeholder}</span>}
                            </button>
                          );
                        };

                        return (
                          <tr key={f.id} className="hover:bg-stone-50/80 align-top">
                            <td className="p-3">
                              <div className="font-semibold text-stone-900 text-[13px] flex items-center flex-wrap gap-1.5">
                                <span className={`w-2 h-2 rounded-sm shrink-0 ${seg.dotCls}`} aria-hidden="true" />
                                {f.numeroFiche && (
                                  <button
                                    type="button"
                                    data-testid={`fiche-code-${f.id}`}
                                    onClick={() => {
                                      copyTextSafe(f.numeroFiche || '');
                                      notify(`Code fiche ${f.numeroFiche} copié.`);
                                    }}
                                    title="Cliquer pour copier le numéro de fiche unique"
                                    className="px-1.5 py-0.5 rounded bg-stone-100 hover:bg-orange-100 text-stone-700 hover:text-orange-800 font-mono text-[10px] font-bold tracking-tight shrink-0"
                                  >
                                    {f.numeroFiche}
                                  </button>
                                )}
                                {renderEditable('societe', f.societe, 'Société')}
                                {isDup && (
                                  <button
                                    type="button"
                                    onClick={() => setActiveTab('dedup')}
                                    className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold"
                                  >
                                    Doublon
                                  </button>
                                )}
                              </div>
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <select
                                  aria-label={`Secteur de ${f.societe}`}
                                  value={f.secteur}
                                  onChange={(e) =>
                                    setFiches((prev) =>
                                      prev.map((x) =>
                                        x.id === f.id ? { ...x, secteur: e.target.value as SecteurCode } : x
                                      )
                                    )
                                  }
                                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border cursor-pointer ${seg.badgeCls}`}
                                >
                                  {(Object.keys(SECTEURS_META) as SecteurCode[]).map((code) => (
                                    <option key={code} value={code}>
                                      {SECTEURS_META[code].label}
                                    </option>
                                  ))}
                                </select>
                                <span className="text-[11px] text-stone-500 truncate max-w-[150px]" title={f.source}>
                                  · {renderEditable('source', f.source, 'Source')}
                                </span>
                              </div>
                            </td>

                            <td className="p-3 font-medium text-stone-800 whitespace-nowrap">
                              {renderEditable('ville', f.ville, 'Ville')}
                            </td>

                            <td className="p-3 space-y-1.5 min-w-[205px]">
                              {/* Téléphone principal + numéros supplémentaires */}
                              <div className="space-y-0.5">
                                <div className="flex items-center justify-between gap-1.5">
                                  <div className="font-mono text-stone-900 tabular-nums">
                                    {renderEditable('telephone', f.telephone, '05/06/07...')}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInlineAddContact({ id: f.id, type: 'phone' });
                                      setInlineContactDraft('');
                                    }}
                                    aria-label={`Ajouter un numéro pour ${f.societe}`}
                                    title="Ajouter un numéro de téléphone supplémentaire"
                                    className="text-[10px] font-semibold text-orange-700 hover:text-orange-900 px-1 py-0.5 rounded hover:bg-orange-50 shrink-0"
                                  >
                                    + Tél
                                  </button>
                                </div>
                                {(f.telephonesSupplementaires || []).map((extraTel) => (
                                  <div
                                    key={extraTel}
                                    className="flex items-center justify-between gap-1 font-mono text-[11px] text-stone-600 tabular-nums pl-1.5 border-l-2 border-stone-200"
                                  >
                                    <a href={`tel:${extraTel}`} className="hover:text-orange-700 hover:underline">
                                      {extraTel}
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => removeAdditionalContactFromFiche(f.id, 'phone', extraTel)}
                                      aria-label={`Retirer le numéro ${extraTel}`}
                                      className="text-stone-400 hover:text-red-600 p-0.5"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                                {inlineAddContact?.id === f.id && inlineAddContact.type === 'phone' && (
                                  <form
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      if (addAdditionalContactToFiche(f.id, 'phone', inlineContactDraft)) {
                                        setInlineAddContact(null);
                                        setInlineContactDraft('');
                                      }
                                    }}
                                    className="flex items-center gap-1 pt-0.5"
                                  >
                                    <input
                                      autoFocus
                                      aria-label={`Nouveau numéro pour ${f.societe}`}
                                      value={inlineContactDraft}
                                      onChange={(e) => setInlineContactDraft(e.target.value)}
                                      placeholder="05/06/07 ou +212..."
                                      className="w-32 px-1.5 py-0.5 rounded border border-orange-400 text-[11px] font-mono bg-white"
                                    />
                                    <button
                                      type="submit"
                                      className="px-1.5 py-0.5 rounded bg-orange-600 text-white text-[10px] font-semibold"
                                    >
                                      OK
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setInlineAddContact(null)}
                                      className="p-0.5 text-stone-400 hover:text-stone-700"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </form>
                                )}
                              </div>

                              {/* Email principal + emails supplémentaires */}
                              <div className="space-y-0.5 pt-0.5 border-t border-stone-100">
                                <div className="flex items-center justify-between gap-1.5">
                                  <div className="text-[11px] text-stone-600 break-all">
                                    {renderEditable('email', f.email, 'email@domaine.ma')}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInlineAddContact({ id: f.id, type: 'email' });
                                      setInlineContactDraft('');
                                    }}
                                    aria-label={`Ajouter un email pour ${f.societe}`}
                                    title="Ajouter une adresse email supplémentaire"
                                    className="text-[10px] font-semibold text-sky-700 hover:text-sky-900 px-1 py-0.5 rounded hover:bg-sky-50 shrink-0"
                                  >
                                    + Mail
                                  </button>
                                </div>
                                {(f.emailsSupplementaires || []).map((extraMail) => (
                                  <div
                                    key={extraMail}
                                    className="flex items-center justify-between gap-1 text-[11px] text-stone-500 break-all pl-1.5 border-l-2 border-stone-200"
                                  >
                                    <a href={`mailto:${extraMail}`} className="hover:text-sky-700 hover:underline">
                                      {extraMail}
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => removeAdditionalContactFromFiche(f.id, 'email', extraMail)}
                                      aria-label={`Retirer l'email ${extraMail}`}
                                      className="text-stone-400 hover:text-red-600 p-0.5 shrink-0"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                                {inlineAddContact?.id === f.id && inlineAddContact.type === 'email' && (
                                  <form
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      if (addAdditionalContactToFiche(f.id, 'email', inlineContactDraft)) {
                                        setInlineAddContact(null);
                                        setInlineContactDraft('');
                                      }
                                    }}
                                    className="flex items-center gap-1 pt-0.5"
                                  >
                                    <input
                                      autoFocus
                                      type="email"
                                      aria-label={`Nouvel email pour ${f.societe}`}
                                      value={inlineContactDraft}
                                      onChange={(e) => setInlineContactDraft(e.target.value)}
                                      placeholder="autre@domaine.ma"
                                      className="w-36 px-1.5 py-0.5 rounded border border-sky-400 text-[11px] bg-white"
                                    />
                                    <button
                                      type="submit"
                                      className="px-1.5 py-0.5 rounded bg-sky-600 text-white text-[10px] font-semibold"
                                    >
                                      OK
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setInlineAddContact(null)}
                                      className="p-0.5 text-stone-400 hover:text-stone-700"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </form>
                                )}
                              </div>
                            </td>

                            <td className="p-3 space-y-1">
                              <div className="font-medium text-stone-900">
                                {renderEditable('contact', f.contact, 'Nom décideur')}
                              </div>
                              <div className="text-[11px] text-stone-500">
                                {renderEditable('role', f.role, 'Fonction')}
                              </div>
                            </td>

                            <td className="p-3 space-y-1 max-w-[235px]">
                              <div className="flex items-center gap-1.5">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${reco.badgeCls}`}>
                                  {reco.tier}
                                </span>
                                <span className="text-[11px] text-stone-600 tabular-nums">
                                  Eff. : {renderEditable('effectif', f.effectif, '—')}
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-600 leading-snug">{reco.offre}</p>
                            </td>

                            <td className="p-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <div className="w-14 h-2 bg-stone-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      maturity >= 80
                                        ? 'bg-emerald-600'
                                        : maturity >= 50
                                        ? 'bg-amber-500'
                                        : 'bg-stone-400'
                                    }`}
                                    style={{ width: `${maturity}%` }}
                                  />
                                </div>
                                <span className="font-bold text-stone-700 tabular-nums">{maturity}%</span>
                              </div>
                            </td>

                            <td className="p-3">
                              <select
                                aria-label={`Statut CRM de ${f.societe}`}
                                value={f.statut}
                                onChange={(e) => {
                                  const nextStatut = e.target.value as StatutCRM;
                                  if (nextStatut === 'Signé Orange Pro' && f.statut !== 'Signé Orange Pro') {
                                    openSignContractModal(f);
                                    return;
                                  }
                                  setFiches((prev) =>
                                    prev.map((x) =>
                                      x.id === f.id ? { ...x, statut: nextStatut } : x
                                    )
                                  );
                                }}
                                className="px-2 py-1 rounded-lg border border-stone-200 bg-stone-50 text-xs font-medium text-stone-800"
                              >
                                {STATUTS_CRM.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="p-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                {f.telephone && (
                                  <a
                                    href={`tel:${f.telephone}`}
                                    aria-label={`Appeler ${f.societe}`}
                                    title="Appeler"
                                    className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800"
                                  >
                                    <Phone className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                {wa && (
                                  <a
                                    href={`https://wa.me/${wa}?text=${encodeURIComponent(waMsg)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`WhatsApp Business pour ${f.societe}`}
                                    title="WhatsApp Business"
                                    className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openEmailStudio(f)}
                                  aria-label={`Studio Email IA pour ${f.societe}`}
                                  title="Studio Email IA & Skills"
                                  className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={verifyingId === f.id}
                                  onClick={() => handleVerifyWeb(f)}
                                  aria-label={`Vérifier sur le web ${f.societe}`}
                                  title="Vérifier automatiquement (7 pistes parallèles + Phase 2)"
                                  className="px-2 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-800 font-semibold text-[11px] flex items-center gap-1 disabled:opacity-50"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  {verifyingId === f.id ? '...' : 'Vérifier'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenAiBrief(f)}
                                  aria-label={`Brief IA pour ${f.societe}`}
                                  title="Brief Commercial IA (Gemini)"
                                  className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-orange-300"
                                >
                                  <Bot className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAssistModalFiche(f);
                                    setAssistPasteText('');
                                    setLastVerifyDiag('');
                                  }}
                                  aria-label={`Enrichissement Assisté pour ${f.societe}`}
                                  title="Enrichissement Assisté & Mode Rafale"
                                  className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700"
                                >
                                  <Globe className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFiches((prev) => prev.filter((x) => x.id !== f.id))}
                                  aria-label={`Supprimer ${f.societe}`}
                                  title="Supprimer"
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
                <span>
                  Astuce : clique directement sur n’importe quelle cellule (société, tél, email, contact, rôle, effectif) pour l’éditer en place.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFiches(createInitialPortfolio());
                    notify('Portefeuille exemple Meknès & Région rechargé.');
                  }}
                  className="text-stone-600 hover:text-orange-700 font-semibold flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Réinitialiser les exemples
                </button>
              </div>
            </section>
            )}
          </>
        )}

        {/* ================================================================== */}
        {/* ONGLET DEDIE : KANBAN PIPELINE DRAG & DROP + TENDANCE KPI          */}
        {/* ================================================================== */}
        {activeTab === 'kanban' && (
          <div className="space-y-4">
            <KpiTrendChart fiches={filteredFiches} totalUnfilteredCount={fiches.length} />
            <KanbanBoard
              fiches={filteredFiches}
              verifyingId={verifyingId}
              onMoveFiche={handleMoveFicheKanban}
              onOpenEmail={openEmailStudio}
              onVerifyOne={handleVerifyWeb}
              onOpenAiBrief={handleOpenAiBrief}
              onOpenAssist={(f) => {
                setAssistModalFiche(f);
                setAssistPasteText('');
                setAssistAiSummary('');
                setLastVerifyDiag('');
              }}
              onQuickAddInStage={(statut) => {
                setQuickAddStatut(statut);
                setShowQuickAdd(true);
              }}
            />
          </div>
        )}


        {/* ================================================================== */}
        {/* ONGLET 2 : CRAWLER PROFOND N1/N2 (MULTI-URLS & PAGINATION)         */}
        {/* ================================================================== */}
        {activeTab === 'crawler' && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5 bg-white rounded-xl border border-stone-200 p-4 space-y-3.5">
              <div>
                <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-orange-600" />
                  Crawler Profond N1/N2 — Multi-URLs &amp; Pagination
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Colle 1 à 100 URLs (annuaires ou fiches directes). Contournement CORS parallèle, isolation DOM chirurgicale et filtre anti-call-center actifs.
                </p>
              </div>

              <textarea
                rows={6}
                aria-label="URLs à crawler"
                value={crawlUrlsInput}
                onChange={(e) => setCrawlUrlsInput(e.target.value)}
                placeholder={'https://www.telecontact.ma/liens/fiduciaires/meknes.php\nhttps://www.kerix.net/fr/annuaire-entreprise/...'}
                className="w-full p-3 rounded-lg border border-stone-300 text-xs font-mono bg-stone-50 focus:bg-white focus:outline-none focus:border-orange-500"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label htmlFor="crawl-proxy" className="block font-semibold text-stone-600 mb-1">
                    Stratégie CORS
                  </label>
                  <select
                    id="crawl-proxy"
                    value={proxyStrategy}
                    onChange={(e) => setProxyStrategy(e.target.value as ProxyStrategy)}
                    className="w-full px-2.5 py-2 rounded-lg border border-stone-300 bg-white"
                  >
                    <option value="auto">Auto (course allorigins / corsproxy → r.jina.ai → direct)</option>
                    <option value="allorigins">allorigins.win</option>
                    <option value="corsproxy">corsproxy.io</option>
                    <option value="jina">r.jina.ai (SPA / React / Angular)</option>
                    <option value="direct">Fetch direct</option>
                  </select>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enablePagination}
                      onChange={(e) => setEnablePagination(e.target.checked)}
                      className="accent-orange-600"
                    />
                    <span>Pagination auto (?page=, /page/, Suivant, »)</span>
                  </label>
                  {enablePagination && (
                    <div className="flex flex-wrap items-center gap-1.5 pl-5">
                      <select
                        aria-label="Mode de pagination"
                        value={paginationMode}
                        onChange={(e) => setPaginationMode(e.target.value as 'unlimited' | 'range')}
                        className="px-2 py-1 rounded border border-stone-300 bg-white text-[11px]"
                      >
                        <option value="unlimited">Illimité (toutes pages)</option>
                        <option value="range">Plage (De X à Y)</option>
                      </select>
                      {paginationMode === 'range' && (
                        <div className="flex items-center gap-1 text-[11px]">
                          <span>De</span>
                          <input
                            type="number"
                            aria-label="Page de début"
                            min={1}
                            value={pageStart}
                            onChange={(e) => setPageStart(Math.max(1, Number(e.target.value) || 1))}
                            className="w-12 px-1.5 py-0.5 rounded border border-stone-300 tabular-nums"
                          />
                          <span>à</span>
                          <input
                            type="number"
                            aria-label="Page de fin"
                            min={1}
                            value={pageEnd}
                            onChange={(e) => setPageEnd(Math.max(pageStart, Number(e.target.value) || pageStart))}
                            className="w-12 px-1.5 py-0.5 rounded border border-stone-300 tabular-nums"
                          />
                        </div>
                      )}
                    </div>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableLevel2}
                      onChange={(e) => setEnableLevel2(e.target.checked)}
                      className="accent-orange-600"
                    />
                    <span>Explorer fiches détaillées (Niveau 2)</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2">
                {!isCrawling ? (
                  <button
                    type="button"
                    onClick={handleStartCrawl}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Lancer le crawl
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStopCrawl}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold flex items-center justify-center gap-2 tabular-nums"
                  >
                    <Square className="w-4 h-4" />
                    Stop (conserver {crawlProgress.captured} fiches)
                  </button>
                )}
              </div>

              {(isCrawling || crawlLogs.length > 0) && (
                <div className="space-y-2 pt-2 border-t border-stone-100">
                  <div className="flex justify-between text-xs font-semibold text-stone-700 tabular-nums">
                    <span>
                      Pages : {crawlProgress.done} / {crawlProgress.total}
                    </span>
                    <span className="text-orange-700">{crawlProgress.captured} fiche(s) extraites</span>
                  </div>
                  <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-600 transition-all"
                      style={{
                        width: `${
                          crawlProgress.total > 0 ? Math.min(100, (crawlProgress.done / crawlProgress.total) * 100) : 0
                        }%`,
                      }}
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto bg-stone-900 text-stone-100 rounded-lg p-2.5 font-mono text-[11px] space-y-1">
                    {crawlLogs.map((l) => (
                      <div
                        key={l.id}
                        className={
                          l.level === 'err'
                            ? 'text-red-300'
                            : l.level === 'warn'
                            ? 'text-amber-300'
                            : l.level === 'ok'
                            ? 'text-emerald-300'
                            : 'text-stone-300'
                        }
                      >
                        [{l.time}] {l.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-7 bg-white rounded-xl border border-stone-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-stone-900 tabular-nums">
                  Aperçu Extraction ({crawlPreview.length})
                </h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={crawlPreview.length === 0 || isAuditing}
                    onClick={() => handleBatchAudit('crawlPreview')}
                    className="px-3 py-2 rounded-lg border border-stone-300 bg-stone-50 hover:bg-stone-100 disabled:opacity-40 text-stone-800 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    {isAuditing ? 'Audit...' : 'Audit IA & Nettoyage'}
                  </button>
                  <button
                    type="button"
                    disabled={crawlPreview.length === 0}
                    onClick={() => handleDownloadPreviewCsv(crawlPreview, 'crawler')}
                    className="px-3 py-2 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 disabled:opacity-40 text-stone-800 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Télécharger CSV
                  </button>
                  <button
                    type="button"
                    disabled={crawlPreview.length === 0}
                    onClick={() => handleCommitCaptured(crawlPreview, 'Crawler N1/N2')}
                    className="px-3.5 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    Importer dans le portefeuille
                  </button>
                </div>
              </div>

              {crawlPreview.length === 0 ? (
                <div className="p-10 text-center rounded-lg border border-dashed border-stone-300 text-xs text-stone-500">
                  Les fiches extraites en Niveau 1 et Niveau 2 apparaîtront ici en temps réel.
                </div>
              ) : (
                <div className="max-h-[440px] overflow-y-auto divide-y divide-stone-100 border border-stone-200 rounded-lg">
                  {crawlPreview.map((f) => {
                    const sec = SECTEURS_META[f.secteur];
                    const seg = SEGMENTS_COULEUR[sec.couleur];
                    return (
                      <div key={f.id} className="p-3 text-xs flex justify-between gap-2">
                        <div>
                          <p className="font-semibold text-stone-900 flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-sm ${seg.dotCls}`} aria-hidden="true" />
                            {f.societe}
                          </p>
                          <p className="text-stone-500 mt-0.5 tabular-nums">
                            {sec.label} · {f.ville || '—'} · {f.telephone || 'Sans tél'} · {f.email || 'Sans email'}
                          </p>
                        </div>
                        <span className="font-bold text-stone-700 shrink-0 tabular-nums">{computeMaturityScore(f)}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ================================================================== */}
        {/* ONGLET 3 : EXTRACTION HTML / CSV / JSON & IMPORT FICHIER           */}
        {/* ================================================================== */}
        {activeTab === 'paste' && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-6 bg-white rounded-xl border border-stone-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-orange-600" />
                  Extraction HTML / CSV / JSON &amp; Import Fichier
                </h2>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".html,.htm,.csv,.json,.txt"
                    onChange={handleFileUploadExtract}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Charger un fichier
                  </button>
                  <input
                    type="text"
                    aria-label="Origine des données collées"
                    value={pasteSource}
                    onChange={(e) => setPasteSource(e.target.value)}
                    placeholder="Origine (Pages Jaunes...)"
                    className="px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs w-36"
                  />
                </div>
              </div>

              <textarea
                rows={12}
                aria-label="Zone de collage HTML, Markdown, CSV, JSON ou texte"
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                placeholder={`Colle ici du HTML brut, du Markdown, du texte copié (Ctrl+A / Ctrl+C), un CSV (;) ou un JSON...\n\nExemple rapide :\nCabinet El Idrissi Expertise\nMeknès - +212 (0)5 35 52 10 99 - contact@elidrissi-fidu.ma\nExpert-Comptable : Omar El Idrissi (12 salariés)`}
                className="w-full p-3 rounded-lg border border-stone-300 text-xs font-mono bg-stone-50 focus:bg-white focus:outline-none focus:border-orange-500"
              />

              {pasteIgnoredPhones.length > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  Filtre anti-call-center actif : {pasteIgnoredPhones.join(', ')} détecté sur ≥ 3 cartes et ignoré automatiquement.
                </div>
              )}
            </div>

            <div className="lg:col-span-6 bg-white rounded-xl border border-stone-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-stone-900 tabular-nums">
                  Aperçu Nettoyé ({pastePreview.length})
                </h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={pastePreview.length === 0 || isAuditing}
                    onClick={() => handleBatchAudit('pastePreview')}
                    className="px-3 py-2 rounded-lg border border-stone-300 bg-stone-50 hover:bg-stone-100 disabled:opacity-40 text-stone-800 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    {isAuditing ? 'Audit...' : 'Audit IA & Nettoyage'}
                  </button>
                  <button
                    type="button"
                    disabled={pastePreview.length === 0}
                    onClick={() => handleDownloadPreviewCsv(pastePreview, 'extraction')}
                    className="px-3 py-2 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 disabled:opacity-40 text-stone-800 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Télécharger CSV
                  </button>
                  <button
                    type="button"
                    disabled={pastePreview.length === 0}
                    onClick={() => {
                      handleCommitCaptured(pastePreview, pasteSource || 'Extraction');
                      setPasteInput('');
                    }}
                    className="px-3.5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Upload className="w-4 h-4" />
                    Importer dans le portefeuille ({pastePreview.length})
                  </button>
                </div>
              </div>

              {pastePreview.length === 0 ? (
                <div className="p-10 text-center rounded-lg border border-dashed border-stone-300 text-xs text-stone-500">
                  Colle du contenu ou charge un fichier (.html, .csv, .json, .txt) à gauche : la normalisation téléphonique (+212 → 05/06/07), le filtrage email pro et la classification sectorielle s’affichent ici en temps réel.
                </div>
              ) : (
                <div className="max-h-[420px] overflow-y-auto divide-y divide-stone-100 border border-stone-200 rounded-lg">
                  {pastePreview.map((f) => {
                    const sec = SECTEURS_META[f.secteur];
                    const seg = SEGMENTS_COULEUR[sec.couleur];
                    return (
                      <div key={f.id} className="p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-stone-900 flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-sm ${seg.dotCls}`} aria-hidden="true" />
                            {f.societe}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${seg.badgeCls}`}>
                            {sec.label}
                          </span>
                        </div>
                        <p className="text-stone-600 tabular-nums">
                          {f.ville || 'Ville vide'} · {f.telephone || 'Sans tél'} · {f.email || 'Sans email'}
                          {f.contact ? ` · ${f.contact}` : ''}
                          {f.effectif ? ` · ${f.effectif} sal.` : ''}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ================================================================== */}
        {/* ONGLET 4 : DÉDUPLICATION INTELLIGENTE (PRIORITÉ NOM DE SOCIÉTÉ)    */}
        {/* ================================================================== */}
        {activeTab === 'dedup' && (
          <section className="bg-white rounded-xl border border-stone-200 p-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5 tabular-nums">
                  <GitMerge className="w-4 h-4 text-orange-600" />
                  Déduplication Intelligente MDM ({duplicateGroups.length} groupe{duplicateGroups.length > 1 ? 's' : ''})
                </h2>
                <p className="text-xs text-stone-500">
                  Priorité stricte au <strong>nom de société</strong> (normalisation SARL/SA/STE/Cabinet/accents/villes + rapprochement orthographique intelligent). Les adresses email partagées ne créent jamais de faux doublons.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <label className="inline-flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includePhoneOnlyDedup}
                      onChange={(e) => setIncludePhoneOnlyDedup(e.target.checked)}
                      className="rounded border-stone-300 text-orange-600 focus:ring-orange-500"
                    />
                    Inclure doublons par téléphone seul (contrôle secondaire)
                  </label>
                  {dismissedDedupKeys.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDismissedDedupKeys([])}
                      className="text-xs font-medium text-orange-700 hover:underline"
                    >
                      Réafficher {dismissedDedupKeys.length} groupe{dismissedDedupKeys.length > 1 ? 's' : ''} ignoré{dismissedDedupKeys.length > 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              </div>
              {duplicateGroups.length > 0 && (
                <button
                  type="button"
                  onClick={handleMergeAllDuplicates}
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
                >
                  <Layers className="w-4 h-4" />
                  Tout fusionner
                </button>
              )}
            </div>

            {duplicateGroups.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-medium text-emerald-800">
                Aucun doublon de société détecté dans le portefeuille actuel. Base propre prête à exporter.
              </div>
            ) : (
              <div className="space-y-3">
                {duplicateGroups.map((group) => {
                  const previewMerged = mergeFicheGroup(group.fiches);
                  const groupSignature = [...group.ids].sort().join('|');
                  return (
                    <div key={group.key} className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-amber-950 tabular-nums">
                            {group.fiches.length} fiches liées — {group.motif}
                          </span>
                          <span
                            className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                              group.confidence >= 95
                                ? 'bg-orange-600 text-white'
                                : group.confidence >= 84
                                ? 'bg-amber-200 text-amber-950'
                                : 'bg-stone-200 text-stone-800'
                            }`}
                          >
                            Fiabilité {group.confidence}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setDismissedDedupKeys((prev) =>
                                prev.includes(groupSignature) ? prev : [...prev, groupSignature]
                              );
                              notify('Groupe ignoré — ces sociétés restent distinctes.');
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold"
                          >
                            Pas un doublon
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMergeGroup(group)}
                            className="px-3.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1.5"
                          >
                            <GitMerge className="w-3.5 h-3.5" />
                            Fusionner en 1 clic
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {group.fiches.map((f) => (
                          <div key={f.id} className="p-2.5 rounded-lg bg-white border border-stone-200 text-xs space-y-0.5">
                            <p className="font-semibold text-stone-900 tabular-nums flex items-center gap-1.5">
                              {f.numeroFiche && (
                                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-700">
                                  {f.numeroFiche}
                                </span>
                              )}
                              <span>{f.societe} ({computeMaturityScore(f)}%)</span>
                            </p>
                            <p className="text-stone-600 tabular-nums">
                              {f.ville} · {f.telephone || '—'} · {f.email || '—'}
                            </p>
                            <p className="text-stone-500 tabular-nums">
                              Contact : {f.contact || '—'} · Eff. : {f.effectif || '—'} · Source : {f.source}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 tabular-nums">
                        <strong>Résultat fusionné :</strong> {previewMerged.societe} · {previewMerged.telephone || '—'}
                        {previewMerged.telephonesSupplementaires?.length
                          ? ` (+${previewMerged.telephonesSupplementaires.length} tél.)`
                          : ''}{' '}
                        · {previewMerged.email || '—'}
                        {previewMerged.emailsSupplementaires?.length
                          ? ` (+${previewMerged.emailsSupplementaires.length} mail)`
                          : ''}{' '}
                        · Contact : {previewMerged.contact || '—'} · Eff. : {previewMerged.effectif || '—'} · Sources :{' '}
                        {previewMerged.source}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ================================================================== */}
        {/* ONGLET : CLASSEMENT ÉQUIPE, ÉVOLUTION & PAYOUTS                    */}
        {/* ================================================================== */}
        {activeTab === 'team' && (
          <TeamPerformancePanel
            currentUserUid={cloudUser.uid}
            isSuperAdmin={isSuperAdmin}
            teamStats={teamStats}
            signedContracts={signedContracts}
            onAdminUpdateContract={isSuperAdmin ? handleAdminUpdateContract : undefined}
            onJumpToBadges={
              isSuperAdmin
                ? (uid) => {
                    setBadgesFocusUid(uid);
                    setActiveTab('badges');
                  }
                : undefined
            }
          />
        )}

        {/* ================================================================== */}
        {/* ONGLET : SUCCÈS, BADGES & RÉALISATIONS ORANGE PRO                  */}
        {/* ================================================================== */}
        {activeTab === 'badges' && (
          <AchievementsPanel
            currentUserUid={cloudUser.uid}
            currentUserName={currentUserDisplayName}
            isSuperAdmin={isSuperAdmin}
            myMetrics={myCollaboratorMetrics}
            teamStats={teamStats}
            initialSelectedUid={badgesFocusUid}
            onAdminToggleManualBadge={isSuperAdmin ? handleAdminToggleManualBadge : undefined}
          />
        )}

        {/* ================================================================== */}
        {/* ONGLET 5 : ADMINISTRATION UTILISATEURS (SUPER-ADMIN EXCLUSIF)      */}
        {/* ================================================================== */}
        {activeTab === 'admin' && isSuperAdmin && (
          <AdminUsersPanel
            adminUid={cloudUser.uid}
            adminEmail={cloudUser.email || ''}
            adminHasPasswordProvider={cloudUser.providerData.some((p) => p.providerId === 'password')}
            users={managedUsers}
            villesOptions={villesState.all}
            onNotify={notify}
          />
        )}
      </main>

      {/* ==================================================================== */}
      {/* MODAL ENRICHISSEMENT ASSISTÉ RAPIDE & MODE RAFALE                    */}
      {/* ==================================================================== */}
      {assistModalFiche && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Enrichissement Assisté — ${assistModalFiche.societe}`}
          className="fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-3 sm:p-4"
        >
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-stone-900 flex items-center flex-wrap gap-2">
                  <Globe className="w-4 h-4 text-orange-600" />
                  {assistModalFiche.numeroFiche && (
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-orange-50 text-orange-800 border border-orange-200">
                      {assistModalFiche.numeroFiche}
                    </span>
                  )}
                  <span>Enrichissement Assisté — {assistModalFiche.societe}</span>
                </h2>
                <p className="text-xs text-stone-500 mt-1 tabular-nums">
                  {SECTEURS_META[assistModalFiche.secteur].label} · {assistModalFiche.ville || 'Maroc'} · Décideur :{' '}
                  <strong className="text-stone-800">{assistModalFiche.contact || 'manquant'}</strong> · Eff. :{' '}
                  <strong className="text-stone-800">{assistModalFiche.effectif || 'manquant'}</strong>
                </p>
              </div>
              <button
                type="button"
                aria-label="Fermer Enrichissement Assisté"
                onClick={() => setAssistModalFiche(null)}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Coordonnées actuelles (Multi-téléphones & Multi-emails éditables) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs">
              <div className="space-y-1.5">
                <div className="font-bold text-stone-700 flex items-center justify-between">
                  <span>Téléphones ({(assistModalFiche.telephone ? 1 : 0) + (assistModalFiche.telephonesSupplementaires?.length || 0)})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {assistModalFiche.telephone ? (
                    <span className="px-2 py-0.5 rounded bg-white border border-stone-300 font-mono text-[11px] font-semibold text-stone-900">
                      {assistModalFiche.telephone}
                    </span>
                  ) : (
                    <span className="text-stone-400 italic text-[11px]">Aucun numéro</span>
                  )}
                  {(assistModalFiche.telephonesSupplementaires || []).map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-stone-200 font-mono text-[11px] text-stone-700"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => removeAdditionalContactFromFiche(assistModalFiche.id, 'phone', t)}
                        aria-label={`Supprimer ${t}`}
                        className="text-stone-400 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1 pt-0.5">
                  <input
                    type="text"
                    value={assistExtraPhoneDraft}
                    onChange={(e) => setAssistExtraPhoneDraft(e.target.value)}
                    placeholder="Ajouter un n° (05/06/07...)"
                    className="flex-1 min-w-0 px-2 py-1 rounded border border-stone-300 bg-white text-[11px] font-mono"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (addAdditionalContactToFiche(assistModalFiche.id, 'phone', assistExtraPhoneDraft)) {
                          setAssistExtraPhoneDraft('');
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (addAdditionalContactToFiche(assistModalFiche.id, 'phone', assistExtraPhoneDraft)) {
                        setAssistExtraPhoneDraft('');
                      }
                    }}
                    className="px-2 py-1 rounded bg-stone-900 text-white text-[11px] font-semibold"
                  >
                    + Tél
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="font-bold text-stone-700 flex items-center justify-between">
                  <span>Emails ({(assistModalFiche.email ? 1 : 0) + (assistModalFiche.emailsSupplementaires?.length || 0)})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {assistModalFiche.email ? (
                    <span className="px-2 py-0.5 rounded bg-white border border-stone-300 text-[11px] font-semibold text-stone-900 break-all">
                      {assistModalFiche.email}
                    </span>
                  ) : (
                    <span className="text-stone-400 italic text-[11px]">Aucun email</span>
                  )}
                  {(assistModalFiche.emailsSupplementaires || []).map((em) => (
                    <span
                      key={em}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-stone-200 text-[11px] text-stone-700 break-all"
                    >
                      {em}
                      <button
                        type="button"
                        onClick={() => removeAdditionalContactFromFiche(assistModalFiche.id, 'email', em)}
                        aria-label={`Supprimer ${em}`}
                        className="text-stone-400 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1 pt-0.5">
                  <input
                    type="email"
                    value={assistExtraEmailDraft}
                    onChange={(e) => setAssistExtraEmailDraft(e.target.value)}
                    placeholder="Ajouter un email pro..."
                    className="flex-1 min-w-0 px-2 py-1 rounded border border-stone-300 bg-white text-[11px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (addAdditionalContactToFiche(assistModalFiche.id, 'email', assistExtraEmailDraft)) {
                          setAssistExtraEmailDraft('');
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (addAdditionalContactToFiche(assistModalFiche.id, 'email', assistExtraEmailDraft)) {
                        setAssistExtraEmailDraft('');
                      }
                    }}
                    className="px-2 py-1 rounded bg-stone-900 text-white text-[11px] font-semibold"
                  >
                    + Mail
                  </button>
                </div>
              </div>
            </div>

            {lastVerifyDiag && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                {lastVerifyDiag}
              </div>
            )}

            {assistAiSummary && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>{assistAiSummary}</span>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs font-bold text-stone-700">
                  1. Lancer une recherche (Google Aperçu IA, LinkedIn, Annuaires) ou recherche IA directe :
                </p>
                {serverAiStatus.available && (
                  <button
                    type="button"
                    disabled={assistAiLoading}
                    onClick={() => void handleAssistAiWebSearch()}
                    className="px-2.5 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-orange-300 text-[11px] font-semibold flex items-center gap-1"
                  >
                    <Sparkles className={`w-3 h-3 ${assistAiLoading ? 'animate-spin' : ''}`} />
                    {assistAiLoading ? 'Recherche IA...' : 'Recherche Google IA directe'}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(
                    `"${assistModalFiche.societe}" "${assistModalFiche.ville || 'Maroc'}" téléphone email directeur`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold text-center"
                >
                  Google / Aperçu IA
                </a>
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(
                    `site:linkedin.com/in "${assistModalFiche.societe}" ${assistModalFiche.ville || 'Maroc'} gérant OR directeur OR fondateur`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-center"
                >
                  LinkedIn Décideur
                </a>
                <a
                  href={`https://www.telecontact.ma/trouver/index.php?nxo=moteurs&nxs=process&string=${encodeURIComponent(
                    assistModalFiche.societe
                  )}&ou=${encodeURIComponent(assistModalFiche.ville || '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg border border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-800 font-semibold text-center"
                >
                  Telecontact
                </a>
                <a
                  href={`https://www.kerix.net/fr/annuaire-entreprise/recherche.html?q=${encodeURIComponent(
                    `${assistModalFiche.societe} ${assistModalFiche.ville || ''}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg border border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-800 font-semibold text-center"
                >
                  Kerix Maroc
                </a>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label htmlFor="assist-paste" className="block text-xs font-bold text-stone-700">
                  2. Coller ici le contenu copié (Google Aperçu IA, Maps, LinkedIn, site web ou annuaire) :
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleAssistClipboardRead()}
                    className="px-2.5 py-1 rounded-md border border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-800 text-[11px] font-semibold flex items-center gap-1"
                  >
                    <ClipboardPaste className="w-3 h-3 text-orange-600" />
                    Coller
                  </button>
                  {assistPasteText && (
                    <button
                      type="button"
                      onClick={() => setAssistPasteText('')}
                      className="px-2 py-1 rounded-md text-[11px] text-stone-500 hover:text-stone-800"
                    >
                      Effacer
                    </button>
                  )}
                </div>
              </div>
              <textarea
                id="assist-paste"
                rows={6}
                value={assistPasteText}
                onPaste={handleAssistPasteEvent}
                onChange={(e) => setAssistPasteText(e.target.value)}
                placeholder="Collez ici l'Aperçu IA Google, la fiche Google Maps ou LinkedIn (Ctrl+V ou bouton Coller). Tous les numéros 05/06/07/+212, emails, décideur, rôle, effectif et site web sont détectés automatiquement, même si la fiche a déjà un numéro."
                className="w-full p-3 rounded-lg border border-stone-300 focus:border-orange-500 focus:outline-none text-xs text-stone-900"
              />

              {/* Prévisualisation en direct des champs détectés */}
              {assistLivePreview && (
                <div
                  data-testid="assist-live-preview"
                  className="p-2.5 rounded-lg bg-orange-50/70 border border-orange-200 text-[11px] text-stone-800 space-y-1"
                >
                  <div className="font-bold text-orange-900">
                    Aperçu détecté en direct (prêt à enregistrer) :
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <span>
                      Tél :{' '}
                      <strong className="font-mono">
                        {assistLivePreview.phones.length > 0 ? assistLivePreview.phones.join(', ') : '—'}
                      </strong>
                    </span>
                    <span>
                      Emails :{' '}
                      <strong>
                        {assistLivePreview.emails.length > 0 ? assistLivePreview.emails.join(', ') : '—'}
                      </strong>
                    </span>
                    {assistLivePreview.contact && (
                      <span>
                        Décideur : <strong>{assistLivePreview.contact}</strong>
                        {assistLivePreview.role ? ` (${assistLivePreview.role})` : ''}
                      </span>
                    )}
                    {assistLivePreview.effectif && (
                      <span>
                        Effectif : <strong>{assistLivePreview.effectif}</strong>
                      </span>
                    )}
                    {assistLivePreview.siteWeb && (
                      <span>
                        Site : <strong>{assistLivePreview.siteWeb}</strong>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => {
                  setShowApiHub(true);
                  setAssistModalFiche(null);
                }}
                className="text-xs font-semibold text-orange-700 hover:underline flex items-center gap-1"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Hub API ({activeApiCount})
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleNextIncompleteRafale}
                  className="px-3 py-2 rounded-lg border border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-900 text-xs font-semibold flex items-center gap-1 tabular-nums"
                >
                  <span>Suivante</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span className="text-[11px] opacity-75">({incompleteFilteredFiches.length})</span>
                </button>
                {serverAiStatus.available && (
                  <button
                    type="button"
                    disabled={assistAiLoading || !assistPasteText.trim()}
                    onClick={() => void handleAssistAiParse()}
                    className="px-3 py-2 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 disabled:opacity-50 text-stone-900 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Sparkles className={`w-3.5 h-3.5 text-orange-600 ${assistAiLoading ? 'animate-spin' : ''}`} />
                    Extraction IA (Gemini)
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleApplyAssistedPaste}
                  className="px-4 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5 text-orange-400" />
                  Extraire &amp; Compléter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL STUDIO EMAIL IA & SKILLS DE RÉDACTION PERSONNALISÉS            */}
      {/* ==================================================================== */}
      {emailModalFiche && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Studio Email IA & Skills — ${emailModalFiche.societe}`}
          className="fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-3 sm:p-4"
        >
          <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-orange-600" />
                  Studio Email IA &amp; Skills — {emailModalFiche.societe}
                </h2>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-stone-100 text-stone-700">
                    {SECTEURS_META[emailModalFiche.secteur].label}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-stone-100 text-stone-700">
                    {emailModalFiche.ville || 'Maroc'}
                  </span>
                  {emailModalFiche.contact && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-800">
                      {emailModalFiche.contact}
                      {emailModalFiche.role ? ` (${emailModalFiche.role})` : ''}
                    </span>
                  )}
                  {emailModalFiche.effectif && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-stone-100 text-stone-700 tabular-nums">
                      {emailModalFiche.effectif} sal.
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-orange-50 text-orange-800">
                    {getOrangeProRecommendation(emailModalFiche).tier}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-800">
                    {emailModalFiche.statut}
                  </span>
                </div>
              </div>
              <button
                type="button"
                aria-label="Fermer Studio Email"
                onClick={() => setEmailModalFiche(null)}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Gestionnaire de Skills de rédaction */}
            <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                  <span className="text-xs font-bold text-stone-800">Skills de rédaction ({emailSkills.length})</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <input
                    ref={skillFileInputRef}
                    type="file"
                    accept=".md,.txt"
                    onChange={handleImportSkillFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => skillFileInputRef.current?.click()}
                    className="px-2.5 py-1 rounded-md border border-stone-300 bg-white hover:bg-stone-100 text-[11px] font-semibold text-stone-700 flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" />
                    Importer .md/.txt
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSkill({ ...activeSkill });
                      setShowSkillEditor(true);
                    }}
                    className="px-2.5 py-1 rounded-md border border-stone-300 bg-white hover:bg-stone-100 text-[11px] font-semibold text-stone-700 flex items-center gap-1"
                  >
                    <FileText className="w-3 h-3" />
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSkill({
                        id: `custom_${Date.now()}`,
                        nom: '',
                        description: '',
                        role: 'Conseiller Commercial B2B Orange Pro Maroc',
                        regles: '',
                        ctaStyle: '',
                      });
                      setShowSkillEditor(true);
                    }}
                    className="px-2.5 py-1 rounded-md bg-stone-900 hover:bg-stone-800 text-[11px] font-semibold text-white flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Nouveau Skill
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {emailSkills.map((sk) => (
                  <div
                    key={sk.id}
                    className={`flex items-start justify-between gap-2 p-2.5 rounded-lg border transition-colors ${
                      activeSkill.id === sk.id
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-white text-stone-800 border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSkillId(sk.id);
                        regenerateLocalEmail(emailModalFiche, emailCycle, emailTon, emailSignature, sk);
                      }}
                      className="flex-1 text-left"
                    >
                      <p className="text-xs font-semibold">{sk.nom}</p>
                      <p className={`text-[10px] mt-0.5 ${activeSkill.id === sk.id ? 'text-stone-300' : 'text-stone-500'}`}>
                        {sk.description}
                      </p>
                    </button>
                    {!sk.builtin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSkill(sk.id)}
                        aria-label={`Supprimer skill ${sk.nom}`}
                        className={`p-1 rounded ${
                          activeSkill.id === sk.id ? 'text-stone-300 hover:text-white' : 'text-stone-400 hover:text-red-600'
                        }`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {showSkillEditor && editingSkill && (
                <div className="mt-2 p-3 rounded-lg border border-orange-200 bg-orange-50/40 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900">Configurer le Skill de rédaction</span>
                    <button
                      type="button"
                      aria-label="Fermer éditeur de skill"
                      onClick={() => {
                        setShowSkillEditor(false);
                        setEditingSkill(null);
                      }}
                      className="text-stone-500 hover:text-stone-800"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      aria-label="Nom du skill"
                      value={editingSkill.nom}
                      onChange={(e) => setEditingSkill({ ...editingSkill, nom: e.target.value })}
                      placeholder="Nom du skill (ex. Chasse BTP Chantiers)"
                      className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white"
                    />
                    <input
                      type="text"
                      aria-label="Description du skill"
                      value={editingSkill.description}
                      onChange={(e) => setEditingSkill({ ...editingSkill, description: e.target.value })}
                      placeholder="Courte description"
                      className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white"
                    />
                  </div>
                  <input
                    type="text"
                    aria-label="Posture et rôle"
                    value={editingSkill.role}
                    onChange={(e) => setEditingSkill({ ...editingSkill, role: e.target.value })}
                    placeholder="Posture / Rôle"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white"
                  />
                  <textarea
                    rows={3}
                    aria-label="Règles et consignes du skill"
                    value={editingSkill.regles}
                    onChange={(e) => setEditingSkill({ ...editingSkill, regles: e.target.value })}
                    placeholder="Règles & Consignes du Skill..."
                    className="w-full p-2.5 rounded-lg border border-stone-300 bg-white"
                  />
                  <input
                    type="text"
                    aria-label="Style de CTA"
                    value={editingSkill.ctaStyle}
                    onChange={(e) => setEditingSkill({ ...editingSkill, ctaStyle: e.target.value })}
                    placeholder="Style de CTA (ex. créneau de 10 min)"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowSkillEditor(false);
                        setEditingSkill(null);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-stone-700 font-semibold"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSkill}
                      className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Enregistrer le Skill
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 7 Situations / Cycles de contrat */}
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-stone-700">Situation / Cycle de contrat (7 scénarios)</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {CYCLES_CONTRAT.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setEmailCycle(c.id);
                      regenerateLocalEmail(emailModalFiche, c.id, emailTon, emailSignature, activeSkill);
                    }}
                    className={`p-2 rounded-lg border text-left transition-colors ${
                      emailCycle === c.id
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-stone-50 text-stone-800 border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    <p className="text-xs font-semibold leading-tight">{c.label}</p>
                    <p className={`text-[10px] mt-0.5 leading-tight ${emailCycle === c.id ? 'text-orange-100' : 'text-stone-500'}`}>
                      {c.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Sélecteur de ton, Consigne ponctuelle libre & Rédaction IA Multi-Fournisseurs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label htmlFor="email-ton" className="block font-semibold text-stone-600 mb-1">
                  Ton
                </label>
                <select
                  id="email-ton"
                  value={emailTon}
                  onChange={(e) => {
                    const t = e.target.value as TonEmail;
                    setEmailTon(t);
                    regenerateLocalEmail(emailModalFiche, emailCycle, t, emailSignature, activeSkill);
                  }}
                  className="w-full px-2.5 py-2 rounded-lg border border-stone-300 bg-white"
                >
                  <option value="terrain">Direct terrain</option>
                  <option value="executif">Exécutif / Direction</option>
                  <option value="court">Ultra-court 4 lignes</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="email-custom" className="block font-semibold text-stone-600 mb-1">
                  Consigne ponctuelle libre (Routeur IA : Mistral → OpenRouter → Gemini → Groq)
                </label>
                <div className="flex gap-1.5">
                  <input
                    id="email-custom"
                    type="text"
                    value={emailCustomPrompt}
                    onChange={(e) => setEmailCustomPrompt(e.target.value)}
                    placeholder="Ex. proposer un RDV jeudi matin à 10h, mentionner la Fibre 100M..."
                    className="flex-1 px-2.5 py-2 rounded-lg border border-stone-300"
                  />
                  <button
                    type="button"
                    disabled={isGeneratingEmail}
                    onClick={handleGenerateEmailWithAI}
                    className="px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white font-semibold flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                    {isGeneratingEmail ? 'Rédaction...' : 'Rédiger IA + Skill'}
                  </button>
                </div>
              </div>
            </div>

            {/* Édition Objet, Message & Signature */}
            <div className="space-y-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 text-stone-600">
                <span>
                  <strong>À :</strong> {emailModalFiche.email || 'Aucun email sur la fiche (copie disponible)'}
                </span>
                <span className="text-[11px] text-stone-500">
                  Moteur : <strong className="text-stone-700">{emailProviderUsed}</strong> · Offre :{' '}
                  <strong className="text-stone-700">{getOrangeProRecommendation(emailModalFiche).offre}</strong>
                </span>
              </div>
              <div>
                <label htmlFor="email-objet" className="block font-semibold text-stone-600 mb-1">
                  Objet
                </label>
                <input
                  id="email-objet"
                  type="text"
                  value={emailObjet}
                  onChange={(e) => setEmailObjet(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900"
                />
              </div>
              <div>
                <label htmlFor="email-corps" className="block font-semibold text-stone-600 mb-1">
                  Message
                </label>
                <textarea
                  id="email-corps"
                  rows={8}
                  value={emailCorps}
                  onChange={(e) => setEmailCorps(e.target.value)}
                  className="w-full p-3 rounded-lg border border-stone-300 text-sm text-stone-900 leading-relaxed"
                />
              </div>
              <div>
                <label htmlFor="email-sig" className="block font-semibold text-stone-600 mb-1">
                  Signature
                </label>
                <input
                  id="email-sig"
                  type="text"
                  value={emailSignature}
                  onChange={(e) => setEmailSignature(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-xs"
                />
              </div>
            </div>

            {/* Actions directes Envoi & CRM */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-200">
              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
                    emailModalFiche.email || ''
                  )}&su=${encodeURIComponent(emailObjet)}&body=${encodeURIComponent(emailCorps)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Ouvrir dans Gmail
                </a>
                {emailModalFiche.email && (
                  <a
                    href={`mailto:${emailModalFiche.email}?subject=${encodeURIComponent(
                      emailObjet
                    )}&body=${encodeURIComponent(emailCorps)}`}
                    className="px-3 py-2 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-semibold"
                  >
                    App Mail
                  </a>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    await copyTextSafe(`Objet : ${emailObjet}\n\n${emailCorps}`);
                    notify('Objet et message copiés dans le presse-papiers.');
                  }}
                  className="px-3 py-2 rounded-lg border border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-800 text-xs font-semibold flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copier
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextStatut: StatutCRM =
                    emailCycle === 'relance_devis' ? 'Devis envoyé' : 'Appel en cours';
                  setFiches((prev) =>
                    prev.map((x) => (x.id === emailModalFiche.id ? { ...x, statut: nextStatut } : x))
                  );
                  notify(`Statut CRM mis à jour : ${nextStatut}`);
                  setEmailModalFiche(null);
                }}
                className="px-3.5 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold"
              >
                Marquer envoyé &amp; fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL SAISIE RAPIDE D'UNE ENTREPRISE                                 */}
      {/* ==================================================================== */}
      {showQuickAdd && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Saisie rapide d'une entreprise"
          className="fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-stone-900">Nouvelle fiche entreprise</h2>
                <span className="px-2 py-0.5 rounded bg-orange-50 border border-orange-200 font-mono text-[11px] font-bold text-orange-800">
                  {generateNextNumeroFiche(fiches)}
                </span>
              </div>
              <button
                type="button"
                aria-label="Fermer saisie rapide"
                onClick={() => setShowQuickAdd(false)}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleQuickAdd} className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label htmlFor="qf-soc" className="block font-semibold text-stone-600 mb-1">
                  Société *
                </label>
                <input
                  id="qf-soc"
                  required
                  value={quickForm.societe}
                  onChange={(e) => setQuickForm({ ...quickForm, societe: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300"
                />
              </div>
              <div>
                <label htmlFor="qf-sec" className="block font-semibold text-stone-600 mb-1">
                  Secteur
                </label>
                <select
                  id="qf-sec"
                  value={quickForm.secteur}
                  onChange={(e) => setQuickForm({ ...quickForm, secteur: e.target.value as SecteurCode })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white"
                >
                  {(Object.keys(SECTEURS_META) as SecteurCode[]).map((c) => (
                    <option key={c} value={c}>
                      {SECTEURS_META[c].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="qf-statut" className="block font-semibold text-stone-600 mb-1">
                  Étape Pipeline
                </label>
                <select
                  id="qf-statut"
                  value={quickAddStatut}
                  onChange={(e) => setQuickAddStatut(e.target.value as StatutCRM)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white"
                >
                  {STATUTS_CRM.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="qf-ville" className="block font-semibold text-stone-600 mb-1">
                  Ville
                </label>
                <input
                  id="qf-ville"
                  list="quick-villes"
                  value={quickForm.ville}
                  onChange={(e) => setQuickForm({ ...quickForm, ville: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300"
                />
                <datalist id="quick-villes">
                  {allVilles.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </div>
              <div>
                <label htmlFor="qf-eff" className="block font-semibold text-stone-600 mb-1">
                  Effectif (vide si inconnu)
                </label>
                <input
                  id="qf-eff"
                  type="number"
                  min={1}
                  value={quickForm.effectif}
                  onChange={(e) => setQuickForm({ ...quickForm, effectif: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="qf-tel" className="block font-semibold text-stone-600 mb-1">
                  Téléphone principal
                </label>
                <input
                  id="qf-tel"
                  value={quickForm.telephone}
                  onChange={(e) => setQuickForm({ ...quickForm, telephone: e.target.value })}
                  placeholder="+212 ou 05/06/07..."
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 font-mono"
                />
              </div>
              <div>
                <label htmlFor="qf-tel-extra" className="block font-semibold text-stone-600 mb-1">
                  Autres numéros (optionnel)
                </label>
                <input
                  id="qf-tel-extra"
                  value={quickForm.telephonesSupplementaires}
                  onChange={(e) =>
                    setQuickForm({ ...quickForm, telephonesSupplementaires: e.target.value })
                  }
                  placeholder="Ex: 0661..., 0535..."
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 font-mono"
                />
              </div>
              <div>
                <label htmlFor="qf-mail" className="block font-semibold text-stone-600 mb-1">
                  Email pro principal
                </label>
                <input
                  id="qf-mail"
                  type="email"
                  value={quickForm.email}
                  onChange={(e) => setQuickForm({ ...quickForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300"
                />
              </div>
              <div>
                <label htmlFor="qf-mail-extra" className="block font-semibold text-stone-600 mb-1">
                  Autres emails (optionnel)
                </label>
                <input
                  id="qf-mail-extra"
                  value={quickForm.emailsSupplementaires}
                  onChange={(e) =>
                    setQuickForm({ ...quickForm, emailsSupplementaires: e.target.value })
                  }
                  placeholder="Ex: commercial@..., dg@..."
                  className="w-full px-3 py-2 rounded-lg border border-stone-300"
                />
              </div>
              <div>
                <label htmlFor="qf-contact" className="block font-semibold text-stone-600 mb-1">
                  Contact décideur
                </label>
                <input
                  id="qf-contact"
                  value={quickForm.contact}
                  onChange={(e) => setQuickForm({ ...quickForm, contact: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300"
                />
              </div>
              <div>
                <label htmlFor="qf-role" className="block font-semibold text-stone-600 mb-1">
                  Rôle
                </label>
                <input
                  id="qf-role"
                  value={quickForm.role}
                  onChange={(e) => setQuickForm({ ...quickForm, role: e.target.value })}
                  placeholder="Gérant, DG, Dr, Me..."
                  className="w-full px-3 py-2 rounded-lg border border-stone-300"
                />
              </div>
              <div className="col-span-2">
                <label htmlFor="qf-source" className="block font-semibold text-stone-600 mb-1">
                  Source
                </label>
                <input
                  id="qf-source"
                  value={quickForm.source}
                  onChange={(e) => setQuickForm({ ...quickForm, source: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300"
                />
              </div>
              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(false)}
                  className="px-4 py-2 rounded-lg border border-stone-300 font-semibold text-stone-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmation Signature Orange Pro & Calcul Payout */}
      <SignContractModal
        target={signContractTarget}
        isSuperAdmin={isSuperAdmin}
        submitting={signingContractBusy}
        onClose={() => setSignContractTarget(null)}
        onConfirm={handleConfirmSignContract}
      />

      {/* Copilote Commercial IA Orange Pro (Gemini intégré côté serveur) */}
      <AiCopilotDrawer
        open={showAiCopilot}
        onClose={() => setShowAiCopilot(false)}
        fiches={accessibleFiches}
        focusedFiche={copilotFiche}
        onClearFocusedFiche={() => setCopilotFiche(null)}
        aiAvailable={serverAiStatus.available}
        aiModel={serverAiStatus.model}
        onOpenEmailStudio={openEmailStudio}
        onMoveFiche={handleMoveFicheKanban}
        onSelectFicheForBrief={(f) => setCopilotFiche(f)}
      />
    </div>
  );
}
