import { describe, it, expect } from 'vitest';
import { computeVirtualMilestones, determineNewDiaryEvents, mergeDiaryTimeline, type DiaryEntry } from './diary';
import { LIFE_STAGE_DAYS, type PetRow } from './pet-engine';

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

function makeDiaryEntry(overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    id: 'entry-1',
    pet_id: 'pet-1',
    user_id: 'user-1',
    entry_type: 'note',
    occurred_at: new Date().toISOString(),
    mood_snapshot: 'happy',
    text: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('computeVirtualMilestones', () => {
  it('returns no milestones while still an egg', () => {
    const pet = makePet({ created_at: new Date().toISOString() });
    expect(computeVirtualMilestones(pet, new Date())).toEqual([]);
  });

  it('returns only "hatched" after the egg boundary but before the baby boundary', () => {
    const createdAt = new Date(Date.now() - (LIFE_STAGE_DAYS.egg * DAY + HOUR));
    const pet = makePet({ created_at: createdAt.toISOString() });
    const milestones = computeVirtualMilestones(pet, new Date());
    expect(milestones).toHaveLength(1);
    expect(milestones[0].entry_type).toBe('hatched');
  });

  it('returns "hatched" then "grew_up" once past the baby boundary', () => {
    const createdAt = new Date(Date.now() - (LIFE_STAGE_DAYS.baby * DAY + HOUR));
    const pet = makePet({ created_at: createdAt.toISOString() });
    const milestones = computeVirtualMilestones(pet, new Date());
    expect(milestones.map((m) => m.entry_type)).toEqual(['hatched', 'grew_up']);
  });

  it('sets "hatched" occurred_at to exactly created_at + LIFE_STAGE_DAYS.egg days', () => {
    const createdAt = new Date(Date.now() - (LIFE_STAGE_DAYS.baby * DAY + HOUR));
    const pet = makePet({ created_at: createdAt.toISOString() });
    const milestones = computeVirtualMilestones(pet, new Date());
    const hatched = milestones.find((m) => m.entry_type === 'hatched')!;
    expect(new Date(hatched.occurred_at).getTime()).toBe(createdAt.getTime() + LIFE_STAGE_DAYS.egg * DAY);
  });
});

function sickPet(overrides: Partial<PetRow> = {}): PetRow {
  // Matches the exact fixture pet-engine.test.ts uses to assert computeIsSick === true.
  return makePet({
    last_updated_at: new Date(Date.now() - 60 * HOUR).toISOString(),
    hunger: 100,
    cleanliness: 100,
    ...overrides,
  });
}

function healthyPet(overrides: Partial<PetRow> = {}): PetRow {
  return makePet({
    last_updated_at: new Date(Date.now() - 1 * HOUR).toISOString(),
    hunger: 100,
    cleanliness: 100,
    ...overrides,
  });
}

describe('determineNewDiaryEvents', () => {
  it('returns a got_sick event when newly sick with no prior sickness entries', () => {
    const events = determineNewDiaryEvents(sickPet(), new Date(), []);
    expect(events).toHaveLength(1);
    expect(events[0].entry_type).toBe('got_sick');
    expect(events[0].mood_snapshot).toBe('sick');
  });

  it('returns nothing when still sick and there is already an open got_sick entry', () => {
    const existing = [
      makeDiaryEntry({ entry_type: 'got_sick', occurred_at: new Date(Date.now() - 10 * HOUR).toISOString() }),
    ];
    expect(determineNewDiaryEvents(sickPet(), new Date(), existing)).toEqual([]);
  });

  it('returns a recovered event when no longer sick and there is an open got_sick entry', () => {
    const existing = [
      makeDiaryEntry({ entry_type: 'got_sick', occurred_at: new Date(Date.now() - 10 * HOUR).toISOString() }),
    ];
    const events = determineNewDiaryEvents(healthyPet(), new Date(), existing);
    expect(events).toHaveLength(1);
    expect(events[0].entry_type).toBe('recovered');
  });

  it('returns nothing when the pet has never been sick', () => {
    expect(determineNewDiaryEvents(healthyPet(), new Date(), [])).toEqual([]);
  });

  it('returns nothing when already recovered and still healthy', () => {
    const existing = [
      makeDiaryEntry({ entry_type: 'got_sick', occurred_at: new Date(Date.now() - 20 * HOUR).toISOString() }),
      makeDiaryEntry({ entry_type: 'recovered', occurred_at: new Date(Date.now() - 5 * HOUR).toISOString() }),
    ];
    expect(determineNewDiaryEvents(healthyPet(), new Date(), existing)).toEqual([]);
  });

  it('returns a new got_sick event for a second sickness episode after a prior recovery', () => {
    const existing = [
      makeDiaryEntry({ entry_type: 'got_sick', occurred_at: new Date(Date.now() - 40 * HOUR).toISOString() }),
      makeDiaryEntry({ entry_type: 'recovered', occurred_at: new Date(Date.now() - 30 * HOUR).toISOString() }),
    ];
    const events = determineNewDiaryEvents(sickPet(), new Date(), existing);
    expect(events).toHaveLength(1);
    expect(events[0].entry_type).toBe('got_sick');
  });

  it('ignores note entries when finding the most recent sickness entry', () => {
    const existing = [
      makeDiaryEntry({ entry_type: 'got_sick', occurred_at: new Date(Date.now() - 20 * HOUR).toISOString() }),
      makeDiaryEntry({ entry_type: 'note', occurred_at: new Date(Date.now() - 1 * HOUR).toISOString(), text: 'hi' }),
    ];
    expect(determineNewDiaryEvents(sickPet(), new Date(), existing)).toEqual([]);
  });
});

describe('mergeDiaryTimeline', () => {
  it('merges real and virtual entries sorted by occurred_at descending', () => {
    const real = [
      makeDiaryEntry({ id: 'a', entry_type: 'note', occurred_at: new Date(Date.now() - 1 * HOUR).toISOString() }),
      makeDiaryEntry({ id: 'b', entry_type: 'got_sick', occurred_at: new Date(Date.now() - 5 * HOUR).toISOString() }),
    ];
    const virtual = [
      { entry_type: 'hatched' as const, occurred_at: new Date(Date.now() - 3 * HOUR).toISOString() },
    ];
    const timeline = mergeDiaryTimeline(real, virtual);
    expect(timeline.map((t) => t.entry.entry_type)).toEqual(['note', 'hatched', 'got_sick']);
  });

  it('returns an empty array when there are no entries of either kind', () => {
    expect(mergeDiaryTimeline([], [])).toEqual([]);
  });
});
