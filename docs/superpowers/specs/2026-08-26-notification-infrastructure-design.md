# Notification Infrastructure — Design Spec

**Date:** 2026-08-26
**Status:** Approved by user, ready for implementation planning

## Summary

Generic email-notification infrastructure for Pets Forever, plus exactly one working trigger ("your daily bonus is ready") to prove the pipeline end-to-end. This is deliberately scoped as foundational plumbing, not Apego content — it exists so that a later feature (reciprocidad / iniciativa / vulnerabilidad, the next slice in the "Apego" backlog) can add its own richer, bond-tier-aware triggers without also having to build subscription storage, email sending, and scheduling from scratch.

This spec was split out of a broader "pet-initiated interaction" brainstorming session specifically because the app currently has no background-job or push-notification capability at all — every existing feature (stat decay, mission payouts, bond score) is computed lazily on page load. Reaching a user who isn't actively on the page requires genuinely new infrastructure, which is large enough to deserve its own spec, mirroring how Bond Score was built first because other Apego items needed it to exist before they could build on it.

## Goals

- Let a user opt in to a daily email reminding them their daily coin bonus is ready to claim.
- Build the underlying plumbing (subscription preference, email sending, scheduled trigger) generically enough that a later feature can add new trigger types without new infrastructure.
- Never violate the app's established anti-guilt principle (see Diario and Bond Score specs): notification copy must never reference or imply the user's absence.

## Non-goals (explicitly out of scope for this spec)

- Browser push notifications — email only for this slice. Push would need a service worker, VAPID keys, and per-device subscription storage; deferred unless email proves insufficient.
- Any Apego-flavored trigger (reciprocity gestures, pet-initiated messages, vulnerability signals) — those are the next feature, built on top of this infrastructure, not part of it.
- A general-purpose settings page — only the one notification toggle is built; a broader settings system is not designed here.
- Notification frequency/timing customization by the user (e.g., choosing send time) — fixed at one daily send for everyone who opts in.
- Any trigger that fires based on elapsed time since the user's last visit — that category of trigger inherently risks the anti-guilt principle and is deliberately deferred to a future design conversation that can address it head-on, not smuggled in here.

## Behavior

**Opt-in:** off by default. A new "✉️ Notificaciones" pill in the existing `/pet` nav row (alongside 🏠 Casa, 🎯 Misiones, 📔 Diario) leads to `/pet/notificaciones`, a minimal page with a single toggle: "Avisarme cuando mi bono diario esté listo." Toggling calls a Server Action that upserts the user's `notification_preferences` row.

**Trigger condition:** once daily, for every user with `daily_bonus_email_enabled = true`, check whether today's daily coin bonus (the existing `last_daily_bonus_at` mechanic from the Currency & Missions feature, granted via `shouldGrantDailyBonus` in `lib/missions.ts`) has NOT yet been claimed today, AND no email has already been sent today (`last_daily_bonus_email_sent_date` is not today's date). "Today" and "not yet claimed today" are both computed via the existing `computePeriodKey('daily', now)` from `lib/missions.ts` — the same UTC-day-key function every other daily-scoped feature in this codebase already uses (missions, bond score) — not a new date-comparison implementation. If both conditions hold, send the email and update `last_daily_bonus_email_sent_date` to today's key.

**Email content** (Spanish, matching the app's existing friendly/informal voice):
- Subject: `🎁 Tu bono diario te espera`
- Body: a short, warm, forward-looking message plus a link to `/pet` — e.g. *"¡Hola! Tu bono diario de monedas ya está disponible. Pasá a buscarlo cuando quieras 🎁"*

**Hard constraint on copy, inherited from Diario/Bond Score:** the email must never reference, imply, or hint at how long the user has been away, how many days they've missed, or use language framing the pet as waiting/missing them. It only ever states that something positive is available right now.

**Frequency guarantee:** at most one email per user per calendar day is guaranteed across sequential cron runs (including retries after a failure) — the check-then-send-then-write sequence is not atomic, so two genuinely concurrent/overlapping invocations could theoretically both send before either's write-back completes. This is an accepted, extremely low-probability property at this feature's schedule (once daily) and scale, not a defect to fix.

## Data Model

```sql
create table notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_bonus_email_enabled boolean not null default false,
  last_daily_bonus_email_sent_date date
);

alter table notification_preferences enable row level security;

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

Scoped to exactly `select`/`insert`/`update` (no `delete` — there's no user-facing "remove my preferences" action) from the start, rather than a broad `for all` policy — this project already learned that lesson the hard way with the Currency & Missions feature's `mission_events` table, which shipped with `for all` and needed a same-day hardening pass to narrow it.

One row per user (not per pet — this is an account-level preference), created lazily on first toggle (no row means "not opted in," so no need to backfill existing users).

## Architecture

Three-layer shape, mirroring every other feature in this codebase:

- **`lib/notifications.ts`** (pure, no I/O): exports `shouldSendDailyBonusEmail(pet: PetRow, prefs: NotificationPreferences, now: Date): boolean` — the eligibility check described above. Fully unit-tested with TDD, same rigor as `lib/bond.ts`.
- **`lib/email.ts`** (I/O): a thin wrapper around Resend's API — `sendEmail(to: string, subject: string, html: string): Promise<void>`. Never throws; wraps its Resend call in try/catch and logs failures, matching every other I/O module's contract in this codebase.
- **`app/api/cron/daily-notifications/route.ts`**: the Vercel Cron target (a Next.js Route Handler, not a Server Action — cron jobs call HTTP endpoints, not React server functions). Validates the request came from Vercel's own cron trigger (via the `CRON_SECRET` env var Vercel automatically sends as a bearer token), then: reads `notification_preferences` where `daily_bonus_email_enabled = true`, reads the matching `pets` rows for those `user_id`s, runs each through `shouldSendDailyBonusEmail`, and for each eligible one looks up the owner's email and calls `sendEmail`, then updates `last_daily_bonus_email_sent_date`. Per-user failures are caught and logged individually — one bad send never stops the batch. Always returns HTTP 200 with a summary body (`{ sent, skipped, failed }`), regardless of partial failures, so Vercel doesn't treat a partial failure as a crash needing retries.
- **`lib/supabase/admin.ts`** (new): a service-role Supabase client, separate from the existing cookie-based `lib/supabase/server.ts`. The cron route runs with no logged-in user — every RLS policy in this app is scoped to `auth.uid() = user_id`, so the existing session-based client would authenticate as nobody and see zero rows for everyone. A service-role key is the standard Supabase mechanism for a trusted backend job that must read across all users; it bypasses RLS entirely and is also required to look up each opted-in user's email via `supabase.auth.admin.getUserById(userId)` (the `auth.users` table isn't exposed through the normal per-row-secured REST interface). **Security constraint:** this client is imported ONLY by the cron route — never by anything reachable from a Server Action, a Client Component, or any user-facing request path. The service-role key is a new, meaningfully more powerful credential than anything else in this app (a leak bypasses every RLS policy across every table), stored as its own env var (`SUPABASE_SERVICE_ROLE_KEY`, server-side only, never `NEXT_PUBLIC_`-prefixed).
- **UI**: `app/pet/notificaciones/page.tsx` (a new small Server Component reading the current preference) + a toggle Client Component calling a Server Action in `app/pet/notificaciones/actions.ts`. The nav pill on `/pet` links here.

**Scheduling:** `vercel.json` at the repo root:
```json
{
  "crons": [
    { "path": "/api/cron/daily-notifications", "schedule": "0 12 * * *" }
  ]
}
```
Once daily at 12:00 UTC (~9am Argentina time). Vercel's free Hobby plan supports daily-granularity crons, so no paid plan is required.

**Local/manual testing:** since Vercel Cron only fires on the deployed app, the route is tested locally by curling it directly with the right `Authorization: Bearer <CRON_SECRET>` header — no deployment is required to verify the logic end-to-end during implementation.

## Tech Stack

Adds one new dependency: `resend` (the official Node SDK) and one new external service account (Resend, free tier). New env vars: `RESEND_API_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (the last one already exists as a value in every Supabase project's dashboard — this just wires it into the app for the first time). Everything else (Next.js Route Handlers, Vercel Cron config, Supabase) is either already in use or a platform-native feature requiring no new dependency.
