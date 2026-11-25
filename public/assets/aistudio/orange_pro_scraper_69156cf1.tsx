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
} from 'lucide-react';

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
  // 9 colonnes obligatoires CSV
  societe: string;
  secteur: SecteurCode;
  ville: string;
  telephone: string;
  email: string;
  contact: string;
  role: string;
  source: string;
  effectif: string; // Entier sous forme de chaîne ou "" si inconnu (jamais inventé)
  // Champs CRM & enrichissement interne
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
    cardBorder: string;
  }
> = {
  bleu: {
    label: 'Bleu',
    description: 'Fiduciaires, Cliniques, Notaires',
    secteurs: ['fiduciaire', 'clinique', 'notaire'],
    badgeCls: 'bg-blue-50 text-blue-800 border-blue-200',
    dotCls: 'bg-blue-600',
    cardBorder: 'border-l-4 border-l-blue-600',
  },
  vert: {
    label: 'Vert',
    description: 'Immobilier & Promoteurs',
    secteurs: ['immobilier'],
    badgeCls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dotCls: 'bg-emerald-600',
    cardBorder: 'border-l-4 border-l-emerald-600',
  },
  orange: {
    label: 'Orange',
    description: 'Riads, Hôtels & Maisons d’hôtes',
    secteurs: ['riad_hotellerie'],
    badgeCls: 'bg-orange-50 text-orange-800 border-orange-200',
    dotCls: 'bg-orange-500',
    cardBorder: 'border-l-4 border-l-orange-500',
  },
  jaune: {
    label: 'Jaune',
    description: 'Auto-écoles',
    secteurs: ['auto_ecole'],
    badgeCls: 'bg-amber-50 text-amber-800 border-amber-200',
    dotCls: 'bg-amber-500',
    cardBorder: 'border-l-4 border-l-amber-500',
  },
  violet: {
    label: 'Violet',
    description: 'PME, Industrie, BTP, Gros, Écoles',
    secteurs: ['pme', 'industrie', 'btp', 'gros', 'enseignement'],
    badgeCls: 'bg-violet-50 text-violet-800 border-violet-200',
    dotCls: 'bg-violet-600',
    cardBorder: 'border-l-4 border-l-violet-600',
  },
  cyan: {
    label: 'Cyan',
    description: 'Libéral, Labos, Pharmacies, Commerces',
    secteurs: ['liberal', 'commerce'],
    badgeCls: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    dotCls: 'bg-cyan-600',
    cardBorder: 'border-l-4 border-l-cyan-600',
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
  'Fès',
  'Rabat',
  'Salé',
  'Témara',
  'Casablanca',
  'Mohammedia',
  'Kénitra',
  'Tanger',
  'Tétouan',
  'Marrakech',
  'Agadir',
  'Oujda',
  'Sefrou',
  'Khémisset',
  'Sidi Kacem',
  'Sidi Slimane',
  'Béni Mellal',
  'Khénifra',
  'Errachidia',
  'El Jadida',
  'Safi',
  'Essaouira',
  'Nador',
  'Settat',
  'Berrechid',
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
    .replace(/\b(sarl|s\.a\.r\.l|sarl au|sa|s\.a|sas|snc|ste|sté|societe|ets|etablissement|cabinet|groupe|group|maroc|ma)\b/g, ' ')
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
  // Convertir lien Markdown [Nom Société](https://...) -> Nom Société
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
  // Rejeter phrases descriptives se terminant par ponctuation de phrase avec beaucoup de mots
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

// Extraction texte propre depuis HTML (préserve tel:/mailto:, supprime chrome & balises, décode entités)
export function htmlToReadableText(raw: string): string {
  if (!raw) return '';
  let s = raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ');

  // Extraire les href tel: et mailto: avant de retirer les balises
  s = s
    .replace(/href\s*=\s*["']mailto:([^"'?]+)/gi, ' $1 ')
    .replace(/href\s*=\s*["']tel:([^"']+)/gi, ' $1 ');

  // Retirer balises de structure en préservant les retours à la ligne
  s = s
    .replace(/<\/?(?:p|div|li|tr|td|th|br|h[1-6]|section|article|dd|dt)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  // Décoder entités HTML fréquentes
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

// Isole les fenêtres de texte qui concernent réellement la société cible (évite les numéros d'autres entreprises)
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
  // Prioriser un email dont le domaine ou préfixe correspond au nom de la société
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

const EXCLUDED_EMAIL_PREFIXES = ['noreply', 'no-reply', 'donotreply', 'mailer-daemon', 'abuse', 'postmaster', 'webmaster', 'privacy', 'support@telecontact'];

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

  // Règles de priorité métier strictes (évite les collisions fréquentes au Maroc)
  if (scores.auto_ecole && scores.enseignement) {
    scores.auto_ecole += 8; // "Auto-école" prime toujours sur "école"
  }
  if (scores.fiduciaire && scores.pme) {
    scores.fiduciaire += 4; // "Fiduciaire / Conseil fiscal" prime sur "PME conseil"
  }
  if (scores.clinique && scores.liberal) {
    scores.clinique += 4; // "Clinique / Polyclinique" prime sur cabinet individuel
  }

  // Indices compacts de domaine email uniquement si aucun mot-clé fort n'a scoré
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
  // Nettoyage Markdown / Jina Reader (r.jina.ai) & boilerplate
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
    const flashModels = list
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
        // Prioriser les modèles standard (non-lite) puis flash-lite, du plus récent au plus ancien
        const aLite = /lite/i.test(a) ? 1 : 0;
        const bLite = /lite/i.test(b) ? 1 : 0;
        if (aLite !== bLite) return aLite - bLite;
        return b.localeCompare(a, undefined, { numeric: true });
      });
    return flashModels;
  } catch {
    return [];
  }
}

async function callGeminiAutoModel(
  apiKey: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal
): Promise<{
  ok: boolean;
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
  if (!key) return { ok: false, model: '', data: null, error: 'Clé API vide.' };

  const initialCandidates = Array.from(
    new Set(
      [
        cachedWorkingGeminiModel,
        'gemini-3.8-flash',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-3.0-flash',
      ].filter(Boolean)
    )
  );

  let lastErr = '';
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
      if (res.ok) {
        cachedWorkingGeminiModel = model;
        const data = await res.json();
        return { ok: true, model, data, error: '' };
      }
      const errJson = await res.json().catch(() => ({}));
      lastErr = errJson?.error?.message || `HTTP ${res.status}`;
      // Si la clé est invalide (401/403 API_KEY_INVALID), inutile de tester d'autres modèles
      if (res.status === 401 || /API key not valid|API_KEY_INVALID/i.test(lastErr)) {
        return { ok: false, model, data: null, error: lastErr };
      }
    }
    return null;
  };

  const firstAttempt = await tryModels(initialCandidates);
  if (firstAttempt) return firstAttempt;

  // Découverte dynamique des modèles actifs sur le compte si les noms statiques ont évolué
  const discovered = (await discoverLatestFlashModel(key, signal)).filter((m) => !initialCandidates.includes(m));
  if (discovered.length > 0) {
    const secondAttempt = await tryModels(discovered.slice(0, 3));
    if (secondAttempt) return secondAttempt;
  }

  return { ok: false, model: '', data: null, error: lastErr || 'Aucun modèle Gemini compatible trouvé.' };
}

export async function auditAndCleanAllRowsWithAI(
  rows: FicheEntreprise[],
  geminiApiKey: string
): Promise<{ cleaned: FicheEntreprise[]; removedCount: number; correctedSecteurCount: number; normalizedCount: number; usedAI: boolean }> {
  let removedCount = 0;
  let correctedSecteurCount = 0;
  let normalizedCount = 0;
  let usedAI = false;

  // Étape 1 : Règles déterministes strictes
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

  // Étape 2 : Audit par lots Gemini AI (si clé API renseignée par l'utilisateur)
  if (!geminiApiKey.trim() || survivors.length === 0) {
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

      const gRes = await callGeminiAutoModel(geminiApiKey, {
        contents: [{ parts: [{ text: prompt }] }],
      });
      if (gRes.ok && gRes.data) {
        const parts = gRes.data?.candidates?.[0]?.content?.parts || [];
        const rawTxt = parts.map((p) => p.text || '').join('\n');
        const arrMatch = rawTxt.match(/\[[\s\S]*\]/);
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
  // Trier du plus long au plus court pour matcher "Moulay Idriss Zerhoun" avant "Moulay"
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

function isPlausiblePersonName(name: string): boolean {
  const clean = (name || '').trim().replace(/[.,;:()|]+$/g, '');
  if (clean.length < 4 || clean.length > 48 || /\d/.test(clean)) return false;
  const parts = clean.split(/\s+/);
  if (parts.length < 2 || parts.length > 4) return false;
  const badCount = parts.filter((p) => NON_PERSON_WORDS.has(stripAccents(p))).length;
  if (badCount >= parts.length - 0) return false;
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
        if (/^by\s+/i.test(m[0])) {
          return { contact: rawName, role: p.role };
        }
        const full = /^(Dr|Me|Maître|Maitre)/i.test(prefix) ? `${prefix} ${rawName}` : rawName;
        return { contact: full, role: p.role || prefix };
      }
    }
  }

  // Ordre inversé très fréquent sur LinkedIn / Google / sites web : "Ahmed Benali - Gérant" ou "Karim Tazi, Directeur Général"
  const invertedRx = /\b([A-ZÀ-Ý][a-zà-ÿ'-]{2,}\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ'-]{2,}(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ'-]{2,})?)\s*(?:[-–—,|•]|\()\s*(Gérant|Gérante|Directeur Général|Directrice Générale|Directeur|Directrice|Dirigeant|Président|PDG|DG|Fondateur|Fondatrice|Associé|Expert-Comptable|Architecte|Notaire|Avocat|Avocate|Pharmacien|Médecin|Manager|Responsable)/g;
  let inv: RegExpExecArray | null;
  while ((inv = invertedRx.exec(cleanText)) !== null) {
    const rawName = (inv[1] || '').trim();
    const role = (inv[2] || '').trim();
    if (isPlausiblePersonName(rawName)) {
      return { contact: rawName, role };
    }
  }

  // Repli intelligent depuis un email nominatif (ex: ahmed.benali@entreprise.ma)
  if (emailHint && emailHint.includes('@')) {
    const localPart = emailHint.split('@')[0].toLowerCase();
    const genericLocal = /^(contact|info|infos|admin|direction|commercial|accueil|secretariat|rh|support|service|devis|ventes|hello|bonjour|bureau|cabinet|comptabilite|compta|facturation|marketing|communication|recrutement|web|mail|agence|clinique|pharmacie|hotel|riad|reservation|booking)$/;
    const sepMatch = localPart.match(/^([a-z]{3,})[._-]([a-z]{3,})$/);
    if (sepMatch && !genericLocal.test(sepMatch[1]) && !genericLocal.test(sepMatch[2])) {
      const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
      const candidate = `${cap(sepMatch[1])} ${cap(sepMatch[2])}`;
      if (isPlausiblePersonName(candidate)) {
        return { contact: candidate, role: 'Contact identifié' };
      }
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
      badgeCls: 'bg-slate-900 text-amber-50',
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

export function makeId(): string {
  return 'op_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
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

    // Extraire pagination & liens de détail avant suppression des conteneurs de navigation
    doc.querySelectorAll('a[href]').forEach((a) => {
      registerLink(a.getAttribute('href') || '', a.textContent || '');
    });

    // Isolation chirurgicale DOM : supprimer bruit global, formulaires, cookies, sidebars
    doc
      .querySelectorAll(
        'header, nav, footer, aside, form, script, style, noscript, iframe, svg, .sidebar, .related, .similar, .cookie, #cookie, [class*="cookie"], [class*="consent"], [class*="banner"], [role="navigation"], [role="banner"], [role="contentinfo"]'
      )
      .forEach((el) => el.remove());

    // Détection élargie des cartes sociétés sur la page
    const cardSelectors = [
      'article',
      '[itemtype*="Organization"]',
      '[itemtype*="LocalBusiness"]',
      '.card',
      '.listing',
      '.result',
      '.search-result',
      '.pro-card',
      '.company',
      '.entreprise',
      '.fiche',
      '.item',
      'li.result-item',
      'section',
      'tr',
    ].join(', ');

    let rawCards = Array.from(doc.querySelectorAll(cardSelectors)).filter((el) => {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      // Éviter les conteneurs parents qui englobent toute la page
      if (t.length < 15 || t.length > 2200) return false;
      const nestedCards = el.querySelectorAll('article, .card, .listing, .result, .entreprise').length;
      return nestedCards === 0;
    });

    // Repli : découper par blocs de titres (h2/h3/h4) si aucune classe carte standard
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

      const phoneMatches = text.match(/(?:(?:\+|00)212[\s.-]?|0)[567](?:[\s.-]?\d){8}/g) || [];
      const phones = Array.from(new Set(phoneMatches.map(normalizeMoroccanPhone).filter(Boolean)));
      const emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      const email = emailMatches.map(normalizeProEmail).find(Boolean) || '';
      const { contact, role } = extractDecideurFromText(text);
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
    // Extraction Markdown / Jina Reader (r.jina.ai) & Texte brut collé
    const mdLinkRx = /\[([^\]]{1,120})\]\((https?:\/\/[^)\s]+)\)/g;
    let mLink: RegExpExecArray | null;
    while ((mLink = mdLinkRx.exec(trimmed)) !== null) {
      registerLink(mLink[2], mLink[1]);
    }
    const bareUrls = trimmed.match(/https?:\/\/[^\s)"'>]+/g) || [];
    bareUrls.forEach((u) => registerLink(u, ''));

    // Découpage intelligent par titres Markdown (## / ###), liens société ou paragraphes
    const chunks = trimmed
      .split(/\n{2,}|(?=^#{1,4}\s+)|(?=^\*\*[^*]{3,80}\*\*)/m)
      .filter((c) => c.trim().length >= 6);
    const blocks = chunks.length >= 2 ? chunks : trimmed.split(/\n/).filter((l) => l.trim().length >= 6);

    blocks.forEach((chunk) => {
      const lines = chunk
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length === 0) return;

      // Priorité : titre Markdown ou lien Markdown [Société](url) en tête de bloc
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

      const phoneMatches = chunk.match(/(?:(?:\+|00)212[\s.-]?|0)[567](?:[\s.-]?\d){8}/g) || [];
      const phone = phoneMatches.map(normalizeMoroccanPhone).find(Boolean) || '';
      const emailMatches = chunk.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      const email = emailMatches.map(normalizeProEmail).find(Boolean) || '';
      const { contact, role } = extractDecideurFromText(chunk);
      const effectif = extractEffectifFromText(chunk);
      const detectedVille = detectVilleInText(chunk, villesCibles);

      candidates.push({
        id: makeId(),
        societe: name,
        secteur: inferSecteur(`${name} ${chunk}`, 'pme', email),
        ville: detectedVille,
        telephone: phone,
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

  // Filtre de fréquence anti-call-center : numéro présent sur >= 3 cartes ignoré
  const phoneCounts: Record<string, number> = {};
  candidates.forEach((c) => {
    if (c.telephone) phoneCounts[c.telephone] = (phoneCounts[c.telephone] || 0) + 1;
  });
  const ignoredCallCenterPhones = Object.entries(phoneCounts)
    .filter(([, count]) => count >= 3)
    .map(([phone]) => phone);

  // Nettoyage automatique post-extraction strict avant Aperçu Extraction
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
  ids: string[];
  fiches: FicheEntreprise[];
}

export function findDuplicateGroups(fiches: FicheEntreprise[]): DuplicateGroup[] {
  const parent: Record<string, string> = {};
  const motifMap: Record<string, string> = {};
  fiches.forEach((f) => (parent[f.id] = f.id));

  const find = (x: string): string => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a: string, b: string, motif: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) {
      parent[rb] = ra;
      motifMap[ra] = motifMap[ra] || motif;
    }
  };

  const byName = new Map<string, string>();
  const byPhone = new Map<string, string>();
  const byEmail = new Map<string, string>();

  for (const f of fiches) {
    const nName = normalizeCompanyForDedup(f.societe);
    if (nName.length >= 3) {
      if (byName.has(nName)) union(byName.get(nName)!, f.id, 'Nom normalisé identique');
      else byName.set(nName, f.id);
    }
    if (f.telephone) {
      if (byPhone.has(f.telephone)) union(byPhone.get(f.telephone)!, f.id, 'Téléphone identique');
      else byPhone.set(f.telephone, f.id);
    }
    if (f.email) {
      if (byEmail.has(f.email)) union(byEmail.get(f.email)!, f.id, 'Email exact identique');
      else byEmail.set(f.email, f.id);
    }
  }

  const buckets = new Map<string, FicheEntreprise[]>();
  fiches.forEach((f) => {
    const r = find(f.id);
    const arr = buckets.get(r) || [];
    arr.push(f);
    buckets.set(r, arr);
  });

  const groups: DuplicateGroup[] = [];
  buckets.forEach((list, root) => {
    if (list.length > 1) {
      groups.push({
        key: root,
        motif: motifMap[root] || 'Doublon détecté',
        ids: list.map((x) => x.id),
        fiches: list,
      });
    }
  });
  return groups;
}

export function mergeFicheGroup(group: FicheEntreprise[]): FicheEntreprise {
  const sorted = [...group].sort((a, b) => computeMaturityScore(b) - computeMaturityScore(a));
  const base = { ...sorted[0] };
  const sources = new Set<string>();
  if (base.source) sources.add(base.source);

  let maxEff = parseInt(base.effectif, 10) || 0;

  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i];
    if (!base.telephone && d.telephone) base.telephone = d.telephone;
    if (!base.email && d.email) base.email = d.email;
    if (!base.contact && d.contact) base.contact = d.contact;
    if (!base.role && d.role) base.role = d.role;
    if (!base.ville && d.ville) base.ville = d.ville;
    if (!base.siteWeb && d.siteWeb) base.siteWeb = d.siteWeb;
    const eff = parseInt(d.effectif, 10) || 0;
    if (eff > maxEff) maxEff = eff;
    if (d.source) sources.add(d.source);
  }

  base.effectif = maxEff > 0 ? String(maxEff) : '';
  base.source = Array.from(sources).join(' + ');
  return base;
}

// ============================================================================
// 5. DONNÉES INITIALES CALIBRÉES MEKNÈS & RÉGION (6 SEGMENTS + DOUBLONS TEST)
// ============================================================================

const STORAGE_KEY = 'orange-pro-mdm-v1';

function createInitialPortfolio(): FicheEntreprise[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'mk-1',
      societe: 'Fiduciaire Ismailia Expertise',
      secteur: 'fiduciaire',
      ville: 'Meknès',
      telephone: '0535521840',
      email: 'contact@fiduciaire-ismailia.ma',
      contact: 'Khalid Bennani',
      role: 'Expert-Comptable',
      source: 'Pages Jaunes',
      effectif: '14',
      statut: 'RDV pris',
      siteWeb: 'https://fiduciaire-ismailia.ma',
      dateAjout: now,
    },
    {
      id: 'mk-2',
      societe: 'Clinique Privée Atlas Meknès',
      secteur: 'clinique',
      ville: 'Meknès',
      telephone: '0535519022',
      email: 'direction@clinique-atlas-meknes.ma',
      contact: 'Dr Mohamed Tazi',
      role: 'Directeur Médical',
      source: 'Kerix',
      effectif: '48',
      statut: 'Devis envoyé',
      dateAjout: now,
    },
    {
      id: 'mk-3',
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
      dateAjout: now,
    },
    {
      id: 'mk-4',
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
      dateAjout: now,
    },
    {
      id: 'mk-5',
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
      dateAjout: now,
    },
    {
      id: 'mk-6',
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
      dateAjout: now,
    },
    {
      id: 'mk-7',
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
      dateAjout: now,
    },
    {
      id: 'mk-8',
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
      dateAjout: now,
    },
    {
      id: 'mk-9',
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
      dateAjout: now,
    },
    {
      id: 'mk-10',
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
      dateAjout: now,
    },
    // Doublon volontaire pour démonstration Entity Resolution 1-clic
    {
      id: 'mk-11',
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
      dateAjout: now,
    },
    {
      id: 'mk-12',
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
      dateAjout: now,
    },
  ];
}

// ============================================================================
// 6. EXPORT CSV STRICT (9 COLONNES, UTF-8 BOM, SÉPARATEUR ;) & IMPORT CSV/JSON
// ============================================================================

export function buildStrictCsv(fiches: FicheEntreprise[]): string {
  const header = 'societe;secteur;ville;telephone;email;contact;role;source;effectif';
  const rows = fiches.map((f) =>
    [f.societe, f.secteur, f.ville, f.telephone, f.email, f.contact, f.role, f.source, f.effectif]
      .map((v) => String(v ?? '').replace(/;/g, ',').replace(/\r?\n/g, ' ').trim())
      .join(';')
  );
  return '\uFEFF' + [header, ...rows].join('\n');
}

function parseCsvOrJsonImport(raw: string, villesCibles: string[]): FicheEntreprise[] {
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

  // CSV
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
// 7. MOTEUR FETCH MULTI-FALLBACK CORS (ALLORIGINS / CORSPROXY / R.JINA.AI / DIRECT)
// ============================================================================

type ProxyStrategy = 'auto' | 'allorigins' | 'corsproxy' | 'jina' | 'direct';

async function fetchTimed(url: string, parentSignal: AbortSignal, timeoutMs = 6000): Promise<Response> {
  const local = new AbortController();
  const onAbort = () => local.abort();
  parentSignal.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => local.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: local.signal });
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

// Course parallèle rapide sur proxies (allorigins vs corsproxy en simultané, repli Jina)
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
// 7B. MOTEUR DE RÉDACTION D'EMAILS PERSONNALISÉS (SKILLS + CYCLE DE CONTRAT + IA)
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
  const salut = f.contact.trim()
    ? `Bonjour ${f.contact.trim()},`
    : 'Bonjour Madame, Monsieur,';
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

  // Adaptation selon le Skill actif
  if (skill?.id === 'relance-eclair' || ton === 'court') {
    return {
      objet,
      corps: `${salut}

${accroche}
Piste recommandée : ${reco.offre}.
${cta}

${sig}`,
    };
  }
  if (skill?.id === 'direction-gc' || ton === 'executif') {
    return {
      objet,
      corps: `${salut}

Dans le cadre de l’accompagnement des dirigeants sur ${ville}, je souhaite vous soumettre une optimisation dédiée à ${f.societe}${effInfo}.

Enjeu ciblé : ${angle}.
Architecture recommandée : ${reco.offre}.

${cta}

${sig}`,
    };
  }
  if (skill?.id === 'bascule-fin-contrat') {
    return {
      objet: `Optimisation & portabilité sans coupure — ${f.societe}`,
      corps: `${salut}

${accroche}

Notre approche de migration sur ${reco.offre} garantit la portabilité intégrale de vos numéros sans interruption de service, tout en sécurisant ${angle}.

${cta}

${sig}`,
    };
  }

  return {
    objet,
    corps: `${salut}

${accroche}

${proposition}

${cta}

${sig}`,
  };
}

// ============================================================================
// 8. APPLICATION PRINCIPALE
// ============================================================================

export default function App() {
  // État persistant localStorage
  const [fiches, setFiches] = useState<FicheEntreprise[]>(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback
    }
    return createInitialPortfolio();
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fiches));
    } catch {
      // Ignore quota
    }
  }, [fiches]);

  // Villes cibles
  const [allVilles, setAllVilles] = useState<string[]>(DEFAULT_VILLES_MEKNES);
  const [activeVilles, setActiveVilles] = useState<string[]>(DEFAULT_VILLES_MEKNES);
  const [modeVille, setModeVille] = useState<'filter' | 'default'>('default');
  const [defaultVille, setDefaultVille] = useState<string>('Meknès');
  const [newVilleInput, setNewVilleInput] = useState('');

  // Navigation onglets principaux
  const [activeTab, setActiveTab] = useState<'portefeuille' | 'crawler' | 'paste' | 'dedup'>('portefeuille');

  // Filtres & Tri Portefeuille (multi-critères combinables)
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

  // Sauvegarde / Restauration Backup JSON complet
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  // Enrichissement Assisté Rapide (modal anti-blocage proxies + collage instantané Google/LinkedIn/Site)
  const [assistModalFiche, setAssistModalFiche] = useState<FicheEntreprise | null>(null);
  const [assistPasteText, setAssistPasteText] = useState('');
  const [lastVerifyDiag, setLastVerifyDiag] = useState<string>('');
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [apiTestStatus, setApiTestStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // Edition inline
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof FicheEntreprise } | null>(null);
  const [editDraft, setEditDraft] = useState('');

  // Crawler Profond (Niveaux 1 & 2)
  const [crawlUrlsInput, setCrawlUrlsInput] = useState('');
  const [proxyStrategy, setProxyStrategy] = useState<ProxyStrategy>('auto');
  const [enablePagination, setEnablePagination] = useState(true);
  const [paginationMode, setPaginationMode] = useState<'unlimited' | 'range'>('unlimited');
  const [pageStart, setPageStart] = useState(1);
  const [pageEnd, setPageEnd] = useState(10);
  const [enableLevel2, setEnableLevel2] = useState(true);
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlProgress, setCrawlProgress] = useState({ done: 0, total: 0, captured: 0 });
  const [crawlLogs, setCrawlLogs] = useState<CrawlLog[]>([]);
  const [crawlPreview, setCrawlPreview] = useState<FicheEntreprise[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Extraction réactive HTML / Texte / CSV / Saisie rapide
  const [pasteInput, setPasteInput] = useState('');
  const [pasteSource, setPasteSource] = useState('Pages Jaunes');
  const [pastePreview, setPastePreview] = useState<FicheEntreprise[]>([]);
  const [pasteIgnoredPhones, setPasteIgnoredPhones] = useState<string[]>([]);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickForm, setQuickForm] = useState({
    societe: '',
    secteur: 'pme' as SecteurCode,
    ville: 'Meknès',
    telephone: '',
    email: '',
    contact: '',
    role: '',
    source: 'Porte à porte',
    effectif: '',
  });

  // Enrichissement Web / Clé Gemini Grounding optionnelle
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showApiPanel, setShowApiPanel] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // Studio Email IA & Skills de rédaction personnalisés selon client & cycle de contrat
  const [emailSkills, setEmailSkills] = useState<EmailSkill[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EMAIL_SKILLS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_EMAIL_SKILLS;
  });
  const [activeSkillId, setActiveSkillId] = useState<string>('terrain-orange');
  const [showSkillEditor, setShowSkillEditor] = useState(false);
  const [editingSkill, setEditingSkill] = useState<EmailSkill | null>(null);
  const skillFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EMAIL_SKILLS, JSON.stringify(emailSkills));
    } catch {
      // ignore storage errors
    }
  }, [emailSkills]);

  const activeSkill = useMemo(
    () => emailSkills.find((s) => s.id === activeSkillId) || emailSkills[0] || DEFAULT_EMAIL_SKILLS[0],
    [emailSkills, activeSkillId]
  );

  const [emailModalFiche, setEmailModalFiche] = useState<FicheEntreprise | null>(null);
  const [emailCycle, setEmailCycle] = useState<CycleContrat>('premier_contact');
  const [emailTon, setEmailTon] = useState<TonEmail>('terrain');
  const [emailSignature, setEmailSignature] = useState('Cordialement,\nConseiller Commercial Orange Pro');
  const [emailCustomPrompt, setEmailCustomPrompt] = useState('');
  const [emailObjet, setEmailObjet] = useState('');
  const [emailCorps, setEmailCorps] = useState('');
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);

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
  };

  const handleSaveSkill = () => {
    if (!editingSkill || !editingSkill.nom.trim()) {
      notify('Donne un nom à ton skill de rédaction.', 'warn');
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
    if (activeSkillId === id) {
      setActiveSkillId(remaining[0].id);
    }
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
        ctaStyle: 'Selon les instructions du skill importé',
      };
      setEmailSkills((prev) => [...prev, imported]);
      setActiveSkillId(imported.id);
      notify(`Skill « ${imported.nom} » importé et activé.`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleGenerateEmailWithAI = async () => {
    if (!emailModalFiche) return;
    if (!geminiApiKey.trim()) {
      regenerateLocalEmail(emailModalFiche, emailCycle, emailTon, emailSignature, activeSkill);
      notify('Modèle du skill appliqué. Ajoute une clé Gemini dans « Grounding » pour la rédaction IA complète.', 'warn');
      return;
    }
    setIsGeneratingEmail(true);
    try {
      const f = emailModalFiche;
      const reco = getOrangeProRecommendation(f);
      const cycleObj = CYCLES_CONTRAT.find((c) => c.id === emailCycle);
      const cycleLabel = cycleObj ? `${cycleObj.label} (${cycleObj.desc})` : emailCycle;
      const prompt = `Tu appliques strictement le SKILL DE RÉDACTION suivant pour rédiger un email B2B Orange Pro au Maroc.

=== SKILL ACTIF : ${activeSkill.nom} ===
Rôle / Posture : ${activeSkill.role}
Règles & Consignes du Skill : ${activeSkill.regles}
Style d'appel à l'action (CTA) : ${activeSkill.ctaStyle}

=== DONNÉES CLIENT DISPONIBLES ===
- Société : ${f.societe}
- Secteur : ${SECTEURS_META[f.secteur].label}
- Ville : ${f.ville || 'Maroc'}
- Contact / Décideur : ${f.contact || 'Non renseigné'} (${f.role || 'Décideur'})
- Téléphone : ${f.telephone || 'Non renseigné'}
- Email : ${f.email || 'Non renseigné'}
- Effectif : ${f.effectif ? `${f.effectif} salariés` : 'Non précisé'}
- Site Web / Source : ${f.siteWeb || f.source || 'Non précisé'}
- Statut CRM actuel : ${f.statut}
- Offre Orange Pro recommandée : ${reco.tier} — ${reco.offre}

=== SITUATION / CYCLE DU CONTRAT ===
${cycleLabel}
Ton demandé : ${emailTon === 'court' ? 'Ultra-court (4-5 lignes max)' : emailTon === 'executif' ? 'Exécutif direction' : 'Direct et pragmatique terrain'}
Signature à utiliser : ${emailSignature}
${emailCustomPrompt.trim() ? `Consigne ponctuelle supplémentaire : ${emailCustomPrompt.trim()}` : ''}

Réponds UNIQUEMENT en JSON strict : {"objet": "...", "corps": "..."}`;

      const gRes = await callGeminiAutoModel(geminiApiKey, {
        contents: [{ parts: [{ text: prompt }] }],
      });
      if (gRes.ok && gRes.data) {
        const parts = gRes.data?.candidates?.[0]?.content?.parts || [];
        const rawTxt = parts.map((p) => p.text || '').join('\n');
        const jm = rawTxt.match(/\{[\s\S]*\}/);
        if (jm) {
          const parsed = JSON.parse(jm[0]);
          if (parsed.objet) setEmailObjet(String(parsed.objet));
          if (parsed.corps) setEmailCorps(String(parsed.corps));
          notify(`Email généré par IA avec le skill « ${activeSkill.nom} ».`);
          return;
        }
      }
      notify('Réponse IA indisponible — modèle du skill conservé.', 'warn');
    } catch {
      notify('Erreur réseau IA — modèle du skill conservé.', 'err');
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  // Toasts non bloquants
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'warn' | 'err' } | null>(null);
  const notify = (msg: string, type: 'ok' | 'warn' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3600);
  };

  // Extraction réactive instantanée dès collage
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

  // Groupes de doublons MDM
  const duplicateGroups = useMemo(() => findDuplicateGroups(fiches), [fiches]);
  const duplicateIdSet = useMemo(() => {
    const s = new Set<string>();
    duplicateGroups.forEach((g) => g.ids.forEach((id) => s.add(id)));
    return s;
  }, [duplicateGroups]);

  // KPIs par couleur Orange Pro & Statut CRM
  const kpiByColor = useMemo(() => {
    const map: Record<SegmentCouleur, number> = {
      bleu: 0,
      vert: 0,
      orange: 0,
      jaune: 0,
      violet: 0,
      cyan: 0,
    };
    fiches.forEach((f) => {
      const col = SECTEURS_META[f.secteur]?.couleur || 'violet';
      map[col]++;
    });
    return map;
  }, [fiches]);

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

  // Sauvegarde complète JSON (portefeuille + villes + skills email + signature)
  const handleExportFullBackup = () => {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      fiches,
      allVilles,
      activeVilles,
      defaultVille,
      emailSkills,
      emailSignature,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orange-pro-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify(`Sauvegarde complète téléchargée (${fiches.length} fiches + ${emailSkills.length} skills).`);
  };

  const handleImportFullBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (Array.isArray(parsed.fiches)) {
          setFiches(parsed.fiches);
          if (Array.isArray(parsed.allVilles) && parsed.allVilles.length > 0) setAllVilles(parsed.allVilles);
          if (Array.isArray(parsed.activeVilles)) setActiveVilles(parsed.activeVilles);
          if (typeof parsed.defaultVille === 'string') setDefaultVille(parsed.defaultVille);
          if (Array.isArray(parsed.emailSkills) && parsed.emailSkills.length > 0) setEmailSkills(parsed.emailSkills);
          if (typeof parsed.emailSignature === 'string') setEmailSignature(parsed.emailSignature);
          notify(`Sauvegarde restaurée : ${parsed.fiches.length} fiche(s) chargée(s).`);
        } else {
          notify('Fichier de sauvegarde JSON invalide.', 'err');
        }
      } catch {
        notify('Impossible de lire ce fichier de sauvegarde JSON.', 'err');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Test en 1 clic de la clé Gemini + Google Search Grounding
  const handleTestGeminiKey = async () => {
    const key = geminiApiKey.trim();
    if (!key) {
      setApiTestStatus({ ok: false, msg: 'Colle d’abord ta clé API Gemini (AIza...).' });
      return;
    }
    setIsTestingApi(true);
    setApiTestStatus(null);
    try {
      const gRes = await callGeminiAutoModel(key, {
        contents: [{ parts: [{ text: 'Réponds simplement OK en 1 mot.' }] }],
        tools: [{ google_search: {} }],
      });
      if (gRes.ok) {
        setApiTestStatus({ ok: true, msg: `Clé valide — Google Search Grounding actif (${gRes.model}).` });
        notify(`Google Search Grounding connecté (${gRes.model}).`);
        return;
      }
      // Si Grounding échoue sur quota Free Tier, tester la clé sans Grounding (pour Studio Email + Audit IA)
      const plainRes = await callGeminiAutoModel(key, {
        contents: [{ parts: [{ text: 'Réponds simplement OK en 1 mot.' }] }],
      });
      if (plainRes.ok) {
        setApiTestStatus({
          ok: true,
          msg: `Clé valide (${plainRes.model}) pour Studio Email & Audit IA — mais quota Free Tier Google Search Grounding indisponible (limite 0 sur ce projet).`,
        });
        notify(`Clé IA active (${plainRes.model}), Grounding limité sur Free Tier.`, 'warn');
        return;
      }
      setApiTestStatus({
        ok: false,
        msg: `Quota Free Tier épuisé ou limite à 0 sur ce projet Google AI Studio (${gRes.error.slice(0, 180)}).`,
      });
    } catch (err) {
      setApiTestStatus({ ok: false, msg: `Erreur réseau : ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setIsTestingApi(false);
    }
  };

  // Application d'un collage rapide dans la modale d'enrichissement assisté
  const handleApplyAssistedPaste = () => {
    if (!assistModalFiche || !assistPasteText.trim()) {
      notify('Colle d’abord le texte copié depuis Google, LinkedIn ou le site web.', 'warn');
      return;
    }
    const readable = htmlToReadableText(assistPasteText);
    const patch: Partial<FicheEntreprise> = {};
    const foundLabels: string[] = [];

    const phones = extractPhonesFromReadableText(readable);
    if (!assistModalFiche.telephone && phones[0]) {
      patch.telephone = phones[0];
      foundLabels.push('téléphone');
    }
    const bestE = extractBestEmailFromText(readable, assistModalFiche.societe);
    if (!assistModalFiche.email && bestE) {
      patch.email = bestE;
      foundLabels.push('email');
    }
    const dec = extractDecideurFromText(readable, assistModalFiche.email || patch.email || '');
    if (!assistModalFiche.contact && dec.contact) {
      patch.contact = dec.contact;
      foundLabels.push('décideur');
      if (!assistModalFiche.role && dec.role) {
        patch.role = dec.role;
        foundLabels.push('rôle');
      }
    }
    const eff = extractEffectifFromText(readable);
    if (!assistModalFiche.effectif && eff) {
      patch.effectif = eff;
      foundLabels.push('effectif');
    }
    const urlMatch = assistPasteText.match(/https?:\/\/(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s"'<>)]*)?/i);
    if (!assistModalFiche.siteWeb && urlMatch && !/(google\.|linkedin\.|facebook\.|telecontact\.|kerix\.)/i.test(urlMatch[0])) {
      patch.siteWeb = urlMatch[0].replace(/[.,;)]+$/, '');
      foundLabels.push('site web');
    }
    const inferredSec = inferSecteur(`${assistModalFiche.societe} ${readable.slice(0, 600)}`, assistModalFiche.secteur, patch.email || assistModalFiche.email);
    if (inferredSec !== assistModalFiche.secteur) {
      patch.secteur = inferredSec;
      foundLabels.push(`secteur → ${SECTEURS_META[inferredSec].label}`);
    }

    if (foundLabels.length === 0) {
      notify('Aucune nouvelle donnée détectée dans ce texte (téléphone marocain, email pro ou décideur).', 'warn');
      return;
    }

    setFiches((prev) =>
      prev.map((item) =>
        item.id === assistModalFiche.id
          ? {
              ...item,
              ...patch,
              verifieWeb: true,
              pistesEnrichissement: Array.from(new Set([...(item.pistesEnrichissement || []), 'Assisté'])),
            }
          : item
      )
    );
    setAssistModalFiche((prev) => (prev ? { ...prev, ...patch } : prev));
    setAssistPasteText('');
    notify(`${assistModalFiche.societe} complétée : ${foundLabels.join(', ')}.`);
  };

  // Liste filtrée & triée (tous filtres combinables)
  const filteredFiches = useMemo(() => {
    const q = stripAccents(search);
    const list = fiches.filter((f) => {
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

      if (sourceFilter) {
        if (!stripAccents(f.source).includes(stripAccents(sourceFilter))) return false;
      }

      if (onlyReadyToCall && !isReadyToCall(f)) return false;

      if (q) {
        const hay = stripAccents(
          `${f.societe} ${f.secteur} ${SECTEURS_META[f.secteur]?.label} ${f.ville} ${f.telephone} ${f.email} ${f.contact} ${f.role} ${f.source}`
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
    fiches, search, couleurFilter, secteurFilter, villeFilter, tierFilter,
    effectifFilter, completudeFilter, sourceFilter, statutFilter, onlyReadyToCall,
    sortField, sortDir,
  ]);

  // ============================================================================
  // ACTIONS PRINCIPALES
  // ============================================================================

  const pushLog = (level: CrawlLog['level'], message: string) => {
    const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setCrawlLogs((prev) => [{ id: makeId(), time, level, message }, ...prev].slice(0, 80));
  };

  // A. Lancer le Crawler Profond (Niveaux 1 & 2 + Pagination + Stop)
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
      // Niveau 1 : Pages de résultats + Pagination
      let idx = 0;
      while (idx < queue.length) {
        if (controller.signal.aborted) break;
        const url = queue[idx++];
        if (visited.has(url)) continue;
        visited.add(url);

        setCrawlProgress((p) => ({ ...p, done: visited.size, total: Math.max(queue.length, visited.size) }));
        pushLog('info', `Niveau 1 : lecture ${url}`);

        try {
          const { text, usedStrategy } = await fetchWithFallback(url, proxyStrategy, controller.signal);
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
            if (addedPages > 0) pushLog('info', `Pagination détectée : +${addedPages} page(s) en file.`);
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

      // Niveau 2 : Sous-pages individuelles par lots parallèles de 3
      if (enableLevel2 && detailQueue.length > 0 && !controller.signal.aborted) {
        pushLog('info', `Niveau 2 : exploration de ${detailQueue.length} fiche(s) détail par lots de 3.`);
        const totalAll = visited.size + detailQueue.length;
        for (let i = 0; i < detailQueue.length; i += 3) {
          if (controller.signal.aborted) break;
          const batch = detailQueue.slice(i, i + 3);
          await Promise.all(
            batch.map(async (dUrl) => {
              if (controller.signal.aborted) return;
              try {
                const { text } = await fetchWithFallback(dUrl, proxyStrategy, controller.signal);
                const { fiches: found } = parseRawInputToFiches(text, dUrl, activeVilles, modeVille, defaultVille);
                if (found.length > 0) upsertCaptured(found);
              } catch {
                // Silencieux par sous-page
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
      pushLog('warn', 'Arrêt demandé — conservation des fiches déjà capturées.');
    }
  };

  const handleCommitCaptured = (items: FicheEntreprise[], sourceLabel: string) => {
    if (items.length === 0) return;
    setFiches((prev) => [...items, ...prev]);
    notify(`${items.length} fiche(s) ajoutées au portefeuille (${sourceLabel}).`);
    setActiveTab('portefeuille');
  };

  // Audit Global + Enrichissement Complet (Secteur, Nettoyage, Infos manquantes)
  const handleStopAudit = () => {
    if (auditAbortRef.current) {
      auditAbortRef.current.abort();
    }
  };

  const handleBatchAudit = async (target: 'portfolio' | 'crawlPreview' | 'pastePreview') => {
    const sourceRows =
      target === 'portfolio' ? fiches : target === 'crawlPreview' ? crawlPreview : pastePreview;
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
      currentName: 'Nettoyage & contrôle des secteurs...',
    });

    const applyUpdate = (rows: FicheEntreprise[]) => {
      if (target === 'portfolio') setFiches(rows);
      else if (target === 'crawlPreview') setCrawlPreview(rows);
      else setPastePreview(rows);
    };

    try {
      // Étape 1 : Audit déterministe + IA par lots (suppression bruit + correction secteurs + extraction décideur depuis le nom)
      const baseRes = await auditAndCleanAllRowsWithAI(sourceRows, geminiApiKey);
      let enrichedCount = 0;
      const working: FicheEntreprise[] = baseRes.cleaned.map((f) => {
        let next = { ...f };
        let changed = false;
        if (!next.contact) {
          const dec = extractDecideurFromText(next.societe);
          if (dec.contact) {
            next.contact = dec.contact;
            if (!next.role && dec.role) next.role = dec.role;
            changed = true;
          }
        }
        if (changed) enrichedCount++;
        return next;
      });

      applyUpdate(working);
      setAuditProgress({
        done: 0,
        total: working.length,
        removed: baseRes.removedCount,
        secteurs: baseRes.correctedSecteurCount,
        enriched: enrichedCount,
        currentName: 'Recherche des infos manquantes sur le web...',
      });

      // Étape 2 : Enrichissement web des fiches incomplètes (tél, email, contact ou effectif manquant)
      const incompleteIndices = working
        .map((f, i) => ({ f, i }))
        .filter(({ f }) => !f.telephone || !f.email || !f.contact || !f.effectif);

      const totalSteps = Math.max(1, incompleteIndices.length);
      let processed = 0;

      // Moteur unifié ultra-rapide : pool de 8 workers parallèles + 6 pistes simultanées + arrêt anticipé dès complétude
      let cursor = 0;
      const CONCURRENCY = 8;

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
        `Vérification terminée : ${baseRes.removedCount} parasite(s) retiré(s), ${baseRes.correctedSecteurCount} secteur(s) corrigé(s), ${enrichedCount} fiche(s) enrichie(s).`
      );
    } finally {
      setIsAuditing(false);
      setAuditProgress(null);
      auditAbortRef.current = null;
    }
  };

  // Moteur multi-pistes pertinent en 2 phases :
  // Phase 1 (parallèle) : Google Grounding IA + Site officiel + DuckDuckGo + Bing/Jina + Telecontact + Kerix (fenêtrage pertinent sur le nom exact)
  // Phase 2 (suivi profond auto) : visite le site officiel découvert (+ /contact, /a-propos) ou la fiche annuaire découverte si des champs manquent encore
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
      Boolean((f.telephone || patch.telephone) && (f.email || patch.email) && (f.contact || patch.contact) && (f.effectif || patch.effectif));

    const checkEarlyStop = () => {
      if (isCompleteNow()) {
        localController.abort();
      }
    };

    const mergeTextIntoPatch = (rawText: string, pisteLabel: string, isDedicatedPage: boolean) => {
      if (!rawText || rawText.length < 40) return;
      const readable = htmlToReadableText(rawText);
      // Sur une page de résultats (annuaire/moteur), n'extraire QUE dans les fenêtres autour du nom de la société
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

      // Découvrir le site officiel ou une fiche annuaire détaillée pertinente à suivre en Phase 2
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

    try {
      const tasks: Promise<void>[] = [];
      const villeCible = f.ville || 'Meknès';

      // Piste 1 : Google Search Grounding (Gemini 2.5 Flash — croise Google Maps, site officiel, LinkedIn Maroc, Telecontact, Kerix)
      if (geminiApiKey.trim()) {
        tasks.push(
          (async () => {
            const gAbort = new AbortController();
            const onStop = () => gAbort.abort();
            localController.signal.addEventListener('abort', onStop, { once: true });
            const timer = setTimeout(() => gAbort.abort(), 7500);
            try {
              const prompt = `Tu es un enquêteur B2B au Maroc. Fais une recherche Google approfondie (Google Maps, site officiel, LinkedIn Maroc, Telecontact.ma, Kerix.net, DirectInfo) pour l'entreprise exacte :
Nom : "${f.societe}"
Ville : "${villeCible}", Maroc
Secteur actuel : "${SECTEURS_META[f.secteur].label}"

Trouve UNIQUEMENT des données réelles et vérifiées pour cette entreprise exacte (ne rien inventer, laisser "" si introuvable) :
- telephone : numéro marocain officiel au format 05XXXXXXXX, 06XXXXXXXX ou 07XXXXXXXX
- email : adresse email professionnelle officielle (pas de noreply/annuaire)
- contact : nom complet du décideur (Gérant, Directeur Général, Fondateur, Associé, Dr, Me, Arch)
- role : fonction exacte du décideur
- effectif : nombre entier de salariés si connu, sinon ""
- siteWeb : URL officielle https://... si connue, sinon ""
- secteur : code exact parmi ${Object.keys(SECTEURS_META).join(',')}

Réponds UNIQUEMENT en JSON strict : {"telephone":"","email":"","contact":"","role":"","effectif":"","siteWeb":"","secteur":""}`;
              const gRes = await callGeminiAutoModel(
                geminiApiKey,
                {
                  contents: [{ parts: [{ text: prompt }] }],
                  tools: [{ google_search: {} }],
                },
                gAbort.signal
              );
              const data = gRes.ok ? gRes.data : null;
              if (!data) return;
              const parts = data?.candidates?.[0]?.content?.parts || [];
              const rawTxt = parts.map((p) => p.text || '').join('\n');
              const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
              for (const ch of chunks) {
                const uri = ch?.web?.uri;
                if (uri && /^https?:\/\//i.test(uri) && !/(google\.|vertexaisearch\.)/i.test(uri)) {
                  discoveredUrls.add(uri);
                }
              }
              const jm = rawTxt.match(/\{[\s\S]*\}/);
              if (jm) {
                const parsed = JSON.parse(jm[0]);
                let hit = false;
                if (!f.telephone && parsed.telephone) {
                  const p = normalizeMoroccanPhone(String(parsed.telephone));
                  if (p) { patch.telephone = p; hit = true; }
                }
                if (!f.email && parsed.email) {
                  const e = normalizeProEmail(String(parsed.email));
                  if (e) { patch.email = e; hit = true; }
                }
                if (!f.contact && parsed.contact && isPlausiblePersonName(String(parsed.contact))) {
                  patch.contact = String(parsed.contact).trim();
                  hit = true;
                }
                if (!f.role && parsed.role) {
                  patch.role = String(parsed.role).trim();
                  hit = true;
                }
                if (!f.effectif && parsed.effectif) {
                  const n = parseInt(String(parsed.effectif).replace(/\D/g, ''), 10);
                  if (n > 0) { patch.effectif = String(n); hit = true; }
                }
                if (!f.siteWeb && parsed.siteWeb && /^https?:\/\//i.test(String(parsed.siteWeb))) {
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
                  pistesSet.add('Google IA');
                  checkEarlyStop();
                }
              }
            } finally {
              clearTimeout(timer);
              localController.signal.removeEventListener('abort', onStop);
            }
          })().catch(() => {})
        );
      }

      // Piste 2 : Site officiel déjà connu (page d'accueil + /contact + /a-propos)
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

      // Piste 3 : Recherche Web publique (DuckDuckGo HTML — coordonnées + décideur)
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
        `"${f.societe}" "${villeCible}" Maroc telephone OR email OR gérant OR directeur`
      )}`;
      tasks.push(
        fetchFastest(ddgUrl, proxyStrategy, localController.signal, 5500)
          .then(({ text }) => mergeTextIntoPatch(text, 'Web Search', false))
          .catch(() => {})
      );

      // Piste 4 : Annuaire Telecontact Maroc (Pages Jaunes Maroc)
      const tcUrl = `https://www.telecontact.ma/trouver/index.php?nxo=moteurs&nxs=process&string=${encodeURIComponent(
        f.societe
      )}&ou=${encodeURIComponent(villeCible)}`;
      tasks.push(
        fetchFastest(tcUrl, proxyStrategy, localController.signal, 5500)
          .then(({ text }) => mergeTextIntoPatch(text, 'Telecontact', false))
          .catch(() => {})
      );

      // Piste 5 : Annuaire Kerix.net Maroc (B2B dirigeants & effectifs)
      const kerixUrl = `https://www.kerix.net/fr/annuaire-entreprise/recherche.html?q=${encodeURIComponent(
        `${f.societe} ${villeCible}`
      )}`;
      tasks.push(
        fetchFastest(kerixUrl, proxyStrategy, localController.signal, 5500)
          .then(({ text }) => mergeTextIntoPatch(text, 'Kerix Maroc', false))
          .catch(() => {})
      );

      // Piste 6 : Recherche Bing via r.jina.ai (lecteur Markdown sans clé — très efficace pour LinkedIn/sites/annuaires)
      const bingJinaUrl = `https://r.jina.ai/https://www.bing.com/search?q=${encodeURIComponent(
        `"${f.societe}" "${villeCible}" Maroc contact email gérant`
      )}`;
      tasks.push(
        fetchTimed(bingJinaUrl, localController.signal, 5500)
          .then((res) => (res.ok ? res.text() : ''))
          .then((text) => {
            if (text && text.length > 80) mergeTextIntoPatch(text, 'Bing / Web', false);
          })
          .catch(() => {})
      );

      await Promise.allSettled(tasks);

      // Phase 2 (Suivi profond automatique) : si un site officiel ou une fiche annuaire a été découvert(e) et qu'il manque tél, email ou décideur
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
              // ignore unreachable discovered URL
            }
          })
        );
      }

      // Dernier passage : si on a trouvé un email nominatif mais pas encore de décideur
      if (!f.contact && !patch.contact && (f.email || patch.email)) {
        const fromMail = extractDecideurFromText('', f.email || patch.email || '');
        if (fromMail.contact) {
          patch.contact = fromMail.contact;
          if (!f.role && !patch.role) patch.role = fromMail.role;
          pistesSet.add('Email pro');
        }
      }

      return { patch, pistes: Array.from(pistesSet), secteurCorrige };
    } finally {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  };

  const handleGlobalAudit = () => handleBatchAudit('portfolio');

  // Vérifier Web individuel — explore toutes les pistes en parallèle (Google + Site + Web + Telecontact + Kerix + Index Web)
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
        if (!geminiApiKey.trim()) {
          setLastVerifyDiag('Les proxies publics sont limités/bloqués sur certains annuaires. Utilise l’Enrichissement Assisté (liens 1-clic + Ctrl+V) ou ajoute une clé Gemini dans Grounding.');
          notify('Proxies publics bloqués ou sans donnée — mode Enrichissement Assisté ouvert.', 'warn');
        } else {
          setLastVerifyDiag(`Aucune coordonnée publique supplémentaire trouvée automatiquement pour ${f.societe}. Utilise les liens directs ci-dessous.`);
          notify(`Aucune donnée auto pour ${f.societe} — mode Assisté ouvert.`, 'warn');
        }
      }
    } catch {
      notify(`Impossible de joindre les pistes web pour ${f.societe}.`, 'err');
    } finally {
      setVerifyingId(null);
    }
  };

  // Fusion Entity Resolution
  const handleMergeGroup = (group: DuplicateGroup) => {
    const merged = mergeFicheGroup(group.fiches);
    const idSet = new Set(group.ids);
    setFiches((prev) => {
      const rest = prev.filter((f) => !idSet.has(f.id));
      return [merged, ...rest];
    });
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

  // Export CSV 3 modes
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
      notify(`Export CSV (${target.length} fiches, 9 colonnes, UTF-8 BOM ;) téléchargé.`);
    } catch {
      navigator.clipboard?.writeText(csv);
      notify(`Export CSV copié dans le presse-papiers (${target.length} fiches).`);
    }
  };

  const handleCopyCsvForBalise = () => {
    const csv = buildStrictCsv(filteredFiches).replace(/^\uFEFF/, '');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(csv).then(() => notify(`${filteredFiches.length} fiche(s) copiées au format CSV 9 colonnes.`));
    } else {
      const ta = document.createElement('textarea');
      ta.value = csv;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      notify(`${filteredFiches.length} fiche(s) copiées au format CSV 9 colonnes.`);
    }
  };

  // Chargement fichier (.html, .csv, .json, .txt) dans l'onglet Extraction
  const handleFileUploadExtract = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      setPasteInput(content);
      setPasteSource(file.name);
      notify(`Fichier « ${file.name} » chargé pour extraction.`);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  // Téléchargement direct de l'Aperçu Extraction en CSV 9 colonnes
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
      notify(`Fichier CSV téléchargé (${items.length} fiches, 9 colonnes).`);
    } catch {
      navigator.clipboard?.writeText(csv);
      notify(`CSV copié dans le presse-papiers (${items.length} fiches).`);
    }
  };

  // Saisie rapide
  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cleanCompanyName(quickForm.societe);
    if (!isValidCompanyName(clean)) {
      notify('Nom de société invalide ou trop court.', 'warn');
      return;
    }
    const f: FicheEntreprise = {
      id: makeId(),
      societe: clean,
      secteur: quickForm.secteur,
      ville: quickForm.ville.trim() || defaultVille,
      telephone: normalizeMoroccanPhone(quickForm.telephone),
      email: normalizeProEmail(quickForm.email),
      contact: quickForm.contact.trim(),
      role: quickForm.role.trim(),
      source: quickForm.source.trim() || 'Saisie manuelle',
      effectif: quickForm.effectif ? String(parseInt(quickForm.effectif, 10) || '') : '',
      statut: 'À contacter',
      dateAjout: new Date().toISOString(),
    };
    setFiches((prev) => [f, ...prev]);
    setQuickForm({
      societe: '',
      secteur: 'pme',
      ville: defaultVille,
      telephone: '',
      email: '',
      contact: '',
      role: '',
      source: 'Porte à porte',
      effectif: '',
    });
    setShowQuickAdd(false);
    notify(`Fiche ${f.societe} ajoutée.`);
  };

  // Edition inline cellule
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

    setFiches((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: val } : f))
    );
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
    setActiveVilles((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  };

  const handleAddVille = () => {
    const v = newVilleInput.trim();
    if (!v) return;
    if (!allVilles.includes(v)) setAllVilles((prev) => [...prev, v]);
    if (!activeVilles.includes(v)) setActiveVilles((prev) => [...prev, v]);
    setNewVilleInput('');
  };

  // ============================================================================
  // RENDU INTERFACE « EXECUTIVE B2B WORKSPACE » (#F7F5F0)
  // ============================================================================

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-stone-900 font-sans">
      {/* Toast non bloquant */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 max-w-md px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2 ${
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

      {/* Header Executive */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-600 text-white flex items-center justify-center font-bold text-lg">
              O
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-stone-900 leading-tight">
                Orange Pro B2B — Collecte, MDM & Qualification
              </h1>
              <p className="text-xs text-stone-500">
                Calibré Meknès & Région · Export CSV strict 9 colonnes (;) · Persistance locale
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isAuditing}
              onClick={handleGlobalAudit}
              className="px-3 py-2 rounded-lg border border-stone-300 bg-stone-50 hover:bg-stone-100 disabled:opacity-60 text-xs font-semibold text-stone-800 flex items-center gap-1.5"
            >
              <ShieldCheck className={`w-4 h-4 text-emerald-600 ${isAuditing ? 'animate-spin' : ''}`} />
              {isAuditing ? 'Audit en cours...' : 'Vérifier & Corriger Tout'}
            </button>
            <button
              type="button"
              onClick={() => setShowApiPanel((v) => !v)}
              className="px-3 py-2 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-orange-600" />
              Grounding {geminiApiKey ? 'Actif' : 'Optionnel'}
            </button>
            <button
              type="button"
              onClick={() => setShowQuickAdd(true)}
              className="px-3.5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Nouvelle fiche
            </button>
          </div>
        </div>

        {/* Barre optionnelle clé Gemini Grounding (jamais en dur) */}
        {showApiPanel && (
          <div className="bg-stone-50 border-t border-stone-200 px-4 py-2.5">
            <div className="max-w-[1440px] mx-auto flex flex-wrap items-center gap-3 text-xs">
              <span className="font-semibold text-stone-700">
                Clé API Gemini (optionnelle, pour « Vérifier Web » avec Google Search Grounding) :
              </span>
              <input
                type="password"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="AIza... ou AQ.... (conservée uniquement en mémoire)"
                className="flex-1 min-w-[240px] px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs"
              />
              <button
                type="button"
                disabled={isTestingApi}
                onClick={handleTestGeminiKey}
                className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold"
              >
                {isTestingApi ? 'Test...' : 'Tester la clé'}
              </button>
              <button
                type="button"
                onClick={() => setShowApiPanel(false)}
                className="px-3 py-1.5 rounded-lg bg-stone-900 text-white font-semibold"
              >
                Fermer
              </button>
            </div>
            {apiTestStatus && (
              <div className={`max-w-[1440px] mx-auto mt-1.5 text-xs font-medium ${apiTestStatus.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                {apiTestStatus.msg}
              </div>
            )}
          </div>
        )}

        {/* Navigation 4 modules */}
        <div className="max-w-[1440px] mx-auto px-4 flex gap-1 overflow-x-auto border-t border-stone-100">
          {[
            { id: 'portefeuille', label: `Portefeuille (${fiches.length})`, icon: Building2 },
            { id: 'crawler', label: 'Crawler Profond N1/N2', icon: Globe },
            { id: 'paste', label: 'Extraction HTML / CSV / JSON', icon: FileText },
            {
              id: 'dedup',
              label: `Déduplication MDM (${duplicateGroups.length})`,
              icon: GitMerge,
            },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as typeof activeTab)}
                className={`px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-colors ${
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
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto p-4 space-y-4">
        {auditProgress && (
          <section className="bg-stone-900 text-stone-50 rounded-xl p-3.5 border border-stone-700 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-semibold">
                <Sparkles className="w-4 h-4 text-orange-400 animate-pulse" />
                <span>
                  Vérification & enrichissement ({auditProgress.done}/{auditProgress.total}) —{' '}
                  <span className="text-orange-300">{auditProgress.currentName}</span>
                </span>
              </div>
              <div className="flex items-center gap-3">
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
        {/* Panneau Villes Cibles (accessible sur Crawler & Extraction, ou compact partout) */}
        <section className="bg-white rounded-xl border border-stone-200 p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                Villes Cibles ({activeVilles.length}/{allVilles.length})
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer bg-stone-50 px-2.5 py-1 rounded-lg border border-stone-200">
                <input
                  type="radio"
                  name="modeVille"
                  checked={modeVille === 'filter'}
                  onChange={() => setModeVille('filter')}
                  className="accent-orange-600"
                />
                <span>Filtrer uniquement cochées</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer bg-stone-50 px-2.5 py-1 rounded-lg border border-stone-200">
                <input
                  type="radio"
                  name="modeVille"
                  checked={modeVille === 'default'}
                  onChange={() => setModeVille('default')}
                  className="accent-orange-600"
                />
                <span>Ville par défaut :</span>
                <select
                  value={defaultVille}
                  onChange={(e) => setDefaultVille(e.target.value)}
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
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
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
                className="w-32 px-2.5 py-1 rounded-full border border-stone-300 text-xs bg-stone-50 focus:bg-white focus:outline-none focus:border-orange-500"
              />
              <button
                type="button"
                onClick={handleAddVille}
                className="px-2.5 py-1 rounded-full bg-orange-600 text-white text-xs font-semibold"
              >
                Ajouter
              </button>
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* ONGLET 1 : PORTEFEUILLE CRM & QUALIFICATION ORANGE PRO             */}
        {/* ================================================================== */}
        {activeTab === 'portefeuille' && (
          <>
            {/* Matrice 6 Segments Couleur Orange Pro (KPI cliquables) */}
            <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {(Object.keys(SEGMENTS_COULEUR) as SegmentCouleur[]).map((col) => {
                const seg = SEGMENTS_COULEUR[col];
                const active = couleurFilter === col;
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setCouleurFilter(active ? '' : col)}
                    className={`text-left p-3 rounded-xl bg-white border transition-all ${seg.cardBorder} ${
                      active ? 'ring-2 ring-stone-900 border-stone-900' : 'border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wide text-stone-700 flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${seg.dotCls}`} />
                        {seg.label}
                      </span>
                      <span className="text-lg font-bold text-stone-900">{kpiByColor[col]}</span>
                    </div>
                    <p className="text-[11px] text-stone-500 mt-1 line-clamp-1">{seg.description}</p>
                  </button>
                );
              })}
            </section>

            {/* Barre Recherche, Statuts CRM, Prêtes à appeler & Export CSV 3 modes */}
            <section className="bg-white rounded-xl border border-stone-200 p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher société, secteur, ville, téléphone, contact, source..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setOnlyReadyToCall((v) => !v)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border flex items-center gap-1.5 ${
                    onlyReadyToCall
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-stone-50 text-stone-700 border-stone-300 hover:bg-stone-100'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  Prêtes à appeler (Tél + Décideur)
                </button>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleExportCsv('filtre')}
                    className="px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV Filtré ({filteredFiches.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportCsv('propre')}
                    className="px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV Base Propre
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportCsv('complet')}
                    className="px-3 py-2 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV Complet
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyCsvForBalise}
                    className="px-3 py-2 rounded-lg border border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-800 text-xs font-semibold flex items-center gap-1.5"
                    title="Copier au format CSV 9 colonnes pour Balise"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copier CSV
                  </button>
                  <button
                    type="button"
                    onClick={handleExportFullBackup}
                    className="px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-1.5"
                    title="Télécharger une sauvegarde complète (.json) : fiches, statuts, villes et skills email"
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
                    className="px-3 py-2 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold flex items-center gap-1.5"
                    title="Restaurer une sauvegarde complète (.json)"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Restaurer
                  </button>
                </div>
              </div>

              {/* Filtres Avancés Multi-Critères (Secteur, Ville, Offre, Effectif, Complétude, Source) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-stone-100 text-xs">
                <select
                  value={secteurFilter}
                  onChange={(e) => setSecteurFilter(e.target.value as SecteurCode | '')}
                  className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-stone-50 text-stone-800"
                >
                  <option value="">Tous les secteurs (13)</option>
                  {(Object.keys(SECTEURS_META) as SecteurCode[]).map((code) => (
                    <option key={code} value={code}>
                      {SECTEURS_META[code].label}
                    </option>
                  ))}
                </select>

                <select
                  value={villeFilter}
                  onChange={(e) => setVilleFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-stone-50 text-stone-800"
                >
                  <option value="">Toutes les villes ({availableVillesInData.length})</option>
                  {availableVillesInData.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>

                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value as '' | 'Grand Compte' | 'PME' | 'TPE / Libéral')}
                  className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-stone-50 text-stone-800"
                >
                  <option value="">Toutes les offres</option>
                  <option value="Grand Compte">Grand Compte</option>
                  <option value="PME">PME</option>
                  <option value="TPE / Libéral">TPE / Libéral</option>
                </select>

                <select
                  value={effectifFilter}
                  onChange={(e) => setEffectifFilter(e.target.value as '' | 'tpe' | 'pme' | 'gc' | 'vide')}
                  className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-stone-50 text-stone-800"
                >
                  <option value="">Tous les effectifs</option>
                  <option value="tpe">Moins de 10 sal.</option>
                  <option value="pme">10 à 29 sal.</option>
                  <option value="gc">30+ salariés</option>
                  <option value="vide">Effectif manquant</option>
                </select>

                <select
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
                  className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-stone-50 text-stone-800"
                >
                  <option value="">Complétude : Tout</option>
                  <option value="ready">Prêtes à appeler (Tél + Décideur)</option>
                  <option value="has_phone">Avec téléphone</option>
                  <option value="no_phone">Sans téléphone</option>
                  <option value="has_email">Avec email</option>
                  <option value="no_email">Sans email</option>
                  <option value="has_contact">Avec décideur</option>
                  <option value="no_contact">Sans décideur</option>
                  <option value="incomplete">Fiches incomplètes (à enrichir)</option>
                  <option value="verified">Déjà vérifiées Web</option>
                  <option value="unverified">Non vérifiées Web</option>
                </select>

                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-stone-50 text-stone-800"
                >
                  <option value="">Toutes les sources</option>
                  {availableSourcesInData.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {hasActiveFilters && (
                <div className="flex items-center justify-between text-xs bg-orange-50/70 border border-orange-200 rounded-lg px-3 py-1.5">
                  <span className="text-stone-700">
                    Affichage filtré : <strong>{filteredFiches.length}</strong> fiche(s) sur <strong>{fiches.length}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="text-orange-700 hover:text-orange-900 font-semibold flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    Réinitialiser tous les filtres
                  </button>
                </div>
              )}

              {/* Pipeline Statuts CRM */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-stone-100">
                <span className="text-[11px] font-bold uppercase text-stone-400 mr-1">Statuts :</span>
                <button
                  type="button"
                  onClick={() => setStatutFilter('')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                    statutFilter === '' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  Tous ({fiches.length})
                </button>
                {STATUTS_CRM.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatutFilter(statutFilter === st ? '' : st)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                      statutFilter === st
                        ? 'bg-orange-600 text-white'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {st} ({kpiByStatut[st]})
                  </button>
                ))}
              </div>
            </section>

            {/* Tableau Haute Densité Éditable Inline */}
            <section className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold">
                      <th className="p-2.5">
                        <button
                          type="button"
                          onClick={() => toggleSort('societe')}
                          className="flex items-center gap-1 hover:text-stone-900"
                        >
                          Société & Segment <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="p-2.5">
                        <button
                          type="button"
                          onClick={() => toggleSort('ville')}
                          className="flex items-center gap-1 hover:text-stone-900"
                        >
                          Ville <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="p-2.5">Téléphone & Email</th>
                      <th className="p-2.5">Décideur & Rôle</th>
                      <th className="p-2.5">
                        <button
                          type="button"
                          onClick={() => toggleSort('effectif')}
                          className="flex items-center gap-1 hover:text-stone-900"
                        >
                          Eff. & Offre Orange Pro <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="p-2.5">
                        <button
                          type="button"
                          onClick={() => toggleSort('maturite')}
                          className="flex items-center gap-1 hover:text-stone-900"
                        >
                          Maturité <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="p-2.5">Statut CRM</th>
                      <th className="p-2.5 text-right">Actions terrain</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredFiches.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-stone-500">
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
                            <span
                              onClick={() => startEdit(f, field)}
                              title="Cliquer pour modifier"
                              className="cursor-pointer hover:underline decoration-dashed decoration-orange-400"
                            >
                              {display || <span className="text-stone-300 italic">{placeholder}</span>}
                            </span>
                          );
                        };

                        return (
                          <tr key={f.id} className="hover:bg-stone-50/80 align-top">
                            <td className={`p-2.5 ${seg.cardBorder}`}>
                              <div className="font-semibold text-stone-900 text-[13px] flex items-center gap-1.5">
                                {renderEditable('societe', f.societe, 'Société')}
                                {isDup && (
                                  <button
                                    type="button"
                                    onClick={() => setActiveTab('dedup')}
                                    className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold"
                                  >
                                    Doublon
                                  </button>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <select
                                  value={f.secteur}
                                  onChange={(e) =>
                                    setFiches((prev) =>
                                      prev.map((x) =>
                                        x.id === f.id ? { ...x, secteur: e.target.value as SecteurCode } : x
                                      )
                                    )
                                  }
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border cursor-pointer ${seg.badgeCls}`}
                                >
                                  {(Object.keys(SECTEURS_META) as SecteurCode[]).map((code) => (
                                    <option key={code} value={code}>
                                      {SECTEURS_META[code].label}
                                    </option>
                                  ))}
                                </select>
                                <span className="text-[10px] text-stone-400 truncate max-w-[140px]" title={f.source}>
                                  {renderEditable('source', f.source, 'Source')}
                                </span>
                              </div>
                            </td>

                            <td className="p-2.5 font-medium text-stone-800 whitespace-nowrap">
                              {renderEditable('ville', f.ville, 'Ville')}
                            </td>

                            <td className="p-2.5 space-y-1">
                              <div className="font-mono text-stone-900">
                                {renderEditable('telephone', f.telephone, '05/06/07...')}
                              </div>
                              <div className="text-[11px] text-stone-500 break-all">
                                {renderEditable('email', f.email, 'email@domaine.ma')}
                              </div>
                            </td>

                            <td className="p-2.5 space-y-1">
                              <div className="font-medium text-stone-900">
                                {renderEditable('contact', f.contact, 'Nom décideur')}
                              </div>
                              <div className="text-[11px] text-stone-500">
                                {renderEditable('role', f.role, 'Fonction')}
                              </div>
                            </td>

                            <td className="p-2.5 space-y-1 max-w-[230px]">
                              <div className="flex items-center gap-1.5">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${reco.badgeCls}`}>
                                  {reco.tier}
                                </span>
                                <span className="text-[11px] text-stone-600">
                                  Eff. : {renderEditable('effectif', f.effectif, '—')}
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-600 leading-snug">{reco.offre}</p>
                            </td>

                            <td className="p-2.5 whitespace-nowrap">
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
                                <span className="font-bold text-stone-700">{maturity}%</span>
                              </div>
                            </td>

                            <td className="p-2.5">
                              <select
                                value={f.statut}
                                onChange={(e) =>
                                  setFiches((prev) =>
                                    prev.map((x) =>
                                      x.id === f.id ? { ...x, statut: e.target.value as StatutCRM } : x
                                    )
                                  )
                                }
                                className="px-2 py-1 rounded-lg border border-stone-200 bg-stone-50 text-xs font-medium text-stone-800"
                              >
                                {STATUTS_CRM.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="p-2.5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                {f.telephone && (
                                  <a
                                    href={`tel:${f.telephone}`}
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
                                    title="WhatsApp Business"
                                    className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openEmailStudio(f)}
                                  title="Rédiger un email personnalisé (IA & cycle contrat)"
                                  className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={verifyingId === f.id}
                                  onClick={() => handleVerifyWeb(f)}
                                  title="Vérifier Web automatiquement (Google IA + Site + Annuaires)"
                                  className="px-2 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 font-semibold text-[11px] flex items-center gap-1 disabled:opacity-50"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  {verifyingId === f.id ? '...' : 'Vérifier'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAssistModalFiche(f);
                                    setAssistPasteText('');
                                    setLastVerifyDiag('');
                                  }}
                                  title="Enrichissement Assisté Rapide (Google, LinkedIn Décideur, Telecontact + Ctrl+V)"
                                  className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700"
                                >
                                  <Globe className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFiches((prev) => prev.filter((x) => x.id !== f.id))}
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
              <div className="px-3.5 py-2 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center justify-between text-[11px] text-stone-500">
                <span>
                  Astuce : clique directement sur n’importe quelle cellule (société, tél, email, contact, effectif) pour l’éditer en place.
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
          </>
        )}

        {/* ================================================================== */}
        {/* ONGLET 2 : CRAWLER WEB PROFOND (NIVEAUX 1 & 2 + MULTI-FALLBACK)    */}
        {/* ================================================================== */}
        {activeTab === 'crawler' && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5 bg-white rounded-xl border border-stone-200 p-4 space-y-3.5">
              <div>
                <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-orange-600" />
                  Crawler Multi-URLs, Pagination & Niveau 2
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Colle 1 à 100 URLs (pages d’annuaires ou fiches directes). Isolation DOM stricte + anti-standard annuaire activés.
                </p>
              </div>

              <textarea
                rows={6}
                value={crawlUrlsInput}
                onChange={(e) => setCrawlUrlsInput(e.target.value)}
                placeholder={'https://www.telecontact.ma/liens/fiduciaires/meknes.php\nhttps://www.kerix.net/fr/annuaire-entreprise/...'}
                className="w-full p-3 rounded-lg border border-stone-300 text-xs font-mono bg-stone-50 focus:bg-white focus:outline-none focus:border-orange-500"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div>
                  <label className="block font-semibold text-stone-600 mb-1">Stratégie CORS</label>
                  <select
                    value={proxyStrategy}
                    onChange={(e) => setProxyStrategy(e.target.value as ProxyStrategy)}
                    className="w-full px-2.5 py-2 rounded-lg border border-stone-300 bg-white"
                  >
                    <option value="auto">Cascade Auto (allorigins → corsproxy → r.jina.ai → direct)</option>
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
                    <span>Pagination auto</span>
                  </label>
                  {enablePagination && (
                    <div className="flex flex-wrap items-center gap-1.5 pl-5">
                      <select
                        value={paginationMode}
                        onChange={(e) => setPaginationMode(e.target.value as 'unlimited' | 'range')}
                        className="px-2 py-1 rounded border border-stone-300 bg-white text-[11px]"
                      >
                        <option value="unlimited">Illimité (toutes pages)</option>
                        <option value="range">Plage de pages</option>
                      </select>
                      {paginationMode === 'range' && (
                        <div className="flex items-center gap-1 text-[11px]">
                          <span>De</span>
                          <input
                            type="number"
                            min={1}
                            value={pageStart}
                            onChange={(e) => setPageStart(Math.max(1, Number(e.target.value) || 1))}
                            className="w-12 px-1.5 py-0.5 rounded border border-stone-300"
                          />
                          <span>à</span>
                          <input
                            type="number"
                            min={1}
                            value={pageEnd}
                            onChange={(e) => setPageEnd(Math.max(pageStart, Number(e.target.value) || pageStart))}
                            className="w-12 px-1.5 py-0.5 rounded border border-stone-300"
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
                    <span>Explorer sous-pages détails (Niveau 2)</span>
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
                    className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <Square className="w-4 h-4" />
                    Stop (garder {crawlProgress.captured} fiches)
                  </button>
                )}
              </div>

              {/* Barre de progression & Journal */}
              {(isCrawling || crawlLogs.length > 0) && (
                <div className="space-y-2 pt-2 border-t border-stone-100">
                  <div className="flex justify-between text-xs font-semibold text-stone-700">
                    <span>
                      Pages : {crawlProgress.done} / {crawlProgress.total}
                    </span>
                    <span className="text-orange-700">{crawlProgress.captured} fiche(s) capturées</span>
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

            {/* Aperçu Extraction Temps Réel */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-stone-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-stone-900">
                  Aperçu Extraction ({crawlPreview.length})
                </h3>
                <div className="flex items-center gap-1.5">
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
                    onClick={() => handleCommitCaptured(crawlPreview, 'Crawler Web')}
                    className="px-3.5 py-2 rounded-lg bg-stone-900 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    Intégrer au portefeuille
                  </button>
                </div>
              </div>

              {crawlPreview.length === 0 ? (
                <div className="p-8 text-center rounded-lg border border-dashed border-stone-300 text-xs text-stone-500">
                  Les fiches capturées apparaîtront ici en temps réel au fil des pages explorées.
                </div>
              ) : (
                <div className="max-h-[440px] overflow-y-auto divide-y divide-stone-100 border border-stone-200 rounded-lg">
                  {crawlPreview.map((f) => {
                    const seg = SEGMENTS_COULEUR[SECTEURS_META[f.secteur].couleur];
                    return (
                      <div key={f.id} className={`p-2.5 text-xs flex justify-between gap-2 ${seg.cardBorder}`}>
                        <div>
                          <p className="font-semibold text-stone-900">{f.societe}</p>
                          <p className="text-stone-500">
                            {SECTEURS_META[f.secteur].label} · {f.ville || '—'} · {f.telephone || 'Sans tél'} ·{' '}
                            {f.email || 'Sans email'}
                          </p>
                        </div>
                        <span className="font-bold text-stone-700 shrink-0">{computeMaturityScore(f)}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ================================================================== */}
        {/* ONGLET 3 : EXTRACTION RÉACTIVE HTML / TEXTE / CSV / JSON           */}
        {/* ================================================================== */}
        {activeTab === 'paste' && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-6 bg-white rounded-xl border border-stone-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-orange-600" />
                  Extraction instantanée (HTML, CSV, JSON ou Texte)
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
                    value={pasteSource}
                    onChange={(e) => setPasteSource(e.target.value)}
                    placeholder="Origine (Pages Jaunes...)"
                    className="px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs w-36"
                  />
                </div>
              </div>

              <textarea
                rows={12}
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                placeholder={`Colle ici du texte copié depuis un annuaire, du code HTML brut, un CSV (;) ou un JSON...\n\nExemple rapide :\nCabinet El Idrissi Expertise\nMeknès - +212 535 52 10 99 - contact@elidrissi-fidu.ma\nExpert-Comptable : Omar El Idrissi (12 salariés)`}
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
                <h3 className="text-sm font-bold text-stone-900">
                  Aperçu Extraction ({pastePreview.length})
                </h3>
                <div className="flex items-center gap-1.5">
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
                    Ajouter {pastePreview.length} fiche(s)
                  </button>
                </div>
              </div>

              {pastePreview.length === 0 ? (
                <div className="p-10 text-center rounded-lg border border-dashed border-stone-300 text-xs text-stone-500">
                  Colle du contenu à gauche : l’extraction, le nettoyage des téléphones (+212 → 05/06/07) et le code couleur Orange Pro s’affichent instantanément ici.
                </div>
              ) : (
                <div className="max-h-[420px] overflow-y-auto divide-y divide-stone-100 border border-stone-200 rounded-lg">
                  {pastePreview.map((f) => {
                    const sec = SECTEURS_META[f.secteur];
                    const seg = SEGMENTS_COULEUR[sec.couleur];
                    return (
                      <div key={f.id} className={`p-2.5 text-xs space-y-1 ${seg.cardBorder}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-stone-900">{f.societe}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${seg.badgeCls}`}>
                            {sec.label}
                          </span>
                        </div>
                        <p className="text-stone-600">
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
        {/* ONGLET 4 : DÉDUPLICATION INTELLIGENTE (ENTITY RESOLUTION MDM)      */}
        {/* ================================================================== */}
        {activeTab === 'dedup' && (
          <section className="bg-white rounded-xl border border-stone-200 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  <GitMerge className="w-4 h-4 text-orange-600" />
                  Moteur Entity Resolution ({duplicateGroups.length} groupe{duplicateGroups.length > 1 ? 's' : ''} détecté{duplicateGroups.length > 1 ? 's' : ''})
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Détection croisée par nom normalisé (hors SARL/SA/STE/ETS/accents), téléphone normalisé et email exact. La fusion conserve la fiche la plus complète, récupère les champs manquants, garde l’effectif max et concatène les sources.
                </p>
              </div>
              {duplicateGroups.length > 0 && (
                <button
                  type="button"
                  onClick={handleMergeAllDuplicates}
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Layers className="w-4 h-4" />
                  Tout fusionner en 1 clic
                </button>
              )}
            </div>

            {duplicateGroups.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-medium text-emerald-800">
                Aucun doublon détecté dans ton portefeuille actuel. Base propre prête à exporter.
              </div>
            ) : (
              <div className="space-y-3">
                {duplicateGroups.map((group) => {
                  const previewMerged = mergeFicheGroup(group.fiches);
                  return (
                    <div key={group.key} className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-amber-900">
                          {group.fiches.length} fiches liées — Motif : {group.motif}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleMergeGroup(group)}
                          className="px-3.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1.5"
                        >
                          <GitMerge className="w-3.5 h-3.5" />
                          Fusionner en 1 clic
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {group.fiches.map((f) => (
                          <div key={f.id} className="p-2.5 rounded-lg bg-white border border-stone-200 text-xs space-y-0.5">
                            <p className="font-semibold text-stone-900">
                              {f.societe} ({computeMaturityScore(f)}%)
                            </p>
                            <p className="text-stone-600">
                              {f.ville} · {f.telephone || '—'} · {f.email || '—'}
                            </p>
                            <p className="text-stone-500">
                              Contact : {f.contact || '—'} · Eff. : {f.effectif || '—'} · Source : {f.source}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                        <strong>Résultat après fusion :</strong> {previewMerged.societe} · {previewMerged.telephone || '—'} ·{' '}
                        {previewMerged.email || '—'} · Contact : {previewMerged.contact || '—'} · Eff. :{' '}
                        {previewMerged.effectif || '—'} · Sources : {previewMerged.source}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Modal Enrichissement Assisté Rapide (anti-blocage proxies : liens 1-clic Google/LinkedIn/Annuaires + extraction Ctrl+V) */}
      {assistModalFiche && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-orange-600" />
                  Enrichissement Assisté — {assistModalFiche.societe}
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  {SECTEURS_META[assistModalFiche.secteur].label} · {assistModalFiche.ville || 'Maroc'} · Tél :{' '}
                  <strong>{assistModalFiche.telephone || 'manquant'}</strong> · Email :{' '}
                  <strong>{assistModalFiche.email || 'manquant'}</strong> · Décideur :{' '}
                  <strong>{assistModalFiche.contact || 'manquant'}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssistModalFiche(null)}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {lastVerifyDiag && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                {lastVerifyDiag}
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-xs font-bold text-stone-700">
                1. Ouvre une piste en 1 clic (Google, LinkedIn Décideur, Annuaires Maroc) :
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(
                    `"${assistModalFiche.societe}" "${assistModalFiche.ville || 'Maroc'}" téléphone email`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold text-center"
                >
                  Google Tél/Email
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
              <label className="block text-xs font-bold text-stone-700">
                2. Colle ici le résultat copié (Ctrl+A / Ctrl+C depuis Google, LinkedIn ou le site) :
              </label>
              <textarea
                rows={6}
                value={assistPasteText}
                onChange={(e) => setAssistPasteText(e.target.value)}
                placeholder="Colle le texte de la fiche Google Maps, du profil LinkedIn du gérant ou de la page Contact... L'application extrait automatiquement le numéro 05/06/07, l'email pro, le décideur, le rôle, l'effectif et corrige le secteur."
                className="w-full p-3 rounded-lg border border-stone-300 text-xs text-stone-900"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => {
                  setShowApiPanel(true);
                  setAssistModalFiche(null);
                }}
                className="text-xs font-semibold text-orange-700 hover:underline flex items-center gap-1"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Activer Google IA automatique (clé Gemini)
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAssistModalFiche(null)}
                  className="px-3 py-2 rounded-lg border border-stone-300 text-xs font-semibold text-stone-700"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={handleApplyAssistedPaste}
                  className="px-4 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5 text-orange-400" />
                  Extraire & Compléter la fiche
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Studio Email Personnalisé IA, Skills & Cycle de Contrat */}
      {emailModalFiche && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-orange-600" />
                  Studio Email IA & Skills — {emailModalFiche.societe}
                </h2>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-stone-700">
                    {SECTEURS_META[emailModalFiche.secteur].label}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-stone-700">
                    {emailModalFiche.ville || 'Maroc'}
                  </span>
                  {emailModalFiche.contact && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700">
                      {emailModalFiche.contact}{emailModalFiche.role ? ` (${emailModalFiche.role})` : ''}
                    </span>
                  )}
                  {emailModalFiche.effectif && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-stone-700">
                      {emailModalFiche.effectif} sal.
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-700">
                    {getOrangeProRecommendation(emailModalFiche).tier}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700">
                    Statut : {emailModalFiche.statut}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEmailModalFiche(null)}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bloc 1 : Choix ou création d'un Skill de rédaction personnalisé */}
            <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                  <span className="text-xs font-bold text-stone-800">Skill de rédaction actif</span>
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
                    className="px-2 py-1 rounded-md border border-stone-300 bg-white hover:bg-stone-100 text-[11px] font-semibold text-stone-700 flex items-center gap-1"
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
                    className="px-2 py-1 rounded-md border border-stone-300 bg-white hover:bg-stone-100 text-[11px] font-semibold text-stone-700 flex items-center gap-1"
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
                    className="px-2 py-1 rounded-md bg-stone-900 hover:bg-stone-800 text-[11px] font-semibold text-white flex items-center gap-1"
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
                    className={`flex items-start justify-between gap-2 p-2 rounded-lg border transition-colors ${
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
                        title="Supprimer ce skill"
                        className={`p-1 rounded ${activeSkill.id === sk.id ? 'text-stone-300 hover:text-white' : 'text-stone-400 hover:text-red-600'}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Éditeur de Skill personnalisé */}
              {showSkillEditor && editingSkill && (
                <div className="mt-2 p-3 rounded-lg border border-orange-200 bg-orange-50/40 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900">Configurer le Skill de rédaction</span>
                    <button
                      type="button"
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
                      value={editingSkill.nom}
                      onChange={(e) => setEditingSkill({ ...editingSkill, nom: e.target.value })}
                      placeholder="Nom du skill (ex. Chasse BTP Chantiers)"
                      className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white"
                    />
                    <input
                      type="text"
                      value={editingSkill.description}
                      onChange={(e) => setEditingSkill({ ...editingSkill, description: e.target.value })}
                      placeholder="Courte description"
                      className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white"
                    />
                  </div>
                  <input
                    type="text"
                    value={editingSkill.role}
                    onChange={(e) => setEditingSkill({ ...editingSkill, role: e.target.value })}
                    placeholder="Posture / Rôle de l'IA (ex. Expert télécoms B2B Orange Pro)"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white"
                  />
                  <textarea
                    rows={3}
                    value={editingSkill.regles}
                    onChange={(e) => setEditingSkill({ ...editingSkill, regles: e.target.value })}
                    placeholder="Instructions du skill : structure, arguments clés, mots interdits, façon d'exploiter les données client..."
                    className="w-full p-2.5 rounded-lg border border-stone-300 bg-white"
                  />
                  <input
                    type="text"
                    value={editingSkill.ctaStyle}
                    onChange={(e) => setEditingSkill({ ...editingSkill, ctaStyle: e.target.value })}
                    placeholder="Style d'appel à l'action (ex. proposer un créneau de 10 min)"
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

            {/* Bloc 2 : Sélecteur Cycle du contrat / Situation client */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-stone-700">
                Situation / Cycle du contrat
              </label>
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

            {/* Ton + Consigne ponctuelle + Génération IA */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-600 mb-1">Ton</label>
                <select
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
                  <option value="court">Ultra-court (4 lignes)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-stone-600 mb-1">
                  Consigne ponctuelle pour l’IA (optionnel)
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={emailCustomPrompt}
                    onChange={(e) => setEmailCustomPrompt(e.target.value)}
                    placeholder="Ex. proposer un passage jeudi à 10h, insister sur la Fibre 100M..."
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

            {/* Destinataire, Objet, Corps */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-stone-600">
                <span>
                  <strong>À :</strong> {emailModalFiche.email || 'Aucun email sur cette fiche (copie possible)'}
                </span>
                <span className="text-[11px] text-stone-500">
                  Offre injectée : <strong>{getOrangeProRecommendation(emailModalFiche).offre}</strong>
                </span>
              </div>
              <div>
                <label className="block font-semibold text-stone-600 mb-1">Objet</label>
                <input
                  type="text"
                  value={emailObjet}
                  onChange={(e) => setEmailObjet(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-600 mb-1">Message</label>
                <textarea
                  rows={8}
                  value={emailCorps}
                  onChange={(e) => setEmailCorps(e.target.value)}
                  className="w-full p-3 rounded-lg border border-stone-300 text-sm text-stone-900 leading-relaxed"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-600 mb-1">Signature</label>
                <input
                  type="text"
                  value={emailSignature}
                  onChange={(e) => setEmailSignature(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-xs"
                />
              </div>
            </div>

            {/* Actions Envoi */}
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
                    notify('Objet et message copiés.');
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
                  notify(`Statut mis à jour : ${nextStatut}`);
                  setEmailModalFiche(null);
                }}
                className="px-3 py-2 rounded-lg bg-stone-900 text-white text-xs font-semibold"
              >
                Marquer envoyé & fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Saisie Rapide */}
      {showQuickAdd && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-900">Saisie rapide d’une entreprise</h2>
              <button
                type="button"
                onClick={() => setShowQuickAdd(false)}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleQuickAdd} className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="block font-semibold text-stone-600 mb-1">Société *</label>
                <input
                  required
                  value={quickForm.societe}
                  onChange={(e) => setQuickForm({ ...quickForm, societe: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-600 mb-1">Secteur</label>
                <select
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
                <label className="block font-semibold text-stone-600 mb-1">Ville</label>
                <input
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
                <label className="block font-semibold text-stone-600 mb-1">Téléphone</label>
                <input
                  value={quickForm.telephone}
                  onChange={(e) => setQuickForm({ ...quickForm, telephone: e.target.value })}
                  placeholder="+212 ou 05/06/07..."
                  className="w-full px-3 py-2 rounded-lg border border-stone-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-600 mb-1">Email pro</label>
                <input
                  type="email"
                  value={quickForm.email}
                  onChange={(e) => setQuickForm({ ...quickForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-600 mb-1">Contact décideur</label>
                <input
                  value={quickForm.contact}
                  onChange={(e) => setQuickForm({ ...quickForm, contact: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-600 mb-1">Rôle</label>
                <input
                  value={quickForm.role}
                  onChange={(e) => setQuickForm({ ...quickForm, role: e.target.value })}
                  placeholder="Gérant, Dr, Me..."
                  className="w-full px-3 py-2 rounded-lg border border-stone-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-600 mb-1">Source</label>
                <input
                  value={quickForm.source}
                  onChange={(e) => setQuickForm({ ...quickForm, source: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-600 mb-1">Effectif (laisser vide si inconnu)</label>
                <input
                  type="number"
                  min={1}
                  value={quickForm.effectif}
                  onChange={(e) => setQuickForm({ ...quickForm, effectif: e.target.value })}
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
    </div>
  );
}