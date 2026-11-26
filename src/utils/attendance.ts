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

export function stripFieldTelemetrySuffix(deviceOrRaw: string): string {
  const raw = (deviceOrRaw || '').trim();
  const idx = raw.indexOf('||@FT|');
  if (idx >= 0) return raw.slice(0, idx).trim();
  return raw;
}

/**
 * Keeps a deduplicated, bounded list of devices used by a collaborator, newest first.
 */
export function buildDeviceHistoryList(
  existing: string[],
  nextDeviceLabel: string,
  maxItems = 12
): string[] {
  const cleanNext = stripFieldTelemetrySuffix(nextDeviceLabel).slice(0, 160);
  const out: string[] = [];
  const seen = new Set<string>();
  if (cleanNext) {
    seen.add(cleanNext);
    out.push(cleanNext);
  }
  for (const item of existing || []) {
    const clean = stripFieldTelemetrySuffix(item).slice(0, 160);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= maxItems) break;
  }
  return out;
}

export type FieldActivityStatus =
  | 'en_rdv_client'
  | 'en_deplacement'
  | 'au_travail'
  | 'en_pause'
  | 'hors_ligne';

export interface LiveFieldTelemetryInput {
  baseDeviceLabel: string;
  status: FieldActivityStatus;
  lat?: number | null;
  lng?: number | null;
  accuracyMeters?: number | null;
  speedKmh?: number | null;
  clientName?: string;
  actionLabel?: string;
}

export interface ParsedLiveFieldTelemetry {
  cleanDeviceLabel: string;
  status: FieldActivityStatus;
  hasLiveGps: boolean;
  lat: number | null;
  lng: number | null;
  accuracyMeters: number | null;
  speedKmh: number | null;
  clientName: string;
  actionLabel: string;
}

export const FIELD_STATUS_META: Record<
  FieldActivityStatus,
  {
    label: string;
    shortLabel: string;
    badgeCls: string;
    pinColor: string;
  }
> = {
  en_rdv_client: {
    label: 'Avec Client / En RDV',
    shortLabel: 'Avec Client',
    badgeCls: 'bg-orange-100 text-orange-900 border border-orange-300',
    pinColor: '#EA580C',
  },
  en_deplacement: {
    label: 'En Déplacement Terrain',
    shortLabel: 'En Déplacement',
    badgeCls: 'bg-sky-100 text-sky-900 border border-sky-300',
    pinColor: '#0284C7',
  },
  au_travail: {
    label: 'Au Travail / Prospection Active',
    shortLabel: 'Au Travail',
    badgeCls: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
    pinColor: '#16A34A',
  },
  en_pause: {
    label: 'Inactif / En Pause',
    shortLabel: 'En Pause',
    badgeCls: 'bg-amber-100 text-amber-900 border border-amber-300',
    pinColor: '#D97706',
  },
  hors_ligne: {
    label: 'Hors Ligne / Non Connecté',
    shortLabel: 'Hors Ligne',
    badgeCls: 'bg-stone-200 text-stone-700 border border-stone-300',
    pinColor: '#78716C',
  },
};

export const MOROCCO_CITY_COORDS: Record<string, { lat: number; lng: number; label: string }> = {
  meknes: { lat: 33.8935, lng: -5.5473, label: 'Meknès' },
  fes: { lat: 34.0331, lng: -5.0003, label: 'Fès' },
  ifrane: { lat: 33.5228, lng: -5.1109, label: 'Ifrane' },
  azrou: { lat: 33.4344, lng: -5.2213, label: 'Azrou' },
  'el hajeb': { lat: 33.6878, lng: -5.371, label: 'El Hajeb' },
  khemisset: { lat: 33.824, lng: -6.0663, label: 'Khémisset' },
  'sidi kacem': { lat: 34.2215, lng: -5.7078, label: 'Sidi Kacem' },
  'sidi slimane': { lat: 34.2648, lng: -5.926, label: 'Sidi Slimane' },
  errachidia: { lat: 31.9314, lng: -4.4266, label: 'Errachidia' },
  rabat: { lat: 34.0209, lng: -6.8416, label: 'Rabat' },
  casablanca: { lat: 33.5731, lng: -7.5898, label: 'Casablanca' },
  tanger: { lat: 35.7595, lng: -5.834, label: 'Tanger' },
  kenitra: { lat: 34.261, lng: -6.5802, label: 'Kénitra' },
  marrakech: { lat: 31.6295, lng: -7.9811, label: 'Marrakech' },
  agadir: { lat: 30.4278, lng: -9.5981, label: 'Agadir' },
  oujda: { lat: 34.6814, lng: -1.9086, label: 'Oujda' },
  tetouan: { lat: 35.5785, lng: -5.3684, label: 'Tétouan' },
};

function sanitizeTelemetryPart(val: string | undefined, maxLen: number): string {
  return (val || '')
    .replace(/[|\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/**
 * Packs live field status, GPS coordinates, and current client activity inside the 160-char currentDevice field
 * so it is 100% compatible with deployed Firestore security rules.
 */
export function encodeLiveFieldTelemetry(input: LiveFieldTelemetryInput): string {
  const base = sanitizeTelemetryPart(stripFieldTelemetrySuffix(input.baseDeviceLabel), 46) || 'Appareil Web';
  const status: FieldActivityStatus = input.status || 'au_travail';
  const hasCoords =
    typeof input.lat === 'number' &&
    typeof input.lng === 'number' &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng);
  const coordPart = hasCoords
    ? `${input.lat!.toFixed(4)},${input.lng!.toFixed(4)},${Math.max(0, Math.round(Number(input.accuracyMeters) || 25))},${Math.max(0, Math.round(Number(input.speedKmh) || 0))}`
    : '';
  const clientPart = sanitizeTelemetryPart(input.clientName, 34);
  const actionPart = sanitizeTelemetryPart(input.actionLabel, 20);
  return `${base}||@FT|${status}|${coordPart}|${clientPart}|${actionPart}`.slice(0, 160);
}

export function parseLiveFieldTelemetry(
  rawCurrentDevice: string,
  isOnline: boolean,
  lastSeenAt?: string
): ParsedLiveFieldTelemetry {
  const raw = (rawCurrentDevice || '').trim();
  const idx = raw.indexOf('||@FT|');

  const isRecentlySeen = (() => {
    if (!lastSeenAt) return true;
    const ts = Date.parse(lastSeenAt);
    if (!Number.isFinite(ts)) return true;
    return Date.now() - ts <= 12 * 60 * 1000;
  })();

  if (idx < 0) {
    const fallbackStatus: FieldActivityStatus = !isOnline
      ? 'hors_ligne'
      : isRecentlySeen
        ? 'au_travail'
        : 'en_pause';
    return {
      cleanDeviceLabel: raw || 'Aucune session enregistrée',
      status: fallbackStatus,
      hasLiveGps: false,
      lat: null,
      lng: null,
      accuracyMeters: null,
      speedKmh: null,
      clientName: '',
      actionLabel: isOnline ? 'Prospection CRM' : '',
    };
  }

  const cleanDeviceLabel = raw.slice(0, idx).trim() || 'Appareil Web';
  const packet = raw.slice(idx + 6);
  const [statusRaw = '', coordRaw = '', clientName = '', actionLabel = ''] = packet.split('|');

  const validStatuses: FieldActivityStatus[] = [
    'en_rdv_client',
    'en_deplacement',
    'au_travail',
    'en_pause',
    'hors_ligne',
  ];
  let status: FieldActivityStatus = validStatuses.includes(statusRaw as FieldActivityStatus)
    ? (statusRaw as FieldActivityStatus)
    : 'au_travail';

  if (!isOnline) {
    status = 'hors_ligne';
  } else if (!isRecentlySeen && status === 'au_travail') {
    status = 'en_pause';
  }

  let lat: number | null = null;
  let lng: number | null = null;
  let accuracyMeters: number | null = null;
  let speedKmh: number | null = null;
  let hasLiveGps = false;

  if (coordRaw) {
    const [latStr, lngStr, accStr, spdStr] = coordRaw.split(',');
    const parsedLat = Number(latStr);
    const parsedLng = Number(lngStr);
    if (
      Number.isFinite(parsedLat) &&
      Number.isFinite(parsedLng) &&
      Math.abs(parsedLat) <= 90 &&
      Math.abs(parsedLng) <= 180
    ) {
      lat = parsedLat;
      lng = parsedLng;
      hasLiveGps = true;
      accuracyMeters = Number.isFinite(Number(accStr)) ? Number(accStr) : 25;
      speedKmh = Number.isFinite(Number(spdStr)) ? Number(spdStr) : 0;
    }
  }

  return {
    cleanDeviceLabel,
    status,
    hasLiveGps,
    lat,
    lng,
    accuracyMeters,
    speedKmh,
    clientName: clientName.trim(),
    actionLabel: actionLabel.trim() || (isOnline ? 'Actif sur CRM' : ''),
  };
}

/**
 * Resolves live GPS coordinates or deterministic zone fallback coordinates for the dispatch radar.
 */
export function resolveCollaboratorCoordinates(params: {
  uid: string;
  zone: string;
  lat: number | null;
  lng: number | null;
}): {
  lat: number;
  lng: number;
  source: 'gps_live' | 'zone_reseau';
  cityLabel: string;
} {
  if (
    typeof params.lat === 'number' &&
    typeof params.lng === 'number' &&
    Number.isFinite(params.lat) &&
    Number.isFinite(params.lng)
  ) {
    return {
      lat: params.lat,
      lng: params.lng,
      source: 'gps_live',
      cityLabel: params.zone || 'Position GPS Directe',
    };
  }

  const normalizedZone = (params.zone || 'Meknès')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  let matched = MOROCCO_CITY_COORDS.meknes;
  for (const [key, val] of Object.entries(MOROCCO_CITY_COORDS)) {
    if (normalizedZone.includes(key)) {
      matched = val;
      break;
    }
  }

  // Deterministic micro-offset from uid so multiple agents in the same city stay distinct on the radar
  let hash = 0;
  for (let i = 0; i < (params.uid || '').length; i++) {
    hash = (hash * 31 + params.uid.charCodeAt(i)) % 1000;
  }
  const offsetLat = ((hash % 29) - 14) * 0.0022;
  const offsetLng = (((hash >> 3) % 29) - 14) * 0.0022;

  return {
    lat: Number((matched.lat + offsetLat).toFixed(4)),
    lng: Number((matched.lng + offsetLng).toFixed(4)),
    source: 'zone_reseau',
    cityLabel: matched.label,
  };
}

/**
 * Computes distance in km between two WGS84 points (Haversine).
 */
export function computeDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}
