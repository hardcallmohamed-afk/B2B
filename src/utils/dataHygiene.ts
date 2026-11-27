import {
  normalizeMoroccanPhone,
  type FicheEntreprise,
} from './crmDomain';
import type { SignedContractRecord } from './gamification';

export const MAX_VALID_HEADCOUNT = 100000;

export type HygieneAnomalyCategory =
  | 'effectif_aberrant'
  | 'telephone_mal_formate'
  | 'email_invalide'
  | 'signe_sans_contrat';

export interface HygieneAnomaly {
  id: string;
  ficheId: string;
  numeroFiche: string;
  societe: string;
  ville: string;
  category: HygieneAnomalyCategory;
  severity: 'warning' | 'error';
  field: 'effectif' | 'telephone' | 'email' | 'statut';
  beforeValue: string;
  afterValue: string | null;
  autoFixable: boolean;
  reason: string;
  proposedPatch?: Partial<FicheEntreprise>;
}

export interface DataHygieneReport {
  anomalies: HygieneAnomaly[];
  countsByCategory: Record<HygieneAnomalyCategory, number>;
  autoFixableCount: number;
  manualReviewCount: number;
  affectedFichesCount: number;
  isHealthy: boolean;
}

export const HYGIENE_CATEGORY_META: Record<
  HygieneAnomalyCategory,
  {
    label: string;
    shortLabel: string;
    badgeCls: string;
  }
> = {
  effectif_aberrant: {
    label: 'Effectifs aberrants',
    shortLabel: 'Effectif',
    badgeCls: 'bg-amber-100 text-amber-900 border-amber-200',
  },
  telephone_mal_formate: {
    label: 'Téléphones mal formatés',
    shortLabel: 'Téléphone',
    badgeCls: 'bg-sky-100 text-sky-900 border-sky-200',
  },
  email_invalide: {
    label: 'Emails invalides / à nettoyer',
    shortLabel: 'Email',
    badgeCls: 'bg-violet-100 text-violet-900 border-violet-200',
  },
  signe_sans_contrat: {
    label: 'Signés sans contrat',
    shortLabel: 'Sans contrat',
    badgeCls: 'bg-red-100 text-red-900 border-red-200',
  },
};

const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CLEAN_MOROCCAN_PHONE_DISPLAY_REGEX =
  /^(?:0[567]\d{8}|0[567](?: \d{2}){4}|\+212 [567] \d{2} \d{2} \d{2} \d{2}|\+212[567]\d{8})$/;

/**
 * Returns true if the headcount string represents an aberrant/corrupted numeric value
 * (e.g. > 100 000 like "500110000", <= 0 like "0" or "-12", or an incoherent multi-number/phone-like digit string).
 * Empty strings and readable labels like "Non précisé" or valid ranges like "10-50" return false.
 */
export function isEffectifAberrant(raw: string | number | undefined | null): boolean {
  if (raw === undefined || raw === null) return false;
  const trimmed = String(raw).trim();
  if (!trimmed) return false;
  if (/^non\s+pr[eé]cis[eé]$/i.test(trimmed)) return false;

  // Negative number (e.g. "-5", "-100")
  if (/^-\s*\d+/.test(trimmed)) return true;

  // Valid small numeric range like "10-25" or "10 - 50" or "50+"
  const rangeMatch = trimmed.match(/^(\d{1,6})\s*[-–/]\s*(\d{1,6})$/);
  if (rangeMatch) {
    const low = Number.parseInt(rangeMatch[1], 10);
    const high = Number.parseInt(rangeMatch[2], 10);
    if (low <= 0 || high <= 0 || low > MAX_VALID_HEADCOUNT || high > MAX_VALID_HEADCOUNT || low > high) {
      return true;
    }
    return false;
  }

  const plusMatch = trimmed.match(/^(\d{1,6})\s*\+$/);
  if (plusMatch) {
    const n = Number.parseInt(plusMatch[1], 10);
    return !Number.isFinite(n) || n <= 0 || n > MAX_VALID_HEADCOUNT;
  }

  // Strip spaces/commas/dots inside numeric strings (e.g. "500 110 000" or "500110000")
  const compactDigits = trimmed.replace(/[\s.,\u00A0\u202F]+/g, '');
  if (/^\d+$/.test(compactDigits)) {
    // Leading-zero long digit sequence like a phone number pasted in effectif ("0661482910")
    if (compactDigits.length >= 9 && /^0[567]/.test(compactDigits)) return true;
    const n = Number.parseInt(compactDigits, 10);
    if (!Number.isFinite(n) || n <= 0 || n > MAX_VALID_HEADCOUNT) return true;
    return false;
  }

  // Mixed string containing digits: check if any extracted number is > 100 000 or == 0
  const digitGroups = trimmed.match(/\d+/g);
  if (digitGroups && digitGroups.length > 0) {
    for (const g of digitGroups) {
      const n = Number.parseInt(g, 10);
      if (!Number.isFinite(n) || n <= 0 || n > MAX_VALID_HEADCOUNT) {
        return true;
      }
    }
    // Multiple unrelated huge digit runs separated by noise (e.g. "12345678 / 999")
    const joinedDigits = digitGroups.join('');
    if (joinedDigits.length >= 7) return true;
  }

  return false;
}

export function formatMoroccanPhoneSpaced(normalized10Digits: string): string {
  if (!/^0[567]\d{8}$/.test(normalized10Digits)) return normalized10Digits;
  return `${normalized10Digits.slice(0, 2)} ${normalized10Digits.slice(2, 4)} ${normalized10Digits.slice(4, 6)} ${normalized10Digits.slice(6, 8)} ${normalized10Digits.slice(8, 10)}`;
}

function inspectPhoneHygiene(raw: string): {
  anomalous: boolean;
  autoFixable: boolean;
  suggestedValue: string | null;
  reason: string;
} {
  const original = raw ?? '';
  if (!original.trim()) {
    return { anomalous: false, autoFixable: false, suggestedValue: null, reason: '' };
  }

  // Already clean Moroccan phone format (compact 06XXXXXXXX, spaced 06 XX XX XX XX, or +212...)
  if (CLEAN_MOROCCAN_PHONE_DISPLAY_REGEX.test(original)) {
    return { anomalous: false, autoFixable: false, suggestedValue: null, reason: '' };
  }

  // Strip invisible bidi/control chars before checking digits
  const strippedBidi = original.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');
  const digits = strippedBidi.replace(/\D/g, '');

  if (digits.length < 9) {
    return {
      anomalous: true,
      autoFixable: false,
      suggestedValue: null,
      reason: `Numéro incomplet (${digits.length} chiffre${digits.length > 1 ? 's' : ''}, minimum 9 requis).`,
    };
  }

  const normalized = normalizeMoroccanPhone(strippedBidi);
  if (normalized) {
    const formatted = formatMoroccanPhoneSpaced(normalized);
    if (formatted !== original) {
      return {
        anomalous: true,
        autoFixable: true,
        suggestedValue: formatted,
        reason: 'Format Maroc normalisable (espaces, préfixe ou caractères parasites détectés).',
      };
    }
    return { anomalous: false, autoFixable: false, suggestedValue: null, reason: '' };
  }

  // Non-Moroccan international number with + and 9..15 digits cleanly formatted
  if (/^\+[1-9]\d{8,14}$/.test(strippedBidi.trim()) && strippedBidi === strippedBidi.trim()) {
    return { anomalous: false, autoFixable: false, suggestedValue: null, reason: '' };
  }

  return {
    anomalous: true,
    autoFixable: false,
    suggestedValue: null,
    reason: 'Format téléphonique non reconnu — vérification manuelle recommandée.',
  };
}

function inspectEmailHygiene(raw: string): {
  anomalous: boolean;
  autoFixable: boolean;
  suggestedValue: string | null;
  reason: string;
} {
  const original = raw ?? '';
  if (!original.trim()) {
    return { anomalous: false, autoFixable: false, suggestedValue: null, reason: '' };
  }

  const cleaned = original
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();

  if (original === cleaned && SIMPLE_EMAIL_REGEX.test(original)) {
    return { anomalous: false, autoFixable: false, suggestedValue: null, reason: '' };
  }

  if (SIMPLE_EMAIL_REGEX.test(cleaned)) {
    return {
      anomalous: true,
      autoFixable: true,
      suggestedValue: cleaned,
      reason:
        original !== original.trim() || /\s/.test(original)
          ? 'Espaces parasites détectés dans l’adresse email.'
          : 'Majuscules inutiles dans l’adresse email (normalisation en minuscules).',
    };
  }

  return {
    anomalous: true,
    autoFixable: false,
    suggestedValue: null,
    reason: 'Syntaxe email invalide (domaine ou « @ » manquant) — correction manuelle requise.',
  };
}

export function analyzeDataHygiene(
  fiches: FicheEntreprise[],
  signedContracts: SignedContractRecord[]
): DataHygieneReport {
  const anomalies: HygieneAnomaly[] = [];
  const countsByCategory: Record<HygieneAnomalyCategory, number> = {
    effectif_aberrant: 0,
    telephone_mal_formate: 0,
    email_invalide: 0,
    signe_sans_contrat: 0,
  };

  const contractFicheIds = new Set<string>();
  const contractNumeros = new Set<string>();
  for (const c of signedContracts) {
    if (c.ficheId && c.ficheId.trim()) {
      contractFicheIds.add(c.ficheId.trim());
    }
    if (c.numeroFiche && c.numeroFiche.trim()) {
      contractNumeros.add(c.numeroFiche.trim().toUpperCase());
    }
  }

  const affectedFicheIds = new Set<string>();

  for (const f of fiches) {
    const numeroFiche = f.numeroFiche || '';

    // 1. Effectif aberrant
    if (isEffectifAberrant(f.effectif)) {
      const anomaly: HygieneAnomaly = {
        id: `${f.id}::effectif_aberrant`,
        ficheId: f.id,
        numeroFiche,
        societe: f.societe,
        ville: f.ville,
        category: 'effectif_aberrant',
        severity: 'error',
        field: 'effectif',
        beforeValue: f.effectif,
        afterValue: 'Non précisé',
        autoFixable: true,
        reason: `Valeur d’effectif incohérente (« ${f.effectif} » > ${MAX_VALID_HEADCOUNT.toLocaleString('fr-FR')} ou invalide).`,
        proposedPatch: { effectif: 'Non précisé' },
      };
      anomalies.push(anomaly);
      countsByCategory.effectif_aberrant += 1;
      affectedFicheIds.add(f.id);
    }

    // 2. Téléphone mal formaté
    const phoneCheck = inspectPhoneHygiene(f.telephone);
    if (phoneCheck.anomalous) {
      const anomaly: HygieneAnomaly = {
        id: `${f.id}::telephone_mal_formate`,
        ficheId: f.id,
        numeroFiche,
        societe: f.societe,
        ville: f.ville,
        category: 'telephone_mal_formate',
        severity: phoneCheck.autoFixable ? 'warning' : 'error',
        field: 'telephone',
        beforeValue: f.telephone,
        afterValue: phoneCheck.suggestedValue,
        autoFixable: phoneCheck.autoFixable,
        reason: phoneCheck.reason,
        proposedPatch: phoneCheck.suggestedValue ? { telephone: phoneCheck.suggestedValue } : undefined,
      };
      anomalies.push(anomaly);
      countsByCategory.telephone_mal_formate += 1;
      affectedFicheIds.add(f.id);
    }

    // 3. Email invalide / sale
    const emailCheck = inspectEmailHygiene(f.email);
    if (emailCheck.anomalous) {
      const anomaly: HygieneAnomaly = {
        id: `${f.id}::email_invalide`,
        ficheId: f.id,
        numeroFiche,
        societe: f.societe,
        ville: f.ville,
        category: 'email_invalide',
        severity: emailCheck.autoFixable ? 'warning' : 'error',
        field: 'email',
        beforeValue: f.email,
        afterValue: emailCheck.suggestedValue,
        autoFixable: emailCheck.autoFixable,
        reason: emailCheck.reason,
        proposedPatch: emailCheck.suggestedValue ? { email: emailCheck.suggestedValue } : undefined,
      };
      anomalies.push(anomaly);
      countsByCategory.email_invalide += 1;
      affectedFicheIds.add(f.id);
    }

    // 4. Signé Orange Pro sans contrat dans signed_contracts
    if (f.statut === 'Signé Orange Pro') {
      const hasById = contractFicheIds.has(f.id.trim());
      const hasByNumero = Boolean(numeroFiche.trim() && contractNumeros.has(numeroFiche.trim().toUpperCase()));
      if (!hasById && !hasByNumero) {
        const anomaly: HygieneAnomaly = {
          id: `${f.id}::signe_sans_contrat`,
          ficheId: f.id,
          numeroFiche,
          societe: f.societe,
          ville: f.ville,
          category: 'signe_sans_contrat',
          severity: 'error',
          field: 'statut',
          beforeValue: 'Signé Orange Pro',
          afterValue: null,
          autoFixable: false,
          reason:
            'Fiche marquée « Signé Orange Pro » sans contrat enregistré dans le suivi des signatures.',
        };
        anomalies.push(anomaly);
        countsByCategory.signe_sans_contrat += 1;
        affectedFicheIds.add(f.id);
      }
    }
  }

  const autoFixableCount = anomalies.filter((a) => a.autoFixable).length;
  const manualReviewCount = anomalies.length - autoFixableCount;

  return {
    anomalies,
    countsByCategory,
    autoFixableCount,
    manualReviewCount,
    affectedFichesCount: affectedFicheIds.size,
    isHealthy: anomalies.length === 0,
  };
}

export interface AppliedHygieneChange {
  ficheId: string;
  field: 'effectif' | 'telephone' | 'email';
  oldValue: string;
  newValue: string;
  reason: string;
}

/**
 * Applies only auto-fixable hygiene anomalies cleanly to a single fiche without mutating the original object.
 */
export function applySafeHygieneFixesToFiche(
  fiche: FicheEntreprise,
  anomaliesForFiche: HygieneAnomaly[]
): {
  updatedFiche: FicheEntreprise;
  changes: AppliedHygieneChange[];
} {
  let updated: FicheEntreprise = { ...fiche };
  const changes: AppliedHygieneChange[] = [];

  for (const a of anomaliesForFiche) {
    if (!a.autoFixable || !a.proposedPatch || a.afterValue === null) continue;
    if (a.field === 'effectif' && typeof a.proposedPatch.effectif === 'string') {
      if (updated.effectif !== a.proposedPatch.effectif) {
        changes.push({
          ficheId: fiche.id,
          field: 'effectif',
          oldValue: updated.effectif,
          newValue: a.proposedPatch.effectif,
          reason: a.reason,
        });
        updated = { ...updated, effectif: a.proposedPatch.effectif };
      }
    } else if (a.field === 'telephone' && typeof a.proposedPatch.telephone === 'string') {
      if (updated.telephone !== a.proposedPatch.telephone) {
        changes.push({
          ficheId: fiche.id,
          field: 'telephone',
          oldValue: updated.telephone,
          newValue: a.proposedPatch.telephone,
          reason: a.reason,
        });
        updated = { ...updated, telephone: a.proposedPatch.telephone };
      }
    } else if (a.field === 'email' && typeof a.proposedPatch.email === 'string') {
      if (updated.email !== a.proposedPatch.email) {
        changes.push({
          ficheId: fiche.id,
          field: 'email',
          oldValue: updated.email,
          newValue: a.proposedPatch.email,
          reason: a.reason,
        });
        updated = { ...updated, email: a.proposedPatch.email };
      }
    }
  }

  return { updatedFiche: updated, changes };
}
