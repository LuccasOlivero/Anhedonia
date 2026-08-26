import { describe, it, expect } from 'vitest';
import { shouldSendDailyBonusEmail, type NotificationPreferences } from './notifications';
import { computePeriodKey, shouldGrantDailyBonus } from './missions';
import type { PetRow } from './pet-engine';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function makePet(overrides: Partial<PetRow> = {}): PetRow {
  return {
    id: 'pet-1',
    user_id: 'user-1',
    name: 'Fluffy',
    created_at: new Date(Date.now() - 10 * DAY).toISOString(),
    last_updated_at: new Date(Date.now() - 10 * DAY).toISOString(),
    hunger: 100,
    happiness: 100,
    energy: 100,
    cleanliness: 100,
    is_sleeping: false,
    sprites: {} as PetRow['sprites'],
    coins: 0,
    last_daily_bonus_at: null,
    bond_score: 0,
    bond_streak_days: 0,
    last_bond_sync_date: null,
    ...overrides,
  };
}

function makePrefs(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return {
    daily_bonus_email_enabled: true,
    last_daily_bonus_email_sent_date: null,
    ...overrides,
  };
}

describe('shouldSendDailyBonusEmail', () => {
  it('returns false when daily_bonus_email_enabled is false, regardless of other state', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');

    // Bonus unclaimed, never emailed before — would otherwise be eligible.
    expect(
      shouldSendDailyBonusEmail(
        makePet({ last_daily_bonus_at: null }),
        makePrefs({ daily_bonus_email_enabled: false, last_daily_bonus_email_sent_date: null }),
        now
      )
    ).toBe(false);

    // Bonus already claimed today too — still false, for the same reason.
    expect(
      shouldSendDailyBonusEmail(
        makePet({ last_daily_bonus_at: '2026-08-23T08:00:00.000Z' }),
        makePrefs({ daily_bonus_email_enabled: false, last_daily_bonus_email_sent_date: '2026-08-22' }),
        now
      )
    ).toBe(false);
  });

  it("returns false when last_daily_bonus_email_sent_date already equals today's date-key, even if the bonus is also unclaimed", () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    const pet = makePet({ last_daily_bonus_at: null });
    const prefs = makePrefs({ daily_bonus_email_enabled: true, last_daily_bonus_email_sent_date: '2026-08-23' });
    expect(shouldSendDailyBonusEmail(pet, prefs, now)).toBe(false);
  });

  it('returns true when enabled, bonus unclaimed today (never claimed at all), and never emailed before', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    const pet = makePet({ last_daily_bonus_at: null });
    const prefs = makePrefs({ daily_bonus_email_enabled: true, last_daily_bonus_email_sent_date: null });
    expect(shouldSendDailyBonusEmail(pet, prefs, now)).toBe(true);
  });

  it('returns true when enabled, bonus unclaimed today (last claimed yesterday), and last emailed on a different past day', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    const pet = makePet({ last_daily_bonus_at: '2026-08-22T09:00:00.000Z' });
    const prefs = makePrefs({ daily_bonus_email_enabled: true, last_daily_bonus_email_sent_date: '2026-08-21' });
    expect(shouldSendDailyBonusEmail(pet, prefs, now)).toBe(true);
  });

  it('returns false when enabled but the bonus was already claimed today, even if never emailed before', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    const pet = makePet({ last_daily_bonus_at: '2026-08-23T08:00:00.000Z' });
    const prefs = makePrefs({ daily_bonus_email_enabled: true, last_daily_bonus_email_sent_date: null });
    expect(shouldSendDailyBonusEmail(pet, prefs, now)).toBe(false);
  });

  it('composes correctly with the real computePeriodKey/shouldGrantDailyBonus implementations across a UTC day boundary', () => {
    // Bonus claimed just before midnight UTC on 2026-08-22; "now" is just
    // after midnight UTC the next day. This is an integration-style test —
    // it imports the real lib/missions.ts functions (no mocks) specifically
    // to prove the reused day-key/day-boundary logic actually composes
    // correctly with shouldSendDailyBonusEmail's own todayKey comparison,
    // not just that each piece passes in isolation.
    const pet = makePet({ last_daily_bonus_at: '2026-08-22T23:59:00.000Z' });
    const now = new Date('2026-08-23T00:01:00.000Z');
    const prefs = makePrefs({ daily_bonus_email_enabled: true, last_daily_bonus_email_sent_date: '2026-08-22' });

    // Sanity-check the reused primitives agree this is a new day before
    // asserting on the function under test.
    expect(computePeriodKey('daily', now)).toBe('2026-08-23');
    expect(shouldGrantDailyBonus(pet.last_daily_bonus_at, now)).toBe(true);

    expect(shouldSendDailyBonusEmail(pet, prefs, now)).toBe(true);
  });
});
