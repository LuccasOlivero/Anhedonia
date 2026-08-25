# Bond Score — Design Spec

**Date:** 2026-08-25
**Status:** Approved by user, ready for implementation planning

## Summary

A visible trust/bond score (0-100) that grows with consistent, day-over-day care and decays gradually with sustained absence. This is the first slice of the "Apego" (attachment) pillar — the roadmap's Notion board lists 13 distinct "Apego:" items; most of the rest (reciprocity gestures, personality shift, differentiated reactions, habit recognition) have nothing to attach to without a bond value existing first, so this spec scopes to only the score itself plus one tangible behavior that makes it feel real from day one: a tiered welcome-back message when the user returns to `/pet`.

## Goals

- Give the user a single, legible number that represents the depth of their relationship with the pet, growing from real consistency rather than raw action volume.
- Make the score immediately meaningful — not an inert number nobody looks at — via a welcome-back reaction tied to it.
- Keep the mechanic architecturally consistent with the rest of this codebase: a stored baseline plus a pure function that derives the current value from elapsed time, mirroring `lib/pet-engine.ts`'s stat-decay pattern exactly, rather than a event-replay or a naive persisted counter.

## Non-goals (explicitly out of scope for this spec)

- Any other item from the 13-item "Apego" backlog — reciprocity (pet does things for the user), habit detection, differentiated reactions by bond tier beyond the welcome message, personality evolving with bond history, "confidencias y conversaciones" (a much larger, separate conversational-UI feature), "legado entre generaciones" (multi-account inheritance). These are later slices that consume `bond_score` once it exists; none are designed here.
- Disambiguating "Apego: Recuerda pequeños detalles" / "La mascota recuerda al usuario" / "Historia compartida a largo plazo" against the already-shipped Diario feature — flagged in the roadmap as needing validation, not resolved by this spec.
- Any UI to manually inspect or reset the score (e.g. an admin/debug view) — the score is read-only from the user's perspective, changing only through the daily sync.
- Spending or trading the bond score — unlike coins, it is never a currency.

## Behavior

**Growth:** each UTC calendar day in which the pet had at least one care action (`mission_events` row — `fed`, `bathed_dirty`, `played`, or `medicated`) counts as a "cared-for day." A streak of consecutive cared-for days increases `bond_score` by **+3 per day**, capped at **100**. Reaching the cap takes roughly 33 days of unbroken daily care — a multi-week arc, deliberately not a same-day grind.

**Decay:** the streak breaks the moment a calendar day passes with zero care actions. The **first missed day is free** — no decay, no visible consequence, since a single busy day is normal and shouldn't read as a relationship setback. From the **second consecutive missed day onward**, `bond_score` decays by **-1 per missed day**, floored at **0**. The streak counter itself resets to 0 on the very first missed day (streak and score are tracked independently — losing the streak doesn't immediately cost score).

This decay design is a deliberate choice, made after explicitly weighing the tension against the attachment-psychology research from the Diario feature's own brainstorming (which warned against manufacturing guilt about user absence): the user chose gradual decay over "never decreases," with the one-day grace period as the mitigation that keeps a single missed day consequence-free.

**Cold start:** the first sync ever for a pet (`last_bond_sync_date is null`) initializes `last_bond_sync_date` to today with `bond_score`/`bond_streak_days` left at their defaults (0) and applies no decay for any days before the sync first runs. This is a simpler case than it might look: `lib/pet-engine.ts`'s `LIFE_STAGE_DAYS.egg` is `0` (a pet is `'baby'` immediately at creation — the real "incubation" wait is the Gemini sprite generation during onboarding, a few seconds, already its own loading state there), so there's no multi-day egg period during which care would have been impossible anyway. The cold-start rule exists only to establish the baseline on day one, not to work around a stage the user couldn't act during.

**Welcome-back message:** on every `/pet` page load, a message renders once (dismissible, does not block interaction) based on the pet's current `bond_score` tier:

| Score range | Tier label |
|---|---|
| 0-24 | Conociéndose |
| 25-49 | Cercanos |
| 50-74 | Vínculo fuerte |
| 75-100 | Inseparables |

**Hard constraint on message copy:** every tier's message celebrates the user's *presence* ("qué bueno verte", "qué alegría verte") — none may reference, imply, or hint at the user's *absence* ("te extrañé" and equivalents are explicitly disallowed), regardless of tier or how long the user was away. This mirrors the Diario spec's own explicit anti-manipulation guardrail and applies even when the score just decayed — the message is about the reunion, never about the gap.

## Data Model

```sql
alter table pets add column if not exists bond_score smallint not null default 0;
alter table pets add column if not exists bond_streak_days smallint not null default 0;
alter table pets add column if not exists last_bond_sync_date date;
```

No new table. `mission_events` (already logging every care action with `occurred_at`, shipped by the Currency & Missions feature) is the sole data source for determining which calendar days were "cared-for" — this spec adds no new event-logging responsibility to the care-action Server Actions.

`last_bond_sync_date` records the most recent UTC calendar date the score/streak were already updated through, so the lazy sync (below) can no-op on same-day repeat visits and knows exactly which date range to process on a later visit.

## Architecture

Mirrors the established three-layer pattern from every prior feature in this codebase:

- **`lib/bond.ts`** (pure, no I/O, mirrors `lib/missions.ts`): exports `computeBondTier(score: number)` mapping a score to one of the four tier labels, and a pure progression function that takes the current `{ bond_score, bond_streak_days, last_bond_sync_date }` plus the set of calendar dates that had at least one care action in the range being processed, and returns the next `{ bond_score, bond_streak_days, last_bond_sync_date }` — applying the growth/decay/grace-period rules above, day by day, for however many calendar days have elapsed since the last sync (handles a user returning after a long absence in one pass, not just the single-day case).
- **`lib/bond-sync.ts`** (I/O, mirrors `lib/missions-sync.ts`/`lib/room-sync.ts`/`lib/diary-sync.ts`): lazy, called from `/pet`'s Server Component render before re-reading pet state. No-ops immediately if `last_bond_sync_date` is already today. Otherwise reads the relevant `mission_events` date range, calls the pure function, and persists the result in one update. Never throws — same non-blocking, log-and-continue contract as every other sync module in this codebase.
- **UI**: the score renders as its own small section on `/pet`, visually separated from the four existing need-based stat bars (Hunger/Happiness/Energy/Cleanliness) — deliberately not a fifth bar in that list, since blending it in would make it read as another meter that punishes the user if left unattended, undermining the point of a relationship-depth indicator. The welcome-back message is a separate, dismissible element shown once per page load.

## Tech Stack

Same as the base app: Next.js 15 (App Router, TypeScript), Supabase (Postgres + Auth), Vitest. No new dependencies.
