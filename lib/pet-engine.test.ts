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
  it('is egg for 0 elapsed days', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    expect(computeLifeStage(createdAt, createdAt)).toBe('egg');
  });

  it('is egg just under the egg boundary', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date(createdAt.getTime() + (LIFE_STAGE_DAYS.egg * DAY - HOUR));
    expect(computeLifeStage(createdAt, now)).toBe('egg');
  });

  it('is baby exactly at the egg boundary', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date(createdAt.getTime() + LIFE_STAGE_DAYS.egg * DAY);
    expect(computeLifeStage(createdAt, now)).toBe('baby');
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

  it('does not decay stats before the egg has hatched', () => {
    const createdAt = new Date(Date.now() - 1 * DAY); // still egg: elapsed 1 day < 2
    const pet = makePet({
      created_at: createdAt.toISOString(),
      last_updated_at: createdAt.toISOString(),
      hunger: 100,
    });
    const stats = computeCurrentStats(pet, new Date());
    expect(stats.hunger).toBe(100);
  });

  it('starts decay at hatch time, not at last_updated_at, when last_updated_at predates hatching', () => {
    const createdAt = new Date(Date.now() - 3 * DAY); // hatched 1 day ago (egg = 2 days)
    const pet = makePet({
      created_at: createdAt.toISOString(),
      last_updated_at: createdAt.toISOString(), // 3 days ago, before hatch
      hunger: 100,
    });
    // hatch was 1 day (24h) ago; hunger decays 100/24 per hour -> fully decayed to 0
    const stats = computeCurrentStats(pet, new Date());
    expect(stats.hunger).toBe(0);
  });
});
