// Pure extraction, Google AI Overview parser, multi-phone/multi-email helpers, and unique numeroFiche generator.

export const EXCLUDED_PASTE_EMAIL_DOMAINS = [
  'telecontact.ma',
  'kerix.net',
  'pagesjaunes',
  'annuaire',
  'example.com',
  'sentry.io',
  'wixpress.com',
  'google.com',
  'facebook.com',
  'gstatic.com',
  'googleapis.com',
];

export const EXCLUDED_PASTE_EMAIL_PREFIXES = [
  'noreply',
  'no-reply',
  'donotreply',
  'mailer-daemon',
  'abuse',
  'postmaster',
  'webmaster',
  'privacy',
  'support@telecontact',
];

/**
 * Strips invisible Unicode bidi/formatting markers (common in Google Search, Google Maps,
 * Google AI Overview, WhatsApp, and LinkedIn copy-paste) and normalizes dashes/spaces.
 */
export function normalizePastedText(raw: string): string {
  if (!raw) return '';
  let text = raw
    // Strip HTML comments, scripts, styles if rich HTML was pasted
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    // Preserve href tel: and mailto: BEFORE stripping HTML tags
    .replace(/<a\b[^>]*href=["'](?:tel|mailto):([^"']+)["'][^>]*>/gi, ' $1 ')
    .replace(/href=["'](?:tel|mailto):([^"']+)["']/gi, ' $1 ')
    // Replace block tags with newlines to preserve line structure
    .replace(/<\/?(?:p|div|li|br|tr|td|th|h[1-6]|section|article|header|footer|ul|ol)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#64;|&commat;/gi, '@')
    .replace(/&#43;/g, '+')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    // Convert Arabic-Indic digits (٠-٩) to Western digits
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    // Strip zero-width & directional Unicode control characters (Google Maps / AI Overview bidi)
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, '')
    // Normalize non-breaking spaces to regular spaces
    .replace(/[\u00A0\u202F\u2007\u2009]/g, ' ')
    // Normalize Unicode dashes (en-dash, em-dash, minus, figure dash) to ASCII hyphen
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    // De-obfuscate emails like contact [at] domain.ma or contact (at) domain.ma
    .replace(/\s*(?:\[at\]|\(at\)|\[@\]|\(@\)|\s+arobase\s+)\s*/gi, '@')
    .replace(/\s*(?:\[dot\]|\(dot\)|\[point\]|\(point\))\s*/gi, '.');

  text = text.replace(/[ \t]{2,}/g, ' ');
  return text.trim();
}

export function normalizeMoroccanPhoneStrict(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  let d = digits;
  if (d.startsWith('002120') && d.length === 15) d = '0' + d.slice(6);
  else if (d.startsWith('00212') && d.length === 14) d = '0' + d.slice(5);
  else if (d.startsWith('2120') && d.length === 13) d = '0' + d.slice(4);
  else if (d.startsWith('212') && d.length === 12) d = '0' + d.slice(3);
  else if (/^[567]\d{8}$/.test(d)) d = '0' + d;

  if (/^0[567]\d{8}$/.test(d)) {
    // Reject obvious dummy/test numbers like 0600000000
    if (/^0[567](\d)\1{7}$/.test(d)) return '';
    return d;
  }
  return '';
}

export function normalizeEmailStrict(raw: string): string {
  const s = (raw || '')
    .trim()
    .toLowerCase()
    .replace(/^[<(\["']+|[>)\]"'.,;:]+$/g, '');
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) return '';
  if (EXCLUDED_PASTE_EMAIL_PREFIXES.some((p) => s.startsWith(p))) return '';
  if (EXCLUDED_PASTE_EMAIL_DOMAINS.some((d) => s.includes(d))) return '';
  return s;
}

/**
 * Extracts ALL valid Moroccan phone numbers from arbitrary text (including Google AI Overview,
 * Google Maps cards, parentheses like (0535) 52 18 40, +212 (0)5 35-52-18-40, slashes, etc.).
 */
export function extractAllMoroccanPhones(rawText: string): string[] {
  const text = normalizePastedText(rawText);
  if (!text) return [];

  // Match international (+212 / 00212 / (212)) or local (05/06/07 or (0535)) with flexible separators
  const rx =
    /(?:(?:\(\s*)?(?:\+|00)\s*212(?:\s*\))?[\s./-]*(?:\(\s*0\s*\)[\s./-]*)?|\(?\b0)[\s./-]*[567](?:[\s./)-]*\d){8}\b/g;

  const matches = text.match(rx) || [];
  const out: string[] = [];
  for (const m of matches) {
    const norm = normalizeMoroccanPhoneStrict(m);
    if (norm && !out.includes(norm)) {
      out.push(norm);
    }
  }
  return out;
}

/**
 * Extracts ALL valid professional emails from text, prioritizing those whose domain
 * matches the company name first.
 */
export function extractAllEmails(rawText: string, societe = ''): string[] {
  const text = normalizePastedText(rawText);
  if (!text) return [];
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const valid = Array.from(new Set(matches.map(normalizeEmailStrict).filter(Boolean)));
  if (valid.length <= 1 || !societe) return valid;

  const strip = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const tokens = strip(societe)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);

  return valid.sort((a, b) => {
    const aHit = tokens.some((t) => strip(a).includes(t)) ? 1 : 0;
    const bHit = tokens.some((t) => strip(b).includes(t)) ? 1 : 0;
    return bHit - aHit;
  });
}

/**
 * Extracts decision-maker name & role from Google AI Overview prose, LinkedIn snippets,
 * directories, or structured bullets.
 */
export function extractDecideurEnhanced(
  rawText: string,
  fallbackEmail = ''
): { contact: string; role: string } {
  const text = normalizePastedText(rawText);
  const namePart =
    '(?:(?:M\\.|Mr\\.?|Mme\\.?|Mlle\\.?|Dr\\.?|Pr\\.?|Me\\.?)\\s+)?[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ\'-]+(?:\\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ\'-]+){1,2}';

  const cleanCandidate = (name: string): string =>
    name
      .replace(/^(?:M\.|Mr\.?|Mme\.?|Mlle\.?)\s+/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

  const isBadName = (name: string): boolean =>
    /\b(Maroc|Mekn[eè]s|F[eè]s|Casablanca|Rabat|Tanger|Ifrane|Azrou|Orange|Telecom|Soci[eé]t[eé]|Cabinet|Clinique|Fiduciaire|Agence|Groupe|Entreprise|Google|LinkedIn|Aper[cç]u|Contact|Information|Adresse|Quartier|Avenue|Boulevard)\b/i.test(
      name
    );

  // Pattern 1: Google AI Overview prose ("dirigé par M. Karim Bennani", "fondé par Dr Mohamed Tazi", "géré par Salma Idrissi")
  const proseRx = new RegExp(
    `(?:dirig[eé]e?\\s+par|fond[eé]e?\\s+par|g[eé]r[eé]e?\\s+par|pr[eé]sid[eé]e?\\s+par|repr[eé]sent[eé]e?\\s+par)\\s+(${namePart})(?:\\s*[,(\\-–]\\s*([^\\n.,;()]{3,50}))?`,
    'i'
  );
  const proseMatch = text.match(proseRx);
  if (proseMatch) {
    const candidate = cleanCandidate(proseMatch[1]);
    if (!isBadName(candidate)) {
      const explicitRole = (proseMatch[2] || '').trim();
      const inferredRole = /fond/i.test(proseMatch[0])
        ? 'Fondateur'
        : /pr[eé]sid/i.test(proseMatch[0])
        ? 'Président'
        : /g[eé]r/i.test(proseMatch[0])
        ? 'Gérant'
        : 'Directeur';
      return {
        contact: candidate,
        role: explicitRole && explicitRole.length <= 45 ? explicitRole : inferredRole,
      };
    }
  }

  // Pattern 2: Role followed by colon/dash and name ("Directeur Général : Youssef Alami", "• Gérant : Karim Benali")
  const roleWords =
    '(?:Directeur\\s+G[eé]n[eé]ral|Directrice\\s+G[eé]n[eé]rale|PDG|DG|G[eé]rant(?:e)?\\s+Associ[eé](?:e)?|G[eé]rant(?:e)?|Fondateur|Fondatrice|Associ[eé](?:e)?|Directeur(?:\\s+M[eé]dical|\\s+Commercial|\\s+Technique)?|Directrice|Responsable|Notaire|Expert[-\\s]Comptable|Pharmacien(?:ne)?|M[eé]decin|Architecte|Dirigeant(?:e)?)';
  const forwardRx = new RegExp(`(${roleWords})\\s*[:\\-–]\\s*(${namePart})`, 'i');
  const forwardMatch = text.match(forwardRx);
  if (forwardMatch) {
    const candidate = cleanCandidate(forwardMatch[2]);
    if (!isBadName(candidate)) {
      return { contact: candidate, role: forwardMatch[1].trim() };
    }
  }

  // Pattern 3: Inverted LinkedIn / Google AI bullet ("Youssef Alami, Directeur Général" or "Salma Idrissi - Directrice Générale")
  const invertedRx = new RegExp(`(${namePart})\\s*(?:[-–,|•]|est\\s+(?:le|la))\\s*(${roleWords})`, 'i');
  const invertedMatch = text.match(invertedRx);
  if (invertedMatch) {
    const candidate = cleanCandidate(invertedMatch[1]);
    if (!isBadName(candidate)) {
      return { contact: candidate, role: invertedMatch[2].trim() };
    }
  }

  // Pattern 4: Nominative email fallback (prenom.nom@entreprise.ma)
  if (fallbackEmail && fallbackEmail.includes('@')) {
    const local = fallbackEmail.split('@')[0];
    const parts = local.split(/[._-]+/).filter((p) => p.length >= 2 && /^[a-z]+$/i.test(p));
    const genericPrefixes = new Set([
      'contact', 'info', 'infos', 'direction', 'accueil', 'commercial', 'admin',
      'secretariat', 'bureau', 'cabinet', 'clinique', 'etude', 'service', 'sales',
      'rh', 'compta', 'comptabilite', 'hello', 'bonjour', 'support', 'devis',
    ]);
    if (parts.length === 2 && !genericPrefixes.has(parts[0].toLowerCase()) && !genericPrefixes.has(parts[1].toLowerCase())) {
      const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      return { contact: `${cap(parts[0])} ${cap(parts[1])}`, role: 'Contact identifié' };
    }
  }

  return { contact: '', role: '' };
}

/**
 * Extracts headcount from French/English Google AI Overview & LinkedIn copy-paste.
 */
export function extractEffectifEnhanced(rawText: string): string {
  const text = normalizePastedText(rawText);
  if (!text) return '';

  // Range: "entre 10 et 50 salariés" or "11-50 employés" -> take midpoint or upper realistic bound
  const rangeRx =
    /(?:entre\s+)?(\d{1,4})\s*(?:[-–à]|et)\s*(\d{1,4})\s*(?:salari[eé]s?|employ[eé]s?|collaborateurs?|personnes?|membres?|agents?)/i;
  const rm = text.match(rangeRx);
  if (rm) {
    const lo = parseInt(rm[1], 10);
    const hi = parseInt(rm[2], 10);
    if (lo > 0 && hi >= lo && hi <= 50000) {
      return String(Math.round((lo + hi) / 2));
    }
  }

  // Single count: "environ 32 salariés", "équipe de 18 personnes", "Effectif : 45"
  const singleRx =
    /(?:effectif\s*(?:est\s+d['’]environ|d['’]environ|:|-)?\s*(?:environ\s+|plus\s+de\s+)?(\d{1,4})|(?:environ|plus\s+de|pr[eè]s\s+de|[eé]quipe\s+de|compte|comptant)\s+(\d{1,4})\s*(?:salari[eé]s?|employ[eé]s?|collaborateurs?|personnes?|membres?)|(\d{1,4})\+?\s*(?:salari[eé]s?|employ[eé]s?|collaborateurs?|personnes?))/i;
  const sm = text.match(singleRx);
  if (sm) {
    const val = parseInt(sm[1] || sm[2] || sm[3] || '', 10);
    if (val >= 1 && val <= 50000) return String(val);
  }
  return '';
}

/**
 * Extracts an official website URL from Google AI Overview or pasted directory text,
 * even when written as "Site web : www.example.ma" without https://.
 */
export function extractSiteWebEnhanced(rawText: string): string {
  const text = normalizePastedText(rawText);
  if (!text) return '';
  const blocked = /(google\.|linkedin\.|facebook\.|instagram\.|youtube\.|twitter\.|x\.com|telecontact\.|kerix\.|pagesjaunes\.|maps\.app|wikipedia\.)/i;

  const fullUrls = text.match(/https?:\/\/(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s"'<>)\],;]*)?/gi) || [];
  for (const u of fullUrls) {
    if (!blocked.test(u)) return u.replace(/[.,;)]+$/, '');
  }

  const labeledRx = /(?:site\s*web|site\s*officiel|website|web)\s*[:\-–]?\s*(?:https?:\/\/)?((?:www\.)?[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,})/i;
  const lm = text.match(labeledRx);
  if (lm && !blocked.test(lm[1])) {
    return `https://${lm[1].replace(/[.,;)]+$/, '')}`;
  }

  const wwwMatch = text.match(/\b(www\.[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/i);
  if (wwwMatch && !blocked.test(wwwMatch[1])) {
    return `https://${wwwMatch[1].replace(/[.,;)]+$/, '')}`;
  }
  return '';
}

export interface AssistedPasteExtraction {
  phones: string[];
  emails: string[];
  contact: string;
  role: string;
  effectif: string;
  siteWeb: string;
}

export function extractAllFromAssistedPaste(rawText: string, societe = ''): AssistedPasteExtraction {
  const phones = extractAllMoroccanPhones(rawText);
  const emails = extractAllEmails(rawText, societe);
  const dec = extractDecideurEnhanced(rawText, emails[0] || '');
  const effectif = extractEffectifEnhanced(rawText);
  const siteWeb = extractSiteWebEnhanced(rawText);
  return {
    phones,
    emails,
    contact: dec.contact,
    role: dec.role,
    effectif,
    siteWeb,
  };
}

/**
 * Merges newly discovered phone numbers into primary + telephonesSupplementaires (max 10 extras).
 */
export function mergeMultiPhones(
  currentPrimary: string,
  currentExtras: string[] | undefined,
  incomingPhones: string[]
): { primary: string; extras: string[]; addedCount: number } {
  const seen = new Set<string>();
  const primaryNorm = normalizeMoroccanPhoneStrict(currentPrimary);
  let primary = primaryNorm;
  if (primary) seen.add(primary);

  const extras: string[] = [];
  for (const p of currentExtras || []) {
    const n = normalizeMoroccanPhoneStrict(p);
    if (n && !seen.has(n) && extras.length < 10) {
      seen.add(n);
      extras.push(n);
    }
  }

  let addedCount = 0;
  for (const raw of incomingPhones) {
    const n = normalizeMoroccanPhoneStrict(raw);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    if (!primary) {
      primary = n;
      addedCount++;
    } else if (extras.length < 10) {
      extras.push(n);
      addedCount++;
    }
  }

  return { primary, extras, addedCount };
}

/**
 * Merges newly discovered emails into primary + emailsSupplementaires (max 10 extras).
 */
export function mergeMultiEmails(
  currentPrimary: string,
  currentExtras: string[] | undefined,
  incomingEmails: string[]
): { primary: string; extras: string[]; addedCount: number } {
  const seen = new Set<string>();
  const primaryNorm = normalizeEmailStrict(currentPrimary);
  let primary = primaryNorm;
  if (primary) seen.add(primary);

  const extras: string[] = [];
  for (const e of currentExtras || []) {
    const n = normalizeEmailStrict(e);
    if (n && !seen.has(n) && extras.length < 10) {
      seen.add(n);
      extras.push(n);
    }
  }

  let addedCount = 0;
  for (const raw of incomingEmails) {
    const n = normalizeEmailStrict(raw);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    if (!primary) {
      primary = n;
      addedCount++;
    } else if (extras.length < 10) {
      extras.push(n);
      addedCount++;
    }
  }

  return { primary, extras, addedCount };
}

/**
 * Generates the next unique sequential client fiche number (e.g. OP-0001, OP-0013).
 */
export function generateNextNumeroFiche(
  existing: Array<{ numeroFiche?: string }>,
  prefix = 'OP'
): string {
  let maxNum = 0;
  const rx = new RegExp(`^${prefix}-(\\d+)$`, 'i');
  for (const item of existing) {
    const m = (item.numeroFiche || '').trim().match(rx);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    }
  }
  return `${prefix}-${String(maxNum + 1).padStart(4, '0')}`;
}

/**
 * Guarantees every fiche in a list has a unique, valid numeroFiche (backfilling legacy rows).
 */
export function ensureUniqueNumeroFiches<T extends { numeroFiche?: string }>(
  fiches: T[],
  prefix = 'OP'
): T[] {
  const used = new Set<string>();
  let maxNum = 0;
  const rx = new RegExp(`^${prefix}-(\\d+)$`, 'i');

  for (const f of fiches) {
    const m = (f.numeroFiche || '').trim().toUpperCase().match(rx);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    }
  }

  return fiches.map((f) => {
    const existingCode = (f.numeroFiche || '').trim().toUpperCase();
    if (existingCode && /^[A-Z0-9_-]{2,32}$/.test(existingCode) && !used.has(existingCode)) {
      used.add(existingCode);
      return existingCode === f.numeroFiche ? f : { ...f, numeroFiche: existingCode };
    }
    let candidate = '';
    do {
      maxNum++;
      candidate = `${prefix}-${String(maxNum).padStart(4, '0')}`;
    } while (used.has(candidate));
    used.add(candidate);
    return { ...f, numeroFiche: candidate };
  });
}
