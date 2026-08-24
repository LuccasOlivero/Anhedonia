export interface Item {
  id: string;
  emoji: string;
  name: string;
  priceCoins: number;
}

export interface OwnedItem {
  id: string;
  pet_id: string;
  user_id: string;
  item_id: string;
  acquired_at: string;
}

export interface PlacedItem {
  id: string;
  pet_id: string;
  user_id: string;
  item_id: string;
  position_x_pct: number;
  placed_at: string;
}

export interface ItemWithOwnership extends Item {
  owned: boolean;
}

// Fixed catalog, same pattern as lib/missions.ts's MISSIONS constant: a
// closed set defined in code, never persisted. owned_items/placed_items
// only ever reference these ids by joining against this array at read time.
export const ITEMS: Item[] = [
  { id: 'planta', emoji: '🪴', name: 'Planta', priceCoins: 0 },
  { id: 'canasta', emoji: '🧺', name: 'Canasta', priceCoins: 0 },
  { id: 'vela', emoji: '🕯️', name: 'Vela', priceCoins: 10 },
  { id: 'cuadro', emoji: '🖼️', name: 'Cuadro', priceCoins: 15 },
  { id: 'alfombra', emoji: '🟫', name: 'Alfombra', priceCoins: 20 },
  { id: 'lampara', emoji: '💡', name: 'Lámpara', priceCoins: 25 },
  { id: 'sofa', emoji: '🛋️', name: 'Sofá', priceCoins: 40 },
  { id: 'cama', emoji: '🛏️', name: 'Cama', priceCoins: 80 },
];

export const STARTER_ITEM_IDS: string[] = ['planta', 'canasta'];

export function findItem(itemId: string): Item | undefined {
  return ITEMS.find((item) => item.id === itemId);
}

export function computeItemsWithOwnership(owned: OwnedItem[]): ItemWithOwnership[] {
  const ownedIds = new Set(owned.map((o) => o.item_id));
  return ITEMS.map((item) => ({ ...item, owned: ownedIds.has(item.id) }));
}

const WALK_MIN_PCT = 6;
const WALK_MAX_PCT = 94;

export function clampPct(pct: number): number {
  return Math.min(WALK_MAX_PCT, Math.max(WALK_MIN_PCT, pct));
}
