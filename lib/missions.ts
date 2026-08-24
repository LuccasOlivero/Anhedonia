export type MissionEventType = 'fed' | 'bathed_dirty' | 'played' | 'medicated';
export type MissionPeriod = 'daily' | 'weekly';

export interface MissionEvent {
  id: string;
  pet_id: string;
  user_id: string;
  event_type: MissionEventType;
  occurred_at: string;
}

export interface MissionCompletion {
  id: string;
  pet_id: string;
  user_id: string;
  mission_id: string;
  period_key: string;
  completed_at: string;
}

export interface Mission {
  id: string;
  period: MissionPeriod;
  eventType: MissionEventType;
  threshold: number;
  description: string;
  rewardCoins: number;
}

export const COINS_PER_CARE_ACTION = 2;
export const DAILY_BONUS_COINS = 10;
const DAILY_MISSION_REWARD_COINS = 15;
const WEEKLY_MISSION_REWARD_COINS = 30;

// Fixed mission catalog, same pattern as pet-engine.ts's SpriteState list: a
// closed set defined in code, never persisted. mission_events/mission_completions
// only ever reference these ids/thresholds by joining against this array at read time.
export const MISSIONS: Mission[] = [
  {
    id: 'daily-feed',
    period: 'daily',
    eventType: 'fed',
    threshold: 1,
    description: 'Alimentá a tu mascota hoy',
    rewardCoins: DAILY_MISSION_REWARD_COINS,
  },
  {
    id: 'daily-bathe-dirty',
    period: 'daily',
    eventType: 'bathed_dirty',
    threshold: 1,
    description: 'Bañala si está sucia',
    rewardCoins: DAILY_MISSION_REWARD_COINS,
  },
  {
    id: 'weekly-play',
    period: 'weekly',
    eventType: 'played',
    threshold: 5,
    description: 'Jugá con ella 5 veces esta semana',
    rewardCoins: WEEKLY_MISSION_REWARD_COINS,
  },
];

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function computeDailyPeriodKey(now: Date): string {
  return `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}`;
}

// Standard ISO 8601 week algorithm: week 1 is the week (Monday-Sunday)
// containing the year's first Thursday. Shifting any date to "this week's
// Thursday" and reading that Thursday's calendar year gives the correct ISO
// week-year even when it differs from the input date's own calendar year
// (e.g. late-December dates that belong to next year's week 1, or
// early-January dates that belong to last year's final week).
function computeIsoWeekPeriodKey(now: Date): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const isoDayOfWeek = date.getUTCDay() === 0 ? 7 : date.getUTCDay(); // Mon=1 ... Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - isoDayOfWeek); // shift to this week's Thursday
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000) + 1) / 7);
  return `${isoYear}-W${pad2(weekNum)}`;
}

export function computePeriodKey(period: MissionPeriod, now: Date): string {
  return period === 'daily' ? computeDailyPeriodKey(now) : computeIsoWeekPeriodKey(now);
}

export function shouldGrantDailyBonus(lastDailyBonusAt: string | null, now: Date): boolean {
  if (lastDailyBonusAt === null) return true;
  return computePeriodKey('daily', new Date(lastDailyBonusAt)) !== computePeriodKey('daily', now);
}

export interface MissionProgress {
  mission: Mission;
  periodKey: string;
  count: number;
  isCompleted: boolean;
}

export interface MissionPayout {
  mission_id: string;
  period_key: string;
  rewardCoins: number;
}

function countEventsInPeriod(mission: Mission, events: MissionEvent[], periodKey: string): number {
  return events.filter(
    (e) => e.event_type === mission.eventType && computePeriodKey(mission.period, new Date(e.occurred_at)) === periodKey
  ).length;
}

export function computeMissionProgress(
  events: MissionEvent[],
  completions: MissionCompletion[],
  now: Date
): MissionProgress[] {
  return MISSIONS.map((mission) => {
    const periodKey = computePeriodKey(mission.period, now);
    const count = countEventsInPeriod(mission, events, periodKey);
    const isCompleted = completions.some((c) => c.mission_id === mission.id && c.period_key === periodKey);
    return { mission, periodKey, count, isCompleted };
  });
}

// Determines which missions just crossed their threshold and have not yet
// been paid for the current period. Pure and idempotent: calling it again
// after the resulting completions are actually persisted (by lib/missions-sync.ts)
// returns an empty array for those missions, since they'll now match an
// existing completion row.
export function determineMissionCompletionsToPay(
  events: MissionEvent[],
  completions: MissionCompletion[],
  now: Date
): MissionPayout[] {
  const payouts: MissionPayout[] = [];
  for (const mission of MISSIONS) {
    const periodKey = computePeriodKey(mission.period, now);
    const count = countEventsInPeriod(mission, events, periodKey);
    if (count < mission.threshold) continue;

    const alreadyPaid = completions.some((c) => c.mission_id === mission.id && c.period_key === periodKey);
    if (alreadyPaid) continue;

    payouts.push({ mission_id: mission.id, period_key: periodKey, rewardCoins: mission.rewardCoins });
  }
  return payouts;
}
