import { createClient } from './supabase/server';
import { computeNextBondState } from './bond';
import { computePeriodKey, type MissionEvent } from './missions';
import type { PetRow } from './pet-engine';

// Lazy sync: advances bond_score/bond_streak_days/last_bond_sync_date by
// however many full UTC calendar days have elapsed since the pet's last
// sync, based on which of those days had at least one mission_events row.
// Never throws — a failure here must not break page render. Mirrors
// lib/missions-sync.ts's syncMissionsAndDailyBonus exactly in shape.
//
// No-ops immediately, before querying mission_events at all, if
// last_bond_sync_date already equals today's UTC date-key — this is the
// common case (at most one real sync per pet per day) and matches the
// design spec's explicit "no-ops immediately... on same-day repeat visits"
// requirement.
//
// mission_events is read unbounded per pet (select('*').eq('pet_id', ...)
// with no date filter), matching the same precedent already established by
// syncMissionsAndDailyBonus — this app's mission_events table does not grow
// large enough per pet to make that a real concern, and computeNextBondState
// only ever walks days from last_bond_sync_date forward, so any older rows
// in the result are harmless, unused input.
//
// KNOWN LIMITATION: the read-then-write here (read pet.bond_score/
// bond_streak_days/last_bond_sync_date, compute the next state, then write
// it back) has no transaction. Two concurrent first-loads-of-the-day for the
// same pet, landing within the same narrow window, could both read the same
// pre-sync snapshot and both write — the later-landing write would move
// last_bond_sync_date backwards relative to the earlier one, causing one
// calendar day to be re-evaluated on a later sync (a duplicate +3 growth or
// -1 decay for that one day). This requires two genuinely simultaneous
// requests within roughly a one-second window, once per day, making it less
// reachable than the coins-award race this same codebase already accepts as
// a known, accepted limitation in lib/missions-sync.ts.
export async function syncBondScore(pet: PetRow): Promise<void> {
  try {
    const now = new Date();
    const todayKey = computePeriodKey('daily', now);

    if (pet.last_bond_sync_date === todayKey) return;

    const supabase = await createClient();

    const { data: eventsData, error: eventsError } = await supabase
      .from('mission_events')
      .select('*')
      .eq('pet_id', pet.id);

    if (eventsError) {
      console.error('syncBondScore: failed to load mission events', eventsError);
      return;
    }

    const events = (eventsData ?? []) as MissionEvent[];
    const caredForDateKeys = new Set(events.map((e) => computePeriodKey('daily', new Date(e.occurred_at))));

    const next = computeNextBondState(
      {
        bondScore: pet.bond_score,
        streakDays: pet.bond_streak_days,
        lastSyncDate: pet.last_bond_sync_date,
      },
      caredForDateKeys,
      now
    );

    const { error: updateError } = await supabase
      .from('pets')
      .update({
        bond_score: next.bondScore,
        bond_streak_days: next.streakDays,
        last_bond_sync_date: next.lastSyncDate,
      })
      .eq('id', pet.id);

    if (updateError) {
      console.error('syncBondScore: failed to update bond score', updateError);
    }
  } catch (err) {
    console.error('syncBondScore: unexpected error syncing bond score', err);
  }
}
