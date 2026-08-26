import { describe, it, expect } from 'vitest';
import { computeBondTier } from './bond';

describe('computeBondTier', () => {
  it('returns the Conociéndose tier for scores 0-24', () => {
    expect(computeBondTier(0)).toEqual({
      tier: 'conociendose',
      label: 'Conociéndose',
      message: '¡Hola! Qué bueno verte 👋',
    });
    expect(computeBondTier(24)).toEqual({
      tier: 'conociendose',
      label: 'Conociéndose',
      message: '¡Hola! Qué bueno verte 👋',
    });
  });

  it('returns the Cercanos tier for scores 25-49', () => {
    expect(computeBondTier(25)).toEqual({
      tier: 'cercanos',
      label: 'Cercanos',
      message: '¡Qué alegría verte! 😊',
    });
    expect(computeBondTier(49).tier).toBe('cercanos');
  });

  it('returns the Vínculo fuerte tier for scores 50-74', () => {
    expect(computeBondTier(50)).toEqual({
      tier: 'vinculo-fuerte',
      label: 'Vínculo fuerte',
      message: '¡Volviste! Esto me hace muy feliz 💛',
    });
    expect(computeBondTier(74).tier).toBe('vinculo-fuerte');
  });

  it('returns the Inseparables tier for scores 75-100', () => {
    expect(computeBondTier(75)).toEqual({
      tier: 'inseparables',
      label: 'Inseparables',
      message: '¡Sos parte de mi día! 🥰',
    });
    expect(computeBondTier(100).tier).toBe('inseparables');
  });

  it('clamps out-of-range scores to the nearest valid tier instead of defaulting to the lowest', () => {
    expect(computeBondTier(150).tier).toBe('inseparables');
    expect(computeBondTier(-10).tier).toBe('conociendose');
  });

  it('never references, implies, or hints at the user\'s absence in any tier message', () => {
    // Hard constraint from the design spec: every message celebrates presence
    // ("verte", "me hace feliz", "sos parte de mi día"), never absence.
    const forbiddenPatterns = [/extra/i, /esperando/i, /esperé/i, /sin ti/i, /hac[ií]a tiempo/i, /tanto tiempo/i];
    for (const score of [0, 24, 25, 49, 50, 74, 75, 100]) {
      const { message } = computeBondTier(score);
      for (const pattern of forbiddenPatterns) {
        expect(message).not.toMatch(pattern);
      }
    }
  });
});

import { computeNextBondState, type BondState } from './bond';

describe('computeNextBondState', () => {
  it('initializes a fresh pet with no growth or decay (cold start)', () => {
    const now = new Date('2026-08-23T10:00:00.000Z');
    const result = computeNextBondState({ bondScore: 0, streakDays: 0, lastSyncDate: null }, new Set(), now);
    expect(result).toEqual({ bondScore: 0, streakDays: 0, lastSyncDate: '2026-08-23' });
  });

  it('grows the score and streak by one for a single cared-for day', () => {
    const current = { bondScore: 10, streakDays: 2, lastSyncDate: '2026-08-21' };
    const caredFor = new Set(['2026-08-21']);
    const now = new Date('2026-08-22T09:00:00.000Z'); // today=08-22, yesterday=08-21
    const result = computeNextBondState(current, caredFor, now);
    expect(result).toEqual({ bondScore: 13, streakDays: 3, lastSyncDate: '2026-08-22' });
  });

  it('does not decay on the first missed day, and resets the streak', () => {
    const current = { bondScore: 10, streakDays: 3, lastSyncDate: '2026-08-21' };
    const caredFor = new Set<string>();
    const now = new Date('2026-08-22T09:00:00.000Z'); // evaluates only 08-21
    const result = computeNextBondState(current, caredFor, now);
    expect(result).toEqual({ bondScore: 10, streakDays: 0, lastSyncDate: '2026-08-22' });
  });

  it('decays starting from the second consecutive missed day', () => {
    const current = { bondScore: 10, streakDays: 3, lastSyncDate: '2026-08-20' };
    const caredFor = new Set<string>();
    const now = new Date('2026-08-22T09:00:00.000Z'); // evaluates 08-20 (1st miss, free) and 08-21 (2nd, decays)
    const result = computeNextBondState(current, caredFor, now);
    expect(result).toEqual({ bondScore: 9, streakDays: 0, lastSyncDate: '2026-08-22' });
  });

  it('decays multiple times across a long absence, floored at 0', () => {
    const current = { bondScore: 3, streakDays: 1, lastSyncDate: '2026-08-15' };
    const caredFor = new Set<string>();
    const now = new Date('2026-08-22T09:00:00.000Z'); // evaluates 08-15..08-21 = 7 missed days
    const result = computeNextBondState(current, caredFor, now);
    // 08-15: 1st miss, free. 08-16..08-21 (6 more days): -1 each, but bondScore
    // only had 3 to lose before hitting the floor.
    expect(result).toEqual({ bondScore: 0, streakDays: 0, lastSyncDate: '2026-08-22' });
  });

  it('caps growth at 100', () => {
    const current = { bondScore: 97, streakDays: 5, lastSyncDate: '2026-08-19' };
    const caredFor = new Set(['2026-08-19', '2026-08-20', '2026-08-21']);
    const now = new Date('2026-08-22T09:00:00.000Z'); // 3 cared-for days; +9 would exceed 100
    const result = computeNextBondState(current, caredFor, now);
    expect(result).toEqual({ bondScore: 100, streakDays: 8, lastSyncDate: '2026-08-22' });
  });

  it('resets and restarts the streak across a single missed day in a mixed run, without accumulating through the miss', () => {
    const current = { bondScore: 0, streakDays: 0, lastSyncDate: '2026-08-19' };
    const caredFor = new Set(['2026-08-19', '2026-08-21']); // cared, missed (08-20), cared
    const now = new Date('2026-08-22T09:00:00.000Z');
    const result = computeNextBondState(current, caredFor, now);
    // 08-19 cared: streak 0->1, score +3 = 3
    // 08-20 missed: streak 1->0, first miss (previous day was cared-for) so free, score stays 3
    // 08-21 cared: streak restarts at 1 (not 2 — it does not accumulate through the miss), score +3 = 6
    expect(result).toEqual({ bondScore: 6, streakDays: 1, lastSyncDate: '2026-08-22' });
  });

  it('is a true no-op when lastSyncDate already equals today', () => {
    const current = { bondScore: 42, streakDays: 4, lastSyncDate: '2026-08-22' };
    const now = new Date('2026-08-22T18:00:00.000Z');
    const result = computeNextBondState(current, new Set(['2026-08-22']), now);
    expect(result).toEqual({ bondScore: 42, streakDays: 4, lastSyncDate: '2026-08-22' });
  });

  it('accrues score correctly across consecutive once-a-day sync calls (regression: a naive "strictly after lastSyncDate" boundary would stall this at zero forever)', () => {
    let state: BondState = { bondScore: 0, streakDays: 0, lastSyncDate: null };

    // Day 1: cold start.
    state = computeNextBondState(state, new Set(), new Date('2026-08-20T09:00:00.000Z'));
    expect(state).toEqual({ bondScore: 0, streakDays: 0, lastSyncDate: '2026-08-20' });

    // Day 2: the user cared for the pet on day 1 (2026-08-20).
    state = computeNextBondState(state, new Set(['2026-08-20']), new Date('2026-08-21T09:00:00.000Z'));
    expect(state).toEqual({ bondScore: 3, streakDays: 1, lastSyncDate: '2026-08-21' });

    // Day 3: the user cared for the pet on day 2 (2026-08-21) as well.
    state = computeNextBondState(
      state,
      new Set(['2026-08-20', '2026-08-21']),
      new Date('2026-08-22T09:00:00.000Z')
    );
    expect(state).toEqual({ bondScore: 6, streakDays: 2, lastSyncDate: '2026-08-22' });

    // Day 4: another consecutive cared-for day (2026-08-22).
    state = computeNextBondState(
      state,
      new Set(['2026-08-20', '2026-08-21', '2026-08-22']),
      new Date('2026-08-23T09:00:00.000Z')
    );
    expect(state).toEqual({ bondScore: 9, streakDays: 3, lastSyncDate: '2026-08-23' });
  });

  it('continues decaying across separate sync calls for the same ongoing absence (regression: previousDayWasCaredFor must not reset to a free grace day on every visit)', () => {
    // Call 1: an existing streak hits its first missed day. The grace period
    // applies within this call, so the score is untouched but the streak
    // resets to 0.
    let state: BondState = { bondScore: 10, streakDays: 2, lastSyncDate: '2026-08-19' };
    state = computeNextBondState(state, new Set(), new Date('2026-08-20T09:00:00.000Z'));
    expect(state).toEqual({ bondScore: 10, streakDays: 0, lastSyncDate: '2026-08-20' });

    // Call 2: a separate, later call whose single evaluated day is the very
    // next day of the SAME real-world absence. Because streakDays is 0 going
    // in, previousDayWasCaredFor must initialize to false (not grant a fresh
    // free grace day), so this decays.
    state = computeNextBondState(state, new Set(), new Date('2026-08-21T09:00:00.000Z'));
    expect(state).toEqual({ bondScore: 9, streakDays: 0, lastSyncDate: '2026-08-21' });
  });
});
