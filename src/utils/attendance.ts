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

import {
  MOROCCO_CITIES_CATALOG,
  detectMoroccoGeographyFromCoordinates,
  normalizeCityKey,
  resolveCityAndRegionFromZoneString,
} from './moroccoCities';

export const MOROCCO_CITY_COORDS: Record<string, { lat: number; lng: number; label: string }> =
  Object.fromEntries(
    MOROCCO_CITIES_CATALOG.map((c) => [
      normalizeCityKey(c.name),
      { lat: c.lat, lng: c.lng, label: c.name },
    ])
  );

function sanitizeTelemetryPart(val: string | undefined, maxLen: number): string {
  return (val || '')
    .replace(/[|\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/**
 * Packs live field status, 6-decimal high-precision GPS coordinates (~0.11m precision),
 * and current client activity inside the 160-char currentDevice field
 * so it is 100% compatible with deployed Firestore security rules.
 */
export function encodeLiveFieldTelemetry(input: LiveFieldTelemetryInput): string {
  const base = sanitizeTelemetryPart(stripFieldTelemetrySuffix(input.baseDeviceLabel), 38) || 'Appareil Web';
  const status: FieldActivityStatus = input.status || 'au_travail';
  const hasCoords =
    typeof input.lat === 'number' &&
    typeof input.lng === 'number' &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng);
  const coordPart = hasCoords
    ? `${input.lat!.toFixed(6)},${input.lng!.toFixed(6)},${Math.max(0, Math.round(Number(input.accuracyMeters) || 15))},${Math.max(0, Math.round(Number(input.speedKmh) || 0))}`
    : '';
  const clientPart = sanitizeTelemetryPart(input.clientName, 32);
  const actionPart = sanitizeTelemetryPart(input.actionLabel, 18);
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
      accuracyMeters = Number.isFinite(Number(accStr)) ? Number(accStr) : 15;
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
 * Resolves exact 6-decimal live GPS coordinates or deterministic street-level city coordinates.
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
  regionLabel: string;
  nearestMajorCity: string;
} {
  if (
    typeof params.lat === 'number' &&
    typeof params.lng === 'number' &&
    Number.isFinite(params.lat) &&
    Number.isFinite(params.lng)
  ) {
    const geo = detectMoroccoGeographyFromCoordinates(params.lat, params.lng);
    return {
      lat: Number(params.lat.toFixed(6)),
      lng: Number(params.lng.toFixed(6)),
      source: 'gps_live',
      cityLabel: `${geo.nearestCity} · ${geo.regionLabel}`,
      regionLabel: geo.regionLabel,
      nearestMajorCity: geo.nearestMajorCity,
    };
  }

  const resolvedZone = resolveCityAndRegionFromZoneString(params.zone || 'Meknès');
  const normKey = normalizeCityKey(resolvedZone.city);
  const matched = MOROCCO_CITY_COORDS[normKey] || MOROCCO_CITY_COORDS.meknes || {
    lat: 33.8935,
    lng: -5.5473,
    label: 'Meknès',
  };

  // Micro-offset (~40m–120m around the city center boulevard) when falling back to zone_reseau
  let hash = 0;
  for (let i = 0; i < (params.uid || '').length; i++) {
    hash = (hash * 31 + params.uid.charCodeAt(i)) % 1000;
  }
  const offsetLat = ((hash % 17) - 8) * 0.00035;
  const offsetLng = (((hash >> 3) % 17) - 8) * 0.00035;

  return {
    lat: Number((matched.lat + offsetLat).toFixed(6)),
    lng: Number((matched.lng + offsetLng).toFixed(6)),
    source: 'zone_reseau',
    cityLabel: `${matched.label} · ${resolvedZone.regionLabel}`,
    regionLabel: resolvedZone.regionLabel,
    nearestMajorCity: resolvedZone.majorCity,
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

/**
 * Exact Web Mercator (EPSG:3857) projection used by Google Maps HD tiles.
 * Converts (lat, lng) at zoom Z into global pixel coordinates (256 * 2^Z world size).
 */
export function projectLatLngToMercatorWorld(
  lat: number,
  lng: number,
  zoom: number
): { worldX: number; worldY: number } {
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, Number(lat) || 0));
  const clampedLng = ((Number(lng) || 0) + 180) % 360 - 180;
  const scale = 256 * Math.pow(2, zoom);
  const worldX = ((clampedLng + 180) / 360) * scale;
  const sinLat = Math.sin((clampedLat * Math.PI) / 180);
  const worldY =
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { worldX, worldY };
}

/**
 * Inverse Web Mercator projection: converts a pixel delta (dx, dy) from (centerLat, centerLng)
 * at zoom Z back to exact (lat, lng) so dragging the map pans accurately at any zoom level.
 */
export function panMercatorCenterByPixels(
  centerLat: number,
  centerLng: number,
  dxPixels: number,
  dyPixels: number,
  zoom: number
): { lat: number; lng: number } {
  const scale = 256 * Math.pow(2, zoom);
  const { worldX, worldY } = projectLatLngToMercatorWorld(centerLat, centerLng, zoom);
  const nextX = Math.max(0, Math.min(scale, worldX - dxPixels));
  const nextY = Math.max(0, Math.min(scale, worldY - dyPixels));
  const lng = (nextX / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * nextY) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return {
    lat: Number(Math.max(-85, Math.min(85, lat)).toFixed(6)),
    lng: Number(Math.max(-180, Math.min(180, lng)).toFixed(6)),
  };
}

export interface GoogleMapTileDescriptor {
  key: string;
  tx: number;
  ty: number;
  z: number;
  leftPx: number;
  topPx: number;
  url: string;
}

/**
 * Computes visible 256x256 Google Maps HD tiles for a given viewport (widthPx, heightPx),
 * center (centerLat, centerLng), integer zoom Z (5..19), and Google Maps layer mode.
 */
export function computeVisibleGoogleMapTiles(params: {
  centerLat: number;
  centerLng: number;
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
  mapStyle: 'plan' | 'satellite' | 'hybride' | 'terrain' | 'radar';
}): {
  tiles: GoogleMapTileDescriptor[];
  centerWorldX: number;
  centerWorldY: number;
  intZoom: number;
} {
  const intZoom = Math.max(5, Math.min(19, Math.round(params.zoom)));
  const maxTileIdx = Math.pow(2, intZoom);
  const { worldX: centerWorldX, worldY: centerWorldY } = projectLatLngToMercatorWorld(
    params.centerLat,
    params.centerLng,
    intZoom
  );

  const halfW = Math.max(320, params.viewportWidth) / 2;
  const halfH = Math.max(200, params.viewportHeight) / 2;

  const minTileX = Math.floor((centerWorldX - halfW) / 256) - 1;
  const maxTileX = Math.floor((centerWorldX + halfW) / 256) + 1;
  const minTileY = Math.max(0, Math.floor((centerWorldY - halfH) / 256) - 1);
  const maxTileY = Math.min(maxTileIdx - 1, Math.floor((centerWorldY + halfH) / 256) + 1);

  // Google Maps HD lyrs parameter: m = Plan standard, s = Satellite pur, y = Hybride (Satellite + routes), p = Terrain/Relief
  const lyrs =
    params.mapStyle === 'satellite'
      ? 's'
      : params.mapStyle === 'hybride'
        ? 'y'
        : params.mapStyle === 'terrain'
          ? 'p'
          : 'm';

  const tiles: GoogleMapTileDescriptor[] = [];
  for (let ty = minTileY; ty <= maxTileY; ty++) {
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      const wrappedTx = ((tx % maxTileIdx) + maxTileIdx) % maxTileIdx;
      const serverIdx = Math.abs(wrappedTx + ty) % 4;
      const leftPx = Math.round(tx * 256 - centerWorldX + halfW);
      const topPx = Math.round(ty * 256 - centerWorldY + halfH);
      tiles.push({
        key: `${intZoom}-${wrappedTx}-${ty}-${lyrs}`,
        tx: wrappedTx,
        ty,
        z: intZoom,
        leftPx,
        topPx,
        url: `https://mt${serverIdx}.google.com/vt/lyrs=${lyrs}&x=${wrappedTx}&y=${ty}&z=${intZoom}&hl=fr`,
      });
    }
  }

  return { tiles, centerWorldX, centerWorldY, intZoom };
}

/**
 * Computes exact pixel offset (leftPx, topPx) of a collaborator marker (lat, lng)
 * inside the Google Maps HD viewport so the pin lands on the exact GPS street/building.
 */
export function computeMercatorMarkerPosition(params: {
  lat: number;
  lng: number;
  centerLat: number;
  centerLng: number;
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
}): {
  leftPx: number;
  topPx: number;
  isInsideViewport: boolean;
} {
  const intZoom = Math.max(5, Math.min(19, Math.round(params.zoom)));
  const centerWorld = projectLatLngToMercatorWorld(params.centerLat, params.centerLng, intZoom);
  const pointWorld = projectLatLngToMercatorWorld(params.lat, params.lng, intZoom);
  const halfW = Math.max(320, params.viewportWidth) / 2;
  const halfH = Math.max(200, params.viewportHeight) / 2;
  const leftPx = Math.round(pointWorld.worldX - centerWorld.worldX + halfW);
  const topPx = Math.round(pointWorld.worldY - centerWorld.worldY + halfH);
  const isInsideViewport =
    leftPx >= -40 &&
    leftPx <= params.viewportWidth + 40 &&
    topPx >= -40 &&
    topPx <= params.viewportHeight + 40;
  return { leftPx, topPx, isInsideViewport };
}

export interface AutoAcquiredCoordinates {
  lat: number;
  lng: number;
  accuracyMeters: number;
  speedKmh: number;
  method: 'gps_hardware' | 'wifi_network' | 'ip_geo' | 'cache';
}

const AUTO_GEO_CACHE_KEY = 'op_auto_device_coords_v1';

/**
 * Automatically acquires device coordinates across Android, iPhone/iPad (Apple iOS), macOS, and Windows PC:
 * 1. Immediate local cache hydration (0ms)
 * 2. Silent HTTPS IP/Network geolocation fallback (works on 100% of PCs & phones with zero browser popup)
 * 3. Native HTML5 High-Accuracy GPS + Wi-Fi/Cell fallback + automatic permission & first-gesture hook
 */
export function startAutomaticMultiPlatformLocationEngine(params: {
  onLocationUpdate: (coords: AutoAcquiredCoordinates) => void;
}): () => void {
  let disposed = false;
  let watchId: number | null = null;
  let retryIntervalId: number | null = null;
  let hasHardwareFix = false;

  const saveAndEmit = (coords: AutoAcquiredCoordinates) => {
    if (disposed) return;
    if (
      !Number.isFinite(coords.lat) ||
      !Number.isFinite(coords.lng) ||
      Math.abs(coords.lat) > 90 ||
      Math.abs(coords.lng) > 180
    ) {
      return;
    }
    if (coords.method === 'gps_hardware' || coords.method === 'wifi_network') {
      hasHardwareFix = true;
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(
          AUTO_GEO_CACHE_KEY,
          JSON.stringify({
            lat: Number(coords.lat.toFixed(6)),
            lng: Number(coords.lng.toFixed(6)),
            accuracyMeters: coords.accuracyMeters,
            updatedAt: Date.now(),
          })
        );
      }
    } catch {
      // ignore storage quota
    }
    params.onLocationUpdate({
      ...coords,
      lat: Number(coords.lat.toFixed(6)),
      lng: Number(coords.lng.toFixed(6)),
    });
  };

  // 1. Hydrate immediately from cached coordinates if available
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(AUTO_GEO_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
          params.onLocationUpdate({
            lat: Number(parsed.lat.toFixed(6)),
            lng: Number(parsed.lng.toFixed(6)),
            accuracyMeters: Number(parsed.accuracyMeters) || 25,
            speedKmh: 0,
            method: 'cache',
          });
        }
      }
    }
  } catch {
    // ignore
  }

  // 2. Zero-prompt automatic network geolocation (PC, Android, iPhone fallback before/without popup)
  const fetchNetworkGeoFallback = async () => {
    if (disposed || hasHardwareFix || typeof fetch === 'undefined') return;
    const providers: Array<() => Promise<{ lat: number; lng: number }>> = [
      async () => {
        const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(4500) });
        if (!res.ok) throw new Error('ipwho failed');
        const data = await res.json();
        if (typeof data?.latitude === 'number' && typeof data?.longitude === 'number') {
          return { lat: data.latitude, lng: data.longitude };
        }
        throw new Error('no coords');
      },
      async () => {
        const res = await fetch('https://freeipapi.com/api/json', { signal: AbortSignal.timeout(4500) });
        if (!res.ok) throw new Error('freeipapi failed');
        const data = await res.json();
        if (typeof data?.latitude === 'number' && typeof data?.longitude === 'number') {
          return { lat: data.latitude, lng: data.longitude };
        }
        throw new Error('no coords');
      },
      async () => {
        const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4500) });
        if (!res.ok) throw new Error('ipapi failed');
        const data = await res.json();
        if (typeof data?.latitude === 'number' && typeof data?.longitude === 'number') {
          return { lat: data.latitude, lng: data.longitude };
        }
        throw new Error('no coords');
      },
    ];

    for (const runProvider of providers) {
      if (disposed || hasHardwareFix) return;
      try {
        const coords = await runProvider();
        if (!disposed && !hasHardwareFix) {
          saveAndEmit({
            lat: coords.lat,
            lng: coords.lng,
            accuracyMeters: 45,
            speedKmh: 0,
            method: 'ip_geo',
          });
          return;
        }
      } catch {
        // try next provider
      }
    }
  };

  void fetchNetworkGeoFallback();

  // 3. Native HTML5 GPS / Wi-Fi Triangulation (Android, iPhone/iPad iOS, Windows/macOS PC)
  const handleNativePosition = (pos: GeolocationPosition, highAcc: boolean) => {
    if (disposed) return;
    const spdKmh =
      typeof pos.coords.speed === 'number' && Number.isFinite(pos.coords.speed) && pos.coords.speed > 0
        ? Math.round(pos.coords.speed * 3.6)
        : 0;
    saveAndEmit({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracyMeters: Math.max(3, Math.round(pos.coords.accuracy || (highAcc ? 10 : 25))),
      speedKmh: spdKmh,
      method: highAcc ? 'gps_hardware' : 'wifi_network',
    });
  };

  const startHtml5Geolocation = () => {
    if (disposed || typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
    try {
      // Fast low-latency Wi-Fi/Cell fix first so PC & phones get an immediate coordinate
      navigator.geolocation.getCurrentPosition(
        (pos) => handleNativePosition(pos, false),
        () => {},
        { enableHighAccuracy: false, maximumAge: 10_000, timeout: 5_000 }
      );

      // High-Accuracy GPS fix
      navigator.geolocation.getCurrentPosition(
        (pos) => handleNativePosition(pos, true),
        () => {},
        { enableHighAccuracy: true, maximumAge: 2_000, timeout: 8_000 }
      );

      if (watchId !== null) {
        try {
          navigator.geolocation.clearWatch(watchId);
        } catch {
          // ignore
        }
      }

      watchId = navigator.geolocation.watchPosition(
        (pos) => handleNativePosition(pos, true),
        () => {
          // If High-Accuracy watch fails (e.g. desktop PC without GPS chip), fallback to Wi-Fi triangulation
          if (!disposed && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
              (pos) => handleNativePosition(pos, false),
              () => {},
              { enableHighAccuracy: false, maximumAge: 5_000, timeout: 6_000 }
            );
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 2_500,
          timeout: 8_000,
        }
      );
    } catch {
      // silent
    }
  };

  startHtml5Geolocation();

  // Periodic 3-second active refresh for devices where watchPosition throttles background updates
  if (typeof window !== 'undefined') {
    retryIntervalId = window.setInterval(() => {
      if (disposed) return;
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        try {
          navigator.geolocation.getCurrentPosition(
            (pos) => handleNativePosition(pos, true),
            () => {
              navigator.geolocation.getCurrentPosition(
                (pos) => handleNativePosition(pos, false),
                () => {},
                { enableHighAccuracy: false, maximumAge: 3_000, timeout: 4_000 }
              );
            },
            { enableHighAccuracy: true, maximumAge: 2_500, timeout: 4_000 }
          );
        } catch {
          // ignore
        }
      }
    }, 3_000);
  }

  // On Apple iOS Safari & some mobile browsers, geolocation auto-accepts best on first user gesture
  const handleFirstUserGesture = () => {
    if (disposed) return;
    startHtml5Geolocation();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', handleFirstUserGesture, { once: true, passive: true });
    window.addEventListener('touchstart', handleFirstUserGesture, { once: true, passive: true });
    window.addEventListener('keydown', handleFirstUserGesture, { once: true, passive: true });
  }

  if (typeof navigator !== 'undefined' && 'permissions' in navigator && navigator.permissions?.query) {
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((status) => {
        if (disposed) return;
        status.onchange = () => {
          if (!disposed && status.state === 'granted') {
            startHtml5Geolocation();
          }
        };
      })
      .catch(() => {});
  }

  return () => {
    disposed = true;
    if (retryIntervalId !== null && typeof window !== 'undefined') {
      window.clearInterval(retryIntervalId);
    }
    if (watchId !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        navigator.geolocation.clearWatch(watchId);
      } catch {
        // ignore
      }
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', handleFirstUserGesture);
      window.removeEventListener('touchstart', handleFirstUserGesture);
      window.removeEventListener('keydown', handleFirstUserGesture);
    }
  };
}

