import { describe, it, expect } from 'vitest';
import { ITEMS, STARTER_ITEM_IDS, findItem, computeItemsWithOwnership, clampPct, type OwnedItem } from './items';

function makeOwnedItem(overrides: Partial<OwnedItem> = {}): OwnedItem {
  return {
    id: 'owned-1',
    pet_id: 'pet-1',
    user_id: 'user-1',
    item_id: 'planta',
    acquired_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('ITEMS catalog', () => {
  it('has 8 items with unique ids', () => {
    expect(ITEMS).toHaveLength(8);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(8);
  });

  it('every item has a positive price except the 2 starter items, which are free', () => {
    for (const item of ITEMS) {
      if (STARTER_ITEM_IDS.includes(item.id)) {
        expect(item.priceCoins).toBe(0);
      } else {
        expect(item.priceCoins).toBeGreaterThan(0);
      }
    }
  });

  it('STARTER_ITEM_IDS references exactly 2 real catalog items', () => {
    expect(STARTER_ITEM_IDS).toHaveLength(2);
    for (const id of STARTER_ITEM_IDS) {
      expect(ITEMS.some((i) => i.id === id)).toBe(true);
    }
  });
});

describe('findItem', () => {
  it('returns the matching item', () => {
    expect(findItem('planta')?.name).toBe('Planta');
  });

  it('returns undefined for an unknown id', () => {
    expect(findItem('nonexistent')).toBeUndefined();
  });
});

describe('computeItemsWithOwnership', () => {
  it('marks every catalog item as not owned when the owned list is empty', () => {
    const result = computeItemsWithOwnership([]);
    expect(result).toHaveLength(8);
    expect(result.every((i) => i.owned === false)).toBe(true);
  });

  it('marks only the items present in the owned list as owned', () => {
    const owned = [makeOwnedItem({ item_id: 'planta' }), makeOwnedItem({ item_id: 'sofa' })];
    const result = computeItemsWithOwnership(owned);
    const planta = result.find((i) => i.id === 'planta')!;
    const sofa = result.find((i) => i.id === 'sofa')!;
    const vela = result.find((i) => i.id === 'vela')!;
    expect(planta.owned).toBe(true);
    expect(sofa.owned).toBe(true);
    expect(vela.owned).toBe(false);
  });

  it('preserves catalog order', () => {
    const result = computeItemsWithOwnership([]);
    expect(result.map((i) => i.id)).toEqual(ITEMS.map((i) => i.id));
  });
});

describe('clampPct', () => {
  it('leaves values already inside the placeable band unchanged', () => {
    expect(clampPct(50)).toBe(50);
    expect(clampPct(6)).toBe(6);
    expect(clampPct(94)).toBe(94);
  });

  it('clamps values below the band up to the minimum', () => {
    expect(clampPct(-10)).toBe(6);
    expect(clampPct(0)).toBe(6);
  });

  it('clamps values above the band down to the maximum', () => {
    expect(clampPct(150)).toBe(94);
    expect(clampPct(100)).toBe(94);
  });
});
