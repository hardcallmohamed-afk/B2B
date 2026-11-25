import React, { useId } from 'react';
import {
  ADMIN_DISTINCTION_BADGES,
  RARITY_META,
  type BadgeRarity,
  type TeamRole,
} from '../utils/gamification';

export type BadgeArtworkSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface BadgeArtworkProps {
  badgeId?: string;
  iconKey?: string;
  role?: TeamRole;
  rarity?: BadgeRarity;
  unlocked?: boolean;
  size?: BadgeArtworkSize;
  className?: string;
}

const SIZE_PX: Record<BadgeArtworkSize, number> = {
  xs: 18,
  sm: 24,
  md: 38,
  lg: 60,
  xl: 68,
};

const AUTO_BADGE_ICON_BY_ID: Record<string, { iconKey: string; rarity: BadgeRarity; title: string }> = {
  first_prospect: { iconKey: 'building', rarity: 'commun', title: 'Premier Prospect' },
  prospect_10: { iconKey: 'target', rarity: 'commun', title: 'Chasseur Actif' },
  first_qualified: { iconKey: 'calendar', rarity: 'commun', title: 'Premier RDV / Devis' },
  first_contract: { iconKey: 'award', rarity: 'commun', title: 'Première Signature' },
  multi_contact_3: { iconKey: 'phone', rarity: 'commun', title: 'Réseau Multi-Contacts' },
  payout_500: { iconKey: 'wallet', rarity: 'commun', title: 'Premier Jour de Paie' },
  prospect_30: { iconKey: 'layers', rarity: 'peu_commun', title: 'Bâtisseur de Secteur' },
  qualified_5: { iconKey: 'trending', rarity: 'peu_commun', title: 'Pipeline en Feu' },
  contracts_3: { iconKey: 'medal', rarity: 'peu_commun', title: 'Triplé Orange Pro' },
  first_pme: { iconKey: 'briefcase', rarity: 'peu_commun', title: 'Spécialiste PME' },
  cities_4: { iconKey: 'map', rarity: 'peu_commun', title: 'Couverture Régionale' },
  payout_3000: { iconKey: 'wallet', rarity: 'peu_commun', title: 'Cap des 3 000 MAD' },
  contracts_10: { iconKey: 'star', rarity: 'rare', title: 'Closer Confirmé' },
  first_gc: { iconKey: 'crown', rarity: 'rare', title: 'Chasseur Grand Compte' },
  maturity_20: { iconKey: 'shield', rarity: 'rare', title: 'Chirurgien de la Donnée' },
  prospect_100: { iconKey: 'building', rarity: 'rare', title: 'Centurion B2B' },
  payout_10000: { iconKey: 'wallet', rarity: 'rare', title: 'Club des 10 000 MAD' },
  contracts_25: { iconKey: 'flame', rarity: 'epique', title: 'Machine à Signer' },
  gc_5: { iconKey: 'crown', rarity: 'epique', title: 'Architecte Corporate' },
  qualified_40: { iconKey: 'trending', rarity: 'epique', title: 'Maître du Tunnel' },
  payout_30000: { iconKey: 'wallet', rarity: 'epique', title: 'Top Performer 30k MAD' },
  contracts_50: { iconKey: 'trophy', rarity: 'legendaire', title: 'Légende Orange Pro' },
  gc_15: { iconKey: 'crown', rarity: 'legendaire', title: 'Titan Grand Compte' },
  payout_100000: { iconKey: 'trophy', rarity: 'legendaire', title: 'Bâtisseur d’Empire (100k MAD)' },
};

const ROLE_TO_ICON_AND_RARITY: Record<TeamRole, { iconKey: string; rarity: BadgeRarity }> = {
  super_admin: { iconKey: 'shield', rarity: 'legendaire' },
  manager: { iconKey: 'crown', rarity: 'epique' },
  team_lead: { iconKey: 'layers', rarity: 'epique' },
  grand_compte: { iconKey: 'briefcase', rarity: 'rare' },
  commercial: { iconKey: 'target', rarity: 'rare' },
};

interface PaletteSpec {
  bgStart: string;
  bgEnd: string;
  ring: string;
  accent: string;
  highlight: string;
  dark: string;
}

const RARITY_PALETTES: Record<BadgeRarity, PaletteSpec> = {
  commun: {
    bgStart: '#FEF3C7',
    bgEnd: '#F59E0B',
    ring: '#B45309',
    accent: '#D97706',
    highlight: '#FFFBEB',
    dark: '#78350F',
  },
  peu_commun: {
    bgStart: '#D1FAE5',
    bgEnd: '#10B981',
    ring: '#047857',
    accent: '#059669',
    highlight: '#ECFDF5',
    dark: '#064E3B',
  },
  rare: {
    bgStart: '#DBEAFE',
    bgEnd: '#2563EB',
    ring: '#1D4ED8',
    accent: '#0284C7',
    highlight: '#EFF6FF',
    dark: '#1E3A8A',
  },
  epique: {
    bgStart: '#EDE9FE',
    bgEnd: '#7C3AED',
    ring: '#5B21B6',
    accent: '#9333EA',
    highlight: '#F5F3FF',
    dark: '#4C1D95',
  },
  legendaire: {
    bgStart: '#FFEDD5',
    bgEnd: '#EA580C',
    ring: '#C2410C',
    accent: '#F59E0B',
    highlight: '#FFF7ED',
    dark: '#7C2D12',
  },
};

const LOCKED_PALETTE: PaletteSpec = {
  bgStart: '#E7E5E4',
  bgEnd: '#A8A29E',
  ring: '#78716C',
  accent: '#57534E',
  highlight: '#F5F5F4',
  dark: '#292524',
};

export function resolveBadgeMeta(badgeId?: string): {
  id: string;
  title: string;
  iconKey: string;
  rarity: BadgeRarity;
} | null {
  if (!badgeId) return null;
  const adminDef = ADMIN_DISTINCTION_BADGES.find((b) => b.id === badgeId);
  if (adminDef) {
    return {
      id: adminDef.id,
      title: adminDef.title,
      iconKey: adminDef.iconKey,
      rarity: adminDef.rarity,
    };
  }
  const autoDef = AUTO_BADGE_ICON_BY_ID[badgeId];
  if (autoDef) {
    return {
      id: badgeId,
      title: autoDef.title,
      iconKey: autoDef.iconKey,
      rarity: autoDef.rarity,
    };
  }
  return null;
}

export const BadgeArtwork: React.FC<BadgeArtworkProps> = ({
  badgeId,
  iconKey,
  role,
  rarity,
  unlocked = true,
  size = 'md',
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const resolved = resolveBadgeMeta(badgeId);
  const roleInfo = role ? ROLE_TO_ICON_AND_RARITY[role] : undefined;

  const finalIconKey = iconKey || resolved?.iconKey || roleInfo?.iconKey || 'award';
  const finalRarity: BadgeRarity = rarity || resolved?.rarity || roleInfo?.rarity || 'commun';
  const palette = unlocked ? RARITY_PALETTES[finalRarity] : LOCKED_PALETTE;
  const px = SIZE_PX[size];
  const isMini = size === 'xs' || size === 'sm';

  const renderIllustration = () => {
    switch (finalIconKey) {
      case 'crown':
        return (
          <g>
            {/* Sunburst behind crown */}
            <circle cx="32" cy="32" r="20" fill={palette.highlight} opacity="0.35" />
            {/* Crown base & peaks */}
            <path
              d="M14 42L11 22L22 30L32 16L42 30L53 22L50 42Z"
              fill={unlocked ? '#FBBF24' : '#D6D3D1'}
              stroke={palette.dark}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <rect
              x="14"
              y="41"
              width="36"
              height="6"
              rx="2.5"
              fill={palette.accent}
              stroke={palette.dark}
              strokeWidth="2"
            />
            {/* Gems */}
            <circle cx="32" cy="15" r="3" fill={unlocked ? '#F97316' : '#A8A29E'} stroke={palette.dark} strokeWidth="1.5" />
            <circle cx="11" cy="21" r="2.5" fill={palette.highlight} stroke={palette.dark} strokeWidth="1.4" />
            <circle cx="53" cy="21" r="2.5" fill={palette.highlight} stroke={palette.dark} strokeWidth="1.4" />
            <circle cx="32" cy="33" r="3" fill={unlocked ? '#EF4444' : '#78716C'} />
            <circle cx="22" cy="36" r="2" fill={palette.highlight} />
            <circle cx="42" cy="36" r="2" fill={palette.highlight} />
          </g>
        );

      case 'trophy':
        return (
          <g>
            <circle cx="32" cy="30" r="20" fill={palette.highlight} opacity="0.3" />
            {/* Handles */}
            <path
              d="M20 20H13C12 28 16 32 21 32"
              fill="none"
              stroke={palette.dark}
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <path
              d="M44 20H51C52 28 48 32 43 32"
              fill="none"
              stroke={palette.dark}
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            {/* Cup */}
            <path
              d="M19 16H45V27C45 34.5 39 39 32 39C25 39 19 34.5 19 27V16Z"
              fill={unlocked ? '#FACC15' : '#D6D3D1'}
              stroke={palette.dark}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            {/* Shine stripe */}
            <path d="M24 20V28C24 31 26 33 28 34" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
            {/* Star on cup */}
            <polygon
              points="32,21 34,25.5 38.8,26 35.2,29.2 36.2,34 32,31.5 27.8,34 28.8,29.2 25.2,26 30,25.5"
              fill={palette.accent}
            />
            {/* Stem & Pedestal */}
            <rect x="29" y="39" width="6" height="6" fill={unlocked ? '#EAB308' : '#A8A29E'} stroke={palette.dark} strokeWidth="1.8" />
            <rect x="21" y="45" width="22" height="5" rx="2" fill={palette.dark} />
          </g>
        );

      case 'medal':
        return (
          <g>
            {/* Ribbon */}
            <path d="M20 12L28 28H21L14 12Z" fill={unlocked ? '#EA580C' : '#78716C'} stroke={palette.dark} strokeWidth="1.6" />
            <path d="M44 12L36 28H43L50 12Z" fill={unlocked ? '#F97316' : '#A8A29E'} stroke={palette.dark} strokeWidth="1.6" />
            {/* Medallion */}
            <circle cx="32" cy="36" r="14" fill={unlocked ? '#FBBF24' : '#D6D3D1'} stroke={palette.dark} strokeWidth="2.2" />
            <circle cx="32" cy="36" r="10" fill={palette.highlight} opacity="0.55" />
            <polygon
              points="32,28 34.3,32.8 39.5,33.5 35.7,37.1 36.6,42.3 32,39.8 27.4,42.3 28.3,37.1 24.5,33.5 29.7,32.8"
              fill={palette.accent}
              stroke={palette.dark}
              strokeWidth="1.2"
            />
          </g>
        );

      case 'shield':
        return (
          <g>
            <path
              d="M32 12L50 18.5V31.5C50 42 42.2 49.6 32 53C21.8 49.6 14 42 14 31.5V18.5L32 12Z"
              fill={palette.highlight}
              stroke={palette.dark}
              strokeWidth="2.3"
              strokeLinejoin="round"
            />
            <path
              d="M32 16L45.5 21V31.2C45.5 39.3 39.6 45.4 32 48.2V16Z"
              fill={palette.accent}
              opacity="0.28"
            />
            <path
              d="M25 32.5L29.8 37.3L39.8 26.5"
              fill="none"
              stroke={palette.dark}
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );

      case 'flame':
        return (
          <g>
            <circle cx="32" cy="33" r="19" fill={palette.highlight} opacity="0.3" />
            <path
              d="M33 12C33 12 45 21 45 34C45 43.5 39 50 32 50C25 50 19 43.5 19 35C19 29 22 24 25 21C25 25 27 27 29 27C28 21 30.5 15.5 33 12Z"
              fill={unlocked ? '#F97316' : '#D6D3D1'}
              stroke={palette.dark}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <path
              d="M32.5 27C36.5 31 38 35.5 38 39C38 43.5 35.3 46.5 32 46.5C28.7 46.5 26 43.5 26 39.5C26 36.2 27.6 33.8 29.5 32C29.8 34.2 31 35 32 35C31.8 32 32 29.5 32.5 27Z"
              fill={unlocked ? '#FDE047' : '#F5F5F4'}
            />
          </g>
        );

      case 'zap':
        return (
          <g>
            <circle cx="32" cy="32" r="18" fill={palette.highlight} opacity="0.35" />
            <path
              d="M36 12L18 35H31L27 52L46 28H33L36 12Z"
              fill={unlocked ? '#FACC15' : '#D6D3D1'}
              stroke={palette.dark}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <path d="M33.5 17.5L23.5 31.5H31" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
          </g>
        );

      case 'target':
        return (
          <g>
            <circle cx="32" cy="32" r="18" fill={palette.highlight} stroke={palette.dark} strokeWidth="2.2" />
            <circle cx="32" cy="32" r="12" fill={unlocked ? '#EF4444' : '#A8A29E'} />
            <circle cx="32" cy="32" r="6.5" fill={palette.highlight} />
            <circle cx="32" cy="32" r="3" fill={unlocked ? '#EA580C' : '#57534E'} />
            {/* Dart arrow */}
            <path d="M47 17L33 31" stroke={palette.dark} strokeWidth="2.6" strokeLinecap="round" />
            <path d="M44 14L47 17L50 20L52 12L44 14Z" fill={palette.accent} stroke={palette.dark} strokeWidth="1.4" />
          </g>
        );

      case 'wallet':
        return (
          <g>
            <rect
              x="13"
              y="19"
              width="38"
              height="27"
              rx="5"
              fill={unlocked ? '#10B981' : '#D6D3D1'}
              stroke={palette.dark}
              strokeWidth="2.2"
            />
            <path
              d="M17 19L39 13C41.5 12.3 44 14 44 16.6V19"
              fill={unlocked ? '#FBBF24' : '#A8A29E'}
              stroke={palette.dark}
              strokeWidth="2"
            />
            <rect x="35" y="28" width="17" height="10" rx="3" fill={palette.highlight} stroke={palette.dark} strokeWidth="1.8" />
            <circle cx="40.5" cy="33" r="2.2" fill={palette.dark} />
            <circle cx="24" cy="32" r="4.5" fill={unlocked ? '#FDE047' : '#A8A29E'} opacity="0.9" />
          </g>
        );

      case 'building':
        return (
          <g>
            <rect x="16" y="15" width="22" height="34" rx="2.5" fill={palette.highlight} stroke={palette.dark} strokeWidth="2.2" />
            <rect x="38" y="25" width="12" height="24" rx="2" fill={palette.accent} opacity="0.85" stroke={palette.dark} strokeWidth="2" />
            <rect x="20" y="20" width="5" height="5" rx="1" fill={palette.accent} />
            <rect x="29" y="20" width="5" height="5" rx="1" fill={palette.accent} />
            <rect x="20" y="28" width="5" height="5" rx="1" fill={palette.accent} />
            <rect x="29" y="28" width="5" height="5" rx="1" fill={palette.accent} />
            <rect x="24" y="39" width="6" height="10" rx="1" fill={palette.dark} />
            <rect x="41.5" y="30" width="5" height="4" rx="0.8" fill={palette.highlight} />
            <rect x="41.5" y="37" width="5" height="4" rx="0.8" fill={palette.highlight} />
          </g>
        );

      case 'briefcase':
        return (
          <g>
            <path d="M25 20V16C25 14.5 26.2 13.5 27.8 13.5H36.2C37.8 13.5 39 14.5 39 16V20" fill="none" stroke={palette.dark} strokeWidth="2.5" />
            <rect x="13" y="20" width="38" height="27" rx="5" fill={palette.highlight} stroke={palette.dark} strokeWidth="2.2" />
            <path d="M13 28C22 33 42 33 51 28" fill="none" stroke={palette.dark} strokeWidth="2" />
            <rect x="28" y="29" width="8" height="6" rx="1.5" fill={unlocked ? '#F59E0B' : '#A8A29E'} stroke={palette.dark} strokeWidth="1.6" />
          </g>
        );

      case 'phone':
        return (
          <g>
            <circle cx="32" cy="32" r="19" fill={palette.highlight} opacity="0.35" />
            <path
              d="M20 18C20 16.5 21.5 15 23 15H27L29.5 23L26 26C27.5 30 34 36.5 38 38L41 34.5L49 37V41C49 42.5 47.5 44 46 44C30 44 20 34 20 18Z"
              fill={palette.highlight}
              stroke={palette.dark}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <path d="M36 16C42 16 47 21 47 27" fill="none" stroke={palette.dark} strokeWidth="2.3" strokeLinecap="round" />
            <path d="M36 21C39.5 21 42 23.5 42 27" fill="none" stroke={palette.accent} strokeWidth="2.3" strokeLinecap="round" />
          </g>
        );

      case 'layers':
        return (
          <g>
            <polygon points="32,14 50,23 32,32 14,23" fill={palette.highlight} stroke={palette.dark} strokeWidth="2" strokeLinejoin="round" />
            <polyline points="14,32 32,41 50,32" fill="none" stroke={palette.dark} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="14,40 32,49 50,40" fill="none" stroke={palette.accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'map':
        return (
          <g>
            <path d="M13 20L25 15L39 20L51 15V43L39 48L25 43L13 48V20Z" fill={palette.highlight} stroke={palette.dark} strokeWidth="2" strokeLinejoin="round" />
            <line x1="25" y1="15" x2="25" y2="43" stroke={palette.dark} strokeWidth="1.5" opacity="0.45" />
            <line x1="39" y1="20" x2="39" y2="48" stroke={palette.dark} strokeWidth="1.5" opacity="0.45" />
            <path
              d="M32 16C27.5 16 24 19.5 24 24C24 29.8 32 37.5 32 37.5C32 37.5 40 29.8 40 24C40 19.5 36.5 16 32 16Z"
              fill={unlocked ? '#EF4444' : '#78716C'}
              stroke={palette.dark}
              strokeWidth="1.8"
            />
            <circle cx="32" cy="24" r="3" fill="#FFFFFF" />
          </g>
        );

      case 'trending':
        return (
          <g>
            <rect x="13" y="14" width="38" height="36" rx="5" fill={palette.highlight} stroke={palette.dark} strokeWidth="2" />
            <rect x="18" y="34" width="5" height="11" rx="1.2" fill={palette.accent} opacity="0.55" />
            <rect x="26" y="29" width="5" height="16" rx="1.2" fill={palette.accent} opacity="0.75" />
            <rect x="34" y="24" width="5" height="21" rx="1.2" fill={palette.accent} />
            <path d="M18 30L27 24L34 27L45 18" fill="none" stroke={palette.dark} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="39,18 45,18 45,24" fill="none" stroke={palette.dark} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'calendar':
        return (
          <g>
            <rect x="14" y="17" width="36" height="32" rx="4.5" fill={palette.highlight} stroke={palette.dark} strokeWidth="2.2" />
            <path d="M14 25H50V21.5C50 19 48 17 45.5 17H18.5C16 17 14 19 14 21.5V25Z" fill={palette.accent} stroke={palette.dark} strokeWidth="2" />
            <line x1="23" y1="13" x2="23" y2="20" stroke={palette.dark} strokeWidth="2.6" strokeLinecap="round" />
            <line x1="41" y1="13" x2="41" y2="20" stroke={palette.dark} strokeWidth="2.6" strokeLinecap="round" />
            <path d="M24 36L29.5 41.5L40.5 30.5" fill="none" stroke={palette.dark} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'heart':
        return (
          <g>
            <circle cx="32" cy="32" r="19" fill={palette.highlight} opacity="0.3" />
            <path
              d="M32 48C32 48 14 37.5 14 25C14 19.5 18.2 15.5 23.2 15.5C26.7 15.5 29.8 17.4 32 20.4C34.2 17.4 37.3 15.5 40.8 15.5C45.8 15.5 50 19.5 50 25C50 37.5 32 48 32 48Z"
              fill={unlocked ? '#F43F5E' : '#D6D3D1'}
              stroke={palette.dark}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <path d="M21 22C21.5 19.8 23.2 18.5 25.5 18.5" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" opacity="0.75" />
          </g>
        );

      case 'star':
        return (
          <g>
            <circle cx="32" cy="32" r="19" fill={palette.highlight} opacity="0.35" />
            <polygon
              points="32,12 37.6,23.8 50.6,25.5 41.1,34.6 43.5,47.5 32,41.2 20.5,47.5 22.9,34.6 13.4,25.5 26.4,23.8"
              fill={unlocked ? '#FACC15' : '#D6D3D1'}
              stroke={palette.dark}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <polygon
              points="32,18.5 35.4,25.7 43.3,26.8 37.5,32.3 39,40.2 32,36.4 25,40.2 26.5,32.3 20.7,26.8 28.6,25.7"
              fill={palette.highlight}
              opacity="0.5"
            />
          </g>
        );

      case 'award':
      default:
        return (
          <g>
            <path d="M23 36L19 52L27 47L32 52" fill={unlocked ? '#EA580C' : '#78716C'} stroke={palette.dark} strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M41 36L45 52L37 47L32 52" fill={unlocked ? '#F97316' : '#A8A29E'} stroke={palette.dark} strokeWidth="1.8" strokeLinejoin="round" />
            <circle cx="32" cy="27" r="14" fill={unlocked ? '#FBBF24' : '#D6D3D1'} stroke={palette.dark} strokeWidth="2.2" />
            <circle cx="32" cy="27" r="9.5" fill={palette.highlight} opacity="0.6" />
            <path d="M27.5 27.5L30.8 30.8L37 24" fill="none" stroke={palette.dark} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );
    }
  };

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`.trim()}
      style={{ width: px, height: px }}
      aria-hidden="true"
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={unlocked ? 'drop-shadow-xs' : 'opacity-80'}
      >
        <defs>
          <linearGradient id={`bg_${uid}`} x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={palette.bgStart} />
            <stop offset="100%" stopColor={palette.bgEnd} />
          </linearGradient>
        </defs>

        {/* Framed Emblem Backing */}
        <rect
          x="3"
          y="3"
          width="58"
          height="58"
          rx={isMini ? 16 : 14}
          fill={`url(#bg_${uid})`}
          stroke={palette.ring}
          strokeWidth={isMini ? 3.2 : 2.6}
        />

        {/* Subtle inner metallic frame on md/lg/xl */}
        {!isMini && (
          <rect
            x="7"
            y="7"
            width="50"
            height="50"
            rx="10"
            stroke="#FFFFFF"
            strokeOpacity="0.45"
            strokeWidth="1.5"
          />
        )}

        {renderIllustration()}

        {/* Small corner padlock indicator if locked */}
        {!unlocked && !isMini && (
          <g transform="translate(41, 41)">
            <circle cx="10" cy="10" r="10" fill="#292524" stroke="#FFFFFF" strokeWidth="1.8" />
            <path
              d="M7 9V7.5C7 5.8 8.3 4.5 10 4.5C11.7 4.5 13 5.8 13 7.5V9"
              stroke="#FFFFFF"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <rect x="6" y="9" width="8" height="6" rx="1.5" fill="#F59E0B" />
          </g>
        )}
      </svg>
    </span>
  );
};

interface BadgeChipProps {
  badgeId: string;
  size?: 'xs' | 'sm';
  showXp?: boolean;
  className?: string;
}

export const BadgeChipWithDrawing: React.FC<BadgeChipProps> = ({
  badgeId,
  size = 'xs',
  showXp = false,
  className = '',
}) => {
  const adminDef = ADMIN_DISTINCTION_BADGES.find((b) => b.id === badgeId);
  const resolved = resolveBadgeMeta(badgeId);
  const title = adminDef?.title || resolved?.title || badgeId;
  const rarity: BadgeRarity = adminDef?.rarity || resolved?.rarity || 'commun';
  const meta = RARITY_META[rarity];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[11px] font-bold ${
        adminDef?.category === 'role'
          ? 'border-indigo-200 bg-indigo-50/80 text-indigo-900'
          : 'border-stone-200 bg-white text-stone-800'
      } ${className}`.trim()}
      title={adminDef ? `${title} — ${adminDef.description}` : title}
    >
      <BadgeArtwork badgeId={badgeId} rarity={rarity} size={size} />
      <span className="truncate max-w-[165px]">{title}</span>
      {showXp && adminDef && (
        <span className={`rounded px-1 py-0.2 text-[9px] font-extrabold ${meta.pillBg} ${meta.pillText}`}>
          +{adminDef.xpBoost} XP
        </span>
      )}
    </span>
  );
};
