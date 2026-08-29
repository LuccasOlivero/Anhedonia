'use client';

import React, { useState, useTransition } from 'react';
import type { NotificationPreferences } from '@/lib/notifications';
import {
  setDailyBonusEmailEnabled,
  toggleStreakSurpriseEmailAction,
} from '@/app/pet/notificaciones/actions';
import { ModalWrapper } from './ModalWrapper';

export interface NotificacionesModalProps {
  dailyBonusEmailEnabled?: boolean;
  streakSurpriseEmailEnabled?: boolean;
  prefs?: NotificationPreferences;
  petName?: string;
  onToggleDailyBonus?: (enabled: boolean) => Promise<{ error?: string | null } | void>;
  onToggleStreakSurprise?: (enabled: boolean) => Promise<{ error?: string | null } | void>;
  onClose?: () => void;
  className?: string;
}

export function NotificacionesModal({
  dailyBonusEmailEnabled: initialDaily,
  streakSurpriseEmailEnabled: initialStreak,
  prefs,
  petName,
  onToggleDailyBonus,
  onToggleStreakSurprise,
  onClose = () => {},
  className = '',
}: NotificacionesModalProps) {
  const defaultDaily = prefs?.daily_bonus_email_enabled ?? initialDaily ?? false;
  const defaultStreak = prefs?.streak_surprise_email_enabled ?? initialStreak ?? false;

  const [dailyBonus, setDailyBonus] = useState(defaultDaily);
  const [streakSurprise, setStreakSurprise] = useState(defaultStreak);

  const [isPendingDaily, startTransitionDaily] = useTransition();
  const [isPendingStreak, startTransitionStreak] = useTransition();

  const [error, setError] = useState<string | null>(null);

  const handleToggleDaily = () => {
    const next = !dailyBonus;
    setError(null);

    startTransitionDaily(async () => {
      try {
        if (onToggleDailyBonus) {
          const res = await onToggleDailyBonus(next);
          if (res && typeof res === 'object' && 'error' in res && res.error) {
            setError(res.error);
            return;
          }
        } else {
          const res = await setDailyBonusEmailEnabled(next);
          if (res?.error) {
            setError(res.error);
            return;
          }
        }
        setDailyBonus(next);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al cambiar preferencia';
        setError(message);
      }
    });
  };

  const handleToggleStreak = () => {
    const next = !streakSurprise;
    setError(null);

    startTransitionStreak(async () => {
      try {
        if (onToggleStreakSurprise) {
          const res = await onToggleStreakSurprise(next);
          if (res && typeof res === 'object' && 'error' in res && res.error) {
            setError(res.error);
            return;
          }
        } else {
          const res = await toggleStreakSurpriseEmailAction(next);
          if (res?.error) {
            setError(res.error);
            return;
          }
        }
        setStreakSurprise(next);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al cambiar preferencia';
        setError(message);
      }
    });
  };

  const title = petName ? `Notificaciones de ${petName}` : 'Notificaciones';

  return (
    <ModalWrapper
      title={title}
      icon="✉️"
      onClose={onClose}
      maxWidth="max-w-lg"
      className={className}
      data-testid="notificaciones-modal"
    >
      <div className="space-y-4">
        {/* Intro */}
        <p className="text-xs sm:text-sm font-semibold text-[#8B5E3C] text-center">
          Elegí qué avisos querés recibir en tu correo electrónico.
        </p>

        {error && (
          <div
            role="alert"
            data-testid="notificaciones-error-msg"
            className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-[#EF4444]/40 bg-[#FEE2E2] p-2.5 text-center text-xs font-bold text-[#B91C1C] animate-pet-pop"
          >
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div className="rounded-2xl border-2 border-[#C89B6C]/60 bg-[#FFFDF8] p-4 space-y-4 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_2px_4px_rgba(88,51,26,0.06)]">
          {/* Toggle 1: Daily Bonus */}
          <div
            data-testid="toggle-item-daily-bonus"
            className="flex items-start justify-between gap-3 cursor-pointer"
            onClick={handleToggleDaily}
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <label
                id="daily-bonus-label"
                htmlFor="daily-bonus-switch"
                className="font-[family-name:var(--font-display)] font-bold text-xs sm:text-sm text-[#4A3222] flex items-center gap-1.5 cursor-pointer"
              >
                <span>🪙</span>
                <span>Avisarme cuando mi bono diario esté listo</span>
              </label>
              <p className="text-[11px] font-medium text-[#8B5E3C]">
                Te enviamos un email recordatorio cuando tengas monedas gratis para reclamar.
              </p>
            </div>

            <button
              id="daily-bonus-switch"
              data-testid="daily-bonus-switch"
              type="button"
              role="switch"
              aria-checked={dailyBonus}
              aria-labelledby="daily-bonus-label"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleDaily();
              }}
              disabled={isPendingDaily}
              className={`relative h-7 w-12 shrink-0 rounded-full border-2 border-[#58331A] transition-colors shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] disabled:opacity-50 cursor-pointer ${
                dailyBonus
                  ? 'bg-gradient-to-r from-[#A78BFA] to-[#8B5CF6]'
                  : 'bg-[#D8C7A8]'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_2px_0_rgba(0,0,0,0.15)] transition-transform ${
                  dailyBonus ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <hr className="border-t-2 border-[#6B4226]/10" />

          {/* Toggle 2: Streak Surprise */}
          <div
            data-testid="toggle-item-streak-surprise"
            className="flex items-start justify-between gap-3 cursor-pointer"
            onClick={handleToggleStreak}
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <label
                id="streak-surprise-label"
                htmlFor="streak-surprise-switch"
                className="font-[family-name:var(--font-display)] font-bold text-xs sm:text-sm text-[#4A3222] flex items-center gap-1.5 cursor-pointer"
              >
                <span>🎁</span>
                <span>Avisarme cuando mi mascota tenga un regalo o sorpresa</span>
              </label>
              <p className="text-[11px] font-medium text-[#8B5E3C]">
                Te avisamos cuando alcances una racha de cuidado y desbloquees una cartita especial en el diario.
              </p>
            </div>

            <button
              id="streak-surprise-switch"
              data-testid="streak-surprise-switch"
              type="button"
              role="switch"
              aria-checked={streakSurprise}
              aria-labelledby="streak-surprise-label"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleStreak();
              }}
              disabled={isPendingStreak}
              className={`relative h-7 w-12 shrink-0 rounded-full border-2 border-[#58331A] transition-colors shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] disabled:opacity-50 cursor-pointer ${
                streakSurprise
                  ? 'bg-gradient-to-r from-[#A78BFA] to-[#8B5CF6]'
                  : 'bg-[#D8C7A8]'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_2px_0_rgba(0,0,0,0.15)] transition-transform ${
                  streakSurprise ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Anti-guilt footer notice */}
        <p className="text-[11px] text-[#8B5E3C] text-center italic">
          ✨ Podés cambiar estas preferencias cuando quieras. Cero spam, solo noticias de tu mascota.
        </p>
      </div>
    </ModalWrapper>
  );
}
