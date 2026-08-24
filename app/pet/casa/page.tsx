import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ensureStarterItemsOwned } from '@/lib/room-sync';
import { computeItemsWithOwnership, type OwnedItem, type PlacedItem } from '@/lib/items';
import type { PetRow } from '@/lib/pet-engine';
import { Room } from './Room';

export default async function CasaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) redirect('/onboarding');

  const petRow = pet as PetRow;

  // Runs before re-reading owned_items below so a pet visiting /pet/casa
  // for the first time already has its starter items in the list.
  await ensureStarterItemsOwned(petRow);

  const [{ data: ownedData }, { data: placedData }] = await Promise.all([
    supabase.from('owned_items').select('*').eq('pet_id', petRow.id),
    supabase.from('placed_items').select('*').eq('pet_id', petRow.id),
  ]);

  const ownedItems = (ownedData ?? []) as OwnedItem[];
  const placedItems = (placedData ?? []) as PlacedItem[];
  const itemsWithOwnership = computeItemsWithOwnership(ownedItems);

  return (
    <Room
      petName={petRow.name}
      coins={petRow.coins}
      initialPlacedItems={placedItems}
      itemsWithOwnership={itemsWithOwnership}
    />
  );
}
