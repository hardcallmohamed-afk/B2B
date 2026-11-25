import React, { useEffect, useRef, useState } from 'react';
import { Award, Bell, CheckCheck, ShieldCheck, Trophy } from 'lucide-react';
import { RARITY_META } from '../utils/gamification';
import { countUnreadNotifications, type AppNotification } from '../utils/notifications';

interface NotificationBellProps {
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  onOpenBadges: () => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
  onMarkAllRead,
  onOpenBadges,
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
        title="Notifications (succès & badges)"
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
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-stone-200 bg-white shadow-xl z-50 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between gap-2 bg-stone-50/70">
            <div>
              <h3 className="text-xs font-extrabold text-stone-900">Notifications &amp; Succès</h3>
              <p className="text-[11px] text-stone-500">
                {unread > 0 ? `${unread} nouvelle${unread > 1 ? 's' : ''} alerte${unread > 1 ? 's' : ''}` : 'Tout est à jour'}
              </p>
            </div>
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
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-stone-100">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-stone-500">
                Aucune notification pour le moment. Vous serez alerté dès qu’un succès se débloque ou qu’un badge vous est attribué.
              </div>
            ) : (
              notifications.map((n) => {
                const meta = RARITY_META[n.rarity];
                const Icon =
                  n.kind === 'role_badge_awarded'
                    ? ShieldCheck
                    : n.kind === 'distinction_awarded'
                      ? Award
                      : Trophy;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      onMarkAllRead();
                      setOpen(false);
                      onOpenBadges();
                    }}
                    className={`w-full text-left px-4 py-3 flex items-start gap-2.5 hover:bg-stone-50 transition-colors ${
                      n.read ? 'bg-white' : 'bg-orange-50/40'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.headerBg} ${meta.headerText}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-stone-900 truncate">{n.title}</span>
                        <span className="text-[10px] font-bold text-orange-700 shrink-0 tabular-nums">
                          +{n.xpBoost} XP
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-600 line-clamp-2 mt-0.5">{n.message}</p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-stone-400">
                        <span className={`px-1.5 py-0.2 rounded font-bold ${meta.pillBg} ${meta.pillText}`}>
                          {meta.label}
                        </span>
                        <span>{formatTime(n.createdAt)}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-stone-100 bg-stone-50/70 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenBadges();
              }}
              className="text-xs font-bold text-orange-700 hover:underline"
            >
              Ouvrir tous mes succès &amp; badges →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
