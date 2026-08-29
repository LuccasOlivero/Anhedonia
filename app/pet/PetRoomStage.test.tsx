import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PetRoomStage } from './PetRoomStage';
import type { PetRow, PetStats } from '@/lib/pet-engine';
import type { PetThought } from '@/lib/attachment';
import type { ItemWithOwnership, PlacedItem } from '@/lib/items';

describe('PetRoomStage Component', () => {
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
    coins: 250,
    last_daily_bonus_at: null,
    bond_score: 45,
    bond_streak_days: 5,
    last_bond_sync_date: null,
    last_streak_milestone_claimed: 3,
  };

  const mockStats: PetStats = {
    hunger: 80,
    happiness: 85,
    energy: 90,
    cleanliness: 75,
  };

  const mockThought: PetThought = {
    type: 'initiative',
    message: '¡Qué lindo día para pasear por la casa! 🌸',
  };

  const mockPlacedItems: PlacedItem[] = [
    {
      id: 'placed-1',
      pet_id: 'pet-123',
      user_id: 'user-456',
      item_id: 'planta',
      position_x_pct: 20,
      placed_at: new Date().toISOString(),
    },
    {
      id: 'placed-2',
      pet_id: 'pet-123',
      user_id: 'user-456',
      item_id: 'sofa',
      position_x_pct: 75,
      placed_at: new Date().toISOString(),
    },
  ];

  const mockItemsWithOwnership: ItemWithOwnership[] = [
    { id: 'planta', emoji: '🪴', name: 'Planta', priceCoins: 0, owned: true },
    { id: 'sofa', emoji: '🛋️', name: 'Sofá', priceCoins: 40, owned: true },
    { id: 'lampara', emoji: '💡', name: 'Lámpara', priceCoins: 25, owned: false },
  ];

  it('renders the 2.5D room layout with wall (75%), baseboard, and parquet floor (25%)', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetRoomStage, {
        petRow: mockPetRow,
        stats: mockStats,
        isSick: false,
        mood: 'happy',
        lifeStage: 'adult',
        thought: mockThought,
        placedItems: mockPlacedItems,
        itemsWithOwnership: mockItemsWithOwnership,
        isDecorating: false,
        isSleeping: false,
      })
    );

    // Root room stage region
    expect(html).toContain('data-testid="pet-room-stage"');
    expect(html).toContain('aria-label="Habitación de Mascota"');

    // 2.5D Wall (top 75%)
    expect(html).toContain('data-testid="pet-room-wall"');
    expect(html).toContain('#FDE9C8');
    expect(html).toContain('#F5D8A5');

    // Wooden Baseboard
    expect(html).toContain('data-testid="pet-room-baseboard"');
    expect(html).toContain('#6B4226');

    // Parquet Floor (bottom 25%)
    expect(html).toContain('data-testid="pet-room-floor"');
    expect(html).toContain('#C89B6C');
  });

  it('renders placed furniture items at their respective position_x_pct', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetRoomStage, {
        petRow: mockPetRow,
        stats: mockStats,
        isSick: false,
        mood: 'happy',
        lifeStage: 'adult',
        thought: mockThought,
        placedItems: mockPlacedItems,
        itemsWithOwnership: mockItemsWithOwnership,
        isDecorating: false,
        isSleeping: false,
      })
    );

    expect(html).toContain('data-testid="placed-item-placed-1"');
    expect(html).toContain('left:20%');
    expect(html).toContain('🪴');

    expect(html).toContain('data-testid="placed-item-placed-2"');
    expect(html).toContain('left:75%');
    expect(html).toContain('🛋️');
  });

  it('renders red removal badges on placed items when isDecorating is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetRoomStage, {
        petRow: mockPetRow,
        stats: mockStats,
        isSick: false,
        mood: 'happy',
        lifeStage: 'adult',
        thought: mockThought,
        placedItems: mockPlacedItems,
        itemsWithOwnership: mockItemsWithOwnership,
        isDecorating: true,
        isSleeping: false,
      })
    );

    expect(html).toContain('data-testid="remove-item-tag"');
    expect(html).toContain('✕');
    expect(html).toContain('aria-label="Quitar Planta"');
    expect(html).toContain('aria-label="Quitar Sofá"');
    expect(html).toContain('cursor-pointer');
  });

  it('disables removal tags and item interaction when isDecorating is false', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetRoomStage, {
        petRow: mockPetRow,
        stats: mockStats,
        isSick: false,
        mood: 'happy',
        lifeStage: 'adult',
        thought: mockThought,
        placedItems: mockPlacedItems,
        itemsWithOwnership: mockItemsWithOwnership,
        isDecorating: false,
        isSleeping: false,
      })
    );

    expect(html).not.toContain('data-testid="remove-item-tag"');
    expect(html).toContain('pointer-events-none');
    expect(html).toContain('aria-label="Planta"');
    expect(html).toContain('aria-label="Sofá"');
  });

  it('renders cozy nest with egg sprite and status message when lifeStage is egg', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetRoomStage, {
        petRow: mockPetRow,
        stats: mockStats,
        isSick: false,
        mood: 'happy',
        lifeStage: 'egg',
        thought: mockThought,
        placedItems: mockPlacedItems,
        itemsWithOwnership: mockItemsWithOwnership,
        isDecorating: false,
        isSleeping: false,
      })
    );

    expect(html).toContain('data-testid="pet-egg-stage"');
    expect(html).toContain('/egg-sprite.svg');
    expect(html).toContain('Tu mascota está a punto de salir del huevo.');
    // Should NOT render live cat sprite in egg stage
    expect(html).not.toContain('data-testid="pet-sprite-container"');
  });

  it('renders CatSprite and PetSpeechBubble when hatched (baby or adult)', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetRoomStage, {
        petRow: mockPetRow,
        stats: mockStats,
        isSick: false,
        mood: 'happy',
        lifeStage: 'adult',
        thought: mockThought,
        placedItems: mockPlacedItems,
        itemsWithOwnership: mockItemsWithOwnership,
        isDecorating: false,
        isSleeping: false,
      })
    );

    expect(html).toContain('data-testid="pet-sprite-container"');
    expect(html).toContain('data-testid="cat-sprite"');
    expect(html).toContain('¡Qué lindo día para pasear por la casa! 🌸');
    expect(html).not.toContain('data-testid="pet-egg-stage"');
  });

  it('renders sleeping night-shade overlay when isSleeping is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetRoomStage, {
        petRow: mockPetRow,
        stats: mockStats,
        isSick: false,
        mood: 'sleeping',
        lifeStage: 'adult',
        thought: mockThought,
        placedItems: mockPlacedItems,
        itemsWithOwnership: mockItemsWithOwnership,
        isDecorating: false,
        isSleeping: true,
      })
    );

    expect(html).toContain('data-testid="pet-sleeping-overlay"');
    expect(html).toContain('💤');
    expect(html).toContain('🌙');
  });

  it('does not render sleeping overlay when isSleeping is false', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetRoomStage, {
        petRow: mockPetRow,
        stats: mockStats,
        isSick: false,
        mood: 'happy',
        lifeStage: 'adult',
        thought: mockThought,
        placedItems: mockPlacedItems,
        itemsWithOwnership: mockItemsWithOwnership,
        isDecorating: false,
        isSleeping: false,
      })
    );

    expect(html).not.toContain('data-testid="pet-sleeping-overlay"');
  });

  it('renders baby scale and facial expression when lifeStage is baby', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetRoomStage, {
        petRow: mockPetRow,
        stats: mockStats,
        isSick: false,
        mood: 'happy',
        lifeStage: 'baby',
        thought: mockThought,
        placedItems: [],
        itemsWithOwnership: [],
        isDecorating: false,
        isSleeping: false,
      })
    );

    expect(html).toContain('scale-90');
    expect(html).toContain('data-testid="cat-sprite"');
  });

  it('handles empty placed items gracefully', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetRoomStage, {
        petRow: mockPetRow,
        stats: mockStats,
        isSick: false,
        mood: 'happy',
        lifeStage: 'adult',
        thought: null,
        placedItems: [],
        itemsWithOwnership: [],
        isDecorating: false,
        isSleeping: false,
      })
    );

    expect(html).toContain('data-testid="pet-room-stage"');
    expect(html).toContain('data-testid="pet-sprite-container"');
    expect(html).not.toContain('data-testid="placed-item-');
  });

  it('applies custom className to room stage wrapper', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetRoomStage, {
        petRow: mockPetRow,
        stats: mockStats,
        isSick: false,
        mood: 'happy',
        lifeStage: 'adult',
        thought: mockThought,
        placedItems: [],
        itemsWithOwnership: [],
        isDecorating: false,
        isSleeping: false,
        className: 'custom-room-class',
      })
    );

    expect(html).toContain('custom-room-class');
  });
});
