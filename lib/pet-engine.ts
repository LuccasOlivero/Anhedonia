export type SpriteState = 'happy' | 'sad' | 'eating' | 'sleeping' | 'dirty' | 'sick';
export type LifeStage = 'egg' | 'baby' | 'adult';

export interface Stats {
  hunger: number;
  happiness: number;
  energy: number;
  cleanliness: number;
}

export interface PetRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  last_updated_at: string;
  hunger: number;
  happiness: number;
  energy: number;
  cleanliness: number;
  is_sleeping: boolean;
  sprites: Record<SpriteState, string>;
  coins: number;
  last_daily_bonus_at: string | null;
  bond_score: number;
  bond_streak_days: number;
  last_bond_sync_date: string | null;
}

export const DECAY_PER_HOUR = {
  hunger: 100 / 24,
  happiness: 100 / 48,
  energy: 100 / 16,
  cleanliness: 100 / 30,
} as const;

export const ENERGY_REGEN_PER_HOUR_SLEEPING = 100 / 8;
export const SICK_THRESHOLD_HOURS = 24;
// egg: 0 — the real "incubation" wait is the Gemini sprite generation during
// onboarding (a few seconds, already shown as its own loading state there);
// there is no additional post-creation egg period. A pet is 'baby' the
// instant it's created.
export const LIFE_STAGE_DAYS = { egg: 0, baby: 5 } as const;

export function clamp(n: number): number {
  return Math.min(100, Math.max(0, n));
}

export function computeLifeStage(createdAt: Date, now: Date): LifeStage {
  const elapsedDays = (now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000);
  if (elapsedDays < LIFE_STAGE_DAYS.egg) return 'egg';
  if (elapsedDays < LIFE_STAGE_DAYS.baby) return 'baby';
  return 'adult';
}

export function computeCurrentStats(pet: PetRow, now: Date): Stats {
  const createdAt = new Date(pet.created_at);
  const lastUpdatedAt = new Date(pet.last_updated_at);
  const hatchTime = new Date(createdAt.getTime() + LIFE_STAGE_DAYS.egg * 24 * 60 * 60 * 1000);
  const decayStart = lastUpdatedAt > hatchTime ? lastUpdatedAt : hatchTime;
  const elapsedHours = Math.max(0, (now.getTime() - decayStart.getTime()) / (60 * 60 * 1000));

  const energy = pet.is_sleeping
    ? clamp(pet.energy + elapsedHours * ENERGY_REGEN_PER_HOUR_SLEEPING)
    : clamp(pet.energy - elapsedHours * DECAY_PER_HOUR.energy);

  return {
    hunger: clamp(pet.hunger - elapsedHours * DECAY_PER_HOUR.hunger),
    happiness: clamp(pet.happiness - elapsedHours * DECAY_PER_HOUR.happiness),
    energy,
    cleanliness: clamp(pet.cleanliness - elapsedHours * DECAY_PER_HOUR.cleanliness),
  };
}

export function computeIsSick(pet: PetRow, now: Date): boolean {
  const createdAt = new Date(pet.created_at);
  if (computeLifeStage(createdAt, now) === 'egg') return false;

  const lastUpdatedAt = new Date(pet.last_updated_at);
  const hatchTime = new Date(createdAt.getTime() + LIFE_STAGE_DAYS.egg * 24 * 60 * 60 * 1000);
  const decayStart = lastUpdatedAt > hatchTime ? lastUpdatedAt : hatchTime;

  const currentStats = computeCurrentStats(pet, now);
  const criticalStats: Array<{ storedValue: number; ratePerHour: number; currentValue: number }> = [
    { storedValue: pet.hunger, ratePerHour: DECAY_PER_HOUR.hunger, currentValue: currentStats.hunger },
    { storedValue: pet.cleanliness, ratePerHour: DECAY_PER_HOUR.cleanliness, currentValue: currentStats.cleanliness },
  ];

  let earliestCrossing: Date | null = null;

  for (const stat of criticalStats) {
    if (stat.currentValue > 0) continue; // hasn't crossed zero yet
    const hoursToZero = stat.storedValue / stat.ratePerHour;
    const crossingTime = new Date(decayStart.getTime() + hoursToZero * 60 * 60 * 1000);
    if (earliestCrossing === null || crossingTime < earliestCrossing) {
      earliestCrossing = crossingTime;
    }
  }

  if (earliestCrossing === null) return false;

  const hoursSinceCrossing = (now.getTime() - earliestCrossing.getTime()) / (60 * 60 * 1000);
  return hoursSinceCrossing > SICK_THRESHOLD_HOURS;
}

export type MoodState = Exclude<SpriteState, 'eating'>;

export function computeMood(stats: Stats, isSick: boolean, isSleeping: boolean): MoodState {
  if (isSleeping) return 'sleeping';
  if (isSick) return 'sick';
  if (stats.cleanliness < 30) return 'dirty';
  if (stats.happiness < 30) return 'sad';
  return 'happy';
}

export function feed(stats: Stats): Stats {
  return { ...stats, hunger: clamp(stats.hunger + 30) };
}

export function bathe(stats: Stats): Stats {
  return { ...stats, cleanliness: clamp(stats.cleanliness + 40) };
}

export function toggleSleep(isSleeping: boolean): boolean {
  return !isSleeping;
}

export function play(stats: Stats, isSleeping: boolean): Stats | { error: string } {
  if (isSleeping) return { error: 'Cannot play while pet is sleeping' };
  return {
    ...stats,
    happiness: clamp(stats.happiness + 15),
    energy: clamp(stats.energy - 5),
  };
}

export function medicine(stats: Stats, isSick: boolean): Stats | { error: string } {
  if (!isSick) return { error: 'Pet is not sick' };
  return {
    ...stats,
    hunger: Math.max(stats.hunger, 50),
    cleanliness: Math.max(stats.cleanliness, 50),
  };
}
