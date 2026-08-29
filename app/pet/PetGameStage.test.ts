import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PetGameStage,
  usePetGameStage,
  type PetModalType,
  type PetGameStageContextValue,
} from './PetGameStage';
import type { PetRow, PetStats } from '@/lib/pet-engine';
import type { PetThought, StreakReward } from '@/lib/attachment';
import type { PlacedItem, OwnedItem } from '@/lib/items';
import type { TimelineEntry } from '@/lib/diary';
import type { MissionProgress } from '@/lib/missions';
import type { NotificationPreferences } from '@/lib/notifications';

describe('PetGameStage Component', () => {
  const mockPetRow: PetRow = {
    id: 'pet-123',
    user_id: 'user-456',
    name: 'Mishi',
    created_at: new Date().toISOString(),
    last_updated_at: new Date().toISOString(),
    hunger: 80,
    happiness: 85,
    energy: 90,
    cleanliness: 75,
    is_sleeping: false,
    sprites: {
      happy: '/sprites/happy.png',
      sad: '/sprites/sad.png',
      eating: '/sprites/eating.png',
      sleeping: '/sprites/sleeping.png',
      dirty: '/sprites/dirty.png',
      sick: '/sprites/sick.png',
    },
    coins: 350,
    last_daily_bonus_at: null,
    bond_score: 45,
    bond_streak_days: 7,
    last_bond_sync_date: null,
    last_streak_milestone_claimed: 3,
  };

  const mockStats: PetStats = {
    hunger: 80,
    happiness: 85,
    energy: 90,
    cleanliness: 75,
  };

  const mockStreakReward: StreakReward = {
    milestone: 7,
    coins: 70,
    message: '¡Cumplimos una semana juntos! 🎁',
    diaryTitle: '🎁 ¡Una semana inseparable!',
    diaryContent: '¡Cumplimos una semana entera juntos!',
  };

  const mockThought: PetThought = {
    type: 'gift',
    message: '¡Tengo una sorpresa para vos! 🎁',
    reward: mockStreakReward,
  };

  const mockPlacedItems: PlacedItem[] = [
    {
      id: 'placed-1',
      pet_id: 'pet-123',
      user_id: 'user-456',
      item_id: 'planta',
      position_x_pct: 25,
      placed_at: new Date().toISOString(),
    },
  ];

  const mockOwnedItems: OwnedItem[] = [
    {
      id: 'owned-1',
      pet_id: 'pet-123',
      user_id: 'user-456',
      item_id: 'planta',
      acquired_at: new Date().toISOString(),
    },
    {
      id: 'owned-2',
      pet_id: 'pet-123',
      user_id: 'user-456',
      item_id: 'sofa',
      acquired_at: new Date().toISOString(),
    },
  ];

  const mockTimeline: TimelineEntry[] = [
    {
      kind: 'real',
      entry: {
        id: 'note-1',
        pet_id: 'pet-123',
        user_id: 'user-456',
        entry_type: 'note',
        occurred_at: '2026-08-29T00:00:00.000Z',
        mood_snapshot: 'happy',
        text: '¡Hermoso día!',
        created_at: '2026-08-29T00:00:00.000Z',
      },
    },
  ];

  const mockMissionProgress: MissionProgress[] = [
    {
      mission: {
        id: 'feed_pet',
        period: 'daily',
        eventType: 'fed',
        threshold: 1,
        rewardCoins: 20,
        description: 'Alimentá a tu mascota 1 vez hoy',
      },
      periodKey: '2026-08-29',
      count: 1,
      isCompleted: true,
    },
  ];

  const mockPrefs: NotificationPreferences = {
    daily_bonus_email_enabled: true,
    last_daily_bonus_email_sent_date: null,
    streak_surprise_email_enabled: false,
    last_streak_surprise_email_sent_date: null,
  };

  it('renders correctly with default slots and classes', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetGameStage, {
        hud: React.createElement('div', { id: 'test-hud' }, 'HUD Content'),
        room: React.createElement('div', { id: 'test-room' }, 'Room Content'),
        dock: React.createElement('div', { id: 'test-dock' }, 'Dock Content'),
      })
    );

    expect(html).toContain('pet-sky-bg');
    expect(html).toContain('pet-wood-frame');
    expect(html).toContain('HUD Content');
    expect(html).toContain('Room Content');
    expect(html).toContain('Dock Content');
    expect(html).toContain('data-testid="pet-game-hud"');
    expect(html).toContain('data-testid="pet-game-room"');
    expect(html).toContain('data-testid="pet-game-dock"');
  });

  it('renders children inside the main room area', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        PetGameStage,
        null,
        React.createElement('div', { id: 'child-element' }, 'Child Element')
      )
    );

    expect(html).toContain('Child Element');
  });

  it('renders modal overlay when activeModal is set and modal prop is provided', () => {
    const htmlWithModal = renderToStaticMarkup(
      React.createElement(PetGameStage, {
        initialModal: 'tienda',
        modal: React.createElement('div', { id: 'test-tienda-modal' }, 'Tienda Modal Popup'),
      })
    );

    expect(htmlWithModal).toContain('data-testid="pet-game-modal-overlay"');
    expect(htmlWithModal).toContain('Tienda Modal Popup');
  });

  it('does not render modal overlay when modal is not set', () => {
    const htmlWithoutModal = renderToStaticMarkup(
      React.createElement(PetGameStage, {
        initialModal: null,
        modal: React.createElement('div', { id: 'test-tienda-modal' }, 'Tienda Modal Popup'),
      })
    );

    expect(htmlWithoutModal).not.toContain('data-testid="pet-game-modal-overlay"');
    expect(htmlWithoutModal).not.toContain('Tienda Modal Popup');
  });

  it('applies custom className to the stage frame', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetGameStage, {
        className: 'custom-test-class',
      })
    );

    expect(html).toContain('custom-test-class');
  });

  it('supports all modal types', () => {
    const validModals: PetModalType[] = [
      'tienda',
      'diario',
      'misiones',
      'notificaciones',
      'decorar',
      'streak_reward',
    ];

    for (const modalType of validModals) {
      const html = renderToStaticMarkup(
        React.createElement(PetGameStage, {
          initialModal: modalType,
          modal: React.createElement('div', null, `Modal for ${modalType}`),
        })
      );
      expect(html).toContain(`Modal for ${modalType}`);
    }
  });

  it('provides context value to child consumers', () => {
    const holder: { context: PetGameStageContextValue | null } = { context: null };

    function TestConsumer() {
      holder.context = usePetGameStage();
      return React.createElement('span', null, `Active: ${holder.context.activeModal ?? 'none'}`);
    }

    const html = renderToStaticMarkup(
      React.createElement(
        PetGameStage,
        { initialModal: 'diario' },
        React.createElement(TestConsumer)
      )
    );

    expect(html).toContain('Active: diario');
    expect(holder.context).not.toBeNull();
    expect(holder.context?.activeModal).toBe('diario');
    expect(holder.context?.isModalOpen).toBe(true);
    expect(typeof holder.context?.openModal).toBe('function');
    expect(typeof holder.context?.closeModal).toBe('function');
    expect(typeof holder.context?.setActiveModal).toBe('function');
  });

  it('throws error when usePetGameStage is used outside provider', () => {
    function InvalidConsumer() {
      usePetGameStage();
      return null;
    }

    expect(() => {
      renderToStaticMarkup(React.createElement(InvalidConsumer));
    }).toThrow('usePetGameStage must be used within a PetGameStage');
  });

  /* Unified Domain & Modal Integration Tests */

  it('automatically composes HUD, RoomStage, and CareDock from domain props', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetGameStage, {
        petRow: mockPetRow,
        stats: mockStats,
        isSick: false,
        mood: 'happy',
        lifeStage: 'adult',
        thought: mockThought,
        placedItems: mockPlacedItems,
        ownedItems: mockOwnedItems,
        diaryTimeline: mockTimeline,
        missionProgress: mockMissionProgress,
        prefs: mockPrefs,
      })
    );

    // Verifies HUD elements
    expect(html).toContain('data-testid="pet-hud"');
    expect(html).toContain('Mishi');
    expect(html).toContain('350');
    expect(html).toContain('Niv. 5');

    // Verifies Room elements
    expect(html).toContain('data-testid="pet-room-stage"');
    expect(html).toContain('data-testid="placed-item-placed-1"');
    expect(html).toContain('🪴');
    expect(html).toContain('data-testid="cat-sprite"');

    // Verifies Dock elements
    expect(html).toContain('data-testid="pet-care-dock"');
    expect(html).toContain('data-testid="dock-feed-btn"');
    expect(html).toContain('data-testid="dock-play-btn"');
    expect(html).toContain('data-testid="dock-bathe-btn"');
    expect(html).toContain('data-testid="dock-tienda-btn"');
    expect(html).toContain('data-testid="dock-diario-btn"');
    expect(html).toContain('data-testid="dock-misiones-btn"');
    expect(html).toContain('data-testid="dock-notificaciones-btn"');
  });

  it('renders TiendaModal via unified modal dispatcher when initialModal="tienda"', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetGameStage, {
        initialModal: 'tienda',
        petRow: mockPetRow,
        stats: mockStats,
        ownedItems: mockOwnedItems,
      })
    );

    expect(html).toContain('data-testid="pet-game-modal-overlay"');
    expect(html).toContain('data-testid="tienda-modal"');
    expect(html).toContain('Tienda de Muebles');
    expect(html).toContain('data-testid="tienda-coins-badge"');
    expect(html).toContain('350');
  });

  it('renders DiarioModal via unified modal dispatcher when initialModal="diario"', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetGameStage, {
        initialModal: 'diario',
        petRow: mockPetRow,
        stats: mockStats,
        diaryTimeline: mockTimeline,
      })
    );

    expect(html).toContain('data-testid="pet-game-modal-overlay"');
    expect(html).toContain('data-testid="diario-modal"');
    expect(html).toContain('Diario de Mishi');
    expect(html).toContain('¡Hermoso día!');
  });

  it('renders MisionesModal via unified modal dispatcher when initialModal="misiones"', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetGameStage, {
        initialModal: 'misiones',
        petRow: mockPetRow,
        stats: mockStats,
        missionProgress: mockMissionProgress,
      })
    );

    expect(html).toContain('data-testid="pet-game-modal-overlay"');
    expect(html).toContain('data-testid="misiones-modal"');
    expect(html).toContain('Misiones de Mishi');
    expect(html).toContain('Alimentá a tu mascota 1 vez hoy');
    expect(html).toContain('✅ ¡Completada!');
  });

  it('renders NotificacionesModal via unified modal dispatcher when initialModal="notificaciones"', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetGameStage, {
        initialModal: 'notificaciones',
        petRow: mockPetRow,
        stats: mockStats,
        prefs: mockPrefs,
      })
    );

    expect(html).toContain('data-testid="pet-game-modal-overlay"');
    expect(html).toContain('data-testid="notificaciones-modal"');
    expect(html).toContain('Notificaciones de Mishi');
    expect(html).toContain('Avisarme cuando mi bono diario esté listo');
  });

  it('renders StreakRewardModal via unified modal dispatcher when initialModal="streak_reward"', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetGameStage, {
        initialModal: 'streak_reward',
        petRow: mockPetRow,
        stats: mockStats,
        thought: mockThought,
      })
    );

    expect(html).toContain('data-testid="pet-game-modal-overlay"');
    expect(html).toContain('¡Sorpresa de Mishi!');
    expect(html).toContain('Racha de 7 días de cuidado');
    expect(html).toContain('+70 Monedas');
  });

  it('activates decorating tray and room removal tags when initialModal="decorar"', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetGameStage, {
        initialModal: 'decorar',
        petRow: mockPetRow,
        stats: mockStats,
        placedItems: mockPlacedItems,
        ownedItems: mockOwnedItems,
      })
    );

    // Decorating mode operates in-place on stage, no modal overlay
    expect(html).not.toContain('data-testid="pet-game-modal-overlay"');
    expect(html).toContain('data-testid="pet-decorating-tray"');
    expect(html).toContain('data-testid="tray-item-planta"');
    expect(html).toContain('data-testid="tray-item-sofa"');
    expect(html).toContain('data-testid="remove-item-tag"');
    expect(html).toContain('✅ Listo');
  });
});
