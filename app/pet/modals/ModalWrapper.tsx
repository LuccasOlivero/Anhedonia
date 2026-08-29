'use client';

import React, { type ReactNode } from 'react';

export interface ModalWrapperProps {
  title: string;
  icon?: string;
  onClose: () => void;
  children?: ReactNode;
  badge?: ReactNode;
  maxWidth?: string;
  className?: string;
  'data-testid'?: string;
}

export function ModalWrapper({
  title,
  icon,
  onClose,
  children,
  badge,
  maxWidth = 'max-w-lg',
  className = '',
  'data-testid': testId = 'modal-wrapper',
}: ModalWrapperProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-heading"
      data-testid={testId}
      className={`relative w-full ${maxWidth} rounded-[28px] sm:rounded-[36px] border-4 sm:border-8 border-[#58331A] ring-4 ring-inset ring-[#C89B6C] bg-[#FFF9EC] p-4 sm:p-6 shadow-[inset_0_3px_8px_rgba(0,0,0,0.15),0_16px_36px_rgba(0,0,0,0.4)] animate-pet-pop flex flex-col max-h-[90vh] overflow-hidden select-none ${className}`}
    >
      {/* Header Container */}
      <div className="relative flex items-center justify-between gap-3 pb-3 sm:pb-4 border-b-2 border-[#58331A]/20 shrink-0">
        {/* Carved Wood Title Badge */}
        <div className="flex items-center gap-2 min-w-0">
          <div
            data-testid="modal-title-badge"
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-2xl border-2 border-[#3B2210] bg-gradient-to-b from-[#804A26] to-[#58331A] text-[#FFF9EC] shadow-[inset_0_2px_4px_rgba(0,0,0,0.45),0_2px_0_rgba(255,255,255,0.25)]"
          >
            {icon && <span className="text-base sm:text-lg select-none filter drop-shadow-sm">{icon}</span>}
            <h2
              id="modal-title-heading"
              className="font-[family-name:var(--font-display)] font-bold text-sm sm:text-base md:text-lg tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] truncate"
            >
              {title}
            </h2>
          </div>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>

        {/* Red Circular Candy Close Button */}
        <button
          id="modal-close-btn"
          data-testid="modal-close-btn"
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          title="Cerrar"
          className="group relative flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-[#58331A] bg-gradient-to-b from-[#FF6B6B] via-[#EF4444] to-[#B91C1C] text-white shadow-[0_3px_0_#58331A,0_4px_8px_rgba(0,0,0,0.25)] transition-all hover:scale-105 active:scale-95 active:translate-y-[2px] active:shadow-[0_1px_0_#58331A] outline-none cursor-pointer shrink-0"
        >
          {/* Specular gloss top highlight */}
          <span className="pointer-events-none absolute top-0.5 left-1 right-1 h-1/2 rounded-t-full bg-gradient-to-b from-white/60 to-transparent" />
          <span className="font-extrabold text-sm sm:text-base leading-none select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
            ✕
          </span>
        </button>
      </div>

      {/* Modal Scrollable Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar py-3 sm:py-4 min-h-0 space-y-3">
        {children}
      </div>
    </div>
  );
}
