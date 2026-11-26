import {
  formatMad,
  type BadgeRarity,
  type EvaluatedAchievement,
  type PayoutStatus,
  type SignedContractRecord,
} from './gamification';
import type { SanitizedCloudNotificationDoc } from './firestoreSanitize';

export type NotificationKind =
  | 'achievement_unlocked'
  | 'role_badge_awarded'
  | 'distinction_awarded'
  | 'contract_signed'
  | 'contract_status_changed'
  | 'fiche_assigned'
  | 'fiche_accessed'
  | 'fiche_restored'
  | 'fiche_updated'
  | 'direct_message'
  | 'coaching_invite';

export interface ContractNotificationMeta {
  contractId: string;
  ownerId: string;
  ownerName: string;
  societe: string;
  produitOrangePro: string;
  payoutMad: number;
  payoutStatus: PayoutStatus;
  previousStatus?: PayoutStatus;
  referenceVirement?: string;
  refusMotif?: string;
}

export interface FicheNotificationMeta {
  ficheId: string;
  ficheOwnerId: string;
  numeroFiche?: string;
  societe: string;
  actorUid?: string;
  actorName: string;
  actorRole?: string;
}

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  badgeId: string;
  title: string;
  message: string;
  rarity: BadgeRarity;
  xpBoost: number;
  createdAt: string;
  read: boolean;
  targetTab?: 'badges' | 'team' | 'crm';
  cloudDocId?: string;
  contractMeta?: ContractNotificationMeta;
  ficheMeta?: FicheNotificationMeta;
}

export interface BadgeBaselineSnapshot {
  initialized: boolean;
  unlockedIds: string[];
}

export interface ContractBaselineEntry {
  payoutStatus: PayoutStatus;
  payoutMad: number;
}

export interface ContractBaselineSnapshot {
  initialized: boolean;
  byId: Record<string, ContractBaselineEntry>;
}

const MAX_NOTIFICATIONS = 50;

export function detectNewUnlockNotifications(
  baseline: BadgeBaselineSnapshot,
  evaluatedItems: EvaluatedAchievement[],
  nowIso: string = new Date().toISOString()
): {
  nextBaseline: BadgeBaselineSnapshot;
  created: AppNotification[];
} {
  const currentUnlocked = evaluatedItems.filter((item) => item.unlocked);
  const currentIds = currentUnlocked.map((i) => i.id);

  if (!baseline.initialized) {
    return {
      nextBaseline: {
        initialized: true,
        unlockedIds: currentIds,
      },
      created: [],
    };
  }

  const seen = new Set(baseline.unlockedIds);
  const created: AppNotification[] = [];

  for (const item of currentUnlocked) {
    if (seen.has(item.id)) continue;
    const isRoleBadge = item.isManualAdminBadge && item.xpType === 'Badge de Rôle';
    const kind: NotificationKind = isRoleBadge
      ? 'role_badge_awarded'
      : item.isManualAdminBadge
        ? 'distinction_awarded'
        : 'achievement_unlocked';

    const title = isRoleBadge
      ? `Badge de rôle attribué : ${item.title}`
      : item.isManualAdminBadge
        ? `Distinction attribuée : ${item.title}`
        : `Succès débloqué : ${item.title}`;

    const message = isRoleBadge
      ? `L’administrateur vous a attribué le rôle « ${item.title} » (+${item.xpBoost} XP).`
      : item.isManualAdminBadge
        ? `Distinction officielle attribuée par le Super-Admin (+${item.xpBoost} XP).`
        : `${item.description} (+${item.xpBoost} XP)`;

    created.push({
      id: `notif_${item.id}_${Date.parse(nowIso) || Date.now()}`,
      kind,
      badgeId: item.id,
      title,
      message,
      rarity: item.rarity,
      xpBoost: item.xpBoost,
      createdAt: nowIso,
      read: false,
      targetTab: 'badges',
    });
  }

  // Keep union of all previously seen + currently unlocked so temporarily locked items don't re-spam
  const unionIds = Array.from(new Set([...baseline.unlockedIds, ...currentIds]));

  return {
    nextBaseline: {
      initialized: true,
      unlockedIds: unionIds,
    },
    created,
  };
}

export function detectContractNotifications(
  baseline: ContractBaselineSnapshot,
  contracts: SignedContractRecord[],
  options: {
    currentUserUid: string;
    canSuperviseTeam: boolean;
    nowIso?: string;
  }
): {
  nextBaseline: ContractBaselineSnapshot;
  created: AppNotification[];
} {
  const nowIso = options.nowIso || new Date().toISOString();
  const stamp = Date.parse(nowIso) || Date.now();
  const nextById: Record<string, ContractBaselineEntry> = { ...baseline.byId };

  for (const c of contracts) {
    nextById[c.id] = {
      payoutStatus: c.payoutStatus,
      payoutMad: Math.max(0, Number(c.payoutMad) || 0),
    };
  }

  if (!baseline.initialized) {
    return {
      nextBaseline: {
        initialized: true,
        byId: nextById,
      },
      created: [],
    };
  }

  const created: AppNotification[] = [];

  for (const c of contracts) {
    const prev = baseline.byId[c.id];
    const amount = Math.max(0, Number(c.payoutMad) || 0);
    const isOwner = c.ownerId === options.currentUserUid;
    const baseMeta: ContractNotificationMeta = {
      contractId: c.id,
      ownerId: c.ownerId,
      ownerName: c.ownerName || 'Collaborateur',
      societe: c.societe || 'Client Orange Pro',
      produitOrangePro: c.produitOrangePro || c.tier,
      payoutMad: amount,
      payoutStatus: c.payoutStatus,
      referenceVirement: c.referenceVirement,
      refusMotif: c.refusMotif,
    };

    if (!prev) {
      // Nouveau contrat signé : notifier Super-Admin / Manager / Chef d'équipe lorsqu'un collaborateur signe
      if (options.canSuperviseTeam && !isOwner) {
        created.push({
          id: `notif_ctr_signed_${c.id}_${stamp}`,
          kind: 'contract_signed',
          badgeId: 'contract_signed',
          title: `Nouveau contrat signé par ${baseMeta.ownerName}`,
          message: `${baseMeta.societe}${c.ville ? ` (${c.ville})` : ''} · ${baseMeta.produitOrangePro} — ${formatMad(amount)} (${c.payoutStatus}).`,
          rarity: c.tier === 'Grand Compte' ? 'epique' : 'rare',
          xpBoost: 0,
          createdAt: nowIso,
          read: false,
          targetTab: 'team',
          contractMeta: baseMeta,
        });
      }
      continue;
    }

    if (prev.payoutStatus !== c.payoutStatus) {
      if (isOwner || options.canSuperviseTeam) {
        let title = `Statut contrat mis à jour : ${baseMeta.societe}`;
        let message = `Statut passé de « ${prev.payoutStatus} » à « ${c.payoutStatus} » (${formatMad(amount)}).`;
        let rarity: BadgeRarity = 'rare';

        if (c.payoutStatus === 'Refusé') {
          title = `Contrat refusé : ${baseMeta.societe}`;
          message = `${isOwner ? 'Votre contrat' : `Contrat de ${baseMeta.ownerName}`} a été refusé${c.refusMotif ? ` — Motif : ${c.refusMotif}` : ''}. Le payout est retiré des totaux.`;
          rarity = 'commun';
        } else if (c.payoutStatus === 'Versé') {
          title = `Payout versé : ${baseMeta.societe}`;
          message = `${formatMad(amount)} versé${isOwner ? '' : ` à ${baseMeta.ownerName}`}${c.referenceVirement ? ` (Réf. ${c.referenceVirement})` : ''}.`;
          rarity = 'legendaire';
        } else if (c.payoutStatus === 'Validé') {
          title = `Contrat validé : ${baseMeta.societe}`;
          message = `${isOwner ? 'Votre contrat' : `Contrat de ${baseMeta.ownerName}`} est validé pour ${formatMad(amount)} et ajouté au cumul.`;
          rarity = 'epique';
        } else if (c.payoutStatus === 'En attente') {
          title = `Contrat remis en attente : ${baseMeta.societe}`;
          message = `${isOwner ? 'Votre contrat' : `Contrat de ${baseMeta.ownerName}`} est passé de « ${prev.payoutStatus} » à « En attente » (${formatMad(amount)} hors cumul).`;
          rarity = 'rare';
        }

        created.push({
          id: `notif_ctr_status_${c.id}_${c.payoutStatus}_${stamp}`,
          kind: 'contract_status_changed',
          badgeId: `contract_${c.payoutStatus.toLowerCase()}`,
          title,
          message,
          rarity,
          xpBoost: 0,
          createdAt: nowIso,
          read: false,
          targetTab: 'team',
          contractMeta: {
            ...baseMeta,
            previousStatus: prev.payoutStatus,
          },
        });
      }
      continue;
    }

    if (prev.payoutMad !== amount && c.payoutStatus !== 'Refusé') {
      if (isOwner || options.canSuperviseTeam) {
        created.push({
          id: `notif_ctr_payout_${c.id}_${amount}_${stamp}`,
          kind: 'contract_status_changed',
          badgeId: 'contract_payout_updated',
          title: `Payout ajusté : ${baseMeta.societe}`,
          message: `Commission ${isOwner ? '' : `de ${baseMeta.ownerName} `}ajustée de ${formatMad(prev.payoutMad)} à ${formatMad(amount)} (${c.payoutStatus}).`,
          rarity: 'rare',
          xpBoost: 0,
          createdAt: nowIso,
          read: false,
          targetTab: 'team',
          contractMeta: baseMeta,
        });
      }
    }
  }

  return {
    nextBaseline: {
      initialized: true,
      byId: nextById,
    },
    created,
  };
}

export function mapCloudNotificationDocToAppNotification(
  doc: SanitizedCloudNotificationDoc
): AppNotification {
  const rarityByKind: Record<SanitizedCloudNotificationDoc['kind'], BadgeRarity> = {
    fiche_assigned: 'epique',
    fiche_accessed: 'peu_commun',
    fiche_restored: 'rare',
    fiche_updated: 'commun',
    contract_signed: 'epique',
    contract_status_changed:
      doc.payoutStatus === 'Versé'
        ? 'legendaire'
        : doc.payoutStatus === 'Validé'
          ? 'epique'
          : doc.payoutStatus === 'Refusé'
            ? 'commun'
            : 'rare',
    direct_message: 'rare',
    coaching_invite: 'legendaire',
  };

  const isContractKind = doc.kind === 'contract_signed' || doc.kind === 'contract_status_changed';

  return {
    id: `cloud_${doc.id}`,
    cloudDocId: doc.id,
    kind: doc.kind,
    badgeId: doc.kind,
    title: doc.title,
    message: doc.message,
    rarity: rarityByKind[doc.kind] || 'rare',
    xpBoost: 0,
    createdAt: doc.createdAtIso,
    read: Boolean(doc.read),
    targetTab:
      doc.targetTab ||
      (isContractKind || doc.kind === 'fiche_accessed' ? 'team' : 'crm'),
    contractMeta: isContractKind
      ? {
          contractId: doc.id,
          ownerId: doc.ficheOwnerId || doc.recipientUid,
          ownerName: doc.senderName,
          societe: doc.societe || doc.title,
          produitOrangePro: 'Orange Pro',
          payoutMad: typeof doc.payoutMad === 'number' ? doc.payoutMad : 0,
          payoutStatus: doc.payoutStatus || 'En attente',
        }
      : undefined,
    ficheMeta: doc.ficheId
      ? {
          ficheId: doc.ficheId,
          ficheOwnerId: doc.ficheOwnerId || doc.recipientUid,
          numeroFiche: doc.numeroFiche,
          societe: doc.societe || doc.title,
          actorUid: doc.senderUid,
          actorName: doc.senderName,
          actorRole: doc.senderRole,
        }
      : undefined,
  };
}

export function mergeNotificationsFeed(
  existing: AppNotification[],
  incoming: AppNotification[]
): AppNotification[] {
  if (incoming.length === 0) return existing.slice(0, MAX_NOTIFICATIONS);
  const combined = [...incoming, ...existing];
  const seen = new Set<string>();
  const deduped: AppNotification[] = [];
  for (const item of combined) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
    if (deduped.length >= MAX_NOTIFICATIONS) break;
  }
  deduped.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return deduped.slice(0, MAX_NOTIFICATIONS);
}

export function countUnreadNotifications(list: AppNotification[]): number {
  let count = 0;
  for (const n of list) {
    if (!n.read) count++;
  }
  return count;
}

export function markAllNotificationsRead(list: AppNotification[]): AppNotification[] {
  return list.map((n) => (n.read ? n : { ...n, read: true }));
}

export interface NotificationSoundProfile {
  profileKey: string;
  label: string;
  waveform: OscillatorType;
  notesHz: number[];
  stepSec: number;
  noteDurationSec: number;
  gainPeak: number;
}

export function getNotificationSoundProfile(
  kind: NotificationKind,
  payoutStatus?: PayoutStatus
): NotificationSoundProfile {
  if (kind === 'contract_status_changed') {
    if (payoutStatus === 'Refusé') {
      return {
        profileKey: 'contract_refused',
        label: 'Alerte contrat refusé',
        waveform: 'sawtooth',
        notesHz: [392.0, 329.63, 246.94], // G4 -> E4 -> B3 descending alert
        stepSec: 0.11,
        noteDurationSec: 0.24,
        gainPeak: 0.045,
      };
    }
    if (payoutStatus === 'Versé') {
      return {
        profileKey: 'contract_verse',
        label: 'Carillon payout versé',
        waveform: 'sine',
        notesHz: [1046.5, 1318.51, 1567.98, 2093.0], // C6 -> E6 -> G6 -> C7 bright payout chime
        stepSec: 0.065,
        noteDurationSec: 0.28,
        gainPeak: 0.065,
      };
    }
    if (payoutStatus === 'Validé') {
      return {
        profileKey: 'contract_valide',
        label: 'Accord contrat validé',
        waveform: 'triangle',
        notesHz: [587.33, 739.99, 880.0], // D5 -> F#5 -> A5 major confirmation
        stepSec: 0.08,
        noteDurationSec: 0.26,
        gainPeak: 0.07,
      };
    }
    return {
      profileKey: 'contract_en_attente',
      label: 'Signal contrat en attente',
      waveform: 'sine',
      notesHz: [440.0, 554.37], // A4 -> C#5 neutral two-tone
      stepSec: 0.1,
      noteDurationSec: 0.2,
      gainPeak: 0.055,
    };
  }

  switch (kind) {
    case 'contract_signed':
      return {
        profileKey: 'contract_signed',
        label: 'Fanfare signature contrat',
        waveform: 'triangle',
        notesHz: [659.25, 830.61, 987.77, 1318.51], // E5 -> G#5 -> B5 -> E6
        stepSec: 0.07,
        noteDurationSec: 0.3,
        gainPeak: 0.075,
      };
    case 'fiche_assigned':
      return {
        profileKey: 'fiche_assigned',
        label: 'Carillon nouvelle fiche attribuée',
        waveform: 'triangle',
        notesHz: [698.46, 880.0, 1046.5], // F5 -> A5 -> C6 energetic dispatch chime
        stepSec: 0.075,
        noteDurationSec: 0.24,
        gainPeak: 0.07,
      };
    case 'fiche_accessed':
      return {
        profileKey: 'fiche_accessed',
        label: 'Impulsion accès fiche collaborateur',
        waveform: 'sine',
        notesHz: [493.88, 622.25], // B4 -> D#5 crisp subtle radar ping
        stepSec: 0.06,
        noteDurationSec: 0.16,
        gainPeak: 0.05,
      };
    case 'fiche_restored':
      return {
        profileKey: 'fiche_restored',
        label: 'Déverrouillage fiche restituée',
        waveform: 'sine',
        notesHz: [587.33, 783.99, 987.77], // D5 -> G5 -> B5 warm unlock triad
        stepSec: 0.09,
        noteDurationSec: 0.26,
        gainPeak: 0.065,
      };
    case 'fiche_updated':
      return {
        profileKey: 'fiche_updated',
        label: 'Notification mise à jour fiche',
        waveform: 'sine',
        notesHz: [783.99, 659.25], // G5 -> E5 soft update
        stepSec: 0.07,
        noteDurationSec: 0.15,
        gainPeak: 0.045,
      };
    case 'role_badge_awarded':
      return {
        profileKey: 'role_badge_awarded',
        label: 'Fanfare badge de rôle',
        waveform: 'triangle',
        notesHz: [392.0, 493.88, 587.33, 783.99], // G4 -> B4 -> D5 -> G5 noble brassy triad
        stepSec: 0.095,
        noteDurationSec: 0.32,
        gainPeak: 0.075,
      };
    case 'direct_message':
      return {
        profileKey: 'direct_message',
        label: 'Message direct Direction',
        waveform: 'sine',
        notesHz: [622.25, 932.33], // D#5 -> A#5 crisp chat pop
        stepSec: 0.055,
        noteDurationSec: 0.17,
        gainPeak: 0.06,
      };
    case 'coaching_invite':
      return {
        profileKey: 'coaching_invite',
        label: 'Invitation Coaching Terrain Live',
        waveform: 'triangle',
        notesHz: [523.25, 783.99, 1046.5, 1567.98], // C5 -> G5 -> C6 -> G6 resonant call chime
        stepSec: 0.085,
        noteDurationSec: 0.28,
        gainPeak: 0.075,
      };
    case 'distinction_awarded':
      return {
        profileKey: 'distinction_awarded',
        label: 'Carillon distinction officielle',
        waveform: 'sine',
        notesHz: [880.0, 1108.73, 1318.51, 1760.0], // A5 -> C#6 -> E6 -> A6 sparkling bell
        stepSec: 0.065,
        noteDurationSec: 0.3,
        gainPeak: 0.065,
      };
    case 'achievement_unlocked':
    default:
      return {
        profileKey: 'achievement_unlocked',
        label: 'Mélodie succès débloqué',
        waveform: 'sine',
        notesHz: [523.25, 659.25, 783.99], // C5 -> E5 -> G5 major triad
        stepSec: 0.08,
        noteDurationSec: 0.25,
        gainPeak: 0.07,
      };
  }
}

export function playNotificationSound(
  kind: NotificationKind,
  payoutStatus?: PayoutStatus
): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const profile = getNotificationSoundProfile(kind, payoutStatus);

    profile.notesHz.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = profile.waveform;
      osc.frequency.value = freq;
      const start = ctx.currentTime + idx * profile.stepSec;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(profile.gainPeak, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + profile.noteDurationSec);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + profile.noteDurationSec + 0.02);
    });
  } catch {
    // Audio playback blocked or unsupported; ignore safely
  }
}

export function playCelebrationChime(): void {
  playNotificationSound('achievement_unlocked');
}

export type PushNotificationStatus = NotificationPermission | 'unsupported';

export function getPushNotificationStatus(): PushNotificationStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return window.Notification.permission;
}

export async function requestPushNotificationPermission(): Promise<PushNotificationStatus> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (window.Notification.permission === 'granted') {
    return 'granted';
  }
  try {
    return await window.Notification.requestPermission();
  } catch {
    return window.Notification.permission;
  }
}

export function triggerBrowserPushNotification(notification: AppNotification): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (window.Notification.permission !== 'granted') return;
  try {
    const push = new window.Notification(notification.title, {
      body: notification.message,
      tag: `orange_pro_${notification.id}`,
    });
    window.setTimeout(() => {
      try {
        push.close();
      } catch {
        // Ignore close error
      }
    }, 6500);
  } catch {
    // Some browsers require service-worker registration for Notification; toast fallback handles it gracefully
  }
}
