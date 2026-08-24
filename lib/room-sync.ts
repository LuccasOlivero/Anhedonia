import { createClient } from './supabase/server';
import { STARTER_ITEM_IDS } from './items';
import type { PetRow } from './pet-engine';

// Soft background sync: grants the free starter items exactly once per pet.
// Never throws — a failure here must not break page render. Mirrors
// lib/diary-sync.ts / lib/missions-sync.ts's exact shape.
//
// KNOWN LIMITATION: not wrapped in a single transaction — a concurrent
// double-render could both see "not yet granted" and both attempt the
// insert. The `unique (pet_id, item_id)` constraint on owned_items makes
// this safe (the second insert fails with a unique-violation, which is
// caught and logged, not surfaced), so at most a harmless duplicate-insert
// error is logged, never a duplicate row. Same character as the
// already-documented read-modify-write risk elsewhere in this app.
export async function ensureStarterItemsOwned(pet: PetRow): Promise<void> {
  try {
    const supabase = await createClient();

    const { data: existingData, error: selectError } = await supabase
      .from('owned_items')
      .select('item_id')
      .eq('pet_id', pet.id)
      .in('item_id', STARTER_ITEM_IDS);

    if (selectError) {
      console.error('ensureStarterItemsOwned: failed to check existing starter items', selectError);
      return;
    }

    const alreadyOwnedIds = new Set((existingData ?? []).map((row) => row.item_id as string));
    const missingIds = STARTER_ITEM_IDS.filter((id) => !alreadyOwnedIds.has(id));
    if (missingIds.length === 0) return;

    const { error: insertError } = await supabase.from('owned_items').insert(
      missingIds.map((itemId) => ({
        pet_id: pet.id,
        user_id: pet.user_id,
        item_id: itemId,
      }))
    );

    if (insertError) {
      console.error('ensureStarterItemsOwned: failed to grant starter items', insertError);
    }
  } catch (err) {
    console.error('ensureStarterItemsOwned: unexpected error granting starter items', err);
  }
}
