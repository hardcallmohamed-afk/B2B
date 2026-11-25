import React from 'react';

interface DiversifiaMarkProps {
  size?: number;
  className?: string;
}

export const DiversifiaMark: React.FC<DiversifiaMarkProps> = ({
  size = 34,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${className}`.trim()}
    aria-hidden="true"
  >
    <rect width="40" height="40" rx="10" fill="#0B0A09" />
    <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="9.25" stroke="#F96614" strokeOpacity="0.45" strokeWidth="1.5" />
    {/* Stylized geometric D */}
    <path
      d="M11 11.5H18.5C24.2 11.5 28 15 28 20C28 25 24.2 28.5 18.5 28.5H11V11.5Z"
      stroke="#FFFFFF"
      strokeWidth="3.2"
      strokeLinejoin="round"
    />
    {/* Signature Diversifia orange telecom signal dot + arc */}
    <circle cx="28.5" cy="11.5" r="2.2" fill="#F96614" />
    <path
      d="M28.5 6.5C31.8 6.5 34.5 9.2 34.5 12.5"
      stroke="#F96614"
      strokeWidth="2.3"
      strokeLinecap="round"
    />
  </svg>
);

interface DiversifiaLogoProps {
  theme?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  subtitle?: string;
  className?: string;
}

export const DiversifiaLogo: React.FC<DiversifiaLogoProps> = ({
  theme = 'light',
  size = 'md',
  showSubtitle = true,
  subtitle = 'DISTRIBUTEUR ORANGE',
  className = '',
}) => {
  const isDark = theme === 'dark';
  const wordSizeClass =
    size === 'lg'
      ? 'text-[30px] sm:text-[34px] tracking-[0.06em]'
      : size === 'sm'
        ? 'text-[17px] tracking-[0.06em]'
        : 'text-[24px] tracking-[0.06em]';

  const subSizeClass =
    size === 'lg'
      ? 'text-[10.5px] tracking-[0.34em]'
      : size === 'sm'
        ? 'text-[8.5px] tracking-[0.24em]'
        : 'text-[9.5px] tracking-[0.3em]';

  const signalSize = size === 'lg' ? 22 : size === 'sm' ? 14 : 18;
  const signalOffset =
    size === 'lg'
      ? '-top-3.5 right-[18px]'
      : size === 'sm'
        ? '-top-2 right-[10px]'
        : '-top-2.5 right-[14px]';

  return (
    <div className={`inline-flex flex-col select-none ${className}`.trim()}>
      <div className="relative inline-flex items-baseline">
        {/* Signature orange signal dot + wave arc above the final I/A */}
        <svg
          width={signalSize}
          height={signalSize}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`absolute pointer-events-none ${signalOffset}`}
          aria-hidden="true"
        >
          <circle cx="7" cy="17" r="3.2" fill="#F96614" />
          <path
            d="M7 9.5C11.7 9.5 15.5 13.3 15.5 18"
            stroke="#F96614"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path
            d="M7 4C14.7 4 21 10.3 21 18"
            stroke="#ED5F10"
            strokeWidth="2.4"
            strokeLinecap="round"
            opacity="0.85"
          />
        </svg>

        <span
          className={`font-extrabold uppercase leading-none ${wordSizeClass} ${
            isDark ? 'text-white' : 'text-[#0B0A09]'
          }`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          DIVERSIFIA
        </span>
      </div>

      {showSubtitle && (
        <span
          className={`mt-1 font-bold uppercase leading-none text-[#F96614] ${subSizeClass}`}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
};
