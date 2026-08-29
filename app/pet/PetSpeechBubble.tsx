'use client';

import { useState } from 'react';
import type { PetThought, StreakReward } from '@/lib/attachment';
import { StreakRewardModal } from './StreakRewardModal';

export interface PetSpeechBubbleProps {
  thought: PetThought;
  petName: string;
  className?: string;
  onOpenStreakModal?: (reward: StreakReward) => void;
}

export function PetSpeechBubble({
  thought,
  petName,
  className = '',
  onOpenStreakModal,
}: PetSpeechBubbleProps) {
  const [showModal, setShowModal] = useState(false);
  const [loved, setLoved] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (thought.type === 'gift' && thought.reward) {
      if (onOpenStreakModal) {
        onOpenStreakModal(thought.reward);
      } else {
        setShowModal(true);
      }
    } else if (thought.type === 'vulnerability' && thought.action) {
      const el = document.getElementById(`action-${thought.action}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-amber-400');
        setTimeout(() => el.classList.remove('ring-4', 'ring-amber-400'), 1500);
      }
    } else {
      setLoved(true);
      setTimeout(() => setLoved(false), 2000);
    }
  };

  return (
    <>
      <div className={`relative flex flex-col items-center ${className}`}>
        <button
          type="button"
          onClick={handleClick}
          className="group relative max-w-[280px] rounded-2xl border-2 border-[#6B4226] bg-[#FFF9EC] px-4 py-2 text-center text-xs sm:text-sm font-semibold text-[#4A3222] shadow-[0_3px_6px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer select-none"
        >
          {loved ? '¡Prrr! ❤️' : thought.message}
          {thought.type === 'gift' && (
            <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-[#6B4226] ring-2 ring-[#6B4226] animate-bounce">
              🎁
            </span>
          )}
          {/* Bubble tail */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-0 w-0 border-x-8 border-x-transparent border-t-8 border-t-[#6B4226]" />
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-0 w-0 border-x-7 border-x-transparent border-t-7 border-t-[#FFF9EC]" />
        </button>
      </div>

      {showModal && thought.reward && (
        <StreakRewardModal
          reward={thought.reward}
          petName={petName}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
