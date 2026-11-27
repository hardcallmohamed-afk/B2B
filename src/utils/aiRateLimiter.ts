// In-memory rate limiting and calendar day helpers for server-side AI and Crawl routes.
// Timezone: Africa/Casablanca (standard UTC+1 / daylight aligned with Morocco).

export const AI_DAILY_LIMIT_PER_UID = 40;
export const CRAWL_HOURLY_LIMIT_PER_UID = 30;
export const DETECT_PROVIDER_HOURLY_LIMIT_PER_UID = 30;
export const EMAIL_DAILY_LIMIT_PER_UID = 40;

export function getCasablancaDateKey(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Casablanca',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date); // YYYY-MM-DD
  } catch {
    // Fallback if Intl timeZone is unsupported
    return date.toISOString().slice(0, 10);
  }
}

export function getCasablancaHourKey(date: Date = new Date()): string {
  const dateKey = getCasablancaDateKey(date);
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Casablanca',
      hour: '2-digit',
      hourCycle: 'h23',
    });
    const hour = formatter.format(date).padStart(2, '0');
    return `${dateKey}_${hour}`;
  } catch {
    return `${dateKey}_${date.getUTCHours().toString().padStart(2, '0')}`;
  }
}

interface AiUserUsage {
  dateKey: string;
  count: number;
  lastUsedAt: number;
}

interface CrawlUserUsage {
  hourKey: string;
  count: number;
  lastUsedAt: number;
}

const aiUsageStore = new Map<string, AiUserUsage>();
const crawlUsageStore = new Map<string, CrawlUserUsage>();

export interface AiUsageResult {
  allowed: boolean;
  count: number;
  limit: number;
  dateKey: string;
  remaining: number;
}

export function checkAndIncrementAiUsage(
  uid: string,
  limit: number = AI_DAILY_LIMIT_PER_UID,
  now: Date = new Date()
): AiUsageResult {
  if (!uid || typeof uid !== 'string') {
    return { allowed: false, count: 0, limit, dateKey: '', remaining: 0 };
  }

  const cleanUid = uid.trim();
  const dateKey = getCasablancaDateKey(now);
  const existing = aiUsageStore.get(cleanUid);

  if (!existing || existing.dateKey !== dateKey) {
    aiUsageStore.set(cleanUid, {
      dateKey,
      count: 1,
      lastUsedAt: now.getTime(),
    });
    return {
      allowed: true,
      count: 1,
      limit,
      dateKey,
      remaining: Math.max(0, limit - 1),
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      count: existing.count,
      limit,
      dateKey,
      remaining: 0,
    };
  }

  existing.count += 1;
  existing.lastUsedAt = now.getTime();
  aiUsageStore.set(cleanUid, existing);

  return {
    allowed: true,
    count: existing.count,
    limit,
    dateKey,
    remaining: Math.max(0, limit - existing.count),
  };
}

export interface CrawlUsageResult {
  allowed: boolean;
  count: number;
  limit: number;
  hourKey: string;
  remaining: number;
}

export function checkAndIncrementCrawlUsage(
  uid: string,
  limit: number = CRAWL_HOURLY_LIMIT_PER_UID,
  now: Date = new Date()
): CrawlUsageResult {
  if (!uid || typeof uid !== 'string') {
    return { allowed: false, count: 0, limit, hourKey: '', remaining: 0 };
  }

  const cleanUid = uid.trim();
  const hourKey = getCasablancaHourKey(now);
  const existing = crawlUsageStore.get(cleanUid);

  if (!existing || existing.hourKey !== hourKey) {
    crawlUsageStore.set(cleanUid, {
      hourKey,
      count: 1,
      lastUsedAt: now.getTime(),
    });
    return {
      allowed: true,
      count: 1,
      limit,
      hourKey,
      remaining: Math.max(0, limit - 1),
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      count: existing.count,
      limit,
      hourKey,
      remaining: 0,
    };
  }

  existing.count += 1;
  existing.lastUsedAt = now.getTime();
  crawlUsageStore.set(cleanUid, existing);

  return {
    allowed: true,
    count: existing.count,
    limit,
    hourKey,
    remaining: Math.max(0, limit - existing.count),
  };
}

export function resetAiUsageTracker(): void {
  aiUsageStore.clear();
}

export function resetCrawlUsageTracker(): void {
  crawlUsageStore.clear();
}

export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  error?: string;
}

/**
/**
 * Vérifie si une adresse IPv4 ou IPv6 brute (avec ou sans crochets) appartient à une plage
 * privée, de boucle locale, link-local, CGNAT, TEST-NET, multicast ou métadonnées cloud.
 */
export function isPrivateOrReservedIp(rawIp: string): boolean {
  if (typeof rawIp !== 'string') return true;
  let ip = rawIp.trim().toLowerCase();
  if (!ip) return true;

  // Retirer les crochets IPv6 et l'identifiant de zone (%eth0)
  if (ip.startsWith('[') && ip.endsWith(']')) {
    ip = ip.slice(1, -1);
  }
  const zoneIdx = ip.indexOf('%');
  if (zoneIdx !== -1) {
    ip = ip.slice(0, zoneIdx);
  }

  // Vérification IPv6
  if (ip.includes(':')) {
    if (
      ip === '::' ||
      ip === '::1' ||
      /^0+(?::0+){1,7}$/.test(ip) ||
      /^0+(?::0+){1,6}:0*1$/.test(ip)
    ) {
      return true;
    }
    // IPv4-mapped IPv6 (ex: ::ffff:127.0.0.1 ou forme normalisée ::ffff:7f00:1)
    if (ip.includes('::ffff:') || /^0*:0*:0*:0*:0*:ffff:/i.test(ip)) {
      return true;
    }
    // Unique Local Addresses fc00::/7 (fc00:: - fdff::)
    if (/^f[cd][0-9a-f]{0,2}:/i.test(ip)) {
      return true;
    }
    // Link-Local fe80::/10 (fe80:: - febf::)
    if (/^fe[89ab][0-9a-f]?:/i.test(ip)) {
      return true;
    }
    // Multicast ff00::/8
    if (/^ff[0-9a-f]{0,2}:/i.test(ip)) {
      return true;
    }
    // Documentation 2001:db8::/32
    if (/^2001:0?db8:/i.test(ip)) {
      return true;
    }
    return false;
  }

  // Vérification IPv4
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!ipv4Match) return false;

  const o1 = Number(ipv4Match[1]);
  const o2 = Number(ipv4Match[2]);
  const o3 = Number(ipv4Match[3]);
  const o4 = Number(ipv4Match[4]);

  if (o1 > 255 || o2 > 255 || o3 > 255 || o4 > 255) {
    return true;
  }

  // 0.0.0.0/8 (réseau courant)
  if (o1 === 0) return true;
  // 10.0.0.0/8 (privé classe A)
  if (o1 === 10) return true;
  // 100.64.0.0/10 (CGNAT)
  if (o1 === 100 && o2 >= 64 && o2 <= 127) return true;
  // 127.0.0.0/8 (loopback)
  if (o1 === 127) return true;
  // 169.254.0.0/16 (link-local & métadonnées cloud)
  if (o1 === 169 && o2 === 254) return true;
  // 172.16.0.0/12 (privé classe B)
  if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
  // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (TEST-NET)
  if (
    (o1 === 192 && o2 === 0 && o3 === 2) ||
    (o1 === 198 && o2 === 51 && o3 === 100) ||
    (o1 === 203 && o2 === 0 && o3 === 113)
  ) {
    return true;
  }
  // 192.168.0.0/16 (privé classe C)
  if (o1 === 192 && o2 === 168) return true;
  // 224.0.0.0/4 (multicast) et 240.0.0.0/4 (réservé / diffusion)
  if (o1 >= 224) return true;

  return false;
}

/**
 * LOT 7: Validation stricte anti-SSRF pour le proxy de crawl serveur.
 * Refuse les IP privées (127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x, IPv6 privées, localhost, metadata).
 */
export function validatePublicHttpUrl(rawUrl: unknown): UrlValidationResult {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return { valid: false, error: 'URL manquante ou invalide.' };
  }

  const clean = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(clean);
  } catch {
    return { valid: false, error: 'Format d’URL invalide.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'Protocole non autorisé : seuls http:// et https:// sont supportés.' };
  }

  const rawHost = parsed.hostname.toLowerCase();
  const host = rawHost.startsWith('[') && rawHost.endsWith(']') ? rawHost.slice(1, -1) : rawHost;

  // Reject ambiguous numeric hosts (decimal, octal, hex)
  if (/^(?:0x[0-9a-f]+|0[0-7]+|\d+)$/i.test(host)) {
    return { valid: false, error: 'Accès interdit : format d’hôte numérique ambigu.' };
  }

  // Localhost et domaines internes / métadonnées cloud
  if (
    host === 'localhost' ||
    host === 'metadata.google.internal' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return { valid: false, error: 'Accès interdit : les adresses locales ou internes sont bloquées (anti-SSRF).' };
  }

  // Adresses IPv6 (boucle locale, ULA fc00::/7, link-local fe80::/10, IPv4-mapped ::ffff:, etc.)
  if (host.includes(':')) {
    if (isPrivateOrReservedIp(host)) {
      return { valid: false, error: 'Accès interdit : adresse IPv6 locale, privée ou mappée non autorisée.' };
    }
    return {
      valid: true,
      normalizedUrl: parsed.toString(),
    };
  }

  // Vérification des plages IPv4 privées, CGNAT, TEST-NET, multicast et métadonnées
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) && isPrivateOrReservedIp(host)) {
    return { valid: false, error: 'Accès interdit : adresse IPv4 privée, locale ou réservée.' };
  }

  return {
    valid: true,
    normalizedUrl: parsed.toString(),
  };
}

/**
 * LOT 7: Extraction de texte visible propre à partir du HTML téléchargé.
 */
export function extractVisibleTextFromHtml(html: string, maxLen: number = 300000): string {
  if (!html) return '';

  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<\/(?:p|div|tr|li|h[1-6]|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  // Décoder les entités HTML fréquentes
  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, '/');

  // Normaliser les sauts de ligne et espaces
  cleaned = cleaned
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0)
    .join('\n');

  return cleaned.slice(0, maxLen);
}

const detectProviderUsageStore = new Map<string, CrawlUserUsage>();
const emailUsageStore = new Map<string, AiUserUsage>();

export function checkAndIncrementDetectProviderUsage(
  uid: string,
  limit: number = DETECT_PROVIDER_HOURLY_LIMIT_PER_UID,
  now: Date = new Date()
): CrawlUsageResult {
  if (!uid || typeof uid !== 'string') {
    return { allowed: false, count: 0, limit, hourKey: '', remaining: 0 };
  }
  const cleanUid = uid.trim();
  const hourKey = getCasablancaHourKey(now);
  const existing = detectProviderUsageStore.get(cleanUid);

  if (!existing || existing.hourKey !== hourKey) {
    detectProviderUsageStore.set(cleanUid, {
      hourKey,
      count: 1,
      lastUsedAt: now.getTime(),
    });
    return {
      allowed: true,
      count: 1,
      limit,
      hourKey,
      remaining: Math.max(0, limit - 1),
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      count: existing.count,
      limit,
      hourKey,
      remaining: 0,
    };
  }

  existing.count += 1;
  existing.lastUsedAt = now.getTime();
  detectProviderUsageStore.set(cleanUid, existing);

  return {
    allowed: true,
    count: existing.count,
    limit,
    hourKey,
    remaining: Math.max(0, limit - existing.count),
  };
}

export function checkAndIncrementEmailUsage(
  uid: string,
  limit: number = EMAIL_DAILY_LIMIT_PER_UID,
  now: Date = new Date()
): AiUsageResult {
  if (!uid || typeof uid !== 'string') {
    return { allowed: false, count: 0, limit, dateKey: '', remaining: 0 };
  }
  const cleanUid = uid.trim();
  const dateKey = getCasablancaDateKey(now);
  const existing = emailUsageStore.get(cleanUid);

  if (!existing || existing.dateKey !== dateKey) {
    emailUsageStore.set(cleanUid, {
      dateKey,
      count: 1,
      lastUsedAt: now.getTime(),
    });
    return {
      allowed: true,
      count: 1,
      limit,
      dateKey,
      remaining: Math.max(0, limit - 1),
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      count: existing.count,
      limit,
      dateKey,
      remaining: 0,
    };
  }

  existing.count += 1;
  existing.lastUsedAt = now.getTime();
  emailUsageStore.set(cleanUid, existing);

  return {
    allowed: true,
    count: existing.count,
    limit,
    dateKey,
    remaining: Math.max(0, limit - existing.count),
  };
}

export function resetDetectProviderUsageTracker(): void {
  detectProviderUsageStore.clear();
}

export function resetEmailUsageTracker(): void {
  emailUsageStore.clear();
}

/**
 * Safely extracts and parses a JSON object from an LLM text response,
 * handling markdown code fences, leading/trailing commentary, and invalid JSON without throwing.
 */
export function parseJsonObjectFromLlmText<T = Record<string, unknown>>(rawText: unknown): T | null {
  if (typeof rawText !== 'string') return null;
  const trimmed = rawText.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();
  if (!trimmed) return null;

  try {
    const direct = JSON.parse(trimmed);
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
      return direct as T;
    }
  } catch {
    // Fallback: extract first balanced {...} block
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      const extracted = JSON.parse(candidate);
      if (extracted && typeof extracted === 'object' && !Array.isArray(extracted)) {
        return extracted as T;
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Detects HTML encoding (utf-8, windows-1252, iso-8859-1) from HTTP Content-Type header or HTML meta tags.
 */
export function detectHtmlCharset(contentTypeHeader: string | null, firstBytesAscii: string): string {
  const combined = `${contentTypeHeader || ''} ${firstBytesAscii.slice(0, 2048)}`.toLowerCase();
  if (combined.includes('windows-1252') || combined.includes('cp1252')) {
    return 'windows-1252';
  }
  if (combined.includes('iso-8859-1') || combined.includes('latin1') || combined.includes('latin-1')) {
    return 'iso-8859-1';
  }
  return 'utf-8';
}

/**
 * Detects whether an API key entry in the client hub is a masked Cloud Vault reference
 * (e.g. "cloud_gemini", "••••••••1234", or contains non-ASCII bullets) that must be routed
 * through the backend server proxy rather than sent directly in a browser Authorization header.
 */
export function isVaultOrMaskedApiKey(keyId?: string | null, apiKeyValue?: string | null): boolean {
  if (typeof keyId === 'string' && keyId.trim().toLowerCase().startsWith('cloud_')) {
    return true;
  }
  if (typeof apiKeyValue !== 'string' || !apiKeyValue.trim()) {
    return true;
  }
  const val = apiKeyValue.trim();
  if (val.includes('•') || val.includes('*') || /[^\x20-\x7E]/.test(val)) {
    return true;
  }
  return false;
}

