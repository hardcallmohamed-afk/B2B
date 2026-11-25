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
      className="fixed top-4 right-4 z-[60] w-[calc(100vw-2rem)] max-w-sm rounded-2xl border-2 border-orange-300 bg-white shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-3 duration-200"
    >
      <div className={`px-3.5 py-1.5 flex items-center justify-between text-[11px] font-extrabold ${meta.headerBg} ${meta.headerText}`}>
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          {kicker}
        </span>
        <span className="inline-flex items-center gap-2 tabular-nums">
          {queueCount > 1 && (
            <span className="rounded bg-black/15 px-1.5 py-0.2 text-[10px]">
              1/{queueCount}
            </span>
          )}
          <span>+{notification.xpBoost} XP</span>
        </span>
      </div>

      <div className="p-3.5 flex items-start gap-3">
        <BadgeArtwork badgeId={notification.badgeId} rarity={notification.rarity} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-extrabold text-stone-900 leading-snug">
              {badgeName}
            </span>
            <span className={`rounded px-1.5 py-0.2 text-[9px] font-extrabold ${meta.pillBg} ${meta.pillText}`}>
              {meta.label}
            </span>
          </div>
          <p className="text-[11px] text-stone-600 mt-0.5 leading-snug">
            {notification.message}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                onDismiss();
                onOpenBadges();
              }}
              className="text-[11px] font-bold text-orange-700 hover:underline"
            >
              Voir mes succès →
            </button>
            {queueCount > 1 && (
              <button
                type="button"
                onClick={onDismiss}
                className="text-[11px] font-semibold text-stone-500 hover:text-stone-800"
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
          className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
