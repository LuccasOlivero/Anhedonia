# Tamagotchi Clone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Context

The user wants a web clone of a classic color Tamagotchi built with Next.js + TypeScript + Supabase, where onboarding uses AI (Gemini's "nano-banana" image model) to turn photos of the user's real pet into a set of virtual-pet sprites. This was fully brainstormed and approved through the `superpowers:brainstorming` skill: every mechanic (stat decay, sickness instead of death, egg→baby→adult life stages, one pet per account, simple play button instead of a mini-game) was chosen explicitly by the user across a sequence of design questions, then written up and self-reviewed as a spec at `docs/superpowers/specs/2026-08-21-tamagotchi-clone-design.md`. The user then asked to proceed straight to the implementation plan.

The repo is currently a brand-new, empty Next.js project (git initialized, one commit containing only the spec — confirmed via exploration: no `package.json`, no `node_modules`, no existing app code, no conflicting conventions in any `CLAUDE.md`/`AGENTS.md`). This plan builds the entire app from scratch.

One scope adjustment was made during planning (confirmed with the user): the spec's original "integration tests against a local Supabase CLI instance" idea is dropped because the user doesn't have Docker set up. Instead, all pure/orchestration logic (the pet engine and the onboarding retry/fallback logic) gets exhaustive Vitest unit tests with no mocking needed, and everything that touches real Supabase/Gemini I/O is verified manually in the browser against a real cloud Supabase project, with an explicit manual-verification step built into the relevant tasks.

**Goal:** Build a from-scratch Next.js 15 + TypeScript + Supabase web app where a user photographs their real pet, gets 6 AI-generated sprite states from Gemini, and cares for the resulting virtual pet with stats that decay over real elapsed time.

**Architecture:** Server Components read Supabase and run pure `lib/pet-engine.ts` functions to project current stats/mood on every page load; Server Actions are the only write path to Postgres/Storage; the Gemini API key and all Supabase writes stay server-side. Onboarding is the one place the two subsystems (pet engine + Gemini) meet, orchestrated by a retry/fallback layer that is unit-testable without any network access.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Supabase (Postgres + Auth + Storage), `@google/genai` (Gemini `gemini-2.5-flash-image`), Vitest, npm, deployed on Vercel.

**Spec:** `docs/superpowers/specs/2026-08-21-tamagotchi-clone-design.md`

## Global Constraints

- Next.js 15, App Router, TypeScript. Supabase for Postgres/Auth (email+password)/Storage. Gemini API model `gemini-2.5-flash-image`, called only from server-side code.
- `GEMINI_API_KEY` lives only in server environment variables and is never referenced from a Client Component.
- One active pet per account is enforced by `user_id unique` on the `pets` table — no application-level duplicate-pet check is needed, only routing-level redirects for UX.
- No `is_sick` or `life_stage` columns in the schema — both are derived at read time by pure functions from `created_at`, `last_updated_at`, and the four stat columns.
- Non-goals (do not build): multiple pets per user, pet death, mini-games, social/multiplayer features, push notifications, device-shell skeuomorphic UI.
- Photo upload: 1-3 files, `image/*`, max 5MB each, client-side validated with a preview before submit.
- Onboarding generates 6 sprite states (`happy, sad, eating, sleeping, dirty, sick`) in parallel; a state that fails generation after 2 retries falls back to a bundled placeholder SVG at `public/fallback-sprites/{state}.svg`; if all 6 ultimately fail to persist, the action returns `{ error }` and no `pets` row is created.
- Server Actions catch Supabase errors and return `{ error: string }` rather than throwing.
- Business-rule violations (`play` while sleeping, `medicine` while not sick) are re-validated inside the Server Action itself, never trusted to client-side hiding alone.
- Package manager: npm (no pnpm/yarn assumptions). No Docker, no local Supabase CLI instance — Supabase is a real cloud project the user creates manually; all Supabase I/O (inserts, storage uploads, RLS) is verified manually in the browser, not via automated tests.
- Vitest covers `lib/pet-engine.ts` (pure, deterministic, no mocking) and orchestration/validation logic with mocked I/O (`lib/onboarding-orchestration.ts`, `lib/gemini-client.ts`, `lib/validate-photo-files.ts`). No integration tests against a database.

---

### Task 1: Project Scaffold + Vitest Setup

**Files:**
- Create: entire Next.js scaffold via `create-next-app` (`package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `tailwind.config.ts` or `postcss.config.mjs` depending on scaffold version, `eslint.config.mjs`, `.gitignore`, `public/`)
- Create: `vitest.config.ts`
- Create: `.env.local.example`
- Modify: `package.json` (add `test` script)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a runnable Next.js 15 app (`npm run dev`, `npm run build`) and a working `npx vitest run` command that later tasks add real tests to.

- [ ] **Step 1: Scaffold the Next.js app in the existing repo root**

Run (this repo already has `.git/`, `docs/` — `create-next-app` treats these as safe pre-existing entries and will not refuse a non-empty directory for them):

```bash
npx --yes create-next-app@15 . --typescript --eslint --tailwind --app --no-src-dir --import-alias "@/*" --use-npm
```

If it errors about a non-empty directory, scaffold into a sibling temp folder and move the generated files (except `.git`) into the repo root instead:
```bash
npx --yes create-next-app@15 ../pets-forever-scaffold --typescript --eslint --tailwind --app --no-src-dir --import-alias "@/*" --use-npm
```
then copy its contents (excluding any `.git`) into this repo root.

- [ ] **Step 2: Verify the scaffold**

Run: `ls`
Expected: `package.json`, `app/`, `public/`, `tsconfig.json`, `next.config.ts` (or `.js`), `.gitignore` are present. Open `package.json` and confirm `"next": "15.x.x"`.

- [ ] **Step 3: Verify the dev server boots**

Run: `npm run dev` in the background, wait a few seconds, then `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`.
Expected: `200`. Stop the dev server afterward.

- [ ] **Step 4: Verify production build works**

Run: `npm run build`
Expected: build completes with no TypeScript/ESLint errors.

- [ ] **Step 5: Install Vitest and configure it**

```bash
npm install -D vitest
```

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', '.next'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

Add to `package.json` `"scripts"`:
```json
"test": "vitest run"
```

- [ ] **Step 6: Verify Vitest is wired up (no tests exist yet)**

Run: `npx vitest run`
Expected: exits reporting "No test files found" — this confirms the config loads without error. Real tests arrive in Task 3.

- [ ] **Step 7: Add the env var template**

Create `.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GEMINI_API_KEY=
```

Confirm `.gitignore` already contains `.env*.local` (create-next-app adds this by default) so real secrets are never committed. If it's missing, add it.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json app public tsconfig.json next.config.ts eslint.config.mjs .gitignore vitest.config.ts .env.local.example
git commit -m "chore: scaffold Next.js 15 app with TypeScript, Tailwind, and Vitest"
```

---

### Task 2: Supabase Clients, Schema, and Auth Middleware

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`
- Create: `middleware.ts` (repo root)
- Create: `supabase/schema.sql`

**Interfaces:**
- Consumes: nothing new.
- Produces: `createClient()` (browser, from `lib/supabase/client.ts`), `async createClient()` (server, from `lib/supabase/server.ts`) — both used by every later Server Component/Action; `updateSession(request: NextRequest)` from `lib/supabase/middleware.ts`.

- [ ] **Step 1: Install Supabase packages**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Create the browser Supabase client**

Create `lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Create the server Supabase client**

Create `lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render; middleware.ts refreshes
            // the session cookie on the next request instead.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 4: Create the session-refresh middleware helper**

Create `lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}
```

- [ ] **Step 5: Wire the root middleware**

Create `middleware.ts` at the repo root:
```typescript
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

- [ ] **Step 6: Write the schema + RLS SQL for the human to run**

Create `supabase/schema.sql`:
```sql
-- Run this entire file in the Supabase Dashboard: SQL Editor > New query > Run.
-- Prerequisite: create two Storage buckets first (Dashboard > Storage > New bucket):
--   pet-photos   (leave "Public bucket" OFF)
--   pet-sprites  (turn "Public bucket" ON)

create table if not exists pets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  name text not null,
  created_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  hunger smallint not null default 100,
  happiness smallint not null default 100,
  energy smallint not null default 100,
  cleanliness smallint not null default 100,
  is_sleeping boolean not null default false,
  sprites jsonb not null default '{}'::jsonb
);

alter table pets enable row level security;

create policy "Users manage their own pet"
  on pets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users upload their own pet photos"
  on storage.objects for insert
  with check (
    bucket_id = 'pet-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users read their own pet photos"
  on storage.objects for select
  using (
    bucket_id = 'pet-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users upload their own pet sprites"
  on storage.objects for insert
  with check (
    bucket_id = 'pet-sprites'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Anyone can read pet sprites"
  on storage.objects for select
  using (bucket_id = 'pet-sprites');
```

- [ ] **Step 7: Manual setup — create the real Supabase project (human step, no CLI)**

1. Go to supabase.com, create a free project (this step is manual — do not attempt to automate it).
2. Dashboard > Project Settings > API: copy "Project URL" into `NEXT_PUBLIC_SUPABASE_URL` and the `anon` "public" key into `NEXT_PUBLIC_SUPABASE_ANON_KEY` in a real `.env.local` (copy `.env.local.example` to `.env.local` first — it's gitignored).
3. Dashboard > Storage > New bucket: create `pet-photos` (public OFF) and `pet-sprites` (public ON).
4. Dashboard > SQL Editor > New query: paste the full contents of `supabase/schema.sql` and click Run.
5. Dashboard > Authentication > Providers > Email: toggle **off** "Confirm email" for convenient local dev sign-in without clicking a confirmation link.
6. Go to aistudio.google.com, create a Gemini API key, paste it into `GEMINI_API_KEY` in `.env.local`.

- [ ] **Step 8: Verify the app still builds with the new imports**

Run: `npm run build`
Expected: succeeds with no TypeScript errors (the `!` non-null assertions on env vars are fine at build time; they only throw at runtime if unset).

- [ ] **Step 9: Commit**

```bash
git add lib/supabase middleware.ts supabase/schema.sql
git commit -m "feat: add Supabase browser/server clients, auth middleware, and schema SQL"
```

---

### Task 3: Pet Engine — Decay and Life Stage

**Files:**
- Create: `lib/pet-engine.ts`
- Test: `lib/pet-engine.test.ts`

**Interfaces:**
- Consumes: nothing (pure module, no dependency on Tasks 1-2 code).
- Produces: `SpriteState`, `Stats`, `PetRow`, `LifeStage` types; `DECAY_PER_HOUR`, `ENERGY_REGEN_PER_HOUR_SLEEPING`, `SICK_THRESHOLD_HOURS`, `LIFE_STAGE_DAYS` constants; `clamp(n: number): number`; `computeLifeStage(createdAt: Date, now: Date): LifeStage`; `computeCurrentStats(pet: PetRow, now: Date): Stats`. `PetRow` is the hand-maintained canonical shape of the `pets` table from Task 2's SQL — no Supabase type generation is used anywhere in this project since the local Supabase CLI is intentionally out of scope.

- [ ] **Step 1: Write failing tests for `clamp`, `computeLifeStage`, and `computeCurrentStats`**

Create `lib/pet-engine.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run lib/pet-engine.test.ts`
Expected: FAIL — `./pet-engine` module not found.

- [ ] **Step 3: Implement `clamp` and `computeLifeStage`**

Create `lib/pet-engine.ts`:
```typescript
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
}

export const DECAY_PER_HOUR = {
  hunger: 100 / 24,
  happiness: 100 / 48,
  energy: 100 / 16,
  cleanliness: 100 / 30,
} as const;

export const ENERGY_REGEN_PER_HOUR_SLEEPING = 100 / 8;
export const SICK_THRESHOLD_HOURS = 24;
export const LIFE_STAGE_DAYS = { egg: 2, baby: 5 } as const;

export function clamp(n: number): number {
  return Math.min(100, Math.max(0, n));
}

export function computeLifeStage(createdAt: Date, now: Date): LifeStage {
  const elapsedDays = (now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000);
  if (elapsedDays < LIFE_STAGE_DAYS.egg) return 'egg';
  if (elapsedDays < LIFE_STAGE_DAYS.baby) return 'baby';
  return 'adult';
}
```

- [ ] **Step 4: Run tests, verify `clamp`/`computeLifeStage` tests pass (and `computeCurrentStats` import errors)**

Run: `npx vitest run lib/pet-engine.test.ts`
Expected: `clamp` and `computeLifeStage` tests PASS; remaining failures are about `computeCurrentStats` not being exported yet.

- [ ] **Step 5: Add failing tests for `computeCurrentStats`**

Append to `lib/pet-engine.test.ts`:
```typescript
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
```

- [ ] **Step 6: Run tests, verify they fail**

Run: `npx vitest run lib/pet-engine.test.ts`
Expected: FAIL — `computeCurrentStats` is not exported.

- [ ] **Step 7: Implement `computeCurrentStats`**

Append to `lib/pet-engine.ts`:
```typescript
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
```

- [ ] **Step 8: Run tests, verify all pass**

Run: `npx vitest run lib/pet-engine.test.ts`
Expected: all tests PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/pet-engine.ts lib/pet-engine.test.ts
git commit -m "feat: add pet engine decay and life-stage calculations"
```

---

### Task 4: Pet Engine — Sickness

**Files:**
- Modify: `lib/pet-engine.ts`
- Modify: `lib/pet-engine.test.ts`

**Interfaces:**
- Consumes: `PetRow`, `Stats`, `DECAY_PER_HOUR`, `LIFE_STAGE_DAYS`, `SICK_THRESHOLD_HOURS`, `computeLifeStage`, `computeCurrentStats` (all from Task 3, same file).
- Produces: `computeIsSick(pet: PetRow, now: Date): boolean`.

- [ ] **Step 1: Write failing tests for `computeIsSick`**

Append to `lib/pet-engine.test.ts`:
```typescript
import { computeIsSick } from './pet-engine';

describe('computeIsSick', () => {
  it('is never sick during the egg stage, even with zeroed stats', () => {
    const createdAt = new Date(); // elapsed 0 days -> egg
    const pet = makePet({
      created_at: createdAt.toISOString(),
      last_updated_at: createdAt.toISOString(),
      hunger: 0,
      cleanliness: 0,
    });
    expect(computeIsSick(pet, new Date())).toBe(false);
  });

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
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run lib/pet-engine.test.ts`
Expected: FAIL — `computeIsSick` is not exported.

- [ ] **Step 3: Implement `computeIsSick`**

Append to `lib/pet-engine.ts`:
```typescript
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
```

- [ ] **Step 4: Run tests, verify all pass**

Run: `npx vitest run lib/pet-engine.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/pet-engine.ts lib/pet-engine.test.ts
git commit -m "feat: add pet engine sickness calculation"
```

---

### Task 5: Pet Engine — Mood and Care Actions

**Files:**
- Modify: `lib/pet-engine.ts`
- Modify: `lib/pet-engine.test.ts`

**Interfaces:**
- Consumes: `Stats`, `SpriteState`, `clamp` (from Task 3, same file).
- Produces: `MoodState` type (`Exclude<SpriteState, 'eating'>`); `computeMood(stats: Stats, isSick: boolean, isSleeping: boolean): MoodState`; `feed(stats: Stats): Stats`; `bathe(stats: Stats): Stats`; `toggleSleep(isSleeping: boolean): boolean`; `play(stats: Stats, isSleeping: boolean): Stats | { error: string }`; `medicine(stats: Stats, isSick: boolean): Stats | { error: string }`.

- [ ] **Step 1: Write failing tests for `computeMood`**

Append to `lib/pet-engine.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run lib/pet-engine.test.ts`
Expected: FAIL — `computeMood` is not exported.

- [ ] **Step 3: Implement `computeMood`**

Append to `lib/pet-engine.ts`:
```typescript
export type MoodState = Exclude<SpriteState, 'eating'>;

export function computeMood(stats: Stats, isSick: boolean, isSleeping: boolean): MoodState {
  if (isSleeping) return 'sleeping';
  if (isSick) return 'sick';
  if (stats.cleanliness < 30) return 'dirty';
  if (stats.happiness < 30) return 'sad';
  return 'happy';
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run lib/pet-engine.test.ts`
Expected: all `computeMood` tests PASS.

- [ ] **Step 5: Write failing tests for `feed`, `bathe`, and `toggleSleep`**

Append to `lib/pet-engine.test.ts`:
```typescript
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
```

- [ ] **Step 6: Run tests, verify they fail**

Run: `npx vitest run lib/pet-engine.test.ts`
Expected: FAIL — `feed`, `bathe`, `toggleSleep` are not exported.

- [ ] **Step 7: Implement `feed`, `bathe`, and `toggleSleep`**

Append to `lib/pet-engine.ts`:
```typescript
export function feed(stats: Stats): Stats {
  return { ...stats, hunger: clamp(stats.hunger + 30) };
}

export function bathe(stats: Stats): Stats {
  return { ...stats, cleanliness: clamp(stats.cleanliness + 40) };
}

export function toggleSleep(isSleeping: boolean): boolean {
  return !isSleeping;
}
```

- [ ] **Step 8: Run tests, verify they pass**

Run: `npx vitest run lib/pet-engine.test.ts`
Expected: all PASS.

- [ ] **Step 9: Write failing tests for `play`**

Append to `lib/pet-engine.test.ts`:
```typescript
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
```

- [ ] **Step 10: Run tests, verify they fail**

Run: `npx vitest run lib/pet-engine.test.ts`
Expected: FAIL — `play` is not exported.

- [ ] **Step 11: Implement `play`**

Append to `lib/pet-engine.ts`:
```typescript
export function play(stats: Stats, isSleeping: boolean): Stats | { error: string } {
  if (isSleeping) return { error: 'Cannot play while pet is sleeping' };
  return {
    ...stats,
    happiness: clamp(stats.happiness + 15),
    energy: clamp(stats.energy - 5),
  };
}
```

- [ ] **Step 12: Run tests, verify they pass**

Run: `npx vitest run lib/pet-engine.test.ts`
Expected: all PASS.

- [ ] **Step 13: Write failing tests for `medicine`**

Append to `lib/pet-engine.test.ts`:
```typescript
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
```

- [ ] **Step 14: Run tests, verify they fail**

Run: `npx vitest run lib/pet-engine.test.ts`
Expected: FAIL — `medicine` is not exported.

- [ ] **Step 15: Implement `medicine`**

Append to `lib/pet-engine.ts`:
```typescript
export function medicine(stats: Stats, isSick: boolean): Stats | { error: string } {
  if (!isSick) return { error: 'Pet is not sick' };
  return {
    ...stats,
    hunger: Math.max(stats.hunger, 50),
    cleanliness: Math.max(stats.cleanliness, 50),
  };
}
```

- [ ] **Step 16: Run the full pet-engine suite, verify all pass**

Run: `npx vitest run lib/pet-engine.test.ts`
Expected: every test in the file PASSes (this file now covers `clamp`, `computeLifeStage`, `computeCurrentStats`, `computeIsSick`, `computeMood`, `feed`, `bathe`, `toggleSleep`, `play`, `medicine`).

- [ ] **Step 17: Commit**

```bash
git add lib/pet-engine.ts lib/pet-engine.test.ts
git commit -m "feat: add pet engine mood calculation and care actions"
```

---

### Task 6: Gemini Client + Fallback Sprite Assets

**Files:**
- Create: `lib/gemini-client.ts`
- Test: `lib/gemini-client.test.ts`
- Create: `public/fallback-sprites/happy.svg`, `public/fallback-sprites/sad.svg`, `public/fallback-sprites/eating.svg`, `public/fallback-sprites/sleeping.svg`, `public/fallback-sprites/dirty.svg`, `public/fallback-sprites/sick.svg`
- Create: `public/egg-sprite.svg`

**Interfaces:**
- Consumes: `SpriteState` (from `lib/pet-engine.ts`, Task 3).
- Produces: `generateSprite(photoUrls: string[], state: SpriteState): Promise<Buffer>`; six files at `/fallback-sprites/{state}.svg` and one at `/egg-sprite.svg`, served statically by Next.js from `public/`.

**Note:** `@google/genai` (class `GoogleGenAI`, `ai.models.generateContent({ model, contents })`, response `res.candidates[0].content.parts[].inlineData.{mimeType,data}`) is the current Gemini Node/TS SDK as of this writing. Verify the exact method names against https://ai.google.dev/gemini-api/docs before implementing, since SDK surfaces do shift between releases.

- [ ] **Step 1: Install the Gemini SDK**

```bash
npm install @google/genai
```

- [ ] **Step 2: Write failing tests for `generateSprite`**

Create `lib/gemini-client.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { generateContentMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: generateContentMock },
  })),
}));

import { generateSprite } from './gemini-client';

beforeEach(() => {
  generateContentMock.mockReset();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      arrayBuffer: async () => new TextEncoder().encode('fake-photo-bytes').buffer,
      headers: { get: () => 'image/jpeg' },
    })
  );
  process.env.GEMINI_API_KEY = 'test-key';
});

describe('generateSprite', () => {
  it('throws when GEMINI_API_KEY is not set', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(generateSprite(['https://example.com/a.jpg'], 'happy')).rejects.toThrow(
      'GEMINI_API_KEY is not set'
    );
  });

  it('returns an image buffer when Gemini responds with inline image data', async () => {
    const expectedBytes = Buffer.from('fake-sprite-png-bytes');
    generateContentMock.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ inlineData: { mimeType: 'image/png', data: expectedBytes.toString('base64') } }],
          },
        },
      ],
    });

    const result = await generateSprite(['https://example.com/a.jpg'], 'happy');
    expect(result).toEqual(expectedBytes);
  });

  it('throws a state-specific error when the response has no image part', async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: 'no image here' }] } }],
    });

    await expect(generateSprite(['https://example.com/a.jpg'], 'sick')).rejects.toThrow(
      'Gemini did not return an image for state "sick"'
    );
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `npx vitest run lib/gemini-client.test.ts`
Expected: FAIL — `./gemini-client` module not found.

- [ ] **Step 4: Implement `generateSprite`**

Create `lib/gemini-client.ts`:
```typescript
import { GoogleGenAI } from '@google/genai';
import type { SpriteState } from './pet-engine';

const STATE_PROMPTS: Record<SpriteState, string> = {
  happy: 'cute pixel-art style virtual pet based on this reference photo, joyful happy expression, transparent background, 512x512',
  sad: 'cute pixel-art style virtual pet based on this reference photo, sad droopy expression, transparent background, 512x512',
  eating: 'cute pixel-art style virtual pet based on this reference photo, eating food happily, transparent background, 512x512',
  sleeping: 'cute pixel-art style virtual pet based on this reference photo, eyes closed sleeping peacefully, transparent background, 512x512',
  dirty: 'cute pixel-art style virtual pet based on this reference photo, covered in dirt smudges, transparent background, 512x512',
  sick: 'cute pixel-art style virtual pet based on this reference photo, sick with a thermometer and pale face, transparent background, 512x512',
};

export async function generateSprite(photoUrls: string[], state: SpriteState): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const ai = new GoogleGenAI({ apiKey });

  const imageParts = await Promise.all(
    photoUrls.map(async (url) => {
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      const data = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = res.headers.get('content-type') ?? 'image/jpeg';
      return { inlineData: { mimeType, data } };
    })
  );

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [{ role: 'user', parts: [...imageParts, { text: STATE_PROMPTS[state] }] }],
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part) => part.inlineData);

  if (!imagePart?.inlineData) {
    throw new Error(`Gemini did not return an image for state "${state}"`);
  }

  return Buffer.from(imagePart.inlineData.data, 'base64');
}
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npx vitest run lib/gemini-client.test.ts`
Expected: all PASS.

- [ ] **Step 6: Create the fallback sprite SVGs**

Create `public/fallback-sprites/happy.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <circle cx="256" cy="256" r="200" fill="#FFD93D" stroke="#333" stroke-width="8"/>
  <circle cx="190" cy="220" r="18" fill="#333"/>
  <circle cx="322" cy="220" r="18" fill="#333"/>
  <path d="M180 300 Q256 360 332 300" stroke="#333" stroke-width="10" fill="none" stroke-linecap="round"/>
</svg>
```

Create `public/fallback-sprites/sad.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <circle cx="256" cy="256" r="200" fill="#A8D8FF" stroke="#333" stroke-width="8"/>
  <circle cx="190" cy="220" r="18" fill="#333"/>
  <circle cx="322" cy="220" r="18" fill="#333"/>
  <path d="M180 320 Q256 270 332 320" stroke="#333" stroke-width="10" fill="none" stroke-linecap="round"/>
</svg>
```

Create `public/fallback-sprites/eating.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <circle cx="256" cy="256" r="200" fill="#FFD93D" stroke="#333" stroke-width="8"/>
  <circle cx="190" cy="220" r="18" fill="#333"/>
  <circle cx="322" cy="220" r="18" fill="#333"/>
  <ellipse cx="256" cy="310" rx="40" ry="30" fill="#333"/>
  <circle cx="360" cy="340" r="24" fill="#8B4513"/>
</svg>
```

Create `public/fallback-sprites/sleeping.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <circle cx="256" cy="256" r="200" fill="#C9B8FF" stroke="#333" stroke-width="8"/>
  <path d="M170 220 Q190 210 210 220" stroke="#333" stroke-width="8" fill="none" stroke-linecap="round"/>
  <path d="M302 220 Q322 210 342 220" stroke="#333" stroke-width="8" fill="none" stroke-linecap="round"/>
  <path d="M210 300 Q256 320 302 300" stroke="#333" stroke-width="8" fill="none" stroke-linecap="round"/>
  <text x="360" y="150" font-size="48" fill="#333">Z</text>
</svg>
```

Create `public/fallback-sprites/dirty.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <circle cx="256" cy="256" r="200" fill="#FFD93D" stroke="#333" stroke-width="8"/>
  <circle cx="190" cy="220" r="18" fill="#333"/>
  <circle cx="322" cy="220" r="18" fill="#333"/>
  <path d="M180 300 Q256 340 332 300" stroke="#333" stroke-width="10" fill="none" stroke-linecap="round"/>
  <circle cx="200" cy="320" r="24" fill="#6B4226" opacity="0.7"/>
  <circle cx="320" cy="180" r="18" fill="#6B4226" opacity="0.7"/>
  <circle cx="300" cy="330" r="16" fill="#6B4226" opacity="0.7"/>
</svg>
```

Create `public/fallback-sprites/sick.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <circle cx="256" cy="256" r="200" fill="#D8E8D0" stroke="#333" stroke-width="8"/>
  <path d="M172 202 L208 238 M208 202 L172 238" stroke="#333" stroke-width="8" stroke-linecap="round"/>
  <path d="M304 202 L340 238 M340 202 L304 238" stroke="#333" stroke-width="8" stroke-linecap="round"/>
  <path d="M210 320 Q256 300 302 320" stroke="#333" stroke-width="10" fill="none" stroke-linecap="round"/>
  <rect x="240" y="120" width="16" height="60" rx="8" fill="#E63946"/>
</svg>
```

Create `public/egg-sprite.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <ellipse cx="256" cy="270" rx="150" ry="190" fill="#FFF8E7" stroke="#333" stroke-width="8"/>
  <path d="M200 180 L230 240 L190 260 L240 330" stroke="#F4C430" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

- [ ] **Step 7: Manually verify the assets render**

Run: `npm run dev` in the background. Open `http://localhost:3000/fallback-sprites/happy.svg`, `.../sad.svg`, `.../eating.svg`, `.../sleeping.svg`, `.../dirty.svg`, `.../sick.svg`, and `http://localhost:3000/egg-sprite.svg` in a browser.
Expected: each URL renders a distinct simple pet-face illustration. Stop the dev server afterward.

- [ ] **Step 8: Commit**

```bash
git add lib/gemini-client.ts lib/gemini-client.test.ts public/fallback-sprites public/egg-sprite.svg
git commit -m "feat: add Gemini sprite-generation client and bundled fallback sprite assets"
```

---

### Task 7: Onboarding Orchestration (Retry + Fallback Logic)

**Files:**
- Create: `lib/onboarding-orchestration.ts`
- Test: `lib/onboarding-orchestration.test.ts`

**Interfaces:**
- Consumes: `SpriteState` (from `lib/pet-engine.ts`, Task 3).
- Produces: `SPRITE_STATES: SpriteState[]`; `MAX_ATTEMPTS: number`; `GenerateSpriteFn = (photoUrls: string[], state: SpriteState) => Promise<Buffer>`; `SpriteGenerationResult = { state: SpriteState; source: 'generated'; buffer: Buffer } | { state: SpriteState; source: 'fallback'; fallbackPath: string }`; `generateSpriteWithRetry(generateFn: GenerateSpriteFn, photoUrls: string[], state: SpriteState, maxAttempts?: number): Promise<Buffer | null>`; `generateAllSprites(generateFn: GenerateSpriteFn, photoUrls: string[]): Promise<SpriteGenerationResult[]>`. This module never imports `lib/gemini-client.ts` directly — the real `generateSprite` is injected by the caller (Task 9), which is what keeps this file mockable and DB/network-free in tests.

- [ ] **Step 1: Write failing tests for `generateSpriteWithRetry`**

Create `lib/onboarding-orchestration.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { generateSpriteWithRetry, generateAllSprites, SPRITE_STATES } from './onboarding-orchestration';
import type { SpriteState } from './pet-engine';

describe('generateSpriteWithRetry', () => {
  it('returns the buffer on the first successful attempt', async () => {
    const generateFn = vi.fn().mockResolvedValue(Buffer.from('sprite-bytes'));
    const result = await generateSpriteWithRetry(generateFn, ['url'], 'happy');
    expect(result).toEqual(Buffer.from('sprite-bytes'));
    expect(generateFn).toHaveBeenCalledTimes(1);
  });

  it('retries after failures and returns the buffer once it succeeds', async () => {
    const generateFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockRejectedValueOnce(new Error('rate limited again'))
      .mockResolvedValueOnce(Buffer.from('sprite-bytes'));

    const result = await generateSpriteWithRetry(generateFn, ['url'], 'sad');
    expect(result).toEqual(Buffer.from('sprite-bytes'));
    expect(generateFn).toHaveBeenCalledTimes(3);
  });

  it('returns null after exhausting all attempts', async () => {
    const generateFn = vi.fn().mockRejectedValue(new Error('always fails'));
    const result = await generateSpriteWithRetry(generateFn, ['url'], 'sick');
    expect(result).toBeNull();
    expect(generateFn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run lib/onboarding-orchestration.test.ts`
Expected: FAIL — `./onboarding-orchestration` module not found.

- [ ] **Step 3: Implement `generateSpriteWithRetry`**

Create `lib/onboarding-orchestration.ts`:
```typescript
import type { SpriteState } from './pet-engine';

export const SPRITE_STATES: SpriteState[] = ['happy', 'sad', 'eating', 'sleeping', 'dirty', 'sick'];
export const MAX_ATTEMPTS = 3; // 1 initial attempt + 2 retries

export type GenerateSpriteFn = (photoUrls: string[], state: SpriteState) => Promise<Buffer>;

export async function generateSpriteWithRetry(
  generateFn: GenerateSpriteFn,
  photoUrls: string[],
  state: SpriteState,
  maxAttempts: number = MAX_ATTEMPTS
): Promise<Buffer | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await generateFn(photoUrls, state);
    } catch {
      // swallow and retry; caller falls back once attempts are exhausted
    }
  }
  return null;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run lib/onboarding-orchestration.test.ts`
Expected: `generateSpriteWithRetry` tests PASS.

- [ ] **Step 5: Write failing tests for `generateAllSprites`**

Append to `lib/onboarding-orchestration.test.ts`:
```typescript
describe('generateAllSprites', () => {
  it('returns one generated result per sprite state when all succeed', async () => {
    const generateFn = vi.fn().mockImplementation(async (_urls: string[], state: SpriteState) =>
      Buffer.from(`bytes-for-${state}`)
    );

    const results = await generateAllSprites(generateFn, ['url']);

    expect(results).toHaveLength(SPRITE_STATES.length);
    for (const state of SPRITE_STATES) {
      const result = results.find((r) => r.state === state);
      expect(result?.source).toBe('generated');
      if (result?.source === 'generated') {
        expect(result.buffer).toEqual(Buffer.from(`bytes-for-${state}`));
      }
    }
  });

  it('falls back to the bundled SVG path for a state that fails after all retries', async () => {
    const generateFn = vi.fn().mockImplementation(async (_urls: string[], state: SpriteState) => {
      if (state === 'sick') throw new Error('always fails for sick');
      return Buffer.from(`bytes-for-${state}`);
    });

    const results = await generateAllSprites(generateFn, ['url']);

    const sickResult = results.find((r) => r.state === 'sick');
    expect(sickResult).toEqual({ state: 'sick', source: 'fallback', fallbackPath: '/fallback-sprites/sick.svg' });

    const happyResult = results.find((r) => r.state === 'happy');
    expect(happyResult?.source).toBe('generated');
  });
});
```

- [ ] **Step 6: Run tests, verify they fail**

Run: `npx vitest run lib/onboarding-orchestration.test.ts`
Expected: FAIL — `generateAllSprites` is not exported.

- [ ] **Step 7: Implement `generateAllSprites`**

Append to `lib/onboarding-orchestration.ts`:
```typescript
export type SpriteGenerationResult =
  | { state: SpriteState; source: 'generated'; buffer: Buffer }
  | { state: SpriteState; source: 'fallback'; fallbackPath: string };

export async function generateAllSprites(
  generateFn: GenerateSpriteFn,
  photoUrls: string[]
): Promise<SpriteGenerationResult[]> {
  return Promise.all(
    SPRITE_STATES.map(async (state): Promise<SpriteGenerationResult> => {
      const buffer = await generateSpriteWithRetry(generateFn, photoUrls, state);
      if (buffer) {
        return { state, source: 'generated', buffer };
      }
      return { state, source: 'fallback', fallbackPath: `/fallback-sprites/${state}.svg` };
    })
  );
}
```

- [ ] **Step 8: Run tests, verify all pass**

Run: `npx vitest run lib/onboarding-orchestration.test.ts`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/onboarding-orchestration.ts lib/onboarding-orchestration.test.ts
git commit -m "feat: add onboarding sprite-generation retry and fallback orchestration"
```

---

### Task 8: Auth Pages (Sign Up / Log In / Log Out)

**Files:**
- Create: `app/login/actions.ts`, `app/login/LoginForm.tsx`, `app/login/page.tsx`
- Modify: `app/page.tsx` (root redirect logic)

**Interfaces:**
- Consumes: `createClient()` (server, from `lib/supabase/server.ts`, Task 2).
- Produces: Server Actions `signUp`, `signIn`, `signOut` (in `app/login/actions.ts`) used nowhere else yet but establish the pattern Task 9 and Task 11's Server Actions follow.

- [ ] **Step 1: Write the auth Server Actions**

Create `app/login/actions.ts`:
```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function signUp(_prevState: { error: string }, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect('/onboarding');
}

export async function signIn(_prevState: { error: string }, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect('/pet');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
```

- [ ] **Step 2: Build the login/signup form**

Create `app/login/LoginForm.tsx`:
```tsx
'use client';

import { useActionState } from 'react';
import { signIn, signUp } from './actions';

const initialState = { error: '' };

export function LoginForm() {
  const [signInState, signInAction, signInPending] = useActionState(signIn, initialState);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, initialState);

  return (
    <div>
      <form action={signInAction}>
        <h2>Log in</h2>
        <label>
          Email
          <input type="email" name="email" required />
        </label>
        <label>
          Password
          <input type="password" name="password" required minLength={6} />
        </label>
        {signInState?.error && <p role="alert">{signInState.error}</p>}
        <button type="submit" disabled={signInPending}>Log in</button>
      </form>

      <form action={signUpAction}>
        <h2>Sign up</h2>
        <label>
          Email
          <input type="email" name="email" required />
        </label>
        <label>
          Password
          <input type="password" name="password" required minLength={6} />
        </label>
        {signUpState?.error && <p role="alert">{signUpState.error}</p>}
        <button type="submit" disabled={signUpPending}>Sign up</button>
      </form>
    </div>
  );
}
```

Create `app/login/page.tsx`:
```tsx
import { LoginForm } from './LoginForm';

export default function LoginPage() {
  return (
    <main>
      <h1>Pets Forever</h1>
      <LoginForm />
    </main>
  );
}
```

- [ ] **Step 3: Wire the root page redirect**

Replace the contents of `app/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  redirect('/pet');
}
```

- [ ] **Step 4: Manually verify sign-up, sign-in, and sign-out against the real Supabase project**

Run: `npm run dev`. Open `http://localhost:3000` — confirm it redirects to `/login`.
Sign up with a throwaway test email/password (a real inbox you control, plus a 6+ char password). Confirm:
- No error shown, and the browser navigates toward `/onboarding` (it will 404 or error until Task 9 exists — that's expected right now; confirm in the Network tab that the redirect target is `/onboarding`).
- In the Supabase Dashboard > Authentication > Users, the new user appears.
Then navigate to `/login` again, log in with the same credentials, confirm no error and redirect toward `/pet` (again, `/pet` doesn't exist until Task 10 — confirm the redirect target only).

- [ ] **Step 5: Commit**

```bash
git add app/login app/page.tsx
git commit -m "feat: add email/password auth pages with server actions"
```

---

### Task 9: Onboarding Flow (Photo Upload + Sprite Generation)

**Files:**
- Create: `lib/validate-photo-files.ts`
- Test: `lib/validate-photo-files.test.ts`
- Create: `app/onboarding/page.tsx`, `app/onboarding/OnboardingForm.tsx`, `app/onboarding/actions.ts`

**Interfaces:**
- Consumes: `createClient()` (server, Task 2); `generateSprite` (Task 6); `generateAllSprites`, `GenerateSpriteFn` (Task 7); `SpriteState` (Task 3).
- Produces: `validatePhotoFiles(files: File[]): string | null`, `MAX_PHOTOS`, `MAX_PHOTO_BYTES` (from `lib/validate-photo-files.ts`); Server Action `createPet(prevState, formData): Promise<{ error: string } | never>` (redirects to `/pet` on success, used only within this task but the pattern feeds Task 11).

- [ ] **Step 1: Write failing tests for `validatePhotoFiles`**

Create `lib/validate-photo-files.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { validatePhotoFiles } from './validate-photo-files';

function makeFile(name: string, type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe('validatePhotoFiles', () => {
  it('accepts 1 to 3 valid image files', () => {
    expect(validatePhotoFiles([makeFile('a.jpg', 'image/jpeg', 1024)])).toBeNull();
  });

  it('rejects zero files', () => {
    expect(validatePhotoFiles([])).toBe('Please select 1 to 3 photos.');
  });

  it('rejects more than 3 files', () => {
    const files = [
      makeFile('a.jpg', 'image/jpeg', 1024),
      makeFile('b.jpg', 'image/jpeg', 1024),
      makeFile('c.jpg', 'image/jpeg', 1024),
      makeFile('d.jpg', 'image/jpeg', 1024),
    ];
    expect(validatePhotoFiles(files)).toBe('Please select 1 to 3 photos.');
  });

  it('rejects a non-image file', () => {
    expect(validatePhotoFiles([makeFile('a.pdf', 'application/pdf', 1024)])).toBe(
      '"a.pdf" is not an image file.'
    );
  });

  it('rejects a file larger than 5MB', () => {
    expect(validatePhotoFiles([makeFile('big.jpg', 'image/jpeg', 6 * 1024 * 1024)])).toBe(
      '"big.jpg" is larger than 5MB.'
    );
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run lib/validate-photo-files.test.ts`
Expected: FAIL — `./validate-photo-files` module not found.

- [ ] **Step 3: Implement `validatePhotoFiles`**

Create `lib/validate-photo-files.ts`:
```typescript
export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

export function validatePhotoFiles(files: File[]): string | null {
  if (files.length < 1 || files.length > MAX_PHOTOS) {
    return `Please select 1 to ${MAX_PHOTOS} photos.`;
  }
  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      return `"${file.name}" is not an image file.`;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return `"${file.name}" is larger than 5MB.`;
    }
  }
  return null;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run lib/validate-photo-files.test.ts`
Expected: all PASS. (Requires Node 20+, which has `File` as a global; confirm with `node --version` if this fails with `File is not defined`.)

- [ ] **Step 5: Write the `createPet` Server Action**

Create `app/onboarding/actions.ts`:
```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { generateSprite } from '@/lib/gemini-client';
import { generateAllSprites } from '@/lib/onboarding-orchestration';
import type { SpriteState } from '@/lib/pet-engine';
import { redirect } from 'next/navigation';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function createPet(_prevState: { error: string }, formData: FormData) {
  const name = formData.get('name') as string;
  const photos = formData.getAll('photos') as File[];

  if (!name?.trim()) {
    return { error: 'Please enter a pet name.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'You must be logged in.' };
  }

  const photoUrls: string[] = [];
  for (let i = 0; i < photos.length; i++) {
    const file = photos[i];
    const filePath = `${user.id}/${Date.now()}-${i}.jpg`;
    const { error: uploadError } = await supabase.storage.from('pet-photos').upload(filePath, file);
    if (uploadError) {
      return { error: `Failed to upload photo: ${uploadError.message}` };
    }
    const { data: signed } = await supabase.storage
      .from('pet-photos')
      .createSignedUrl(filePath, 60 * 10);
    if (signed?.signedUrl) photoUrls.push(signed.signedUrl);
  }

  const results = await generateAllSprites(generateSprite, photoUrls);

  const sprites: Partial<Record<SpriteState, string>> = {};
  let uploadedCount = 0;

  for (const result of results) {
    const destPath = `${user.id}/${result.state}.png`;
    const bytes =
      result.source === 'generated'
        ? result.buffer
        : await readFile(path.join(process.cwd(), 'public', 'fallback-sprites', `${result.state}.svg`));

    const { error: uploadError } = await supabase.storage.from('pet-sprites').upload(destPath, bytes, {
      contentType: result.source === 'generated' ? 'image/png' : 'image/svg+xml',
      upsert: true,
    });

    if (!uploadError) {
      const { data: publicUrl } = supabase.storage.from('pet-sprites').getPublicUrl(destPath);
      sprites[result.state] = publicUrl.publicUrl;
      uploadedCount++;
    }
  }

  if (uploadedCount === 0) {
    return { error: 'Could not create your pet sprites. Please try again.' };
  }

  const { error: insertError } = await supabase.from('pets').insert({
    user_id: user.id,
    name: name.trim(),
    sprites,
  });

  if (insertError) {
    return { error: `Failed to create pet: ${insertError.message}` };
  }

  redirect('/pet');
}
```

- [ ] **Step 6: Build the onboarding form and page**

Create `app/onboarding/OnboardingForm.tsx`:
```tsx
'use client';

import { useActionState, useState, type ChangeEvent } from 'react';
import { createPet } from './actions';
import { validatePhotoFiles } from '@/lib/validate-photo-files';

const initialState = { error: '' };

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createPet, initialState);
  const [clientError, setClientError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  function handleFilesChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const error = validatePhotoFiles(files);
    setClientError(error);
    setPreviews(error ? [] : files.map((f) => URL.createObjectURL(f)));
  }

  if (pending) {
    return <p>Incubating your pet...</p>;
  }

  return (
    <form action={formAction}>
      <label>
        Pet name
        <input type="text" name="name" required />
      </label>
      <label>
        Photos (1-3, image files, max 5MB each)
        <input type="file" name="photos" accept="image/*" multiple required onChange={handleFilesChange} />
      </label>
      {previews.map((src) => (
        <img key={src} src={src} alt="Pet preview" width={100} />
      ))}
      {clientError && <p role="alert">{clientError}</p>}
      {state?.error && <p role="alert">{state.error}</p>}
      <button type="submit" disabled={!!clientError}>Create my pet</button>
    </form>
  );
}
```

Create `app/onboarding/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingForm } from './OnboardingForm';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: pet } = await supabase.from('pets').select('id').eq('user_id', user.id).maybeSingle();
  if (pet) redirect('/pet');

  return (
    <main>
      <h1>Welcome! Let&apos;s create your pet.</h1>
      <OnboardingForm />
    </main>
  );
}
```

- [ ] **Step 7: Manually verify the full onboarding flow against the real Supabase + Gemini project**

Run: `npm run dev`. Sign up (or log in) as a test user, land on `/onboarding`. Try selecting 4 photos or a >5MB file — confirm the inline client error appears and the submit button is disabled. Then select 1-2 small real images (a few hundred KB each) and a pet name, submit. Confirm:
- The "Incubating your pet..." state shows while the action runs.
- After it completes, the browser is on `/pet`.
- In the Supabase Dashboard: Table Editor > `pets` has one row for this user with `sprites` populated with 6 URLs; Storage > `pet-photos/{user_id}/` has the uploaded photo(s); Storage > `pet-sprites/{user_id}/` has 6 files.
- Temporarily set an invalid `GEMINI_API_KEY` in `.env.local`, restart `npm run dev`, and repeat onboarding with a fresh test user — confirm the 6 sprites in Storage are now the bundled SVG fallbacks (their content-type is `image/svg+xml`) and onboarding still completes rather than failing. Restore the real `GEMINI_API_KEY` afterward.

- [ ] **Step 8: Commit**

```bash
git add lib/validate-photo-files.ts lib/validate-photo-files.test.ts app/onboarding
git commit -m "feat: add onboarding flow with photo upload and sprite generation"
```

---

### Task 10: Pet Dashboard (Read View)

**Files:**
- Create: `app/pet/page.tsx`, `app/pet/StatBar.tsx`

**Interfaces:**
- Consumes: `createClient()` (server, Task 2); `computeCurrentStats`, `computeIsSick`, `computeLifeStage`, `computeMood`, `type PetRow` (Task 3-5).
- Produces: `StatBar({ label, value }: { label: string; value: number })` component, reused by no other file but establishes the stat-bar pattern; the `/pet` route itself, which Task 11 modifies to add action buttons.

- [ ] **Step 1: Build the stat bar component**

Create `app/pet/StatBar.tsx`:
```tsx
function colorFor(value: number): string {
  if (value >= 60) return 'green';
  if (value >= 30) return 'orange';
  return 'red';
}

export function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}: {Math.round(value)}</span>
      <div style={{ background: '#eee', width: '100%', height: 12 }}>
        <div style={{ width: `${value}%`, background: colorFor(value), height: '100%' }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build the dashboard Server Component**

Create `app/pet/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  computeCurrentStats,
  computeIsSick,
  computeLifeStage,
  computeMood,
  type PetRow,
} from '@/lib/pet-engine';
import { StatBar } from './StatBar';

export default async function PetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) redirect('/onboarding');

  const petRow = pet as PetRow;
  const now = new Date();
  const stats = computeCurrentStats(petRow, now);
  const isSick = computeIsSick(petRow, now);
  const lifeStage = computeLifeStage(new Date(petRow.created_at), now);
  const mood = computeMood(stats, isSick, petRow.is_sleeping);

  return (
    <main>
      <h1>{petRow.name}</h1>

      {lifeStage === 'egg' ? (
        <div>
          <img src="/egg-sprite.svg" alt="Egg" width={256} height={256} />
          <p>Your pet is about to hatch.</p>
        </div>
      ) : (
        <img
          src={petRow.sprites[mood]}
          alt={petRow.name}
          style={{ width: lifeStage === 'baby' ? '60%' : '100%' }}
        />
      )}

      <StatBar label="Hunger" value={stats.hunger} />
      <StatBar label="Happiness" value={stats.happiness} />
      <StatBar label="Energy" value={stats.energy} />
      <StatBar label="Cleanliness" value={stats.cleanliness} />
    </main>
  );
}
```

- [ ] **Step 3: Manually verify the dashboard renders and reflects decay**

Run: `npm run dev`. Log in as the test user from Task 9 and open `/pet`. Confirm: since the pet was just created, `lifeStage` is `egg` — the egg SVG and "about to hatch" message show, and all four stat bars read ~100 (green).
In the Supabase Dashboard > Table Editor > `pets`, manually edit that row's `created_at` to a timestamp 6 days in the past (simulating an adult pet) and `last_updated_at` to 10 hours in the past, then reload `/pet`. Confirm: the egg view is replaced by the sprite for the pet's mood (should be `happy` sprite since stats haven't decayed much yet), rendered at full scale, and the stat bars have dropped slightly and proportionally to their different decay rates (hunger drops fastest, happiness slowest).

- [ ] **Step 4: Commit**

```bash
git add app/pet
git commit -m "feat: add pet dashboard read view with stats and life-stage sprite"
```

---

### Task 11: Care Action Server Actions + Buttons

**Files:**
- Create: `app/pet/actions.ts`, `app/pet/ActionButtons.tsx`
- Modify: `app/pet/page.tsx` (render `ActionButtons` when not in egg stage)

**Interfaces:**
- Consumes: `createClient()` (server, Task 2); `computeCurrentStats`, `computeIsSick`, `feed`, `play`, `bathe`, `medicine`, `type PetRow` (Task 3-5); the `/pet` page and `isSleeping`/`isSick` values computed in Task 10.
- Produces: Server Actions `feed`, `play`, `bathe`, `toggleSleep`, `medicine` (in `app/pet/actions.ts`, each returning `Promise<{ error: string | null }>` and calling `revalidatePath('/pet')` on success); `ActionButtons({ isSleeping, isSick }: { isSleeping: boolean; isSick: boolean })` component.

- [ ] **Step 1: Write the care-action Server Actions**

Create `app/pet/actions.ts`:
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
} from '@/lib/pet-engine';

async function loadPet(): Promise<{ error: string } | { pet: PetRow }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not logged in.' };

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) return { error: 'No pet found.' };
  return { pet: pet as PetRow };
}

export async function feed() {
  const loaded = await loadPet();
  if ('error' in loaded) return loaded;

  const supabase = await createClient();
  const now = new Date();
  const newStats = feedStats(computeCurrentStats(loaded.pet, now));

  const { error } = await supabase
    .from('pets')
    .update({ ...newStats, last_updated_at: now.toISOString() })
    .eq('id', loaded.pet.id);

  if (error) return { error: error.message };
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
    .update({ ...result, last_updated_at: now.toISOString() })
    .eq('id', loaded.pet.id);

  if (error) return { error: error.message };
  revalidatePath('/pet');
  return { error: null };
}

export async function bathe() {
  const loaded = await loadPet();
  if ('error' in loaded) return loaded;

  const supabase = await createClient();
  const now = new Date();
  const newStats = batheStats(computeCurrentStats(loaded.pet, now));

  const { error } = await supabase
    .from('pets')
    .update({ ...newStats, last_updated_at: now.toISOString() })
    .eq('id', loaded.pet.id);

  if (error) return { error: error.message };
  revalidatePath('/pet');
  return { error: null };
}

export async function toggleSleep() {
  const loaded = await loadPet();
  if ('error' in loaded) return loaded;

  const supabase = await createClient();
  const now = new Date();
  const currentStats = computeCurrentStats(loaded.pet, now);

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
    .update({ ...result, last_updated_at: now.toISOString() })
    .eq('id', loaded.pet.id);

  if (error) return { error: error.message };
  revalidatePath('/pet');
  return { error: null };
}
```

- [ ] **Step 2: Build the action buttons Client Component**

Create `app/pet/ActionButtons.tsx`:
```tsx
'use client';

import { useState, useTransition } from 'react';
import { feed, play, bathe, toggleSleep, medicine } from './actions';

export function ActionButtons({ isSleeping, isSick }: { isSleeping: boolean; isSick: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [showEating, setShowEating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function runAction(action: () => Promise<{ error: string | null }>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        onSuccess?.();
      }
    });
  }

  function handleFeed() {
    runAction(feed, () => {
      setShowEating(true);
      setTimeout(() => setShowEating(false), 2000);
    });
  }

  return (
    <div>
      {showEating && <p>Eating...</p>}
      {error && <p role="alert">{error}</p>}
      <button onClick={handleFeed} disabled={isPending}>Feed</button>
      <button onClick={() => runAction(play)} disabled={isPending || isSleeping}>Play</button>
      <button onClick={() => runAction(bathe)} disabled={isPending}>Bathe</button>
      <button onClick={() => runAction(toggleSleep)} disabled={isPending}>
        {isSleeping ? 'Wake' : 'Sleep'}
      </button>
      {isSick && (
        <button onClick={() => runAction(medicine)} disabled={isPending}>Medicine</button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire `ActionButtons` into the dashboard**

Modify `app/pet/page.tsx`: add the import and render the buttons below the stat bars, only outside the egg stage.

```tsx
import { ActionButtons } from './ActionButtons';
```
and, after the four `<StatBar />` elements:
```tsx
      {lifeStage !== 'egg' && <ActionButtons isSleeping={petRow.is_sleeping} isSick={isSick} />}
```

- [ ] **Step 4: Manually verify each action against the real Supabase project**

Run: `npm run dev`, open `/pet` for a non-egg-stage pet (from the Task 10 manual `created_at` edit).
- Click **Feed**: confirm the "Eating..." text appears for ~2s, the Hunger bar rises by 30 (clamped at 100), and the change persists after a manual page reload.
- Click **Sleep**: confirm the button label flips to "Wake" and `is_sleeping` becomes `true` in the Supabase table editor.
- While sleeping, confirm the **Play** button is disabled in the UI. Re-enable it by editing the DOM in browser devtools and clicking it anyway (or call `play` directly), and confirm the Server Action still rejects it (`{error: 'Cannot play while pet is sleeping'}` shown), proving server-side re-validation.
- Click **Wake**, then **Bathe**: confirm Cleanliness rises by 40 (clamped at 100).
- In the Supabase table editor, set `hunger` and `cleanliness` to `0` and `last_updated_at` to 40 hours in the past, reload `/pet`. Confirm the **Medicine** button now appears and the sprite/mood reflects `sick`. Click **Medicine**: confirm `hunger` and `cleanliness` both become at least 50, the Medicine button disappears on reload, and the mood sprite is no longer `sick`.
- Confirm clicking Medicine again (when not sick) is impossible from the UI (button hidden) and, if invoked directly, the Server Action returns `{error: 'Pet is not sick'}`.

- [ ] **Step 5: Commit**

```bash
git add app/pet
git commit -m "feat: add care action server actions and wire buttons into dashboard"
```

---

## Spec Coverage Check

- Data model + RLS (table, policies, storage buckets): Task 2.
- Pet engine — decay, life stage, sickness, mood, actions: Tasks 3-5.
- Gemini client + per-state prompts + fallback SVGs + egg SVG: Task 6.
- Onboarding retry/fallback orchestration: Task 7.
- Auth (email+password, inline errors): Task 8.
- Onboarding flow (name + 1-3 photos, client validation, loading state, `createPet` action, redirect-if-pet-exists): Task 9.
- Dashboard (egg/baby/adult rendering, 4 stat bars with threshold colors): Task 10.
- Care actions (feed/play/bathe/sleep/medicine, optimistic eating animation, `revalidatePath`, server-side business-rule re-validation): Task 11.
- One-pet-per-account enforcement at both DB (`unique`) and routing level (`/onboarding` and `/pet` redirects): Tasks 2, 9, 10.
- Testing strategy deviation (no local Supabase CLI/Docker, npm, mocked-I/O unit tests only for pure/orchestration logic): reflected throughout — every task touching real Supabase/Gemini I/O uses a "manually verify" step instead of an automated test.

## End-to-End Verification

After all 11 tasks are complete, do one final full run-through to confirm the whole system works together, not just task-by-task:

1. `npm run test` — every Vitest suite across `lib/pet-engine.test.ts`, `lib/gemini-client.test.ts`, `lib/onboarding-orchestration.test.ts`, and `lib/validate-photo-files.test.ts` passes.
2. `npm run build` — production build succeeds with no TypeScript errors.
3. `npm run dev` — with a fresh Supabase test user: sign up → land on `/onboarding` → upload real pet photos → confirm "incubating" loading state → land on `/pet` showing the egg.
4. Edit `created_at` in the Supabase table editor to simulate the egg having hatched (per Task 10 Step 3) → reload → confirm a real AI-generated sprite (not the SVG placeholder) renders at baby scale, and the 4 stat bars are present.
5. Run through Feed, Play, Bathe, Sleep/Wake, and (after manually zeroing hunger/cleanliness and backdating `last_updated_at`) Medicine, per Task 11 Step 4 — confirm each persists correctly and the mood sprite changes appropriately (dirty/sad/sick/happy/sleeping).
6. Confirm a second onboarding attempt for the same account is impossible — visiting `/onboarding` while already having a pet redirects straight to `/pet`.

## Critical Files for Implementation
- lib/pet-engine.ts
- lib/onboarding-orchestration.ts
- lib/gemini-client.ts
- app/onboarding/actions.ts
- app/pet/actions.ts
- supabase/schema.sql

## Note on plan file location

This plan was authored under Claude Code's Plan Mode, which restricts editing to this file's path. Once approved, the first step of execution should be copying this file to `docs/superpowers/plans/2026-08-21-tamagotchi-clone-implementation.md` and committing it there (per the `superpowers:writing-plans` convention), since that's the path `superpowers:subagent-driven-development` / `superpowers:executing-plans` expect plans to live at alongside the spec.
