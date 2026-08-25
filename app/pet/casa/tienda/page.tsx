import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ensureStarterItemsOwned } from '@/lib/room-sync';
import { computeItemsWithOwnership, type OwnedItem } from '@/lib/items';
import type { PetRow } from '@/lib/pet-engine';
import { BuyButton } from './BuyButton';

const cardClass =
  'rounded-[2rem] border-8 border-[#6B4226] ring-4 ring-inset ring-[#C89B6C] bg-[#FFF9EC] p-6 shadow-[inset_0_3px_6px_rgba(0,0,0,0.15),0_10px_20px_rgba(0,0,0,0.25)]';

export default async function TiendaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) redirect('/onboarding');

  const petRow = pet as PetRow;

  // Ensures a pet that reaches the Tienda without ever having visited
  // /pet/casa first still has its starter items already marked owned, so
  // they're never incorrectly offered here for "purchase".
  await ensureStarterItemsOwned(petRow);

  const { data: ownedData } = await supabase.from('owned_items').select('*').eq('pet_id', petRow.id);
  const ownedItems = (ownedData ?? []) as OwnedItem[];
  const itemsWithOwnership = computeItemsWithOwnership(ownedItems);

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-gradient-to-b from-[#BEE7F5] to-[#B7E4A0] px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/pet/casa" className="text-sm font-semibold text-[#4A3222] underline">
            ← Back
          </Link>
          <h1 className="text-xl font-[family-name:var(--font-display)] font-bold text-[#4A3222]">Tienda</h1>
        </div>

        <div className="flex justify-end">
          <span className="rounded-full bg-[#FFF3C4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20">
            🪙 {petRow.coins}
          </span>
        </div>

        <div className="space-y-3">
          {itemsWithOwnership.map((item) => (
            <div key={item.id} className={`flex items-center gap-3 ${cardClass}`}>
              <span className="text-4xl">{item.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="font-[family-name:var(--font-display)] font-bold text-[#4A3222]">{item.name}</p>
                <p className="text-xs font-semibold text-[#8B5E3C]">🪙 {item.priceCoins}</p>
              </div>
              {item.owned ? (
                <span className="shrink-0 rounded-full bg-[#F0DEB4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20">
                  ✅ Ya la tenés
                </span>
              ) : (
                <BuyButton itemId={item.id} affordable={petRow.coins >= item.priceCoins} />
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
