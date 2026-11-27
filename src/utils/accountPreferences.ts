// Shared account preferences, legal issuer settings, and business helpers for CRM DIVERSIFIA Orange Pro B2B.

export interface WorkspaceLegalInfo {
  legalRaisonSociale?: string;
  legalIce?: string;
  legalAdresse?: string;
  legalTelephone?: string;
  raisonSociale?: string;
  ice?: string;
  adresse?: string;
  telephone?: string;
}

export interface AdvancedAccountPreferences {
  monthlyGoalPayoutMad: number;
  preferredContactChannel: 'whatsapp' | 'phone' | 'email';
  ficheNumberPrefix: 'OP-' | 'DIV-' | 'B2B-';
  followUpAlertDelay: '24h' | '48h' | '72h' | '7d';
  targetMaturityPct: 75 | 85 | 95;
  defaultEmailTone: 'terrain' | 'executif' | 'court';
  defaultEmailCycle:
    | 'auto'
    | 'premier_contact'
    | 'suite_passage'
    | 'diagnostic'
    | 'relance_devis'
    | 'fin_contrat'
    | 'renouvellement'
    | 'reactivation';
  preferredAiProvider: 'auto' | 'mistral' | 'groq' | 'gemini' | 'openrouter';
  autoAppendPhoneInEmail: boolean;
  csvDelimiter: ';' | ',';
  workHoursSchedule: 'standard_maroc' | 'continu_08_20' | 'terrain_etendu';
  autoSaveIntervalSec: 15 | 30 | 60;
}

export const DEFAULT_ADVANCED_PREFS: AdvancedAccountPreferences = {
  monthlyGoalPayoutMad: 15000,
  preferredContactChannel: 'whatsapp',
  ficheNumberPrefix: 'DIV-',
  followUpAlertDelay: '48h',
  targetMaturityPct: 85,
  defaultEmailTone: 'terrain',
  defaultEmailCycle: 'premier_contact',
  preferredAiProvider: 'auto',
  autoAppendPhoneInEmail: true,
  csvDelimiter: ';',
  workHoursSchedule: 'standard_maroc',
  autoSaveIntervalSec: 30,
};

export function sanitizeAdvancedAccountPrefs(
  raw?: Partial<AdvancedAccountPreferences> | null
): AdvancedAccountPreferences {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_ADVANCED_PREFS };
  }
  const goalPayout = Number(raw.monthlyGoalPayoutMad);
  const channel = raw.preferredContactChannel;
  const prefix = raw.ficheNumberPrefix;
  const delay = raw.followUpAlertDelay;
  const maturity = Number(raw.targetMaturityPct);
  const tone = raw.defaultEmailTone;
  const cycle = raw.defaultEmailCycle;
  const provider = raw.preferredAiProvider;
  const delim = raw.csvDelimiter;
  const schedule = raw.workHoursSchedule;
  const interval = Number(raw.autoSaveIntervalSec);

  return {
    monthlyGoalPayoutMad:
      Number.isFinite(goalPayout) && goalPayout >= 500 && goalPayout <= 500000
        ? Math.round(goalPayout)
        : DEFAULT_ADVANCED_PREFS.monthlyGoalPayoutMad,
    preferredContactChannel:
      channel === 'whatsapp' || channel === 'phone' || channel === 'email'
        ? channel
        : DEFAULT_ADVANCED_PREFS.preferredContactChannel,
    ficheNumberPrefix:
      prefix === 'OP-' || prefix === 'DIV-' || prefix === 'B2B-'
        ? prefix
        : DEFAULT_ADVANCED_PREFS.ficheNumberPrefix,
    followUpAlertDelay:
      delay === '24h' || delay === '48h' || delay === '72h' || delay === '7d'
        ? delay
        : DEFAULT_ADVANCED_PREFS.followUpAlertDelay,
    targetMaturityPct:
      maturity === 75 || maturity === 85 || maturity === 95
        ? (maturity as 75 | 85 | 95)
        : DEFAULT_ADVANCED_PREFS.targetMaturityPct,
    defaultEmailTone:
      tone === 'terrain' || tone === 'executif' || tone === 'court'
        ? tone
        : DEFAULT_ADVANCED_PREFS.defaultEmailTone,
    defaultEmailCycle:
      cycle === 'auto' ||
      cycle === 'premier_contact' ||
      cycle === 'suite_passage' ||
      cycle === 'diagnostic' ||
      cycle === 'relance_devis' ||
      cycle === 'fin_contrat' ||
      cycle === 'renouvellement' ||
      cycle === 'reactivation'
        ? cycle
        : DEFAULT_ADVANCED_PREFS.defaultEmailCycle,
    preferredAiProvider:
      provider === 'auto' ||
      provider === 'mistral' ||
      provider === 'groq' ||
      provider === 'gemini' ||
      provider === 'openrouter'
        ? provider
        : DEFAULT_ADVANCED_PREFS.preferredAiProvider,
    autoAppendPhoneInEmail:
      typeof raw.autoAppendPhoneInEmail === 'boolean'
        ? raw.autoAppendPhoneInEmail
        : DEFAULT_ADVANCED_PREFS.autoAppendPhoneInEmail,
    csvDelimiter: delim === ';' || delim === ',' ? delim : DEFAULT_ADVANCED_PREFS.csvDelimiter,
    workHoursSchedule:
      schedule === 'standard_maroc' || schedule === 'continu_08_20' || schedule === 'terrain_etendu'
        ? schedule
        : DEFAULT_ADVANCED_PREFS.workHoursSchedule,
    autoSaveIntervalSec:
      interval === 15 || interval === 30 || interval === 60
        ? (interval as 15 | 30 | 60)
        : DEFAULT_ADVANCED_PREFS.autoSaveIntervalSec,
  };
}

export function loadAdvancedAccountPrefs(uid?: string | null): AdvancedAccountPreferences {
  if (typeof window === 'undefined' || !uid) return { ...DEFAULT_ADVANCED_PREFS };
  try {
    const raw = window.localStorage.getItem(`op_advanced_account_prefs_${uid}`);
    if (!raw) return { ...DEFAULT_ADVANCED_PREFS };
    const parsed = JSON.parse(raw);
    return sanitizeAdvancedAccountPrefs(parsed);
  } catch {
    return { ...DEFAULT_ADVANCED_PREFS };
  }
}

export function saveAdvancedAccountPrefs(uid: string, prefs: AdvancedAccountPreferences): AdvancedAccountPreferences {
  const sanitized = sanitizeAdvancedAccountPrefs(prefs);
  if (typeof window !== 'undefined' && uid) {
    try {
      window.localStorage.setItem(`op_advanced_account_prefs_${uid}`, JSON.stringify(sanitized));
      window.dispatchEvent(
        new CustomEvent('op-advanced-prefs-changed', {
          detail: { uid, prefs: sanitized },
        })
      );
    } catch {
      // Ignore storage quota
    }
  }
  return sanitized;
}

export function formatFicheNumeroWithPrefix(
  indexOrRaw: number | string,
  prefix: AdvancedAccountPreferences['ficheNumberPrefix'] = 'OP-'
): string {
  const safePrefix = prefix === 'DIV-' || prefix === 'B2B-' || prefix === 'OP-' ? prefix : 'OP-';
  if (typeof indexOrRaw === 'number') {
    const num = Math.max(1, Math.round(indexOrRaw));
    return `${safePrefix}${String(num).padStart(4, '0')}`;
  }
  const str = String(indexOrRaw || '').trim();
  const digitsMatch = /(\d{1,6})$/.exec(str);
  if (digitsMatch) {
    return `${safePrefix}${digitsMatch[1].padStart(4, '0')}`;
  }
  return `${safePrefix}0001`;
}

export function getFollowUpAlertDelayMs(delay: AdvancedAccountPreferences['followUpAlertDelay']): number {
  switch (delay) {
    case '24h':
      return 24 * 60 * 60 * 1000;
    case '72h':
      return 72 * 60 * 60 * 1000;
    case '7d':
      return 7 * 24 * 60 * 60 * 1000;
    case '48h':
    default:
      return 48 * 60 * 60 * 1000;
  }
}

export function getDefaultProchaineRelanceIso(
  delay: AdvancedAccountPreferences['followUpAlertDelay'],
  fromDate: Date = new Date()
): string {
  const target = new Date(fromDate.getTime() + getFollowUpAlertDelayMs(delay));
  return target.toISOString();
}

export function formatEmailBodyWithOptionalPhone(
  corps: string,
  phonePro: string,
  autoAppendPhone: boolean
): string {
  const cleanBody = (corps || '').trim();
  const cleanPhone = (phonePro || '').trim();
  if (!cleanBody || !autoAppendPhone || !cleanPhone) {
    return cleanBody;
  }
  // Avoid duplicating if the phone digits are already present in the body
  const normalizedBodyDigits = cleanBody.replace(/[\s.\-()]/g, '');
  const normalizedPhoneDigits = cleanPhone.replace(/[\s.\-()]/g, '');
  if (normalizedPhoneDigits.length >= 6 && normalizedBodyDigits.includes(normalizedPhoneDigits)) {
    return cleanBody;
  }
  return `${cleanBody}\nTél direct : ${cleanPhone}`;
}

export interface PersistedFicheExtraFields {
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

/**
 * Restores the 9 scheduling, assignment, and restoration fields when hydrating a FicheEntreprise
 * from a Firestore snapshot so reload never drops user data.
 */
export function extractPersistedFicheFields(d: Record<string, unknown>): PersistedFicheExtraFields {
  const cleanOptStr = (val: unknown, maxLen = 300): string | undefined => {
    if (typeof val !== 'string') return undefined;
    const trimmed = val.trim().slice(0, maxLen);
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const result: PersistedFicheExtraFields = {};
  const prochaineRelanceAt = cleanOptStr(d.prochaineRelanceAt, 64);
  if (prochaineRelanceAt) result.prochaineRelanceAt = prochaineRelanceAt;

  const rdvAt = cleanOptStr(d.rdvAt, 64);
  if (rdvAt) result.rdvAt = rdvAt;

  const rdvLieu = cleanOptStr(d.rdvLieu, 240);
  if (rdvLieu) result.rdvLieu = rdvLieu;

  const assignedByUid = cleanOptStr(d.assignedByUid, 128);
  if (assignedByUid) result.assignedByUid = assignedByUid;

  const assignedByName = cleanOptStr(d.assignedByName, 140);
  if (assignedByName) result.assignedByName = assignedByName;

  const assignedAt = cleanOptStr(d.assignedAt, 64);
  if (assignedAt) result.assignedAt = assignedAt;

  const restoredByName = cleanOptStr(d.restoredByName, 140);
  if (restoredByName) result.restoredByName = restoredByName;

  const restoredAt = cleanOptStr(d.restoredAt, 64);
  if (restoredAt) result.restoredAt = restoredAt;

  const restoredReason = cleanOptStr(d.restoredReason, 400);
  if (restoredReason) result.restoredReason = restoredReason;

  return result;
}

export function computeCurrentMonthContractsAndPayout(
  contracts: Array<{
    ownerId?: string;
    payoutMad?: number;
    statutValidation?: string;
    payoutStatus?: string;
    signedAtIso?: string;
    signedAt?: string;
    createdAtIso?: string;
  }>,
  ownerUidOrNow?: string | Date | null,
  maybeNow?: Date
): {
  currentMonthKey: string;
  currentMonthContractsCount: number;
  currentMonthPayoutMad: number;
  allTimeContractsCount: number;
  allTimePayoutMad: number;
} {
  const ownerUid = typeof ownerUidOrNow === 'string' ? ownerUidOrNow : undefined;
  const now = ownerUidOrNow instanceof Date ? ownerUidOrNow : maybeNow || new Date();

  let currentMonthKey = '';
  try {
    currentMonthKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Casablanca',
      year: 'numeric',
      month: '2-digit',
    })
      .format(now)
      .slice(0, 7);
  } catch {
    currentMonthKey = now.toISOString().slice(0, 7);
  }

  let currentMonthContractsCount = 0;
  let currentMonthPayoutMad = 0;
  let allTimeContractsCount = 0;
  let allTimePayoutMad = 0;

  for (const c of contracts) {
    if (!c || (ownerUid && c.ownerId && c.ownerId !== ownerUid)) continue;
    if (c.statutValidation === 'Rejeté' || c.payoutStatus === 'Refusé') continue;
    const payout = Number.isFinite(Number(c.payoutMad)) ? Math.max(0, Number(c.payoutMad)) : 0;
    allTimeContractsCount += 1;
    allTimePayoutMad += payout;

    const rawDate =
      (typeof c.signedAtIso === 'string' && c.signedAtIso) ||
      (typeof c.signedAt === 'string' && c.signedAt) ||
      c.createdAtIso ||
      '';
    if (rawDate.slice(0, 7) === currentMonthKey) {
      currentMonthContractsCount += 1;
      currentMonthPayoutMad += payout;
    }
  }

  return {
    currentMonthKey,
    currentMonthContractsCount,
    currentMonthPayoutMad,
    allTimeContractsCount,
    allTimePayoutMad,
  };
}
