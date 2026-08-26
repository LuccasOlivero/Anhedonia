import { computePeriodKey } from './missions';

export type BondTier = 'conociendose' | 'cercanos' | 'vinculo-fuerte' | 'inseparables';

export interface BondTierInfo {
  tier: BondTier;
  label: string;
  message: string;
}

interface BondTierDefinition extends BondTierInfo {
  min: number;
  max: number;
}

// Fixed tier catalog, same pattern as missions.ts's MISSIONS array: a closed
// set defined in code, never persisted. Ranges are contiguous over the full
// 0-100 domain a bond_score can take.
//
// Every message celebrates the user's presence in this exact moment
// ("verte" = seeing you, "esto me hace feliz" = this makes me happy, "sos
// parte de mi día" = you're part of my day) and never references, implies,
// or hints at the user having been away — no "te extrañé" ("I missed you")
// or equivalent in any tier, regardless of how long the user was actually
// gone. This is a hard constraint from the design spec, mirroring the Diary
// feature's own anti-manipulation guardrail. "¡Volviste!" ("You're back!")
// is a neutral statement of the reunion itself, not a comment on the gap
// that preceded it.
const BOND_TIERS: BondTierDefinition[] = [
  {
    tier: 'conociendose',
    label: 'Conociéndose',
    message: '¡Hola! Qué bueno verte 👋',
    min: 0,
    max: 24,
  },
  {
    tier: 'cercanos',
    label: 'Cercanos',
    message: '¡Qué alegría verte! 😊',
    min: 25,
    max: 49,
  },
  {
    tier: 'vinculo-fuerte',
    label: 'Vínculo fuerte',
    message: '¡Volviste! Esto me hace muy feliz 💛',
    min: 50,
    max: 74,
  },
  {
    tier: 'inseparables',
    label: 'Inseparables',
    message: '¡Sos parte de mi día! 🥰',
    min: 75,
    max: 100,
  },
];

export const BOND_SCORE_MIN = 0;
export const BOND_SCORE_MAX = 100;

// Clamps the input into [BOND_SCORE_MIN, BOND_SCORE_MAX] before matching a
// tier. score can't leave that range from any real app code path today
// (computeNextBondState already clamps it on every write), but a hand-crafted
// out-of-range value should still map to the *nearest* valid tier rather than
// silently falling back to BOND_TIERS[0] (Conociéndose) via the `?? BOND_TIERS[0]`
// below — e.g. a stray 150 reads as Inseparables, not as if the pet were a
// stranger.
export function computeBondTier(score: number): BondTierInfo {
  const clamped = Math.max(BOND_SCORE_MIN, Math.min(BOND_SCORE_MAX, score));
  const definition = BOND_TIERS.find((t) => clamped >= t.min && clamped <= t.max) ?? BOND_TIERS[0];
  return { tier: definition.tier, label: definition.label, message: definition.message };
}

export const BOND_SCORE_GROWTH_PER_CARED_FOR_DAY = 3;
export const BOND_SCORE_DECAY_PER_MISSED_DAY = 1;

export interface BondState {
  bondScore: number;
  streakDays: number;
  lastSyncDate: string | null;
}

// Adds/subtracts whole UTC days from a computePeriodKey('daily', ...)-style
// date key without reimplementing its formatting — parses the key back into
// a UTC Date, shifts it, and re-formats through computePeriodKey. Date.UTC
// normalizes out-of-range day values automatically (e.g. day 32 rolls into
// the next month), so this handles month/year rollovers for free — same
// technique missions.ts's computeIsoWeekPeriodKey already relies on.
function addUtcDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return computePeriodKey('daily', new Date(Date.UTC(year, month - 1, day + days)));
}

// Advances { bondScore, streakDays, lastSyncDate } across every fully-elapsed
// UTC calendar day between the current state and `now`, applying the design
// spec's growth/decay/grace-period rules one day at a time, in chronological
// order.
//
// Cold start: lastSyncDate === null means this pet has never been synced
// before. Establish today as the baseline with no growth or decay applied —
// there is nothing to evaluate yet.
//
// Otherwise, walk every calendar day from `lastSyncDate` up to (and
// including) yesterday relative to `now` — today itself is excluded, since
// it isn't over yet and can't be judged "missed" or "cared for" (if
// lastSyncDate is already today, the walk is empty: a true no-op for a
// same-day repeat visit).
//
// The walk starts INCLUSIVELY at lastSyncDate itself, not the day after it.
// Every call ends by advancing lastSyncDate to *today* (needed so
// lib/bond-sync.ts's "already synced today" no-op check works), which means
// the calendar day of any given sync call is never evaluated by that same
// call. If the walk instead started strictly after lastSyncDate, a user who
// opens the app exactly once per day would find lastSyncDate permanently
// equal to "yesterday" on every subsequent visit — an empty range, forever —
// and bond_score could never grow for the app's single most common usage
// pattern. Starting inclusively at lastSyncDate is what lets a once-a-day
// visitor actually accrue streak and score (see the "regression" test above).
export function computeNextBondState(
  current: BondState,
  caredForDateKeys: Set<string>,
  now: Date
): BondState {
  const todayKey = computePeriodKey('daily', now);

  if (current.lastSyncDate === null) {
    return { bondScore: 0, streakDays: 0, lastSyncDate: todayKey };
  }

  const yesterdayKey = addUtcDays(todayKey, -1);

  let bondScore = current.bondScore;
  let streakDays = current.streakDays;

  // Whether the day immediately before the first day we're about to walk was
  // itself a cared-for day. streakDays > 0 iff the most recently *evaluated*
  // day (from a prior call) extended an unbroken streak, so it was
  // cared-for; streakDays === 0 means that day was either a genuine prior
  // miss (in which case treating this as "not cared-for" correctly continues
  // decaying through an ongoing absence across sync calls) or this pet is
  // still at its cold-start baseline (bondScore is also 0 in that case, so
  // any extra decay this causes is clamped by the floor and unobservable).
  let previousDayWasCaredFor = streakDays > 0;

  let cursor = current.lastSyncDate;
  while (cursor <= yesterdayKey) {
    if (caredForDateKeys.has(cursor)) {
      streakDays += 1;
      bondScore = Math.min(BOND_SCORE_MAX, bondScore + BOND_SCORE_GROWTH_PER_CARED_FOR_DAY);
      previousDayWasCaredFor = true;
    } else {
      streakDays = 0;
      if (!previousDayWasCaredFor) {
        bondScore = Math.max(BOND_SCORE_MIN, bondScore - BOND_SCORE_DECAY_PER_MISSED_DAY);
      }
      previousDayWasCaredFor = false;
    }
    cursor = addUtcDays(cursor, 1);
  }

  return { bondScore, streakDays, lastSyncDate: todayKey };
}
