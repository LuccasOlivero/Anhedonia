# Pet Diary / Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution root:** all file paths below are relative to the git worktree root `C:\Users\luccas\Desktop\claude-proyects\pets-forever\.claude\worktrees\tamagotchi-implementation` (branch `worktree-tamagotchi-implementation`). Run every command from that directory.

## Context

The app's north star is shifting from missions/rewards toward emotional attachment between the user and their virtual pet, grounded in attachment-theory and companion-AI research pointing to memory persistence, personalization, and reciprocity as the core long-term-retention drivers. This diary/memory feature is the first attachment-building feature: a timeline mixing auto-detected milestones (hatching, growing up, getting sick, recovering) with user-authored notes.

The guiding principle carried over from the existing codebase (`computeLifeStage`, `computeIsSick` in `lib/pet-engine.ts` — no `is_sick`/`life_stage` columns) is: minimize new persisted state. Only genuinely episodic, non-reconstructible events (`got_sick`, `recovered`, `note`) become real DB rows; the two life-stage milestones (`hatched`, `grew_up`) stay virtual/computed.

The base Tamagotchi app (`docs/superpowers/plans/2026-08-21-tamagotchi-clone-implementation.md`) is already implemented in this worktree (Tasks 1-11 complete, committed). This plan only adds the diary feature on top of it.

**Goal:** Add a `/pet/diary` timeline page where a user can see auto-detected relationship milestones for their pet and add their own short notes, backed by one new minimal-state Supabase table.

**Architecture:** Same layering as the rest of the app — a pure, dependency-free logic module (`lib/diary.ts`, mirroring `lib/pet-engine.ts`) computes virtual milestones and decides when new episodic events should be recorded; a thin I/O module (`lib/diary-sync.ts`) does the actual Supabase read/insert for that background sync and is called from the diary page's Server Component render; a single new Server Action (`addDiaryNote`) is the only client-triggered write path.

**Tech Stack:** Next.js 15.5.23 (App Router, TypeScript), Supabase (Postgres + Auth via `@supabase/ssr` ^0.12.4 / `@supabase/supabase-js` ^2.112.3), Vitest ^4.1.11, npm. No local Supabase CLI/Docker — Supabase is a real cloud project.

**Spec:** `docs/superpowers/specs/2026-08-23-pet-diary-design.md`

## Global Constraints

- No new derived-state columns. Only `got_sick`, `recovered`, and `note` become real `diary_entries` rows. `hatched` and `grew_up` are always computed on the fly from `pet.created_at` + `LIFE_STAGE_DAYS` (`lib/pet-engine.ts`) — never stored.
- `lib/diary.ts` stays pure: no I/O, no `Date.now()`/`new Date()` calls without an injected `now: Date` parameter — mirrors every function signature in `lib/pet-engine.ts` (e.g. `computeCurrentStats(pet, now)`).
- All Supabase I/O (the new table, RLS policy, inserts, selects) is verified manually in the browser against the real cloud Supabase project — this app has no local Supabase CLI/Docker. No automated tests touch Postgres.
- Server Actions never throw; they return `{ error: string | null }` and Server Actions/internal sync functions swallow Supabase errors, logging via `console.error` where appropriate (matches `app/pet/actions.ts` convention).
- The diary route is nested at `/pet/diary` (no path param — one pet per account, same as `/pet` itself), following the same auth/onboarding redirect guard as `app/pet/page.tsx`.
- Visual design must reuse the existing design system verbatim: signboard card class (`rounded-[2rem] border-8 border-[#6B4226] ring-4 ring-inset ring-[#C89B6C] bg-[#FFF9EC] p-6 shadow-[inset_0_3px_6px_rgba(0,0,0,0.15),0_10px_20px_rgba(0,0,0,0.25)]`), `font-[family-name:var(--font-display)]` for headings/buttons, candy-gradient buttons with the `active:translate-y-[3px]` press effect.
- Package manager: npm. Tests: `npx vitest run` / `npm run test`.

**Ambiguous points from the spec, resolved here (noted inline in the relevant task too):**
- `syncDiaryEvents` lives in a new `lib/diary-sync.ts` (not `lib/diary.ts`), so `lib/diary.ts` stays 100% pure and I/O-free, consistent with `lib/pet-engine.ts`.
- Server Actions file is `app/pet/diary/actions.ts` (co-located with the nested `/pet/diary` route, matching how `app/pet/actions.ts` sits next to `app/pet/page.tsx`).
- `app/pet/diary/actions.ts`'s `loadPet()` helper is duplicated from `app/pet/actions.ts` rather than extracted into a shared module — this matches the existing codebase's own convention (that helper isn't currently shared/exported anywhere either).
- The four auto-generated milestone labels use the exact Spanish copy from the spec (they're mandated strings); the rest of the new UI chrome (nav link, form labels, button text) stays in English to match every other page in the app (`OnboardingForm`, `ActionButtons`, `StatBar` are all English).
- `AddNoteForm` adds one small, justified deviation from `OnboardingForm`'s exact pattern: since it does **not** redirect on success (unlike `createPet`), it needs an explicit success signal to reset the uncontrolled `<textarea>`. `addDiaryNote` returns `{ error: null }` on success (vs. `{ error: '' }` as the initial state) and a `useEffect` watching that distinction calls `formRef.current?.reset()`.

---

### Task 1: Schema — `diary_entries` table + RLS policy

**Files:**
- Modify: `supabase/schema.sql` (append only)

**Interfaces:**
- Consumes: nothing.
- Produces: the `diary_entries` table in the real Supabase project, consumed by `lib/diary-sync.ts` and `app/pet/diary/actions.ts` (Tasks 3-4).

- [ ] **Step 1: Append the new table + policy to `supabase/schema.sql`**

Append to the end of `supabase/schema.sql` (do not touch the existing `pets` table content above it):

```sql

-- --- Diary: episodic events + user notes (added 2026-08-23) ---
-- The `pets` table above is already live in the Supabase project.
-- Run ONLY the block below (SQL Editor > New query > Run) — do not re-run the whole file.
-- `create table if not exists` makes it safe to run even if already applied.

create table if not exists diary_entries (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references pets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null check (entry_type in ('got_sick', 'recovered', 'note')),
  occurred_at timestamptz not null default now(),
  mood_snapshot text not null,
  text text,
  created_at timestamptz not null default now()
);

alter table diary_entries enable row level security;

create policy "Users manage their own diary entries"
  on diary_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 2: Manually run only the new SQL against the real Supabase project**

Open the Supabase Dashboard for this project → SQL Editor → New query → paste **only** the new block from Step 1 (from `-- --- Diary:` down to the closing `with check` line) → Run.

Expected: "Success. No rows returned." Then check Table Editor: a `diary_entries` table now exists with columns `id, pet_id, user_id, entry_type, occurred_at, mood_snapshot, text, created_at`. Under Table Editor → `diary_entries` → RLS Policies, confirm the "Users manage their own diary entries" policy is listed and RLS is enabled.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add diary_entries table and RLS policy to schema"
```

---

### Task 2: `lib/diary.ts` — pure diary logic (TDD)

**Files:**
- Create: `lib/diary.ts`
- Test: `lib/diary.test.ts`

**Interfaces:**
- Consumes: `computeCurrentStats`, `computeIsSick`, `computeMood`, `LIFE_STAGE_DAYS`, `type PetRow`, `type MoodState`, `type SpriteState` from `./pet-engine` (already implemented).
- Produces: `DiaryEntry`, `VirtualDiaryEntry`, `TimelineEntry`, `NewDiaryEvent` types; `computeVirtualMilestones(pet, now)`, `determineNewDiaryEvents(pet, now, existingEntries)`, `mergeDiaryTimeline(realEntries, virtualEntries)` functions — consumed by `lib/diary-sync.ts` (Task 3) and `app/pet/diary/page.tsx` (Task 4).

- [ ] **Step 1: Write failing tests for `computeVirtualMilestones`**

Create `lib/diary.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { computeVirtualMilestones, type DiaryEntry } from './diary';
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
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run lib/diary.test.ts`
Expected: FAIL — `./diary` module not found.

- [ ] **Step 3: Implement types + `computeVirtualMilestones`**

Create `lib/diary.ts`:
```typescript
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
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run lib/diary.test.ts`
Expected: all 4 `computeVirtualMilestones` tests PASS.

- [ ] **Step 5: Append failing tests for `determineNewDiaryEvents`**

Append to `lib/diary.test.ts`:
```typescript
import { determineNewDiaryEvents } from './diary';

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
```

- [ ] **Step 6: Run tests, verify the new suite fails**

Run: `npx vitest run lib/diary.test.ts`
Expected: `computeVirtualMilestones` tests still PASS; `determineNewDiaryEvents` tests FAIL — not exported.

- [ ] **Step 7: Implement `determineNewDiaryEvents`**

Append to `lib/diary.ts`:
```typescript
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
```

- [ ] **Step 8: Run tests, verify all pass**

Run: `npx vitest run lib/diary.test.ts`
Expected: all tests PASS.

- [ ] **Step 9: Append failing tests for `mergeDiaryTimeline`**

Append to `lib/diary.test.ts`:
```typescript
import { mergeDiaryTimeline } from './diary';

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
```

- [ ] **Step 10: Run tests, verify the new suite fails**

Run: `npx vitest run lib/diary.test.ts`
Expected: `mergeDiaryTimeline` is not exported — FAIL.

- [ ] **Step 11: Implement `mergeDiaryTimeline`**

Append to `lib/diary.ts`:
```typescript
export function mergeDiaryTimeline(realEntries: DiaryEntry[], virtualEntries: VirtualDiaryEntry[]): TimelineEntry[] {
  const merged: TimelineEntry[] = [
    ...realEntries.map((entry) => ({ kind: 'real' as const, entry })),
    ...virtualEntries.map((entry) => ({ kind: 'virtual' as const, entry })),
  ];
  return merged.sort((a, b) => new Date(b.entry.occurred_at).getTime() - new Date(a.entry.occurred_at).getTime());
}
```

- [ ] **Step 12: Run the full diary suite, verify all pass**

Run: `npx vitest run lib/diary.test.ts`
Expected: all tests PASS (13 tests total: 4 `computeVirtualMilestones` + 7 `determineNewDiaryEvents` + 2 `mergeDiaryTimeline`).

- [ ] **Step 13: Run the whole repo's test suite as a sanity check**

Run: `npm run test`
Expected: every suite passes, including the pre-existing `lib/pet-engine.test.ts`, `lib/gemini-client.test.ts`, `lib/onboarding-orchestration.test.ts`, `lib/validate-photo-files.test.ts`, and the new `lib/diary.test.ts`.

- [ ] **Step 14: Commit**

```bash
git add lib/diary.ts lib/diary.test.ts
git commit -m "feat: add pure diary logic for virtual milestones and sickness events"
```

---

### Task 3: Server Actions — diary sync + add note

**Files:**
- Create: `lib/diary-sync.ts`
- Create: `app/pet/diary/actions.ts`

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/server`; `determineNewDiaryEvents`, `type DiaryEntry` from `@/lib/diary` (Task 2); `computeCurrentStats`, `computeIsSick`, `computeMood`, `type PetRow` from `@/lib/pet-engine`.
- Produces: `syncDiaryEvents(pet: PetRow): Promise<void>` (internal, no `'use server'` — called only from the Server Component in Task 4, never throws); `addDiaryNote(prevState: { error: string | null }, formData: FormData): Promise<{ error: string | null }>` exported Server Action, consumed by `AddNoteForm.tsx` (Task 4).

- [ ] **Step 1: Implement the internal diary-sync function**

Create `lib/diary-sync.ts`:
```typescript
import { createClient } from './supabase/server';
import { determineNewDiaryEvents, type DiaryEntry } from './diary';
import type { PetRow } from './pet-engine';

// Soft background sync: inserts any newly-detected got_sick/recovered events
// for this pet. Never throws — a failure here must not break page render.
export async function syncDiaryEvents(pet: PetRow): Promise<void> {
  try {
    const supabase = await createClient();

    const { data: existingEntries, error: fetchError } = await supabase
      .from('diary_entries')
      .select('*')
      .eq('pet_id', pet.id);

    if (fetchError) {
      console.error('syncDiaryEvents: failed to load existing entries', fetchError);
      return;
    }

    const now = new Date();
    const newEvents = determineNewDiaryEvents(pet, now, (existingEntries ?? []) as DiaryEntry[]);
    if (newEvents.length === 0) return;

    const { error: insertError } = await supabase.from('diary_entries').insert(
      newEvents.map((event) => ({
        pet_id: pet.id,
        user_id: pet.user_id,
        entry_type: event.entry_type,
        occurred_at: event.occurred_at,
        mood_snapshot: event.mood_snapshot,
      }))
    );

    if (insertError) {
      console.error('syncDiaryEvents: failed to insert new diary events', insertError);
    }
  } catch (err) {
    console.error('syncDiaryEvents: unexpected error syncing diary events', err);
  }
}
```

- [ ] **Step 2: Implement `addDiaryNote` Server Action**

Create `app/pet/diary/actions.ts`:
```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { computeCurrentStats, computeIsSick, computeMood, type PetRow } from '@/lib/pet-engine';

const MAX_NOTE_LENGTH = 280;

async function loadPet(): Promise<{ error: string } | { pet: PetRow }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not logged in.' };

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) return { error: 'No pet found.' };
  return { pet: pet as PetRow };
}

export async function addDiaryNote(_prevState: { error: string | null }, formData: FormData) {
  const rawText = formData.get('text');
  const text = typeof rawText === 'string' ? rawText.trim() : '';

  if (!text) {
    return { error: 'Please write something before saving.' };
  }
  if (text.length > MAX_NOTE_LENGTH) {
    return { error: `Notes must be ${MAX_NOTE_LENGTH} characters or fewer.` };
  }

  const loaded = await loadPet();
  if ('error' in loaded) return loaded;

  const supabase = await createClient();
  const now = new Date();
  const stats = computeCurrentStats(loaded.pet, now);
  const isSick = computeIsSick(loaded.pet, now);
  const moodSnapshot = computeMood(stats, isSick, loaded.pet.is_sleeping);

  const { error } = await supabase.from('diary_entries').insert({
    pet_id: loaded.pet.id,
    user_id: loaded.pet.user_id,
    entry_type: 'note',
    occurred_at: now.toISOString(),
    mood_snapshot: moodSnapshot,
    text,
  });

  if (error) return { error: error.message };

  revalidatePath('/pet/diary');
  return { error: null };
}
```

- [ ] **Step 3: Verify the project still type-checks and builds**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors (these files aren't wired into any route yet, but Next still type-checks every file under `app/` and `lib/`).

- [ ] **Step 4: Commit**

```bash
git add lib/diary-sync.ts app/pet/diary/actions.ts
git commit -m "feat: add diary event sync and addDiaryNote server action"
```

---

### Task 4: UI — `/pet/diary` page, `AddNoteForm`, and dashboard link

**Files:**
- Create: `app/pet/diary/AddNoteForm.tsx`
- Create: `app/pet/diary/page.tsx`
- Modify: `app/pet/page.tsx` (add a link to `/pet/diary`)

**Interfaces:**
- Consumes: `addDiaryNote` (Task 3); `syncDiaryEvents` (Task 3); `computeVirtualMilestones`, `mergeDiaryTimeline`, `type DiaryEntry`, `type VirtualDiaryEntry` (Task 2); `createClient()`; `type PetRow`.
- Produces: the `/pet/diary` route; `AddNoteForm` client component; a "📔 Diario" link on `/pet`.

- [ ] **Step 1: Build the note-composer client component**

Create `app/pet/diary/AddNoteForm.tsx`:
```tsx
'use client';

import { useActionState, useEffect, useRef } from 'react';
import { addDiaryNote } from './actions';

// addDiaryNote returns { error: '' } as the untouched initial shape, { error: 'message' }
// on validation/Supabase failure, and { error: null } on success. Unlike OnboardingForm's
// createPet (which redirects away on success), this form stays on the page, so we watch
// for the `error === null` success signal to reset the uncontrolled textarea.
const initialState: { error: string | null } = { error: '' };

const labelClass = 'text-sm font-semibold text-[#8B5E3C]';
const textareaClass =
  'w-full rounded-2xl border-2 border-[#C89B6C] bg-white px-4 py-2 text-[#4A3222] focus:border-[#FF6FA5] focus:outline-none';

export function AddNoteForm() {
  const [state, formAction, pending] = useActionState(addDiaryNote, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.error === null) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <label className="block space-y-1">
        <span className={labelClass}>Add a memory</span>
        <textarea
          name="text"
          required
          maxLength={280}
          rows={3}
          placeholder="Write something you want to remember..."
          className={textareaClass}
        />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm font-semibold text-[#F4436C]">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-gradient-to-b from-[#FF9EC4] to-[#FF6FA5] py-2 font-[family-name:var(--font-display)] font-bold text-white shadow-[0_4px_0_rgba(0,0,0,0.25)] transition-all active:translate-y-[3px] active:shadow-[0_1px_0_rgba(0,0,0,0.25)] disabled:opacity-50"
      >
        {pending ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Build the diary Server Component page**

Create `app/pet/diary/page.tsx`:
```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { syncDiaryEvents } from '@/lib/diary-sync';
import { computeVirtualMilestones, mergeDiaryTimeline, type DiaryEntry, type VirtualDiaryEntry } from '@/lib/diary';
import type { PetRow } from '@/lib/pet-engine';
import { AddNoteForm } from './AddNoteForm';

const cardClass =
  'rounded-[2rem] border-8 border-[#6B4226] ring-4 ring-inset ring-[#C89B6C] bg-[#FFF9EC] p-6 shadow-[inset_0_3px_6px_rgba(0,0,0,0.15),0_10px_20px_rgba(0,0,0,0.25)]';

type AnyEntry = DiaryEntry | VirtualDiaryEntry;

// These labels are the exact copy from the diary spec — interpolated at render
// time so auto-events never need to store their own text.
function labelFor(petName: string, entry: AnyEntry): string {
  switch (entry.entry_type) {
    case 'hatched':
      return `${petName} salió del huevo 🐣`;
    case 'grew_up':
      return `${petName} creció y ya es adulto 🌟`;
    case 'got_sick':
      return `${petName} se enfermó 🤒`;
    case 'recovered':
      return `${petName} se recuperó 💊✨`;
    case 'note':
      return `A memory about ${petName} 📝`;
  }
}

function imageFor(petRow: PetRow, entry: AnyEntry): string {
  if (entry.entry_type === 'hatched') return '/egg-sprite.svg';
  if (entry.entry_type === 'grew_up') return petRow.sprites.happy;
  return petRow.sprites[entry.mood_snapshot];
}

export default async function DiaryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) redirect('/onboarding');

  const petRow = pet as PetRow;

  // Runs before reading entries so any newly-detected got_sick/recovered event
  // shows up in this same render.
  await syncDiaryEvents(petRow);

  const { data: entries } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('pet_id', petRow.id)
    .order('occurred_at', { ascending: false });

  const realEntries = (entries ?? []) as DiaryEntry[];
  const virtualEntries = computeVirtualMilestones(petRow, new Date());
  const timeline = mergeDiaryTimeline(realEntries, virtualEntries);

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-gradient-to-b from-[#BEE7F5] to-[#B7E4A0] px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/pet" className="text-sm font-semibold text-[#4A3222] underline">
            ← Back
          </Link>
          <h1 className="text-xl font-[family-name:var(--font-display)] font-bold text-[#4A3222]">
            {petRow.name}&apos;s Diary
          </h1>
        </div>

        <div className={cardClass}>
          <AddNoteForm />
        </div>

        <div className="space-y-3">
          {timeline.length === 0 && (
            <p className="text-center text-sm font-semibold text-[#8B5E3C]">
              No memories yet. Check back soon!
            </p>
          )}
          {timeline.map((item) => (
            <div
              key={`${item.kind}-${item.entry.entry_type}-${item.entry.occurred_at}`}
              className={`flex gap-3 ${cardClass}`}
            >
              <img
                src={imageFor(petRow, item.entry)}
                alt=""
                className="h-14 w-14 shrink-0 rounded-2xl border-2 border-[#C89B6C] object-cover"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-[family-name:var(--font-display)] font-bold text-[#4A3222]">
                  {labelFor(petRow.name, item.entry)}
                </p>
                <p className="text-xs font-semibold text-[#8B5E3C]">
                  {new Date(item.entry.occurred_at).toLocaleString()}
                </p>
                {item.kind === 'real' && item.entry.entry_type === 'note' && item.entry.text && (
                  <p className="text-sm text-[#4A3222]">{item.entry.text}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Add a link to the diary from the pet dashboard**

In `app/pet/page.tsx`, add the `Link` import:
```tsx
import Link from 'next/link';
```

Replace the `<h1>` line:
```tsx
        <h1 className="text-center text-2xl font-[family-name:var(--font-display)] font-bold text-[#4A3222]">{petRow.name}</h1>
```

with:
```tsx
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-[family-name:var(--font-display)] font-bold text-[#4A3222]">{petRow.name}</h1>
          <Link
            href="/pet/diary"
            className="rounded-full bg-[#F0DEB4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20"
          >
            📔 Diario
          </Link>
        </div>
```

- [ ] **Step 4: Verify the project builds**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 5: Manual smoke verification**

Run: `npm run dev`. Log in as an existing test user with a pet. On `/pet`, confirm the "📔 Diario" pill appears next to the pet name and links to `/pet/diary`. Open `/pet/diary` and confirm: the page renders without error (either the empty-state message or milestone cards, depending on the pet's age); the "Add a memory" textarea + Save button render inside a signboard card at the top. Type a short note, click Save. Confirm: no error message, the textarea clears. Reload the page and confirm the note now appears as the newest card with the entered text, a timestamp, and the pet's current sprite as its image.

- [ ] **Step 6: Commit**

```bash
git add app/pet/diary app/pet/page.tsx
git commit -m "feat: add pet diary page, note composer, and dashboard link"
```

---

### Task 5: End-to-end manual verification against the real Supabase project

This app has no local Supabase CLI/Docker, so everything touching real Postgres/RLS is verified manually here rather than via automated tests, per the app's established testing approach. No code changes are expected in this task; if a check below surfaces a bug, fix it and commit that fix separately using the same `git add` + `git commit` convention as the tasks above.

- [ ] **Step 1: Run the full automated suite**

Run: `npm run test`
Expected: every Vitest suite passes, including `lib/diary.test.ts`'s 13 tests alongside the pre-existing `lib/pet-engine.test.ts`, `lib/gemini-client.test.ts`, `lib/onboarding-orchestration.test.ts`, and `lib/validate-photo-files.test.ts`.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: succeeds with no TypeScript/ESLint errors.

- [ ] **Step 3: Confirm the schema change is live** (repeats Task 1 Step 2 as a final sanity check)

In the Supabase Dashboard → Table Editor, confirm `diary_entries` exists with RLS enabled and the "Users manage their own diary entries" policy attached.

- [ ] **Step 4: Verify the diary page renders for a real logged-in user**

`npm run dev`, log in as the existing test user (or sign up + onboard a fresh one), open `/pet/diary`. Expected: no errors in the server or browser console; if the pet is old enough, `hatched`/`grew_up` cards appear with the correct Spanish label and the egg SVG / happy sprite respectively; otherwise the empty-state message shows.

- [ ] **Step 5: Verify adding a note persists and appears**

Submit a note via the textarea. Expected: no error, textarea clears. In Supabase Table Editor → `diary_entries`, confirm a new row exists with `entry_type = 'note'`, the correct `text`, and a `mood_snapshot` matching the pet's current mood.

- [ ] **Step 6: Trigger and verify a `got_sick` diary entry**

In Supabase Table Editor → `pets`, set `hunger` and `cleanliness` to `0` and backdate `last_updated_at` to more than 24 hours in the past (same technique used to test sickness on the base `/pet` dashboard). Reload `/pet/diary`. Expected: a new card appears at the top of the timeline reading `"{name} se enfermó 🤒"`, rendered with the pet's sick sprite. In Table Editor → `diary_entries`, confirm exactly one new row was inserted with `entry_type = 'got_sick'`.

- [ ] **Step 7: Trigger and verify the matching `recovered` diary entry**

On `/pet`, use the Medicine action (or manually raise `hunger`/`cleanliness` back above 0 and clear the backdating in Table Editor) to end the sickness. Reload `/pet/diary`. Expected: a new card appears above the `got_sick` one reading `"{name} se recuperó 💊✨"`. In Table Editor, confirm exactly one new `recovered` row was inserted (not a duplicate `got_sick`).

- [ ] **Step 8: Verify idempotency — no duplicate events on repeated reloads**

Reload `/pet/diary` again with no further state changes. Expected: the `diary_entries` row count is unchanged from Step 7 — no duplicate `got_sick`/`recovered` rows are inserted.

- [ ] **Step 9: Verify RLS isolation across accounts**

In a second browser (or incognito window), sign up as a different test user and onboard a second pet. Open `/pet/diary` for that account. Expected: only that account's own diary entries are visible — none of the first account's entries leak across.

---

## Self-Review

**Spec coverage:** every section of `docs/superpowers/specs/2026-08-23-pet-diary-design.md` maps to a task — Data Model → Task 1, Detection Logic → Task 2 (`determineNewDiaryEvents`) + Task 3 (`syncDiaryEvents`'s lazy call site), the "never stored" virtual milestones → Task 2 (`computeVirtualMilestones`), UI → Task 4, the "fails silently" sync requirement → Task 3's try/catch + Task 5 Step 8's idempotency check.

**Placeholder scan:** no TBDs; every step has complete, runnable code or an explicit manual-verification procedure.

**Type consistency:** `DiaryEntry`, `VirtualDiaryEntry`, `NewDiaryEvent`, `TimelineEntry` are defined once in Task 2 and used with identical shapes in Tasks 3-4 (`lib/diary-sync.ts` imports `DiaryEntry`; `app/pet/diary/page.tsx` imports `DiaryEntry`, `VirtualDiaryEntry`, `computeVirtualMilestones`, `mergeDiaryTimeline` — all matching the names/signatures Task 2 exports).

## Critical Files for Implementation

- `lib/pet-engine.ts` (read-only reference — not modified by this plan)
- `lib/diary.ts`
- `lib/diary-sync.ts`
- `app/pet/diary/actions.ts`
- `app/pet/diary/page.tsx`
- `supabase/schema.sql`
