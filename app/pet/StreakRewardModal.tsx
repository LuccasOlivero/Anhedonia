'use client';

import { useState } from 'react';
import type { StreakReward } from '@/lib/attachment';
import { claimStreakRewardAction } from './actions';

interface Props {
  reward: StreakReward;
  petName: string;
  onClose: () => void;
}

export function StreakRewardModal({ reward, petName, onClose }: Props) {
  const [claiming, setClaiming] = useState(false);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      await claimStreakRewardAction();
      onClose();
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[2rem] border-8 border-[#6B4226] ring-4 ring-inset ring-[#C89B6C] bg-[#FFF9EC] p-6 text-center shadow-[inset_0_3px_6px_rgba(0,0,0,0.15),0_10px_20px_rgba(0,0,0,0.3)] animate-in fade-in zoom-in duration-200">
        <div className="mb-3 text-4xl">🎁</div>
        <h2 className="text-xl font-[family-name:var(--font-display)] font-bold text-[#4A3222]">
          ¡Sorpresa de {petName}!
        </h2>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#8B5E3C]">
          Racha de {reward.milestone} días de cuidado
        </p>

        <div className="my-4 rounded-xl border-2 border-[#6B4226]/20 bg-[#FFF3C4]/60 p-4 text-sm font-medium text-[#4A3222] italic">
          &ldquo;{reward.diaryContent}&rdquo;
        </div>

        <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#FFF3C4] px-4 py-1.5 text-base font-bold text-[#8B5E3C] ring-2 ring-[#6B4226]/20">
          <span>+{reward.coins} Monedas</span> 🪙
        </div>

        <p className="mb-5 text-xs text-[#8B5E3C]">
          ✨ Se guardará esta cartita en tu Diario de recuerdos.
        </p>

        <button
          onClick={handleClaim}
          disabled={claiming}
          className="w-full rounded-2xl border-4 border-[#6B4226] bg-gradient-to-b from-[#FCD34D] to-[#F59E0B] px-6 py-3 font-[family-name:var(--font-display)] text-lg font-bold text-[#4A3222] shadow-[0_4px_0_#6B4226] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 cursor-pointer"
        >
          {claiming ? 'Guardando...' : '¡Gracias! (Reclamar)'}
        </button>
      </div>
    </div>
  );
}
