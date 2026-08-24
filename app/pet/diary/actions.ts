'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { computeCurrentStats, computeIsSick, computeMood, type PetRow } from '@/lib/pet-engine';

const MAX_NOTE_LENGTH = 280;

async function loadPet(): Promise<{ error: string } | { pet: PetRow }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not logged in.' };

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) return { error: 'No pet found.' };
  return { pet: pet as PetRow };
}

export async function addDiaryNote(_prevState: { error: string | null }, formData: FormData) {
  const rawText = formData.get('text');
  const text = typeof rawText === 'string' ? rawText.trim() : '';

  if (!text) {
    return { error: 'Please write something before saving.' };
  }
  if (text.length > MAX_NOTE_LENGTH) {
    return { error: `Notes must be ${MAX_NOTE_LENGTH} characters or fewer.` };
  }

  const loaded = await loadPet();
  if ('error' in loaded) return loaded;

  const supabase = await createClient();
  const now = new Date();
  const stats = computeCurrentStats(loaded.pet, now);
  const isSick = computeIsSick(loaded.pet, now);
  const moodSnapshot = computeMood(stats, isSick, loaded.pet.is_sleeping);

  const { error } = await supabase.from('diary_entries').insert({
    pet_id: loaded.pet.id,
    user_id: loaded.pet.user_id,
    entry_type: 'note',
    occurred_at: now.toISOString(),
    mood_snapshot: moodSnapshot,
    text,
  });

  if (error) return { error: error.message };

  revalidatePath('/pet/diary');
  return { error: null };
}
