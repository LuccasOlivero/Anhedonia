'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';

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
  // Optional game domain props for downstream components
  petRow?: unknown;
  stats?: unknown;
  isSick?: boolean;
  mood?: unknown;
  bondTier?: unknown;
  thought?: unknown;
  placedItems?: unknown[];
  ownedItems?: unknown[];
  diaryTimeline?: unknown[];
  missionProgress?: unknown[];
  prefs?: unknown;
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
}: PetGameStageProps) {
  const [uncontrolledActiveModal, setUncontrolledActiveModal] = useState<PetModalType | null>(
    initialModal ?? null
  );

  const isControlled = controlledActiveModal !== undefined;
  const currentModal = isControlled ? controlledActiveModal : uncontrolledActiveModal;

  const setActiveModal = useCallback(
    (modalType: PetModalType | null) => {
      if (!isControlled) {
        setUncontrolledActiveModal(modalType);
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
  }, [setActiveModal]);

  // Sync initialModal changes if uncontrolled
  useEffect(() => {
    if (!isControlled && initialModal !== undefined) {
      setUncontrolledActiveModal(initialModal);
    }
  }, [initialModal, isControlled]);

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
      isModalOpen: currentModal !== null,
    }),
    [currentModal, setActiveModal, openModal, closeModal]
  );

  return (
    <PetGameStageContext.Provider value={contextValue}>
      <div className="pet-sky-bg min-h-dvh w-full flex items-center justify-center p-2 sm:p-4 md:p-6 select-none overflow-x-hidden">
        <div
          role="region"
          aria-label="Pet Society Escenario de Juego"
          className={`pet-wood-frame relative flex flex-col w-full max-w-[960px] h-[640px] max-h-[calc(100dvh-1rem)] min-h-[500px] rounded-[28px] overflow-hidden bg-[#FFF9EC] shadow-[0_16px_40px_rgba(0,0,0,0.35)] ${className}`}
        >
          {hud && (
            <header className="relative z-10 w-full shrink-0" data-testid="pet-game-hud">
              {hud}
            </header>
          )}

          <main className="relative z-0 flex-1 w-full overflow-hidden flex flex-col" data-testid="pet-game-room">
            {room}
            {children}
          </main>

          {dock && (
            <footer className="relative z-10 w-full shrink-0" data-testid="pet-game-dock">
              {dock}
            </footer>
          )}

          {currentModal && modal && (
            <div
              className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-2 sm:p-4 animate-pet-pop"
              data-testid="pet-game-modal-overlay"
              onClick={handleBackdropClick}
            >
              {modal}
            </div>
          )}
        </div>
      </div>
    </PetGameStageContext.Provider>
  );
}
