-- First-time setup: run this entire file in the Supabase Dashboard (SQL Editor > New query > Run).
-- Existing project: each dated section below is a standalone increment — run only the
-- sections you haven't applied yet, not the whole file again.
-- Prerequisite (first-time setup only): create two Storage buckets first
-- (Dashboard > Storage > New bucket):
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

-- --- Diary hardening: deferred findings from final review (added 2026-08-24) ---
-- Run ONLY the block below — do not re-run the whole file. Safe to run once;
-- the ADD CONSTRAINT statements are not wrapped in IF NOT EXISTS (Postgres
-- doesn't support that for check constraints), so re-running this exact block
-- a second time will error on "constraint already exists" rather than no-op.

-- Query pattern this indexes: `select * from diary_entries where pet_id = ...
-- order by occurred_at desc` (app/pet/diary/page.tsx).
create index if not exists diary_entries_pet_id_occurred_at_idx
  on diary_entries (pet_id, occurred_at desc);

-- Constrains mood_snapshot to the actual MoodState values (lib/pet-engine.ts) —
-- excludes 'eating', which is never stored as a mood snapshot. Without this,
-- a bad value would flow through to `petRow.sprites[entry.mood_snapshot]` in
-- app/pet/diary/page.tsx and render a broken image.
alter table diary_entries
  add constraint diary_entries_mood_snapshot_check
  check (mood_snapshot in ('happy', 'sad', 'dirty', 'sick', 'sleeping'));

-- Backstops the 280-character cap already enforced client-side (AddNoteForm's
-- maxLength) and server-side (addDiaryNote) — closes the gap where a request
-- sent directly to the API (bypassing the app's UI and Server Action) could
-- otherwise store an arbitrarily large note.
alter table diary_entries
  add constraint diary_entries_text_length_check
  check (text is null or char_length(text) <= 280);

-- Replaces the "for all" policy above (which granted UPDATE/DELETE) with
-- select/insert-only policies. The diary spec's stated intent is write-once
-- notes; the "for all" policy never actually enforced that.
drop policy if exists "Users manage their own diary entries" on diary_entries;

create policy "Users read their own diary entries"
  on diary_entries for select
  using (auth.uid() = user_id);

create policy "Users insert their own diary entries"
  on diary_entries for insert
  with check (auth.uid() = user_id);

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

-- --- Currency & Missions hardening: deferred findings from final review (added 2026-08-24) ---
-- Run ONLY the block below — do not re-run the whole file. Safe to run once;
-- the `drop policy if exists` / `create index if not exists` statements no-op
-- on a second run, but the `create policy` statements will error on "policy
-- already exists" if this exact block is re-run a second time.

-- Replaces the "for all" policies above (which granted UPDATE/DELETE) with
-- select/insert-only policies. The app only ever inserts mission events and
-- completions and reads them back — it never updates or deletes either.
drop policy if exists "Users manage their own mission events" on mission_events;

create policy "Users read their own mission events"
  on mission_events for select
  using (auth.uid() = user_id);

create policy "Users insert their own mission events"
  on mission_events for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users manage their own mission completions" on mission_completions;

create policy "Users read their own mission completions"
  on mission_completions for select
  using (auth.uid() = user_id);

create policy "Users insert their own mission completions"
  on mission_completions for insert
  with check (auth.uid() = user_id);

-- Query pattern this indexes: `select * from mission_events where pet_id = ...`
-- (lib/missions-sync.ts, app/pet/misiones/page.tsx). Postgres does not
-- auto-index foreign keys, so without this every lookup was a seq scan.
create index if not exists mission_events_pet_id_idx
  on mission_events (pet_id);

-- --- Casa & Tienda: owned items, placed items (added 2026-08-24) ---
-- Run ONLY the block below (SQL Editor > New query > Run) — do not re-run
-- the whole file. `create table if not exists` makes this safe to run even
-- if it was partially applied already.
--
-- Note on RLS: unlike the initial versions of diary_entries/mission_events/
-- mission_completions (each later had to be hardened from `for all` down to
-- narrower per-operation policies in a follow-up migration), these two
-- tables ship with the correct narrow policies from the start. The app
-- only ever inserts and selects on owned_items, and inserts/selects/deletes
-- on placed_items — neither table is ever updated in place.

create table if not exists owned_items (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references pets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  acquired_at timestamptz not null default now(),
  unique (pet_id, item_id)
);

alter table owned_items enable row level security;

create policy "Users read their own owned items"
  on owned_items for select
  using (auth.uid() = user_id);

create policy "Users insert their own owned items"
  on owned_items for insert
  with check (auth.uid() = user_id);

create table if not exists placed_items (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references pets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  position_x_pct numeric not null,
  placed_at timestamptz not null default now()
);

alter table placed_items enable row level security;

create policy "Users read their own placed items"
  on placed_items for select
  using (auth.uid() = user_id);

create policy "Users insert their own placed items"
  on placed_items for insert
  with check (auth.uid() = user_id);

create policy "Users delete their own placed items"
  on placed_items for delete
  using (auth.uid() = user_id);

-- Query pattern this indexes: `select * from owned_items where pet_id = ...`
-- / `select * from placed_items where pet_id = ...` (lib/room-sync.ts,
-- app/pet/casa/page.tsx, app/pet/casa/tienda/page.tsx). Postgres does not
-- auto-index foreign keys — added up front this time instead of as a
-- follow-up hardening task, per the lesson already learned from
-- mission_events.
create index if not exists owned_items_pet_id_idx
  on owned_items (pet_id);

create index if not exists placed_items_pet_id_idx
  on placed_items (pet_id);

-- Constrains position_x_pct to the valid placement band [0, 100]. Backstops
-- the 0–100 range validation already enforced client-side and in Server
-- Actions (later tasks) — closes the gap where a request sent directly to the
-- API could otherwise store an invalid position value.
alter table placed_items
  add constraint placed_items_position_x_pct_check
  check (position_x_pct >= 0 and position_x_pct <= 100);

-- --- Bond Score: trust/attachment score derived from daily care streaks (added 2026-08-25) ---
-- Every table/column above this point is already live in the Supabase project.
-- Run ONLY the block below (SQL Editor > New query > Run) — do not re-run the whole file.
-- `add column if not exists` makes this safe to run even if it was partially applied already.

alter table pets add column if not exists bond_score smallint not null default 0;
alter table pets add column if not exists bond_streak_days smallint not null default 0;
alter table pets add column if not exists last_bond_sync_date date;

-- --- Bond Score hardening: deferred findings from final review (added 2026-08-25) ---
-- Run ONLY the block below — do not re-run the whole file. Safe to run once;
-- the ADD CONSTRAINT statements are not wrapped in IF NOT EXISTS (Postgres
-- doesn't support that for check constraints), so re-running this exact block
-- a second time will error on "constraint already exists" rather than no-op.

-- Constrains bond_score/bond_streak_days to the ranges the app's own logic
-- already guarantees: bond_score is never client-supplied, and its only
-- writer is the pure computeNextBondState function (lib/bond.ts), which
-- already clamps bond_score to [0, 100] and never produces a negative
-- bond_streak_days. These constraints close the gap where a hand-crafted
-- REST call by a row's own owner could otherwise store an out-of-range value
-- directly, matching the precedent already set by the
-- placed_items_position_x_pct_check constraint added during the Casa &
-- Tienda feature's own hardening pass.
alter table pets add constraint pets_bond_score_check
  check (bond_score >= 0 and bond_score <= 100);

alter table pets add constraint pets_bond_streak_days_check
  check (bond_streak_days >= 0);

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
