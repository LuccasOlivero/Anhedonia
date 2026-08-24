import { createClient } from './supabase/server';
import { determineNewDiaryEvents, type DiaryEntry } from './diary';
import type { PetRow } from './pet-engine';

// Soft background sync: inserts any newly-detected got_sick/recovered events
// for this pet. Never throws — a failure here must not break page render.
//
// KNOWN LIMITATION: this is read-then-write with no transaction and no DB-level
// uniqueness guard. Two concurrent renders (e.g. two tabs, a prefetch racing a
// navigation) could both read the same existing-entries snapshot before either
// insert lands, and both insert the same event, producing a duplicate row.
// Repeated *sequential* visits are idempotent (verified); concurrent ones are not.
// Deferred because a real fix needs a DB-level unique constraint/partial index or
// an atomic Postgres-side check-and-insert, which is its own schema change.
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
