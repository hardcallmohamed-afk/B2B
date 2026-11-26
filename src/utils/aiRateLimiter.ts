// In-memory rate limiting and calendar day helpers for server-side AI and Crawl routes.
// Timezone: Africa/Casablanca (standard UTC+1 / daylight aligned with Morocco).

export const AI_DAILY_LIMIT_PER_UID = 40;
export const CRAWL_HOURLY_LIMIT_PER_UID = 30;

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
 * LOT 7: Validation stricte anti-SSRF pour le proxy de crawl serveur.
 * Refuse les IP privées (127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x, localhost, metadata).
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

  const host = parsed.hostname.toLowerCase();

  // Reject ambiguous numeric hosts (decimal, octal, hex)
  if (/^(?:0x[0-9a-f]+|0[0-7]+|\d+)$/i.test(host)) {
    return { valid: false, error: 'Accès interdit : format d’hôte numérique ambigu.' };
  }

  // Localhost, IPv6 loopback, unique-local, link-local, et métadonnées cloud
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '[::1]' ||
    host === '0.0.0.0' ||
    host === 'metadata.google.internal' ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    host.startsWith('fe80:') ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return { valid: false, error: 'Accès interdit : les adresses locales ou internes sont bloquées (anti-SSRF).' };
  }

  // IPv4-mapped check (e.g. ::ffff:127.0.0.1)
  if (host.includes('ffff:') || host.includes('::ffff:')) {
    return { valid: false, error: 'Accès interdit : adresses IPv4 mappées non autorisées.' };
  }

  // Vérification des plages IPv4 privées, CGNAT et TEST-NET
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4Match) {
    const o1 = Number(ipv4Match[1]);
    const o2 = Number(ipv4Match[2]);
    const o3 = Number(ipv4Match[3]);
    const o4 = Number(ipv4Match[4]);

    if (o1 > 255 || o2 > 255 || o3 > 255 || o4 > 255) {
      return { valid: false, error: 'Adresse IP invalide.' };
    }

    // 127.0.0.0/8 (Loopback)
    if (o1 === 127) {
      return { valid: false, error: 'Accès interdit aux adresses de boucle locale.' };
    }
    // 10.0.0.0/8 (Réseau privé classe A)
    if (o1 === 10) {
      return { valid: false, error: 'Accès interdit aux adresses réseau privées (10.x.x.x).' };
    }
    // 172.16.0.0/12 (Réseau privé classe B: 172.16 - 172.31)
    if (o1 === 172 && o2 >= 16 && o2 <= 31) {
      return { valid: false, error: 'Accès interdit aux adresses réseau privées (172.16-31.x.x).' };
    }
    // 192.168.0.0/16 (Réseau privé classe C)
    if (o1 === 192 && o2 === 168) {
      return { valid: false, error: 'Accès interdit aux adresses réseau privées (192.168.x.x).' };
    }
    // 100.64.0.0/10 (CGNAT)
    if (o1 === 100 && o2 >= 64 && o2 <= 127) {
      return { valid: false, error: 'Accès interdit aux adresses CGNAT (100.64.x.x).' };
    }
    // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (TEST-NET)
    if (
      (o1 === 192 && o2 === 0 && o3 === 2) ||
      (o1 === 198 && o2 === 51 && o3 === 100) ||
      (o1 === 203 && o2 === 0 && o3 === 113)
    ) {
      return { valid: false, error: 'Accès interdit aux adresses de test (TEST-NET).' };
    }
    // 169.254.0.0/16 (Link-local & AWS/GCP metadata)
    if (o1 === 169 && o2 === 254) {
      return { valid: false, error: 'Accès interdit aux adresses de liaison locale ou métadonnées cloud.' };
    }
    // 0.0.0.0/8 & 255.255.255.255
    if (o1 === 0 || (o1 === 255 && o2 === 255 && o3 === 255 && o4 === 255)) {
      return { valid: false, error: 'Accès interdit à l’adresse réseau 0.0.0.0 ou diffusion.' };
    }
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

