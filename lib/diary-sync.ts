import { createClient } from './supabase/server';
import { determineNewDiaryEvents, type DiaryEntry } from './diary';
import type { PetRow } from './pet-engine';

// Soft background sync: inserts any newly-detected got_sick/recovered events
// for this pet. Never throws — a failure here must not break page render.
export async function syncDiaryEvents(pet: PetRow): Promise<void> {
  try {
    const supabase = await createClient();

    const { data: existingEntries, error: fetchError } = await supabase
      .from('diary_entries')
      .select('*')
      .eq('pet_id', pet.id);

    if (fetchError) {
      console.error('syncDiaryEvents: failed to load existing entries', fetchError);
      return;
    }

    const now = new Date();
    const newEvents = determineNewDiaryEvents(pet, now, (existingEntries ?? []) as DiaryEntry[]);
    if (newEvents.length === 0) return;

    const { error: insertError } = await supabase.from('diary_entries').insert(
      newEvents.map((event) => ({
        pet_id: pet.id,
        user_id: pet.user_id,
        entry_type: event.entry_type,
        occurred_at: event.occurred_at,
        mood_snapshot: event.mood_snapshot,
      }))
    );

    if (insertError) {
      console.error('syncDiaryEvents: failed to insert new diary events', insertError);
    }
  } catch (err) {
    console.error('syncDiaryEvents: unexpected error syncing diary events', err);
  }
}
