'use client';

import React from 'react';
import { MISSIONS, type MissionProgress } from '@/lib/missions';
import { ModalWrapper } from './ModalWrapper';

export interface MisionesModalProps {
  missionProgress?: MissionProgress[];
  coins?: number;
  petName?: string;
  onClose?: () => void;
  className?: string;
}

export function MisionesModal({
  missionProgress,
  coins,
  petName,
  onClose = () => {},
  className = '',
}: MisionesModalProps) {
  // If missionProgress is not supplied, default to the static list from MISSIONS
  const progressList = React.useMemo<MissionProgress[]>(() => {
    if (missionProgress && missionProgress.length > 0) {
      return missionProgress;
    }
    return MISSIONS.map((m) => ({
      mission: m,
      periodKey: '',
      count: 0,
      isCompleted: false,
    }));
  }, [missionProgress]);

  const coinsBadge =
    coins !== undefined ? (
      <div
        data-testid="misiones-coins-badge"
        className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-full border-2 border-[#58331A] bg-gradient-to-b from-[#FFF3C4] via-[#FDE047] to-[#F59E0B] text-[#58331A] font-bold text-xs sm:text-sm shadow-[0_2px_0_#58331A]"
      >
        <span>🪙</span>
        <span className="font-[family-name:var(--font-display)]">{coins.toLocaleString()}</span>
      </div>
    ) : undefined;

  const title = petName ? `Misiones de ${petName}` : 'Misiones';

  return (
    <ModalWrapper
      title={title}
      icon="🎯"
      onClose={onClose}
      badge={coinsBadge}
      maxWidth="max-w-lg"
      className={className}
      data-testid="misiones-modal"
    >
      <div className="space-y-3.5">
        {/* Subtitle / Anti-guilt banner */}
        <p className="text-xs sm:text-sm font-semibold text-[#8B5E3C] text-center">
          Completá misiones para ganar moneditas y consentir a tu mascota.
        </p>

        {/* Mission List */}
        <div data-testid="misiones-list" className="space-y-3">
          {progressList.map((p) => {
            const { mission, count, isCompleted } = p;
            const currentCount = Math.min(count, mission.threshold);
            const progressPercent = Math.min(100, Math.round((currentCount / mission.threshold) * 100));
            const isDaily = mission.period === 'daily';

            return (
              <div
                key={mission.id}
                data-testid={`mission-card-${mission.id}`}
                className={`rounded-2xl border-2 p-3 sm:p-4 space-y-2.5 transition-all shadow-[0_2px_4px_rgba(88,51,26,0.06)] ${
                  isCompleted
                    ? 'border-[#22C55E]/60 bg-[#F0FDF4]'
                    : 'border-[#C89B6C]/60 bg-[#FFFDF8]'
                }`}
              >
                {/* Header of card: Period Badge, Description, Reward */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider ${
                          isDaily
                            ? 'bg-[#DBEAFE] text-[#1E40AF] border border-[#93C5FD]'
                            : 'bg-[#F3E8FF] text-[#6B21A8] border border-[#D8B4FE]'
                        }`}
                      >
                        {isDaily ? 'Diaria' : 'Semanal'}
                      </span>
                      {isCompleted && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#16A34A]">
                          ✅ ¡Completada!
                        </span>
                      )}
                    </div>
                    <p className="font-[family-name:var(--font-display)] font-bold text-xs sm:text-sm text-[#4A3222]">
                      {mission.description}
                    </p>
                  </div>

                  {/* Reward Coin Pill */}
                  <div className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#FFF3C4] px-2.5 py-1 text-xs font-bold text-[#8B5E3C] border border-[#6B4226]/15 shadow-sm">
                    <span>+{mission.rewardCoins}</span>
                    <span>🪙</span>
                  </div>
                </div>

                {/* Progress Bar & Count */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] font-semibold text-[#8B5E3C]">
                    <span>Progreso</span>
                    <span data-testid={`mission-count-${mission.id}`}>
                      {currentCount}/{mission.threshold}
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-[#E5D7BE] border border-[#C89B6C]/40 overflow-hidden p-0.5">
                    <div
                      data-testid={`mission-progress-bar-${mission.id}`}
                      className={`h-full rounded-full transition-all duration-300 ${
                        isCompleted
                          ? 'bg-gradient-to-r from-[#4ADE80] to-[#22C55E]'
                          : 'bg-gradient-to-r from-[#60A5FA] to-[#3B82F6]'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ModalWrapper>
  );
}
