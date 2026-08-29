'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type MouseEvent,
  type ReactNode,
} from 'react';
import type { LifeStage, PetMood, PetRow, PetStats } from '@/lib/pet-engine';
import type { BondTierInfo } from '@/lib/bond';
import type { PetThought, StreakReward } from '@/lib/attachment';
import {
  clampPct,
  computeItemsWithOwnership,
  type ItemWithOwnership,
  type OwnedItem,
  type PlacedItem,
} from '@/lib/items';
import type { DiaryEntry, TimelineEntry, VirtualDiaryEntry } from '@/lib/diary';
import type { MissionProgress } from '@/lib/missions';
import type { NotificationPreferences } from '@/lib/notifications';
import { placeItem, removePlacedItem } from '@/app/pet/casa/actions';
import { PetHUD } from './PetHUD';
import { PetRoomStage } from './PetRoomStage';
import { PetCareDock } from './PetCareDock';
import { StreakRewardModal } from './StreakRewardModal';
import {
  TiendaModal,
  DiarioModal,
  MisionesModal,
  NotificacionesModal,
} from './modals';

export type PetModalType =
  | 'tienda'
  | 'diario'
  | 'misiones'
  | 'notificaciones'
  | 'decorar'
  | 'streak_reward';

export interface PetGameStageContextValue {
  activeModal: PetModalType | null;
  setActiveModal: (modal: PetModalType | null) => void;
  openModal: (modal: PetModalType) => void;
  closeModal: () => void;
  isModalOpen: boolean;
  isDecorating: boolean;
  setIsDecorating: (decorating: boolean) => void;
}

export const PetGameStageContext = createContext<PetGameStageContextValue | null>(null);

export function usePetGameStage(): PetGameStageContextValue {
  const context = useContext(PetGameStageContext);
  if (!context) {
    throw new Error('usePetGameStage must be used within a PetGameStage');
  }
  return context;
}

export interface PetGameStageProps {
  initialModal?: PetModalType | null;
  activeModal?: PetModalType | null;
  onModalChange?: (modal: PetModalType | null) => void;
  hud?: ReactNode;
  room?: ReactNode;
  dock?: ReactNode;
  modal?: ReactNode;
  children?: ReactNode;
  className?: string;
  // Domain props
  petRow?: PetRow;
  stats?: PetStats;
  isSick?: boolean;
  mood?: PetMood;
  lifeStage?: LifeStage;
  bondTier?: BondTierInfo | string;
  thought?: PetThought | null;
  placedItems?: PlacedItem[];
  ownedItems?: OwnedItem[];
  diaryTimeline?: TimelineEntry[];
  realDiaryEntries?: DiaryEntry[];
  virtualDiaryEntries?: VirtualDiaryEntry[];
  missionProgress?: MissionProgress[];
  prefs?: NotificationPreferences;
}

export function PetGameStage({
  initialModal = null,
  activeModal: controlledActiveModal,
  onModalChange,
  hud,
  room,
  dock,
  modal,
  children,
  className = '',
  petRow,
  stats,
  isSick = false,
  mood = 'happy',
  lifeStage = 'adult',
  bondTier,
  thought,
  placedItems = [],
  ownedItems = [],
  diaryTimeline,
  realDiaryEntries = [],
  virtualDiaryEntries = [],
  missionProgress,
  prefs,
}: PetGameStageProps) {
  const [uncontrolledActiveModal, setUncontrolledActiveModal] = useState<PetModalType | null>(
    initialModal ?? null
  );
  const [isDecorating, setIsDecorating] = useState<boolean>(initialModal === 'decorar');
  const [activeStreakReward, setActiveStreakReward] = useState<StreakReward | null>(
    () => (thought?.reward ? thought.reward : null)
  );
  const [isPending, startTransition] = useTransition();

  const isControlled = controlledActiveModal !== undefined;
  const currentModal = isControlled ? controlledActiveModal : uncontrolledActiveModal;

  const setActiveModal = useCallback(
    (modalType: PetModalType | null) => {
      if (!isControlled) {
        setUncontrolledActiveModal(modalType);
      }
      if (modalType === 'decorar') {
        setIsDecorating(true);
      }
      onModalChange?.(modalType);
    },
    [isControlled, onModalChange]
  );

  const openModal = useCallback(
    (modalType: PetModalType) => {
      setActiveModal(modalType);
    },
    [setActiveModal]
  );

  const closeModal = useCallback(() => {
    setActiveModal(null);
    if (currentModal === 'decorar') {
      setIsDecorating(false);
    }
  }, [setActiveModal, currentModal]);

  const handleToggleDecorate = useCallback(() => {
    setIsDecorating((prev) => !prev);
  }, []);

  const handlePlacedItemTap = useCallback((placedItemId: string) => {
    startTransition(async () => {
      await removePlacedItem(placedItemId);
    });
  }, []);

  const handleTrayTap = useCallback((item: ItemWithOwnership) => {
    if (!item.owned) return;
    startTransition(async () => {
      const positionXPct = clampPct(6 + Math.random() * 88);
      await placeItem(item.id, positionXPct);
    });
  }, []);

  const handleOpenStreakModal = useCallback(
    (reward: StreakReward) => {
      setActiveStreakReward(reward);
      openModal('streak_reward');
    },
    [openModal]
  );

  // Sync initialModal changes if uncontrolled
  useEffect(() => {
    if (!isControlled && initialModal !== undefined) {
      setUncontrolledActiveModal(initialModal);
      if (initialModal === 'decorar') {
        setIsDecorating(true);
      }
    }
  }, [initialModal, isControlled]);

  // Update activeStreakReward when thought updates
  useEffect(() => {
    if (thought?.reward) {
      setActiveStreakReward(thought.reward);
    }
  }, [thought]);

  // Close modal on Escape key press
  useEffect(() => {
    if (!currentModal) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentModal, closeModal]);

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  };

  const contextValue = useMemo<PetGameStageContextValue>(
    () => ({
      activeModal: currentModal,
      setActiveModal,
      openModal,
      closeModal,
      isModalOpen: currentModal !== null && currentModal !== 'decorar',
      isDecorating,
      setIsDecorating,
    }),
    [currentModal, setActiveModal, openModal, closeModal, isDecorating]
  );

  const itemsWithOwnership = useMemo(
    () => computeItemsWithOwnership(ownedItems),
    [ownedItems]
  );

  // Unified Modal Dispatcher: Resolve modal content if a modal is active
  const resolvedModalContent = useMemo(() => {
    if (!currentModal) return null;
    if (modal) return modal;
    if (currentModal === 'decorar') return null;

    switch (currentModal) {
      case 'tienda':
        return (
          <TiendaModal
            coins={petRow?.coins ?? 0}
            ownedItems={ownedItems}
            onClose={closeModal}
          />
        );
      case 'diario':
        return (
          <DiarioModal
            pet={petRow}
            petName={petRow?.name}
            timeline={diaryTimeline}
            realEntries={realDiaryEntries}
            virtualEntries={virtualDiaryEntries}
            onClose={closeModal}
          />
        );
      case 'misiones':
        return (
          <MisionesModal
            missionProgress={missionProgress}
            coins={petRow?.coins}
            petName={petRow?.name}
            onClose={closeModal}
          />
        );
      case 'notificaciones':
        return (
          <NotificacionesModal
            prefs={prefs}
            petName={petRow?.name}
            onClose={closeModal}
          />
        );
      case 'streak_reward':
        if (!activeStreakReward) return null;
        return (
          <StreakRewardModal
            reward={activeStreakReward}
            petName={petRow?.name ?? 'Mi Mascota'}
            onClose={() => {
              setActiveStreakReward(null);
              closeModal();
            }}
          />
        );
      default:
        return null;
    }
  }, [
    modal,
    currentModal,
    petRow,
    ownedItems,
    diaryTimeline,
    realDiaryEntries,
    virtualDiaryEntries,
    missionProgress,
    prefs,
    activeStreakReward,
    closeModal,
  ]);

  // Slot or Domain Components Resolution
  const resolvedHud =
    hud ??
    (petRow ? (
      <PetHUD
        petName={petRow.name}
        coins={petRow.coins}
        bondScore={petRow.bond_score}
        bondTier={bondTier}
        stats={stats}
        onCoinsClick={() => openModal('tienda')}
        onLevelClick={() => openModal('misiones')}
      />
    ) : null);

  const resolvedRoom =
    room ??
    (petRow && stats ? (
      <PetRoomStage
        petRow={petRow}
        stats={stats}
        isSick={isSick}
        mood={mood}
        lifeStage={lifeStage}
        thought={thought}
        placedItems={placedItems}
        itemsWithOwnership={itemsWithOwnership}
        isDecorating={isDecorating}
        onPlacedItemTap={handlePlacedItemTap}
        isSleeping={petRow.is_sleeping}
        onOpenStreakModal={handleOpenStreakModal}
      />
    ) : null);

  const resolvedDock =
    dock ??
    (petRow ? (
      <PetCareDock
        isSleeping={petRow.is_sleeping}
        isSick={isSick}
        isDecorating={isDecorating}
        onToggleDecorate={handleToggleDecorate}
        onOpenModal={openModal}
      />
    ) : null);

  return (
    <PetGameStageContext.Provider value={contextValue}>
      <div className="pet-sky-bg min-h-dvh w-full flex items-center justify-center p-2 sm:p-4 md:p-6 select-none overflow-x-hidden">
        <div
          role="region"
          aria-label="Pet Society Escenario de Juego"
          className={`pet-wood-frame relative flex flex-col w-full max-w-[960px] h-[640px] max-h-[calc(100dvh-1rem)] min-h-[500px] rounded-[28px] overflow-hidden bg-[#FFF9EC] shadow-[0_16px_40px_rgba(0,0,0,0.35)] ${className}`}
        >
          {resolvedHud && (
            <header className="relative z-10 w-full shrink-0" data-testid="pet-game-hud">
              {resolvedHud}
            </header>
          )}

          <main className="relative z-0 flex-1 w-full overflow-hidden flex flex-col" data-testid="pet-game-room">
            {resolvedRoom}
            {children}

            {/* Decorating Mode Item Placement Tray */}
            {isDecorating && (
              <div
                data-testid="pet-decorating-tray"
                className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 overflow-x-auto bg-[#FFF9EC]/95 backdrop-blur-sm border-t-2 border-[#C89B6C] p-2 sm:p-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.15)] animate-in slide-in-from-bottom duration-200"
              >
                <span className="text-xs font-bold uppercase tracking-wider text-[#8B5E3C] shrink-0 pl-1">
                  Muebles:
                </span>
                {itemsWithOwnership.map((item) =>
                  item.owned ? (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleTrayTap(item)}
                      disabled={isPending}
                      title={`Colocar ${item.name}`}
                      data-testid={`tray-item-${item.id}`}
                      className="flex shrink-0 flex-col items-center gap-0.5 rounded-xl border-2 border-[#58331A] bg-white px-2.5 py-1 shadow-[0_2px_0_#58331A] hover:scale-105 active:translate-y-[1px] active:shadow-none transition-transform cursor-pointer"
                    >
                      <span className="text-2xl select-none">{item.emoji}</span>
                      <span className="text-[10px] font-bold text-[#58331A] truncate max-w-[60px]">
                        {item.name}
                      </span>
                    </button>
                  ) : (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openModal('tienda')}
                      title={`Comprar ${item.name} en la Tienda`}
                      data-testid={`tray-item-locked-${item.id}`}
                      className="flex shrink-0 flex-col items-center gap-0.5 rounded-xl border-2 border-[#C89B6C]/40 bg-white/40 px-2.5 py-1 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <span className="text-2xl select-none">🔒</span>
                      <span className="text-[10px] font-semibold text-[#8B5E3C] truncate max-w-[60px]">
                        {item.name}
                      </span>
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={handleToggleDecorate}
                  className="ml-auto shrink-0 px-3 py-1.5 rounded-full border-2 border-[#58331A] bg-gradient-to-b from-[#FDE047] to-[#F59E0B] text-[#58331A] text-xs font-bold shadow-[0_2px_0_#58331A] active:translate-y-[1px] active:shadow-none cursor-pointer"
                >
                  ✅ Listo
                </button>
              </div>
            )}
          </main>

          {resolvedDock && (
            <footer className="relative z-10 w-full shrink-0" data-testid="pet-game-dock">
              {resolvedDock}
            </footer>
          )}

          {currentModal && resolvedModalContent && (
            <div
              className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-2 sm:p-4 animate-pet-pop"
              data-testid="pet-game-modal-overlay"
              onClick={handleBackdropClick}
            >
              {resolvedModalContent}
            </div>
          )}
        </div>
      </div>
    </PetGameStageContext.Provider>
  );
}
