# Tamagotchi Clone — Design Spec

**Date:** 2026-08-21
**Status:** Approved by user, ready for implementation planning

## Summary

A web app clone of a classic color Tamagotchi. Users sign up, upload 1-3
photos of their real pet, and an AI (nano-banana / Gemini 2.5 Flash Image)
generates a set of stylized virtual-pet sprites from those photos. The user
then cares for the virtual pet in real time — feeding, playing, bathing,
sleeping — with stats that decay over real elapsed time, exactly like a
physical Tamagotchi that keeps "living" while the screen is off.

## Goals

- Let a user turn a photo of their real pet into a virtual pet they care for.
- Recreate the core Tamagotchi loop: needs decay over real time, actions
  restore them, prolonged neglect causes sickness (not death).
- Ship a focused MVP: one active pet per account, simple interactions, no
  mini-games, no social/multiplayer features.

## Non-goals (explicitly out of scope for this spec)

- Multiple simultaneous pets per user.
- Pet death / permanent loss.
- Mini-games for the "play" action.
- Social features (friends, visiting other users' pets, leaderboards).
- Push notifications / reminders.
- Non-English/Spanish localization strategy (app copy language is whatever
  the implementer defaults to; not a requirement of this spec).
- Physical device look-alike UI (device shell/buttons) — this is a modern
  web dashboard, not a skeuomorphic device replica.

## Tech Stack

- **Next.js 15**, App Router, **TypeScript**.
- **Supabase**: Postgres (data), Supabase Auth (email + password), Supabase
  Storage (photo/sprite files).
- **Gemini API** (`gemini-2.5-flash-image`, aka "nano-banana") for sprite
  generation, called only from server-side code.
- **Vitest** for unit/integration tests.
- Deployed on **Vercel**.

## Architecture

```
Browser (Client Components: forms, action buttons, transient animations)
        │
        ▼
Next.js Server Components (read Supabase, compute current pet state)
        │
Next.js Server Actions (mutate Supabase: feed/play/bathe/sleep/medicine/createPet)
        │
        ├──▶ Supabase Postgres (table `pets`, RLS by user_id)
        ├──▶ Supabase Storage (buckets `pet-photos`, `pet-sprites`)
        └──▶ Gemini API (onboarding only, generates 6 sprites)
```

Key principle: the Gemini API key (`GEMINI_API_KEY`) lives only in server
environment variables and is never referenced from a Client Component.

## Data Model

Single table, plus two Storage buckets.

```sql
create table pets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  name text not null,
  created_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  hunger smallint not null default 100,      -- 0-100
  happiness smallint not null default 100,   -- 0-100
  energy smallint not null default 100,      -- 0-100
  cleanliness smallint not null default 100, -- 0-100
  is_sleeping boolean not null default false,
  sprites jsonb not null default '{}'::jsonb
  -- sprites shape: { happy, sad, eating, sleeping, dirty, sick: string (URL) }
);

alter table pets enable row level security;

create policy "Users manage their own pet"
  on pets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- `user_id unique` enforces "one active pet per account" at the DB level —
  no application-level check needed to prevent a second pet.
- **No `is_sick` or `life_stage` columns.** Both are derived at read time by
  pure functions (see Pet Engine below) from `created_at`, `last_updated_at`,
  and the four stat columns. This keeps the schema minimal and avoids
  keeping derived state in sync with stored state.

**Storage buckets:**
- `pet-photos` — private. Path convention: `{user_id}/{timestamp}-{n}.jpg`.
  Holds the original uploaded reference photos. RLS: a user may only
  read/write under their own `{user_id}/` prefix.
- `pet-sprites` — public read. Path convention:
  `{user_id}/{state}.png` where `state` is one of `happy, sad, eating,
  sleeping, dirty, sick`. RLS: a user may only write under their own
  `{user_id}/` prefix; anyone may read (sprites are simple images, not
  sensitive, and public read avoids needing signed URLs on every render).

## Pet Engine (pure functions, `lib/pet-engine.ts`)

All business logic for "how the pet behaves over time" lives in pure,
side-effect-free TypeScript functions. This is the most important part of
the app to get right and the primary target for unit tests.

**Constants:**

```typescript
const DECAY_PER_HOUR = {
  hunger: 100 / 24,       // empty in 24h
  happiness: 100 / 48,    // empty in 48h
  energy: 100 / 16,       // empty in 16h awake
  cleanliness: 100 / 30,  // empty in 30h
};
const ENERGY_REGEN_PER_HOUR_SLEEPING = 100 / 8; // full in 8h of sleep
const SICK_THRESHOLD_HOURS = 24; // consecutive hours a critical stat must
                                  // sit at 0 before the pet is sick
const LIFE_STAGE_DAYS = { egg: 2, baby: 5 }; // egg: [0,2), baby: [2,5), adult: [5,∞)
```

**Functions:**

- `computeCurrentStats(pet: PetRow, now: Date): Stats` — applies linear
  decay to each of the four stats from `pet.last_updated_at` to `now`
  (energy regenerates instead of decaying when `pet.is_sleeping` is true),
  clamped to `[0, 100]`. Does not write anything; it's a pure projection.
  **Decay never starts before the pet has hatched**: the effective decay
  start is `max(pet.last_updated_at, hatchTime)`, where `hatchTime =
  pet.created_at + LIFE_STAGE_DAYS.egg days`. This keeps the egg stage
  care-free (no stat drops, no sickness) without adding a stored "hatched"
  flag — `hatchTime` is itself derived from `created_at`.

- `computeIsSick(pet: PetRow, now: Date): boolean` — for each critical stat
  (`hunger`, `cleanliness`), algebraically solves for the timestamp at
  which that stat's decay line would cross 0 (using the stored value and
  the same effective decay-start rule as `computeCurrentStats`, i.e. never
  before `hatchTime`). If `now` is more than `SICK_THRESHOLD_HOURS` past
  the earliest such crossing, the pet is sick. If a stat's current
  computed value is above 0, it hasn't crossed yet and doesn't contribute.
  Always `false` while `lifeStage === 'egg'`.

- `computeLifeStage(createdAt: Date, now: Date): 'egg' | 'baby' | 'adult'`
  — based purely on elapsed days since `createdAt`, per `LIFE_STAGE_DAYS`.

- `computeMood(stats: Stats, isSick: boolean, isSleeping: boolean):
  SpriteState` — priority order: `sleeping` (if `isSleeping`) > `sick` (if
  `isSick`) > `dirty` (if `cleanliness < 30`) > `sad` (if `happiness < 30`)
  > `happy` (default). `eating` is never returned here — see below.

**Actions** (each: recompute `computeCurrentStats` from the stored row
first, apply the action's delta on top of the *recomputed* values, then
persist with `last_updated_at = now`):

- `feed(stats)`: `hunger = clamp(hunger + 30)`
- `play(stats)`: `happiness = clamp(happiness + 15)`, `energy = clamp(energy - 5)`
  — rejected (returns an error, no state change) if `is_sleeping`.
- `bathe(stats)`: `cleanliness = clamp(cleanliness + 40)`
- `toggleSleep(pet)`: flips `is_sleeping`
- `medicine(stats, isSick)`: only valid if `isSick` is true (otherwise
  rejected); sets `hunger = max(hunger, 50)` and `cleanliness =
  max(cleanliness, 50)`, which breaks the zero-streak so
  `computeIsSick` evaluates false afterward.

`clamp(n)` restricts to `[0, 100]`.

**`eating` sprite state**: shown client-side only, as a ~2 second transient
animation immediately after a successful `feed` action, then the UI reverts
to whatever `computeMood` returns. It is never a value `computeMood` itself
produces, since it isn't an idle/resting state.

## Onboarding Flow

1. User signs up / logs in via Supabase Auth (email + password).
2. On any authenticated page load, the app checks whether a `pets` row
   exists for `auth.uid()`. If not, redirect to `/onboarding`. If the user
   already has a pet, `/onboarding` redirects to `/pet` (enforces one pet
   per account at the routing level, in addition to the DB unique
   constraint).
3. `/onboarding` shows a form: pet name (text input) + photo upload (file
   input, accepts 1-3 images, `image/*`, max 5MB each, client-side
   validated with a preview before submit).
4. On submit, a Server Action `createPet(name, photoFiles)` runs:
   a. Uploads each photo to `pet-photos/{user_id}/{timestamp}-{n}.jpg`.
   b. Calls `generateSprite(photoUrls, state)` in parallel for each of the
      6 states (`happy, sad, eating, sleeping, dirty, sick`), where each
      call sends the uploaded photo(s) plus a per-state style prompt (e.g.
      *"cute pixel-art style virtual pet based on this reference photo,
      [state expression/pose], transparent background, 512x512"*) to the
      Gemini API.
   c. Each successful generation is uploaded to
      `pet-sprites/{user_id}/{state}.png`.
   d. If a given state's generation fails after 2 retries, that state
      falls back to a bundled placeholder for that state — a simple
      hand-authored SVG (not photo-realistic art, since no such asset
      exists to source) at `public/fallback-sprites/{state}.svg` — and its
      path is stored instead. Onboarding is never blocked by a single
      failed generation.
   e. If **all 6** generations fail (including fallbacks somehow being
      unavailable — should not happen since fallbacks are bundled
      locally, but treated as an unrecoverable case), the action returns
      `{ error }` and the UI shows a retry button; no `pets` row is
      created.
   f. Inserts the `pets` row: stats at 100, `is_sleeping = false`,
      `sprites` populated with the 6 resulting URLs (generated or
      fallback).
   g. Redirects to `/pet`.
5. While step 4 runs (can take several seconds due to 6 parallel AI
   calls), the UI shows a loading state ("incubating your pet...").

`generateSprite(photoUrls: string[], state: SpriteState): Promise<Buffer>`
is implemented as its own isolated module (`lib/gemini-client.ts`) so it
can be mocked in tests without hitting the real API.

## Visual Style

All styling uses **Tailwind CSS** utility classes (no separate CSS files beyond
`globals.css`). The visual direction is inspired by "Pet Society" (the
classic Facebook pet game): a warm cream/amber background, white cards with
thick rounded corners and soft shadows, candy-colored pill-shaped buttons
and inputs, and a friendly rounded display font (Baloo 2, via
`next/font/google`), applied globally in the root layout. The stat bars
keep the approved threshold-based coloring (green/amber/red by value) —
that's a functional urgency signal, not just decoration — reskinned as
rounded pill progress bars with a per-stat icon (🍖/😊/⚡/✨).

## Dashboard (`/pet`)

- **Server Component**: loads the user's `pets` row (redirects to
  `/onboarding` if none exists), computes `stats`, `isSick`, `lifeStage`,
  `mood` via the pet engine, and renders:
  - The pet sprite:
    - `lifeStage === 'egg'`: a static bundled egg illustration — a simple
      hand-authored SVG (`public/egg-sprite.svg`), since no photo-realistic
      egg asset exists to source — care actions hidden/disabled, message
      "your pet is about to hatch."
    - `lifeStage === 'baby'`: `pet.sprites[mood]`, rendered at ~60% scale
      via CSS.
    - `lifeStage === 'adult'`: `pet.sprites[mood]`, rendered at full scale.
  - Four stat bars (Hunger, Happiness, Energy, Cleanliness), colored by
    threshold (green ≥ 60, yellow 30-59, red < 30).
  - Action buttons: Feed, Play, Bathe, Sleep/Wake (label toggles based on
    `is_sleeping`), and Medicine (only rendered when `isSick` is true).
- Each action button is a small **Client Component** that calls its
  corresponding Server Action, optionally shows a brief optimistic
  animation (e.g. the `eating` sprite for 2s after Feed), and then the
  page resyncs via `revalidatePath('/pet')`.

## Error Handling

- **Auth forms**: Supabase Auth errors (invalid email, weak password, bad
  credentials) surface inline under the relevant field.
- **Onboarding**: per-state Gemini failures fall back silently (see
  above); total failure shows a retry button and no pet is created.
- **Photo upload**: client-side validation of file type (`image/*`) and
  size (≤ 5MB) before allowing submit.
- **Server Actions**: catch Supabase errors (RLS denial, network) and
  return `{ error: string }` rather than throwing; the calling Client
  Component renders this as an inline error/toast.
- **Business-rule violations** (e.g. `play` while sleeping, `medicine`
  while not sick) are re-validated inside the Server Action itself, not
  only by hiding the button client-side — the client is never trusted as
  the sole enforcement point.

## Testing Strategy

- **Vitest, unit tests for `lib/pet-engine.ts`**: `computeCurrentStats`,
  `computeIsSick`, `computeLifeStage`, `computeMood`, and each action
  function. All inputs (including "now") are passed as explicit
  parameters/fixed `Date` values — no wall-clock reads inside the engine —
  so tests are fully deterministic with no mocking required. This is the
  highest-priority code to cover, since it's the entire game-design logic
  of the app.
- **Integration tests for Server Actions** (`createPet`, `feed`, `play`,
  `bathe`, `toggleSleep`, `medicine`) against a local Supabase instance
  (Supabase CLI), verifying RLS and persistence behavior.
- **`generateSprite` is isolated and mockable** (`lib/gemini-client.ts`),
  so onboarding tests (including the fallback path) run without calling
  the real Gemini API.
- **Manual verification in browser**: full flow (sign up → onboarding →
  dashboard → each action → sickness → medicine) checked live before
  considering the feature done, since this is a visual/interactive
  product.

## Setup Notes (non-code, for the implementer)

- A Supabase project must exist with a `GEMINI_API_KEY` obtained from
  Google AI Studio (aistudio.google.com) placed in `.env.local`.
- For convenient local testing, consider disabling "Confirm email" in the
  Supabase Auth settings during development (otherwise each signup
  requires clicking a confirmation link before login works).
