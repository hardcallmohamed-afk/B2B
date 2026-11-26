import {
  formatMad,
  type BadgeRarity,
  type EvaluatedAchievement,
  type PayoutStatus,
  type SignedContractRecord,
} from './gamification';

export type NotificationKind =
  | 'achievement_unlocked'
  | 'role_badge_awarded'
  | 'distinction_awarded'
  | 'contract_signed'
  | 'contract_status_changed';

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
  targetTab?: 'badges' | 'team';
  contractMeta?: ContractNotificationMeta;
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

const MAX_NOTIFICATIONS = 40;

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
          message = `${isOwner ? 'Votre contrat' : `Contrat de ${baseMeta.ownerName}`} est validé pour ${formatMad(amount)}.`;
          rarity = 'epique';
        } else if (c.payoutStatus === 'En attente') {
          title = `Contrat remis en attente : ${baseMeta.societe}`;
          message = `${isOwner ? 'Votre contrat' : `Contrat de ${baseMeta.ownerName}`} est passé de « ${prev.payoutStatus} » à « En attente » (${formatMad(amount)}).`;
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
  return deduped;
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

export function playCelebrationChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99]; // C5 -> E5 -> G5 soft major triad
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + idx * 0.08;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.07, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.26);
    });
  } catch {
    // Audio playback blocked or unsupported; ignore safely
  }
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

