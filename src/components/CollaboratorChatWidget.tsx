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
  clearCoachingCandidates,
  getCoachingCandidatesQuery,
  getCoachingSessionDocRef,
  getDirectChatChannelDocRef,
  getDirectChatMessagesQuery,
  markDirectChatRead,
  sendDirectChatMessage,
  setCollaboratorCoachingState,
} from '../firebase';
import type {
  SanitizedCoachingSessionDoc,
  SanitizedDirectChatMessageDoc,
} from '../utils/firestoreSanitize';
import { formatDateTimeShort } from '../utils/attendance';
import { canUseWhisperCoaching, isSupervisorRole } from '../utils/authAccess';
import { resolveRtcIceConfiguration } from '../utils/rtcIceConfig';

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

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const candidatesUnsubRef = useRef<(() => void) | null>(null);
  const seenCandidateIdsRef = useRef<Set<string>>(new Set());
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const appliedAnswerRef = useRef<string>('');
  const coachingActiveRef = useRef<boolean>(false);
  const rebuildingOfferRef = useRef<boolean>(false);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const keepaliveCtxRef = useRef<AudioContext | null>(null);
  const keepaliveAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    coachingActiveRef.current = coachingActive;
  }, [coachingActive]);

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
    if (!currentUserUid || !stream || !coachingActiveRef.current || rebuildingOfferRef.current) return;
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

      await clearCoachingCandidates(currentUserUid).catch(() => {});

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
            .catch(() => setAudioPlaybackBlocked(true));
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
            void addCoachingIceCandidate(currentUserUid, {
              senderUid: currentUserUid,
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

      await setCollaboratorCoachingState(currentUserUid, {
        collabName: currentUserName,
        status: 'collab_ready',
        collabConsentActive: true,
        offerSdp: JSON.stringify(offer),
        answerSdp: '',
        adminPttActive: false,
      });

      sessionReadyForCandidates = true;
      for (const candidateJson of localCandidatesBuffer.splice(0)) {
        void addCoachingIceCandidate(currentUserUid, {
          senderUid: currentUserUid,
          fromRole: 'collab',
          candidateJson,
        });
      }

      candidatesUnsubRef.current = onSnapshot(
        getCoachingCandidatesQuery(currentUserUid),
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
          updatedAtIso: typeof d.updatedAtIso === 'string' ? d.updatedAtIso : '',
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

  const stopCollaboratorCoaching = async (updateCloud = true) => {
    coachingActiveRef.current = false;
    stopBackgroundContinuity();
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
    setCoachingError('');

    if (updateCloud && currentUserUid) {
      try {
        await setCollaboratorCoachingState(currentUserUid, {
          collabName: currentUserName,
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

  useEffect(() => {
    const handlePageHide = (ev: PageTransitionEvent) => {
      if (ev.persisted) return;
      if (coachingActiveRef.current) {
        void stopCollaboratorCoaching(true);
      }
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      void stopCollaboratorCoaching(true);
    };
  }, []);

  const startCollaboratorCoaching = async () => {
    if (!currentUserUid || coachingBusy) return;
    if (typeof RTCPeerConnection === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCoachingError('Audio WebRTC non supporté par ce navigateur.');
      return;
    }
    setCoachingBusy(true);
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

      // Handle OS/browser revoking mic track cleanly
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

      if (canShowAudioSupervisionUi) {
        onNotify('Audio Direction activé.');
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Autorisation microphone refusée ou indisponible.';
      setCoachingError(msg);
      await stopCollaboratorCoaching(false);
    } finally {
      setCoachingBusy(false);
    }
  };

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

      {/* Compact Floating Trigger */}
      <button
        type="button"
        data-testid="collaborator-chat-widget-btn"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-stone-900 hover:bg-stone-800 px-3.5 py-2.5 text-xs font-bold text-white shadow-lg transition-colors"
      >
        <MessageCircle className="w-4 h-4 text-orange-400" />
        <span className="hidden sm:inline">Discussion Direction</span>
        {unreadCount > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-orange-600 text-white text-[10px] font-extrabold flex items-center justify-center tabular-nums">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

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
                onStop={() => void stopCollaboratorCoaching(true)}
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
            onStart={() => void startCollaboratorCoaching()}
            onStopStale={() => void stopCollaboratorCoaching(true)}
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
