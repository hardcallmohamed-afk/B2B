import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { RARITY_META } from '../utils/gamification';
import type { AppNotification } from '../utils/notifications';
import { BadgeArtwork, resolveBadgeMeta } from './BadgeArtwork';

interface AchievementToastProps {
  notification: AppNotification | null;
  queueCount?: number;
  onDismiss: () => void;
  onOpenBadges: () => void;
}

export const AchievementToast: React.FC<AchievementToastProps> = ({
  notification,
  queueCount = 1,
  onDismiss,
  onOpenBadges,
}) => {
  if (!notification) return null;

  const meta = RARITY_META[notification.rarity];
  const resolved = resolveBadgeMeta(notification.badgeId);
  const badgeName = resolved?.title || notification.title;

  const kicker =
    notification.kind === 'role_badge_awarded'
      ? 'Nouveau Badge de Rôle !'
      : notification.kind === 'distinction_awarded'
        ? 'Nouvelle Distinction !'
        : 'Succès Débloqué !';

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="achievement-unlock-toast"
      className="fixed top-2 inset-x-2.5 sm:inset-x-auto sm:top-3.5 sm:right-4 z-[60] sm:w-88 max-w-sm rounded-xl sm:rounded-2xl border border-orange-300 bg-white shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-3 duration-200"
    >
      <div className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 flex items-center justify-between text-[10px] sm:text-[11px] font-extrabold ${meta.headerBg} ${meta.headerText}`}>
        <span className="inline-flex items-center gap-1">
          <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          {kicker}
        </span>
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          {queueCount > 1 && (
            <span className="rounded bg-black/15 px-1.5 py-0.2 text-[9px] sm:text-[10px]">
              1/{queueCount}
            </span>
          )}
          <span>+{notification.xpBoost} XP</span>
        </span>
      </div>

      <div className="p-2.5 sm:p-3.5 flex items-start gap-2.5 sm:gap-3">
        <div className="sm:hidden shrink-0">
          <BadgeArtwork badgeId={notification.badgeId} rarity={notification.rarity} size="sm" />
        </div>
        <div className="hidden sm:block shrink-0">
          <BadgeArtwork badgeId={notification.badgeId} rarity={notification.rarity} size="md" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] sm:text-xs font-extrabold text-stone-900 leading-snug truncate max-w-[200px] sm:max-w-none">
              {badgeName}
            </span>
            <span className={`rounded px-1.5 py-0.2 text-[9px] font-extrabold ${meta.pillBg} ${meta.pillText}`}>
              {meta.label}
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] text-stone-600 mt-0.5 leading-snug line-clamp-2">
            {notification.message}
          </p>
          <div className="mt-1.5 sm:mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                onDismiss();
                onOpenBadges();
              }}
              className="text-[10px] sm:text-[11px] font-bold text-orange-700 hover:underline"
            >
              Voir mes succès →
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
