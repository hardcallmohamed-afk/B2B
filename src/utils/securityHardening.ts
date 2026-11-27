// Pure cybersecurity hardening, DLP, CNDP Loi 09-08 & organization governance helpers.
// Works identically in Node/Express and static GitHub Pages builds with zero external dependencies.

export type IdleLockMinutes = 0 | 15 | 30 | 60;

export const IDLE_LOCK_OPTIONS: Array<{ value: IdleLockMinutes; label: string }> = [
  { value: 15, label: '15 minutes (haute sécurité)' },
  { value: 30, label: '30 minutes (recommandé)' },
  { value: 60, label: '60 minutes' },
  { value: 0, label: 'Désactivé' },
];

export type SecurityAuditSeverity = 'info' | 'warn' | 'critical';

export type SecurityAuditCategory =
  | 'export_dlp'
  | 'access_control'
  | 'vault_config'
  | 'org_settings'
  | 'data_privacy'
  | 'session';

export interface SecurityAuditLogRecord {
  id: string;
  orgScope: 'orange_pro_team';
  severity: SecurityAuditSeverity;
  category: SecurityAuditCategory;
  action: string;
  summary: string;
  actorUid: string;
  actorName: string;
  actorRole: string;
  targetUid?: string;
  targetLabel?: string;
  recordCount?: number;
  createdAtIso: string;
}

export interface OrgSettingsConfig {
  companyName: string;
  companyIce: string;
  companyAddress: string;
  companyPhone: string;
  defaultPayoutGrandCompteMad: number;
  defaultPayoutPmeMad: number;
  defaultPayoutTpeMad: number;
  defaultSlaRottingHours: number;
  defaultIdleLockMinutes: IdleLockMinutes;
  dlpExportAlertThreshold: number;
  enforceCndpOptOutLock: boolean;
  updatedBy?: string;
  updatedAtIso?: string;
}

export const DEFAULT_ORG_SETTINGS: OrgSettingsConfig = {
  companyName: 'DIVERSIFIA — Partenaire Officiel Orange Pro B2B',
  companyIce: '',
  companyAddress: 'Meknès / Maroc',
  companyPhone: '',
  defaultPayoutGrandCompteMad: 3500,
  defaultPayoutPmeMad: 1800,
  defaultPayoutTpeMad: 900,
  defaultSlaRottingHours: 72,
  defaultIdleLockMinutes: 30,
  dlpExportAlertThreshold: 50,
  enforceCndpOptOutLock: true,
};

export function sanitizeOrgSettingsConfig(
  raw?: Partial<OrgSettingsConfig> | null
): OrgSettingsConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_ORG_SETTINGS };
  }
  const cleanStr = (val: unknown, maxLen: number, fallback: string): string => {
    if (typeof val !== 'string') return fallback;
    const trimmed = val.trim().slice(0, maxLen);
    return trimmed;
  };
  const clampInt = (val: unknown, min: number, max: number, fallback: number): number => {
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  };
  const rawIdle = Number(raw.defaultIdleLockMinutes);
  const idleLock: IdleLockMinutes =
    rawIdle === 0 || rawIdle === 15 || rawIdle === 30 || rawIdle === 60
      ? (rawIdle as IdleLockMinutes)
      : DEFAULT_ORG_SETTINGS.defaultIdleLockMinutes;

  return {
    companyName:
      cleanStr(raw.companyName, 140, DEFAULT_ORG_SETTINGS.companyName) ||
      DEFAULT_ORG_SETTINGS.companyName,
    companyIce: cleanStr(raw.companyIce, 40, DEFAULT_ORG_SETTINGS.companyIce),
    companyAddress: cleanStr(raw.companyAddress, 220, DEFAULT_ORG_SETTINGS.companyAddress),
    companyPhone: cleanStr(raw.companyPhone, 40, DEFAULT_ORG_SETTINGS.companyPhone),
    defaultPayoutGrandCompteMad: clampInt(
      raw.defaultPayoutGrandCompteMad,
      0,
      200000,
      DEFAULT_ORG_SETTINGS.defaultPayoutGrandCompteMad
    ),
    defaultPayoutPmeMad: clampInt(
      raw.defaultPayoutPmeMad,
      0,
      200000,
      DEFAULT_ORG_SETTINGS.defaultPayoutPmeMad
    ),
    defaultPayoutTpeMad: clampInt(
      raw.defaultPayoutTpeMad,
      0,
      200000,
      DEFAULT_ORG_SETTINGS.defaultPayoutTpeMad
    ),
    defaultSlaRottingHours: clampInt(
      raw.defaultSlaRottingHours,
      12,
      720,
      DEFAULT_ORG_SETTINGS.defaultSlaRottingHours
    ),
    defaultIdleLockMinutes: idleLock,
    dlpExportAlertThreshold: clampInt(
      raw.dlpExportAlertThreshold,
      5,
      5000,
      DEFAULT_ORG_SETTINGS.dlpExportAlertThreshold
    ),
    enforceCndpOptOutLock:
      typeof raw.enforceCndpOptOutLock === 'boolean'
        ? raw.enforceCndpOptOutLock
        : DEFAULT_ORG_SETTINGS.enforceCndpOptOutLock,
    ...(typeof raw.updatedBy === 'string' && raw.updatedBy.trim()
      ? { updatedBy: raw.updatedBy.trim().slice(0, 128) }
      : {}),
    ...(typeof raw.updatedAtIso === 'string' && raw.updatedAtIso.trim()
      ? { updatedAtIso: raw.updatedAtIso.trim().slice(0, 64) }
      : {}),
  };
}

/**
 * Neutralizes CSV Formula Injection (OWASP) and escapes quotes/delimiters/newlines.
 * Any string whose first non-control character is `=`, `+`, `-`, `@`, `\t`, or `\r`
 * is prefixed with a single quote `'` so Excel / LibreOffice / Google Sheets treat it strictly as literal text.
 */
export function sanitizeCsvCell(
  value: unknown,
  options?: { delimiter?: ';' | ','; decimalCommaForNumbers?: boolean }
): string {
  const delimiter = options?.delimiter === ',' ? ',' : ';';
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '0';
    return options?.decimalCommaForNumbers ? String(value).replace('.', ',') : String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'Oui' : 'Non';
  }

  const rawStr = String(value);
  // Detect dangerous leading control chars (\t, \r) BEFORE flattening whitespace
  const startsWithTabOrCr = /^[\t\r]/.test(rawStr);
  // Strip NUL / invisible leading control characters other than tab/cr to inspect true first token
  const flattened = rawStr
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, ' ')
    .replace(/[\r\n]/g, ' ')
    .trim();

  if (!flattened && !startsWithTabOrCr) return '';

  const trimmedForFormulaCheck = flattened.replace(/^[\u0001-\u0020]+/, '');
  const isFormulaTrigger =
    startsWithTabOrCr || /^[=+\-@\t\r]/.test(trimmedForFormulaCheck);

  const safeText = isFormulaTrigger ? `'${flattened}` : flattened;

  const needsQuoting =
    safeText.includes(delimiter) ||
    safeText.includes('"') ||
    safeText.includes('\n') ||
    safeText.includes('\r');

  if (needsQuoting) {
    return `"${safeText.replace(/"/g, '""')}"`;
  }
  return safeText;
}

/**
 * Validates external URLs for clickable `<a href>` links.
 * Accepts ONLY `http:` and `https:` URLs (normalizing bare hostnames like `cabinet.ma` to `https://cabinet.ma`),
 * and strictly rejects `javascript:`, `data:`, `vbscript:`, `file:`, `blob:`, `mailto:` or malformed strings.
 */
export function toSafeExternalHttpUrl(rawUrl?: string | null): string | null {
  if (typeof rawUrl !== 'string') return null;
  // Remove ASCII control characters and surrounding whitespace
  const cleaned = rawUrl.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!cleaned || cleaned.length > 2048) return null;

  // Reject any explicit non-http(s) scheme immediately (case-insensitive, including spaced tricks)
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(cleaned);
  let candidate = cleaned;
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') {
      return null;
    }
  } else {
    // Reject protocol-relative `//evil.com` or relative paths without a valid domain dot
    if (cleaned.startsWith('//') || !/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+/.test(cleaned)) {
      return null;
    }
    candidate = `https://${cleaned}`;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return null;
    }
    // Block credentials embedded in URLs (`https://user:pass@host`)
    if (parsed.username || parsed.password) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

export interface PasswordStrengthResult {
  valid: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Très faible' | 'Faible' | 'Moyen' | 'Robuste' | 'Excellent';
  feedback: string[];
  classesMatched: number;
}

const FORBIDDEN_PASSWORD_PATTERNS = [
  '123456',
  '12345678',
  'password',
  'motdepasse',
  'azerty',
  'qwerty',
  'admin123',
  'orange123',
  'orangepro',
  'diversifia',
  '000000',
  '111111',
];

/**
 * Evaluates password strength per OWASP ASVS L2 / Enterprise CRM policy:
 * - Minimum 10 characters
 * - At least 3 of 4 character classes (uppercase, lowercase, digit, special symbol)
 * - Rejects trivial sequences (`123456`, `password`, `azerty`, `qwerty`, etc.)
 */
export function evaluatePasswordStrength(pwd: string): PasswordStrengthResult {
  const value = typeof pwd === 'string' ? pwd : '';
  const feedback: string[] = [];

  const hasMinLen = value.length >= 10;
  const hasStrongLen = value.length >= 14;
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasDigit = /\d/.test(value);
  const hasSpecial = /[^A-Za-z0-9]/.test(value);
  const classesMatched = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;

  const normalized = value.toLowerCase().replace(/[\s._-]/g, '');
  const hasTrivialSequence = FORBIDDEN_PASSWORD_PATTERNS.some((pat) => normalized.includes(pat));
  const hasRepeatedRun = /(.)\1{3,}/.test(value);

  if (!hasMinLen) {
    feedback.push('Au moins 10 caractères requis.');
  }
  if (classesMatched < 3) {
    feedback.push(
      'Combinez au moins 3 catégories : majuscule, minuscule, chiffre, caractère spécial.'
    );
  }
  if (hasTrivialSequence) {
    feedback.push('Évitez les séquences courantes (123456, password, azerty, qwerty…).');
  }
  if (hasRepeatedRun) {
    feedback.push('Évitez les répétitions identiques (ex. aaaa, 1111).');
  }

  const valid = hasMinLen && classesMatched >= 3 && !hasTrivialSequence && !hasRepeatedRun;

  let score: 0 | 1 | 2 | 3 | 4 = 0;
  if (value.length === 0) {
    score = 0;
  } else if (hasTrivialSequence || value.length < 8) {
    score = 1;
  } else if (!valid) {
    score = 2;
  } else if (hasStrongLen && classesMatched === 4) {
    score = 4;
  } else {
    score = 3;
  }

  const labelMap: Record<PasswordStrengthResult['score'], PasswordStrengthResult['label']> = {
    0: 'Très faible',
    1: 'Faible',
    2: 'Moyen',
    3: 'Robuste',
    4: 'Excellent',
  };

  return {
    valid,
    score,
    label: labelMap[score],
    feedback,
    classesMatched,
  };
}
