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
