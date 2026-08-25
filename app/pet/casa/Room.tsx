'use client';

import { useState, useTransition, type MouseEvent } from 'react';
import Link from 'next/link';
import { clampPct, type ItemWithOwnership, type PlacedItem } from '@/lib/items';
import { CatSprite } from './CatSprite';
import { placeItem, removePlacedItem } from './actions';

const WALL_HEIGHT_PCT = 78;
const pillClass =
  'rounded-full bg-[#F0DEB4]/90 px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20 backdrop-blur-sm';

function randomPlacementPct(): number {
  return clampPct(6 + Math.random() * 88);
}

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
  const [decorateMode, setDecorateMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRoomClick(e: MouseEvent<HTMLDivElement>) {
    if (decorateMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    const target = clampPct(pct);
    setFacing(target >= catX ? 'right' : 'left');
    setWalking(true);
    setCatX(target);
    window.setTimeout(() => setWalking(false), 600);
  }

  function handleTrayTap(item: ItemWithOwnership) {
    if (!item.owned) return;
    startTransition(async () => {
      const result = await placeItem(item.id, randomPlacementPct());
      setError(result.error);
    });
  }

  function handlePlacedItemTap(placedItemId: string) {
    startTransition(async () => {
      const result = await removePlacedItem(placedItemId);
      setError(result.error);
    });
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
            <button
              key={placed.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (decorateMode) handlePlacedItemTap(placed.id);
              }}
              disabled={isPending}
              className={`absolute -translate-x-1/2 -translate-y-full text-4xl drop-shadow-md transition-transform ${
                decorateMode ? 'cursor-pointer hover:scale-110' : 'pointer-events-none cursor-default'
              }`}
              style={{ left: `${placed.position_x_pct}%`, top: `${WALL_HEIGHT_PCT + 6}%` }}
              aria-label={decorateMode ? `Quitar ${item.name}` : item.name}
            >
              {item.emoji}
              {decorateMode && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#F4436C] text-[10px] text-white">
                  ✕
                </span>
              )}
            </button>
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
        <div className="pointer-events-auto flex items-center gap-2">
          <span className={pillClass}>🪙 {coins}</span>
          <button
            type="button"
            onClick={() => setDecorateMode((v) => !v)}
            className={`${pillClass} ${decorateMode ? 'bg-[#FFD98E]/90' : ''}`}
          >
            {decorateMode ? '✅ Listo' : '🎨 Decorar'}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="pointer-events-none absolute inset-x-0 top-16 text-center text-sm font-semibold text-[#F4436C]">
          {error}
        </p>
      )}

      {decorateMode && (
        <div className="absolute inset-x-0 bottom-0 flex gap-3 overflow-x-auto bg-[#FFF9EC]/95 p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.15)]">
          {itemsWithOwnership.map((item) =>
            item.owned ? (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTrayTap(item)}
                disabled={isPending}
                className="flex shrink-0 flex-col items-center gap-1 rounded-2xl border-2 border-[#C89B6C] bg-white px-3 py-2"
              >
                <span className="text-3xl">{item.emoji}</span>
                <span className="text-xs font-semibold text-[#8B5E3C]">{item.name}</span>
              </button>
            ) : (
              <Link
                key={item.id}
                href="/pet/casa/tienda"
                className="flex shrink-0 flex-col items-center gap-1 rounded-2xl border-2 border-[#C89B6C]/50 bg-white/50 px-3 py-2 opacity-50"
              >
                <span className="text-3xl">🔒</span>
                <span className="text-xs font-semibold text-[#8B5E3C]">{item.name}</span>
                <span className="text-[10px] font-semibold text-[#8B5E3C]">🪙 {item.priceCoins}</span>
              </Link>
            )
          )}
        </div>
      )}
    </div>
  );
}
