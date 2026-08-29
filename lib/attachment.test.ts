import { describe, it, expect } from 'vitest';
import {
  getAvailableStreakReward,
  getPetVulnerability,
  getPetThought,
} from './attachment';
import type { PetRow, PetStats } from './pet-engine';

describe('getAvailableStreakReward', () => {
  it('returns null when streak is below the first milestone (3 days)', () => {
    expect(getAvailableStreakReward({ bond_streak_days: 0, last_streak_milestone_claimed: 0 })).toBeNull();
    expect(getAvailableStreakReward({ bond_streak_days: 2, last_streak_milestone_claimed: 0 })).toBeNull();
  });

  it('returns 3-day reward when streak is 3 and last claimed is 0', () => {
    const reward = getAvailableStreakReward({ bond_streak_days: 3, last_streak_milestone_claimed: 0 });
    expect(reward).not.toBeNull();
    expect(reward?.milestone).toBe(3);
    expect(reward?.coins).toBe(30);
    expect(reward?.diaryTitle).toContain('3 días');
  });

  it('returns null if 3-day reward is already claimed', () => {
    expect(getAvailableStreakReward({ bond_streak_days: 3, last_streak_milestone_claimed: 3 })).toBeNull();
    expect(getAvailableStreakReward({ bond_streak_days: 5, last_streak_milestone_claimed: 3 })).toBeNull();
  });

  it('advances through 7, 14, 30 and recurring milestones', () => {
    expect(getAvailableStreakReward({ bond_streak_days: 7, last_streak_milestone_claimed: 3 })?.milestone).toBe(7);
    expect(getAvailableStreakReward({ bond_streak_days: 14, last_streak_milestone_claimed: 7 })?.milestone).toBe(14);
    expect(getAvailableStreakReward({ bond_streak_days: 30, last_streak_milestone_claimed: 14 })?.milestone).toBe(30);
    expect(getAvailableStreakReward({ bond_streak_days: 60, last_streak_milestone_claimed: 30 })?.milestone).toBe(60);
  });
});

describe('getPetVulnerability', () => {
  const baseStats: PetStats = { hunger: 100, happiness: 100, energy: 100, cleanliness: 100 };

  it('identifies sickness as highest vulnerability', () => {
    const vuln = getPetVulnerability(baseStats, true, false, 'sick');
    expect(vuln).not.toBeNull();
    expect(vuln?.action).toBe('medicine');
    expect(vuln?.message).toContain('medicina');
  });

  it('identifies dirty pet when cleanliness < 30', () => {
    const vuln = getPetVulnerability({ ...baseStats, cleanliness: 25 }, false, false, 'dirty');
    expect(vuln?.action).toBe('bathe');
    expect(vuln?.message).toContain('baño');
  });

  it('identifies hunger when hunger < 30', () => {
    const vuln = getPetVulnerability({ ...baseStats, hunger: 20 }, false, false, 'happy');
    expect(vuln?.action).toBe('feed');
    expect(vuln?.message).toContain('hambre');
  });

  it('identifies tiredness when energy < 25 and not sleeping', () => {
    const vuln = getPetVulnerability({ ...baseStats, energy: 15 }, false, false, 'happy');
    expect(vuln?.action).toBe('sleep');
    expect(vuln?.message).toContain('sueñito');
  });

  it('identifies sadness when mood is sad', () => {
    const vuln = getPetVulnerability(baseStats, false, false, 'sad');
    expect(vuln?.action).toBe('play');
    expect(vuln?.message).toContain('Jugamos');
  });

  it('returns null when pet is healthy and happy', () => {
    expect(getPetVulnerability(baseStats, false, false, 'happy')).toBeNull();
  });
});

describe('getPetThought (Priorities & Anti-Guilt)', () => {
  const mockPet = {
    bond_score: 80,
    bond_streak_days: 7,
    last_streak_milestone_claimed: 3,
    is_sleeping: false,
  } as PetRow;

  const baseStats: PetStats = { hunger: 100, happiness: 100, energy: 100, cleanliness: 100 };

  it('prioritizes gift over vulnerability and spontaneous thoughts', () => {
    const thought = getPetThought(mockPet, { ...baseStats, hunger: 10 }, false, 'happy');
    expect(thought.type).toBe('gift');
    expect(thought.reward?.milestone).toBe(7);
  });

  it('prioritizes vulnerability when no gift is pending', () => {
    const claimedPet = { ...mockPet, last_streak_milestone_claimed: 7 };
    const thought = getPetThought(claimedPet, { ...baseStats, hunger: 10 }, false, 'happy');
    expect(thought.type).toBe('vulnerability');
    expect(thought.action).toBe('feed');
  });

  it('returns spontaneous thought by tier when healthy and no gift pending', () => {
    const claimedPet = { ...mockPet, last_streak_milestone_claimed: 7, bond_score: 80 };
    const thought = getPetThought(claimedPet, baseStats, false, 'happy');
    expect(thought.type).toBe('initiative');
    expect(thought.message.length).toBeGreaterThan(0);
  });
});
