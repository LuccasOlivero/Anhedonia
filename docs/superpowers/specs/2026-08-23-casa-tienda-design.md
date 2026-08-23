# Casa & Tienda — Design Spec

**Date:** 2026-08-23
**Status:** Approved by user, ready for implementation planning

## Summary

A full-screen 2D room where the pet lives, decorated with objects the user places and a shop where new objects are bought with coins (see the Currency & Missions spec, which this depends on). Part of the "Mundo y personalización" pillar from the product roadmap. Validated visually with the user via an interactive HTML mockup before this spec was written — see "Visual Direction" below for what was approved.

## Goals

- Give the pet a persistent, personalizable space — the room and its layout are saved, not reset every visit.
- Keep the visual language identical to the rest of the app (wood/parchment signboard cards, Baloo 2 + Quicksand) — no new aesthetic system introduced for this feature.
- Keep the room strictly 2D and full-bleed (fills the viewport), with the pet walking along a single floor baseline when the user taps/clicks a spot — no isometric or pseudo-3D perspective.

## Non-goals (explicitly out of scope for this spec)

- Ropa y accesorios (dressing the pet itself) — a separate roadmap item, not this spec.
- Any multiplayer/visiting other users' rooms.
- Furniture rotation, resizing, or layering order controls — placement is tap-to-place / tap-to-remove only.
- Coin-earning logic — fully owned by the Currency & Missions spec; this spec only spends coins.

## Visual Direction (validated with user)

Approved via an interactive mockup before this spec: the room is a full-viewport, flat 2D scene — a flat-color wall band and floor band, furniture rendered as flat 2D icons with simple contact shadows (no gradient shading trying to fake depth). The pet is a custom flat 2D cat illustration (not the generic circle-face placeholder used elsewhere), standing on the floor baseline. Clicking/tapping anywhere in the room animates the cat walking to that horizontal position along the floor line — vertical position stays fixed, deliberately avoiding any perspective/depth illusion. A floating top bar (back button, pet name, "Decorar" toggle) overlays the scene without a card container around the room itself — the room *is* the full screen, unlike every other page in the app which is a centered card on a sky/grass background.

This is a deliberate visual departure from the rest of the app (full-bleed vs. centered card), scoped narrowly to this one screen because a room needs to feel like a place you're inside of, not a document you're reading.

## Data Model

```sql
create table if not exists owned_items (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references pets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  acquired_at timestamptz not null default now(),
  unique (pet_id, item_id)
);

alter table owned_items enable row level security;

create policy "Users manage their own owned items"
  on owned_items for all
  using (auth.uid() = user_id)
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

create policy "Users manage their own placed items"
  on placed_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

`item_id` references a fixed catalog defined in code (same pattern as `SPRITE_STATES` / mission definitions) — `{ id, emoji, name, priceCoins }` — not a database table, since there is no admin UI to manage one. `owned_items` records what the user has bought (or started with, for a small free starter set); `placed_items` records where owned items currently sit in the room (`position_x_pct` is the cat/room's horizontal-only placement model, matching the strictly-2D visual direction above). An item can be owned but not placed (sitting unused), but never placed without being owned.

## Room Interactions

- **Walking**: click/tap anywhere on the room → the pet's horizontal position animates there (CSS transition), with a walking bob animation and a horizontal flip depending on direction. Purely client-side, ephemeral — the pet's "current position" is never persisted; it starts centered each time the room loads.
- **Decorate mode**: a toggle button switches into placement mode, opening a tray of owned items at the bottom (locked/unowned items also show, greyed out, tapping one navigates to the Tienda). Tapping an owned tray item places it in the room (writes to `placed_items`); tapping a placed item while in decorate mode removes it.

## Tienda

A separate route listing the fixed item catalog with price, marking items already in `owned_items` as owned. Buying an item is a single Server Action: check `pets.coins >= price`, deduct coins, insert into `owned_items` — both in one transaction-equivalent (Supabase doesn't give us a client-side transaction here, so the action re-reads the current coin balance immediately before the update to avoid a stale-balance race, same defensive pattern as the existing care actions re-validating business rules server-side rather than trusting the client).

## Tech Stack

Same as the base app: Next.js 15 (App Router, TypeScript), Supabase (Postgres + Auth), Vitest. No new dependencies.
