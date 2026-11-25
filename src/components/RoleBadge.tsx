import React from 'react';
import { ROLE_BADGE_META, type TeamRole } from '../utils/gamification';
import { BadgeArtwork } from './BadgeArtwork';

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

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[11px] gap-1.5 rounded-lg'
      : 'px-1.5 py-0.5 text-[10px] gap-1 rounded-md';

  return (
    <span
      data-testid={`role-badge-${role}`}
      className={`inline-flex items-center font-bold whitespace-nowrap ${meta.className} ${sizeClasses} ${className}`.trim()}
      title={`${meta.label} — ${meta.description}`}
    >
      <BadgeArtwork role={role} size="xs" />
      <span>{showShort ? meta.shortLabel : meta.label}</span>
    </span>
  );
};

