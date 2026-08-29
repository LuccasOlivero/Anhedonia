'use client';

import { useState, useTransition } from 'react';
import { feed, play, bathe, toggleSleep, medicine } from './actions';

const BUTTON_GRADIENT = {
  feed: 'from-[#FFB199] to-[#FF8966]',
  play: 'from-[#FF9EC4] to-[#FF6FA5]',
  bathe: 'from-[#7EE8DB] to-[#4FD1C5]',
  sleep: 'from-[#C4B5FD] to-[#A78BFA]',
  medicine: 'from-[#FF6F8E] to-[#F4436C]',
};

export function ActionButtons({ isSleeping, isSick }: { isSleeping: boolean; isSick: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [showEating, setShowEating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function runAction(action: () => Promise<{ error: string | null }>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        onSuccess?.();
      }
    });
  }

  function handleFeed() {
    runAction(feed, () => {
      setShowEating(true);
      setTimeout(() => setShowEating(false), 2000);
    });
  }

  const buttonClass = (gradient: string) =>
    `rounded-full bg-gradient-to-b ${gradient} py-2 font-[family-name:var(--font-display)] font-bold text-white shadow-[0_4px_0_rgba(0,0,0,0.25)] transition-all active:translate-y-[3px] active:shadow-[0_1px_0_rgba(0,0,0,0.25)] disabled:opacity-50 disabled:active:translate-y-0 disabled:active:shadow-[0_4px_0_rgba(0,0,0,0.25)]`;

  return (
    <div className="space-y-3">
      {showEating && <p className="text-center text-sm font-semibold text-[#8B5E3C]">😋 Comiendo...</p>}
      {error && <p role="alert" className="text-center text-sm font-semibold text-[#F4436C]">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <button id="action-feed" onClick={handleFeed} disabled={isPending} className={buttonClass(BUTTON_GRADIENT.feed)}>
          🍖 Alimentar
        </button>
        <button id="action-play" onClick={() => runAction(play)} disabled={isPending || isSleeping} className={buttonClass(BUTTON_GRADIENT.play)}>
          🎮 Jugar
        </button>
        <button id="action-bathe" onClick={() => runAction(bathe)} disabled={isPending} className={buttonClass(BUTTON_GRADIENT.bathe)}>
          🛁 Bañar
        </button>
        <button id="action-sleep" onClick={() => runAction(toggleSleep)} disabled={isPending} className={buttonClass(BUTTON_GRADIENT.sleep)}>
          {isSleeping ? '☀️ Despertar' : '💤 Dormir'}
        </button>
      </div>
      {isSick && (
        <button id="action-medicine" onClick={() => runAction(medicine)} disabled={isPending} className={`w-full ${buttonClass(BUTTON_GRADIENT.medicine)}`}>
          💊 Dar medicina
        </button>
      )}
    </div>
  );
}
