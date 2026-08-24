'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { findItem, clampPct } from '@/lib/items';
import type { PetRow } from '@/lib/pet-engine';

async function loadPet(): Promise<{ error: string } | { pet: PetRow }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not logged in.' };

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) return { error: 'No pet found.' };
  return { pet: pet as PetRow };
}

export async function placeItem(itemId: string, positionXPct: number): Promise<{ error: string | null }> {
  const loaded = await loadPet();
  if ('error' in loaded) return loaded;

  const item = findItem(itemId);
  if (!item) return { error: 'Unknown item.' };

  const supabase = await createClient();

  const { data: owned } = await supabase
    .from('owned_items')
    .select('id')
    .eq('pet_id', loaded.pet.id)
    .eq('item_id', itemId)
    .maybeSingle();

  if (!owned) return { error: 'You do not own this item yet.' };

  const { error } = await supabase.from('placed_items').insert({
    pet_id: loaded.pet.id,
    user_id: loaded.pet.user_id,
    item_id: itemId,
    position_x_pct: clampPct(positionXPct),
  });

  if (error) return { error: error.message };

  revalidatePath('/pet/casa');
  return { error: null };
}

export async function removePlacedItem(placedItemId: string): Promise<{ error: string | null }> {
  const loaded = await loadPet();
  if ('error' in loaded) return loaded;

  const supabase = await createClient();

  const { error } = await supabase
    .from('placed_items')
    .delete()
    .eq('id', placedItemId)
    .eq('pet_id', loaded.pet.id);

  if (error) return { error: error.message };

  revalidatePath('/pet/casa');
  return { error: null };
}
