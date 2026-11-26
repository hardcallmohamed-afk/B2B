import React, { useEffect, useRef, useState } from 'react';
import {
  MessageCircle,
  Send,
  X,
  Headphones,
  Mic,
  MicOff,
  Radio,
  ShieldCheck,
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

const RTC_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

interface CollaboratorChatWidgetProps {
  currentUserUid: string;
  currentUserName: string;
  currentUserEmail: string;
  currentUserRole: string;
  currentUserZone: string;
  superAdminUid?: string;
  forceOpenSignal?: number;
  onNotify: (msg: string, type?: 'ok' | 'warn' | 'err') => void;
}

export const CollaboratorChatWidget: React.FC<CollaboratorChatWidgetProps> = ({
  currentUserUid,
  currentUserName,
  currentUserEmail,
  currentUserRole,
  currentUserZone,
  superAdminUid,
  forceOpenSignal = 0,
  onNotify,
}) => {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messages, setMessages] = useState<SanitizedDirectChatMessageDoc[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Transparent opt-in Coaching Terrain (WebRTC P2P, zero API)
  const [coachingActive, setCoachingActive] = useState(false);
  const [coachingBusy, setCoachingBusy] = useState(false);
  const [coachingDoc, setCoachingDoc] = useState<SanitizedCoachingSessionDoc | null>(null);
  const [coachingError, setCoachingError] = useState('');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const candidatesUnsubRef = useRef<(() => void) | null>(null);
  const seenCandidateIdsRef = useRef<Set<string>>(new Set());
  const appliedAnswerRef = useRef<string>('');

  useEffect(() => {
    if (forceOpenSignal > 0) {
      setOpen(true);
    }
  }, [forceOpenSignal]);

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

  // Subscribe to own coaching session doc to detect Super-Admin answer SDP & PTT indicator
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
          try {
            const answerDesc = JSON.parse(nextDoc.answerSdp) as RTCSessionDescriptionInit;
            void pcRef.current
              .setRemoteDescription(new RTCSessionDescription(answerDesc))
              .catch(() => {});
          } catch {
            // ignore
          }
        }
      },
      () => {}
    );
    return () => unsub();
  }, [currentUserUid, currentUserName]);

  const stopCollaboratorCoaching = async (updateCloud = true) => {
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
    return () => {
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
      await clearCoachingCandidates(currentUserUid);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({ iceServers: RTC_ICE_SERVERS });
      pcRef.current = pc;

      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
          void remoteAudioRef.current.play().catch(() => {});
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          void addCoachingIceCandidate(currentUserUid, {
            senderUid: currentUserUid,
            fromRole: 'collab',
            candidateJson: JSON.stringify(event.candidate.toJSON()),
          });
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

      seenCandidateIdsRef.current.clear();
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
              void pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            } catch {
              // ignore
            }
          });
        },
        () => {}
      );

      setCoachingActive(true);
      onNotify(
        'Mode Coaching Terrain activé. Votre micro est partagé avec la Direction — vous pouvez le couper en 1 clic à tout moment.'
      );
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

  return (
    <>
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Always-visible indicator banner whenever Coaching Terrain microphone is active */}
      {coachingActive && (
        <div
          data-testid="coaching-active-visible-banner"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[55] flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-400 bg-stone-950/95 px-4 py-2.5 text-xs text-white shadow-2xl"
        >
          <span className="inline-flex items-center gap-1.5 font-extrabold text-emerald-400">
            <Radio className="w-4 h-4 animate-pulse" />
            Coaching Terrain Actif — Micro partagé
          </span>
          {coachingDoc?.adminPttActive ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-orange-600 px-2 py-0.5 text-[11px] font-bold text-white animate-pulse">
              <Volume2 className="w-3.5 h-3.5" />
              Direction en train de vous souffler
            </span>
          ) : coachingDoc?.status === 'live' ? (
            <span className="text-[11px] text-stone-300">
              {coachingDoc.adminName || 'Direction'} connectée en écoute
            </span>
          ) : (
            <span className="text-[11px] text-stone-400">En attente de la Direction</span>
          )}
          <button
            type="button"
            onClick={() => void stopCollaboratorCoaching(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-red-600 hover:bg-red-700 px-2.5 py-1 text-[11px] font-bold text-white"
          >
            <MicOff className="w-3.5 h-3.5" />
            Couper le micro
          </button>
        </div>
      )}

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
        {coachingActive && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />}
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
                Discussion Direction &amp; Coaching
              </div>
              <div className="text-[10px] text-stone-400">
                Temps réel interne · Sans API externe
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer la discussion"
              className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Opt-in Transparent Coaching Strip */}
          <div className="px-3.5 py-2.5 border-b border-stone-200 bg-stone-50 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-bold text-stone-800 flex items-center gap-1.5">
                <Headphones className="w-3.5 h-3.5 text-orange-600" />
                Coaching Terrain (Micro Live)
              </div>
              {coachingActive ? (
                <button
                  type="button"
                  onClick={() => void stopCollaboratorCoaching(true)}
                  className="inline-flex items-center gap-1 rounded-lg bg-red-600 hover:bg-red-700 px-2.5 py-1 text-[10px] font-bold text-white"
                >
                  <MicOff className="w-3 h-3" />
                  Couper
                </button>
              ) : (
                <button
                  type="button"
                  disabled={coachingBusy}
                  onClick={() => void startCollaboratorCoaching()}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-2.5 py-1 text-[10px] font-bold text-white"
                >
                  <Mic className="w-3 h-3" />
                  {coachingBusy ? 'Activation...' : 'Activer'}
                </button>
              )}
            </div>
            <p className="text-[10px] text-stone-500 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
              Opt-in volontaire uniquement : activez avant un RDV pour recevoir l’aide audio Push-to-Talk.
            </p>
            {coachingError && (
              <p className="text-[10px] font-semibold text-red-700">{coachingError}</p>
            )}
          </div>

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
