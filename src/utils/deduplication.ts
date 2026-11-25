// Pure Company-Name-First MDM Deduplication Engine for Orange Pro B2B Morocco.
// Strictly prioritizes Company Name (exact normalized + fuzzy core similarity) and NEVER groups solely by email.

export interface DedupCandidate {
  id: string;
  societe: string;
  ville: string;
  telephone: string;
  email: string;
  secteur?: string;
}

export type DuplicateMatchReason =
  | 'Nom de société identique'
  | 'Nom de société très proche'
  | 'Même téléphone & nom compatible'
  | 'Téléphone identique (contrôle secondaire)';

export interface SmartDuplicateGroup<T extends DedupCandidate = DedupCandidate> {
  key: string;
  motif: DuplicateMatchReason;
  confidence: number; // 0..100
  ids: string[];
  fiches: T[];
}

export interface DedupOptions {
  includePhoneOnly?: boolean;
}

const LEGAL_FORM_RX =
  /\b(ste|sté|societe|société|sarl\s*au|sarl|s\.a\.r\.l|sa|s\.a|sas|sasu|snc|sca|ets|etablissement|établissement|etablissements|cabinet|groupe|group|holding|bureau|entreprise|entreprises|maroc|morocco|ma)\b/gi;

const TRAILING_CITY_SUFFIX_RX =
  /(?:\s+(?:a|de|d))?\s+(meknes|fes|rabat|casablanca|casa|tanger|marrakech|agadir|oujda|kenitra|tetouan|ifrane|azrou|el\s+hajeb|elhajeb|boufekrane|moulay\s+idriss\s+zerhoun|moulay\s+idriss|zerhoun|agourai|sebaa\s+ayoune|sale|temara|mohammedia|settat|el\s+jadida|safi|beni\s+mellal|khenifra|taza|nador)$/i;

const GENERIC_SECTOR_STOPWORDS = new Set([
  'fiduciaire',
  'comptable',
  'comptabilite',
  'expertise',
  'conseil',
  'consulting',
  'clinique',
  'privee',
  'prive',
  'polyclinique',
  'centre',
  'medical',
  'medicale',
  'sante',
  'notaire',
  'etude',
  'notariale',
  'immobilier',
  'immobiliere',
  'promotion',
  'promoteur',
  'agence',
  'riad',
  'hotel',
  'auberge',
  'maison',
  'hotes',
  'auto',
  'ecole',
  'conduite',
  'formation',
  'institut',
  'scolaire',
  'college',
  'lycee',
  'pharmacie',
  'parapharmacie',
  'laboratoire',
  'analyses',
  'medicales',
  'travaux',
  'btp',
  'construction',
  'batiment',
  'distribution',
  'commerce',
  'gros',
  'negoce',
  'import',
  'export',
  'industrie',
  'agro',
  'services',
  'service',
  'solutions',
  'generale',
  'general',
  'international',
  'internationale',
  'plus',
  'pro',
  'al',
  'el',
  'le',
  'la',
  'les',
  'de',
  'du',
  'des',
  'et',
  'en',
  'au',
  'aux',
  'pour',
  'avec',
]);

export function stripAccents(str: string): string {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalizes a Moroccan company name for deduplication by stripping legal forms,
 * accents, punctuation, and optionally a trailing Moroccan city suffix.
 */
export function normalizeCompanyNameCore(name: string, stripTrailingCity = false): string {
  let clean = stripAccents(name || '')
    .toLowerCase()
    .replace(/['’`]/g, ' ')
    .replace(LEGAL_FORM_RX, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (stripTrailingCity) {
    const withoutCity = clean.replace(TRAILING_CITY_SUFFIX_RX, '').trim();
    // Only drop the trailing city if meaningful distinctive text remains
    const remainingDistinctive = withoutCity
      .split(' ')
      .filter((t) => t.length >= 2 && !GENERIC_SECTOR_STOPWORDS.has(t));
    if (remainingDistinctive.length > 0) {
      clean = withoutCity;
    }
  }

  return clean;
}

export function extractDistinctiveTokens(name: string): string[] {
  const core = normalizeCompanyNameCore(name, true);
  if (!core) return [];
  const rawTokens = core.split(' ').filter((t) => t.length >= 2);
  const distinctive = rawTokens.filter((t) => !GENERIC_SECTOR_STOPWORDS.has(t));
  return Array.from(new Set(distinctive));
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

/**
 * Evaluates company-name similarity between two records.
 * Returns null if the two company names are not strong duplicates.
 */
export function evaluateCompanyNameMatch(
  a: DedupCandidate,
  b: DedupCandidate
): { motif: DuplicateMatchReason; confidence: number } | null {
  const exactA = normalizeCompanyNameCore(a.societe, false);
  const exactB = normalizeCompanyNameCore(b.societe, false);
  const compactA = exactA.replace(/\s+/g, '');
  const compactB = exactB.replace(/\s+/g, '');

  if (compactA.length >= 3 && compactA === compactB) {
    return { motif: 'Nom de société identique', confidence: 100 };
  }

  const noCityA = normalizeCompanyNameCore(a.societe, true);
  const noCityB = normalizeCompanyNameCore(b.societe, true);
  const compactNoCityA = noCityA.replace(/\s+/g, '');
  const compactNoCityB = noCityB.replace(/\s+/g, '');

  const distA = extractDistinctiveTokens(a.societe);
  const distB = extractDistinctiveTokens(b.societe);

  // Exact match once trailing city name is ignored (only if there is at least 1 distinctive token)
  if (compactNoCityA.length >= 4 && compactNoCityA === compactNoCityB && distA.length >= 1) {
    return { motif: 'Nom de société identique', confidence: 98 };
  }

  // Require at least 1 distinctive (non-generic) token on both sides to prevent
  // matching unrelated companies like "Pharmacie Zerhoun" vs "Pharmacie Atlas".
  if (distA.length === 0 || distB.length === 0) {
    return null;
  }

  // Compare distinctive tokens via exact or very close typo match
  let matchedCount = 0;
  for (const ta of distA) {
    const hasMatch = distB.some((tb) => {
      if (ta === tb) return true;
      if (ta.length >= 5 && tb.length >= 5 && stringSimilarity(ta, tb) >= 0.85) return true;
      return false;
    });
    if (hasMatch) matchedCount++;
  }

  const minTokens = Math.min(distA.length, distB.length);
  const maxTokens = Math.max(distA.length, distB.length);
  const dice = (2 * matchedCount) / (distA.length + distB.length);

  // Case 1: All distinctive tokens of the shorter name are contained in the longer name
  // AND at least one distinctive token has length >= 4 (e.g. "Fiduciaire Ismailia" vs "Fiduciaire Ismailia Expertise")
  const hasStrongCoreToken = distA.some((t) => t.length >= 4 && distB.includes(t));
  if (matchedCount === minTokens && minTokens >= 1 && hasStrongCoreToken) {
    // If both share the exact same distinctive tokens (e.g. "Clinique Privée Atlas Meknès" vs "Clinique Atlas")
    if (distA.length === distB.length) {
      return { motif: 'Nom de société très proche', confidence: 94 };
    }
    // Subset with same sector or same city or >= 2 matching distinctive tokens
    const sameVille =
      Boolean(a.ville && b.ville) &&
      stripAccents(a.ville).toLowerCase().trim() === stripAccents(b.ville).toLowerCase().trim();
    const sameSecteur = Boolean(a.secteur && b.secteur && a.secteur === b.secteur);
    if (matchedCount >= 2 || sameVille || sameSecteur || dice >= 0.66) {
      return { motif: 'Nom de société très proche', confidence: Math.round(84 + dice * 10) };
    }
  }

  // Case 2: High overall Levenshtein similarity on distinctive cores (handles typos like "Ismailia" vs "Ismaelia")
  const distCoreA = [...distA].sort().join(' ');
  const distCoreB = [...distB].sort().join(' ');
  if (distCoreA.length >= 5 && distCoreB.length >= 5) {
    const sim = stringSimilarity(distCoreA, distCoreB);
    if (sim >= 0.84) {
      return { motif: 'Nom de société très proche', confidence: Math.round(sim * 96) };
    }
  }

  // Case 3: High Dice overlap on multi-word distinctive names
  if (maxTokens >= 2 && dice >= 0.78) {
    return { motif: 'Nom de société très proche', confidence: Math.round(dice * 95) };
  }

  return null;
}

/**
 * Checks whether two records with the same phone number also have compatible company names
 * (shares at least one distinctive token or partial string match).
 */
function hasCompatibleNameForPhone(a: DedupCandidate, b: DedupCandidate): boolean {
  const distA = extractDistinctiveTokens(a.societe);
  const distB = extractDistinctiveTokens(b.societe);
  if (distA.length === 0 || distB.length === 0) return false;
  for (const ta of distA) {
    for (const tb of distB) {
      if (ta === tb) return true;
      if (ta.length >= 4 && tb.length >= 4 && (ta.includes(tb) || tb.includes(ta))) return true;
      if (ta.length >= 5 && tb.length >= 5 && stringSimilarity(ta, tb) >= 0.8) return true;
    }
  }
  return false;
}

/**
 * Finds duplicate groups strictly prioritizing Company Name (exact & fuzzy).
 * Emails are NEVER used to group unrelated companies.
 */
export function findSmartDuplicateGroups<T extends DedupCandidate>(
  fiches: T[],
  options: DedupOptions = {}
): SmartDuplicateGroup<T>[] {
  const { includePhoneOnly = false } = options;
  const parent: Record<string, string> = {};
  const metaMap: Record<string, { motif: DuplicateMatchReason; confidence: number }> = {};

  fiches.forEach((f) => {
    parent[f.id] = f.id;
  });

  const find = (x: string): string => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a: string, b: string, motif: DuplicateMatchReason, confidence: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) {
      parent[rb] = ra;
      const existingA = metaMap[ra];
      const existingB = metaMap[rb];
      const best = [existingA, existingB, { motif, confidence }]
        .filter((x): x is { motif: DuplicateMatchReason; confidence: number } => Boolean(x))
        .sort((x, y) => y.confidence - x.confidence)[0];
      metaMap[ra] = best;
    } else if (!metaMap[ra] || confidence > metaMap[ra].confidence) {
      metaMap[ra] = { motif, confidence };
    }
  };

  // Pass 1: Fast exact normalized name bucket (O(n))
  const byExactName = new Map<string, string>();
  for (const f of fiches) {
    const key = normalizeCompanyNameCore(f.societe, false).replace(/\s+/g, '');
    if (key.length >= 3) {
      if (byExactName.has(key)) {
        union(byExactName.get(key)!, f.id, 'Nom de société identique', 100);
      } else {
        byExactName.set(key, f.id);
      }
    }
  }

  // Pass 2: Pairwise fuzzy company-name matching (prioritizes name similarity over everything else)
  for (let i = 0; i < fiches.length; i++) {
    for (let j = i + 1; j < fiches.length; j++) {
      if (find(fiches[i].id) === find(fiches[j].id)) continue;
      const nameMatch = evaluateCompanyNameMatch(fiches[i], fiches[j]);
      if (nameMatch) {
        union(fiches[i].id, fiches[j].id, nameMatch.motif, nameMatch.confidence);
      }
    }
  }

  // Pass 3: Secondary telephone check — ONLY when names are compatible (or user opted into phone-only check).
  // Emails are NEVER used to force deduplication.
  const byPhone = new Map<string, T[]>();
  for (const f of fiches) {
    const cleanPhone = (f.telephone || '').replace(/\D+/g, '');
    if (cleanPhone.length >= 9) {
      const list = byPhone.get(cleanPhone) || [];
      list.push(f);
      byPhone.set(cleanPhone, list);
    }
  }

  byPhone.forEach((samePhoneFiches) => {
    if (samePhoneFiches.length < 2) return;
    for (let i = 0; i < samePhoneFiches.length; i++) {
      for (let j = i + 1; j < samePhoneFiches.length; j++) {
        const a = samePhoneFiches[i];
        const b = samePhoneFiches[j];
        if (find(a.id) === find(b.id)) continue;
        if (hasCompatibleNameForPhone(a, b)) {
          union(a.id, b.id, 'Même téléphone & nom compatible', 82);
        } else if (includePhoneOnly) {
          union(a.id, b.id, 'Téléphone identique (contrôle secondaire)', 68);
        }
      }
    }
  });

  const buckets = new Map<string, T[]>();
  for (const f of fiches) {
    const root = find(f.id);
    const list = buckets.get(root) || [];
    list.push(f);
    buckets.set(root, list);
  }

  const groups: SmartDuplicateGroup<T>[] = [];
  buckets.forEach((list, root) => {
    if (list.length > 1) {
      const meta = metaMap[root] || { motif: 'Nom de société identique' as DuplicateMatchReason, confidence: 90 };
      groups.push({
        key: root,
        motif: meta.motif,
        confidence: meta.confidence,
        ids: list.map((x) => x.id),
        fiches: list,
      });
    }
  });

  // Sort highest-confidence company-name duplicates first
  groups.sort((a, b) => b.confidence - a.confidence || b.fiches.length - a.fiches.length);
  return groups;
}
