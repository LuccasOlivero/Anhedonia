'use client';

import { useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { clampPct, type ItemWithOwnership, type PlacedItem } from '@/lib/items';
import { CatSprite } from './CatSprite';

const WALL_HEIGHT_PCT = 78;
const pillClass =
  'rounded-full bg-[#F0DEB4]/90 px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20 backdrop-blur-sm';

export function Room({
  petName,
  coins,
  initialPlacedItems,
  itemsWithOwnership,
}: {
  petName: string;
  coins: number;
  initialPlacedItems: PlacedItem[];
  itemsWithOwnership: ItemWithOwnership[];
}) {
  const [catX, setCatX] = useState(50);
  const [facing, setFacing] = useState<'left' | 'right'>('right');
  const [walking, setWalking] = useState(false);

  function handleRoomClick(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    const target = clampPct(pct);
    setFacing(target >= catX ? 'right' : 'left');
    setWalking(true);
    setCatX(target);
    window.setTimeout(() => setWalking(false), 600);
  }

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <div className="absolute inset-x-0 top-0" style={{ height: `${WALL_HEIGHT_PCT}%`, background: '#FDE9C8' }} />
      <div
        className="absolute inset-x-0 bottom-0 border-t-4 border-[#6B4226]"
        style={{ height: `${100 - WALL_HEIGHT_PCT}%`, background: '#C89B6C' }}
      />

      <div className="absolute inset-0" onClick={handleRoomClick}>
        {initialPlacedItems.map((placed) => {
          const item = itemsWithOwnership.find((i) => i.id === placed.item_id);
          if (!item) return null;
          return (
            <span
              key={placed.id}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-full text-4xl drop-shadow-md"
              style={{ left: `${placed.position_x_pct}%`, top: `${WALL_HEIGHT_PCT + 6}%` }}
            >
              {item.emoji}
            </span>
          );
        })}

        <div
          className="absolute -translate-x-1/2 -translate-y-full transition-[left] duration-500 ease-in-out"
          style={{ left: `${catX}%`, top: `${WALL_HEIGHT_PCT}%` }}
        >
          <CatSprite facing={facing} walking={walking} />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-4">
        <Link href="/pet" className={`${pillClass} pointer-events-auto`}>
          ← Back
        </Link>
        <h1 className={`${pillClass} pointer-events-auto font-[family-name:var(--font-display)]`}>{petName}</h1>
        <span className={`${pillClass} pointer-events-auto`}>🪙 {coins}</span>
      </div>
    </div>
  );
}
