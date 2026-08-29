'use client';

import React from 'react';
import { computeBondTier, type BondTierInfo } from '@/lib/bond';
import type { PetStats } from '@/lib/pet-engine';
import { StatusGauge } from './StatusGauge';

export interface PetHUDProps {
  petName?: string;
  name?: string;
  coins?: number;
  bondScore?: number;
  bondTier?: BondTierInfo | string;
  stats?: PetStats;
  hunger?: number;
  happiness?: number;
  energy?: number;
  cleanliness?: number;
  className?: string;
  onLevelClick?: () => void;
  onCoinsClick?: () => void;
}

/**
 * Computes pet level from 1 to 10 based on bond score (0 - 100).
 * Interval:
 *  0 - 9   -> Niv. 1
 * 10 - 19  -> Niv. 2
 * ...
 * 90 - 100 -> Niv. 10
 */
export function computePetLevel(bondScore: number): number {
  const score = Math.max(0, Math.min(100, isNaN(bondScore) ? 0 : bondScore));
  return Math.min(10, Math.floor(score / 10) + 1);
}

export function PetHUD({
  petName,
  name,
  coins = 0,
  bondScore = 0,
  bondTier,
  stats,
  hunger,
  happiness,
  energy,
  cleanliness,
  className = '',
  onLevelClick,
  onCoinsClick,
}: PetHUDProps) {
  const displayName = petName ?? name ?? 'Mi Mascota';
  const level = computePetLevel(bondScore);

  // Compute or extract tier label
  const resolvedBondTier: BondTierInfo =
    typeof bondTier === 'object' && bondTier !== null
      ? bondTier
      : computeBondTier(bondScore);

  const tierLabel =
    typeof bondTier === 'string' ? bondTier : resolvedBondTier.label;

  // Extract individual stat values with fallback to 100
  const hungerVal = stats?.hunger ?? hunger ?? 100;
  const happinessVal = stats?.happiness ?? happiness ?? 100;
  const energyVal = stats?.energy ?? energy ?? 100;
  const cleanlinessVal = stats?.cleanliness ?? cleanliness ?? 100;

  return (
    <div
      data-testid="pet-hud"
      className={`w-full flex items-center justify-between gap-2 sm:gap-4 px-3 py-2 sm:px-4 sm:py-2.5 bg-gradient-to-b from-[#FFFDF8]/95 to-[#F5EAD6]/95 border-b-2 border-[#58331A]/30 shadow-[0_2px_8px_rgba(88,51,26,0.12)] select-none ${className}`}
    >
      {/* Left Section: Level Emblem & Carved Nameplate */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Level & Bond Star Medallion */}
        <div
          data-testid="pet-hud-level"
          onClick={onLevelClick}
          role="button"
          tabIndex={0}
          title={`Vínculo: ${tierLabel} (${bondScore}/100)`}
          className="group relative inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full border-2 border-[#58331A] bg-gradient-to-b from-[#FDE047] via-[#FBBF24] to-[#F59E0B] text-[#58331A] font-bold text-xs sm:text-sm shadow-[0_3px_0_#58331A,0_4px_8px_rgba(0,0,0,0.2)] cursor-pointer transition-transform hover:scale-105 active:scale-95 outline-none"
        >
          {/* Specular gloss top highlight */}
          <span className="pointer-events-none absolute top-0.5 left-2 right-2 h-1/2 rounded-t-full bg-gradient-to-b from-white/60 to-transparent" />
          
          <span className="text-sm sm:text-base filter drop-shadow-sm">⭐</span>
          <span className="tracking-wide">Niv. {level}</span>

          {/* Level & Bond Tooltip */}
          <div
            role="tooltip"
            className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-all duration-150 transform scale-90 group-hover:scale-100 rounded-lg border-2 border-[#58331A] bg-[#FFF9EC] px-2.5 py-0.5 text-center text-xs font-bold text-[#58331A] shadow-[0_3px_0_#58331A,0_4px_10px_rgba(0,0,0,0.25)] whitespace-nowrap"
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-t-2 border-l-2 border-[#58331A] bg-[#FFF9EC]" />
            {tierLabel} ({bondScore}/100)
          </div>
        </div>

        {/* Carved Wooden Nameplate */}
        <div
          data-testid="pet-hud-nameplate"
          className="relative inline-flex items-center px-2.5 sm:px-3.5 py-1 rounded-xl border-2 border-[#3B2210] bg-gradient-to-b from-[#804A26] to-[#58331A] text-[#FFF9EC] shadow-[inset_0_2px_4px_rgba(0,0,0,0.45),0_2px_0_rgba(255,255,255,0.25)]"
        >
          <span className="font-[family-name:var(--font-display)] font-bold text-xs sm:text-sm md:text-base tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] truncate max-w-[90px] sm:max-w-[140px] md:max-w-[180px]">
            {displayName}
          </span>
        </div>
      </div>

      {/* Center Section: 4 Status Gauges */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 md:gap-3 flex-1">
        <StatusGauge
          stat="hunger"
          value={hungerVal}
          label="Hambre"
          size={46}
          strokeWidth={5}
        />
        <StatusGauge
          stat="happiness"
          value={happinessVal}
          label="Felicidad"
          size={46}
          strokeWidth={5}
        />
        <StatusGauge
          stat="energy"
          value={energyVal}
          label="Energía"
          size={46}
          strokeWidth={5}
        />
        <StatusGauge
          stat="cleanliness"
          value={cleanlinessVal}
          label="Higiene"
          size={46}
          strokeWidth={5}
        />
      </div>

      {/* Right Section: Shiny Coin Capsule */}
      <div className="shrink-0 flex items-center">
        <div
          data-testid="pet-hud-coins"
          onClick={onCoinsClick}
          role="button"
          tabIndex={0}
          title={`Monedas: ${coins.toLocaleString()}`}
          className="group relative inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1 rounded-full border-2 border-[#58331A] bg-gradient-to-b from-[#FFF3C4] via-[#FDE047] to-[#F59E0B] text-[#58331A] font-bold text-xs sm:text-sm shadow-[0_3px_0_#58331A,0_4px_8px_rgba(0,0,0,0.2)] cursor-pointer transition-transform hover:scale-105 active:scale-95 outline-none"
        >
          {/* Specular gloss top highlight */}
          <span className="pointer-events-none absolute top-0.5 left-2 right-2 h-1/2 rounded-t-full bg-gradient-to-b from-white/70 to-transparent" />

          <span className="text-sm sm:text-base select-none filter drop-shadow-sm group-hover:rotate-12 transition-transform duration-200">
            🪙
          </span>
          <span className="font-[family-name:var(--font-display)] tracking-wider">
            {coins.toLocaleString()}
          </span>

          {/* Coins Tooltip */}
          <div
            role="tooltip"
            className="pointer-events-none absolute -bottom-9 right-0 z-30 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-all duration-150 transform scale-90 group-hover:scale-100 rounded-lg border-2 border-[#58331A] bg-[#FFF9EC] px-2.5 py-0.5 text-center text-xs font-bold text-[#58331A] shadow-[0_3px_0_#58331A,0_4px_10px_rgba(0,0,0,0.25)] whitespace-nowrap"
          >
            <div className="absolute -top-1 right-4 w-2 h-2 rotate-45 border-t-2 border-l-2 border-[#58331A] bg-[#FFF9EC]" />
            Monedas: {coins.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
