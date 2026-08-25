import { describe, it, expect } from 'vitest';
import {
  clamp,
  computeLifeStage,
  computeCurrentStats,
  LIFE_STAGE_DAYS,
  type PetRow,
} from './pet-engine';

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

describe('clamp', () => {
  it('leaves in-range values unchanged', () => {
    expect(clamp(50)).toBe(50);
  });

  it('clamps values below 0 up to 0', () => {
    expect(clamp(-10)).toBe(0);
  });

  it('clamps values above 100 down to 100', () => {
    expect(clamp(150)).toBe(100);
  });
});

describe('computeLifeStage', () => {
  it('is baby immediately at creation — there is no post-creation egg wait', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    expect(computeLifeStage(createdAt, createdAt)).toBe('baby');
  });

  it('is adult exactly at the baby boundary', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date(createdAt.getTime() + LIFE_STAGE_DAYS.baby * DAY);
    expect(computeLifeStage(createdAt, now)).toBe('adult');
  });

  it('is adult well past the baby boundary', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date(createdAt.getTime() + 100 * DAY);
    expect(computeLifeStage(createdAt, now)).toBe('adult');
  });
});

describe('computeCurrentStats', () => {
  it('decays each stat linearly by its own rate after hatching', () => {
    const pet = makePet({
      last_updated_at: new Date(Date.now() - 1 * HOUR).toISOString(),
      hunger: 100,
      happiness: 100,
      energy: 100,
      cleanliness: 100,
    });
    const stats = computeCurrentStats(pet, new Date());
    expect(stats.hunger).toBeCloseTo(100 - 100 / 24, 1);
    expect(stats.happiness).toBeCloseTo(100 - 100 / 48, 1);
    expect(stats.energy).toBeCloseTo(100 - 100 / 16, 1);
    expect(stats.cleanliness).toBeCloseTo(100 - 100 / 30, 1);
  });

  it('clamps decayed stats at 0, never negative', () => {
    const pet = makePet({ last_updated_at: new Date(Date.now() - 1000 * HOUR).toISOString() });
    const stats = computeCurrentStats(pet, new Date());
    expect(stats.hunger).toBe(0);
    expect(stats.cleanliness).toBe(0);
  });

  it('regenerates energy instead of decaying it while sleeping', () => {
    const pet = makePet({
      is_sleeping: true,
      energy: 50,
      last_updated_at: new Date(Date.now() - 1 * HOUR).toISOString(),
    });
    const stats = computeCurrentStats(pet, new Date());
    expect(stats.energy).toBeCloseTo(50 + 100 / 8, 1);
  });

  it('clamps regenerated energy at 100', () => {
    const pet = makePet({
      is_sleeping: true,
      energy: 95,
      last_updated_at: new Date(Date.now() - 1 * HOUR).toISOString(),
    });
    const stats = computeCurrentStats(pet, new Date());
    expect(stats.energy).toBe(100);
  });

});

import { computeIsSick } from './pet-engine';

describe('computeIsSick', () => {
  it('is not sick when hunger has not yet reached 0', () => {
    const pet = makePet({
      last_updated_at: new Date(Date.now() - 1 * HOUR).toISOString(),
      hunger: 100,
      cleanliness: 100,
    });
    expect(computeIsSick(pet, new Date())).toBe(false);
  });

  it('is not sick when hunger crossed 0 less than 24h ago', () => {
    // hunger=100, rate=100/24 per hour -> crosses 0 exactly 24h after last_updated_at
    const lastUpdatedAt = new Date(Date.now() - 30 * HOUR);
    const pet = makePet({ last_updated_at: lastUpdatedAt.toISOString(), hunger: 100, cleanliness: 100 });
    // crossing = lastUpdatedAt + 24h = now - 6h; only 6h since crossing
    expect(computeIsSick(pet, new Date())).toBe(false);
  });

  it('is sick when hunger crossed 0 more than 24h ago', () => {
    const lastUpdatedAt = new Date(Date.now() - 60 * HOUR);
    const pet = makePet({ last_updated_at: lastUpdatedAt.toISOString(), hunger: 100, cleanliness: 100 });
    // crossing = lastUpdatedAt + 24h = now - 36h; 36h since crossing > 24h threshold
    expect(computeIsSick(pet, new Date())).toBe(true);
  });

  it('is sick when cleanliness has been at 0 well past the threshold', () => {
    const lastUpdatedAt = new Date(Date.now() - 100 * HOUR);
    const pet = makePet({
      last_updated_at: lastUpdatedAt.toISOString(),
      hunger: 100,
      cleanliness: 100, // rate 100/30 per hour -> crosses 0 at 30h after last_updated_at
    });
    // cleanliness crossing = lastUpdatedAt + 30h = now - 70h; 70h since crossing > 24h
    expect(computeIsSick(pet, new Date())).toBe(true);
  });

  it('uses the earliest crossing among critical stats', () => {
    // hunger crosses 40h ago, cleanliness crosses 10h ago -> earliest is hunger's, 40h > 24h -> sick
    const now = new Date();
    const pet = makePet({
      last_updated_at: new Date(now.getTime() - 64 * HOUR).toISOString(), // 100/24 -> crosses at +24h => 40h ago
      hunger: 100,
      cleanliness: 14 + (10 * (100 / 30)), // crosses 0 exactly 10h before now given this last_updated_at
    });
    expect(computeIsSick(pet, now)).toBe(true);
  });
});

import { computeMood } from './pet-engine';

const fullStats = { hunger: 100, happiness: 100, energy: 100, cleanliness: 100 };

describe('computeMood', () => {
  it('is sleeping when isSleeping is true, regardless of other flags', () => {
    expect(computeMood(fullStats, true, true)).toBe('sleeping');
  });

  it('is sick when isSick is true and not sleeping', () => {
    expect(computeMood(fullStats, true, false)).toBe('sick');
  });

  it('is dirty when cleanliness is below 30, and not sick/sleeping', () => {
    expect(computeMood({ ...fullStats, cleanliness: 29 }, false, false)).toBe('dirty');
  });

  it('is sad when happiness is below 30, and not dirty/sick/sleeping', () => {
    expect(computeMood({ ...fullStats, happiness: 29 }, false, false)).toBe('sad');
  });

  it('is happy by default', () => {
    expect(computeMood(fullStats, false, false)).toBe('happy');
  });

  it('prioritizes sick over dirty when both apply', () => {
    expect(computeMood({ ...fullStats, cleanliness: 10 }, true, false)).toBe('sick');
  });
});

import { feed, bathe, toggleSleep } from './pet-engine';

describe('feed', () => {
  it('increases hunger by 30, clamped at 100', () => {
    expect(feed({ ...fullStats, hunger: 50 }).hunger).toBe(80);
    expect(feed({ ...fullStats, hunger: 90 }).hunger).toBe(100);
  });

  it('does not change other stats', () => {
    const result = feed({ ...fullStats, hunger: 50, happiness: 40 });
    expect(result.happiness).toBe(40);
  });
});

describe('bathe', () => {
  it('increases cleanliness by 40, clamped at 100', () => {
    expect(bathe({ ...fullStats, cleanliness: 50 }).cleanliness).toBe(90);
    expect(bathe({ ...fullStats, cleanliness: 80 }).cleanliness).toBe(100);
  });
});

describe('toggleSleep', () => {
  it('flips false to true', () => {
    expect(toggleSleep(false)).toBe(true);
  });

  it('flips true to false', () => {
    expect(toggleSleep(true)).toBe(false);
  });
});

import { play } from './pet-engine';

describe('play', () => {
  it('increases happiness by 15 and decreases energy by 5 when not sleeping', () => {
    const result = play({ ...fullStats, happiness: 50, energy: 50 }, false);
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.happiness).toBe(65);
      expect(result.energy).toBe(45);
    }
  });

  it('clamps happiness at 100 and energy at 0', () => {
    const result = play({ ...fullStats, happiness: 95, energy: 2 }, false);
    if (!('error' in result)) {
      expect(result.happiness).toBe(100);
      expect(result.energy).toBe(0);
    }
  });

  it('is rejected with no state change when sleeping', () => {
    const result = play(fullStats, true);
    expect(result).toEqual({ error: 'Cannot play while pet is sleeping' });
  });
});

import { medicine } from './pet-engine';

describe('medicine', () => {
  it('raises hunger and cleanliness to at least 50 when sick', () => {
    const result = medicine({ ...fullStats, hunger: 0, cleanliness: 0 }, true);
    expect(result).toEqual({ ...fullStats, hunger: 50, cleanliness: 50 });
  });

  it('does not lower hunger/cleanliness if already above 50', () => {
    const result = medicine({ ...fullStats, hunger: 80, cleanliness: 90 }, true);
    if (!('error' in result)) {
      expect(result.hunger).toBe(80);
      expect(result.cleanliness).toBe(90);
    }
  });

  it('is rejected with no state change when not sick', () => {
    const result = medicine({ ...fullStats, hunger: 0, cleanliness: 0 }, false);
    expect(result).toEqual({ error: 'Pet is not sick' });
  });
});
