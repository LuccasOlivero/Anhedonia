import { createClient } from './supabase/server';
import {
  DAILY_BONUS_COINS,
  determineMissionCompletionsToPay,
  shouldGrantDailyBonus,
  type MissionCompletion,
  type MissionEvent,
} from './missions';
import type { PetRow } from './pet-engine';

// Soft background sync: grants the once-per-day login bonus and pays out any
// newly-completed mission for its current period. Never throws — a failure
// here must not break page render. Mirrors lib/diary-sync.ts's exact shape.
//
// KNOWN LIMITATION: awarding coins (`coins: pet.coins + coinDelta`) is a
// read-modify-write with no transaction — the same character as
// lib/diary-sync.ts's already-documented concurrent-render risk. Two
// concurrent renders could both read the same `pet.coins` snapshot and both
// write, dropping one award. There is also a smaller window between the
// mission_completions insert below and the pets update: if the insert
// succeeds but the update fails, that mission's completion is permanently
// recorded without ever paying its coins (it will never be retried, since
// determineMissionCompletionsToPay treats it as already paid). Both are
// deferred for the same reason as the diary precedent: a real fix needs a
// DB-level atomic increment (e.g. a Postgres RPC), which is its own schema
// change. Repeated *sequential* visits are otherwise idempotent — the unique
// constraint on mission_completions prevents double-paying a mission, and
// last_daily_bonus_at prevents double-paying the daily bonus.
export async function syncMissionsAndDailyBonus(pet: PetRow): Promise<void> {
  try {
    const supabase = await createClient();
    const now = new Date();

    const { data: eventsData, error: eventsError } = await supabase
      .from('mission_events')
      .select('*')
      .eq('pet_id', pet.id);

    if (eventsError) {
      console.error('syncMissionsAndDailyBonus: failed to load mission events', eventsError);
      return;
    }

    const { data: completionsData, error: completionsError } = await supabase
      .from('mission_completions')
      .select('*')
      .eq('pet_id', pet.id);

    if (completionsError) {
      console.error('syncMissionsAndDailyBonus: failed to load mission completions', completionsError);
      return;
    }

    const events = (eventsData ?? []) as MissionEvent[];
    const completions = (completionsData ?? []) as MissionCompletion[];

    const grantDailyBonus = shouldGrantDailyBonus(pet.last_daily_bonus_at, now);
    const payouts = determineMissionCompletionsToPay(events, completions, now);

    if (!grantDailyBonus && payouts.length === 0) return;

    if (payouts.length > 0) {
      const { error: insertError } = await supabase.from('mission_completions').insert(
        payouts.map((payout) => ({
          pet_id: pet.id,
          user_id: pet.user_id,
          mission_id: payout.mission_id,
          period_key: payout.period_key,
        }))
      );

      if (insertError) {
        console.error('syncMissionsAndDailyBonus: failed to insert mission completions', insertError);
        return;
      }
    }

    const missionCoins = payouts.reduce((sum, payout) => sum + payout.rewardCoins, 0);
    const bonusCoins = grantDailyBonus ? DAILY_BONUS_COINS : 0;

    const update: { coins: number; last_daily_bonus_at?: string } = {
      coins: pet.coins + missionCoins + bonusCoins,
    };
    if (grantDailyBonus) {
      update.last_daily_bonus_at = now.toISOString();
    }

    const { error: updateError } = await supabase.from('pets').update(update).eq('id', pet.id);
    if (updateError) {
      console.error('syncMissionsAndDailyBonus: failed to update coins/daily bonus', updateError);
    }
  } catch (err) {
    console.error('syncMissionsAndDailyBonus: unexpected error syncing missions/daily bonus', err);
  }
}
