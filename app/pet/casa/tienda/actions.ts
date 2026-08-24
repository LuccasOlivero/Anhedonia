'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { findItem } from '@/lib/items';
import type { PetRow } from '@/lib/pet-engine';

async function loadPet(): Promise<{ error: string } | { pet: PetRow }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not logged in.' };

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) return { error: 'No pet found.' };
  return { pet: pet as PetRow };
}

export async function buyItem(itemId: string): Promise<{ error: string | null }> {
  const loaded = await loadPet();
  if ('error' in loaded) return loaded;

  const item = findItem(itemId);
  if (!item) return { error: 'Unknown item.' };

  const supabase = await createClient();

  const { data: alreadyOwned } = await supabase
    .from('owned_items')
    .select('id')
    .eq('pet_id', loaded.pet.id)
    .eq('item_id', itemId)
    .maybeSingle();

  if (alreadyOwned) return { error: 'You already own this item.' };

  // Re-read the current coin balance immediately before spending — never
  // trust the balance the client last rendered, since it may be stale
  // (another tab, another action completed since the page loaded).
  const { data: freshPet } = await supabase
    .from('pets')
    .select('coins')
    .eq('id', loaded.pet.id)
    .maybeSingle();

  const currentCoins = freshPet?.coins ?? loaded.pet.coins;
  if (currentCoins < item.priceCoins) return { error: 'Not enough coins.' };

  const { error: coinsError } = await supabase
    .from('pets')
    .update({ coins: currentCoins - item.priceCoins })
    .eq('id', loaded.pet.id);

  if (coinsError) return { error: coinsError.message };

  const { error: insertError } = await supabase.from('owned_items').insert({
    pet_id: loaded.pet.id,
    user_id: loaded.pet.user_id,
    item_id: itemId,
  });

  if (insertError) return { error: insertError.message };

  revalidatePath('/pet/casa/tienda');
  revalidatePath('/pet/casa');
  return { error: null };
}
