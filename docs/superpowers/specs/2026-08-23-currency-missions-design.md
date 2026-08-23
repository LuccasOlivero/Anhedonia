# Currency & Missions — Design Spec

**Date:** 2026-08-23
**Status:** Approved by user, ready for implementation planning

## Summary

An internal currency (coins) the user earns by caring for their pet, plus a small set of daily and weekly missions that award bonus coins. This is the economic foundation for the Casa (room decorating) and Tienda (shop) features specced separately — those spend coins; this spec is where coins come from. Implemented and merged before Casa/Tienda, since both depend on it.

## Goals

- Give the user a currency earned through genuine care of their pet, not a separate grind loop.
- Add a light, optional layer of daily/weekly missions on top of that — acknowledged directly with the user as being closer to a mission/reward mechanic than the rest of this app's attachment-first direction, and deliberately kept small and low-pressure rather than a central hook.
- Keep the whole system derivable from an append-only event log, consistent with this codebase's existing "derive, don't accumulate mutable progress state" philosophy (see `lib/pet-engine.ts`, and the diary spec's `diary_entries` event log).

## Non-goals (explicitly out of scope for this spec)

- Spending coins on anything — that's the Casa/Tienda spec. This spec only earns and stores balance.
- Missions with conditions that require continuous monitoring (e.g. "keep happiness above 70% all week") — this app has no background jobs; all state is computed lazily on page load, so mission conditions must be checkable from a point-in-time query against logged events, never from "was this true continuously."
- Streaks, leaderboards, or any cross-user comparison.
- Push notifications about missions or coin balance.

## Data Model

```sql
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

`mission_events` is a raw signal log, written inline by the existing care-action Server Actions (`feed`, `bathe`, `play`, `medicine` in `app/pet/actions.ts`) at the moment they succeed — `bathed_dirty` is only logged when cleanliness was below the dirty threshold before bathing, so it reflects a real cleaning, not routine maintenance. Mission definitions live in code (a fixed list, same pattern as `SPRITE_STATES`), each with a pure function that counts matching `mission_events` within a period (`period_key` is a date string like `2026-08-23` for daily missions, an ISO week string like `2026-W34` for weekly ones) against a threshold. `mission_completions` records that a mission's reward was already paid for a given period, keyed uniquely so a mission can never be paid twice for the same period even if checked on multiple page loads.

## Earning Coins

- **Care actions**: each successful `feed`/`bathe`/`play`/`medicine` call awards a small flat coin amount (exact values decided at implementation time, small enough that missions/bonus remain meaningfully larger).
- **Daily bonus**: the first page load of the day awards a fixed bonus, tracked via `pets.last_daily_bonus_at` (no new event needed — a simple date comparison).
- **Missions**: completing a mission (checked lazily, same pattern as diary sync) awards a larger fixed bonus once per period.

## Missions (v1 content)

Daily (reset every calendar day):
- "Alimentá a tu mascota hoy" — at least 1 `fed` event today.
- "Bañala si está sucia" — at least 1 `bathed_dirty` event today (no-op / not shown as failed if the pet was never dirty today).

Weekly (reset every ISO week):
- "Jugá con ella 5 veces esta semana" — at least 5 `played` events this week.

This is intentionally a short list for v1 — missions are additive flavor on top of the coin-from-care loop, not the main mechanic.

## Tech Stack

Same as the base app: Next.js 15 (App Router, TypeScript), Supabase (Postgres + Auth), Vitest. No new dependencies.
