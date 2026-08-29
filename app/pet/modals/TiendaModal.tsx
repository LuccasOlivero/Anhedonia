'use client';

import React, { useState, useTransition } from 'react';
import { ITEMS, type Item, type OwnedItem } from '@/lib/items';
import { buyItem } from '@/app/pet/casa/tienda/actions';
import { ModalWrapper } from './ModalWrapper';

export interface TiendaModalProps {
  coins?: number;
  ownedItems?: OwnedItem[] | string[];
  items?: Item[];
  onClose?: () => void;
  onBuyItem?: (itemId: string) => Promise<{ error?: string | null } | void> | void;
  className?: string;
}

export function TiendaModal({
  coins = 0,
  ownedItems = [],
  items = ITEMS,
  onClose = () => {},
  onBuyItem,
  className = '',
}: TiendaModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Normalize owned item IDs set for fast O(1) lookups
  const ownedSet = React.useMemo(() => {
    const set = new Set<string>();
    for (const entry of ownedItems) {
      if (typeof entry === 'string') {
        set.add(entry);
      } else if (entry && typeof entry === 'object' && 'item_id' in entry) {
        set.add(entry.item_id);
      }
    }
    return set;
  }, [ownedItems]);

  const handleBuy = (item: Item) => {
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      try {
        if (onBuyItem) {
          const res = await onBuyItem(item.id);
          if (res && typeof res === 'object' && 'error' in res && res.error) {
            setError(res.error);
            return;
          }
        } else {
          const res = await buyItem(item.id);
          if (res?.error) {
            setError(res.error);
            return;
          }
        }
        setSuccessMsg(`¡Compraste ${item.name}! 🛍️`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al procesar la compra';
        setError(message);
      }
    });
  };

  const coinsBadge = (
    <div
      data-testid="tienda-coins-badge"
      className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-full border-2 border-[#58331A] bg-gradient-to-b from-[#FFF3C4] via-[#FDE047] to-[#F59E0B] text-[#58331A] font-bold text-xs sm:text-sm shadow-[0_2px_0_#58331A]"
    >
      <span>🪙</span>
      <span className="font-[family-name:var(--font-display)]">{coins.toLocaleString()}</span>
    </div>
  );

  return (
    <ModalWrapper
      title="Tienda de Muebles"
      icon="🏬"
      onClose={onClose}
      badge={coinsBadge}
      maxWidth="max-w-xl"
      className={className}
      data-testid="tienda-modal"
    >
      <div className="space-y-4">
        {/* Intro text */}
        <p className="text-xs sm:text-sm font-semibold text-[#8B5E3C] text-center">
          Elegí muebles y decoraciones para personalizar la habitación de tu mascota.
        </p>

        {/* Feedback / Error notifications */}
        {successMsg && (
          <div
            role="status"
            data-testid="tienda-success-msg"
            className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-[#22C55E]/40 bg-[#DCFCE7] p-2.5 text-center text-xs sm:text-sm font-bold text-[#15803D] shadow-sm animate-pet-pop"
          >
            <span>✨</span>
            <span>{successMsg}</span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            data-testid="tienda-error-msg"
            className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-[#EF4444]/40 bg-[#FEE2E2] p-2.5 text-center text-xs sm:text-sm font-bold text-[#B91C1C] shadow-sm animate-pet-pop"
          >
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Items Catalog Grid */}
        <div
          data-testid="tienda-items-grid"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3"
        >
          {items.map((item) => {
            const isOwned = ownedSet.has(item.id);
            const canAfford = coins >= item.priceCoins;
            const isFree = item.priceCoins === 0;

            return (
              <div
                key={item.id}
                data-testid={`tienda-item-${item.id}`}
                className="group flex flex-col items-center justify-between rounded-2xl border-2 border-[#C89B6C]/60 bg-[#FFFDF8] p-2.5 sm:p-3 text-center shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_3px_6px_rgba(88,51,26,0.08)] hover:border-[#804A26] transition-all"
              >
                {/* Emoji Display Box */}
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-2xl border-2 border-[#C89B6C]/40 bg-gradient-to-b from-[#FFFDF8] to-[#FFF3C4]/60 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] mb-2">
                  <span className="text-3xl sm:text-4xl filter drop-shadow-sm select-none group-hover:scale-110 transition-transform">
                    {item.emoji}
                  </span>
                </div>

                {/* Item Name */}
                <h3 className="font-[family-name:var(--font-display)] font-bold text-xs sm:text-sm text-[#4A3222] truncate w-full mb-1">
                  {item.name}
                </h3>

                {/* Price Capsule */}
                <div className="mb-2.5 inline-flex items-center gap-1 rounded-full bg-[#FFF3C4] px-2.5 py-0.5 text-xs font-bold text-[#8B5E3C] border border-[#6B4226]/15">
                  <span>🪙</span>
                  <span>{isFree ? 'Gratis' : item.priceCoins}</span>
                </div>

                {/* Purchase Button / Owned Status */}
                {isOwned ? (
                  <button
                    type="button"
                    disabled
                    aria-label={`${item.name} ya comprado`}
                    data-testid={`buy-btn-${item.id}`}
                    className="w-full py-1.5 px-2 rounded-full border-2 border-[#C89B6C]/40 bg-[#E2C799]/30 text-xs font-bold text-[#8B5E3C] cursor-not-allowed opacity-80 select-none"
                  >
                    Ya lo tenés
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleBuy(item)}
                    disabled={isPending || !canAfford}
                    aria-label={`Comprar ${item.name}`}
                    title={!canAfford ? 'No tenés suficientes monedas' : `Comprar por ${item.priceCoins} monedas`}
                    data-testid={`buy-btn-${item.id}`}
                    className={`w-full py-1.5 px-2 rounded-full border-2 border-[#58331A] text-xs font-bold transition-all shadow-[0_2px_0_#58331A] active:translate-y-[1px] active:shadow-none select-none ${
                      canAfford
                        ? 'bg-gradient-to-b from-[#FF9EC4] via-[#FF75A9] to-[#EC4899] text-white hover:brightness-105 cursor-pointer'
                        : 'bg-[#D1D5DB] text-[#6B7280] border-[#9CA3AF] cursor-not-allowed opacity-60 shadow-none'
                    }`}
                  >
                    {isPending ? '...' : 'Comprar'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </ModalWrapper>
  );
}
