'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  computeCurrentStats,
  computeIsSick,
  feed as feedStats,
  play as playStats,
  bathe as batheStats,
  medicine as medicineStats,
  type PetRow,
  type Stats,
} from '@/lib/pet-engine';
import { COINS_PER_CARE_ACTION, type MissionEventType } from '@/lib/missions';

async function loadPet(): Promise<{ error: string } | { pet: PetRow }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not logged in.' };

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) return { error: 'No pet found.' };
  return { pet: pet as PetRow };
}

// pet-engine.ts computes fractional decay; the `pets` table stores stats as smallint.
function roundStats(stats: Stats): Stats {
  return {
    hunger: Math.round(stats.hunger),
    happiness: Math.round(stats.happiness),
    energy: Math.round(stats.energy),
    cleanliness: Math.round(stats.cleanliness),
  };
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Best-effort coin/mission-event awarding, called only after the care action's
// primary stat update has already succeeded. Never throws — a failure here
// must not turn a successful care action into an error shown to the user.
//
// KNOWN LIMITATION: `coins: pet.coins + COINS_PER_CARE_ACTION` is a
// read-modify-write with no transaction, the same character as
// lib/diary-sync.ts's already-documented concurrent-render risk. Not fixed
// here for the same reason (would need a DB-level atomic increment/RPC).
async function awardCareActionCoins(
  supabase: SupabaseServerClient,
  pet: PetRow,
  eventType: MissionEventType | null
): Promise<void> {
  try {
    if (eventType) {
      const { error: eventError } = await supabase.from('mission_events').insert({
        pet_id: pet.id,
        user_id: pet.user_id,
        event_type: eventType,
      });
      if (eventError) {
        console.error('awardCareActionCoins: failed to log mission event', eventError);
      }
    }

    const { error: coinsError } = await supabase
      .from('pets')
      .update({ coins: pet.coins + COINS_PER_CARE_ACTION })
      .eq('id', pet.id);
    if (coinsError) {
      console.error('awardCareActionCoins: failed to award coins', coinsError);
    }
  } catch (err) {
    console.error('awardCareActionCoins: unexpected error awarding coins', err);
  }
}

export async function feed() {
  const loaded = await loadPet();
  if ('error' in loaded) return loaded;

  const supabase = await createClient();
  const now = new Date();
  const newStats = roundStats(feedStats(computeCurrentStats(loaded.pet, now)));

  const { error } = await supabase
    .from('pets')
    .update({ ...newStats, last_updated_at: now.toISOString() })
    .eq('id', loaded.pet.id);

  if (error) return { error: error.message };

  await awardCareActionCoins(supabase, loaded.pet, 'fed');

  revalidatePath('/pet');
  return { error: null };
}

export async function play() {
  const loaded = await loadPet();
  if ('error' in loaded) return loaded;

  const supabase = await createClient();
  const now = new Date();
  const result = playStats(computeCurrentStats(loaded.pet, now), loaded.pet.is_sleeping);
  if ('error' in result) return result;

  const { error } = await supabase
    .from('pets')
    .update({ ...roundStats(result), last_updated_at: now.toISOString() })
    .eq('id', loaded.pet.id);

  if (error) return { error: error.message };

  await awardCareActionCoins(supabase, loaded.pet, 'played');

  revalidatePath('/pet');
  return { error: null };
}

export async function bathe() {
  const loaded = await loadPet();
  if ('error' in loaded) return loaded;

  const supabase = await createClient();
  const now = new Date();
  const statsBeforeBathe = computeCurrentStats(loaded.pet, now);
  const newStats = roundStats(batheStats(statsBeforeBathe));

  const { error } = await supabase
    .from('pets')
    .update({ ...newStats, last_updated_at: now.toISOString() })
    .eq('id', loaded.pet.id);

  if (error) return { error: error.message };

  // 30 matches computeMood's dirty cutoff (`stats.cleanliness < 30`) in
  // lib/pet-engine.ts. bathed_dirty only counts as a real cleaning, not
  // routine maintenance of an already-clean pet — see the spec's Data Model
  // section. Coins are still awarded either way.
  const wasDirty = statsBeforeBathe.cleanliness < 30;
  await awardCareActionCoins(supabase, loaded.pet, wasDirty ? 'bathed_dirty' : null);

  revalidatePath('/pet');
  return { error: null };
}

export async function toggleSleep() {
  const loaded = await loadPet();
  if ('error' in loaded) return loaded;

  const supabase = await createClient();
  const now = new Date();
  const currentStats = roundStats(computeCurrentStats(loaded.pet, now));

  const { error } = await supabase
    .from('pets')
    .update({ ...currentStats, is_sleeping: !loaded.pet.is_sleeping, last_updated_at: now.toISOString() })
    .eq('id', loaded.pet.id);

  if (error) return { error: error.message };
  revalidatePath('/pet');
  return { error: null };
}

export async function medicine() {
  const loaded = await loadPet();
  if ('error' in loaded) return loaded;

  const supabase = await createClient();
  const now = new Date();
  const currentStats = computeCurrentStats(loaded.pet, now);
  const isSick = computeIsSick(loaded.pet, now);
  const result = medicineStats(currentStats, isSick);
  if ('error' in result) return result;

  const { error } = await supabase
    .from('pets')
    .update({ ...roundStats(result), last_updated_at: now.toISOString() })
    .eq('id', loaded.pet.id);

  if (error) return { error: error.message };

  await awardCareActionCoins(supabase, loaded.pet, 'medicated');

  revalidatePath('/pet');
  return { error: null };
}
