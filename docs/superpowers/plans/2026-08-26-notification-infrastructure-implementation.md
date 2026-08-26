# Notification Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution root:** all file paths below are relative to the repository root (`C:\Users\luccas\Desktop\claude-proyects\pets-forever`, or the equivalent git worktree root if this plan is executed inside one created via `superpowers:using-git-worktrees`). Run every command from that directory.

## Context

This is the 6th feature plan for Pets Forever and the first to add background/scheduled execution to an app where every existing feature (stat decay, mission payouts, bond score) is computed lazily on page load. Five features already shipped before this one and set the architectural precedent this plan follows exactly: Pet Diary (`docs/superpowers/plans/2026-08-23-pet-diary-implementation.md`), Currency & Missions (`docs/superpowers/plans/2026-08-24-currency-missions-implementation.md`), Casa & Tienda (`docs/superpowers/plans/2026-08-24-casa-tienda-implementation.md`), and Bond Score (`docs/superpowers/plans/2026-08-25-bond-score-implementation.md`). Every one of them uses the same three-layer shape — a pure `lib/*.ts` logic module with full TDD coverage, a thin I/O module with no automated tests, and UI wired into Server Components — and this plan reuses that shape without modification, adding only what genuinely didn't exist before in this codebase: a service-role Supabase client, an outbound email sender, and a Vercel Cron-triggered Route Handler.

The design was fully brainstormed and approved with the user ahead of this plan: `docs/superpowers/specs/2026-08-26-notification-infrastructure-design.md`. This feature is deliberately scoped as foundational plumbing, not Apego content itself — it exists so a later feature (the next slice in the "Apego" backlog) can add richer, bond-tier-aware triggers without also having to build subscription storage, email sending, and scheduling from scratch, mirroring how Bond Score was built first because other Apego items needed it to exist before they could build on it.

Implementation-level decisions the spec itself left open (the exact `NotificationPreferences`/`shouldSendDailyBonusEmail` signature, `lib/email.ts`'s and `lib/supabase/admin.ts`'s exact shape, the cron route's step-by-step logic, the exact email HTML) were made in the planning conversation that produced this document and are treated as **fixed requirements** below — this plan only turns them into code.

One deliberate adjustment to the suggested task boundaries: `npm install resend` is performed in Task 3, not batched into Task 4. Task 3 is the task that actually creates `lib/email.ts`, which imports the `resend` package — installing the dependency in the same task that first needs it is what lets Task 3's own build-verification step pass on its own, keeping every task independently testable (per this project's `writing-plans` conventions) rather than leaving Task 3 in a temporarily broken, unbuildable state until Task 4 runs.

**Goal:** Let a user opt in to a daily email reminding them their daily coin bonus is ready to claim, built on generic, reusable email-notification plumbing (subscription storage, a Resend-backed sender, a service-role Supabase client, and a Vercel Cron-triggered endpoint) that a later Apego trigger can build on without new infrastructure.

**Architecture:** A pure eligibility function (`lib/notifications.ts`, mirroring `lib/bond.ts`) exports `shouldSendDailyBonusEmail(pet, prefs, now)`, reusing `shouldGrantDailyBonus` and `computePeriodKey('daily', now)` from the existing `lib/missions.ts` rather than reimplementing date logic. Two small I/O modules — `lib/email.ts` (a Resend wrapper that returns `{ error }` instead of throwing) and `lib/supabase/admin.ts` (a service-role client that bypasses RLS, used only by the cron route) — are tied together by `app/api/cron/daily-notifications/route.ts`, a Next.js Route Handler that Vercel Cron invokes once daily via `vercel.json`. The UI adds one new opt-in toggle page, `/pet/notificaciones`, reachable from a new nav pill on `/pet`.

**Tech Stack:** Next.js 15.5.23 (App Router, TypeScript), Supabase (Postgres + Auth via `@supabase/ssr` ^0.12.4 / `@supabase/supabase-js` ^2.112.3), Resend (new dependency, official Node SDK, added in Task 3), Vercel Cron (`vercel.json`, no new dependency — platform-native, invokes via HTTP `GET`), Vitest ^4.1.11, npm.

**Spec:** `docs/superpowers/specs/2026-08-26-notification-infrastructure-design.md`

## Global Constraints

- **RLS policies (exact, from the spec's Data Model — do not broaden to `for all`):**
  ```sql
  create policy "Users read their own notification preferences"
    on notification_preferences for select
    using (auth.uid() = user_id);

  create policy "Users create their own notification preferences"
    on notification_preferences for insert
    with check (auth.uid() = user_id);

  create policy "Users update their own notification preferences"
    on notification_preferences for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  ```
  Scoped to exactly `select`/`insert`/`update` — no `delete` policy exists, since there's no user-facing "remove my preferences" action. This project already learned the cost of an overly broad policy the hard way with the Currency & Missions feature's `mission_events` table, which shipped with a `for all` policy and needed a same-day hardening pass to narrow it; this table starts narrow instead.

- **Anti-guilt copy constraint (verbatim from the spec's Behavior section, inherited from Diario/Bond Score):** "the email must never reference, imply, or hint at how long the user has been away, how many days they've missed, or use language framing the pet as waiting/missing them. It only ever states that something positive is available right now."

- **Service-role-client-only-in-cron-route security constraint (verbatim from the spec's Architecture section):** "this client is imported ONLY by the cron route — never by anything reachable from a Server Action, a Client Component, or any user-facing request path. The service-role key is a new, meaningfully more powerful credential than anything else in this app (a leak bypasses every RLS policy across every table), stored as its own env var (`SUPABASE_SERVICE_ROLE_KEY`, server-side only, never `NEXT_PUBLIC_`-prefixed)."

- **Exact email content (locked in, do not paraphrase):** Subject `🎁 Tu bono diario te espera`. Body message: *"¡Hola! Tu bono diario de monedas ya está disponible. Pasá a buscarlo cuando quieras 🎁"* plus a button/link reading "Ir a mi mascota" pointing at `${NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/pet`. The full HTML string is defined once, in Task 4, and not reworded anywhere else.

- **Frequency guarantee (verbatim from the spec's Behavior section):** "at most one email per user per calendar day is guaranteed across sequential cron runs (including retries after a failure) — the check-then-send-then-write sequence is not atomic, so two genuinely concurrent/overlapping invocations could theoretically both send before either's write-back completes. This is an accepted, extremely low-probability property at this feature's schedule (once daily) and scale, not a defect to fix." A failed send must NOT update `last_daily_bonus_email_sent_date` (so a later cron run retries it); a successful send counts as `sent` even if the subsequent status-update write itself fails (a documented, accepted risk of one duplicate email on a rare failure — never a crash).

- **Testing philosophy (established, do not deviate):** `lib/notifications.ts` (pure logic) gets full TDD Vitest coverage in Task 2. `lib/email.ts`, `lib/supabase/admin.ts`, the cron route, and the UI get **no automated tests** — verified only via `npm run build` plus the manual/live-Supabase/live-Resend verification in Task 6, exactly like every prior feature's I/O layer (`lib/missions-sync.ts`, `lib/bond-sync.ts`, `lib/diary-sync.ts`).

- `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, and the three new keys this feature adds — `RESEND_API_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) is gitignored and does not exist in a fresh worktree — Task 6's live verification requires all of these to already be present in the working directory (copy them in manually if executing this plan from a fresh worktree). Adding real values for the three new keys is not itself a tracked file change in this plan — only their template entries in `.env.local.example` (Task 4) are.

- Package manager: npm. Tests: `npx vitest run` / `npm run test`. Build: `npm run build`.

---

### Task 1: Schema — `notification_preferences` table + `NotificationPreferences` type

**Files:**
- Modify: `supabase/schema.sql` (append only)
- Create: `lib/notifications.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the `notification_preferences` table + its 3 RLS policies in the real Supabase project (consumed by the cron route in Task 4 and the Server Action in Task 5); the `NotificationPreferences` interface exported from `lib/notifications.ts` (consumed by `shouldSendDailyBonusEmail` in Task 2 and the cron route in Task 4).

- [ ] **Step 1: Append the new schema block to `supabase/schema.sql`**

Append to the end of `supabase/schema.sql` (do not touch any existing content above it):

```sql

-- --- Notification Infrastructure: daily bonus email opt-in (added 2026-08-26) ---
-- Every table/column above this point is already live in the Supabase project.
-- Run ONLY the block below (SQL Editor > New query > Run) — do not re-run the
-- whole file. This creates a new table, so re-running this exact block a
-- second time will error on "relation already exists" rather than no-op —
-- same one-time-only caveat as every other dated block in this file.

create table notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_bonus_email_enabled boolean not null default false,
  last_daily_bonus_email_sent_date date
);

alter table notification_preferences enable row level security;

-- Scoped to exactly select/insert/update (no delete — there's no
-- user-facing "remove my preferences" action) from the start, rather than a
-- broad `for all` policy. This project already learned that lesson the hard
-- way with the Currency & Missions feature's mission_events table, which
-- shipped with `for all` and needed a same-day hardening pass to narrow it.
create policy "Users read their own notification preferences"
  on notification_preferences for select
  using (auth.uid() = user_id);

create policy "Users create their own notification preferences"
  on notification_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users update their own notification preferences"
  on notification_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 2: Create `lib/notifications.ts` with the `NotificationPreferences` type**

Create `lib/notifications.ts`:
```typescript
export interface NotificationPreferences {
  daily_bonus_email_enabled: boolean;
  last_daily_bonus_email_sent_date: string | null;
}
```

- [ ] **Step 3: Verify the project still builds**

Run: `npm run build`
Expected: build succeeds with no TypeScript/ESLint errors. `NotificationPreferences` has no consumer yet (that starts in Task 2) — an unused exported type is not a build error in this project's `tsconfig.json` (no `noUnusedLocals`), matching the same precedent already set by `lib/bond-sync.ts`'s Task 3 in the Bond Score plan.

- [ ] **Step 4: Manually run only the new SQL against the real Supabase project**

Open the Supabase Dashboard for this project → SQL Editor → New query → paste **only** the new block from Step 1 (from `-- --- Notification Infrastructure:` down to the final `create policy` statement) → Run.

Expected: "Success. No rows returned." Then check Table Editor: a new `notification_preferences` table exists with columns `user_id` (uuid, primary key), `daily_bonus_email_enabled` (boolean, default `false`, not null), `last_daily_bonus_email_sent_date` (date, nullable). Under RLS Policies for this table, confirm exactly 3 policies are listed (select/insert/update) and RLS is enabled.

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql lib/notifications.ts
git commit -m "feat: add notification_preferences table and NotificationPreferences type"
```

---

### Task 2: `lib/notifications.ts` — `shouldSendDailyBonusEmail` pure logic (TDD)

This is the centerpiece of the feature. Follow strict RED-then-GREEN TDD.

**Files:**
- Modify: `lib/notifications.ts` (add `shouldSendDailyBonusEmail`)
- Create: `lib/notifications.test.ts`

**Interfaces:**
- Consumes: `computePeriodKey(period: MissionPeriod, now: Date): string` and `shouldGrantDailyBonus(lastDailyBonusAt: string | null, now: Date): boolean` from `./missions` (existing); `type PetRow` from `./pet-engine` (existing); `NotificationPreferences` from `./notifications` (Task 1, same file).
- Produces: `shouldSendDailyBonusEmail(pet: PetRow, prefs: NotificationPreferences, now: Date): boolean` — consumed by the cron route (Task 4).

- [ ] **Step 1: Write failing tests for `shouldSendDailyBonusEmail`**

Create `lib/notifications.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { shouldSendDailyBonusEmail, type NotificationPreferences } from './notifications';
import { computePeriodKey, shouldGrantDailyBonus } from './missions';
import type { PetRow } from './pet-engine';

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

function makePrefs(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return {
    daily_bonus_email_enabled: true,
    last_daily_bonus_email_sent_date: null,
    ...overrides,
  };
}

describe('shouldSendDailyBonusEmail', () => {
  it('returns false when daily_bonus_email_enabled is false, regardless of other state', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');

    // Bonus unclaimed, never emailed before — would otherwise be eligible.
    expect(
      shouldSendDailyBonusEmail(
        makePet({ last_daily_bonus_at: null }),
        makePrefs({ daily_bonus_email_enabled: false, last_daily_bonus_email_sent_date: null }),
        now
      )
    ).toBe(false);

    // Bonus already claimed today too — still false, for the same reason.
    expect(
      shouldSendDailyBonusEmail(
        makePet({ last_daily_bonus_at: '2026-08-23T08:00:00.000Z' }),
        makePrefs({ daily_bonus_email_enabled: false, last_daily_bonus_email_sent_date: '2026-08-22' }),
        now
      )
    ).toBe(false);
  });

  it("returns false when last_daily_bonus_email_sent_date already equals today's date-key, even if the bonus is also unclaimed", () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    const pet = makePet({ last_daily_bonus_at: null });
    const prefs = makePrefs({ daily_bonus_email_enabled: true, last_daily_bonus_email_sent_date: '2026-08-23' });
    expect(shouldSendDailyBonusEmail(pet, prefs, now)).toBe(false);
  });

  it('returns true when enabled, bonus unclaimed today (never claimed at all), and never emailed before', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    const pet = makePet({ last_daily_bonus_at: null });
    const prefs = makePrefs({ daily_bonus_email_enabled: true, last_daily_bonus_email_sent_date: null });
    expect(shouldSendDailyBonusEmail(pet, prefs, now)).toBe(true);
  });

  it('returns true when enabled, bonus unclaimed today (last claimed yesterday), and last emailed on a different past day', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    const pet = makePet({ last_daily_bonus_at: '2026-08-22T09:00:00.000Z' });
    const prefs = makePrefs({ daily_bonus_email_enabled: true, last_daily_bonus_email_sent_date: '2026-08-21' });
    expect(shouldSendDailyBonusEmail(pet, prefs, now)).toBe(true);
  });

  it('returns false when enabled but the bonus was already claimed today, even if never emailed before', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    const pet = makePet({ last_daily_bonus_at: '2026-08-23T08:00:00.000Z' });
    const prefs = makePrefs({ daily_bonus_email_enabled: true, last_daily_bonus_email_sent_date: null });
    expect(shouldSendDailyBonusEmail(pet, prefs, now)).toBe(false);
  });

  it('composes correctly with the real computePeriodKey/shouldGrantDailyBonus implementations across a UTC day boundary', () => {
    // Bonus claimed just before midnight UTC on 2026-08-22; "now" is just
    // after midnight UTC the next day. This is an integration-style test —
    // it imports the real lib/missions.ts functions (no mocks) specifically
    // to prove the reused day-key/day-boundary logic actually composes
    // correctly with shouldSendDailyBonusEmail's own todayKey comparison,
    // not just that each piece passes in isolation.
    const pet = makePet({ last_daily_bonus_at: '2026-08-22T23:59:00.000Z' });
    const now = new Date('2026-08-23T00:01:00.000Z');
    const prefs = makePrefs({ daily_bonus_email_enabled: true, last_daily_bonus_email_sent_date: '2026-08-22' });

    // Sanity-check the reused primitives agree this is a new day before
    // asserting on the function under test.
    expect(computePeriodKey('daily', now)).toBe('2026-08-23');
    expect(shouldGrantDailyBonus(pet.last_daily_bonus_at, now)).toBe(true);

    expect(shouldSendDailyBonusEmail(pet, prefs, now)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run lib/notifications.test.ts`
Expected: FAIL — `shouldSendDailyBonusEmail` is not exported from `./notifications` (the module currently only exports the `NotificationPreferences` type from Task 1).

- [ ] **Step 3: Implement `shouldSendDailyBonusEmail`**

Find (the entire current content of `lib/notifications.ts` from Task 1):
```typescript
export interface NotificationPreferences {
  daily_bonus_email_enabled: boolean;
  last_daily_bonus_email_sent_date: string | null;
}
```

Replace with:
```typescript
import { computePeriodKey, shouldGrantDailyBonus } from './missions';
import type { PetRow } from './pet-engine';

export interface NotificationPreferences {
  daily_bonus_email_enabled: boolean;
  last_daily_bonus_email_sent_date: string | null;
}

// Eligibility check for the one working notification trigger this feature
// ships: "your daily bonus is ready". Pure and side-effect free — the cron
// route (app/api/cron/daily-notifications/route.ts) is the only caller, and
// it alone is responsible for the actual email send and the
// last_daily_bonus_email_sent_date write-back.
//
// Reuses shouldGrantDailyBonus (lib/missions.ts) for "bonus not yet claimed
// today" and computePeriodKey('daily', now) (also lib/missions.ts) for
// "already emailed today" — both already-tested UTC-day-key primitives this
// codebase's other daily-scoped features (missions, bond score) already
// rely on. Never reimplements date comparison itself.
export function shouldSendDailyBonusEmail(pet: PetRow, prefs: NotificationPreferences, now: Date): boolean {
  if (!prefs.daily_bonus_email_enabled) return false;

  const todayKey = computePeriodKey('daily', now);
  if (prefs.last_daily_bonus_email_sent_date === todayKey) return false;

  return shouldGrantDailyBonus(pet.last_daily_bonus_at, now);
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run lib/notifications.test.ts`
Expected: all 6 tests PASS.

- [ ] **Step 5: Run the whole repo's test suite as a sanity check**

Run: `npm run test`
Expected: every suite passes, including `lib/notifications.test.ts`'s 6 tests alongside `lib/pet-engine.test.ts`, `lib/diary.test.ts`, `lib/missions.test.ts`, `lib/items.test.ts`, `lib/bond.test.ts`, `lib/gemini-client.test.ts`, `lib/onboarding-orchestration.test.ts`, and `lib/validate-photo-files.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add lib/notifications.ts lib/notifications.test.ts
git commit -m "feat: add shouldSendDailyBonusEmail eligibility logic with full TDD coverage"
```

---

### Task 3: `npm install resend` + `lib/email.ts` + `lib/supabase/admin.ts`

**Files:**
- Modify: `package.json`, `package-lock.json` (via `npm install`)
- Create: `lib/supabase/admin.ts`
- Create: `lib/email.ts`

**Interfaces:**
- Consumes: `createClient` from the `@supabase/supabase-js` package (already a dependency); `Resend` from the new `resend` package.
- Produces: `createAdminClient(): SupabaseClient` from `lib/supabase/admin.ts` (consumed by the cron route in Task 4, and by nothing else — see the security constraint above); `sendEmail(to: string, subject: string, html: string): Promise<{ error: string | null }>` from `lib/email.ts` (consumed by the cron route in Task 4).

- [ ] **Step 1: Install the `resend` dependency**

Run: `npm install resend`
Expected: `package.json`'s `dependencies` now includes a `"resend"` entry, and `package-lock.json` is updated to match.

- [ ] **Step 2: Create the service-role Supabase client**

Create `lib/supabase/admin.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';

// Service-role Supabase client — bypasses Row Level Security entirely.
//
// SECURITY: this client must NEVER be imported by anything reachable from a
// Server Action, a Client Component, or any user-facing request path. It
// exists solely for app/api/cron/daily-notifications/route.ts, a trusted
// backend job with no logged-in user, which needs to read across every
// user's notification_preferences/pets rows and look up emails via
// supabase.auth.admin.getUserById — both impossible through the normal
// session-scoped client in lib/supabase/server.ts, since every RLS policy in
// this app is scoped to auth.uid() = user_id and a cron request authenticates
// as nobody. SUPABASE_SERVICE_ROLE_KEY is a strictly more powerful credential
// than anything else in this app: a leak bypasses every RLS policy on every
// table. Keep its use confined to that one route.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

- [ ] **Step 3: Create the email-sending wrapper**

Create `lib/email.ts`:
```typescript
import { Resend } from 'resend';

// Thin I/O wrapper around Resend's send API. Never throws — mirrors every
// other I/O module's contract in this codebase (lib/missions-sync.ts,
// lib/bond-sync.ts): wraps the external call in try/catch. Unlike those
// lazy, fire-and-forget sync modules, this function's caller (the cron
// route) needs to know per-send success/failure to build its
// { sent, skipped, failed } summary, so failure is surfaced as a returned
// { error: string } instead of only being logged.
//
// `from` uses Resend's onboarding@resend.dev sandbox sender, which requires
// zero DNS/domain setup and works immediately for any Resend account — right
// for this project's current stage, since no verified custom domain exists
// yet. Swap this constant for a verified domain address once one exists; no
// other code changes are needed.
const FROM_ADDRESS = 'Pets Forever <onboarding@resend.dev>';

export async function sendEmail(to: string, subject: string, html: string): Promise<{ error: string | null }> {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('sendEmail: Resend returned an error', error);
      return { error: error.message };
    }

    return { error: null };
  } catch (err) {
    console.error('sendEmail: unexpected error sending email', err);
    return { error: err instanceof Error ? err.message : 'Unknown error sending email.' };
  }
}
```

- [ ] **Step 4: Verify the project still builds**

Run: `npm run build`
Expected: build succeeds with no TypeScript/ESLint errors. Neither `createAdminClient` nor `sendEmail` has a consumer yet (that's Task 4) — an unused exported function is not a build error in this project, matching the same precedent as `lib/bond-sync.ts` in the Bond Score plan.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/supabase/admin.ts lib/email.ts
git commit -m "feat: add resend dependency, email sender, and service-role Supabase client"
```

---

### Task 4: Cron route (`app/api/cron/daily-notifications/route.ts`) + `vercel.json`

**Files:**
- Create: `app/api/cron/daily-notifications/route.ts`
- Create: `vercel.json`
- Modify: `.env.local.example`

**Interfaces:**
- Consumes: `createAdminClient()` from `@/lib/supabase/admin` (Task 3); `sendEmail(to, subject, html)` from `@/lib/email` (Task 3); `shouldSendDailyBonusEmail(pet, prefs, now)`, `type NotificationPreferences` from `@/lib/notifications` (Task 2); `computePeriodKey('daily', now)` from `@/lib/missions` (existing); `type PetRow` from `@/lib/pet-engine` (existing).
- Produces: the `GET`/`POST` Route Handlers at `/api/cron/daily-notifications`, returning `{ sent: number, skipped: number, failed: number }` as JSON with HTTP 200 on any completed run, or `{ error: string }` with HTTP 401 on a missing/mismatched `Authorization` header. Consumed by Vercel Cron (via `vercel.json`) and by the manual curl verification in Task 6.

- [ ] **Step 1: Create the cron route**

Create `app/api/cron/daily-notifications/route.ts`:
```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { shouldSendDailyBonusEmail, type NotificationPreferences } from '@/lib/notifications';
import { computePeriodKey } from '@/lib/missions';
import type { PetRow } from '@/lib/pet-engine';

interface NotificationPreferenceRow {
  user_id: string;
  last_daily_bonus_email_sent_date: string | null;
}

const SUBJECT = '🎁 Tu bono diario te espera';

function buildEmailHtml(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `<div style="font-family: sans-serif; font-size: 16px; line-height: 1.5; color: #4A3222;">
  <p>¡Hola! Tu bono diario de monedas ya está disponible. Pasá a buscarlo cuando quieras 🎁</p>
  <p>
    <a
      href="${appUrl}/pet"
      style="display: inline-block; padding: 10px 24px; background-color: #8B5CF6; color: #ffffff; text-decoration: none; border-radius: 999px; font-weight: bold;"
    >
      Ir a mi mascota
    </a>
  </p>
</div>`;
}

// Vercel Cron always invokes this route with HTTP GET (see vercel.json),
// automatically sending CRON_SECRET as a Bearer token in the Authorization
// header. POST is also exposed, calling the exact same logic, purely so this
// route can be exercised manually during development with a plain curl
// -X POST — both methods enforce the same auth check below and are
// otherwise identical.
async function handleDailyNotifications(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const todayKey = computePeriodKey('daily', now);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const { data: prefsData, error: prefsError } = await supabase
    .from('notification_preferences')
    .select('user_id, last_daily_bonus_email_sent_date')
    .eq('daily_bonus_email_enabled', true);

  if (prefsError) {
    console.error('daily-notifications cron: failed to load notification preferences', prefsError);
    return NextResponse.json({ sent, skipped, failed }, { status: 200 });
  }

  const prefsRows = (prefsData ?? []) as NotificationPreferenceRow[];
  if (prefsRows.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, failed: 0 }, { status: 200 });
  }

  const userIds = prefsRows.map((row) => row.user_id);

  const { data: petsData, error: petsError } = await supabase.from('pets').select('*').in('user_id', userIds);

  if (petsError) {
    console.error('daily-notifications cron: failed to load pets', petsError);
    return NextResponse.json({ sent, skipped, failed }, { status: 200 });
  }

  const pets = (petsData ?? []) as PetRow[];
  const petByUserId = new Map(pets.map((pet) => [pet.user_id, pet]));

  const html = buildEmailHtml();

  for (const prefRow of prefsRows) {
    // A user could theoretically have opted in but have no pet yet (should
    // not happen in practice, since onboarding always creates one) — skip
    // rather than crash if the pets query returned fewer rows than user_ids.
    const pet = petByUserId.get(prefRow.user_id);
    if (!pet) {
      skipped += 1;
      continue;
    }

    const prefs: NotificationPreferences = {
      daily_bonus_email_enabled: true,
      last_daily_bonus_email_sent_date: prefRow.last_daily_bonus_email_sent_date,
    };

    if (!shouldSendDailyBonusEmail(pet, prefs, now)) {
      skipped += 1;
      continue;
    }

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(prefRow.user_id);
    if (userError || !userData?.user?.email) {
      console.error('daily-notifications cron: failed to look up user email', prefRow.user_id, userError);
      failed += 1;
      continue;
    }

    const { error: sendError } = await sendEmail(userData.user.email, SUBJECT, html);
    if (sendError) {
      console.error('daily-notifications cron: failed to send email', prefRow.user_id, sendError);
      failed += 1;
      continue;
    }

    // The email genuinely went out — count it as sent even if the
    // status-update write below fails. A failed status-update risks a
    // duplicate email on the next cron run, which is an accepted, documented
    // limitation, not a crash.
    sent += 1;

    const { error: updateError } = await supabase
      .from('notification_preferences')
      .update({ last_daily_bonus_email_sent_date: todayKey })
      .eq('user_id', prefRow.user_id);

    if (updateError) {
      console.error(
        'daily-notifications cron: email sent but failed to update last_daily_bonus_email_sent_date',
        prefRow.user_id,
        updateError
      );
    }
  }

  return NextResponse.json({ sent, skipped, failed }, { status: 200 });
}

export async function GET(request: NextRequest) {
  return handleDailyNotifications(request);
}

export async function POST(request: NextRequest) {
  return handleDailyNotifications(request);
}
```

- [ ] **Step 2: Create `vercel.json`**

Create `vercel.json` at the repository root:
```json
{
  "crons": [
    { "path": "/api/cron/daily-notifications", "schedule": "0 12 * * *" }
  ]
}
```

- [ ] **Step 3: Add the three new env vars to `.env.local.example`**

Find:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GEMINI_API_KEY=
```

Replace with:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GEMINI_API_KEY=
RESEND_API_KEY=
CRON_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
```
(`NEXT_PUBLIC_APP_URL` is optional — `buildEmailHtml()` above falls back to `http://localhost:3000` when it is unset, which is correct for local development. Set it to the real Vercel deployment URL, e.g. `https://pets-forever.vercel.app`, once one exists; no code change is needed when that happens.)

- [ ] **Step 4: Verify the project still builds**

Run: `npm run build`
Expected: build succeeds with no TypeScript/ESLint errors, and the build output lists `/api/cron/daily-notifications` as a new Route Handler (`ƒ /api/cron/daily-notifications`).

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/daily-notifications/route.ts vercel.json .env.local.example
git commit -m "feat: add daily-notifications cron route and Vercel Cron schedule"
```

---

### Task 5: UI — nav pill + `/pet/notificaciones` page + toggle

**Files:**
- Create: `app/pet/notificaciones/actions.ts`
- Create: `app/pet/notificaciones/NotificationToggle.tsx`
- Create: `app/pet/notificaciones/page.tsx`
- Modify: `app/pet/page.tsx`

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/server` (existing); `type PetRow` from `@/lib/pet-engine` (existing).
- Produces: `setDailyBonusEmailEnabled(enabled: boolean): Promise<{ error: string | null }>` Server Action (consumed by `NotificationToggle`); the `NotificationToggle` client component (`{ initialEnabled: boolean }` props, consumed by the new page); the `/pet/notificaciones` route; the new "✉️ Notificaciones" nav pill on `/pet`.

- [ ] **Step 1: Create the Server Action**

Create `app/pet/notificaciones/actions.ts`:
```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function setDailyBonusEmailEnabled(enabled: boolean): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not logged in.' };

  const { error } = await supabase
    .from('notification_preferences')
    .upsert({ user_id: user.id, daily_bonus_email_enabled: enabled }, { onConflict: 'user_id' });

  if (error) return { error: error.message };

  revalidatePath('/pet/notificaciones');
  return { error: null };
}
```

- [ ] **Step 2: Create the toggle Client Component**

Create `app/pet/notificaciones/NotificationToggle.tsx`:
```tsx
'use client';

import { useState, useTransition } from 'react';
import { setDailyBonusEmailEnabled } from './actions';

export function NotificationToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    const next = !enabled;
    startTransition(async () => {
      const result = await setDailyBonusEmailEnabled(next);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setEnabled(next);
      }
    });
  }

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-center text-sm font-semibold text-[#F4436C]">{error}</p>}
      <label className="flex items-center justify-between gap-3">
        <span className="font-[family-name:var(--font-display)] font-bold text-[#4A3222]">
          Avisarme cuando mi bono diario esté listo
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={handleToggle}
          disabled={isPending}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            enabled ? 'bg-[#8B5CF6]' : 'bg-[#D8C7A8]'
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-[0_2px_0_rgba(0,0,0,0.15)] transition-transform ${
              enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`}
          />
        </button>
      </label>
    </div>
  );
}
```

- [ ] **Step 3: Create the page**

Create `app/pet/notificaciones/page.tsx`:
```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { PetRow } from '@/lib/pet-engine';
import { NotificationToggle } from './NotificationToggle';

const cardClass =
  'rounded-[2rem] border-8 border-[#6B4226] ring-4 ring-inset ring-[#C89B6C] bg-[#FFF9EC] p-6 shadow-[inset_0_3px_6px_rgba(0,0,0,0.15),0_10px_20px_rgba(0,0,0,0.25)]';

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) redirect('/onboarding');

  const petRow = pet as PetRow;

  // May not exist yet if the user has never toggled this before — a missing
  // row means "not opted in," so it's treated as disabled by default rather
  // than backfilled.
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('daily_bonus_email_enabled')
    .eq('user_id', user.id)
    .maybeSingle();

  const dailyBonusEmailEnabled = prefs?.daily_bonus_email_enabled ?? false;

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-gradient-to-b from-[#BEE7F5] to-[#B7E4A0] px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/pet" className="text-sm font-semibold text-[#4A3222] underline">
            ← Back
          </Link>
          <h1 className="text-xl font-[family-name:var(--font-display)] font-bold text-[#4A3222]">
            {petRow.name}&apos;s Notificaciones
          </h1>
        </div>

        <div className={cardClass}>
          <NotificationToggle initialEnabled={dailyBonusEmailEnabled} />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Add the nav pill to `app/pet/page.tsx`**

Find:
```tsx
            <Link
              href="/pet/diary"
              className="rounded-full bg-[#F0DEB4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20"
            >
              📔 Diario
            </Link>
          </div>
        </div>
```

Replace with:
```tsx
            <Link
              href="/pet/diary"
              className="rounded-full bg-[#F0DEB4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20"
            >
              📔 Diario
            </Link>
            <Link
              href="/pet/notificaciones"
              className="rounded-full bg-[#F0DEB4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20"
            >
              ✉️ Notificaciones
            </Link>
          </div>
        </div>
```

- [ ] **Step 5: Verify the project builds**

Run: `npm run build`
Expected: build succeeds with no TypeScript/ESLint errors, and the build output lists `/pet/notificaciones` as a new route.

This task deliberately **skips any live browser smoke-test step** — verifying `/pet/notificaciones` renders and toggles correctly against a real logged-in user is deferred to Task 6, matching how every prior feature's UI task in this codebase handled this same situation.

- [ ] **Step 6: Commit**

```bash
git add app/pet/notificaciones/actions.ts app/pet/notificaciones/NotificationToggle.tsx app/pet/notificaciones/page.tsx app/pet/page.tsx
git commit -m "feat: add notification opt-in toggle page and nav pill"
```

---

### Task 6: End-to-end manual verification against the real Supabase project and a real Resend account

This app has no local Supabase CLI/Docker and no local email sandbox, so everything touching real Postgres or a real inbox is verified manually here rather than via automated tests, per the app's established testing approach. No code changes are expected in this task; if a check below surfaces a bug, fix it and commit that fix separately using the same `git add` + `git commit` convention as the tasks above.

- [ ] **Step 1: Run the full automated suite**

Run: `npm run test`
Expected: every Vitest suite passes, including `lib/notifications.test.ts`'s 6 tests alongside `lib/pet-engine.test.ts`, `lib/diary.test.ts`, `lib/missions.test.ts`, `lib/items.test.ts`, `lib/bond.test.ts`, `lib/gemini-client.test.ts`, `lib/onboarding-orchestration.test.ts`, and `lib/validate-photo-files.test.ts`.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: succeeds with no TypeScript/ESLint errors.

- [ ] **Step 3: Confirm the schema change is live** (repeats Task 1 Step 4 as a final sanity check)

In the Supabase Dashboard → Table Editor: confirm `notification_preferences` exists with `user_id` (uuid, PK), `daily_bonus_email_enabled` (boolean, default `false`), `last_daily_bonus_email_sent_date` (date, nullable), RLS enabled, and exactly 3 policies (select/insert/update).

- [ ] **Step 4: Confirm the service-role client is imported only by the cron route**

Run: `grep -rln "supabase/admin" app lib --include="*.ts" --include="*.tsx"`
Expected: the only match is `app/api/cron/daily-notifications/route.ts` (`lib/supabase/admin.ts` itself does not match this pattern, since it doesn't reference its own path). This is the concrete verification of the Global Constraints' service-role-client-only-in-cron-route security rule.

- [ ] **Step 5: Ensure `.env.local` has all required keys, then start the dev server**

Confirm `.env.local` (gitignored, not part of this plan's tracked file changes) has real values for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RESEND_API_KEY` (from a real Resend account, free tier), `CRON_SECRET` (any random string of at least 16 characters), and `SUPABASE_SERVICE_ROLE_KEY` (from the Supabase Dashboard → Project Settings → API → `service_role` secret). Run: `npm run dev`.

- [ ] **Step 6: Verify the cron route rejects unauthenticated requests**

Run:
```bash
curl -i -X POST http://localhost:3000/api/cron/daily-notifications
curl -i -X POST http://localhost:3000/api/cron/daily-notifications -H "Authorization: Bearer wrong-secret"
```
Expected: both return HTTP `401` with body `{"error":"Unauthorized"}`, and neither logs any database query (confirming Step (a) of the cron logic — no DB access happens before the auth check passes).

- [ ] **Step 7: Verify the cron route with zero opted-in users**

Ensure no rows exist yet in `notification_preferences` (fresh table from Step 3, or delete any test rows). Run:
```bash
curl -i -X POST http://localhost:3000/api/cron/daily-notifications -H "Authorization: Bearer $CRON_SECRET"
```
Expected: HTTP `200` with body `{"sent":0,"skipped":0,"failed":0}`.

- [ ] **Step 8: Opt in via the UI and confirm the row appears**

Sign in as a test user with an existing pet (or complete onboarding to create one). Navigate to `/pet`, confirm the new "✉️ Notificaciones" pill appears in the nav row alongside 🏠/🎯/📔, and click it. On `/pet/notificaciones`, confirm the toggle starts in the "off" position, click it to turn it on, and confirm it visually flips to "on" with no error message. In the Supabase Dashboard → Table Editor → `notification_preferences`, confirm a row now exists for this user with `daily_bonus_email_enabled = true` and `last_daily_bonus_email_sent_date = null`. Reload `/pet/notificaciones` and confirm the toggle still shows "on" (persisted, not just local state).

- [ ] **Step 9: Trigger a real send and confirm the email arrives**

In the Supabase Dashboard → Table Editor → `pets`, confirm this test user's pet has `last_daily_bonus_at` either `null` or set to a UTC date before today (so `shouldGrantDailyBonus` is true) — backdate it manually if needed. Run:
```bash
curl -i -X POST http://localhost:3000/api/cron/daily-notifications -H "Authorization: Bearer $CRON_SECRET"
```
Expected: HTTP `200` with body `{"sent":1,"skipped":0,"failed":0}`. Check the test user's real inbox (the email address they signed up with) for a message from "Pets Forever" with subject `🎁 Tu bono diario te espera`, containing the body text *"¡Hola! Tu bono diario de monedas ya está disponible. Pasá a buscarlo cuando quieras 🎁"* and an "Ir a mi mascota" button linking to `/pet`. In Table Editor → `notification_preferences`, confirm `last_daily_bonus_email_sent_date` for this user is now today's UTC date.

- [ ] **Step 10: Verify the frequency guarantee — running the cron route twice sends at most one email**

Immediately run the same curl command again:
```bash
curl -i -X POST http://localhost:3000/api/cron/daily-notifications -H "Authorization: Bearer $CRON_SECRET"
```
Expected: HTTP `200` with body `{"sent":0,"skipped":1,"failed":0}` — this same user is now reported as `skipped`, not `sent`, because `last_daily_bonus_email_sent_date` already equals today's date-key. Confirm no second email arrives in the test inbox. This is the concrete proof of the spec's frequency guarantee holding across repeated/retried cron invocations.

---

## Self-Review

**Spec coverage:** every section of `docs/superpowers/specs/2026-08-26-notification-infrastructure-design.md` maps to a task.
- "Goals" (opt-in daily-bonus email; generic reusable plumbing; anti-guilt copy) → Task 5 (opt-in UI), Tasks 2–4 (the generic layers: eligibility logic, email sender, admin client, cron route), and the anti-guilt constraint copied verbatim into Global Constraints and Task 4's `buildEmailHtml()`.
- "Non-goals" (no push, no other Apego triggers, no general settings page, no send-time customization, no absence-based trigger) → nothing in this plan builds any of these; `/pet/notificaciones` (Task 5) has exactly one toggle, and the cron route (Task 4) has exactly one fixed 12:00 UTC schedule with no per-user timing.
- "Behavior: Opt-in" (off by default, new nav pill, `/pet/notificaciones`, Server Action upsert) → Task 5 in full.
- "Behavior: Trigger condition" (`daily_bonus_email_enabled = true`, bonus unclaimed today via `shouldGrantDailyBonus`, not already emailed today via `computePeriodKey`) → Task 2's `shouldSendDailyBonusEmail` and its 6 tests, consumed by Task 4's cron route Step (f)/(g).
- "Email content" (exact subject/body) → Global Constraints' verbatim copy and Task 4's `SUBJECT`/`buildEmailHtml()`.
- "Hard constraint on copy" → Global Constraints verbatim quote; the actual email body (Task 4) contains no reference to elapsed time or absence, only "ya está disponible" (already available) and "cuando quieras" (whenever you like).
- "Frequency guarantee" → Task 4's Step (g) logic (no update on failed send; update to today's key on success) and Task 6 Step 10's explicit two-run verification.
- "Data Model" (table + 3 RLS policies, no `delete`) → Task 1's schema block, copied verbatim from the spec.
- "Architecture: `lib/notifications.ts`" → Task 2. "Architecture: `lib/email.ts`" → Task 3. "Architecture: cron route" → Task 4. "Architecture: `lib/supabase/admin.ts`" (including its security constraint) → Task 3's file + Task 6 Step 4's grep verification. "Architecture: UI" → Task 5.
- "Scheduling" (`vercel.json`, 12:00 UTC) → Task 4 Step 2, copied verbatim from the spec.
- "Local/manual testing" (curl with `Authorization: Bearer <CRON_SECRET>`, no deployment required) → Task 6 Steps 6–10.
- "Tech Stack" (new `resend` dependency; `RESEND_API_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` env vars) → Task 3 Step 1 and Task 4 Step 3 (`.env.local.example`).

**Placeholder scan:** no TBDs, no "add appropriate error handling," no "similar to Task N" shortcuts. Every step has complete, runnable code (full file contents or exact Find/Replace pairs verified against the actual current file content of `app/pet/page.tsx` and `.env.local.example`) or an explicit manual-verification procedure with concrete expected values (exact JSON summaries, exact HTTP status codes, exact email subject/body text). The one deliberate deviation from the suggested task ordering — moving `npm install resend` into Task 3 instead of Task 4 — is implemented as an actual step in Task 3 Step 1, not left as a note, and is explained in both the Context section and inline at Task 3's top.

**Type consistency:** `NotificationPreferences` (`{ daily_bonus_email_enabled: boolean; last_daily_bonus_email_sent_date: string | null }`) is defined once in `lib/notifications.ts` (Task 1) and used identically everywhere it appears — `shouldSendDailyBonusEmail(pet: PetRow, prefs: NotificationPreferences, now: Date): boolean`'s second parameter (Task 2) and the cron route's inline construction `const prefs: NotificationPreferences = { daily_bonus_email_enabled: true, last_daily_bonus_email_sent_date: prefRow.last_daily_bonus_email_sent_date }` (Task 4) both match this shape exactly — the cron route is always allowed to hardcode `daily_bonus_email_enabled: true` there because the preceding Supabase query already filtered on `.eq('daily_bonus_email_enabled', true)`. `sendEmail(to: string, subject: string, html: string): Promise<{ error: string | null }>` (Task 3) is called in Task 4 with exactly three positional arguments in that order (`userData.user.email`, `SUBJECT`, `html`) and its `{ error }` result is destructured the same way the rest of the codebase destructures Server Action results (e.g. `app/pet/casa/actions.ts`'s `{ error }` returns). `createAdminClient()` (Task 3) takes no arguments and is called the same way in Task 4 (`const supabase = createAdminClient()`, no `await` — unlike `lib/supabase/server.ts`'s `createClient()`, which is async because it reads cookies; the admin client has no such need and Task 3's implementation is correctly synchronous). `PetRow` (existing, from `lib/pet-engine.ts`) is imported and used without modification in Tasks 2, 4, and 5 — this plan does not add or change any `PetRow` field, unlike the Bond Score plan which did.

## Critical Files for Implementation

- `supabase/schema.sql` (new `notification_preferences` table + RLS policies appended, dated 2026-08-26)
- `lib/notifications.ts`
- `lib/notifications.test.ts`
- `lib/supabase/admin.ts`
- `lib/email.ts`
- `app/api/cron/daily-notifications/route.ts`
- `vercel.json`
- `.env.local.example`
- `app/pet/notificaciones/actions.ts`
- `app/pet/notificaciones/NotificationToggle.tsx`
- `app/pet/notificaciones/page.tsx`
- `app/pet/page.tsx` (only the nav pill block is modified — read-only reference otherwise)
- `package.json` / `package-lock.json` (via `npm install resend`)
- `lib/missions.ts` (only `computePeriodKey` and `shouldGrantDailyBonus` are consumed — read-only reference, not modified)
- `lib/pet-engine.ts` (only `PetRow` is consumed — read-only reference, not modified)
- `lib/supabase/server.ts` (read-only reference — establishes why a separate admin client was needed, not modified)
