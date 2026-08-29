'use client';

import React, { useState, useEffect, useRef, type MouseEvent } from 'react';
import type { LifeStage, PetMood, PetRow, PetStats } from '@/lib/pet-engine';
import type { PetThought, StreakReward } from '@/lib/attachment';
import { clampPct, findItem, type ItemWithOwnership, type PlacedItem } from '@/lib/items';
import { CatSprite } from './casa/CatSprite';
import { PetSpeechBubble } from './PetSpeechBubble';

export interface PetRoomStageProps {
  petRow: PetRow;
  stats: PetStats;
  isSick: boolean;
  mood: PetMood;
  lifeStage: LifeStage;
  thought?: PetThought | null;
  placedItems: PlacedItem[];
  itemsWithOwnership: ItemWithOwnership[];
  isDecorating: boolean;
  onPlacedItemTap?: (placedItemId: string) => void;
  isSleeping: boolean;
  onOpenStreakModal?: (reward: StreakReward) => void;
  className?: string;
}

export function PetRoomStage({
  petRow,
  stats,
  isSick,
  mood,
  lifeStage,
  thought,
  placedItems,
  itemsWithOwnership,
  isDecorating,
  onPlacedItemTap,
  isSleeping,
  onOpenStreakModal,
  className = '',
}: PetRoomStageProps) {
  const [catX, setCatX] = useState(50);
  const [facing, setFacing] = useState<'left' | 'right'>('right');
  const [walking, setWalking] = useState(false);
  const walkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up walk timeout on unmount
  useEffect(() => {
    return () => {
      if (walkTimeoutRef.current) {
        clearTimeout(walkTimeoutRef.current);
      }
    };
  }, []);

  const handleRoomClick = (e: MouseEvent<HTMLDivElement>) => {
    // If decorating or still in egg stage, do not walk the pet
    if (isDecorating || lifeStage === 'egg') return;

    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;

    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    const target = clampPct(pct);

    setFacing(target >= catX ? 'right' : 'left');
    setWalking(true);
    setCatX(target);

    if (walkTimeoutRef.current) {
      clearTimeout(walkTimeoutRef.current);
    }
    walkTimeoutRef.current = setTimeout(() => {
      setWalking(false);
    }, 600);
  };

  const isEgg = lifeStage === 'egg';

  return (
    <div
      role="region"
      aria-label="Habitación de Mascota"
      data-testid="pet-room-stage"
      onClick={handleRoomClick}
      className={`relative w-full h-full min-h-[320px] flex-1 overflow-hidden select-none cursor-default ${className}`}
    >
      {/* 2.5D Wallpaper Layer (Top 75%) */}
      <div
        data-testid="pet-room-wall"
        className="absolute inset-x-0 top-0 h-[75%] overflow-hidden"
        style={{
          background: `
            repeating-linear-gradient(
              90deg,
              #FDE9C8 0px,
              #FDE9C8 28px,
              #F5D8A5 28px,
              #F5D8A5 56px
            )
          `,
        }}
      >
        {/* Top wall shadow vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/8 via-transparent to-black/10 pointer-events-none" />

        {/* Ambient room decor: cozy wall crown border */}
        <div className="absolute inset-x-0 top-0 h-2 bg-[#804A26]/15 border-b border-[#804A26]/20" />
      </div>

      {/* Wooden Baseboard / Wainscot line (at 75% height) */}
      <div
        data-testid="pet-room-baseboard"
        className="absolute inset-x-0 top-[75%] -translate-y-full h-3.5 bg-[#6B4226] border-t-2 border-[#804A26] border-b-2 border-[#3B2210] shadow-[0_2px_4px_rgba(0,0,0,0.2)] z-0"
      />

      {/* 2.5D Parquet Floor Layer (Bottom 25%) */}
      <div
        data-testid="pet-room-floor"
        className="absolute inset-x-0 bottom-0 h-[25%] overflow-hidden shadow-[inset_0_4px_6px_rgba(0,0,0,0.18)]"
        style={{
          background: `
            repeating-linear-gradient(
              90deg,
              #C89B6C 0px,
              #C89B6C 68px,
              #BA8D5E 68px,
              #BA8D5E 70px
            ),
            linear-gradient(180deg, #C89B6C 0%, #B88554 100%)
          `,
        }}
      >
        {/* Parquet horizontal plank shadow seams */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.12)_0%,transparent_30%,rgba(0,0,0,0.06)_100%)] pointer-events-none" />
      </div>

      {/* Placed Furniture Items Layer */}
      {placedItems.map((placed) => {
        const item = itemsWithOwnership.find((i) => i.id === placed.item_id) || findItem(placed.item_id);
        if (!item) return null;

        return (
          <div
            key={placed.id}
            data-testid={`placed-item-${placed.id}`}
            className={`absolute -translate-x-1/2 -translate-y-full transition-transform ${
              isDecorating ? 'z-20 cursor-pointer' : 'z-10 pointer-events-none'
            }`}
            style={{
              left: `${placed.position_x_pct}%`,
              top: '75%',
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isDecorating) {
                  onPlacedItemTap?.(placed.id);
                }
              }}
              disabled={!isDecorating}
              aria-label={isDecorating ? `Quitar ${item.name}` : item.name}
              className={`group relative flex flex-col items-center select-none ${
                isDecorating
                  ? 'cursor-pointer hover:scale-110 active:scale-95 transition-all'
                  : 'cursor-default pointer-events-none'
              }`}
            >
              {/* Furniture Emoji / Asset */}
              <span className="text-4xl sm:text-5xl drop-shadow-[0_6px_6px_rgba(0,0,0,0.25)] select-none">
                {item.emoji}
              </span>

              {/* Floor contact shadow */}
              <div className="w-10 h-2 bg-black/15 rounded-full blur-[1px] -mt-1 pointer-events-none" />

              {/* Red Removal Badge (when Decorating) */}
              {isDecorating && (
                <span
                  data-testid="remove-item-tag"
                  className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#EF4444] text-white text-[11px] font-black shadow-md border-2 border-white animate-bounce pointer-events-none"
                >
                  ✕
                </span>
              )}
            </button>
          </div>
        );
      })}

      {/* Pet or Egg Stage */}
      {isEgg ? (
        /* Cozy Egg Incubation Stage */
        <div
          data-testid="pet-egg-stage"
          className="absolute left-1/2 top-[75%] -translate-x-1/2 -translate-y-[85%] z-15 flex flex-col items-center pointer-events-none"
        >
          {/* Cozy Nest with Egg */}
          <div className="relative flex flex-col items-center">
            {/* Egg Sprite */}
            <div className="relative z-10 animate-wobble">
              <img
                src="/egg-sprite.svg"
                alt="Huevo de Mascota"
                width={96}
                height={96}
                className="w-20 h-20 sm:w-24 sm:h-24 drop-shadow-[0_8px_10px_rgba(0,0,0,0.25)] select-none"
              />
            </div>

            {/* Cozy Straw / Nest Base */}
            <div className="relative -mt-6 z-0 flex items-center justify-center">
              <svg viewBox="0 0 100 36" className="w-28 sm:w-32 h-10 drop-shadow-md">
                {/* Straw Nest Body */}
                <ellipse cx="50" cy="20" rx="46" ry="14" fill="#D97706" />
                <ellipse cx="50" cy="18" rx="42" ry="12" fill="#F59E0B" />
                <ellipse cx="50" cy="15" rx="38" ry="9" fill="#FEF3C7" />
                {/* Woven details */}
                <path
                  d="M 12 18 Q 30 26 50 24 Q 70 26 88 18"
                  stroke="#92400E"
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d="M 18 22 Q 35 29 50 28 Q 65 29 82 22"
                  stroke="#78350F"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Contact shadow */}
            <div className="w-24 h-3 bg-black/20 rounded-full blur-[2px] -mt-2" />
          </div>

          {/* Egg Status Message */}
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border-2 border-[#58331A] bg-[#FFFDF8] px-3 py-1 text-xs font-bold text-[#58331A] shadow-[0_2px_0_#58331A]">
            <span>🐣</span>
            <span>Tu mascota está a punto de salir del huevo.</span>
          </div>
        </div>
      ) : (
        /* Hatched Pet (CatSprite + Floating Speech Bubble) */
        <div
          data-testid="pet-sprite-container"
          className="absolute top-[75%] -translate-x-1/2 -translate-y-full transition-[left] duration-500 ease-in-out z-15 flex flex-col items-center pointer-events-none"
          style={{ left: `${catX}%` }}
        >
          {/* Floating Speech Bubble */}
          {thought && thought.message && (
            <div className="pointer-events-auto mb-1 sm:mb-2 max-w-[280px]">
              <PetSpeechBubble
                thought={thought}
                petName={petRow.name}
                onOpenStreakModal={onOpenStreakModal}
              />
            </div>
          )}

          {/* Cat Sprite */}
          <div className="pointer-events-auto">
            <CatSprite
              facing={facing}
              walking={walking}
              mood={mood}
              isSick={isSick}
              isSleeping={isSleeping}
              lifeStage={lifeStage}
            />
          </div>
        </div>
      )}

      {/* Sleeping Night-Shade Filter Overlay */}
      {isSleeping && (
        <div
          data-testid="pet-sleeping-overlay"
          className="pointer-events-none absolute inset-0 bg-[#1E1B4B]/40 backdrop-brightness-90 transition-opacity duration-700 z-25 flex flex-col items-center justify-center overflow-hidden"
        >
          {/* Floating sleep atmosphere icons */}
          <span className="absolute top-[20%] right-[30%] text-2xl animate-pulse select-none">
            💤
          </span>
          <span className="absolute top-[32%] right-[25%] text-lg animate-bounce select-none">
            💤
          </span>
          <span className="absolute top-[18%] left-[25%] text-xl select-none opacity-80">
            🌙
          </span>
          <span className="absolute top-[12%] left-[45%] text-xs text-yellow-200 animate-ping select-none">
            ✨
          </span>
        </div>
      )}
    </div>
  );
}
