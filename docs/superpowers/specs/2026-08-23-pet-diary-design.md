# Pet Diary / Memory — Design Spec

**Date:** 2026-08-23
**Status:** Approved by user, ready for implementation planning

## Summary

A timeline of the relationship between the user and their virtual pet — mixing auto-detected milestones (hatching, growing up, getting sick, recovering) with short notes the user writes themselves. This is the first feature built around the app's new north star: the user should return because they feel attached to their pet, not because of a mission, reward, or event. Research on attachment theory (Bowlby's proximity maintenance / safe haven / secure base) and companion-AI studies consistently identify memory persistence, personalization, and reciprocity as the core long-term drivers of attachment — the diary is the memory piece.

## Goals

- Give the user a place to see the history of their pet: when it hatched, when it grew up, when it got sick and recovered, plus their own notes.
- Make the timeline feel like a shared album, not a log — each entry shows the pet's sprite at that moment.
- Minimize new persisted state: anything derivable from existing data stays derived, matching this codebase's existing philosophy (`computeLifeStage`, `computeIsSick` — no `is_sick`/`life_stage` columns exist today).

## Non-goals (explicitly out of scope for this spec)

- User-editable/deletable diary entries (write-once notes for now).
- Any notion of "shared" memory across accounts — one pet per account, diary is private to the owner (same as everything else in the app).
- Notifications or reminders to write a diary entry.
- "N days together" or other counted-streak milestones — deliberately excluded to avoid drifting toward a streak/reward mechanic, which is the opposite of what this feature is for.

## Psychological grounding (for context, not itself a requirement)

Attachment theory identifies four behavioral markers of a real bond: proximity maintenance, separation distress, safe haven, and secure base. The diary targets memory as the mechanism behind "secure base" and "safe haven" — a place the relationship's history lives, so the pet stops resetting to a blank slate every session. Design guardrail carried into this spec: research on companion apps explicitly flags manufactured guilt about absence as a dark pattern (e.g., a "welcome back" tone that reads as reproach). The diary never frames gaps in visits as something to apologize for.

## Data Model

One new table, deliberately minimal:

```sql
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

Two milestones are **never stored**: "hatched" (egg→baby) and "grew up" (baby→adult) are rendered as virtual timeline entries, computed on the fly from `pet.created_at` + the existing `LIFE_STAGE_DAYS` constant. Only `got_sick`, `recovered`, and `note` become real rows — the only events that are genuinely episodic and not reconstructible after the fact.

## Detection Logic

A pure, unit-testable function (mirroring `lib/pet-engine.ts`'s style) compares the pet's current derived sickness state against the most recent stored sickness-related entry:

- Sick now, no open `got_sick` entry → insert `got_sick`.
- Not sick now, an open `got_sick` entry exists → insert `recovered`.
- Otherwise, nothing changes.

This runs lazily on every diary page load — no cron, no hooks scattered across every care action — consistent with how the rest of the app computes state at read time. A background sync failing must never break the page render; it fails silently and gets picked up on the next visit.

## UI

A new `/pet/diary` route, linked from the main pet dashboard. Newest-first timeline of cards (reusing the existing signboard-card visual language), each showing: the pet's sprite for that moment, a short label (auto-events get a fixed template like "{name} se enfermó 🤒"; notes show the user's own text), and a timestamp. A short textarea at the top lets the user add a new note at any time.

## Tech Stack

Same as the base app: Next.js 15 (App Router, TypeScript), Supabase (Postgres + Auth), Vitest. No new dependencies.
