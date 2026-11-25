import React from 'react';
import { Briefcase, Crown, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { ROLE_BADGE_META, type TeamRole } from '../utils/gamification';

interface RoleBadgeProps {
  role: TeamRole;
  size?: 'xs' | 'sm';
  showShort?: boolean;
  className?: string;
}

const ROLE_ICON_MAP: Record<TeamRole, React.ComponentType<{ className?: string }>> = {
  super_admin: ShieldCheck,
  manager: Crown,
  team_lead: Users,
  grand_compte: Briefcase,
  commercial: UserCheck,
};

export const RoleBadge: React.FC<RoleBadgeProps> = ({
  role,
  size = 'xs',
  showShort = false,
  className = '',
}) => {
  const meta = ROLE_BADGE_META[role] || ROLE_BADGE_META.commercial;
  const Icon = ROLE_ICON_MAP[role] || UserCheck;

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[11px] gap-1.5 rounded-md'
      : 'px-1.5 py-0.5 text-[10px] gap-1 rounded-md';

  const iconSizeCls = size === 'sm' ? 'w-3.5 h-3.5' : 'w-3 h-3';

  return (
    <span
      data-testid={`role-badge-${role}`}
      className={`inline-flex items-center font-semibold whitespace-nowrap shrink-0 ${meta.className} ${sizeClasses} ${className}`.trim()}
      title={`${meta.label} — ${meta.description}`}
    >
      <Icon className={`${iconSizeCls} shrink-0`} aria-hidden="true" />
      <span>{showShort ? meta.shortLabel : meta.label}</span>
    </span>
  );
};


