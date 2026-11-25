import React from 'react';
import { Award, ShieldCheck, Sparkles, Trophy, X } from 'lucide-react';
import { RARITY_META } from '../utils/gamification';
import type { AppNotification } from '../utils/notifications';

interface AchievementToastProps {
  notification: AppNotification | null;
  onDismiss: () => void;
  onOpenBadges: () => void;
}

export const AchievementToast: React.FC<AchievementToastProps> = ({
  notification,
  onDismiss,
  onOpenBadges,
}) => {
  if (!notification) return null;

  const meta = RARITY_META[notification.rarity];
  const Icon =
    notification.kind === 'role_badge_awarded'
      ? ShieldCheck
      : notification.kind === 'distinction_awarded'
        ? Award
        : Trophy;

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
        <span className="tabular-nums">+{notification.xpBoost} XP</span>
      </div>

      <div className="p-3.5 flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.headerBg} ${meta.headerText} shadow-2xs`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-extrabold text-stone-900 leading-snug">
            {notification.title}
          </div>
          <p className="text-[11px] text-stone-600 mt-0.5 leading-snug">
            {notification.message}
          </p>
          <div className="mt-2 flex items-center gap-2">
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
