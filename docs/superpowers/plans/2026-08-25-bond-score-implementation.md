# Bond Score Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution root:** all file paths below are relative to the repository root (`C:\Users\luccas\Desktop\claude-proyects\pets-forever`, or the equivalent git worktree root if this plan is executed inside one created via `superpowers:using-git-worktrees`). Run every command from that directory.

## Context

This is the first slice of the "Apego" (attachment) pillar in the app's roadmap. The roadmap's Notion board lists 13 distinct "Apego:" items; most of the rest (reciprocity gestures, personality shift, differentiated reactions, habit recognition) have nothing to attach to without a bond value existing first, so this feature scopes to only the score itself plus one tangible behavior that makes it feel real from day one: a tiered welcome-back message on `/pet`.

Three features already shipped before this one and set the architectural precedent this plan follows exactly: Pet Diary (`docs/superpowers/plans/2026-08-23-pet-diary-implementation.md`), Currency & Missions (`docs/superpowers/plans/2026-08-24-currency-missions-implementation.md`), and Casa & Tienda (`docs/superpowers/plans/2026-08-24-casa-tienda-implementation.md`). Every one of them uses the same three-layer shape — a pure `lib/*.ts` logic module with full TDD coverage, a thin `lib/*-sync.ts` I/O module that is lazy and never throws, and UI wired into Server Components — and this plan reuses that shape without modification.

The design was fully brainstormed and approved with the user ahead of this plan: `docs/superpowers/specs/2026-08-25-bond-score-design.md`. Implementation-level decisions the spec itself left open (the exact `BondTier`/message shape, the pure progression function's signature and day-by-day algorithm, how `lib/bond-sync.ts` builds its cared-for-day set) were made in the planning conversation that produced this document and are treated as **fixed requirements** below — this plan only turns them into code. One of those decisions required correcting a fencepost error discovered while working through the day-iteration algorithm in detail; see "Resolved ambiguity: the day-iteration lower bound" under Global Constraints below for the full reasoning — every other rate, threshold, and cap in the spec is implemented exactly as written, unchanged.

**Goal:** Give the user a single, legible 0-100 "Bond Score" that grows from consecutive days of real care and decays gradually (with a one-day grace period) from sustained absence, surfaced on `/pet` as its own visually-distinct section plus a tiered, presence-only welcome-back message.

**Architecture:** A pure, dependency-free logic module (`lib/bond.ts`, mirroring `lib/missions.ts`) exports `computeBondTier(score)` (score → tier/label/message) and `computeNextBondState(current, caredForDateKeys, now)` (the day-by-day growth/decay/grace-period state machine, reusing `computePeriodKey('daily', ...)` from `lib/missions.ts` for all calendar-day-key formatting). A thin I/O module (`lib/bond-sync.ts`, mirroring `lib/missions-sync.ts`) is called lazily from `/pet`'s Server Component render, no-ops immediately if already synced today, otherwise reads `mission_events`, builds the cared-for-day set, calls the pure function, and persists the result in one `pets` update. The UI adds a new `BondScore` display section (visually separate from the four need-based `StatBar` rows, since blending it in would wrongly read as "another meter that punishes neglect") and a dismissible `WelcomeBackMessage` client component to `/pet`.

**Tech Stack:** Next.js 15.5.23 (App Router, TypeScript), Supabase (Postgres + Auth via `@supabase/ssr` ^0.12.4 / `@supabase/supabase-js` ^2.112.3), Vitest ^4.1.11, npm. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-25-bond-score-design.md`

## Global Constraints

- Exact growth/decay values (approved, do not change): each cared-for UTC calendar day (a day with ≥1 `mission_events` row: `fed`, `bathed_dirty`, `played`, or `medicated`) that extends a streak grows `bond_score` by **+3**, capped at **100**. The first missed day in a row is free (no decay, streak resets to 0); from the **second** consecutive missed day onward, `bond_score` decays by **-1 per missed day**, floored at **0**.
- Cold start: a pet's first-ever sync (`last_bond_sync_date is null`) sets `last_bond_sync_date` to today, leaves `bond_score`/`bond_streak_days` at `0`, and evaluates no days at all.
- Tier boundaries and copy (exact, approved, do not change):

  | Score range | `tier` value | `label` | `message` |
  |---|---|---|---|
  | 0-24 | `'conociendose'` | `Conociéndose` | `¡Hola! Qué bueno verte 👋` |
  | 25-49 | `'cercanos'` | `Cercanos` | `¡Qué alegría verte! 😊` |
  | 50-74 | `'vinculo-fuerte'` | `Vínculo fuerte` | `¡Volviste! Esto me hace muy feliz 💛` |
  | 75-100 | `'inseparables'` | `Inseparables` | `¡Sos parte de mi día! 🥰` |

  **Hard constraint, verified explicitly in Task 2:** every message above celebrates the user's *presence in this moment* ("verte" = seeing you, "esto me hace feliz" = this makes me happy, "sos parte de mi día" = you're part of my day) and none references, implies, or hints at the user's *absence* — no "te extrañé" ("I missed you") or equivalent, in any tier, regardless of how long the user was actually away. "¡Volviste!" ("You're back!") is a neutral statement of the reunion itself, not a comment on the gap that preceded it — it does not imply waiting, longing, or guilt. This mirrors the Diary feature's own explicit anti-manipulation guardrail from its spec.
- `lib/bond.ts` stays pure: no I/O, no bare `new Date()`/`Date.now()` call without an injected `now: Date` parameter — mirrors every function signature in `lib/pet-engine.ts`/`lib/missions.ts`. All calendar-day-key formatting reuses `computePeriodKey('daily', date)` imported from `./missions` — `lib/bond.ts` never reimplements UTC year/month/day formatting itself.
- `lib/bond-sync.ts` mirrors `lib/missions-sync.ts`'s exact shape: never throws, wraps every Supabase call in try/catch, logs failures via `console.error`, called from `/pet`'s Server Component render before re-reading fresh pet state. It no-ops immediately (before querying `mission_events` at all) if `pet.last_bond_sync_date` already equals today's date-key.
- No new database table. Three new columns on `pets`: `bond_score smallint not null default 0`, `bond_streak_days smallint not null default 0`, `last_bond_sync_date date`. `mission_events` (already logging every care action, shipped by Currency & Missions) is the sole data source for which calendar days were "cared-for" — this feature adds no new event-logging responsibility anywhere in `app/pet/actions.ts`.
- The bond score UI is a new section within the existing `/pet` card (same route, not a separate page), visually distinct from the four `StatBar` rows — it must not reuse the `StatBar` component, since `StatBar`'s color scale communicates a "needs attention" semantic this feature explicitly wants to avoid. The welcome-back message is a separate, dismissible element that does not block interaction with the rest of the page.
- Testing philosophy (established, do not deviate): `lib/bond.ts` (pure logic) gets full TDD Vitest coverage in this plan's Task 2. `lib/bond-sync.ts` (I/O) and the UI components get **no automated tests** — verified only via `npm run build` plus the manual/live-Supabase verification in Task 5, exactly like `lib/missions-sync.ts`/`lib/diary-sync.ts` and every prior feature's I/O layer.
- `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) is gitignored and does not exist in a fresh worktree — Task 5's live-Supabase verification requires it to already be present in the working directory (copy it in manually if executing this plan from a fresh worktree; it is not part of this plan's file changes).
- Package manager: npm. Tests: `npx vitest run` / `npm run test`.

**Resolved ambiguity: the day-iteration lower bound.** The pure progression function must decide, for a pet visited once every calendar day (the app's primary usage pattern), which calendar days get evaluated. `lib/bond-sync.ts` always advances `last_bond_sync_date` to *today* at the end of every sync call — this is required so the "no-op if already synced today" check works at all. That means the calendar day on which any given sync call runs is never evaluated by that call ("today itself is never evaluated — it isn't over yet"). If a later call's day-iteration started **strictly after** the stored `last_bond_sync_date`, then for a user who opens the app exactly once per calendar day, `last_bond_sync_date` would always be exactly "yesterday" relative to each new visit — an empty iteration range, every single time, forever — and `bond_score` could never grow above its cold-start value of `0` for the app's single most common usage pattern. `computeNextBondState` (Task 2) instead starts its iteration **inclusively at** `last_bond_sync_date` and walks forward through (and including) yesterday relative to `now`. This is the only change from a naive reading of the day-boundary rule; every rate, cap, floor, grace-period rule, cold-start rule, and the function's exact signature are otherwise implemented precisely as specified above. Task 2 includes a dedicated regression test (`Step 5`'s daily-chain test) that simulates three consecutive once-a-day sync calls and asserts the score actually grows — this is the test that would fail under the naive "strictly after" boundary and is the concrete proof this fix is correct.

---

### Task 1: Schema + `PetRow` type update

**Files:**
- Modify: `supabase/schema.sql` (append only)
- Modify: `lib/pet-engine.ts` (extend `PetRow`)
- Modify: `lib/pet-engine.test.ts` (extend `makePet` fixture)
- Modify: `lib/diary.test.ts` (extend its separate `makePet` fixture)

**Interfaces:**
- Consumes: nothing.
- Produces: `bond_score`/`bond_streak_days`/`last_bond_sync_date` columns on `pets` in the real Supabase project (consumed by `lib/bond-sync.ts` in Task 3); the extended `PetRow` interface (consumed by `lib/bond-sync.ts` in Task 3 and `app/pet/page.tsx` in Task 4).

- [ ] **Step 1: Append the new schema block to `supabase/schema.sql`**

Append to the end of `supabase/schema.sql` (do not touch any existing content above it):

```sql

-- --- Bond Score: trust/attachment score derived from daily care streaks (added 2026-08-25) ---
-- Every table/column above this point is already live in the Supabase project.
-- Run ONLY the block below (SQL Editor > New query > Run) — do not re-run the whole file.
-- `add column if not exists` makes this safe to run even if it was partially applied already.

alter table pets add column if not exists bond_score smallint not null default 0;
alter table pets add column if not exists bond_streak_days smallint not null default 0;
alter table pets add column if not exists last_bond_sync_date date;
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
  coins: number;
  last_daily_bonus_at: string | null;
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
  bond_score: number;
  bond_streak_days: number;
  last_bond_sync_date: string | null;
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
    coins: 0,
    last_daily_bonus_at: null,
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
    bond_score: 0,
    bond_streak_days: 0,
    last_bond_sync_date: null,
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
    coins: 0,
    last_daily_bonus_at: null,
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
    bond_score: 0,
    bond_streak_days: 0,
    last_bond_sync_date: null,
    ...overrides,
  };
}
```

- [ ] **Step 5: Run the full test suite, verify everything still passes**

Run: `npm run test`
Expected: every existing suite passes with the updated fixtures — `lib/pet-engine.test.ts`, `lib/diary.test.ts`, `lib/missions.test.ts`, `lib/items.test.ts`, `lib/gemini-client.test.ts`, `lib/onboarding-orchestration.test.ts`, `lib/validate-photo-files.test.ts`. No TypeScript errors about missing `PetRow` fields — this is the whole point of updating both fixtures together in the same task.

- [ ] **Step 6: Manually run only the new SQL against the real Supabase project**

Open the Supabase Dashboard for this project → SQL Editor → New query → paste **only** the new block from Step 1 (from `-- --- Bond Score:` down to the final `alter table` line) → Run.

Expected: "Success. No rows returned." Then check Table Editor: the `pets` table now has `bond_score` (smallint, default `0`, not null), `bond_streak_days` (smallint, default `0`, not null), and `last_bond_sync_date` (date, nullable) columns.

- [ ] **Step 7: Commit**

```bash
git add supabase/schema.sql lib/pet-engine.ts lib/pet-engine.test.ts lib/diary.test.ts
git commit -m "feat: add bond score schema and extend PetRow with bond fields"
```

---

### Task 2: `lib/bond.ts` — pure logic (TDD)

This is the centerpiece of the whole feature — the day-by-day growth/decay/grace-period algorithm needs to be exactly right, including the fencepost fix documented in Global Constraints above. Follow strict RED-then-GREEN TDD: write each stage's tests first, watch them fail for the right reason, then implement.

**Files:**
- Create: `lib/bond.ts`
- Create: `lib/bond.test.ts`

**Interfaces:**
- Consumes: `computePeriodKey(period: MissionPeriod, now: Date): string` from `./missions` (existing, produced by the Currency & Missions feature).
- Produces: `BondTier` type, `BondTierInfo` interface, `computeBondTier(score: number): BondTierInfo`, `BondState` interface, `computeNextBondState(current: BondState, caredForDateKeys: Set<string>, now: Date): BondState` — consumed by `lib/bond-sync.ts` (Task 3) and `app/pet/page.tsx` (Task 4).

- [ ] **Step 1: Write failing tests for `computeBondTier`**

Create `lib/bond.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run lib/bond.test.ts`
Expected: FAIL — `./bond` module not found.

- [ ] **Step 3: Implement `BondTier`, `BondTierInfo`, and `computeBondTier` in `lib/bond.ts`**

Create `lib/bond.ts`:
```typescript
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

export function computeBondTier(score: number): BondTierInfo {
  const definition = BOND_TIERS.find((t) => score >= t.min && score <= t.max) ?? BOND_TIERS[0];
  return { tier: definition.tier, label: definition.label, message: definition.message };
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run lib/bond.test.ts`
Expected: all `computeBondTier` tests PASS (5 tests).

- [ ] **Step 5: Append failing tests for `computeNextBondState`**

Append to `lib/bond.test.ts`:
```typescript
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
});
```

- [ ] **Step 6: Run tests, verify the new suite fails**

Run: `npx vitest run lib/bond.test.ts`
Expected: earlier `computeBondTier` tests still PASS; `computeNextBondState` tests FAIL — not exported (and `BondState` type not found).

- [ ] **Step 7: Implement `BondState` and `computeNextBondState` in `lib/bond.ts`**

Append to `lib/bond.ts`:
```typescript
export const BOND_SCORE_MIN = 0;
export const BOND_SCORE_MAX = 100;
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
```

- [ ] **Step 8: Run tests, verify they pass**

Run: `npx vitest run lib/bond.test.ts`
Expected: all tests PASS (14 tests: 5 `computeBondTier` + 9 `computeNextBondState`).

- [ ] **Step 9: Run the whole repo's test suite as a sanity check**

Run: `npm run test`
Expected: every suite passes, including `lib/bond.test.ts`'s 14 tests alongside `lib/pet-engine.test.ts`, `lib/diary.test.ts`, `lib/missions.test.ts`, `lib/items.test.ts`, `lib/gemini-client.test.ts`, `lib/onboarding-orchestration.test.ts`, and `lib/validate-photo-files.test.ts`.

- [ ] **Step 10: Commit**

```bash
git add lib/bond.ts lib/bond.test.ts
git commit -m "feat: add pure bond score tier/progression logic with day-by-day TDD coverage"
```

---

### Task 3: I/O layer — `lib/bond-sync.ts`

**Files:**
- Create: `lib/bond-sync.ts`

**Interfaces:**
- Consumes: `createClient()` from `./supabase/server`; `computeNextBondState`, `type BondState` from `./bond` (Task 2); `computePeriodKey`, `type MissionEvent` from `./missions` (existing); `type PetRow` from `./pet-engine` (Task 1).
- Produces: `syncBondScore(pet: PetRow): Promise<void>` (no `'use server'` — called from a Server Component in Task 4, never throws).

- [ ] **Step 1: Implement the bond score sync function**

Create `lib/bond-sync.ts`:
```typescript
import { createClient } from './supabase/server';
import { computeNextBondState } from './bond';
import { computePeriodKey, type MissionEvent } from './missions';
import type { PetRow } from './pet-engine';

// Lazy sync: advances bond_score/bond_streak_days/last_bond_sync_date by
// however many full UTC calendar days have elapsed since the pet's last
// sync, based on which of those days had at least one mission_events row.
// Never throws — a failure here must not break page render. Mirrors
// lib/missions-sync.ts's syncMissionsAndDailyBonus exactly in shape.
//
// No-ops immediately, before querying mission_events at all, if
// last_bond_sync_date already equals today's UTC date-key — this is the
// common case (at most one real sync per pet per day) and matches the
// design spec's explicit "no-ops immediately... on same-day repeat visits"
// requirement.
//
// mission_events is read unbounded per pet (select('*').eq('pet_id', ...)
// with no date filter), matching the same precedent already established by
// syncMissionsAndDailyBonus — this app's mission_events table does not grow
// large enough per pet to make that a real concern, and computeNextBondState
// only ever walks days from last_bond_sync_date forward, so any older rows
// in the result are harmless, unused input.
export async function syncBondScore(pet: PetRow): Promise<void> {
  try {
    const now = new Date();
    const todayKey = computePeriodKey('daily', now);

    if (pet.last_bond_sync_date === todayKey) return;

    const supabase = await createClient();

    const { data: eventsData, error: eventsError } = await supabase
      .from('mission_events')
      .select('*')
      .eq('pet_id', pet.id);

    if (eventsError) {
      console.error('syncBondScore: failed to load mission events', eventsError);
      return;
    }

    const events = (eventsData ?? []) as MissionEvent[];
    const caredForDateKeys = new Set(events.map((e) => computePeriodKey('daily', new Date(e.occurred_at))));

    const next = computeNextBondState(
      {
        bondScore: pet.bond_score,
        streakDays: pet.bond_streak_days,
        lastSyncDate: pet.last_bond_sync_date,
      },
      caredForDateKeys,
      now
    );

    const { error: updateError } = await supabase
      .from('pets')
      .update({
        bond_score: next.bondScore,
        bond_streak_days: next.streakDays,
        last_bond_sync_date: next.lastSyncDate,
      })
      .eq('id', pet.id);

    if (updateError) {
      console.error('syncBondScore: failed to update bond score', updateError);
    }
  } catch (err) {
    console.error('syncBondScore: unexpected error syncing bond score', err);
  }
}
```

- [ ] **Step 2: Verify the project still type-checks and builds**

Run: `npm run build`
Expected: build succeeds with no TypeScript/ESLint errors. `syncBondScore` is not called from anywhere yet (that's Task 4) — an unused exported function is not a build error in this project's `tsconfig.json` (no `noUnusedLocals`), so this is expected to build clean on its own.

- [ ] **Step 3: Commit**

```bash
git add lib/bond-sync.ts
git commit -m "feat: add lazy bond score sync I/O layer"
```

---

### Task 4: UI — bond score section + welcome-back message on `/pet`

**Files:**
- Create: `app/pet/BondScore.tsx`
- Create: `app/pet/WelcomeBackMessage.tsx`
- Modify: `app/pet/page.tsx`

**Interfaces:**
- Consumes: `syncBondScore` from `../../lib/bond-sync` (Task 3); `computeBondTier`, `type BondTierInfo` from `../../lib/bond` (Task 2); `syncMissionsAndDailyBonus` (existing); `computeCurrentStats`, `computeIsSick`, `computeLifeStage`, `computeMood`, `type PetRow` (existing); `createClient()` (existing).
- Produces: the `BondScore` component (`{ score: number; tierLabel: string }` props); the `WelcomeBackMessage` client component (`{ message: string }` props); both rendered on `/pet`.

- [ ] **Step 1: Create the `BondScore` display component**

Create `app/pet/BondScore.tsx`:
```tsx
// Deliberately its own small section, not a fifth StatBar row: StatBar's
// red/yellow/green scale communicates "needs attention", which is exactly
// the wrong read for a relationship-depth indicator that should never
// punish the user for leaving it alone. Purple/violet is used here
// specifically because it doesn't appear in StatBar's need-urgency palette.
export function BondScore({ score, tierLabel }: { score: number; tierLabel: string }) {
  return (
    <div className="space-y-1.5 rounded-2xl border-2 border-[#8B5CF6]/30 bg-[#F3EEFF] px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[#5B3FA6]">💜 Vínculo</span>
        <span className="rounded-full bg-[#8B5CF6] px-2 py-0.5 text-xs font-bold text-white">{tierLabel}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/70 ring-1 ring-inset ring-[#8B5CF6]/20">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#C9A7FF] to-[#8B5CF6] transition-all"
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-right text-xs font-semibold text-[#5B3FA6]/70">{score}/100</p>
    </div>
  );
}
```

- [ ] **Step 2: Create the dismissible `WelcomeBackMessage` client component**

Create `app/pet/WelcomeBackMessage.tsx`:
```tsx
'use client';

import { useState } from 'react';

// Renders once per page load (a fresh mount is a fresh `dismissed` state)
// and never blocks interaction with the rest of the page — dismissing it is
// purely local UI state, not persisted anywhere.
export function WelcomeBackMessage({ message }: { message: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-[#8B5CF6]/30 bg-[#F3EEFF] px-4 py-3">
      <p className="text-sm font-semibold text-[#5B3FA6]">{message}</p>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 rounded-full bg-white/70 px-2 py-1 text-xs font-bold text-[#5B3FA6] ring-1 ring-inset ring-[#8B5CF6]/20"
      >
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Wire both into `app/pet/page.tsx`**

Replace the entire contents of `app/pet/page.tsx` with:
```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { syncMissionsAndDailyBonus } from '@/lib/missions-sync';
import { syncBondScore } from '@/lib/bond-sync';
import { computeBondTier } from '@/lib/bond';
import {
  computeCurrentStats,
  computeIsSick,
  computeLifeStage,
  computeMood,
  type PetRow,
} from '@/lib/pet-engine';
import { StatBar } from './StatBar';
import { ActionButtons } from './ActionButtons';
import { BondScore } from './BondScore';
import { WelcomeBackMessage } from './WelcomeBackMessage';

export default async function PetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) redirect('/onboarding');

  // Both syncs run before re-reading the pet row below so this visit's daily
  // bonus, mission payout, and bond score update all show up immediately.
  await syncMissionsAndDailyBonus(pet as PetRow);
  await syncBondScore(pet as PetRow);

  const { data: freshPet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  const petRow = (freshPet ?? pet) as PetRow;

  const now = new Date();
  const stats = computeCurrentStats(petRow, now);
  const isSick = computeIsSick(petRow, now);
  const lifeStage = computeLifeStage(new Date(petRow.created_at), now);
  const mood = computeMood(stats, isSick, petRow.is_sleeping);
  const bondTier = computeBondTier(petRow.bond_score);

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
              href="/pet/casa"
              className="rounded-full bg-[#F0DEB4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20"
            >
              🏠 Casa
            </Link>
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

        <WelcomeBackMessage message={bondTier.message} />

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

        <BondScore score={petRow.bond_score} tierLabel={bondTier.label} />

        {lifeStage !== 'egg' && <ActionButtons isSleeping={petRow.is_sleeping} isSick={isSick} />}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify the project builds**

Run: `npm run build`
Expected: build succeeds with no TypeScript/ESLint errors.

This task deliberately **skips any live browser smoke-test step** — verifying `/pet` renders the bond section and welcome-back message correctly against a real logged-in user/real Supabase data is deferred to Task 5, matching how the missions and diary plans' UI tasks handled this same situation (the person/agent executing this plan may not have working browser tooling mid-task).

- [ ] **Step 5: Commit**

```bash
git add app/pet/BondScore.tsx app/pet/WelcomeBackMessage.tsx app/pet/page.tsx
git commit -m "feat: show bond score section and welcome-back message on /pet"
```

---

### Task 5: End-to-end manual verification against the real Supabase project

This app has no local Supabase CLI/Docker, so everything touching real Postgres is verified manually here rather than via automated tests, per the app's established testing approach. No code changes are expected in this task; if a check below surfaces a bug, fix it and commit that fix separately using the same `git add` + `git commit` convention as the tasks above.

- [ ] **Step 1: Run the full automated suite**

Run: `npm run test`
Expected: every Vitest suite passes, including `lib/bond.test.ts`'s 14 tests alongside `lib/pet-engine.test.ts`, `lib/diary.test.ts`, `lib/missions.test.ts`, `lib/items.test.ts`, `lib/gemini-client.test.ts`, `lib/onboarding-orchestration.test.ts`, and `lib/validate-photo-files.test.ts`.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: succeeds with no TypeScript/ESLint errors.

- [ ] **Step 3: Confirm the schema change is live** (repeats Task 1 Step 6 as a final sanity check)

In the Supabase Dashboard → Table Editor: confirm `pets` has `bond_score` (smallint, default `0`), `bond_streak_days` (smallint, default `0`), and `last_bond_sync_date` (date, nullable) columns.

- [ ] **Step 4: Verify cold start on a fresh pet**

Ensure `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) is present in the working directory (gitignored, not part of this plan's file changes — copy it in if running from a fresh worktree). `npm run dev`, sign up as a brand-new test user and complete onboarding to create a fresh pet. Load `/pet`. Expected: the "💜 Vínculo" section shows `0/100` with the "Conociéndose" badge, and the welcome-back message reads "¡Hola! Qué bueno verte 👋". In Table Editor → `pets`, confirm this pet's row now has `last_bond_sync_date` set to today's date (UTC), with `bond_score` and `bond_streak_days` both still `0`.

- [ ] **Step 5: Verify the welcome-back message is dismissible and non-blocking**

On the same `/pet` load, click the "✕" button on the welcome-back message. Expected: it disappears immediately and the rest of the page (stat bars, sprite, action buttons) remains fully interactive throughout — nothing was blocked while the message was showing. Reload the page. Expected: the message reappears (dismissal is not persisted — it's per page load, as specified).

- [ ] **Step 6: Verify same-day repeat visits do not change the score**

Note the exact `bond_score`/`bond_streak_days`/`last_bond_sync_date` values for the test pet from Step 4 in Table Editor. Reload `/pet` several times in a row (same UTC calendar day, no waiting). Expected: all three values are unchanged across every reload — `syncBondScore`'s "already synced today" no-op guard is working.

- [ ] **Step 7: Verify growth after a genuinely cared-for day**

This step requires either waiting for the next UTC calendar day or, faster, manually backdating `last_bond_sync_date` in Table Editor: for the test pet, set `last_bond_sync_date` to yesterday's UTC date, and in the `mission_events` table confirm at least one row exists for this pet with `occurred_at` on yesterday's UTC date (perform a Feed/Bathe/Play action first if not — see the Currency & Missions feature's care actions on `/pet`). Reload `/pet`. Expected: `bond_score` increased by exactly `3`, `bond_streak_days` increased by exactly `1`, `last_bond_sync_date` is now today's UTC date, and the "💜 Vínculo" bar/label reflect the new score (still "Conociéndose" if under 25).

- [ ] **Step 8: Verify the tier badge and welcome-back message change together as the score crosses a boundary**

In Table Editor, directly set the test pet's `bond_score` to `25` (a `cercanos` boundary value) and `last_bond_sync_date` to today's UTC date (so no sync runs and overwrites it). Reload `/pet`. Expected: the badge now reads "Cercanos" and the welcome-back message reads "¡Qué alegría verte! 😊". Repeat by setting `bond_score` to `50` (expect "Vínculo fuerte" / "¡Volviste! Esto me hace muy feliz 💛") and then `75` (expect "Inseparables" / "¡Sos parte de mi día! 🥰"), reloading and confirming both the badge and the message after each change.

- [ ] **Step 9: Verify decay after a missed day, including the one-day grace period**

In Table Editor, set the test pet's `bond_score` to `20`, `bond_streak_days` to `0`, and `last_bond_sync_date` to 3 UTC calendar days ago. Ensure no `mission_events` rows exist for this pet in that 3-day window (delete any if present, or use a different, untouched test pet). Reload `/pet`. Expected: exactly 2 missed days are evaluated (the day matching the old `last_bond_sync_date` and the day after it) — the first is free, the second decays by `1` — so `bond_score` is now `19`, `bond_streak_days` is `0`, and `last_bond_sync_date` is today's UTC date.

- [ ] **Step 10: Verify RLS still isolates bond fields across accounts**

The three new `pets` columns are covered by the table's existing row-level security (RLS is per-row, not per-column, so no new policy was needed — confirmed in Table Editor → `pets` → RLS Policies, the pre-existing "Users manage their own pet" style policy is still listed and enabled). Confirm functionally: log in as a second, different test user with their own pet, load `/pet`, and confirm their bond score section reflects only their own pet's `bond_score` — no leakage from the first test user's pet.

---

## Self-Review

**Spec coverage:** every section of `docs/superpowers/specs/2026-08-25-bond-score-design.md` maps to a task. "Behavior: Growth" (+3/day, capped 100) → Task 2's `BOND_SCORE_GROWTH_PER_CARED_FOR_DAY`/`BOND_SCORE_MAX` and the "single cared-for day"/"caps growth at 100" tests. "Behavior: Decay" (first miss free, -1/day floored at 0 from the 2nd miss) → Task 2's `previousDayWasCaredFor` grace-period logic and the "first missed day"/"second consecutive"/"long absence floored at 0" tests. "Cold start" → Task 2's `lastSyncDate === null` branch and its dedicated test. "Welcome-back message" (tiered, dismissible, non-blocking) → Task 4's `WelcomeBackMessage` component + Task 5 Steps 5/8. The tier table and the hard "presence, never absence" copy constraint → Task 2's `BOND_TIERS` catalog and its explicit forbidden-pattern test. "Data Model" (3 new `pets` columns, no new table) → Task 1's schema block. "`lib/bond.ts` pure / `lib/bond-sync.ts` I/O, lazy, mirrors `lib/missions.ts`/`lib/missions-sync.ts`" → Task 2 and Task 3 respectively. "UI: own small section, not a fifth StatBar row" → Task 4's `BondScore` component and its comment explaining why it doesn't reuse `StatBar`.

**Placeholder scan:** no TBDs; every step has complete, runnable code (full file contents or exact before/after snippets) or an explicit manual-verification procedure with concrete expected values. The one deliberate design deviation (the day-iteration lower bound) is fully implemented as real code in Task 2, not left as a note — the Global Constraints section documents *why*, Task 2 documents *what*, and Task 2 Step 5's regression test proves it.

**Type consistency:** `BondTier`, `BondTierInfo`, `BondState` are defined once in `lib/bond.ts` (Task 2) and re-imported with identical shapes everywhere else — `lib/bond-sync.ts` imports `computeNextBondState` and constructs a `BondState`-shaped object inline from `PetRow`'s snake_case fields; `app/pet/page.tsx` imports `computeBondTier` and passes its `BondTierInfo.message`/`.label` straight through to `WelcomeBackMessage`/`BondScore`'s props. `PetRow`'s three new fields (`bond_score: number`, `bond_streak_days: number`, `last_bond_sync_date: string | null`) are added once in `lib/pet-engine.ts` (Task 1) and both existing `makePet` fixtures (`lib/pet-engine.test.ts`, `lib/diary.test.ts`) are updated in the same task so the whole repo continues to type-check before any later task builds on it. `syncBondScore(pet: PetRow): Promise<void>`'s signature (Task 3) matches exactly how it's called in Task 4 (`await syncBondScore(pet as PetRow)`), mirroring `syncMissionsAndDailyBonus`'s call convention already on that same line.

## Critical Files for Implementation

- `lib/pet-engine.ts` (only the `PetRow` interface is modified — read-only reference otherwise)
- `lib/missions.ts` (only `computePeriodKey` is consumed — read-only reference, not modified)
- `lib/bond.ts`
- `lib/bond-sync.ts`
- `app/pet/BondScore.tsx`
- `app/pet/WelcomeBackMessage.tsx`
- `app/pet/page.tsx`
- `supabase/schema.sql`
