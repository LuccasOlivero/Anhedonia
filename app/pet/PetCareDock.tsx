'use client';

import React, { useState, useTransition } from 'react';
import { feed, play, bathe, toggleSleep, medicine } from './actions';
import type { PetModalType } from './PetGameStage';

export interface PetCareDockProps {
  isSleeping?: boolean;
  isSick?: boolean;
  isDecorating?: boolean;
  onToggleDecorate?: () => void;
  onOpenModal?: (modal: PetModalType) => void;
  className?: string;
  // Optional action overrides for custom handling / testing
  onFeed?: () => Promise<{ error?: string | null } | void> | void;
  onPlay?: () => Promise<{ error?: string | null } | void> | void;
  onBathe?: () => Promise<{ error?: string | null } | void> | void;
  onToggleSleep?: () => Promise<{ error?: string | null } | void> | void;
  onMedicine?: () => Promise<{ error?: string | null } | void> | void;
}

export function PetCareDock({
  isSleeping = false,
  isSick = false,
  isDecorating = false,
  onToggleDecorate,
  onOpenModal,
  className = '',
  onFeed,
  onPlay,
  onBathe,
  onToggleSleep,
  onMedicine,
}: PetCareDockProps) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => {
      setFeedback((current) => (current === msg ? null : current));
    }, 2400);
  };

  const handleAction = (
    actionFn?: () => Promise<{ error?: string | null } | void> | void,
    defaultFn?: () => Promise<{ error: string | null }>,
    feedbackMsg?: string
  ) => {
    setError(null);
    startTransition(async () => {
      try {
        if (actionFn) {
          const res = await actionFn();
          if (res && typeof res === 'object' && 'error' in res && res.error) {
            setError(res.error);
            return;
          }
        } else if (defaultFn) {
          const res = await defaultFn();
          if (res?.error) {
            setError(res.error);
            return;
          }
        }
        if (feedbackMsg) {
          showFeedback(feedbackMsg);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Ocurrió un error inesperado';
        setError(message);
      }
    });
  };

  const handleFeed = () => {
    handleAction(onFeed, feed, '😋 ¡Qué rico! Comiendo...');
  };

  const handlePlay = () => {
    if (isSleeping) return;
    handleAction(onPlay, play, '❤️ ¡Qué divertido!');
  };

  const handleBathe = () => {
    handleAction(onBathe, bathe, '🫧 ¡Bien limpito!');
  };

  const handleSleep = () => {
    handleAction(
      onToggleSleep,
      toggleSleep,
      isSleeping ? '☀️ ¡Buenos días!' : '💤 A descansar...'
    );
  };

  const handleMedicine = () => {
    handleAction(onMedicine, medicine, '💊 ¡Medicina tomada!');
  };

  const handleDecorate = () => {
    if (onToggleDecorate) {
      onToggleDecorate();
    } else {
      onOpenModal?.('decorar');
    }
  };

  return (
    <div
      role="toolbar"
      aria-label="Barra de Herramientas de Cuidado y Navegación"
      data-testid="pet-care-dock"
      className={`relative w-full bg-gradient-to-b from-[#804A26] via-[#6B4226] to-[#58331A] border-t-4 border-[#3B2210] px-2 py-2 sm:px-4 sm:py-2.5 shadow-[inset_0_2px_4px_rgba(255,255,255,0.25),0_-4px_12px_rgba(0,0,0,0.3)] select-none ${className}`}
    >
      {/* Feedback & Error Floating Toasts */}
      {feedback && (
        <div
          role="status"
          data-testid="pet-dock-feedback"
          className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 rounded-full border-2 border-[#58331A] bg-[#FFF9EC] px-3.5 py-0.5 text-xs font-bold text-[#58331A] shadow-[0_3px_0_#58331A,0_4px_10px_rgba(0,0,0,0.25)] animate-pet-pop whitespace-nowrap"
        >
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          data-testid="pet-dock-error"
          className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 rounded-full border-2 border-[#881337] bg-[#FFE4E6] px-3.5 py-0.5 text-xs font-bold text-[#E11D48] shadow-[0_3px_0_#881337,0_4px_10px_rgba(0,0,0,0.25)] animate-pet-pop whitespace-nowrap"
        >
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Dock Content Container */}
      <div className="flex items-center justify-between gap-1 sm:gap-2 md:gap-3 max-w-full overflow-x-auto no-scrollbar py-0.5">
        {/* Left / Center Section: Primary Care Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0" data-testid="care-tools-group">
          {/* 🍖 Alimentar */}
          <button
            id="action-feed"
            data-testid="dock-feed-btn"
            type="button"
            onClick={handleFeed}
            disabled={isPending}
            title="Alimentar a tu mascota"
            aria-label="Alimentar"
            className="group relative flex flex-col items-center justify-center w-11 h-11 sm:w-12 sm:h-12 md:w-13 md:h-13 rounded-full border-2 border-[#58331A] bg-gradient-to-b from-[#FFA07A] via-[#FF8966] to-[#FF6347] text-white shadow-[0_3px_0_#3B2210,0_4px_8px_rgba(0,0,0,0.25)] transition-all hover:scale-105 active:scale-95 active:translate-y-[2px] active:shadow-[0_1px_0_#3B2210] disabled:opacity-50 disabled:pointer-events-none outline-none cursor-pointer"
          >
            {/* Top Gloss Reflection */}
            <span className="pointer-events-none absolute top-0.5 left-1.5 right-1.5 h-1/2 rounded-t-full bg-gradient-to-b from-white/60 to-transparent" />
            <span className="text-xl sm:text-2xl filter drop-shadow-sm select-none group-hover:rotate-6 transition-transform">
              🍖
            </span>
            {/* Tooltip */}
            <div
              role="tooltip"
              className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-40 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-all duration-150 transform scale-90 group-hover:scale-100 rounded-lg border-2 border-[#58331A] bg-[#FFF9EC] px-2 py-0.5 text-center text-xs font-bold text-[#58331A] shadow-[0_2px_0_#58331A] whitespace-nowrap"
            >
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rotate-45 border-b-2 border-r-2 border-[#58331A] bg-[#FFF9EC]" />
              Alimentar
            </div>
          </button>

          {/* 🎮 Jugar */}
          <button
            id="action-play"
            data-testid="dock-play-btn"
            type="button"
            onClick={handlePlay}
            disabled={isPending || isSleeping}
            title={isSleeping ? 'Tu mascota está durmiendo' : 'Jugar con tu mascota'}
            aria-label="Jugar"
            className="group relative flex flex-col items-center justify-center w-11 h-11 sm:w-12 sm:h-12 md:w-13 md:h-13 rounded-full border-2 border-[#58331A] bg-gradient-to-b from-[#FF9EC4] via-[#FF75A9] to-[#EC4899] text-white shadow-[0_3px_0_#3B2210,0_4px_8px_rgba(0,0,0,0.25)] transition-all hover:scale-105 active:scale-95 active:translate-y-[2px] active:shadow-[0_1px_0_#3B2210] disabled:opacity-40 disabled:pointer-events-none outline-none cursor-pointer"
          >
            <span className="pointer-events-none absolute top-0.5 left-1.5 right-1.5 h-1/2 rounded-t-full bg-gradient-to-b from-white/60 to-transparent" />
            <span className="text-xl sm:text-2xl filter drop-shadow-sm select-none group-hover:rotate-6 transition-transform">
              🎮
            </span>
            <div
              role="tooltip"
              className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-40 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-all duration-150 transform scale-90 group-hover:scale-100 rounded-lg border-2 border-[#58331A] bg-[#FFF9EC] px-2 py-0.5 text-center text-xs font-bold text-[#58331A] shadow-[0_2px_0_#58331A] whitespace-nowrap"
            >
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rotate-45 border-b-2 border-r-2 border-[#58331A] bg-[#FFF9EC]" />
              {isSleeping ? 'Durmiendo' : 'Jugar'}
            </div>
          </button>

          {/* 🛁 Bañar */}
          <button
            id="action-bathe"
            data-testid="dock-bathe-btn"
            type="button"
            onClick={handleBathe}
            disabled={isPending}
            title="Bañar a tu mascota"
            aria-label="Bañar"
            className="group relative flex flex-col items-center justify-center w-11 h-11 sm:w-12 sm:h-12 md:w-13 md:h-13 rounded-full border-2 border-[#58331A] bg-gradient-to-b from-[#7EE8DB] via-[#4FD1C5] to-[#20B2AA] text-white shadow-[0_3px_0_#3B2210,0_4px_8px_rgba(0,0,0,0.25)] transition-all hover:scale-105 active:scale-95 active:translate-y-[2px] active:shadow-[0_1px_0_#3B2210] disabled:opacity-50 disabled:pointer-events-none outline-none cursor-pointer"
          >
            <span className="pointer-events-none absolute top-0.5 left-1.5 right-1.5 h-1/2 rounded-t-full bg-gradient-to-b from-white/60 to-transparent" />
            <span className="text-xl sm:text-2xl filter drop-shadow-sm select-none group-hover:rotate-6 transition-transform">
              🛁
            </span>
            <div
              role="tooltip"
              className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-40 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-all duration-150 transform scale-90 group-hover:scale-100 rounded-lg border-2 border-[#58331A] bg-[#FFF9EC] px-2 py-0.5 text-center text-xs font-bold text-[#58331A] shadow-[0_2px_0_#58331A] whitespace-nowrap"
            >
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rotate-45 border-b-2 border-r-2 border-[#58331A] bg-[#FFF9EC]" />
              Bañar
            </div>
          </button>

          {/* 💤 Dormir / ☀️ Despertar */}
          <button
            id="action-sleep"
            data-testid="dock-sleep-btn"
            type="button"
            onClick={handleSleep}
            disabled={isPending}
            title={isSleeping ? 'Despertar a tu mascota' : 'Hacer dormir a tu mascota'}
            aria-label={isSleeping ? 'Despertar' : 'Dormir'}
            className={`group relative flex flex-col items-center justify-center w-11 h-11 sm:w-12 sm:h-12 md:w-13 md:h-13 rounded-full border-2 border-[#58331A] ${
              isSleeping
                ? 'bg-gradient-to-b from-[#FDE047] via-[#FBBF24] to-[#F59E0B] text-[#58331A]'
                : 'bg-gradient-to-b from-[#C4B5FD] via-[#A78BFA] to-[#8B5CF6] text-white'
            } shadow-[0_3px_0_#3B2210,0_4px_8px_rgba(0,0,0,0.25)] transition-all hover:scale-105 active:scale-95 active:translate-y-[2px] active:shadow-[0_1px_0_#3B2210] disabled:opacity-50 disabled:pointer-events-none outline-none cursor-pointer`}
          >
            <span className="pointer-events-none absolute top-0.5 left-1.5 right-1.5 h-1/2 rounded-t-full bg-gradient-to-b from-white/60 to-transparent" />
            <span className="text-xl sm:text-2xl filter drop-shadow-sm select-none group-hover:rotate-6 transition-transform">
              {isSleeping ? '☀️' : '💤'}
            </span>
            <div
              role="tooltip"
              className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-40 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-all duration-150 transform scale-90 group-hover:scale-100 rounded-lg border-2 border-[#58331A] bg-[#FFF9EC] px-2 py-0.5 text-center text-xs font-bold text-[#58331A] shadow-[0_2px_0_#58331A] whitespace-nowrap"
            >
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rotate-45 border-b-2 border-r-2 border-[#58331A] bg-[#FFF9EC]" />
              {isSleeping ? 'Despertar' : 'Dormir'}
            </div>
          </button>

          {/* 💊 Medicina */}
          <button
            id="action-medicine"
            data-testid="dock-medicine-btn"
            type="button"
            onClick={handleMedicine}
            disabled={isPending}
            title={isSick ? '¡Dar medicina a tu mascota enferma!' : 'Dar medicina'}
            aria-label="Dar medicina"
            className={`group relative flex flex-col items-center justify-center w-11 h-11 sm:w-12 sm:h-12 md:w-13 md:h-13 rounded-full border-2 border-[#58331A] bg-gradient-to-b from-[#FF6F8E] via-[#F4436C] to-[#E11D48] text-white shadow-[0_3px_0_#3B2210,0_4px_8px_rgba(0,0,0,0.25)] transition-all hover:scale-105 active:scale-95 active:translate-y-[2px] active:shadow-[0_1px_0_#3B2210] disabled:opacity-50 disabled:pointer-events-none outline-none cursor-pointer ${
              isSick ? 'animate-pulse ring-2 ring-rose-400 ring-offset-2 ring-offset-[#58331A]' : 'opacity-90'
            }`}
          >
            <span className="pointer-events-none absolute top-0.5 left-1.5 right-1.5 h-1/2 rounded-t-full bg-gradient-to-b from-white/60 to-transparent" />
            <span className="text-xl sm:text-2xl filter drop-shadow-sm select-none group-hover:rotate-6 transition-transform">
              💊
            </span>
            <div
              role="tooltip"
              className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-40 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-all duration-150 transform scale-90 group-hover:scale-100 rounded-lg border-2 border-[#58331A] bg-[#FFF9EC] px-2 py-0.5 text-center text-xs font-bold text-[#58331A] shadow-[0_2px_0_#58331A] whitespace-nowrap"
            >
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rotate-45 border-b-2 border-r-2 border-[#58331A] bg-[#FFF9EC]" />
              {isSick ? '¡Curar!' : 'Medicina'}
            </div>
          </button>
        </div>

        {/* Carved Wooden Divider */}
        <div
          data-testid="dock-divider"
          className="w-[3px] h-8 sm:h-10 bg-gradient-to-b from-[#3B2210] via-[#2A180B] to-[#3B2210] border-r border-[#FFF9EC]/20 rounded-full mx-0.5 sm:mx-1 shrink-0"
        />

        {/* Right Section: Navigation / In-Game Modal Triggers */}
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0" data-testid="nav-tools-group">
          {/* 🎨 Decorar */}
          <button
            id="action-decorate"
            data-testid="dock-decorate-btn"
            type="button"
            onClick={handleDecorate}
            title={isDecorating ? 'Terminar de decorar' : 'Decorar la habitación'}
            aria-label="Decorar"
            className={`group relative flex flex-col items-center justify-center w-11 h-11 sm:w-12 sm:h-12 md:w-13 md:h-13 rounded-full border-2 border-[#58331A] ${
              isDecorating
                ? 'bg-gradient-to-b from-[#FDE047] via-[#FBBF24] to-[#F59E0B] text-[#58331A] ring-2 ring-amber-300 ring-offset-2 ring-offset-[#58331A]'
                : 'bg-gradient-to-b from-[#86EFAC] via-[#4ADE80] to-[#22C55E] text-[#14532D]'
            } shadow-[0_3px_0_#3B2210,0_4px_8px_rgba(0,0,0,0.25)] transition-all hover:scale-105 active:scale-95 active:translate-y-[2px] active:shadow-[0_1px_0_#3B2210] outline-none cursor-pointer`}
          >
            <span className="pointer-events-none absolute top-0.5 left-1.5 right-1.5 h-1/2 rounded-t-full bg-gradient-to-b from-white/60 to-transparent" />
            <span className="text-xl sm:text-2xl filter drop-shadow-sm select-none group-hover:rotate-6 transition-transform">
              🎨
            </span>
            <div
              role="tooltip"
              className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-40 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-all duration-150 transform scale-90 group-hover:scale-100 rounded-lg border-2 border-[#58331A] bg-[#FFF9EC] px-2 py-0.5 text-center text-xs font-bold text-[#58331A] shadow-[0_2px_0_#58331A] whitespace-nowrap"
            >
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rotate-45 border-b-2 border-r-2 border-[#58331A] bg-[#FFF9EC]" />
              {isDecorating ? 'Listo' : 'Decorar'}
            </div>
          </button>

          {/* 🏬 Tienda */}
          <button
            id="action-tienda"
            data-testid="dock-tienda-btn"
            type="button"
            onClick={() => onOpenModal?.('tienda')}
            title="Ir a la Tienda de muebles"
            aria-label="Tienda"
            className="group relative flex flex-col items-center justify-center w-11 h-11 sm:w-12 sm:h-12 md:w-13 md:h-13 rounded-full border-2 border-[#58331A] bg-gradient-to-b from-[#FDE047] via-[#FBBF24] to-[#F59E0B] text-[#58331A] shadow-[0_3px_0_#3B2210,0_4px_8px_rgba(0,0,0,0.25)] transition-all hover:scale-105 active:scale-95 active:translate-y-[2px] active:shadow-[0_1px_0_#3B2210] outline-none cursor-pointer"
          >
            <span className="pointer-events-none absolute top-0.5 left-1.5 right-1.5 h-1/2 rounded-t-full bg-gradient-to-b from-white/60 to-transparent" />
            <span className="text-xl sm:text-2xl filter drop-shadow-sm select-none group-hover:rotate-6 transition-transform">
              🏬
            </span>
            <div
              role="tooltip"
              className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-40 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-all duration-150 transform scale-90 group-hover:scale-100 rounded-lg border-2 border-[#58331A] bg-[#FFF9EC] px-2 py-0.5 text-center text-xs font-bold text-[#58331A] shadow-[0_2px_0_#58331A] whitespace-nowrap"
            >
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rotate-45 border-b-2 border-r-2 border-[#58331A] bg-[#FFF9EC]" />
              Tienda
            </div>
          </button>

          {/* 📔 Diario */}
          <button
            id="action-diario"
            data-testid="dock-diario-btn"
            type="button"
            onClick={() => onOpenModal?.('diario')}
            title="Abrir el Diario de recuerdos"
            aria-label="Diario"
            className="group relative flex flex-col items-center justify-center w-11 h-11 sm:w-12 sm:h-12 md:w-13 md:h-13 rounded-full border-2 border-[#58331A] bg-gradient-to-b from-[#F0DEB4] via-[#E2C799] to-[#C89B6C] text-[#58331A] shadow-[0_3px_0_#3B2210,0_4px_8px_rgba(0,0,0,0.25)] transition-all hover:scale-105 active:scale-95 active:translate-y-[2px] active:shadow-[0_1px_0_#3B2210] outline-none cursor-pointer"
          >
            <span className="pointer-events-none absolute top-0.5 left-1.5 right-1.5 h-1/2 rounded-t-full bg-gradient-to-b from-white/60 to-transparent" />
            <span className="text-xl sm:text-2xl filter drop-shadow-sm select-none group-hover:rotate-6 transition-transform">
              📔
            </span>
            <div
              role="tooltip"
              className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-40 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-all duration-150 transform scale-90 group-hover:scale-100 rounded-lg border-2 border-[#58331A] bg-[#FFF9EC] px-2 py-0.5 text-center text-xs font-bold text-[#58331A] shadow-[0_2px_0_#58331A] whitespace-nowrap"
            >
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rotate-45 border-b-2 border-r-2 border-[#58331A] bg-[#FFF9EC]" />
              Diario
            </div>
          </button>

          {/* 🎯 Misiones */}
          <button
            id="action-misiones"
            data-testid="dock-misiones-btn"
            type="button"
            onClick={() => onOpenModal?.('misiones')}
            title="Ver Misiones y Recompensas"
            aria-label="Misiones"
            className="group relative flex flex-col items-center justify-center w-11 h-11 sm:w-12 sm:h-12 md:w-13 md:h-13 rounded-full border-2 border-[#58331A] bg-gradient-to-b from-[#93C5FD] via-[#60A5FA] to-[#3B82F6] text-white shadow-[0_3px_0_#3B2210,0_4px_8px_rgba(0,0,0,0.25)] transition-all hover:scale-105 active:scale-95 active:translate-y-[2px] active:shadow-[0_1px_0_#3B2210] outline-none cursor-pointer"
          >
            <span className="pointer-events-none absolute top-0.5 left-1.5 right-1.5 h-1/2 rounded-t-full bg-gradient-to-b from-white/60 to-transparent" />
            <span className="text-xl sm:text-2xl filter drop-shadow-sm select-none group-hover:rotate-6 transition-transform">
              🎯
            </span>
            <div
              role="tooltip"
              className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-40 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-all duration-150 transform scale-90 group-hover:scale-100 rounded-lg border-2 border-[#58331A] bg-[#FFF9EC] px-2 py-0.5 text-center text-xs font-bold text-[#58331A] shadow-[0_2px_0_#58331A] whitespace-nowrap"
            >
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rotate-45 border-b-2 border-r-2 border-[#58331A] bg-[#FFF9EC]" />
              Misiones
            </div>
          </button>

          {/* ✉️ Notificaciones */}
          <button
            id="action-notificaciones"
            data-testid="dock-notificaciones-btn"
            type="button"
            onClick={() => onOpenModal?.('notificaciones')}
            title="Ajustes de Notificaciones"
            aria-label="Notificaciones"
            className="group relative flex flex-col items-center justify-center w-11 h-11 sm:w-12 sm:h-12 md:w-13 md:h-13 rounded-full border-2 border-[#58331A] bg-gradient-to-b from-[#A5F3FC] via-[#38BDF8] to-[#0284C7] text-white shadow-[0_3px_0_#3B2210,0_4px_8px_rgba(0,0,0,0.25)] transition-all hover:scale-105 active:scale-95 active:translate-y-[2px] active:shadow-[0_1px_0_#3B2210] outline-none cursor-pointer"
          >
            <span className="pointer-events-none absolute top-0.5 left-1.5 right-1.5 h-1/2 rounded-t-full bg-gradient-to-b from-white/60 to-transparent" />
            <span className="text-xl sm:text-2xl filter drop-shadow-sm select-none group-hover:rotate-6 transition-transform">
              ✉️
            </span>
            <div
              role="tooltip"
              className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-40 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-all duration-150 transform scale-90 group-hover:scale-100 rounded-lg border-2 border-[#58331A] bg-[#FFF9EC] px-2 py-0.5 text-center text-xs font-bold text-[#58331A] shadow-[0_2px_0_#58331A] whitespace-nowrap"
            >
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rotate-45 border-b-2 border-r-2 border-[#58331A] bg-[#FFF9EC]" />
              Notificaciones
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
