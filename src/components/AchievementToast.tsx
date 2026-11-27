import React from 'react';
import {
  Sparkles,
  X,
  FileCheck2,
  Wallet,
  XCircle,
  Clock,
  UserPlus,
  Eye,
  RotateCcw,
  Pencil,
  MessageCircle,
  Headphones,
} from 'lucide-react';
import { RARITY_META, formatMad } from '../utils/gamification';
import type { AppNotification } from '../utils/notifications';
import { isSupervisorRole } from '../utils/authAccess';
import { BadgeArtwork, resolveBadgeMeta } from './BadgeArtwork';

interface AchievementToastProps {
  notification: AppNotification | null;
  currentUserRole?: string;
  queueCount?: number;
  onDismiss: () => void;
  onOpenBadges: () => void;
  onOpenTeam?: () => void;
  onOpenCrm?: () => void;
  onSelectNotification?: (notification: AppNotification) => void;
}

export const AchievementToast: React.FC<AchievementToastProps> = ({
  notification,
  currentUserRole,
  queueCount = 1,
  onDismiss,
  onOpenBadges,
  onOpenTeam,
  onOpenCrm,
  onSelectNotification,
}) => {
  const canViewSupervision = isSupervisorRole(currentUserRole);
  if (!notification) return null;

  const isContractNotif =
    notification.kind === 'contract_signed' || notification.kind === 'contract_status_changed';
  const isFicheNotif =
    notification.kind === 'fiche_assigned' ||
    notification.kind === 'fiche_accessed' ||
    notification.kind === 'fiche_restored' ||
    notification.kind === 'fiche_updated';
  const isDirectComm =
    notification.kind === 'direct_message' || notification.kind === 'coaching_invite';
  const status = notification.contractMeta?.payoutStatus;
  const meta = RARITY_META[notification.rarity] || RARITY_META.rare;
  const resolved = resolveBadgeMeta(notification.badgeId);
  const displayTitle =
    isContractNotif || isFicheNotif || isDirectComm
      ? notification.title
      : resolved?.title || notification.title;

  let headerBg = meta.headerBg;
  let headerText = meta.headerText;
  let borderCls = 'border-orange-300';
  let kicker =
    notification.kind === 'role_badge_awarded'
      ? 'Nouveau Badge de Rôle !'
      : notification.kind === 'distinction_awarded'
        ? 'Nouvelle Distinction !'
        : 'Succès Débloqué !';

  if (notification.kind === 'direct_message') {
    headerBg = 'bg-sky-600';
    headerText = 'text-white';
    borderCls = 'border-sky-300';
    kicker = 'Message Direct Direction';
  } else if (notification.kind === 'coaching_invite') {
    headerBg = 'bg-emerald-600';
    headerText = 'text-white';
    borderCls = 'border-emerald-300';
    kicker = 'Coaching Terrain Live';
  } else if (notification.kind === 'fiche_assigned') {
    headerBg = 'bg-orange-600';
    headerText = 'text-white';
    borderCls = 'border-orange-300';
    kicker = 'Nouvelle Fiche Attribuée !';
  } else if (notification.kind === 'fiche_accessed') {
    headerBg = 'bg-sky-600';
    headerText = 'text-white';
    borderCls = 'border-sky-300';
    kicker = 'Fiche Consultée par un Collaborateur';
  } else if (notification.kind === 'fiche_restored') {
    headerBg = 'bg-violet-600';
    headerText = 'text-white';
    borderCls = 'border-violet-300';
    kicker = 'Fiche Signée Restituée !';
  } else if (notification.kind === 'fiche_updated') {
    headerBg = 'bg-amber-600';
    headerText = 'text-white';
    borderCls = 'border-amber-300';
    kicker = 'Fiche Mise à Jour';
  } else if (notification.kind === 'contract_signed') {
    headerBg = 'bg-orange-600';
    headerText = 'text-white';
    borderCls = 'border-orange-300';
    kicker = 'Nouveau Contrat Signé !';
  } else if (notification.kind === 'contract_status_changed') {
    if (status === 'Refusé') {
      headerBg = 'bg-red-600';
      headerText = 'text-white';
      borderCls = 'border-red-300';
      kicker = 'Statut Contrat : Refusé';
    } else if (status === 'Versé') {
      headerBg = 'bg-emerald-600';
      headerText = 'text-white';
      borderCls = 'border-emerald-300';
      kicker = 'Payout Versé !';
    } else if (status === 'Validé') {
      headerBg = 'bg-sky-600';
      headerText = 'text-white';
      borderCls = 'border-sky-300';
      kicker = 'Contrat Validé !';
    } else {
      headerBg = 'bg-amber-500';
      headerText = 'text-white';
      borderCls = 'border-amber-300';
      kicker = 'Statut Contrat Mis à Jour';
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="achievement-unlock-toast"
      className={`fixed top-2 inset-x-2.5 sm:inset-x-auto sm:top-3.5 sm:right-4 z-[60] sm:w-88 max-w-sm rounded-xl sm:rounded-2xl border ${borderCls} bg-white shadow-lg overflow-hidden op-animate-toast-in`}
    >
      <div
        className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 flex items-center justify-between text-[10px] sm:text-[11px] font-extrabold ${headerBg} ${headerText}`}
      >
        <span className="inline-flex items-center gap-1">
          {notification.kind === 'fiche_assigned' ? (
            <UserPlus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          ) : notification.kind === 'fiche_accessed' ? (
            <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          ) : notification.kind === 'fiche_restored' ? (
            <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          ) : notification.kind === 'fiche_updated' ? (
            <Pencil className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          ) : isContractNotif ? (
            status === 'Refusé' ? (
              <XCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            ) : status === 'Versé' ? (
              <Wallet className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            ) : (
              <FileCheck2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            )
          ) : (
            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          )}
          {kicker}
        </span>
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          {queueCount > 1 && (
            <span className="rounded bg-black/15 px-1.5 py-0.5 text-[9px] sm:text-[10px]">
              1/{queueCount}
            </span>
          )}
          {isContractNotif && notification.contractMeta ? (
            <span>
              {status === 'Refusé' ? '0 MAD' : formatMad(notification.contractMeta.payoutMad)}
            </span>
          ) : isFicheNotif ? (
            <span>{notification.ficheMeta?.numeroFiche || 'CRM'}</span>
          ) : isDirectComm ? (
            <span>{notification.kind === 'coaching_invite' ? 'Live' : 'Chat'}</span>
          ) : (
            <span>+{notification.xpBoost} XP</span>
          )}
        </span>
      </div>

      <div className="p-2.5 sm:p-3.5 flex items-start gap-2.5 sm:gap-3">
        {isDirectComm ? (
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
              notification.kind === 'coaching_invite'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-sky-200 bg-sky-50 text-sky-700'
            }`}
          >
            {notification.kind === 'coaching_invite' ? (
              <Headphones className="w-5 h-5" />
            ) : (
              <MessageCircle className="w-5 h-5" />
            )}
          </div>
        ) : isFicheNotif ? (
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
              notification.kind === 'fiche_assigned'
                ? 'border-orange-200 bg-orange-50 text-orange-700'
                : notification.kind === 'fiche_accessed'
                  ? 'border-sky-200 bg-sky-50 text-sky-700'
                  : notification.kind === 'fiche_restored'
                    ? 'border-violet-200 bg-violet-50 text-violet-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
            }`}
          >
            {notification.kind === 'fiche_assigned' ? (
              <UserPlus className="w-5 h-5" />
            ) : notification.kind === 'fiche_accessed' ? (
              <Eye className="w-5 h-5" />
            ) : notification.kind === 'fiche_restored' ? (
              <RotateCcw className="w-5 h-5" />
            ) : (
              <Pencil className="w-5 h-5" />
            )}
          </div>
        ) : isContractNotif ? (
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
              status === 'Refusé'
                ? 'border-red-200 bg-red-50 text-red-700'
                : status === 'Versé'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : status === 'Validé'
                    ? 'border-sky-200 bg-sky-50 text-sky-700'
                    : notification.kind === 'contract_signed'
                      ? 'border-orange-200 bg-orange-50 text-orange-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
            }`}
          >
            {status === 'Refusé' ? (
              <XCircle className="w-5 h-5" />
            ) : status === 'Versé' ? (
              <Wallet className="w-5 h-5" />
            ) : status === 'En attente' && notification.kind === 'contract_status_changed' ? (
              <Clock className="w-5 h-5" />
            ) : (
              <FileCheck2 className="w-5 h-5" />
            )}
          </div>
        ) : (
          <>
            <div className="sm:hidden shrink-0">
              <BadgeArtwork badgeId={notification.badgeId} rarity={notification.rarity} size="sm" />
            </div>
            <div className="hidden sm:block shrink-0">
              <BadgeArtwork badgeId={notification.badgeId} rarity={notification.rarity} size="md" />
            </div>
          </>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] sm:text-xs font-extrabold text-stone-900 leading-snug truncate max-w-[200px] sm:max-w-none">
              {displayTitle}
            </span>
            {!isContractNotif && !isFicheNotif && !isDirectComm && (
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold ${meta.pillBg} ${meta.pillText}`}>
                {meta.label}
              </span>
            )}
          </div>
          <p className="text-[10px] sm:text-[11px] text-stone-600 mt-0.5 leading-snug line-clamp-2">
            {notification.message}
          </p>
          <div className="mt-1.5 sm:mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                onDismiss();
                if (onSelectNotification) {
                  onSelectNotification(notification);
                  return;
                }
                if (notification.targetTab === 'crm' && onOpenCrm) {
                  onOpenCrm();
                } else if ((isContractNotif || notification.targetTab === 'team') && onOpenTeam) {
                  onOpenTeam();
                } else {
                  onOpenBadges();
                }
              }}
              className="text-[10px] sm:text-[11px] font-bold text-orange-700 hover:underline"
            >
              {isDirectComm
                ? canViewSupervision
                  ? 'Ouvrir Discussion / Coaching →'
                  : 'Ouvrir la discussion →'
                : isFicheNotif
                  ? 'Ouvrir la fiche →'
                  : isContractNotif
                    ? 'Voir Équipe & Payouts →'
                    : 'Voir mes succès →'}
            </button>
            {queueCount > 1 && (
              <button
                type="button"
                onClick={onDismiss}
                className="text-[10px] sm:text-[11px] font-semibold text-stone-500 hover:text-stone-800"
              >
                Suivant ({queueCount - 1}) →
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fermer la notification"
          className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 shrink-0"
        >
          <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
      </div>
    </div>
  );
};
