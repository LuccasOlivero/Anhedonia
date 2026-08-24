# Currency & Missions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution root:** all file paths below are relative to the repository root (`C:\Users\luccas\Desktop\claude-proyects\pets-forever`, or the equivalent git worktree root if this plan is executed inside one created via `superpowers:using-git-worktrees`). Run every command from that directory.

## Context

This is the second of three specced features in the app's attachment-first pivot: Pet Diary (already implemented and merged — `docs/superpowers/plans/2026-08-23-pet-diary-implementation.md`), Currency & Missions (this plan), and Casa/Tienda (room decorating + shop, specced separately, not yet planned — deliberately deferred until this plan lands, since both spend the currency this plan introduces).

The design was fully brainstormed and approved with the user ahead of this plan (`docs/superpowers/specs/2026-08-23-currency-missions-design.md`). Implementation-level decisions the spec itself left open (exact coin amounts, the visible-missions-checklist UI choice, the ISO week algorithm, the `mission_events` conditionality rule) were already made in a prior conversation and are treated as **fixed requirements** below, not open design questions — this plan only turns them into code.

The guiding principle carried over from `lib/pet-engine.ts` and `lib/diary.ts` continues here: minimize new persisted state, derive everything possible at read time. `mission_events` is the only genuinely episodic signal that must be logged (a raw, append-only record of care actions relevant to missions); `mission_completions` exists purely as an idempotency ledger (so a mission's reward is never paid twice for the same period); mission definitions, period keys, progress counts, and completion status are always computed fresh from those two tables plus a fixed `MISSIONS` catalog in code — never cached or duplicated into other columns.

**Goal:** Let a user earn coins by caring for their pet (flat per-action rewards, a once-daily login bonus, and small daily/weekly missions with bigger payouts), and see their balance and mission progress in the UI. Spending that balance is explicitly out of scope, reserved for the not-yet-planned Casa/Tienda features.

**Architecture:** Same layering as the diary feature — a pure, dependency-free logic module (`lib/missions.ts`, mirroring `lib/diary.ts`/`lib/pet-engine.ts`) defines the mission catalog and computes period keys, progress, and completion-payout decisions from raw event/completion arrays with an injected `now: Date`; a thin I/O module (`lib/missions-sync.ts`) does the actual Supabase reads/writes for the lazy daily-bonus-and-mission-completion sync, called from both `/pet` and `/pet/misiones`'s Server Component renders; the existing care-action Server Actions in `app/pet/actions.ts` get a small best-effort addition that logs a `mission_events` row and increments `pets.coins` after their existing stat-update path succeeds.

**Tech Stack:** Next.js 15.5.23 (App Router, TypeScript), Supabase (Postgres + Auth via `@supabase/ssr` ^0.12.4 / `@supabase/supabase-js` ^2.112.3), Vitest ^4.1.11, npm. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-23-currency-missions-design.md`

## Global Constraints

- Exact coin amounts (approved, do not change): `COINS_PER_CARE_ACTION = 2` (every successful `feed`/`bathe`/`play`/`medicine` call), `DAILY_BONUS_COINS = 10` (first `/pet` load of the calendar day), daily mission reward `15` coins, weekly mission reward `30` coins.
- `mission_events` is written inline by `feed`/`bathe`/`play`/`medicine` in `app/pet/actions.ts` at the moment they succeed. `feed`/`play`/`medicine` always log their event (`fed`/`played`/`medicated`); `bathe` always awards its coins but only logs a `bathed_dirty` event when cleanliness was below the dirty threshold immediately before bathing. `toggleSleep` is untouched — there is no sleep-related mission event type.
- `lib/missions.ts` stays pure: no I/O, no bare `new Date()`/`Date.now()` call without an injected `now: Date` parameter — mirrors every function signature in `lib/pet-engine.ts`/`lib/diary.ts`.
- Mission definitions, period keys, and progress/completion state are always computed at read time from `MISSIONS` (fixed catalog, same pattern as `SpriteState`) plus raw `mission_events`/`mission_completions` rows — never cached into other columns beyond the `mission_completions` idempotency ledger itself.
- `period_key` for weekly missions is a real ISO-8601 week string (`computePeriodKey` implements the standard "Thursday of the current week" algorithm) — never a naive `getWeek()`-style approximation.
- The daily bonus and mission-completion detection both happen lazily, mirroring `lib/diary-sync.ts`'s `syncDiaryEvents` exactly: `syncMissionsAndDailyBonus(pet: PetRow): Promise<void>` in `lib/missions-sync.ts`, never throws, wraps all Supabase calls in try/catch, logs failures via `console.error`, called at the top of both `/pet` and `/pet/misiones`'s Server Component render before re-reading fresh state.
- Care-action coin/event awarding in `app/pet/actions.ts` is strictly best-effort and additive: the existing stat-update path stays the primary, must-succeed path with its existing error handling untouched; coin/event awarding happens only after that update succeeds, and its own failures are swallowed (logged, not surfaced to the user) so they can never turn a successful care action into a user-visible error.
- Awarding coins via `pets.coins = pet.coins + delta` is an accepted, documented read-modify-write with no transaction — same character as `lib/diary-sync.ts`'s already-reviewed concurrent-render risk. Not fixed here (would need a DB-level atomic increment/RPC); consistency with that precedent matters more than fixing this instance in isolation.
- All Supabase I/O for the two new tables and the two new `pets` columns is verified manually against the real cloud Supabase project — this app has no local Supabase CLI/Docker. No automated tests touch Postgres.
- The missions route is nested at `/pet/misiones` (no path param — one pet per account), following the same auth/onboarding redirect guard as every other `/pet/*` page.
- Visual design reuses the existing design system verbatim: the signboard card class (`rounded-[2rem] border-8 border-[#6B4226] ring-4 ring-inset ring-[#C89B6C] bg-[#FFF9EC] p-6 shadow-[inset_0_3px_6px_rgba(0,0,0,0.15),0_10px_20px_rgba(0,0,0,0.25)]`), `font-[family-name:var(--font-display)]` for headings, and the exact pill styling already used for the "📔 Diario" nav link.
- Package manager: npm. Tests: `npx vitest run` / `npm run test`.

**Ambiguous points from the spec/brief, resolved here (noted inline in the relevant task too):**
- **Period-key timezone:** all calendar-day/ISO-week boundaries are computed in UTC (`getUTCFullYear`/`getUTCMonth`/`getUTCDate`), not server-local or user-local time. This keeps `computePeriodKey`/`shouldGrantDailyBonus` pure functions of `now: Date` with no dependency on server locale, consistent with the rest of `lib/pet-engine.ts`'s ms-based, timezone-agnostic time math. Known simplification: a user near a UTC day boundary in their own timezone may see the "daily" mission/bonus reset at a wall-clock time that doesn't match their local midnight — acceptable for v1, same spirit as the rest of the app's lack of timezone-awareness.
- **`bathed_dirty` threshold:** hardcoded inline as `< 30` in `app/pet/actions.ts` (not exported from `lib/pet-engine.ts` as a new named constant), with a comment cross-referencing `computeMood`'s own existing inline `30`. This avoids touching `lib/pet-engine.ts` beyond the two new `PetRow` fields, keeping Task 1's diff scoped exactly to the schema/type change it's meant to be.
- **Independent coin-award call sites:** `lib/missions-sync.ts` and `app/pet/actions.ts`'s `awardCareActionCoins` each do their own independent read-modify-write on `pets.coins`; they are never called within the same request, so no additional coordination is needed beyond each function's own documented single-writer-race limitation.
- **Coin badge on `/pet/misiones`:** the page additionally shows the pet's total coin balance in its header (reusing the same `🪙 {coins}` badge added to `/pet`), even though the spec's per-mission listing didn't strictly require it — cheap, and avoids a jarring inconsistency between the two pages.
- **Language:** mission chrome (headings, "Completed for this period" badge, "Daily"/"Weekly" period labels) stays in English; only the three mission `description` strings use the mandated Spanish copy from the spec. This mirrors the diary feature's precedent exactly — Spanish only for spec-mandated content strings, English everywhere else, including nav pill labels reduced to a single Spanish word ("Diario", "Misiones").
- **Types defined once:** `MissionEventType`, `MissionPeriod`, `Mission`, `MissionEvent`, `MissionCompletion`, `MissionProgress`, `MissionPayout` are defined once in `lib/missions.ts` (Task 2) and re-imported everywhere else — never redeclared, matching how `DiaryEntry` etc. are defined once in `lib/diary.ts`.

---

### Task 1: Schema + `PetRow` type update

**Files:**
- Modify: `supabase/schema.sql` (append only)
- Modify: `lib/pet-engine.ts` (extend `PetRow`)
- Modify: `lib/pet-engine.test.ts` (extend `makePet` fixture)
- Modify: `lib/diary.test.ts` (extend its separate `makePet` fixture)

**Interfaces:**
- Consumes: nothing.
- Produces: `coins`/`last_daily_bonus_at` columns on `pets`, the `mission_events`/`mission_completions` tables in the real Supabase project (consumed by `lib/missions-sync.ts` and `app/pet/actions.ts` in Task 3); the extended `PetRow` interface (consumed by every later task).

- [ ] **Step 1: Append the new schema block to `supabase/schema.sql`**

Append to the end of `supabase/schema.sql` (do not touch any existing content above it):

```sql

-- --- Currency & Missions: coins, mission events, mission completions (added 2026-08-24) ---
-- The `pets` and `diary_entries` tables above are already live in the Supabase project.
-- Run ONLY the block below (SQL Editor > New query > Run) — do not re-run the whole file.
-- `add column if not exists` / `create table if not exists` make this safe to run
-- even if it was partially applied already.

alter table pets add column if not exists coins integer not null default 0;
alter table pets add column if not exists last_daily_bonus_at timestamptz;

create table if not exists mission_events (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references pets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('fed', 'bathed_dirty', 'played', 'medicated')),
  occurred_at timestamptz not null default now()
);

alter table mission_events enable row level security;

create policy "Users manage their own mission events"
  on mission_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists mission_completions (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references pets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id text not null,
  period_key text not null,
  completed_at timestamptz not null default now(),
  unique (pet_id, mission_id, period_key)
);

alter table mission_completions enable row level security;

create policy "Users manage their own mission completions"
  on mission_completions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 2: Extend the `PetRow` interface in `lib/pet-engine.ts`**

Find:
```typescript
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
}
```

Replace with:
```typescript
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
}
```

- [ ] **Step 3: Update `lib/pet-engine.test.ts`'s `makePet` fixture**

Find:
```typescript
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
```

Replace with:
```typescript
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
    ...overrides,
  };
}
```

- [ ] **Step 4: Update `lib/diary.test.ts`'s separate `makePet` fixture**

Find:
```typescript
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
```

Replace with:
```typescript
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
    ...overrides,
  };
}
```

- [ ] **Step 5: Run the full test suite, verify everything still passes**

Run: `npm run test`
Expected: every existing suite passes with the updated fixtures — `lib/pet-engine.test.ts`, `lib/diary.test.ts`, `lib/gemini-client.test.ts`, `lib/onboarding-orchestration.test.ts`, `lib/validate-photo-files.test.ts`. No TypeScript errors about missing `PetRow` fields (this is the whole point of updating both fixtures together — a partial update would fail to compile).

- [ ] **Step 6: Manually run only the new SQL against the real Supabase project**

Open the Supabase Dashboard for this project → SQL Editor → New query → paste **only** the new block from Step 1 (from `-- --- Currency & Missions:` down to the closing `with check` line of the `mission_completions` policy) → Run.

Expected: "Success. No rows returned." Then check Table Editor: the `pets` table now has `coins` (integer, default `0`) and `last_daily_bonus_at` (timestamptz, nullable) columns; `mission_events` and `mission_completions` tables now exist with the columns shown above. Under Table Editor for each new table → RLS Policies, confirm RLS is enabled and the corresponding "Users manage their own ..." policy is listed.

- [ ] **Step 7: Commit**

```bash
git add supabase/schema.sql lib/pet-engine.ts lib/pet-engine.test.ts lib/diary.test.ts
git commit -m "feat: add coins/missions schema and extend PetRow with coin fields"
```

---

### Task 2: `lib/missions.ts` — pure logic (TDD)

**Files:**
- Create: `lib/missions.ts`
- Create: `lib/missions.test.ts`

**Interfaces:**
- Consumes: nothing (pure module, no dependency on any other new file).
- Produces: `MissionEventType`, `MissionPeriod`, `Mission`, `MissionEvent`, `MissionCompletion`, `MissionProgress`, `MissionPayout` types; `COINS_PER_CARE_ACTION`, `DAILY_BONUS_COINS`, `MISSIONS` constants; `computePeriodKey(period, now)`, `shouldGrantDailyBonus(lastDailyBonusAt, now)`, `computeMissionProgress(events, completions, now)`, `determineMissionCompletionsToPay(events, completions, now)` functions — consumed by `lib/missions-sync.ts` (Task 3), `app/pet/actions.ts` (Task 3), and `app/pet/misiones/page.tsx` (Task 4).

- [ ] **Step 1: Write failing tests for the `MISSIONS` catalog and `computePeriodKey`**

Create `lib/missions.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  MISSIONS,
  COINS_PER_CARE_ACTION,
  DAILY_BONUS_COINS,
  computePeriodKey,
  type MissionEvent,
  type MissionCompletion,
} from './missions';

function makeMissionEvent(overrides: Partial<MissionEvent> = {}): MissionEvent {
  return {
    id: 'event-1',
    pet_id: 'pet-1',
    user_id: 'user-1',
    event_type: 'fed',
    occurred_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeMissionCompletion(overrides: Partial<MissionCompletion> = {}): MissionCompletion {
  return {
    id: 'completion-1',
    pet_id: 'pet-1',
    user_id: 'user-1',
    mission_id: 'daily-feed',
    period_key: '2026-08-23',
    completed_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('MISSIONS', () => {
  it('defines exactly 3 v1 missions: 2 daily, 1 weekly', () => {
    expect(MISSIONS).toHaveLength(3);
    expect(MISSIONS.filter((m) => m.period === 'daily')).toHaveLength(2);
    expect(MISSIONS.filter((m) => m.period === 'weekly')).toHaveLength(1);
  });

  it('has unique mission ids', () => {
    const ids = MISSIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('matches the spec content: feed today, bathe when dirty, play 5x this week', () => {
    const feedMission = MISSIONS.find((m) => m.eventType === 'fed')!;
    expect(feedMission.period).toBe('daily');
    expect(feedMission.threshold).toBe(1);
    expect(feedMission.rewardCoins).toBe(15);

    const batheMission = MISSIONS.find((m) => m.eventType === 'bathed_dirty')!;
    expect(batheMission.period).toBe('daily');
    expect(batheMission.threshold).toBe(1);
    expect(batheMission.rewardCoins).toBe(15);

    const playMission = MISSIONS.find((m) => m.eventType === 'played')!;
    expect(playMission.period).toBe('weekly');
    expect(playMission.threshold).toBe(5);
    expect(playMission.rewardCoins).toBe(30);
  });

  it('sets the approved flat coin amounts', () => {
    expect(COINS_PER_CARE_ACTION).toBe(2);
    expect(DAILY_BONUS_COINS).toBe(10);
  });
});

describe('computePeriodKey (daily)', () => {
  it('formats a date as YYYY-MM-DD in UTC', () => {
    const now = new Date('2026-08-23T15:30:00.000Z');
    expect(computePeriodKey('daily', now)).toBe('2026-08-23');
  });

  it('pads single-digit months and days', () => {
    const now = new Date('2026-01-05T00:00:00.000Z');
    expect(computePeriodKey('daily', now)).toBe('2026-01-05');
  });
});

describe('computePeriodKey (weekly, ISO 8601)', () => {
  it('returns the same ISO week key for a date in the middle of a normal week (Wednesday)', () => {
    const wednesday = new Date('2026-08-19T12:00:00.000Z');
    expect(computePeriodKey('weekly', wednesday)).toBe('2026-W34');
  });

  it('returns the correct key for a Monday, the ISO week start', () => {
    const monday = new Date('2026-08-17T00:00:00.000Z');
    expect(computePeriodKey('weekly', monday)).toBe('2026-W34');
  });

  it('returns the correct key for a Sunday, the ISO week end, same week as its Monday', () => {
    const sunday = new Date('2026-08-23T23:00:00.000Z');
    expect(computePeriodKey('weekly', sunday)).toBe('2026-W34');
  });

  it('handles the ISO week-year boundary: 2025-12-29 is a Monday that starts ISO week 2026-W01, even though the calendar date is still in 2025', () => {
    const boundaryMonday = new Date('2025-12-29T10:00:00.000Z');
    expect(computePeriodKey('weekly', boundaryMonday)).toBe('2026-W01');
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run lib/missions.test.ts`
Expected: FAIL — `./missions` module not found.

- [ ] **Step 3: Implement types, the `MISSIONS` catalog, and `computePeriodKey`**

Create `lib/missions.ts`:
```typescript
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
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run lib/missions.test.ts`
Expected: all `MISSIONS` and `computePeriodKey` tests PASS (12 tests).

- [ ] **Step 5: Append failing tests for `shouldGrantDailyBonus`**

Append to `lib/missions.test.ts`:
```typescript
import { shouldGrantDailyBonus } from './missions';

describe('shouldGrantDailyBonus', () => {
  it('grants when last_daily_bonus_at is null (never granted before)', () => {
    expect(shouldGrantDailyBonus(null, new Date('2026-08-23T10:00:00.000Z'))).toBe(true);
  });

  it('does not grant again later the same UTC calendar day', () => {
    const lastBonus = '2026-08-23T01:00:00.000Z';
    const now = new Date('2026-08-23T23:59:00.000Z');
    expect(shouldGrantDailyBonus(lastBonus, now)).toBe(false);
  });

  it('grants again on a new UTC calendar day', () => {
    const lastBonus = '2026-08-23T23:59:00.000Z';
    const now = new Date('2026-08-24T00:01:00.000Z');
    expect(shouldGrantDailyBonus(lastBonus, now)).toBe(true);
  });
});
```

- [ ] **Step 6: Run tests, verify the new suite fails**

Run: `npx vitest run lib/missions.test.ts`
Expected: earlier tests still PASS; `shouldGrantDailyBonus` tests FAIL — not exported.

- [ ] **Step 7: Implement `shouldGrantDailyBonus`**

Append to `lib/missions.ts`:
```typescript
export function shouldGrantDailyBonus(lastDailyBonusAt: string | null, now: Date): boolean {
  if (lastDailyBonusAt === null) return true;
  return computePeriodKey('daily', new Date(lastDailyBonusAt)) !== computePeriodKey('daily', now);
}
```

- [ ] **Step 8: Run tests, verify they pass**

Run: `npx vitest run lib/missions.test.ts`
Expected: all PASS (15 tests).

- [ ] **Step 9: Append failing tests for `computeMissionProgress` and `determineMissionCompletionsToPay`**

Append to `lib/missions.test.ts`:
```typescript
import { computeMissionProgress, determineMissionCompletionsToPay } from './missions';

describe('computeMissionProgress', () => {
  it('reports 0/threshold and not completed with no events', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    const progress = computeMissionProgress([], [], now);
    expect(progress).toHaveLength(3);
    for (const p of progress) {
      expect(p.count).toBe(0);
      expect(p.isCompleted).toBe(false);
    }
  });

  it('counts only events of the matching type within the current period', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    const events = [
      makeMissionEvent({ event_type: 'fed', occurred_at: '2026-08-23T08:00:00.000Z' }),
      makeMissionEvent({ event_type: 'fed', occurred_at: '2026-08-22T08:00:00.000Z' }), // yesterday, doesn't count
      makeMissionEvent({ event_type: 'played', occurred_at: '2026-08-23T08:00:00.000Z' }), // wrong type for feed mission
    ];
    const progress = computeMissionProgress(events, [], now);
    const feedProgress = progress.find((p) => p.mission.id === 'daily-feed')!;
    expect(feedProgress.count).toBe(1);
  });

  it('marks a daily mission completed once its count reaches the threshold and a completion row exists', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    const events = [makeMissionEvent({ event_type: 'fed', occurred_at: '2026-08-23T08:00:00.000Z' })];
    const completions = [makeMissionCompletion({ mission_id: 'daily-feed', period_key: '2026-08-23' })];
    const progress = computeMissionProgress(events, completions, now);
    const feedProgress = progress.find((p) => p.mission.id === 'daily-feed')!;
    expect(feedProgress.isCompleted).toBe(true);
  });

  it('counts weekly play events across the whole ISO week, not just today', () => {
    const now = new Date('2026-08-19T12:00:00.000Z'); // Wednesday, week 2026-W34
    const events = [
      makeMissionEvent({ event_type: 'played', occurred_at: '2026-08-17T09:00:00.000Z' }), // Monday, same week
      makeMissionEvent({ event_type: 'played', occurred_at: '2026-08-19T09:00:00.000Z' }), // Wednesday, same week
      makeMissionEvent({ event_type: 'played', occurred_at: '2026-08-10T09:00:00.000Z' }), // prior week
    ];
    const progress = computeMissionProgress(events, [], now);
    const playProgress = progress.find((p) => p.mission.id === 'weekly-play')!;
    expect(playProgress.count).toBe(2);
    expect(playProgress.isCompleted).toBe(false); // threshold is 5
  });
});

describe('determineMissionCompletionsToPay', () => {
  it('returns nothing when no mission has reached its threshold', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    expect(determineMissionCompletionsToPay([], [], now)).toEqual([]);
  });

  it('returns a payout for a newly-completed daily mission', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    const events = [makeMissionEvent({ event_type: 'fed', occurred_at: '2026-08-23T08:00:00.000Z' })];
    const payouts = determineMissionCompletionsToPay(events, [], now);
    expect(payouts).toEqual([{ mission_id: 'daily-feed', period_key: '2026-08-23', rewardCoins: 15 }]);
  });

  it('does not re-pay a mission that already has a completion row for the current period', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    const events = [makeMissionEvent({ event_type: 'fed', occurred_at: '2026-08-23T08:00:00.000Z' })];
    const completions = [makeMissionCompletion({ mission_id: 'daily-feed', period_key: '2026-08-23' })];
    expect(determineMissionCompletionsToPay(events, completions, now)).toEqual([]);
  });

  it('pays the weekly mission once its threshold is reached, with the ISO week period_key', () => {
    const now = new Date('2026-08-19T12:00:00.000Z'); // 2026-W34
    const events = Array.from({ length: 5 }, (_, i) =>
      makeMissionEvent({ event_type: 'played', occurred_at: `2026-08-1${7 + i}T09:00:00.000Z` })
    );
    const payouts = determineMissionCompletionsToPay(events, [], now);
    expect(payouts).toEqual([{ mission_id: 'weekly-play', period_key: '2026-W34', rewardCoins: 30 }]);
  });

  it('can return multiple payouts at once when several missions complete in the same sync', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    const events = [
      makeMissionEvent({ event_type: 'fed', occurred_at: '2026-08-23T08:00:00.000Z' }),
      makeMissionEvent({ event_type: 'bathed_dirty', occurred_at: '2026-08-23T08:00:00.000Z' }),
    ];
    const payouts = determineMissionCompletionsToPay(events, [], now);
    expect(payouts.map((p) => p.mission_id).sort()).toEqual(['daily-bathe-dirty', 'daily-feed']);
  });
});
```

- [ ] **Step 10: Run tests, verify the new suite fails**

Run: `npx vitest run lib/missions.test.ts`
Expected: earlier tests still PASS; `computeMissionProgress`/`determineMissionCompletionsToPay` tests FAIL — not exported.

- [ ] **Step 11: Implement `computeMissionProgress` and `determineMissionCompletionsToPay`**

Append to `lib/missions.ts`:
```typescript
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
```

- [ ] **Step 12: Run the full missions suite, verify all pass**

Run: `npx vitest run lib/missions.test.ts`
Expected: all tests PASS (22 tests total: 4 `MISSIONS` + 2 `computePeriodKey` daily + 4 `computePeriodKey` weekly + 3 `shouldGrantDailyBonus` + 4 `computeMissionProgress` + 5 `determineMissionCompletionsToPay`).

- [ ] **Step 13: Run the whole repo's test suite as a sanity check**

Run: `npm run test`
Expected: every suite passes, including `lib/missions.test.ts`'s 22 tests alongside the pre-existing `lib/pet-engine.test.ts`, `lib/diary.test.ts`, `lib/gemini-client.test.ts`, `lib/onboarding-orchestration.test.ts`, and `lib/validate-photo-files.test.ts`.

- [ ] **Step 14: Commit**

```bash
git add lib/missions.ts lib/missions.test.ts
git commit -m "feat: add pure missions/currency logic with ISO week computation"
```

---

### Task 3: I/O layer — `lib/missions-sync.ts` + care-action coin/event integration

**Files:**
- Create: `lib/missions-sync.ts`
- Modify: `app/pet/actions.ts`

**Interfaces:**
- Consumes: `createClient()` from `./supabase/server`; `DAILY_BONUS_COINS`, `COINS_PER_CARE_ACTION`, `shouldGrantDailyBonus`, `determineMissionCompletionsToPay`, `type MissionEvent`, `type MissionCompletion`, `type MissionEventType` from `./missions` (Task 2); `type PetRow` from `./pet-engine`.
- Produces: `syncMissionsAndDailyBonus(pet: PetRow): Promise<void>` (internal, no `'use server'` — called from Server Components in Task 4, never throws); coin/event side effects inside the existing `feed`/`bathe`/`play`/`medicine` Server Actions.

- [ ] **Step 1: Implement the internal missions/daily-bonus sync function**

Create `lib/missions-sync.ts`:
```typescript
import { createClient } from './supabase/server';
import {
  DAILY_BONUS_COINS,
  determineMissionCompletionsToPay,
  shouldGrantDailyBonus,
  type MissionCompletion,
  type MissionEvent,
} from './missions';
import type { PetRow } from './pet-engine';

// Soft background sync: grants the once-per-day login bonus and pays out any
// newly-completed mission for its current period. Never throws — a failure
// here must not break page render. Mirrors lib/diary-sync.ts's exact shape.
//
// KNOWN LIMITATION: awarding coins (`coins: pet.coins + coinDelta`) is a
// read-modify-write with no transaction — the same character as
// lib/diary-sync.ts's already-documented concurrent-render risk. Two
// concurrent renders could both read the same `pet.coins` snapshot and both
// write, dropping one award. There is also a smaller window between the
// mission_completions insert below and the pets update: if the insert
// succeeds but the update fails, that mission's completion is permanently
// recorded without ever paying its coins (it will never be retried, since
// determineMissionCompletionsToPay treats it as already paid). Both are
// deferred for the same reason as the diary precedent: a real fix needs a
// DB-level atomic increment (e.g. a Postgres RPC), which is its own schema
// change. Repeated *sequential* visits are otherwise idempotent — the unique
// constraint on mission_completions prevents double-paying a mission, and
// last_daily_bonus_at prevents double-paying the daily bonus.
export async function syncMissionsAndDailyBonus(pet: PetRow): Promise<void> {
  try {
    const supabase = await createClient();
    const now = new Date();

    const { data: eventsData, error: eventsError } = await supabase
      .from('mission_events')
      .select('*')
      .eq('pet_id', pet.id);

    if (eventsError) {
      console.error('syncMissionsAndDailyBonus: failed to load mission events', eventsError);
      return;
    }

    const { data: completionsData, error: completionsError } = await supabase
      .from('mission_completions')
      .select('*')
      .eq('pet_id', pet.id);

    if (completionsError) {
      console.error('syncMissionsAndDailyBonus: failed to load mission completions', completionsError);
      return;
    }

    const events = (eventsData ?? []) as MissionEvent[];
    const completions = (completionsData ?? []) as MissionCompletion[];

    const grantDailyBonus = shouldGrantDailyBonus(pet.last_daily_bonus_at, now);
    const payouts = determineMissionCompletionsToPay(events, completions, now);

    if (!grantDailyBonus && payouts.length === 0) return;

    if (payouts.length > 0) {
      const { error: insertError } = await supabase.from('mission_completions').insert(
        payouts.map((payout) => ({
          pet_id: pet.id,
          user_id: pet.user_id,
          mission_id: payout.mission_id,
          period_key: payout.period_key,
        }))
      );

      if (insertError) {
        console.error('syncMissionsAndDailyBonus: failed to insert mission completions', insertError);
        return;
      }
    }

    const missionCoins = payouts.reduce((sum, payout) => sum + payout.rewardCoins, 0);
    const bonusCoins = grantDailyBonus ? DAILY_BONUS_COINS : 0;

    const update: { coins: number; last_daily_bonus_at?: string } = {
      coins: pet.coins + missionCoins + bonusCoins,
    };
    if (grantDailyBonus) {
      update.last_daily_bonus_at = now.toISOString();
    }

    const { error: updateError } = await supabase.from('pets').update(update).eq('id', pet.id);
    if (updateError) {
      console.error('syncMissionsAndDailyBonus: failed to update coins/daily bonus', updateError);
    }
  } catch (err) {
    console.error('syncMissionsAndDailyBonus: unexpected error syncing missions/daily bonus', err);
  }
}
```

- [ ] **Step 2: Add coin/event awarding to the care-action Server Actions**

Replace the entire contents of `app/pet/actions.ts` with:
```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  computeCurrentStats,
  computeIsSick,
  feed as feedStats,
  play as playStats,
  bathe as batheStats,
  medicine as medicineStats,
  type PetRow,
  type Stats,
} from '@/lib/pet-engine';
import { COINS_PER_CARE_ACTION, type MissionEventType } from '@/lib/missions';

async function loadPet(): Promise<{ error: string } | { pet: PetRow }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not logged in.' };

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) return { error: 'No pet found.' };
  return { pet: pet as PetRow };
}

// pet-engine.ts computes fractional decay; the `pets` table stores stats as smallint.
function roundStats(stats: Stats): Stats {
  return {
    hunger: Math.round(stats.hunger),
    happiness: Math.round(stats.happiness),
    energy: Math.round(stats.energy),
    cleanliness: Math.round(stats.cleanliness),
  };
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Best-effort coin/mission-event awarding, called only after the care action's
// primary stat update has already succeeded. Never throws — a failure here
// must not turn a successful care action into an error shown to the user.
//
// KNOWN LIMITATION: `coins: pet.coins + COINS_PER_CARE_ACTION` is a
// read-modify-write with no transaction, the same character as
// lib/diary-sync.ts's already-documented concurrent-render risk. Not fixed
// here for the same reason (would need a DB-level atomic increment/RPC).
async function awardCareActionCoins(
  supabase: SupabaseServerClient,
  pet: PetRow,
  eventType: MissionEventType | null
): Promise<void> {
  try {
    if (eventType) {
      const { error: eventError } = await supabase.from('mission_events').insert({
        pet_id: pet.id,
        user_id: pet.user_id,
        event_type: eventType,
      });
      if (eventError) {
        console.error('awardCareActionCoins: failed to log mission event', eventError);
      }
    }

    const { error: coinsError } = await supabase
      .from('pets')
      .update({ coins: pet.coins + COINS_PER_CARE_ACTION })
      .eq('id', pet.id);
    if (coinsError) {
      console.error('awardCareActionCoins: failed to award coins', coinsError);
    }
  } catch (err) {
    console.error('awardCareActionCoins: unexpected error awarding coins', err);
  }
}

export async function feed() {
  const loaded = await loadPet();
  if ('error' in loaded) return loaded;

  const supabase = await createClient();
  const now = new Date();
  const newStats = roundStats(feedStats(computeCurrentStats(loaded.pet, now)));

  const { error } = await supabase
    .from('pets')
    .update({ ...newStats, last_updated_at: now.toISOString() })
    .eq('id', loaded.pet.id);

  if (error) return { error: error.message };

  await awardCareActionCoins(supabase, loaded.pet, 'fed');

  revalidatePath('/pet');
  return { error: null };
}

export async function play() {
  const loaded = await loadPet();
  if ('error' in loaded) return loaded;

  const supabase = await createClient();
  const now = new Date();
  const result = playStats(computeCurrentStats(loaded.pet, now), loaded.pet.is_sleeping);
  if ('error' in result) return result;

  const { error } = await supabase
    .from('pets')
    .update({ ...roundStats(result), last_updated_at: now.toISOString() })
    .eq('id', loaded.pet.id);

  if (error) return { error: error.message };

  await awardCareActionCoins(supabase, loaded.pet, 'played');

  revalidatePath('/pet');
  return { error: null };
}

export async function bathe() {
  const loaded = await loadPet();
  if ('error' in loaded) return loaded;

  const supabase = await createClient();
  const now = new Date();
  const statsBeforeBathe = computeCurrentStats(loaded.pet, now);
  const newStats = roundStats(batheStats(statsBeforeBathe));

  const { error } = await supabase
    .from('pets')
    .update({ ...newStats, last_updated_at: now.toISOString() })
    .eq('id', loaded.pet.id);

  if (error) return { error: error.message };

  // 30 matches computeMood's dirty cutoff (`stats.cleanliness < 30`) in
  // lib/pet-engine.ts. bathed_dirty only counts as a real cleaning, not
  // routine maintenance of an already-clean pet — see the spec's Data Model
  // section. Coins are still awarded either way.
  const wasDirty = statsBeforeBathe.cleanliness < 30;
  await awardCareActionCoins(supabase, loaded.pet, wasDirty ? 'bathed_dirty' : null);

  revalidatePath('/pet');
  return { error: null };
}

export async function toggleSleep() {
  const loaded = await loadPet();
  if ('error' in loaded) return loaded;

  const supabase = await createClient();
  const now = new Date();
  const currentStats = roundStats(computeCurrentStats(loaded.pet, now));

  const { error } = await supabase
    .from('pets')
    .update({ ...currentStats, is_sleeping: !loaded.pet.is_sleeping, last_updated_at: now.toISOString() })
    .eq('id', loaded.pet.id);

  if (error) return { error: error.message };
  revalidatePath('/pet');
  return { error: null };
}

export async function medicine() {
  const loaded = await loadPet();
  if ('error' in loaded) return loaded;

  const supabase = await createClient();
  const now = new Date();
  const currentStats = computeCurrentStats(loaded.pet, now);
  const isSick = computeIsSick(loaded.pet, now);
  const result = medicineStats(currentStats, isSick);
  if ('error' in result) return result;

  const { error } = await supabase
    .from('pets')
    .update({ ...roundStats(result), last_updated_at: now.toISOString() })
    .eq('id', loaded.pet.id);

  if (error) return { error: error.message };

  await awardCareActionCoins(supabase, loaded.pet, 'medicated');

  revalidatePath('/pet');
  return { error: null };
}
```

`toggleSleep` is intentionally left untouched — there is no sleep-related `mission_events` type.

- [ ] **Step 3: Verify the project still type-checks and builds**

Run: `npm run build`
Expected: build succeeds with no TypeScript/ESLint errors (no automated tests touch Server Actions that hit Supabase in this codebase, matching the testing philosophy already established for `app/pet/diary/actions.ts` — verification here is `npm run build`, not Vitest).

- [ ] **Step 4: Commit**

```bash
git add lib/missions-sync.ts app/pet/actions.ts
git commit -m "feat: award coins and log mission events from care actions"
```

---

### Task 4: UI — coin badge, `/pet/misiones` page, nav link

**Files:**
- Modify: `app/pet/page.tsx`
- Create: `app/pet/misiones/page.tsx`

**Interfaces:**
- Consumes: `syncMissionsAndDailyBonus` (Task 3); `computeMissionProgress`, `type MissionEvent`, `type MissionCompletion` (Task 2); `createClient()`; `computeCurrentStats`, `computeIsSick`, `computeLifeStage`, `computeMood`, `type PetRow` (existing).
- Produces: the `/pet/misiones` route; a `🪙 {coins}` badge and a "🎯 Misiones" nav pill on `/pet`.

- [ ] **Step 1: Add the sync call, coin badge, and Misiones nav pill to `app/pet/page.tsx`**

Replace the entire contents of `app/pet/page.tsx` with:
```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { syncMissionsAndDailyBonus } from '@/lib/missions-sync';
import {
  computeCurrentStats,
  computeIsSick,
  computeLifeStage,
  computeMood,
  type PetRow,
} from '@/lib/pet-engine';
import { StatBar } from './StatBar';
import { ActionButtons } from './ActionButtons';

export default async function PetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) redirect('/onboarding');

  // Runs before re-reading the pet row below so any daily bonus / mission
  // payout from this visit shows up in the coin balance rendered on this page.
  await syncMissionsAndDailyBonus(pet as PetRow);

  const { data: freshPet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  const petRow = (freshPet ?? pet) as PetRow;

  const now = new Date();
  const stats = computeCurrentStats(petRow, now);
  const isSick = computeIsSick(petRow, now);
  const lifeStage = computeLifeStage(new Date(petRow.created_at), now);
  const mood = computeMood(stats, isSick, petRow.is_sleeping);

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-gradient-to-b from-[#BEE7F5] to-[#B7E4A0] px-4 py-10">
      <div className="w-full max-w-sm space-y-6 rounded-[2rem] border-8 border-[#6B4226] ring-4 ring-inset ring-[#C89B6C] bg-[#FFF9EC] p-6 shadow-[inset_0_3px_6px_rgba(0,0,0,0.15),0_10px_20px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-[family-name:var(--font-display)] font-bold text-[#4A3222]">{petRow.name}</h1>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#FFF3C4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20">
              🪙 {petRow.coins}
            </span>
            <Link
              href="/pet/misiones"
              className="rounded-full bg-[#F0DEB4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20"
            >
              🎯 Misiones
            </Link>
            <Link
              href="/pet/diary"
              className="rounded-full bg-[#F0DEB4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20"
            >
              📔 Diario
            </Link>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className="-mb-4 h-6 w-40 rounded-full bg-[#8FBF6A]/50 blur-sm" />
          {lifeStage === 'egg' ? (
            <>
              <img src="/egg-sprite.svg" alt="Egg" width={180} height={180} className="drop-shadow-lg" />
              <p className="mt-2 text-sm font-semibold text-[#8B5E3C]">Your pet is about to hatch.</p>
            </>
          ) : (
            <img
              src={petRow.sprites[mood]}
              alt={petRow.name}
              className="drop-shadow-lg"
              style={{ width: lifeStage === 'baby' ? '55%' : '85%' }}
            />
          )}
        </div>

        <div className="space-y-3">
          <StatBar label="Hunger" value={stats.hunger} />
          <StatBar label="Happiness" value={stats.happiness} />
          <StatBar label="Energy" value={stats.energy} />
          <StatBar label="Cleanliness" value={stats.cleanliness} />
        </div>

        {lifeStage !== 'egg' && <ActionButtons isSleeping={petRow.is_sleeping} isSick={isSick} />}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create the missions checklist page**

Create `app/pet/misiones/page.tsx`:
```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { syncMissionsAndDailyBonus } from '@/lib/missions-sync';
import { computeMissionProgress, type MissionCompletion, type MissionEvent } from '@/lib/missions';
import type { PetRow } from '@/lib/pet-engine';

const cardClass =
  'rounded-[2rem] border-8 border-[#6B4226] ring-4 ring-inset ring-[#C89B6C] bg-[#FFF9EC] p-6 shadow-[inset_0_3px_6px_rgba(0,0,0,0.15),0_10px_20px_rgba(0,0,0,0.25)]';

export default async function MissionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) redirect('/onboarding');

  const petRow = pet as PetRow;

  // Runs before re-reading events/completions/coins below so any daily bonus
  // or mission payout from this visit shows up in this same render — this
  // page is a valid entry point on its own, not only reachable via /pet.
  await syncMissionsAndDailyBonus(petRow);

  const [{ data: freshPet }, { data: eventsData }, { data: completionsData }] = await Promise.all([
    supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('mission_events').select('*').eq('pet_id', petRow.id),
    supabase.from('mission_completions').select('*').eq('pet_id', petRow.id),
  ]);

  const freshPetRow = (freshPet ?? petRow) as PetRow;
  const events = (eventsData ?? []) as MissionEvent[];
  const completions = (completionsData ?? []) as MissionCompletion[];
  const progress = computeMissionProgress(events, completions, new Date());

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-gradient-to-b from-[#BEE7F5] to-[#B7E4A0] px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/pet" className="text-sm font-semibold text-[#4A3222] underline">
            ← Back
          </Link>
          <h1 className="text-xl font-[family-name:var(--font-display)] font-bold text-[#4A3222]">
            {freshPetRow.name}&apos;s Missions
          </h1>
        </div>

        <div className="flex justify-end">
          <span className="rounded-full bg-[#FFF3C4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20">
            🪙 {freshPetRow.coins}
          </span>
        </div>

        <div className="space-y-3">
          {progress.map((p) => (
            <div key={p.mission.id} className={cardClass}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-[family-name:var(--font-display)] font-bold text-[#4A3222]">
                    {p.mission.description}
                  </p>
                  <p className="text-xs font-semibold text-[#8B5E3C]">
                    {p.mission.period === 'daily' ? 'Daily' : 'Weekly'} ·{' '}
                    {Math.min(p.count, p.mission.threshold)}/{p.mission.threshold}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#FFF3C4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20">
                  +{p.mission.rewardCoins} 🪙
                </span>
              </div>
              {p.isCompleted && (
                <p className="mt-2 text-sm font-semibold text-[#4FD1C5]">✅ Completed for this period</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify the project builds**

Run: `npm run build`
Expected: build succeeds with no TypeScript/ESLint errors.

This task deliberately **skips any live browser smoke-test step** — verifying `/pet` and `/pet/misiones` render correctly against a real logged-in user/real Supabase data is deferred to Task 5, matching how the diary plan's Task 4 handled this same situation (the person/agent executing this plan may not have working browser tooling mid-task).

- [ ] **Step 4: Commit**

```bash
git add app/pet/page.tsx app/pet/misiones
git commit -m "feat: add missions page, coin badge, and nav link"
```

---

### Task 5: End-to-end manual verification against the real Supabase project

This app has no local Supabase CLI/Docker, so everything touching real Postgres/RLS is verified manually here rather than via automated tests, per the app's established testing approach. No code changes are expected in this task; if a check below surfaces a bug, fix it and commit that fix separately using the same `git add` + `git commit` convention as the tasks above.

Two different inspection techniques are used deliberately: the Supabase **Table Editor** (Dashboard → Table Editor) connects with a privileged role that bypasses RLS entirely — it's the right tool for confirming *data values* (coin totals, row counts, exact `period_key`s), but it can never itself prove RLS is enforced for a real user. Confirming RLS requires querying **as that user**, via the Supabase REST API (PostgREST) with that user's own session access token — used specifically in Step 9 below.

- [ ] **Step 1: Run the full automated suite**

Run: `npm run test`
Expected: every Vitest suite passes, including `lib/missions.test.ts`'s 22 tests alongside the pre-existing `lib/pet-engine.test.ts`, `lib/diary.test.ts`, `lib/gemini-client.test.ts`, `lib/onboarding-orchestration.test.ts`, and `lib/validate-photo-files.test.ts`.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: succeeds with no TypeScript/ESLint errors.

- [ ] **Step 3: Confirm the schema change is live** (repeats Task 1 Step 6 as a final sanity check)

In the Supabase Dashboard → Table Editor: confirm `pets` has `coins` and `last_daily_bonus_at` columns; confirm `mission_events` and `mission_completions` exist with RLS enabled and their respective "Users manage their own ..." policies attached.

- [ ] **Step 4: Verify coins increment on each care action**

`npm run dev`, log in as the existing test user with a pet. Note the current `🪙` balance shown on `/pet`. Click **Feed**. Expected: after the page revalidates, the balance is exactly `+2` higher than before. Repeat individually for **Bathe** and **Play**, confirming `+2` each time. If the pet is currently sick, click **Medicine** and confirm `+2` as well (if not sick, skip this one check — `medicine` correctly does nothing when not sick, per existing behavior). In Table Editor → `mission_events`, confirm one new row was inserted per click with the matching `event_type` (`fed`, `played`, `medicated`, and `bathed_dirty` only if the pet was dirty when bathed — see Step 6).

- [ ] **Step 5: Verify the daily bonus grants exactly once per calendar day**

If this is the first `/pet` load of the current UTC calendar day, the balance should already include an extra `+10` on top of any care-action coins from Step 4 (compare the balance from before Step 4's first click against the balance after Step 4, accounting for the `+10`). In Table Editor → `pets`, confirm `last_daily_bonus_at` is set to today's date. Reload `/pet` again immediately (no further care actions). Expected: the balance does **not** increase by another `10` — `last_daily_bonus_at` is unchanged.

- [ ] **Step 6: Verify a daily mission completes and pays its reward**

If not already fed today, click **Feed** once. Visit `/pet/misiones`. Expected: the "Alimentá a tu mascota hoy" card shows `1/1` and "✅ Completed for this period"; the `🪙` balance shown on this page is `+15` higher than it was right after the Feed click in Step 4 (the mission payout, on top of the `+2` care-action coin). In Table Editor → `mission_completions`, confirm a row exists with `mission_id = 'daily-feed'` and `period_key` equal to today's date in `YYYY-MM-DD` form.

For the "Bañala si está sucia" mission: in Table Editor → `pets`, temporarily set `cleanliness` below `30` (or wait for natural decay), reload `/pet`, click **Bathe**. Expected: `mission_events` gets a new `bathed_dirty` row (not just the coin award), and `/pet/misiones` now shows that mission as `1/1` and completed, with the balance up another `+15`.

- [ ] **Step 7: Verify the weekly "play 5 times" mission's progress without premature completion**

Visit `/pet/misiones`, note the "Jugá con ella 5 veces esta semana" card's current count. Click **Play** once on `/pet`, reload `/pet/misiones`. Expected: the count increased by exactly `1` and the card is **not** marked completed unless the count has now reached `5`. Continue clicking Play (respecting the sleeping-pet restriction — wake the pet first if needed) until the count reaches `4/5`; reload `/pet/misiones` and confirm it still shows `4/5`, not completed. Click Play one more time to reach `5/5`; reload `/pet/misiones` and confirm it now shows "✅ Completed for this period" and the coin balance increased by `+30` (the weekly mission reward) in addition to the `+2` from that final Play click. In Table Editor → `mission_completions`, confirm a row exists with `mission_id = 'weekly-play'` and `period_key` in `YYYY-Www` form (e.g. `2026-W35`), matching the current real-world ISO week.

- [ ] **Step 8: Verify idempotency — no duplicate payouts on repeated reloads**

After Steps 6-7 complete, note the exact `pets.coins` value and the row count of `mission_completions` in Table Editor. Reload `/pet` and `/pet/misiones` several more times with no further care actions in between. Expected: `pets.coins` and the `mission_completions` row count are both unchanged across all those reloads — no mission is paid twice, and the daily bonus is not re-granted.

- [ ] **Step 9: Verify RLS isolation across two accounts using the REST API directly (not just the UI)**

In a second browser (or incognito window), sign up as a different test user and onboard a second pet. Perform at least one care action so that account has its own `mission_events`/`mission_completions` rows. Confirm `/pet/misiones` for that account shows only its own, independent progress (no leakage from the first account's data) — this is the app-level check.

Then confirm RLS itself (not just the app's own query filtering) blocks cross-account reads at the database level: in the second account's browser, open DevTools → Application → Cookies, and find the `sb-<project-ref>-auth-token` cookie — this contains the second account's session access token (same technique used in the diary plan's Task 5 Step 9 via `document.cookie` in the browser console). Using that access token, `NEXT_PUBLIC_SUPABASE_URL` from `.env.local`, and the anon key, run:

```bash
curl -s "https://<project-ref>.supabase.co/rest/v1/mission_events?select=*&pet_id=eq.<first-account-pet-id>" \
  -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <second-account-access-token>"
```

Expected: an empty JSON array `[]` — RLS's `using (auth.uid() = user_id)` policy blocks the second account from reading the first account's `mission_events` rows even when directly querying by the first account's known `pet_id`. Repeat the same request against `/rest/v1/mission_completions` with the same expectation.

---

## Self-Review

**Spec coverage:** every section of `docs/superpowers/specs/2026-08-23-currency-missions-design.md` maps to a task — Data Model → Task 1 (schema DDL copied verbatim) + Task 1's `PetRow` update; "Earning Coins" (care actions, daily bonus, missions) → Task 2 (`COINS_PER_CARE_ACTION`, `DAILY_BONUS_COINS`, `MISSIONS[].rewardCoins`, `shouldGrantDailyBonus`, `determineMissionCompletionsToPay`) + Task 3 (`awardCareActionCoins` in `app/pet/actions.ts`, `syncMissionsAndDailyBonus`); "`bathed_dirty` is only logged when cleanliness was below the dirty threshold before bathing" → Task 3's `bathe` action; "Missions (v1 content)" (2 daily + 1 weekly, exact Spanish descriptions/thresholds) → Task 2's `MISSIONS` constant; the "checkable from a point-in-time query, never continuous monitoring" non-goal → Task 2's `computeMissionProgress`/`determineMissionCompletionsToPay` only ever count discrete logged events, never inspect live stat values; the visible-checklist UI decision → Task 4's `/pet/misiones` page; the ISO week requirement → Task 2's `computePeriodKey` + its four boundary tests (mid-week, Monday, Sunday, year-boundary).

**Placeholder scan:** no TBDs; every step has complete, runnable code (full file contents or exact before/after snippets) or an explicit manual-verification procedure with concrete expected values.

**Type consistency:** `MissionEventType`, `MissionPeriod`, `Mission`, `MissionEvent`, `MissionCompletion`, `MissionProgress`, `MissionPayout` are defined once in `lib/missions.ts` (Task 2) and re-imported with identical shapes everywhere else — `lib/missions-sync.ts` imports `MissionEvent`/`MissionCompletion`, `app/pet/actions.ts` imports `MissionEventType`, `app/pet/misiones/page.tsx` imports `MissionEvent`/`MissionCompletion`. `PetRow`'s two new fields (`coins: number`, `last_daily_bonus_at: string | null`) are added once in `lib/pet-engine.ts` (Task 1) and both existing `makePet` fixtures (`lib/pet-engine.test.ts`, `lib/diary.test.ts`) are updated in the same task so the whole repo continues to type-check before any later task builds on it.

## Critical Files for Implementation

- `lib/pet-engine.ts` (only the `PetRow` interface is modified — read-only reference otherwise)
- `lib/missions.ts`
- `lib/missions-sync.ts`
- `app/pet/actions.ts`
- `app/pet/misiones/page.tsx`
- `supabase/schema.sql`
