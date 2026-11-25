// Pure client device detection, name splitting, and B2B work-hours attendance tracking helpers.

export type ClientDeviceType = 'desktop' | 'mobile' | 'tablet';

export interface ClientDeviceInfo {
  deviceType: ClientDeviceType;
  os: string;
  browser: string;
  label: string;
}

export interface SplitNameResult {
  firstName: string;
  lastName: string;
}

export interface WorkHoursStatus {
  duringWorkHours: boolean;
  scheduleLabel: string;
}

export interface ParsedWorkDisconnectEvent {
  timestamp: string;
  dateTimeLabel: string;
  reason: string;
}

export const WORK_SCHEDULE_LABEL = 'Lun–Ven 08h30–18h30 · Sam 09h00–13h00';

/**
 * Splits a full display name into Prénom (firstName) and Nom (lastName).
 */
export function splitFirstAndLastName(displayName: string): SplitNameResult {
  const clean = (displayName || '').trim().replace(/\s+/g, ' ');
  if (!clean) {
    return { firstName: '', lastName: '' };
  }
  const parts = clean.split(' ');
  if (parts.length === 1) {
    return { firstName: parts[0].slice(0, 60), lastName: '' };
  }
  return {
    firstName: parts[0].slice(0, 60),
    lastName: parts.slice(1).join(' ').slice(0, 60),
  };
}

/**
 * Extracts readable OS, Browser, and Device Type from User-Agent without any external API call.
 */
export function detectClientDeviceInfo(
  userAgent?: string,
  maxTouchPoints?: number,
  screenWidth?: number
): ClientDeviceInfo {
  const ua =
    typeof userAgent === 'string'
      ? userAgent
      : typeof navigator !== 'undefined'
        ? navigator.userAgent || ''
        : '';
  const touchPts =
    typeof maxTouchPoints === 'number'
      ? maxTouchPoints
      : typeof navigator !== 'undefined'
        ? navigator.maxTouchPoints || 0
        : 0;
  const width =
    typeof screenWidth === 'number'
      ? screenWidth
      : typeof window !== 'undefined'
        ? window.innerWidth || 1280
        : 1280;

  let os = 'Autre';
  if (/iPhone|iPod/i.test(ua)) os = 'iPhone (iOS)';
  else if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && touchPts > 1)) os = 'iPad (iPadOS)';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Windows NT 10\.0|Windows NT 11\.0/i.test(ua)) os = 'Windows';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/CrOS/i.test(ua)) os = 'ChromeOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Navigateur';
  if (/EdgA|EdgiOS|Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/Firefox|FxiOS/i.test(ua)) browser = 'Firefox';
  else if (/Chrome|CriOS/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome|CriOS/i.test(ua)) browser = 'Safari';

  let deviceType: ClientDeviceType = 'desktop';
  if (/iPad|Tablet/i.test(ua) || (os === 'Android' && !/Mobile/i.test(ua)) || os === 'iPad (iPadOS)') {
    deviceType = 'tablet';
  } else if (/Mobile|iPhone|iPod|Android.*Mobile/i.test(ua) || (touchPts > 0 && width < 768)) {
    deviceType = 'mobile';
  }

  const typeLabel =
    deviceType === 'mobile' ? 'Mobile' : deviceType === 'tablet' ? 'Tablette' : 'PC / Bureau';

  return {
    deviceType,
    os,
    browser,
    label: `${os} · ${browser} (${typeLabel})`.slice(0, 160),
  };
}

/**
 * Checks whether a timestamp falls within standard B2B Morocco office hours:
 * - Monday–Friday: 08:30 to 18:30
 * - Saturday: 09:00 to 13:00
 * - Sunday: outside work hours
 */
export function isDuringWorkHours(date: Date = new Date()): WorkHoursStatus {
  const day = date.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  const minutes = date.getHours() * 60 + date.getMinutes();

  if (day >= 1 && day <= 5) {
    return {
      duringWorkHours: minutes >= 8 * 60 + 30 && minutes < 18 * 60 + 30,
      scheduleLabel: WORK_SCHEDULE_LABEL,
    };
  }
  if (day === 6) {
    return {
      duringWorkHours: minutes >= 9 * 60 && minutes < 13 * 60,
      scheduleLabel: WORK_SCHEDULE_LABEL,
    };
  }
  return {
    duringWorkHours: false,
    scheduleLabel: WORK_SCHEDULE_LABEL,
  };
}

/**
 * Local calendar day key YYYY-MM-DD (used to reset daily worked hours cleanly at midnight).
 */
export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatWorkedDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  if (safe === 0) return '0 min';
  if (safe < 60) return '< 1 min';
  const totalMinutes = Math.floor(safe / 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins} min`;
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}

export function formatTimeOnly(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTimeShort(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const datePart = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  const timePart = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

export function buildWorkDisconnectEntry(iso: string, reason: string): string {
  const cleanIso = (iso || new Date().toISOString()).trim().slice(0, 32);
  const cleanReason = (reason || 'Déconnexion').trim().replace(/\|/g, '/').slice(0, 44);
  return `${cleanIso}|${cleanReason}`.slice(0, 80);
}

export function parseWorkDisconnectEvent(raw: string): ParsedWorkDisconnectEvent {
  const [isoPart = '', reasonPart = 'Déconnexion'] = (raw || '').split('|');
  return {
    timestamp: isoPart.trim(),
    dateTimeLabel: formatDateTimeShort(isoPart.trim()),
    reason: reasonPart.trim() || 'Déconnexion',
  };
}

/**
 * Avoids flagging a quick page reload (F5) as an abrupt disconnection during work hours.
 * Only flags if the user remained disconnected for at least graceMs (default 120s).
 */
export function shouldFlagAbruptClosure(
  closedAtMs: number,
  resumedAtMs: number,
  graceMs = 120_000
): boolean {
  if (!Number.isFinite(closedAtMs) || !Number.isFinite(resumedAtMs)) return false;
  return resumedAtMs - closedAtMs >= graceMs;
}

/**
 * Caps heartbeat accumulation step so putting a laptop to sleep overnight never inflates worked hours.
 */
export function computeHeartbeatDeltaSeconds(
  lastTickMs: number,
  nowMs: number,
  maxStepSeconds = 180
): number {
  if (!Number.isFinite(lastTickMs) || !Number.isFinite(nowMs) || nowMs <= lastTickMs) {
    return 0;
  }
  const rawSeconds = Math.round((nowMs - lastTickMs) / 1000);
  return Math.min(maxStepSeconds, Math.max(0, rawSeconds));
}

/**
 * Keeps a deduplicated, bounded list of devices used by a collaborator, newest first.
 */
export function buildDeviceHistoryList(
  existing: string[],
  nextDeviceLabel: string,
  maxItems = 12
): string[] {
  const cleanNext = (nextDeviceLabel || '').trim().slice(0, 160);
  const out: string[] = [];
  const seen = new Set<string>();
  if (cleanNext) {
    seen.add(cleanNext);
    out.push(cleanNext);
  }
  for (const item of existing || []) {
    const clean = (item || '').trim().slice(0, 160);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= maxItems) break;
  }
  return out;
}
