import { describe, it, expect } from 'vitest';
import {
  MISSIONS,
  COINS_PER_CARE_ACTION,
  DAILY_BONUS_COINS,
  computePeriodKey,
  shouldGrantDailyBonus,
  computeMissionProgress,
  determineMissionCompletionsToPay,
  type MissionEvent,
  type MissionCompletion,
} from './missions';

function makeMissionEvent(overrides: Partial<MissionEvent> = {}): MissionEvent {
  return {
    id: 'event-1',
    pet_id: 'pet-1',
    user_id: 'user-1',
    event_type: 'fed',
    occurred_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeMissionCompletion(overrides: Partial<MissionCompletion> = {}): MissionCompletion {
  return {
    id: 'completion-1',
    pet_id: 'pet-1',
    user_id: 'user-1',
    mission_id: 'daily-feed',
    period_key: '2026-08-23',
    completed_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('MISSIONS', () => {
  it('defines exactly 3 v1 missions: 2 daily, 1 weekly', () => {
    expect(MISSIONS).toHaveLength(3);
    expect(MISSIONS.filter((m) => m.period === 'daily')).toHaveLength(2);
    expect(MISSIONS.filter((m) => m.period === 'weekly')).toHaveLength(1);
  });

  it('has unique mission ids', () => {
    const ids = MISSIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('matches the spec content: feed today, bathe when dirty, play 5x this week', () => {
    const feedMission = MISSIONS.find((m) => m.eventType === 'fed')!;
    expect(feedMission.period).toBe('daily');
    expect(feedMission.threshold).toBe(1);
    expect(feedMission.rewardCoins).toBe(15);

    const batheMission = MISSIONS.find((m) => m.eventType === 'bathed_dirty')!;
    expect(batheMission.period).toBe('daily');
    expect(batheMission.threshold).toBe(1);
    expect(batheMission.rewardCoins).toBe(15);

    const playMission = MISSIONS.find((m) => m.eventType === 'played')!;
    expect(playMission.period).toBe('weekly');
    expect(playMission.threshold).toBe(5);
    expect(playMission.rewardCoins).toBe(30);
  });

  it('sets the approved flat coin amounts', () => {
    expect(COINS_PER_CARE_ACTION).toBe(2);
    expect(DAILY_BONUS_COINS).toBe(10);
  });
});

describe('computePeriodKey (daily)', () => {
  it('formats a date as YYYY-MM-DD in UTC', () => {
    const now = new Date('2026-08-23T15:30:00.000Z');
    expect(computePeriodKey('daily', now)).toBe('2026-08-23');
  });

  it('pads single-digit months and days', () => {
    const now = new Date('2026-01-05T00:00:00.000Z');
    expect(computePeriodKey('daily', now)).toBe('2026-01-05');
  });
});

describe('computePeriodKey (weekly, ISO 8601)', () => {
  it('returns the same ISO week key for a date in the middle of a normal week (Wednesday)', () => {
    const wednesday = new Date('2026-08-19T12:00:00.000Z');
    expect(computePeriodKey('weekly', wednesday)).toBe('2026-W34');
  });

  it('returns the correct key for a Monday, the ISO week start', () => {
    const monday = new Date('2026-08-17T00:00:00.000Z');
    expect(computePeriodKey('weekly', monday)).toBe('2026-W34');
  });

  it('returns the correct key for a Sunday, the ISO week end, same week as its Monday', () => {
    const sunday = new Date('2026-08-23T23:00:00.000Z');
    expect(computePeriodKey('weekly', sunday)).toBe('2026-W34');
  });

  it('handles the ISO week-year boundary: 2025-12-29 is a Monday that starts ISO week 2026-W01, even though the calendar date is still in 2025', () => {
    const boundaryMonday = new Date('2025-12-29T10:00:00.000Z');
    expect(computePeriodKey('weekly', boundaryMonday)).toBe('2026-W01');
  });
});

describe('shouldGrantDailyBonus', () => {
  it('grants when last_daily_bonus_at is null (never granted before)', () => {
    expect(shouldGrantDailyBonus(null, new Date('2026-08-23T10:00:00.000Z'))).toBe(true);
  });

  it('does not grant again later the same UTC calendar day', () => {
    const lastBonus = '2026-08-23T01:00:00.000Z';
    const now = new Date('2026-08-23T23:59:00.000Z');
    expect(shouldGrantDailyBonus(lastBonus, now)).toBe(false);
  });

  it('grants again on a new UTC calendar day', () => {
    const lastBonus = '2026-08-23T23:59:00.000Z';
    const now = new Date('2026-08-24T00:01:00.000Z');
    expect(shouldGrantDailyBonus(lastBonus, now)).toBe(true);
  });
});

describe('computeMissionProgress', () => {
  it('reports 0/threshold and not completed with no events', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    const progress = computeMissionProgress([], [], now);
    expect(progress).toHaveLength(3);
    for (const p of progress) {
      expect(p.count).toBe(0);
      expect(p.isCompleted).toBe(false);
    }
  });

  it('counts only events of the matching type within the current period', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    const events = [
      makeMissionEvent({ event_type: 'fed', occurred_at: '2026-08-23T08:00:00.000Z' }),
      makeMissionEvent({ event_type: 'fed', occurred_at: '2026-08-22T08:00:00.000Z' }), // yesterday, doesn't count
      makeMissionEvent({ event_type: 'played', occurred_at: '2026-08-23T08:00:00.000Z' }), // wrong type for feed mission
    ];
    const progress = computeMissionProgress(events, [], now);
    const feedProgress = progress.find((p) => p.mission.id === 'daily-feed')!;
    expect(feedProgress.count).toBe(1);
  });

  it('marks a daily mission completed once its count reaches the threshold and a completion row exists', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    const events = [makeMissionEvent({ event_type: 'fed', occurred_at: '2026-08-23T08:00:00.000Z' })];
    const completions = [makeMissionCompletion({ mission_id: 'daily-feed', period_key: '2026-08-23' })];
    const progress = computeMissionProgress(events, completions, now);
    const feedProgress = progress.find((p) => p.mission.id === 'daily-feed')!;
    expect(feedProgress.isCompleted).toBe(true);
  });

  it('counts weekly play events across the whole ISO week, not just today', () => {
    const now = new Date('2026-08-19T12:00:00.000Z'); // Wednesday, week 2026-W34
    const events = [
      makeMissionEvent({ event_type: 'played', occurred_at: '2026-08-17T09:00:00.000Z' }), // Monday, same week
      makeMissionEvent({ event_type: 'played', occurred_at: '2026-08-19T09:00:00.000Z' }), // Wednesday, same week
      makeMissionEvent({ event_type: 'played', occurred_at: '2026-08-10T09:00:00.000Z' }), // prior week
    ];
    const progress = computeMissionProgress(events, [], now);
    const playProgress = progress.find((p) => p.mission.id === 'weekly-play')!;
    expect(playProgress.count).toBe(2);
    expect(playProgress.isCompleted).toBe(false); // threshold is 5
  });
});

describe('determineMissionCompletionsToPay', () => {
  it('returns nothing when no mission has reached its threshold', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    expect(determineMissionCompletionsToPay([], [], now)).toEqual([]);
  });

  it('returns a payout for a newly-completed daily mission', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    const events = [makeMissionEvent({ event_type: 'fed', occurred_at: '2026-08-23T08:00:00.000Z' })];
    const payouts = determineMissionCompletionsToPay(events, [], now);
    expect(payouts).toEqual([{ mission_id: 'daily-feed', period_key: '2026-08-23', rewardCoins: 15 }]);
  });

  it('does not re-pay a mission that already has a completion row for the current period', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    const events = [makeMissionEvent({ event_type: 'fed', occurred_at: '2026-08-23T08:00:00.000Z' })];
    const completions = [makeMissionCompletion({ mission_id: 'daily-feed', period_key: '2026-08-23' })];
    expect(determineMissionCompletionsToPay(events, completions, now)).toEqual([]);
  });

  it('pays the weekly mission once its threshold is reached, with the ISO week period_key', () => {
    const now = new Date('2026-08-19T12:00:00.000Z'); // 2026-W34
    const events = Array.from({ length: 5 }, (_, i) =>
      makeMissionEvent({ event_type: 'played', occurred_at: `2026-08-${17 + i}T09:00:00.000Z` })
    );
    const payouts = determineMissionCompletionsToPay(events, [], now);
    expect(payouts).toEqual([{ mission_id: 'weekly-play', period_key: '2026-W34', rewardCoins: 30 }]);
  });

  it('can return multiple payouts at once when several missions complete in the same sync', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    const events = [
      makeMissionEvent({ event_type: 'fed', occurred_at: '2026-08-23T08:00:00.000Z' }),
      makeMissionEvent({ event_type: 'bathed_dirty', occurred_at: '2026-08-23T08:00:00.000Z' }),
    ];
    const payouts = determineMissionCompletionsToPay(events, [], now);
    expect(payouts.map((p) => p.mission_id).sort()).toEqual(['daily-bathe-dirty', 'daily-feed']);
  });
});
