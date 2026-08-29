'use client';

import React from 'react';

export type StatType =
  | 'hunger'
  | 'happiness'
  | 'energy'
  | 'cleanliness'
  | 'hambre'
  | 'felicidad'
  | 'energia'
  | 'energía'
  | 'higiene';

export interface StatConfig {
  key: 'hunger' | 'happiness' | 'energy' | 'cleanliness';
  label: string;
  icon: string;
  gradientFrom: string;
  gradientTo: string;
  bgColor: string;
}

export const STAT_CONFIGS: Record<string, StatConfig> = {
  hunger: {
    key: 'hunger',
    label: 'Hambre',
    icon: '🍖',
    gradientFrom: '#FFA07A',
    gradientTo: '#FF6347',
    bgColor: '#FFE5DC',
  },
  hambre: {
    key: 'hunger',
    label: 'Hambre',
    icon: '🍖',
    gradientFrom: '#FFA07A',
    gradientTo: '#FF6347',
    bgColor: '#FFE5DC',
  },
  happiness: {
    key: 'happiness',
    label: 'Felicidad',
    icon: '😊',
    gradientFrom: '#FFB6C1',
    gradientTo: '#FF69B4',
    bgColor: '#FFEBF3',
  },
  felicidad: {
    key: 'happiness',
    label: 'Felicidad',
    icon: '😊',
    gradientFrom: '#FFB6C1',
    gradientTo: '#FF69B4',
    bgColor: '#FFEBF3',
  },
  energy: {
    key: 'energy',
    label: 'Energía',
    icon: '⚡',
    gradientFrom: '#C4B5FD',
    gradientTo: '#8B5CF6',
    bgColor: '#F1EAFF',
  },
  energia: {
    key: 'energy',
    label: 'Energía',
    icon: '⚡',
    gradientFrom: '#C4B5FD',
    gradientTo: '#8B5CF6',
    bgColor: '#F1EAFF',
  },
  'energía': {
    key: 'energy',
    label: 'Energía',
    icon: '⚡',
    gradientFrom: '#C4B5FD',
    gradientTo: '#8B5CF6',
    bgColor: '#F1EAFF',
  },
  cleanliness: {
    key: 'cleanliness',
    label: 'Higiene',
    icon: '✨',
    gradientFrom: '#7EE8DB',
    gradientTo: '#20B2AA',
    bgColor: '#E2FAF7',
  },
  higiene: {
    key: 'cleanliness',
    label: 'Higiene',
    icon: '✨',
    gradientFrom: '#7EE8DB',
    gradientTo: '#20B2AA',
    bgColor: '#E2FAF7',
  },
};

const DEFAULT_STAT_CONFIG: StatConfig = {
  key: 'hunger',
  label: 'Estado',
  icon: '⭐',
  gradientFrom: '#FDE047',
  gradientTo: '#F59E0B',
  bgColor: '#FEF3C7',
};

export interface StatusGaugeProps {
  stat: StatType | string;
  value: number;
  label?: string;
  icon?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showValueText?: boolean;
}

export function StatusGauge({
  stat,
  value,
  label,
  icon,
  className = '',
}: StatusGaugeProps) {
  const config = STAT_CONFIGS[stat.toLowerCase()] ?? DEFAULT_STAT_CONFIG;
  const displayLabel = label ?? config.label;
  const displayIcon = icon ?? config.icon;

  const clampedValue = Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));

  return (
    <div
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${displayLabel}: ${clampedValue}%`}
      title={`${displayLabel}: ${clampedValue}%`}
      tabIndex={0}
      data-testid={`status-gauge-${config.key}`}
      className={`group relative inline-flex items-center cursor-pointer outline-none select-none transition-transform hover:scale-105 active:scale-95 ${className}`}
    >
      {/* Pill housing with Pet Society wooden border */}
      <div className="relative flex items-center h-7 sm:h-8 pl-1 pr-2.5 py-0.5 rounded-full border-2 border-[#58331A] bg-[#FFF9EC] shadow-[0_2px_0_#58331A,0_2px_4px_rgba(0,0,0,0.15)] min-w-[90px] sm:min-w-[110px] md:min-w-[125px]">
        {/* Left circular icon badge with frame and border */}
        <div className="relative -ml-0.5 mr-1.5 flex items-center justify-center w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-full border-2 border-[#58331A] bg-[#FFFDF8] shadow-[0_1px_2px_rgba(0,0,0,0.15)] shrink-0 z-10">
          <span className="text-xs sm:text-sm select-none filter drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]">
            {displayIcon}
          </span>
        </div>

        {/* Progress track */}
        <div className="relative flex-1 h-3.5 sm:h-4 bg-[#EBDDC3] rounded-full overflow-hidden border border-[#58331A]/25 shadow-[inset_0_1px_2px_rgba(88,51,26,0.25)]">
          {/* Active progressive candy gradient fill */}
          <div
            className="relative h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${clampedValue}%`,
              background: `linear-gradient(to right, ${config.gradientFrom}, ${config.gradientTo})`,
            }}
          >
            {/* Top specular gloss reflection */}
            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/60 to-transparent" />
          </div>

          {/* Centered percentage label over track */}
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-[#58331A] font-[family-name:var(--font-display)] drop-shadow-[0_1px_0_rgba(255,255,255,0.7)] leading-none select-none">
            {clampedValue}%
          </span>
        </div>
      </div>

      {/* Pet Society Themed Tooltip on Hover / Focus / Tap */}
      <div
        role="tooltip"
        className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100 transition-all duration-150 transform scale-90 group-hover:scale-100 group-focus-visible:scale-100 rounded-lg border-2 border-[#58331A] bg-[#FFF9EC] px-2.5 py-0.5 text-center text-xs font-bold text-[#58331A] shadow-[0_3px_0_#58331A,0_4px_10px_rgba(0,0,0,0.25)] whitespace-nowrap"
      >
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-t-2 border-l-2 border-[#58331A] bg-[#FFF9EC]" />
        {displayLabel}: {clampedValue}%
      </div>
    </div>
  );
}
