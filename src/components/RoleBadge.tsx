import React from 'react';
import { Briefcase, Crown, ShieldCheck, UserCog, Users } from 'lucide-react';
import { ROLE_BADGE_META, type TeamRole } from '../utils/gamification';

interface RoleBadgeProps {
  role: TeamRole;
  size?: 'xs' | 'sm';
  showShort?: boolean;
  className?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({
  role,
  size = 'xs',
  showShort = false,
  className = '',
}) => {
  const meta = ROLE_BADGE_META[role] || ROLE_BADGE_META.commercial;
  const Icon =
    role === 'super_admin'
      ? ShieldCheck
      : role === 'manager'
        ? UserCog
        : role === 'team_lead'
          ? Users
          : role === 'grand_compte'
            ? Crown
            : Briefcase;

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[11px] gap-1.5 rounded-lg'
      : 'px-1.5 py-0.5 text-[10px] gap-1 rounded-md';

  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-3 h-3';

  return (
    <span
      data-testid={`role-badge-${role}`}
      className={`inline-flex items-center font-bold whitespace-nowrap ${meta.className} ${sizeClasses} ${className}`.trim()}
      title={`${meta.label} — ${meta.description}`}
    >
      <Icon className={`${iconSize} shrink-0`} />
      <span>{showShort ? meta.shortLabel : meta.label}</span>
    </span>
  );
};

