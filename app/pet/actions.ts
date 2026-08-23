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
} from '@/lib/pet-engine';

async function loadPet(): Promise<{ error: string } | { pet: PetRow }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not logged in.' };

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) return { error: 'No pet found.' };
  return { pet: pet as PetRow };
}

export async function feed() {
  const loaded = await loadPet();
  if ('error' in loaded) return loaded;

  const supabase = await createClient();
  const now = new Date();
  const newStats = feedStats(computeCurrentStats(loaded.pet, now));

  const { error } = await supabase
    .from('pets')
    .update({ ...newStats, last_updated_at: now.toISOString() })
    .eq('id', loaded.pet.id);

  if (error) return { error: error.message };
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
    .update({ ...result, last_updated_at: now.toISOString() })
    .eq('id', loaded.pet.id);

  if (error) return { error: error.message };
  revalidatePath('/pet');
  return { error: null };
}

export async function bathe() {
  const loaded = await loadPet();
  if ('error' in loaded) return loaded;

  const supabase = await createClient();
  const now = new Date();
  const newStats = batheStats(computeCurrentStats(loaded.pet, now));

  const { error } = await supabase
    .from('pets')
    .update({ ...newStats, last_updated_at: now.toISOString() })
    .eq('id', loaded.pet.id);

  if (error) return { error: error.message };
  revalidatePath('/pet');
  return { error: null };
}

export async function toggleSleep() {
  const loaded = await loadPet();
  if ('error' in loaded) return loaded;

  const supabase = await createClient();
  const now = new Date();
  const currentStats = computeCurrentStats(loaded.pet, now);

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
    .update({ ...result, last_updated_at: now.toISOString() })
    .eq('id', loaded.pet.id);

  if (error) return { error: error.message };
  revalidatePath('/pet');
  return { error: null };
}
