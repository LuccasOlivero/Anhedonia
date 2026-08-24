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
