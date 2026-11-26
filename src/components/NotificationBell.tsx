import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  CheckCheck,
  X,
  FileCheck2,
  Wallet,
  XCircle,
  Clock,
} from 'lucide-react';
import { RARITY_META, formatMad } from '../utils/gamification';
import { countUnreadNotifications, type AppNotification } from '../utils/notifications';
import { BadgeArtwork } from './BadgeArtwork';

interface NotificationBellProps {
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  onOpenBadges: () => void;
  onOpenTeam?: () => void;
}

function renderNotificationIcon(n: AppNotification) {
  if (n.kind === 'contract_signed') {
    return (
      <div className="w-9 h-9 rounded-xl border border-orange-200 bg-orange-50 text-orange-700 flex items-center justify-center shrink-0">
        <FileCheck2 className="w-4 h-4" />
      </div>
    );
  }
  if (n.kind === 'contract_status_changed') {
    const status = n.contractMeta?.payoutStatus;
    if (status === 'Refusé') {
      return (
        <div className="w-9 h-9 rounded-xl border border-red-200 bg-red-50 text-red-700 flex items-center justify-center shrink-0">
          <XCircle className="w-4 h-4" />
        </div>
      );
    }
    if (status === 'Versé') {
      return (
        <div className="w-9 h-9 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
          <Wallet className="w-4 h-4" />
        </div>
      );
    }
    if (status === 'Validé') {
      return (
        <div className="w-9 h-9 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
          <FileCheck2 className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-9 h-9 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
        <Clock className="w-4 h-4" />
      </div>
    );
  }
  return <BadgeArtwork badgeId={n.badgeId} rarity={n.rarity} size="sm" />;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
  onMarkAllRead,
  onOpenBadges,
  onOpenTeam,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const unread = countUnreadNotifications(notifications);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('fr-FR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications (${unread} non lues)`}
        aria-expanded={open}
        data-testid="notification-bell-btn"
        className={`relative p-2 rounded-lg border text-xs transition-colors ${
          open || unread > 0
            ? 'border-orange-300 bg-orange-50 text-orange-900 hover:bg-orange-100'
            : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
        }`}
        title="Notifications (contrats, payouts, succès & badges)"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-600 text-white text-[10px] font-extrabold flex items-center justify-center shadow-xs tabular-nums">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="notification-dropdown"
          className="fixed inset-x-2.5 top-14 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 max-w-[calc(100vw-1.25rem)] rounded-xl sm:rounded-2xl border border-stone-200 bg-white shadow-xl z-50 overflow-hidden"
        >
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 border-b border-stone-100 flex items-center justify-between gap-2 bg-stone-50/70">
            <div className="min-w-0">
              <h3 className="text-xs font-extrabold text-stone-900 truncate">
                Notifications, Contrats &amp; Succès
              </h3>
              <p className="text-[10px] sm:text-[11px] text-stone-500">
                {unread > 0 ? `${unread} nouvelle${unread > 1 ? 's' : ''} alerte${unread > 1 ? 's' : ''}` : 'Tout est à jour'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700 hover:underline"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Tout marquer lu
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer les notifications"
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-[58vh] sm:max-h-80 overflow-y-auto divide-y divide-stone-100">
            {notifications.length === 0 ? (
              <div className="px-3.5 py-6 sm:px-4 sm:py-8 text-center text-xs text-stone-500">
                Aucune notification pour le moment. Vous serez alerté dès qu’un contrat est signé, qu’un statut payout change ou qu’un succès se débloque.
              </div>
            ) : (
              notifications.map((n) => {
                const isContractNotif =
                  n.kind === 'contract_signed' || n.kind === 'contract_status_changed';
                const meta = RARITY_META[n.rarity] || RARITY_META.rare;
                const status = n.contractMeta?.payoutStatus;
                const statusTextCls =
                  status === 'Refusé'
                    ? 'text-red-700'
                    : status === 'Versé'
                      ? 'text-emerald-700'
                      : status === 'Validé'
                        ? 'text-sky-700'
                        : 'text-orange-700';

                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      onMarkAllRead();
                      setOpen(false);
                      if ((isContractNotif || n.targetTab === 'team') && onOpenTeam) {
                        onOpenTeam();
                      } else {
                        onOpenBadges();
                      }
                    }}
                    className={`w-full text-left px-3 py-2.5 sm:px-4 sm:py-3 flex items-start gap-2.5 hover:bg-stone-50 transition-colors ${
                      n.read ? 'bg-white' : 'bg-orange-50/40'
                    }`}
                  >
                    {renderNotificationIcon(n)}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-stone-900 truncate">{n.title}</span>
                        {isContractNotif && n.contractMeta ? (
                          <span className={`text-[10px] font-bold shrink-0 tabular-nums ${statusTextCls}`}>
                            {status === 'Refusé' ? '0 MAD' : formatMad(n.contractMeta.payoutMad)}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-orange-700 shrink-0 tabular-nums">
                            +{n.xpBoost} XP
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-stone-600 line-clamp-2 mt-0.5">{n.message}</p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-stone-400">
                        {isContractNotif ? (
                          <span className={`font-bold ${statusTextCls}`}>
                            {n.kind === 'contract_signed'
                              ? 'Signature contrat'
                              : `Statut : ${status || 'Mis à jour'}`}
                          </span>
                        ) : (
                          <span className={`px-1.5 py-0.2 rounded font-bold ${meta.pillBg} ${meta.pillText}`}>
                            {meta.label}
                          </span>
                        )}
                        <span>·</span>
                        <span>{formatTime(n.createdAt)}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="px-3 py-2 sm:px-4 sm:py-2.5 border-t border-stone-100 bg-stone-50/70 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenBadges();
              }}
              className="text-xs font-bold text-orange-700 hover:underline"
            >
              Succès &amp; badges →
            </button>
            {onOpenTeam && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenTeam();
                }}
                className="text-xs font-bold text-stone-700 hover:text-stone-900 hover:underline"
              >
                Équipe &amp; Payouts →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
