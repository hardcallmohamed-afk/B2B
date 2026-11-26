import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  User,
  MessageCircle,
  Headphones,
  Send,
  Mic,
  MicOff,
  PhoneCall,
  MapPin,
  Clock,
  Briefcase,
  CheckCircle2,
  Wallet,
  ExternalLink,
  Volume2,
  ShieldCheck,
  Radio,
  Sparkles,
  Wifi,
  WifiOff,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { onSnapshot } from 'firebase/firestore';
import {
  addCoachingIceCandidate,
  clearCoachingCandidates,
  createCloudNotification,
  fetchTeamMemberFiches,
  getCoachingCandidatesQuery,
  getCoachingSessionDocRef,
  getDirectChatMessagesQuery,
  markDirectChatRead,
  sendDirectChatMessage,
  setAdminCoachingState,
  type UserPresenceRecord,
} from '../firebase';
import type {
  SanitizedCoachingSessionDoc,
  SanitizedDirectChatMessageDoc,
  SanitizedFicheDoc,
} from '../utils/firestoreSanitize';
import {
  formatMad,
  type SignedContractRecord,
  type TeamRole,
  type TeamStatRecord,
} from '../utils/gamification';
import {
  FIELD_STATUS_META,
  formatDateTimeShort,
  formatWorkedDuration,
  parseLiveFieldTelemetry,
  reconcilePresenceOnlineState,
  resolveCollaboratorCoordinates,
} from '../utils/attendance';
import { resolveCityAndRegionFromZoneString } from '../utils/moroccoCities';
import { getUserInitials } from '../utils/avatarResize';
import { RoleBadge } from './RoleBadge';

const RTC_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export type ProfileChatModalTab = 'profile' | 'chat' | 'coaching';

export interface CollaboratorProfileTarget {
  uid: string;
  displayName: string;
  email: string;
  role: TeamRole;
  zone: string;
  phonePro?: string;
  avatarDataUrl?: string;
  active?: boolean;
}

interface CollaboratorProfileChatModalProps {
  isOpen: boolean;
  initialTab?: ProfileChatModalTab;
  target: CollaboratorProfileTarget | null;
  adminUid: string;
  adminName: string;
  presence?: UserPresenceRecord | null;
  teamStat?: TeamStatRecord | null;
  signedContracts: SignedContractRecord[];
  onClose: () => void;
  onNotify: (msg: string, type?: 'ok' | 'warn' | 'err') => void;
  onInspectFiche?: (fiche: SanitizedFicheDoc, ownerUid: string, ownerName: string) => void;
}

export const CollaboratorProfileChatModal: React.FC<CollaboratorProfileChatModalProps> = ({
  isOpen,
  initialTab = 'profile',
  target,
  adminUid,
  adminName,
  presence,
  teamStat,
  signedContracts,
  onClose,
  onNotify,
  onInspectFiche,
}) => {
  const [activeTab, setActiveTab] = useState<ProfileChatModalTab>(initialTab);
  const [portfolioFiches, setPortfolioFiches] = useState<SanitizedFicheDoc[]>([]);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);

  // Real-time direct chat state (Firestore, 0 external API)
  const [messages, setMessages] = useState<SanitizedDirectChatMessageDoc[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Transparent opt-in WebRTC Live Coaching & Push-to-Talk state (0 external API)
  const [coachingDoc, setCoachingDoc] = useState<SanitizedCoachingSessionDoc | null>(null);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [rtcStatus, setRtcStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [rtcError, setRtcError] = useState<string>('');
  const [pttActive, setPttActive] = useState(false);
  const [pttLatched, setPttLatched] = useState(false);
  const [remoteVolumeMuted, setRemoteVolumeMuted] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const candidatesUnsubRef = useRef<(() => void) | null>(null);
  const seenCandidateIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab, target?.uid]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Load collaborator's portfolio preview when Profile tab is shown
  useEffect(() => {
    if (!isOpen || !target?.uid) return;
    let cancelled = false;
    setLoadingPortfolio(true);
    fetchTeamMemberFiches(target.uid)
      .then((list) => {
        if (!cancelled) setPortfolioFiches(list || []);
      })
      .catch(() => {
        if (!cancelled) setPortfolioFiches([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPortfolio(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, target?.uid]);

  // Subscribe to real-time Direct Chat messages
  useEffect(() => {
    if (!isOpen || !target?.uid) return;
    const unsub = onSnapshot(
      getDirectChatMessagesQuery(target.uid),
      (snap) => {
        const list: SanitizedDirectChatMessageDoc[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: docSnap.id,
            collabUid: String(d.collabUid || target.uid),
            orgScope: 'orange_pro_team',
            senderUid: String(d.senderUid || ''),
            senderName: String(d.senderName || 'Utilisateur'),
            senderRole: typeof d.senderRole === 'string' ? d.senderRole : undefined,
            text: String(d.text || ''),
            createdAtIso: typeof d.createdAtIso === 'string' ? d.createdAtIso : '',
          });
        });
        list.sort((a, b) => (a.createdAtIso || '').localeCompare(b.createdAtIso || ''));
        setMessages(list);
      },
      () => {
        setMessages([]);
      }
    );
    return () => unsub();
  }, [isOpen, target?.uid]);

  // Auto-scroll chat & mark read when on Chat tab
  useEffect(() => {
    if (!isOpen || !target?.uid || activeTab !== 'chat') return;
    void markDirectChatRead(target.uid, 'admin');
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [isOpen, target?.uid, activeTab, messages.length]);

  // Subscribe to Coaching Session signaling document
  useEffect(() => {
    if (!isOpen || !target?.uid) return;
    const unsub = onSnapshot(
      getCoachingSessionDocRef(target.uid),
      (snap) => {
        if (!snap.exists()) {
          setCoachingDoc(null);
          return;
        }
        const d = snap.data();
        setCoachingDoc({
          collabUid: snap.id,
          orgScope: 'orange_pro_team',
          collabName: String(d.collabName || target.displayName),
          status: (d.status || 'idle') as SanitizedCoachingSessionDoc['status'],
          collabConsentActive: Boolean(d.collabConsentActive),
          adminUid: typeof d.adminUid === 'string' ? d.adminUid : undefined,
          adminName: typeof d.adminName === 'string' ? d.adminName : undefined,
          adminPttActive: Boolean(d.adminPttActive),
          offerSdp: typeof d.offerSdp === 'string' ? d.offerSdp : '',
          answerSdp: typeof d.answerSdp === 'string' ? d.answerSdp : '',
          updatedAtIso: typeof d.updatedAtIso === 'string' ? d.updatedAtIso : '',
        });
      },
      () => {
        setCoachingDoc(null);
      }
    );
    return () => unsub();
  }, [isOpen, target?.uid, target?.displayName]);

  // Cleanup WebRTC session cleanly
  const stopAdminCoachingSession = async (updateCloud = true) => {
    setPttActive(false);
    setPttLatched(false);
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
    setRtcStatus('idle');
    setRtcError('');

    if (updateCloud && target?.uid && coachingDoc?.collabConsentActive) {
      try {
        await setAdminCoachingState(target.uid, {
          status: 'collab_ready',
          adminPttActive: false,
          answerSdp: '',
        });
      } catch {
        // non-fatal
      }
    }
  };

  // Stop WebRTC if modal closes or collaborator revokes consent
  useEffect(() => {
    if (!isOpen) {
      void stopAdminCoachingSession(true);
    }
  }, [isOpen]);

  useEffect(() => {
    if (rtcStatus !== 'idle' && coachingDoc && !coachingDoc.collabConsentActive) {
      void stopAdminCoachingSession(false);
      onNotify(`${target?.displayName || 'Le collaborateur'} a coupé son micro de coaching.`, 'warn');
    }
  }, [coachingDoc?.collabConsentActive, rtcStatus]);

  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = remoteVolumeMuted;
    }
  }, [remoteVolumeMuted]);

  const handleJoinLiveCoaching = async () => {
    if (!target?.uid) return;
    if (!coachingDoc || !coachingDoc.collabConsentActive || !coachingDoc.offerSdp) {
      setRtcError(
        'Le collaborateur doit d’abord activer son « Mode Coaching Terrain » sur son appareil pour démarrer l’écoute.'
      );
      return;
    }
    if (typeof RTCPeerConnection === 'undefined') {
      setRtcError('WebRTC n’est pas supporté par ce navigateur.');
      return;
    }

    await stopAdminCoachingSession(false);
    setRtcStatus('connecting');
    setRtcError('');

    try {
      const pc = new RTCPeerConnection({ iceServers: RTC_ICE_SERVERS });
      pcRef.current = pc;

      // Attach Super-Admin microphone track (muted by default until Push-to-Talk is pressed)
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          localStreamRef.current = micStream;
          micStream.getAudioTracks().forEach((track) => {
            track.enabled = false; // Muted until Push-to-Talk
            pc.addTrack(track, micStream);
          });
        }
      } catch {
        // Still allow listen-only if Super-Admin has no microphone
        onNotify('Micro Direction indisponible — mode écoute seule activé.', 'warn');
      }

      pc.ontrack = (event) => {
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.muted = remoteVolumeMuted;
          void remoteAudioRef.current.play().catch(() => {});
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && target.uid) {
          void addCoachingIceCandidate(target.uid, {
            senderUid: adminUid,
            fromRole: 'admin',
            candidateJson: JSON.stringify(event.candidate.toJSON()),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === 'connected') {
          setRtcStatus('connected');
        } else if (st === 'failed' || st === 'disconnected' || st === 'closed') {
          setRtcStatus('idle');
          setPttActive(false);
          setPttLatched(false);
        }
      };

      const offerDesc = JSON.parse(coachingDoc.offerSdp) as RTCSessionDescriptionInit;
      await pc.setRemoteDescription(new RTCSessionDescription(offerDesc));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await setAdminCoachingState(target.uid, {
        status: 'live',
        adminUid,
        adminName,
        adminPttActive: false,
        answerSdp: JSON.stringify(answer),
      });

      // Listen for collaborator ICE candidates
      seenCandidateIdsRef.current.clear();
      candidatesUnsubRef.current = onSnapshot(
        getCoachingCandidatesQuery(target.uid),
        (snap) => {
          snap.forEach((docSnap) => {
            if (seenCandidateIdsRef.current.has(docSnap.id)) return;
            const d = docSnap.data();
            if (d.fromRole !== 'collab' || typeof d.candidateJson !== 'string') return;
            seenCandidateIdsRef.current.add(docSnap.id);
            try {
              const cand = JSON.parse(d.candidateJson) as RTCIceCandidateInit;
              void pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            } catch {
              // ignore malformed candidate
            }
          });
        },
        () => {}
      );

      setRtcStatus('connected');
      onNotify(`Écoute Coaching Live connectée avec ${target.displayName}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Échec de connexion WebRTC.';
      setRtcStatus('error');
      setRtcError(msg);
      await stopAdminCoachingSession(false);
    }
  };

  const setPushToTalkEnabled = (enabled: boolean) => {
    if (!target?.uid || rtcStatus !== 'connected') return;
    if (!localStreamRef.current || localStreamRef.current.getAudioTracks().length === 0) {
      if (enabled) {
        onNotify('Autorisez le microphone de votre poste pour utiliser le Push-to-Talk.', 'warn');
      }
      return;
    }
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
    setPttActive(enabled);
    void setAdminCoachingState(target.uid, { adminPttActive: enabled }).catch(() => {});
  };

  const handleInviteCoaching = async () => {
    if (!target?.uid) return;
    setSendingInvite(true);
    try {
      await clearCoachingCandidates(target.uid);
      await createCloudNotification({
        recipientUid: target.uid,
        senderUid: adminUid,
        senderName: adminName,
        senderRole: 'super_admin',
        kind: 'coaching_invite',
        title: `Invitation Coaching Terrain de ${adminName}`,
        message:
          'Activez « Mode Coaching Terrain » dans votre panneau Discussion Direction pour partager votre audio et recevoir les conseils Push-to-Talk en direct.',
        targetTab: 'crm',
      });
      onNotify(`Invitation Coaching Terrain envoyée à ${target.displayName}.`);
    } catch {
      onNotify('Impossible d’envoyer l’invitation Coaching.', 'err');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target?.uid || !chatInput.trim() || sendingMsg) return;
    const textToSend = chatInput.trim();
    setSendingMsg(true);
    try {
      await sendDirectChatMessage({
        collabUid: target.uid,
        collabName: target.displayName,
        collabEmail: target.email,
        collabZone: target.zone,
        senderUid: adminUid,
        senderName: adminName,
        senderRole: 'super_admin',
        isSenderSuperAdmin: true,
        text: textToSend,
        recipientUidForNotification: target.uid,
      });
      setChatInput('');
    } catch {
      onNotify('Échec d’envoi du message direct.', 'err');
    } finally {
      setSendingMsg(false);
    }
  };

  const memberContracts = useMemo(() => {
    if (!target?.uid) return [];
    return signedContracts
      .filter((c) => c.ownerId === target.uid)
      .sort((a, b) => (b.signedAt || '').localeCompare(a.signedAt || ''));
  }, [signedContracts, target?.uid]);

  if (!isOpen || !target) return null;

  const presenceState = reconcilePresenceOnlineState(
    Boolean(presence?.isOnline),
    presence?.lastSeenAt
  );
  const effectiveOnline = presenceState.effectiveOnline;
  const telemetry = parseLiveFieldTelemetry(
    presence?.currentDevice || '',
    effectiveOnline,
    presence?.lastSeenAt
  );
  const coords = resolveCollaboratorCoordinates({
    uid: target.uid,
    zone: presence?.zone || target.zone || 'Meknès',
    lat: telemetry.lat,
    lng: telemetry.lng,
  });
  const fieldMeta = FIELD_STATUS_META[telemetry.status] || FIELD_STATUS_META.hors_ligne;
  const zoneResolved = resolveCityAndRegionFromZoneString(presence?.zone || target.zone || 'Meknès');

  const confirmedPayout = memberContracts
    .filter((c) => c.payoutStatus === 'Validé' || c.payoutStatus === 'Versé')
    .reduce((sum, c) => sum + c.payoutMad, 0);
  const pendingPayout = memberContracts
    .filter((c) => c.payoutStatus === 'En attente')
    .reduce((sum, c) => sum + c.payoutMad, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-stone-950/55 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="collab-profile-modal-title"
      data-testid="collaborator-profile-chat-modal"
    >
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <div
        className="relative flex h-full w-full max-w-3xl flex-col bg-[#F7F5F0] shadow-2xl border-l border-stone-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white border-b border-stone-200 px-5 py-4 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative h-12 w-12 rounded-xl overflow-hidden border border-stone-200 bg-stone-900 text-white flex items-center justify-center shrink-0">
                {target.avatarDataUrl || presence?.avatarDataUrl ? (
                  <img
                    src={target.avatarDataUrl || presence?.avatarDataUrl}
                    alt={target.displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-extrabold">{getUserInitials(target.displayName)}</span>
                )}
                <span
                  className={`absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                    effectiveOnline ? 'bg-emerald-500' : 'bg-stone-400'
                  }`}
                />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="collab-profile-modal-title"
                    className="text-base sm:text-lg font-extrabold text-stone-900 truncate"
                  >
                    {target.displayName}
                  </h2>
                  <RoleBadge role={target.role} showShort />
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                      effectiveOnline
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-stone-100 text-stone-600 border border-stone-200'
                    }`}
                  >
                    {effectiveOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {effectiveOnline ? 'En ligne' : 'Hors ligne'}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-stone-500">
                  <span>{target.email}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-orange-600" />
                    {zoneResolved.formattedZone}
                  </span>
                  {(presence?.phonePro || target.phonePro) && (
                    <>
                      <span>·</span>
                      <a
                        href={`tel:${presence?.phonePro || target.phonePro}`}
                        className="font-mono font-semibold text-orange-700 hover:underline"
                      >
                        {presence?.phonePro || target.phonePro}
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer le profil collaborateur"
              className="p-2 rounded-xl border border-stone-200 bg-stone-50 text-stone-500 hover:text-stone-900 hover:bg-stone-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Super-Admin Navigation Tabs */}
          <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'profile', label: 'Profil & Performances', icon: User },
                { id: 'chat', label: `Discussion Directe (${messages.length})`, icon: MessageCircle },
                {
                  id: 'coaching',
                  label:
                    coachingDoc?.collabConsentActive
                      ? 'Coaching Live & Push-to-Talk (Prêt)'
                      : 'Coaching Live & Push-to-Talk',
                  icon: Headphones,
                },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`collab-modal-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                    active
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tab.id === 'coaching' && coachingDoc?.collabConsentActive && (
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'profile' && (
            <div className="space-y-4">
              {/* Presence & GPS Card */}
              <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-stone-900">
                    <MapPin className="w-4 h-4 text-orange-600" />
                    Présence Terrain, Appareil &amp; Localisation GPS
                  </div>
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${fieldMeta.badgeCls}`}>
                    {fieldMeta.label}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3">
                    <div className="text-[11px] text-stone-500">Pointage aujourd’hui</div>
                    <div className="mt-1 text-base font-extrabold text-stone-900 font-mono tabular-nums">
                      {formatWorkedDuration(presence?.todayWorkedSeconds || 0)}
                    </div>
                    <div className="mt-0.5 text-[11px] text-stone-500">
                      Cumul : {formatWorkedDuration(presence?.totalWorkedSeconds || 0)}
                    </div>
                  </div>

                  <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3">
                    <div className="text-[11px] text-stone-500">Dernière activité</div>
                    <div className="mt-1 text-sm font-bold text-stone-900">
                      {presence?.lastSeenAt ? formatDateTimeShort(presence.lastSeenAt) : '—'}
                    </div>
                    <div className="mt-0.5 text-[11px] text-stone-500 truncate">
                      {telemetry.cleanDeviceLabel || 'Appareil non détecté'}
                    </div>
                  </div>

                  <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3">
                    <div className="text-[11px] text-stone-500">Position GPS</div>
                    <div className="mt-1 font-mono text-[11px] font-bold text-orange-800">
                      {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between text-[11px] text-stone-500">
                      <span>
                        {coords.source === 'gps_live'
                          ? `GPS Live${telemetry.accuracyMeters ? ` (±${telemetry.accuracyMeters}m)` : ''}`
                          : 'Zone assignée'}
                      </span>
                      <a
                        href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 font-semibold text-orange-700 hover:underline"
                      >
                        Maps <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Commercial KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
                  <div className="text-[11px] text-stone-500 flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-orange-600" />
                    Fiches Portefeuille
                  </div>
                  <div className="mt-1 text-xl font-extrabold text-stone-900 tabular-nums">
                    {portfolioFiches.length}
                  </div>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
                  <div className="text-[11px] text-stone-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Contrats Signés
                  </div>
                  <div className="mt-1 text-xl font-extrabold text-stone-900 tabular-nums">
                    {memberContracts.filter((c) => c.payoutStatus !== 'Refusé').length}
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5">
                  <div className="text-[11px] text-emerald-800 flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5" />
                    Payout Confirmé
                  </div>
                  <div className="mt-1 text-base font-extrabold text-emerald-950 font-mono tabular-nums">
                    {formatMad(confirmedPayout)}
                  </div>
                  {pendingPayout > 0 && (
                    <div className="text-[10px] text-amber-700 font-semibold">
                      +{formatMad(pendingPayout)} en attente
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
                  <div className="text-[11px] text-stone-500 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    XP &amp; Badges
                  </div>
                  <div className="mt-1 text-base font-extrabold text-stone-900 tabular-nums">
                    {(teamStat?.xp || 0).toLocaleString('fr-FR')} XP
                  </div>
                  <div className="text-[10px] text-stone-500">
                    {teamStat?.unlockedCount || 0} badge(s)
                  </div>
                </div>
              </div>

              {/* Portfolio Preview */}
              <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-stone-100 bg-stone-50/70 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-stone-900">
                    <FileText className="w-4 h-4 text-orange-600" />
                    Aperçu du portefeuille ({portfolioFiches.length} fiche{portfolioFiches.length > 1 ? 's' : ''})
                  </div>
                  {loadingPortfolio && <RefreshCw className="w-3.5 h-3.5 animate-spin text-stone-400" />}
                </div>
                <div className="divide-y divide-stone-100 max-h-60 overflow-y-auto">
                  {portfolioFiches.length === 0 ? (
                    <div className="p-4 text-center text-xs text-stone-500">
                      Aucune fiche dans ce portefeuille pour le moment.
                    </div>
                  ) : (
                    portfolioFiches.slice(0, 12).map((f) => (
                      <div
                        key={f.id}
                        className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs hover:bg-stone-50"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-stone-900 truncate">
                            {f.numeroFiche ? `${f.numeroFiche} · ` : ''}
                            {f.societe}
                          </div>
                          <div className="text-[11px] text-stone-500 truncate">
                            {f.ville || 'Maroc'} · {f.contact || 'Contact à qualifier'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-bold text-stone-700">
                            {f.statut}
                          </span>
                          {onInspectFiche && (
                            <button
                              type="button"
                              onClick={() => onInspectFiche(f, target.uid, target.displayName)}
                              className="text-[11px] font-bold text-orange-700 hover:underline"
                            >
                              Ouvrir →
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="flex flex-col h-[calc(100vh-230px)] min-h-[380px] rounded-2xl border border-stone-200 bg-white overflow-hidden">
              <div className="px-4 py-2.5 border-b border-stone-100 bg-stone-50/70 flex items-center justify-between text-xs">
                <span className="font-bold text-stone-800 flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5 text-orange-600" />
                  Discussion directe temps réel avec {target.displayName}
                </span>
                <span className="text-[11px] text-stone-500">
                  100% interne Firestore · Zéro API externe
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[#FAF8F4]">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-xs text-stone-500 space-y-1">
                    <MessageCircle className="w-7 h-7 text-stone-300" />
                    <p className="font-semibold text-stone-700">Aucun message pour le moment</p>
                    <p>Envoyez une consigne terrain, un suivi devis ou un encouragement en direct.</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMine = m.senderUid === adminUid;
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-xs shadow-xs ${
                            isMine
                              ? 'bg-orange-600 text-white rounded-br-sm'
                              : 'bg-white border border-stone-200 text-stone-800 rounded-bl-sm'
                          }`}
                        >
                          <div className="whitespace-pre-wrap leading-relaxed break-words">
                            {m.text}
                          </div>
                        </div>
                        <span className="mt-0.5 px-1 text-[10px] text-stone-400">
                          {isMine ? 'Vous (Direction)' : m.senderName} ·{' '}
                          {m.createdAtIso ? formatDateTimeShort(m.createdAtIso) : ''}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form
                onSubmit={(e) => void handleSendChat(e)}
                className="p-3 border-t border-stone-200 bg-white flex items-center gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={`Écrire un message direct à ${target.displayName}...`}
                  maxLength={2000}
                  className="flex-1 rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-orange-500 focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || sendingMsg}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 px-3.5 py-2 text-xs font-bold text-white"
                >
                  <Send className="w-3.5 h-3.5" />
                  Envoyer
                </button>
              </form>
            </div>
          )}

          {activeTab === 'coaching' && (
            <div className="space-y-4">
              {/* Transparency & Architecture Notice */}
              <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-xs text-sky-950 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-sky-900">
                  <ShieldCheck className="w-4 h-4 text-sky-700" />
                  Coaching Terrain Live &amp; Push-to-Talk (WebRTC P2P — Zéro API externe)
                </div>
                <p className="text-sky-900/90 leading-relaxed">
                  L’écoute live et le soufflage Push-to-Talk fonctionnent directement en audio pair-à-pair
                  (WebRTC + Firestore) sans aucune API tierce. Pour des raisons légales et de sécurité navigateur,
                  le collaborateur doit activer son <strong>Mode Coaching Terrain</strong> sur son appareil
                  (avec indicateur micro visible et bouton d’arrêt instantané).
                </p>
              </div>

              {/* Live Coaching Control Card */}
              <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-stone-500">
                      Statut Coaching de {target.displayName}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                          rtcStatus === 'connected'
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : coachingDoc?.collabConsentActive
                              ? 'bg-orange-100 text-orange-900 border border-orange-300'
                              : 'bg-stone-100 text-stone-700 border border-stone-200'
                        }`}
                      >
                        <Radio
                          className={`w-3.5 h-3.5 ${
                            rtcStatus === 'connected' || coachingDoc?.collabConsentActive
                              ? 'animate-pulse'
                              : ''
                          }`}
                        />
                        {rtcStatus === 'connected'
                          ? 'Écoute Live Connectée'
                          : coachingDoc?.collabConsentActive
                            ? 'Collaborateur prêt — Micro partagé'
                            : 'Mode Coaching non activé par le collaborateur'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleInviteCoaching()}
                    disabled={sendingInvite}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-orange-300 bg-orange-50 hover:bg-orange-100 px-3 py-2 text-xs font-bold text-orange-900 disabled:opacity-50"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    {sendingInvite ? 'Envoi...' : 'Inviter au Coaching Live'}
                  </button>
                </div>

                {rtcError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800">
                    {rtcError}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-stone-100">
                  {rtcStatus !== 'connected' ? (
                    <button
                      type="button"
                      disabled={!coachingDoc?.collabConsentActive || rtcStatus === 'connecting'}
                      onClick={() => void handleJoinLiveCoaching()}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 px-4 py-2.5 text-xs font-extrabold text-white shadow-xs"
                    >
                      <Headphones className="w-4 h-4" />
                      {rtcStatus === 'connecting'
                        ? 'Connexion audio P2P...'
                        : 'Rejoindre l’écoute live'}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onPointerDown={() => {
                          setPttLatched(false);
                          setPushToTalkEnabled(true);
                        }}
                        onPointerUp={() => {
                          if (!pttLatched) setPushToTalkEnabled(false);
                        }}
                        onPointerLeave={() => {
                          if (!pttLatched && pttActive) setPushToTalkEnabled(false);
                        }}
                        className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-xs font-extrabold transition-all select-none ${
                          pttActive
                            ? 'bg-orange-600 text-white ring-4 ring-orange-200 scale-[1.02]'
                            : 'bg-stone-900 text-orange-300 hover:bg-stone-800'
                        }`}
                      >
                        {pttActive ? <Mic className="w-4 h-4 animate-pulse" /> : <MicOff className="w-4 h-4" />}
                        {pttActive
                          ? 'SOUFFLAGE ACTIF — Relâcher pour couper'
                          : 'Maintenir Push-to-Talk (Souffler)'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const next = !pttLatched;
                          setPttLatched(next);
                          setPushToTalkEnabled(next);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold ${
                          pttLatched
                            ? 'border-orange-500 bg-orange-50 text-orange-900'
                            : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        {pttLatched ? 'Micro continu ON' : 'Micro continu OFF'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setRemoteVolumeMuted((v) => !v)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 px-3 py-2.5 text-xs font-semibold text-stone-700"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        {remoteVolumeMuted ? 'Son coupé' : 'Écoute active'}
                      </button>

                      <button
                        type="button"
                        onClick={() => void stopAdminCoachingSession(true)}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 px-3.5 py-2.5 text-xs font-bold text-white"
                      >
                        Terminer l’écoute
                      </button>
                    </>
                  )}
                </div>

                <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 text-[11px] text-stone-600 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    Dernier signal coaching :{' '}
                    <strong className="text-stone-800">
                      {coachingDoc?.updatedAtIso ? formatDateTimeShort(coachingDoc.updatedAtIso) : 'Aucun'}
                    </strong>
                  </span>
                  <span>P2P Audio chiffré DTLS-SRTP</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
