'use client';

import { useState, useTransition } from 'react';
import { buyItem } from './actions';

export function BuyButton({ itemId, affordable }: { itemId: string; affordable: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleBuy() {
    startTransition(async () => {
      const result = await buyItem(itemId);
      setError(result.error);
    });
  }

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        onClick={handleBuy}
        disabled={isPending || !affordable}
        className="rounded-full bg-gradient-to-b from-[#FF9EC4] to-[#FF6FA5] px-4 py-2 font-[family-name:var(--font-display)] font-bold text-white shadow-[0_4px_0_rgba(0,0,0,0.25)] transition-all active:translate-y-[3px] active:shadow-[0_1px_0_rgba(0,0,0,0.25)] disabled:opacity-50"
      >
        {isPending ? 'Comprando...' : 'Comprar'}
      </button>
      {error && <p role="alert" className="mt-1 text-xs font-semibold text-[#F4436C]">{error}</p>}
    </div>
  );
}
