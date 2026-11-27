import React, { useEffect, useRef, useState } from 'react';
import {
  MessageCircle,
  Send,
  X,
  Mic,
  MicOff,
  Volume2,
} from 'lucide-react';
import { onSnapshot } from 'firebase/firestore';
import {
  addCoachingIceCandidate,
  auth,
  clearCoachingCandidates,
  getCoachingCandidatesQuery,
  getCoachingSessionDocRef,
  getDirectChatChannelDocRef,
  getDirectChatMessagesQuery,
  markDirectChatRead,
  sendDirectChatMessage,
  setCollaboratorCoachingState,
  touchCollaboratorCoachingKeepalive,
} from '../firebase';
import type {
  SanitizedCoachingSessionDoc,
  SanitizedDirectChatMessageDoc,
} from '../utils/firestoreSanitize';
import { formatDateTimeShort } from '../utils/attendance';
import { canUseWhisperCoaching, isSupervisorRole } from '../utils/authAccess';
import { resolveRtcIceConfiguration } from '../utils/rtcIceConfig';

export const COACHING_OPT_IN_STORAGE_PREFIX = 'op_coaching_optin_';

export function getCoachingOptInStorageKey(uid: string): string {
  const cleanUid = String(uid || '').trim();
  return cleanUid ? `${COACHING_OPT_IN_STORAGE_PREFIX}${cleanUid}` : '';
}

export function readCoachingOptInPreference(uid: string): boolean {
  const key = getCoachingOptInStorageKey(uid);
  if (!key || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function writeCoachingOptInPreference(uid: string, optedIn: boolean): void {
  const key = getCoachingOptInStorageKey(uid);
  if (!key || typeof window === 'undefined') return;
  try {
    if (optedIn) {
      window.localStorage.setItem(key, '1');
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage quota or private mode restrictions
  }
}

export const CollaboratorCoachingStatusBadge: React.FC<{
  coachingActive: boolean;
  awaitingGestureResume: boolean;
  coachingBusy: boolean;
  onResume: () => void;
  onStop: () => void;
}> = ({ coachingActive, awaitingGestureResume, coachingBusy, onResume, onStop }) => {
  if (coachingActive) {
    return (
      <div
        data-testid="coaching-active-status-pill"
        className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-200 bg-white/95 px-2.5 py-2 text-[11px] font-bold text-emerald-900 shadow-lg backdrop-blur-xs"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <span className="whitespace-nowrap">Audio actif</span>
        <button
          type="button"
          data-testid="coaching-quick-stop-btn"
          onClick={onStop}
          title="Couper et révoquer le micro coaching"
          aria-label="Couper le micro"
          className="ml-0.5 inline-flex items-center gap-1 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-0.5 text-[10px] font-extrabold text-red-700 transition-colors"
        >
          <MicOff className="w-3 h-3" />
          Couper
        </button>
      </div>
    );
  }

  if (awaitingGestureResume) {
    return (
      <div
        data-testid="coaching-resume-status-pill"
        className="inline-flex items-center gap-1 rounded-2xl border border-amber-200 bg-white/95 px-2.5 py-1.5 text-[11px] font-bold text-amber-900 shadow-lg backdrop-blur-xs"
      >
        <button
          type="button"
          data-testid="coaching-resume-audio-btn"
          disabled={coachingBusy}
          onClick={onResume}
          className="inline-flex items-center gap-1 rounded-lg bg-amber-100 hover:bg-amber-200 disabled:opacity-50 px-2 py-0.5 text-[10px] font-extrabold text-amber-950 transition-colors"
        >
          <Mic className="w-3 h-3 text-amber-800" />
          {coachingBusy ? 'Reprise...' : 'Reprendre audio'}
        </button>
        <button
          type="button"
          data-testid="coaching-revoke-optin-btn"
          onClick={onStop}
          title="Désactiver la reprise automatique du micro"
          aria-label="Désactiver la reprise automatique du micro"
          className="p-1 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return null;
};

export const SupervisorCoachingPttPill: React.FC<{
  currentUserRole?: string;
  coachingActive: boolean;
  adminPttActive: boolean;
}> = ({ coachingActive, adminPttActive }) => {
  if (!coachingActive || !adminPttActive) {
    return null;
  }
  return (
    <div
      data-testid="coaching-ptt-live-pill"
      className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[55] inline-flex items-center gap-1.5 rounded-full bg-orange-600 px-3 py-1 text-[11px] font-bold text-white shadow-lg animate-pulse"
    >
      <Volume2 className="w-3.5 h-3.5" />
      Direction en ligne (audio)
    </div>
  );
};

export const SupervisorCoachingHeaderStopButton: React.FC<{
  currentUserRole: string;
  coachingActive: boolean;
  onStop: () => void;
}> = ({ coachingActive, onStop }) => {
  if (!coachingActive) {
    return null;
  }
  return (
    <button
      type="button"
      onClick={onStop}
      aria-label="Couper le micro"
      title="Couper le micro"
      className="p-1.5 rounded-lg text-emerald-400 hover:text-red-300 hover:bg-stone-800"
    >
      <MicOff className="w-3.5 h-3.5" />
    </button>
  );
};

export const SupervisorAudioControlsContainer: React.FC<{
  currentUserRole: string;
  hasCoachingInvite?: boolean;
  hasStaleSession?: boolean;
  allowManualOptIn?: boolean;
  isListeningOrActive: boolean;
  coachingBusy: boolean;
  coachingError: string;
  onStart: () => void;
  onStopStale?: () => void;
}> = ({
  currentUserRole,
  hasCoachingInvite = false,
  hasStaleSession = false,
  allowManualOptIn = false,
  isListeningOrActive,
  coachingBusy,
  coachingError,
  onStart,
  onStopStale,
}) => {
  const isSupervisor =
    isSupervisorRole(currentUserRole) && canUseWhisperCoaching(currentUserRole);
  if (!isSupervisor && !hasCoachingInvite && !hasStaleSession && !allowManualOptIn) {
    return null;
  }
  if (isListeningOrActive) {
    return null;
  }
  return (
    <>
      <div
        data-testid="supervisor-audio-controls-container"
        className="px-3.5 py-2 border-b border-stone-200 bg-stone-50 flex flex-wrap items-center justify-between gap-2"
      >
        <div className="text-[11px] font-semibold text-stone-700 flex items-center gap-1.5">
          <Mic className="w-3.5 h-3.5 text-orange-600" />
          <span>
            {hasStaleSession
              ? 'Session audio interrompue'
              : isSupervisor
                ? 'Audio Direction'
                : hasCoachingInvite
                  ? 'Invitation Audio Direction'
                  : 'Coaching Terrain (Opt-in)'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {hasStaleSession && onStopStale && (
            <button
              type="button"
              disabled={coachingBusy}
              onClick={onStopStale}
              data-testid="close-stale-coaching-session-btn"
              className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 disabled:opacity-50 px-2 py-1 text-[10px] font-bold text-stone-700"
            >
              Clôturer la session précédente
            </button>
          )}
          <button
            type="button"
            disabled={coachingBusy}
            onClick={onStart}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-2.5 py-1 text-[10px] font-bold text-white"
          >
            <Mic className="w-3 h-3" />
            {coachingBusy
              ? 'Activation...'
              : hasStaleSession
                ? 'Réactiver le micro'
                : 'Autoriser micro'}
          </button>
        </div>
      </div>
      {coachingError && (
        <div className="px-3.5 py-1.5 bg-red-50 border-b border-red-200 text-[10px] font-semibold text-red-700">
          {coachingError}
        </div>
      )}
    </>
  );
};

interface CollaboratorChatWidgetProps {
  currentUserUid: string;
  currentUserName: string;
  currentUserEmail: string;
  currentUserRole: string;
  currentUserZone: string;
  superAdminUid?: string;
  hasCoachingInvite?: boolean;
  forceOpenSignal?: number;
  initialOpen?: boolean;
  onNotify: (msg: string, type?: 'ok' | 'warn' | 'err') => void;
}

export const CollaboratorChatWidget: React.FC<CollaboratorChatWidgetProps> = ({
  currentUserUid,
  currentUserName,
  currentUserEmail,
  currentUserRole,
  currentUserZone,
  superAdminUid,
  hasCoachingInvite = false,
  forceOpenSignal = 0,
  initialOpen = false,
  onNotify,
}) => {
  const [open, setOpen] = useState(initialOpen);
  const [manualCoachingOptInOpen, setManualCoachingOptInOpen] = useState(false);
  const canShowAudioSupervisionUi =
    isSupervisorRole(currentUserRole) && canUseWhisperCoaching(currentUserRole);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messages, setMessages] = useState<SanitizedDirectChatMessageDoc[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Audio Terrain P2P WebRTC (sans API externe)
  const [coachingActive, setCoachingActive] = useState(false);
  const [coachingBusy, setCoachingBusy] = useState(false);
  const [coachingDoc, setCoachingDoc] = useState<SanitizedCoachingSessionDoc | null>(null);
  const [coachingError, setCoachingError] = useState('');
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);
  const [hasPersistedOptIn, setHasPersistedOptIn] = useState<boolean>(() =>
    readCoachingOptInPreference(currentUserUid)
  );
  const [awaitingGestureResume, setAwaitingGestureResume] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const candidatesUnsubRef = useRef<(() => void) | null>(null);
  const seenCandidateIdsRef = useRef<Set<string>>(new Set());
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const appliedAnswerRef = useRef<string>('');
  const coachingActiveRef = useRef<boolean>(false);
  const coachingBusyRef = useRef<boolean>(false);
  const rebuildingOfferRef = useRef<boolean>(false);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const keepaliveCtxRef = useRef<AudioContext | null>(null);
  const keepaliveAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentUserUidRef = useRef<string>(currentUserUid);
  const currentUserNameRef = useRef<string>(currentUserName);
  const revokedByUserRef = useRef<boolean>(false);
  const autoResumeAttemptedRef = useRef<boolean>(false);
  const clearGestureListenersRef = useRef<(() => void) | null>(null);
  const clearPlaybackUnlockRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    coachingActiveRef.current = coachingActive;
  }, [coachingActive]);

  useEffect(() => {
    currentUserUidRef.current = currentUserUid;
    currentUserNameRef.current = currentUserName;
  }, [currentUserUid, currentUserName]);

  useEffect(() => {
    revokedByUserRef.current = false;
    autoResumeAttemptedRef.current = false;
    setAwaitingGestureResume(false);
    setHasPersistedOptIn(readCoachingOptInPreference(currentUserUid));
  }, [currentUserUid]);

  const clearGestureListeners = () => {
    if (clearGestureListenersRef.current) {
      clearGestureListenersRef.current();
      clearGestureListenersRef.current = null;
    }
  };

  const clearPlaybackUnlockListeners = () => {
    if (clearPlaybackUnlockRef.current) {
      clearPlaybackUnlockRef.current();
      clearPlaybackUnlockRef.current = null;
    }
  };

  const unlockRemoteAudioPlayback = () => {
    if (keepaliveCtxRef.current?.state === 'suspended') {
      void keepaliveCtxRef.current.resume().catch(() => {});
    }
    if (keepaliveAudioRef.current && keepaliveAudioRef.current.srcObject) {
      void keepaliveAudioRef.current.play().catch(() => {});
    }
    if (remoteAudioRef.current) {
      if (remoteAudioRef.current.srcObject) {
        void remoteAudioRef.current
          .play()
          .then(() => setAudioPlaybackBlocked(false))
          .catch(() => {});
      } else {
        // Warm up audio element under user gesture so future Push-to-Talk streams play cleanly
        remoteAudioRef.current.muted = true;
        void remoteAudioRef.current
          .play()
          .catch(() => {})
          .finally(() => {
            if (remoteAudioRef.current) {
              remoteAudioRef.current.pause();
              remoteAudioRef.current.muted = false;
            }
          });
      }
    }
  };

  const armPlaybackUnlockOnFirstGesture = () => {
    if (typeof window === 'undefined' || clearPlaybackUnlockRef.current) return;
    const onGesture = () => {
      clearPlaybackUnlockListeners();
      unlockRemoteAudioPlayback();
    };
    window.addEventListener('pointerdown', onGesture, { once: true, capture: true });
    window.addEventListener('touchstart', onGesture, { once: true, capture: true });
    window.addEventListener('keydown', onGesture, { once: true, capture: true });
    clearPlaybackUnlockRef.current = () => {
      window.removeEventListener('pointerdown', onGesture, { capture: true });
      window.removeEventListener('touchstart', onGesture, { capture: true });
      window.removeEventListener('keydown', onGesture, { capture: true });
    };
  };

  // Headless programmatic Audio elements so incoming earpiece audio works silently in background
  // in all modes without rendering any audio container, player, or supervision DOM element.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
    const remote = new Audio();
    remote.autoplay = true;
    remote.setAttribute('playsinline', 'true');
    remoteAudioRef.current = remote;

    const keepalive = new Audio();
    keepalive.autoplay = true;
    keepalive.loop = true;
    keepalive.setAttribute('playsinline', 'true');
    keepaliveAudioRef.current = keepalive;

    return () => {
      remote.srcObject = null;
      remote.pause();
      remoteAudioRef.current = null;
      keepalive.srcObject = null;
      keepalive.pause();
      keepaliveAudioRef.current = null;
    };
  }, []);

  // Background audio & Wake Lock helpers (keeps authorized mic stream alive across app switches / screen dim on Android, iOS & PC)
  const startBackgroundContinuity = async () => {
    // 1. Screen Wake Lock (prevents mobile sleep from freezing WebRTC)
    try {
      const navWithWake = navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
      };
      if (navWithWake.wakeLock?.request && !wakeLockRef.current) {
        wakeLockRef.current = await navWithWake.wakeLock.request('screen');
      }
    } catch {
      // Wake Lock optional on unsupported browsers
    }

    // 2. Ultra-quiet WebAudio keepalive + MediaSession (keeps iOS Safari & Android Chrome audio session active in background)
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx && !keepaliveCtxRef.current) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const dest = ctx.createMediaStreamDestination();
        osc.frequency.value = 180;
        gain.gain.value = 0.00001; // inaudible keepalive carrier
        osc.connect(gain);
        gain.connect(dest);
        osc.start();
        keepaliveCtxRef.current = ctx;

        if (keepaliveAudioRef.current) {
          keepaliveAudioRef.current.srcObject = dest.stream;
          keepaliveAudioRef.current.volume = 0.01;
          void keepaliveAudioRef.current.play().catch(() => {});
        }
      } else if (keepaliveCtxRef.current?.state === 'suspended') {
        void keepaliveCtxRef.current.resume().catch(() => {});
      }
    } catch {
      // Non-fatal
    }

    try {
      if ('mediaSession' in navigator && navigator.mediaSession) {
        if (typeof MediaMetadata !== 'undefined') {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: 'CRM DIVERSIFIA · Audio Pro',
            artist: 'Orange Pro B2B',
            album: 'Session active',
          });
        }
        navigator.mediaSession.playbackState = 'playing';
      }
    } catch {
      // Non-fatal
    }
  };

  const stopBackgroundContinuity = () => {
    if (wakeLockRef.current) {
      void wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
    if (keepaliveCtxRef.current) {
      void keepaliveCtxRef.current.close().catch(() => {});
      keepaliveCtxRef.current = null;
    }
    if (keepaliveAudioRef.current) {
      keepaliveAudioRef.current.srcObject = null;
    }
    try {
      if ('mediaSession' in navigator && navigator.mediaSession) {
        navigator.mediaSession.playbackState = 'none';
      }
    } catch {
      // Non-fatal
    }
  };

  // Rebuilds a fresh WebRTC offer using the ALREADY-AUTHORIZED mic stream (so Super-Admin can silently listen/disconnect/reconnect multiple times without interrupting the collaborator)
  const publishFreshOfferFromAuthorizedMic = async () => {
    const stream = localStreamRef.current;
    const uid = currentUserUidRef.current;
    const displayName = currentUserNameRef.current;
    if (!uid || !stream || !coachingActiveRef.current || rebuildingOfferRef.current) return;
    const liveTrack = stream.getAudioTracks().find((t) => t.readyState === 'live');
    if (!liveTrack) {
      void stopCollaboratorCoaching(true);
      return;
    }

    rebuildingOfferRef.current = true;
    try {
      if (candidatesUnsubRef.current) {
        candidatesUnsubRef.current();
        candidatesUnsubRef.current = null;
      }
      if (pcRef.current) {
        try {
          pcRef.current.close();
        } catch {
          // ignore
        }
        pcRef.current = null;
      }
      seenCandidateIdsRef.current.clear();
      pendingIceCandidatesRef.current = [];
      appliedAnswerRef.current = '';

      await clearCoachingCandidates(uid).catch(() => {});

      const { iceServers } = await resolveRtcIceConfiguration();
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
          void remoteAudioRef.current
            .play()
            .then(() => setAudioPlaybackBlocked(false))
            .catch(() => {
              setAudioPlaybackBlocked(true);
              armPlaybackUnlockOnFirstGesture();
            });
        }
      };

      // Buffer local ICE candidates until setCollaboratorCoachingState finishes so no candidate is lost or rejected before the parent doc exists
      let sessionReadyForCandidates = false;
      const localCandidatesBuffer: string[] = [];

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidateJson = JSON.stringify(event.candidate.toJSON());
          if (!sessionReadyForCandidates) {
            localCandidatesBuffer.push(candidateJson);
          } else {
            void addCoachingIceCandidate(uid, {
              senderUid: uid,
              fromRole: 'collab',
              candidateJson,
            });
          }
        }
      };

      pc.oniceconnectionstatechange = () => {
        const st = pc.iceConnectionState;
        if ((st === 'failed' || st === 'disconnected') && coachingActiveRef.current) {
          window.setTimeout(() => {
            if (
              coachingActiveRef.current &&
              pcRef.current === pc &&
              (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected')
            ) {
              void publishFreshOfferFromAuthorizedMic();
            }
          }, 2500);
        }
      };

      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);

      await setCollaboratorCoachingState(uid, {
        collabName: displayName,
        status: 'collab_ready',
        collabConsentActive: true,
        offerSdp: JSON.stringify(offer),
        answerSdp: '',
        adminPttActive: false,
      });

      sessionReadyForCandidates = true;
      for (const candidateJson of localCandidatesBuffer.splice(0)) {
        void addCoachingIceCandidate(uid, {
          senderUid: uid,
          fromRole: 'collab',
          candidateJson,
        });
      }

      candidatesUnsubRef.current = onSnapshot(
        getCoachingCandidatesQuery(uid),
        (snap) => {
          snap.forEach((docSnap) => {
            if (seenCandidateIdsRef.current.has(docSnap.id)) return;
            const d = docSnap.data();
            if (d.fromRole !== 'admin' || typeof d.candidateJson !== 'string') return;
            seenCandidateIdsRef.current.add(docSnap.id);
            try {
              const cand = JSON.parse(d.candidateJson) as RTCIceCandidateInit;
              if (pc.remoteDescription && pc.remoteDescription.type) {
                void pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
              } else {
                pendingIceCandidatesRef.current.push(cand);
              }
            } catch {
              // ignore
            }
          });
        },
        () => {}
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Erreur lors de la publication du signal audio WebRTC.';
      setCoachingError(msg);
    } finally {
      rebuildingOfferRef.current = false;
    }
  };

  useEffect(() => {
    if (forceOpenSignal > 0) {
      setOpen(true);
    }
  }, [forceOpenSignal]);

  // Re-acquire Wake Lock & AudioContext on visibilitychange / online so background audio stays rock-solid
  useEffect(() => {
    if (!coachingActive) return;
    const handleVisibilityOrOnline = () => {
      if (!coachingActiveRef.current) return;
      if (document.visibilityState === 'visible') {
        void startBackgroundContinuity();
      }
      if (
        navigator.onLine !== false &&
        pcRef.current &&
        (pcRef.current.iceConnectionState === 'failed' ||
          pcRef.current.iceConnectionState === 'disconnected')
      ) {
        void publishFreshOfferFromAuthorizedMic();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrOnline);
    window.addEventListener('online', handleVisibilityOrOnline);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrOnline);
      window.removeEventListener('online', handleVisibilityOrOnline);
    };
  }, [coachingActive]);

  // Listen to unread badge count on own direct chat channel
  useEffect(() => {
    if (!currentUserUid) return;
    const unsub = onSnapshot(
      getDirectChatChannelDocRef(currentUserUid),
      (snap) => {
        if (!snap.exists()) {
          setUnreadCount(0);
          return;
        }
        const d = snap.data();
        setUnreadCount(Math.max(0, Math.round(Number(d.unreadByCollab) || 0)));
      },
      () => {
        setUnreadCount(0);
      }
    );
    return () => unsub();
  }, [currentUserUid]);

  // Listen to own chat messages when drawer is open
  useEffect(() => {
    if (!open || !currentUserUid) return;
    const unsub = onSnapshot(
      getDirectChatMessagesQuery(currentUserUid),
      (snap) => {
        const list: SanitizedDirectChatMessageDoc[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: docSnap.id,
            collabUid: currentUserUid,
            orgScope: 'orange_pro_team',
            senderUid: String(d.senderUid || ''),
            senderName: String(d.senderName || 'Direction'),
            senderRole: typeof d.senderRole === 'string' ? d.senderRole : undefined,
            text: String(d.text || ''),
            createdAtIso: typeof d.createdAtIso === 'string' ? d.createdAtIso : '',
          });
        });
        list.sort((a, b) => (a.createdAtIso || '').localeCompare(b.createdAtIso || ''));
        setMessages(list);
      },
      () => {}
    );
    void markDirectChatRead(currentUserUid, 'collab');
    return () => unsub();
  }, [open, currentUserUid]);

  useEffect(() => {
    if (!open || !currentUserUid) return;
    void markDirectChatRead(currentUserUid, 'collab');
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [open, currentUserUid, messages.length]);

  // Subscribe to own coaching session doc to detect Super-Admin answer SDP, reconnects & PTT indicator
  useEffect(() => {
    if (!currentUserUid) return;
    const unsub = onSnapshot(
      getCoachingSessionDocRef(currentUserUid),
      (snap) => {
        if (!snap.exists()) {
          setCoachingDoc(null);
          return;
        }
        const d = snap.data();
        const serverUpdatedAtIso =
          typeof d.updatedAt?.toDate === 'function' ? d.updatedAt.toDate().toISOString() : '';
        const nextDoc: SanitizedCoachingSessionDoc = {
          collabUid: snap.id,
          orgScope: 'orange_pro_team',
          collabName: String(d.collabName || currentUserName),
          status: (d.status || 'idle') as SanitizedCoachingSessionDoc['status'],
          collabConsentActive: Boolean(d.collabConsentActive),
          adminUid: typeof d.adminUid === 'string' ? d.adminUid : undefined,
          adminName: typeof d.adminName === 'string' ? d.adminName : undefined,
          adminPttActive: Boolean(d.adminPttActive),
          offerSdp: typeof d.offerSdp === 'string' ? d.offerSdp : '',
          answerSdp: typeof d.answerSdp === 'string' ? d.answerSdp : '',
          updatedAtIso:
            serverUpdatedAtIso || (typeof d.updatedAtIso === 'string' ? d.updatedAtIso : ''),
        };
        setCoachingDoc(nextDoc);

        // Apply Super-Admin WebRTC Answer SDP when received
        if (
          pcRef.current &&
          nextDoc.answerSdp &&
          nextDoc.answerSdp !== appliedAnswerRef.current &&
          pcRef.current.signalingState === 'have-local-offer'
        ) {
          appliedAnswerRef.current = nextDoc.answerSdp;
          const pcInstance = pcRef.current;
          try {
            const answerDesc = JSON.parse(nextDoc.answerSdp) as RTCSessionDescriptionInit;
            void pcInstance
              .setRemoteDescription(new RTCSessionDescription(answerDesc))
              .then(() => {
                const queued = pendingIceCandidatesRef.current.splice(0);
                queued.forEach((cand) => {
                  void pcInstance.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
                });
              })
              .catch(() => {});
          } catch {
            // ignore
          }
        } else if (
          coachingActiveRef.current &&
          appliedAnswerRef.current &&
          !nextDoc.answerSdp &&
          nextDoc.status === 'collab_ready' &&
          nextDoc.collabConsentActive
        ) {
          // Super-Admin ended a listen session while collaborator still keeps mic authorized:
          // silently prepare a fresh offer so Super-Admin can re-enter listen mode anytime!
          void publishFreshOfferFromAuthorizedMic();
        }
      },
      () => {}
    );
    return () => unsub();
  }, [currentUserUid, currentUserName]);

  const stopCollaboratorCoaching = async (
    updateCloud = true,
    options?: {
      revokeOptIn?: boolean;
      forceCloudReset?: boolean;
      preserveError?: boolean;
    }
  ) => {
    const targetUid = currentUserUidRef.current || currentUserUid;
    const targetName = currentUserNameRef.current || currentUserName;
    const wasCoachingActive = coachingActiveRef.current;
    const revokeOptIn = Boolean(options?.revokeOptIn);
    const forceCloudReset = Boolean(options?.forceCloudReset);

    coachingActiveRef.current = false;
    stopBackgroundContinuity();
    clearPlaybackUnlockListeners();

    if (revokeOptIn) {
      revokedByUserRef.current = true;
      clearGestureListeners();
      setAwaitingGestureResume(false);
      if (targetUid) {
        writeCoachingOptInPreference(targetUid, false);
      }
      setHasPersistedOptIn(false);
    }

    if (candidatesUnsubRef.current) {
      candidatesUnsubRef.current();
      candidatesUnsubRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {
        // ignore
      }
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    seenCandidateIdsRef.current.clear();
    pendingIceCandidatesRef.current = [];
    appliedAnswerRef.current = '';
    setCoachingActive(false);
    setAudioPlaybackBlocked(false);
    if (!options?.preserveError) {
      setCoachingError('');
    }

    if (
      updateCloud &&
      (wasCoachingActive || forceCloudReset) &&
      targetUid &&
      auth.currentUser?.uid === targetUid
    ) {
      try {
        await setCollaboratorCoachingState(targetUid, {
          collabName: targetName,
          status: 'ended',
          collabConsentActive: false,
          offerSdp: '',
          answerSdp: '',
          adminPttActive: false,
        });
      } catch {
        // non-fatal
      }
    }
  };

  const armGestureResume = () => {
    if (typeof window === 'undefined' || revokedByUserRef.current) return;
    setAwaitingGestureResume(true);
    if (clearGestureListenersRef.current) return;
    const onFirstGesture = () => {
      clearGestureListeners();
      if (revokedByUserRef.current || coachingActiveRef.current || coachingBusyRef.current) {
        return;
      }
      unlockRemoteAudioPlayback();
      void startCollaboratorCoaching({ autoResume: false });
    };
    window.addEventListener('pointerdown', onFirstGesture, { once: true, capture: true });
    window.addEventListener('touchstart', onFirstGesture, { once: true, capture: true });
    window.addEventListener('keydown', onFirstGesture, { once: true, capture: true });
    clearGestureListenersRef.current = () => {
      window.removeEventListener('pointerdown', onFirstGesture, { capture: true });
      window.removeEventListener('touchstart', onFirstGesture, { capture: true });
      window.removeEventListener('keydown', onFirstGesture, { capture: true });
    };
  };

  const startCollaboratorCoaching = async (options?: { autoResume?: boolean }) => {
    const autoResume = Boolean(options?.autoResume);
    const uid = currentUserUidRef.current || currentUserUid;
    if (!uid || coachingBusyRef.current) return;
    if (typeof RTCPeerConnection === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      if (!autoResume) {
        setCoachingError('Audio WebRTC non supporté par ce navigateur.');
      }
      return;
    }

    coachingBusyRef.current = true;
    setCoachingBusy(true);
    revokedByUserRef.current = false;
    clearGestureListeners();
    setAwaitingGestureResume(false);
    setCoachingError('');

    try {
      await stopCollaboratorCoaching(false);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;

      // Mémoriser durablement le consentement explicite du collaborateur dans localStorage
      writeCoachingOptInPreference(uid, true);
      setHasPersistedOptIn(true);

      // Handle OS/browser revoking mic track cleanly (ne révoque pas le consentement mémorisé)
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (coachingActiveRef.current) {
            void stopCollaboratorCoaching(true);
          }
        };
      });

      coachingActiveRef.current = true;
      setCoachingActive(true);
      await startBackgroundContinuity();
      await publishFreshOfferFromAuthorizedMic();

      if (autoResume) {
        // Assure le déverrouillage audio haut-parleur Push-to-Talk dès le 1er geste sur iOS/Safari/Chrome
        armPlaybackUnlockOnFirstGesture();
      } else {
        unlockRemoteAudioPlayback();
        if (canShowAudioSupervisionUi) {
          onNotify('Audio Direction activé.');
        }
      }
    } catch (err) {
      let permissionDenied = false;
      try {
        if (navigator.permissions?.query) {
          const perm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          if (perm.state === 'denied') {
            permissionDenied = true;
          }
        }
      } catch {
        // Safari/Firefox without microphone permission descriptor
      }

      if (autoResume) {
        if (permissionDenied) {
          setCoachingError(
            'Micro bloqué dans les réglages du navigateur. Autorisez l’accès au microphone pour reprendre le coaching audio.'
          );
          setAwaitingGestureResume(false);
          await stopCollaboratorCoaching(false, { preserveError: true });
        } else {
          // Cas iOS Safari / politique autoplay stricte : armer une reprise transparente au 1er geste
          await stopCollaboratorCoaching(false);
          armGestureResume();
        }
      } else {
        const msg = permissionDenied
          ? 'Micro bloqué dans les réglages du navigateur. Autorisez l’accès au microphone pour continuer.'
          : err instanceof Error
            ? err.message
            : 'Autorisation microphone refusée ou indisponible.';
        setCoachingError(msg);
        await stopCollaboratorCoaching(false, { preserveError: true });
      }
    } finally {
      coachingBusyRef.current = false;
      setCoachingBusy(false);
    }
  };

  // Reconnexion automatique transparente au chargement si le collaborateur a déjà donné son consentement
  useEffect(() => {
    if (!currentUserUid) return;
    if (coachingActiveRef.current || coachingBusyRef.current || revokedByUserRef.current) return;
    if (autoResumeAttemptedRef.current) return;

    const optedIn = hasPersistedOptIn || Boolean(coachingDoc?.collabConsentActive);
    if (!optedIn) return;

    autoResumeAttemptedRef.current = true;
    let cancelled = false;

    const tryAutoResume = async () => {
      let permState: PermissionState | 'unsupported' = 'unsupported';
      try {
        if (navigator.permissions?.query) {
          const status = await navigator.permissions.query({
            name: 'microphone' as PermissionName,
          });
          permState = status.state;
        }
      } catch {
        permState = 'unsupported';
      }

      if (cancelled || revokedByUserRef.current || coachingActiveRef.current) return;

      if (permState === 'denied') {
        setAwaitingGestureResume(false);
        setCoachingError(
          'Micro bloqué dans les réglages du navigateur. Autorisez l’accès au microphone pour reprendre le coaching audio.'
        );
        return;
      }

      if (permState === 'granted' || permState === 'unsupported') {
        await startCollaboratorCoaching({ autoResume: true });
        return;
      }

      // permState === 'prompt' : armer le geste unique pour reprendre sans erreur bloquante
      armGestureResume();
    };

    void tryAutoResume();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserUid, hasPersistedOptIn, coachingDoc?.collabConsentActive]);

  useEffect(() => {
    if (!coachingActive || !currentUserUid) return;
    const keepaliveId = window.setInterval(() => {
      if (coachingActiveRef.current && auth.currentUser?.uid === currentUserUid) {
        void touchCollaboratorCoachingKeepalive(currentUserUid);
      }
    }, 5 * 60 * 1000);
    return () => {
      window.clearInterval(keepaliveId);
    };
  }, [coachingActive, currentUserUid]);

  // Nettoyage propre sur fermeture d'onglet / rechargement (F5) / démontage sans JAMAIS révoquer op_coaching_optin_${uid}
  useEffect(() => {
    const handlePageHide = (ev: PageTransitionEvent) => {
      if (ev.persisted) return;
      const uid = currentUserUidRef.current;
      if (coachingActiveRef.current && uid && auth.currentUser?.uid === uid) {
        void stopCollaboratorCoaching(true);
      }
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      clearGestureListeners();
      clearPlaybackUnlockListeners();
      const uid = currentUserUidRef.current;
      const shouldUpdateCloud = Boolean(
        coachingActiveRef.current && uid && auth.currentUser?.uid === uid
      );
      void stopCollaboratorCoaching(shouldUpdateCloud);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || sending) return;
    setSending(true);
    try {
      await sendDirectChatMessage({
        collabUid: currentUserUid,
        collabName: currentUserName,
        collabEmail: currentUserEmail,
        collabZone: currentUserZone,
        senderUid: currentUserUid,
        senderName: currentUserName,
        senderRole: currentUserRole,
        isSenderSuperAdmin: false,
        text: chatInput.trim(),
        recipientUidForNotification: superAdminUid,
      });
      setChatInput('');
    } catch {
      onNotify('Impossible d’envoyer le message à la Direction.', 'err');
    } finally {
      setSending(false);
    }
  };

  const isListeningOrActive = coachingActive;
  const hasStaleSession =
    !coachingActive &&
    Boolean(coachingDoc?.collabConsentActive || coachingDoc?.status === 'live');
  const isSupervisor =
    isSupervisorRole(currentUserRole) && canUseWhisperCoaching(currentUserRole);

  return (
    <>
      {/* Indicateur Push-to-Talk : affiché dès que le collaborateur a autorisé son micro (coachingActive) et que la Direction parle */}
      <SupervisorCoachingPttPill
        currentUserRole={currentUserRole}
        coachingActive={coachingActive}
        adminPttActive={Boolean(coachingDoc?.adminPttActive)}
      />

      {/* Compact Floating Trigger + Indicateur permanent transparence coaching audio */}
      <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2">
        <CollaboratorCoachingStatusBadge
          coachingActive={coachingActive}
          awaitingGestureResume={awaitingGestureResume}
          coachingBusy={coachingBusy}
          onResume={() => void startCollaboratorCoaching({ autoResume: false })}
          onStop={() =>
            void stopCollaboratorCoaching(true, {
              revokeOptIn: true,
              forceCloudReset: true,
            })
          }
        />

        <button
          type="button"
          data-testid="collaborator-chat-widget-btn"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-stone-900 hover:bg-stone-800 px-3.5 py-2.5 text-xs font-bold text-white shadow-lg transition-colors"
        >
          <MessageCircle className="w-4 h-4 text-orange-400" />
          <span className="hidden sm:inline">Discussion Direction</span>
          {unreadCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-orange-600 text-white text-[10px] font-extrabold flex items-center justify-center tabular-nums">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Drawer */}
      {open && (
        <div
          data-testid="collaborator-chat-drawer"
          className="fixed bottom-16 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-stone-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[78vh]"
        >
          <div className="px-4 py-3 bg-stone-900 text-white flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-xs font-extrabold flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-orange-400" />
                Discussion Direction
              </div>
              <div className="text-[10px] text-stone-400">
                Messagerie interne en direct
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!isSupervisor && !coachingActive && !hasCoachingInvite && !hasStaleSession && (
                <button
                  type="button"
                  data-testid="collab-coaching-optin-toggle"
                  onClick={() => setManualCoachingOptInOpen((v) => !v)}
                  title="Coaching Terrain (Opt-in micro)"
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 transition-colors ${
                    manualCoachingOptInOpen
                      ? 'bg-orange-600 text-white'
                      : 'bg-stone-800 text-stone-300 hover:text-white'
                  }`}
                >
                  <Mic className="w-3 h-3" />
                  <span>Coaching</span>
                </button>
              )}
              <SupervisorCoachingHeaderStopButton
                currentUserRole={currentUserRole}
                coachingActive={coachingActive}
                onStop={() =>
                  void stopCollaboratorCoaching(true, {
                    revokeOptIn: true,
                    forceCloudReset: true,
                  })
                }
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer la discussion"
                className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <SupervisorAudioControlsContainer
            currentUserRole={currentUserRole}
            hasCoachingInvite={hasCoachingInvite}
            hasStaleSession={hasStaleSession}
            allowManualOptIn={manualCoachingOptInOpen}
            isListeningOrActive={isListeningOrActive}
            coachingBusy={coachingBusy}
            coachingError={coachingError}
            onStart={() => void startCollaboratorCoaching({ autoResume: false })}
            onStopStale={() =>
              void stopCollaboratorCoaching(true, {
                revokeOptIn: true,
                forceCloudReset: true,
              })
            }
          />

          {audioPlaybackBlocked && (
            <div className="px-3.5 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-amber-900">
                Son du haut-parleur en attente d’activation navigateur
              </span>
              <button
                type="button"
                data-testid="collab-unlock-speaker-btn"
                onClick={() => {
                  if (remoteAudioRef.current) {
                    void remoteAudioRef.current
                      .play()
                      .then(() => setAudioPlaybackBlocked(false))
                      .catch(() => {});
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-bold shrink-0"
              >
                🔊 Activer le haut-parleur
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2 bg-[#FAF8F4] min-h-[220px] max-h-[320px]">
            {messages.length === 0 ? (
              <div className="py-8 text-center text-xs text-stone-500">
                Aucun message pour le moment. Écrivez ici pour contacter le Super-Admin en direct.
              </div>
            ) : (
              messages.map((m) => {
                const isMine = m.senderUid === currentUserUid;
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs ${
                        isMine
                          ? 'bg-orange-600 text-white rounded-br-sm'
                          : 'bg-white border border-stone-200 text-stone-800 rounded-bl-sm'
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words leading-relaxed">{m.text}</div>
                    </div>
                    <span className="mt-0.5 px-1 text-[10px] text-stone-400">
                      {isMine ? 'Vous' : m.senderName} ·{' '}
                      {m.createdAtIso ? formatDateTimeShort(m.createdAtIso) : ''}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => void handleSend(e)}
            className="p-2.5 border-t border-stone-200 bg-white flex items-center gap-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Message à la Direction..."
              maxLength={2000}
              className="flex-1 rounded-xl border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs text-stone-900 focus:outline-none focus:border-orange-500 focus:bg-white"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || sending}
              className="inline-flex items-center justify-center rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 p-2 text-white"
              aria-label="Envoyer le message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
