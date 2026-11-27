import { auth, fetchCloudRtcIceConfig } from '../firebase';
import { isStaticHostingEnvironment } from './aiCopilotClient';

export const DEFAULT_STUN_ICE_SERVERS: RTCIceServer[] = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:stun.cloudflare.com:3478',
    ],
  },
];

export type RtcIceConfigSource = 'server' | 'firestore' | 'env' | 'stun_only';

export interface ResolvedRtcIceConfig {
  iceServers: RTCIceServer[];
  turnConfigured: boolean;
  source: RtcIceConfigSource;
  providerLabel: string;
}

export function hasTurnServerInList(iceServers: RTCIceServer[]): boolean {
  if (!Array.isArray(iceServers)) return false;
  for (const srv of iceServers) {
    if (!srv || typeof srv !== 'object' || !('urls' in srv)) continue;
    const urls = Array.isArray(srv.urls) ? srv.urls : [srv.urls];
    if (urls.some((u) => typeof u === 'string' && /^turns?:/i.test(u.trim()))) {
      return true;
    }
  }
  return false;
}

export function parseIceServersJson(rawJson: string): RTCIceServer[] {
  if (typeof rawJson !== 'string' || !rawJson.trim()) return [];
  try {
    const parsed = JSON.parse(rawJson.trim()) as unknown;
    const arr = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { iceServers?: unknown[] })?.iceServers)
        ? (parsed as { iceServers: unknown[] }).iceServers
        : [];
    const valid: RTCIceServer[] = [];
    for (const item of arr) {
      if (!item || typeof item !== 'object' || !('urls' in item)) continue;
      const entry = item as { urls?: unknown; username?: unknown; credential?: unknown };
      const rawUrls = Array.isArray(entry.urls) ? entry.urls : [entry.urls];
      const cleanUrls = rawUrls
        .filter((u): u is string => typeof u === 'string' && /^(stuns?|turns?):/i.test(u.trim()))
        .map((u) => u.trim());
      if (cleanUrls.length === 0) continue;
      const server: RTCIceServer = {
        urls: cleanUrls.length === 1 ? cleanUrls[0] : cleanUrls,
      };
      if (typeof entry.username === 'string' && entry.username.trim()) {
        server.username = entry.username.trim();
      }
      if (typeof entry.credential === 'string' && entry.credential.trim()) {
        server.credential = entry.credential.trim();
      }
      valid.push(server);
    }
    return valid;
  } catch {
    return [];
  }
}

export function buildTurnIceServersJson(params: {
  turnUrls: string;
  username?: string;
  credential?: string;
}): string {
  const splitUrls = params.turnUrls
    .split(/[\n,;]+/)
    .map((u) => u.trim())
    .filter((u) => /^turns?:/i.test(u));
  const servers: RTCIceServer[] = [
    ...DEFAULT_STUN_ICE_SERVERS,
    ...(splitUrls.length > 0
      ? [
          {
            urls: splitUrls.length === 1 ? splitUrls[0] : splitUrls,
            ...(params.username?.trim() ? { username: params.username.trim() } : {}),
            ...(params.credential?.trim() ? { credential: params.credential.trim() } : {}),
          },
        ]
      : []),
  ];
  return JSON.stringify(servers, null, 2);
}

export function ensureDefaultStunIncluded(servers: RTCIceServer[]): RTCIceServer[] {
  const hasStun = servers.some((s) => {
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
    return urls.some((u) => typeof u === 'string' && /^stuns?:/i.test(u.trim()));
  });
  if (hasStun) return servers;
  return [...DEFAULT_STUN_ICE_SERVERS, ...servers];
}

export function extractIceCandidateType(
  candidateStr: string | undefined | null
): 'relay' | 'srflx' | 'prflx' | 'host' | 'unknown' {
  if (!candidateStr || typeof candidateStr !== 'string') return 'unknown';
  const match = candidateStr.match(/\btyp\s+(relay|srflx|prflx|host)\b/i);
  if (!match) return 'unknown';
  return match[1].toLowerCase() as 'relay' | 'srflx' | 'prflx' | 'host';
}

export async function resolveRtcIceConfiguration(): Promise<ResolvedRtcIceConfig> {
  // 1. Mode serveur Node/Express : interroger /api/rtc/ice-servers avec jeton Firebase Bearer
  if (!isStaticHostingEnvironment()) {
    try {
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      if (idToken) {
        const res = await fetch('/api/rtc/ice-servers', {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
          signal: AbortSignal.timeout(3500),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            iceServers?: RTCIceServer[];
            turnConfigured?: boolean;
          };
          if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
            const merged = ensureDefaultStunIncluded(data.iceServers);
            const hasTurn = Boolean(data.turnConfigured) || hasTurnServerInList(merged);
            if (hasTurn) {
              return {
                iceServers: merged,
                turnConfigured: true,
                source: 'server',
                providerLabel: 'Serveur Node/Express (/api/rtc/ice-servers)',
              };
            }
          }
        }
      }
    } catch {
      // Bascule vers Firestore / variables VITE_TURN_*
    }
  }

  // 2. Mode statique GitHub Pages (/B2B/) ou serveur sans TURN : lire /app_config/rtc_ice dans Firestore
  try {
    const cloudCfg = await fetchCloudRtcIceConfig();
    if (cloudCfg && cloudCfg.turnEnabled && cloudCfg.iceServersJson) {
      const parsed = parseIceServersJson(cloudCfg.iceServersJson);
      if (parsed.length > 0) {
        const merged = ensureDefaultStunIncluded(parsed);
        const hasTurn = hasTurnServerInList(merged);
        if (hasTurn) {
          return {
            iceServers: merged,
            turnConfigured: true,
            source: 'firestore',
            providerLabel: cloudCfg.providerLabel || 'Relais TURN Cloud Firestore (4G/5G Maroc)',
          };
        }
      }
    }
  } catch {
    // Bascule vers variables VITE_TURN_*
  }

  // 3. Variables d'environnement publiques de build (VITE_TURN_URL / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL)
  const envMeta = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};
  const envTurnUrl = (envMeta.VITE_TURN_URL || '').trim();
  const envTurnUser = (envMeta.VITE_TURN_USERNAME || '').trim();
  const envTurnCred = (envMeta.VITE_TURN_CREDENTIAL || '').trim();
  if (envTurnUrl) {
    const turnUrls = envTurnUrl
      .split(/[\n,;]+/)
      .map((u) => u.trim())
      .filter((u) => /^turns?:/i.test(u));
    if (turnUrls.length > 0) {
      const servers: RTCIceServer[] = [
        ...DEFAULT_STUN_ICE_SERVERS,
        {
          urls: turnUrls.length === 1 ? turnUrls[0] : turnUrls,
          ...(envTurnUser ? { username: envTurnUser } : {}),
          ...(envTurnCred ? { credential: envTurnCred } : {}),
        },
      ];
      return {
        iceServers: servers,
        turnConfigured: true,
        source: 'env',
        providerLabel: 'Variables VITE_TURN_* (Build)',
      };
    }
  }

  // 4. Repli STUN Google + Cloudflare uniquement
  return {
    iceServers: DEFAULT_STUN_ICE_SERVERS,
    turnConfigured: false,
    source: 'stun_only',
    providerLabel: 'STUN public (Google / Cloudflare — sans relais TURN)',
  };
}

export async function testTurnRelayConnectivity(
  iceServers: RTCIceServer[],
  timeoutMs = 6000
): Promise<{
  ok: boolean;
  relayFound: boolean;
  srflxFound: boolean;
  candidateTypes: string[];
  message: string;
}> {
  if (typeof window === 'undefined' || typeof RTCPeerConnection === 'undefined') {
    return {
      ok: false,
      relayFound: false,
      srflxFound: false,
      candidateTypes: [],
      message: 'WebRTC (RTCPeerConnection) non disponible dans cet environnement.',
    };
  }

  const hasTurn = hasTurnServerInList(iceServers);
  const gatheredTypes = new Set<string>();
  let relayFound = false;
  let srflxFound = false;

  return new Promise((resolve) => {
    let settled = false;
    let pc: RTCPeerConnection | null = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        if (pc) {
          pc.onicecandidate = null;
          pc.onicegatheringstatechange = null;
          pc.close();
        }
      } catch {
        // Ignore close error
      }
      const types = Array.from(gatheredTypes);
      if (relayFound) {
        resolve({
          ok: true,
          relayFound: true,
          srflxFound,
          candidateTypes: types,
          message: `Relais TURN opérationnel (candidat typ relay obtenu — traversée NAT 4G/5G Maroc validée). Types collectés : ${types.join(', ')}.`,
        });
      } else if (!hasTurn) {
        resolve({
          ok: false,
          relayFound: false,
          srflxFound,
          candidateTypes: types,
          message:
            'Aucun serveur turn: ou turns: configuré dans la liste ICE. Ajoutez une URL TURN valide avec identifiants.',
        });
      } else {
        resolve({
          ok: false,
          relayFound: false,
          srflxFound,
          candidateTypes: types,
          message: `Aucun candidat relais TURN (typ relay) obtenu après ${Math.round(timeoutMs / 1000)}s (types collectés : ${types.join(', ') || 'aucun'}). Vérifiez l'URL turn:/turns:, le port (80/443/3478) et les identifiants TURN.`,
        });
      }
    };

    const timer = window.setTimeout(finish, timeoutMs);

    try {
      pc = new RTCPeerConnection({
        iceServers: ensureDefaultStunIncluded(iceServers),
        iceCandidatePoolSize: 2,
      });
      pc.createDataChannel('turn-connectivity-probe');

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) {
          window.clearTimeout(timer);
          finish();
          return;
        }
        const cType = extractIceCandidateType(ev.candidate.candidate);
        if (cType !== 'unknown') {
          gatheredTypes.add(cType);
        }
        if (cType === 'relay') {
          relayFound = true;
          window.clearTimeout(timer);
          finish();
        } else if (cType === 'srflx') {
          srflxFound = true;
        }
      };

      pc.onicegatheringstatechange = () => {
        if (pc?.iceGatheringState === 'complete') {
          window.clearTimeout(timer);
          finish();
        }
      };

      pc.createOffer()
        .then((offer) => pc?.setLocalDescription(offer))
        .catch(() => {
          window.clearTimeout(timer);
          finish();
        });
    } catch (err) {
      window.clearTimeout(timer);
      settled = true;
      resolve({
        ok: false,
        relayFound: false,
        srflxFound: false,
        candidateTypes: [],
        message: `Erreur d'initialisation RTCPeerConnection : ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });
}
