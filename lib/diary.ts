import {
  computeCurrentStats,
  computeIsSick,
  computeMood,
  LIFE_STAGE_DAYS,
  type MoodState,
  type PetRow,
  type SpriteState,
} from './pet-engine';

export type DiaryEntryType = 'got_sick' | 'recovered' | 'note';

export interface DiaryEntry {
  id: string;
  pet_id: string;
  user_id: string;
  entry_type: DiaryEntryType;
  occurred_at: string;
  mood_snapshot: SpriteState;
  text: string | null;
  created_at: string;
}

export type VirtualEntryType = 'hatched' | 'grew_up';

export interface VirtualDiaryEntry {
  entry_type: VirtualEntryType;
  occurred_at: string;
}

export type TimelineEntry =
  | { kind: 'real'; entry: DiaryEntry }
  | { kind: 'virtual'; entry: VirtualDiaryEntry };

export interface NewDiaryEvent {
  entry_type: 'got_sick' | 'recovered';
  mood_snapshot: MoodState;
  occurred_at: string;
}

export function computeVirtualMilestones(pet: PetRow, now: Date): VirtualDiaryEntry[] {
  const createdAt = new Date(pet.created_at);
  const hatchedAt = new Date(createdAt.getTime() + LIFE_STAGE_DAYS.egg * 24 * 60 * 60 * 1000);
  const grewUpAt = new Date(createdAt.getTime() + LIFE_STAGE_DAYS.baby * 24 * 60 * 60 * 1000);

  const milestones: VirtualDiaryEntry[] = [];
  if (hatchedAt.getTime() <= now.getTime()) {
    milestones.push({ entry_type: 'hatched', occurred_at: hatchedAt.toISOString() });
  }
  if (grewUpAt.getTime() <= now.getTime()) {
    milestones.push({ entry_type: 'grew_up', occurred_at: grewUpAt.toISOString() });
  }
  return milestones;
}

function mostRecentSicknessEntry(entries: DiaryEntry[]): DiaryEntry | null {
  const relevant = entries.filter((e) => e.entry_type === 'got_sick' || e.entry_type === 'recovered');
  if (relevant.length === 0) return null;
  return relevant.reduce((latest, entry) =>
    new Date(entry.occurred_at).getTime() > new Date(latest.occurred_at).getTime() ? entry : latest
  );
}

export function determineNewDiaryEvents(pet: PetRow, now: Date, existingEntries: DiaryEntry[]): NewDiaryEvent[] {
  const isSick = computeIsSick(pet, now);
  const stats = computeCurrentStats(pet, now);
  const mood = computeMood(stats, isSick, pet.is_sleeping);
  const mostRecent = mostRecentSicknessEntry(existingEntries);
  const hasOpenSicknessEpisode = mostRecent !== null && mostRecent.entry_type === 'got_sick';

  if (isSick && !hasOpenSicknessEpisode) {
    return [{ entry_type: 'got_sick', mood_snapshot: mood, occurred_at: now.toISOString() }];
  }

  if (!isSick && hasOpenSicknessEpisode) {
    return [{ entry_type: 'recovered', mood_snapshot: mood, occurred_at: now.toISOString() }];
  }

  return [];
}

export function mergeDiaryTimeline(realEntries: DiaryEntry[], virtualEntries: VirtualDiaryEntry[]): TimelineEntry[] {
  const merged: TimelineEntry[] = [
    ...realEntries.map((entry) => ({ kind: 'real' as const, entry })),
    ...virtualEntries.map((entry) => ({ kind: 'virtual' as const, entry })),
  ];
  return merged.sort((a, b) => new Date(b.entry.occurred_at).getTime() - new Date(a.entry.occurred_at).getTime());
}
