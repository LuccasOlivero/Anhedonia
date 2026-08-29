import { computePeriodKey, shouldGrantDailyBonus } from './missions';
import type { PetRow } from './pet-engine';

export interface NotificationPreferences {
  daily_bonus_email_enabled: boolean;
  last_daily_bonus_email_sent_date: string | null;
  streak_surprise_email_enabled: boolean;
  last_streak_surprise_email_sent_date: string | null;
}

// Eligibility check for the one working notification trigger this feature
// ships: "your daily bonus is ready". Pure and side-effect free — the cron
// route (app/api/cron/daily-notifications/route.ts) is the only caller, and
// it alone is responsible for the actual email send and the
// last_daily_bonus_email_sent_date write-back.
//
// Reuses shouldGrantDailyBonus (lib/missions.ts) for "bonus not yet claimed
// today" and computePeriodKey('daily', now) (also lib/missions.ts) for
// "already emailed today" — both already-tested UTC-day-key primitives this
// codebase's other daily-scoped features (missions, bond score) already
// rely on. Never reimplements date comparison itself.
export function shouldSendDailyBonusEmail(pet: PetRow, prefs: NotificationPreferences, now: Date): boolean {
  if (!prefs.daily_bonus_email_enabled) return false;

  const todayKey = computePeriodKey('daily', now);
  if (prefs.last_daily_bonus_email_sent_date === todayKey) return false;

  return shouldGrantDailyBonus(pet.last_daily_bonus_at, now);
}
