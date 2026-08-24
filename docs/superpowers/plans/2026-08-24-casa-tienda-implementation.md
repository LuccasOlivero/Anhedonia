# Casa & Tienda Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the pet a persistent, decoratable 2D room (`/pet/casa`) and a shop (`/pet/casa/tienda`) where coins earned via the Currency & Missions feature are spent on furniture that can be placed in the room.

**Architecture:** A fixed item catalog defined in code (`lib/items.ts`, mirroring the established `MISSIONS`/`SpriteState` pattern) backs two new Supabase tables — `owned_items` (what the user has bought or started with) and `placed_items` (where owned items currently sit in the room, horizontal-position-only). Three new Server Actions (`buyItem`, `placeItem`, `removePlacedItem`) each re-validate business rules server-side against fresh DB reads, matching the existing care-action Server Actions' defensive pattern. The room itself is a full-viewport client component (a deliberate visual departure from every other page's centered card) with a pure CSS click-to-walk animation for the pet and a toggleable decorate-mode tray for placing/removing furniture.

**Tech Stack:** Next.js 15.5.23 (App Router, TypeScript), Supabase (Postgres + Auth via `@supabase/ssr` ^0.12.4 / `@supabase/supabase-js` ^2.112.3), Vitest ^4.1.11, npm. No new dependencies — no component-testing library exists in this codebase (no React Testing Library/Playwright in `package.json`), so this plan does not introduce one; UI interactivity is verified manually, matching the precedent already set by `ActionButtons.tsx`/`StatBar.tsx`.

**Spec:** `docs/superpowers/specs/2026-08-23-casa-tienda-design.md`

## Global Constraints

- Room is strictly 2D, horizontal-only movement, no isometric/pseudo-3D perspective. The pet's on-screen position is never persisted — it starts horizontally centered every time the room loads.
- Visual language reuses the app's existing design system verbatim wherever a card/pill appears (signboard card class, nav pill class, `font-[family-name:var(--font-display)]` for headings) — **except** the room screen itself, which is a deliberate, spec-approved departure: full-viewport, no card container, no sky/grass gradient background, a floating pill-style top bar instead.
- **RLS deviation from the spec's literal SQL, required:** the spec's Data Model section shows both new tables with `for all` RLS policies. This exact codebase has already discovered — twice, in code review, for `diary_entries` and then again for `mission_events`/`mission_completions` — that `for all` is wrong when the app only performs a subset of operations, and had to ship a follow-up "hardening" migration each time to narrow it. This plan ships the correct narrow policies from the start: `owned_items` gets `for select` + `for insert` only (the app only ever inserts a purchased/starter item and reads the list back — never updates or deletes an owned item). `placed_items` gets `for select` + `for insert` + `for delete` (placing an item inserts a row, removing one deletes it, rendering the room selects them — but nothing ever updates a placed item in place, since there's no move/drag interaction in this spec). No separate hardening task exists in this plan because the policies are correct on arrival.
- `item_id` is a fixed catalog defined in code (`lib/items.ts`), not a database table — same pattern as `MISSIONS` in `lib/missions.ts`. Every item has `{ id, emoji, name, priceCoins }`.
- A small starter set of items (`planta`, `canasta`) is owned for free from the moment a pet is created — granted lazily (same lazy-sync pattern as `syncMissionsAndDailyBonus`/`syncDiaryEvents`) the first time `/pet/casa` or `/pet/casa/tienda` is visited, not at pet-creation time in `app/onboarding/actions.ts` (keeps onboarding untouched). Starter items are owned but never auto-placed — the room starts empty of furniture until the user explicitly places something.
- Buying an item is a single Server Action that re-reads the pet's current `coins` immediately before checking affordability and deducting — never trusts a stale client-side coin balance — matching the spec's explicit defensive-read requirement and the existing care-action Server Actions' pattern of re-validating server-side.
- `position_x_pct` is a plain numeric percentage (0–100) of the room's width; the plan constrains it to a placeable band (6–94) so a placed item's icon, which is horizontally centered on its own position via CSS `translate`, never gets visually clipped by the viewport edge.
- All Supabase I/O for the two new tables is verified manually against the real cloud Supabase project — this app has no local Supabase CLI/Docker. No automated tests touch Postgres.
- The room and tienda routes are nested at `/pet/casa` and `/pet/casa/tienda` (no path param — one pet per account), following the same auth/onboarding redirect guard as every other `/pet/*` page: `if (!user) redirect('/login')` then `if (!pet) redirect('/onboarding')`.
- Package manager: npm. Tests: `npx vitest run` / `npm run test`.

**Ambiguous points from the spec, resolved here:**
- **Item catalog content:** the spec doesn't enumerate specific items. This plan ships 8 items across a spread of prices so the "afford some, not others" Tienda experience is meaningful immediately: `planta` (🪴 Planta, starter/0), `canasta` (🧺 Canasta, starter/0), `vela` (🕯️ Vela, 10), `cuadro` (🖼️ Cuadro, 15), `alfombra` (🟫 Alfombra, 20), `lampara` (💡 Lámpara, 25), `sofa` (🛋️ Sofá, 40), `cama` (🛏️ Cama, 80).
- **Random placement position:** tapping an owned item in the decorate tray places it at a random `position_x_pct` within the 6–94 band (no manual drag-to-position UI — the spec explicitly rules out placement fine-control beyond tap-to-place/tap-to-remove). If the user wants it elsewhere, they remove it and tap again.
- **Cat sprite:** a custom flat 2D inline SVG cat (not the app's existing circle-face sprite images used on `/pet`), per the spec's explicit "custom flat 2D cat illustration (not the generic circle-face placeholder)" requirement. Drawn as a simple sitting/standing cat shape with a horizontal-flip transform for direction and a CSS bob animation while walking.
- **Language:** room/tienda chrome (buttons, headings, empty states) uses the same Spanish-for-user-facing-copy / English-for-nothing convention already established by the Misiones page — item names and UI copy are in Spanish (matching "Alimentá a tu mascota hoy" etc.), non-visible code/comments stay in English.

---

### Task 1: Schema + item catalog module

**Files:**
- Create: `lib/items.ts`
- Create: `lib/items.test.ts`
- Create: `lib/room-sync.ts`
- Modify: `supabase/schema.sql` (append only)

**Interfaces:**
- Consumes: nothing.
- Produces: `Item`, `OwnedItem`, `PlacedItem`, `ItemWithOwnership` types; `ITEMS` catalog constant; `STARTER_ITEM_IDS` constant; `findItem(itemId: string): Item | undefined`; `computeItemsWithOwnership(owned: OwnedItem[]): ItemWithOwnership[]`; `clampPct(pct: number): number` — all from `lib/items.ts`, consumed by Tasks 2–5. `ensureStarterItemsOwned(pet: PetRow): Promise<void>` from `lib/room-sync.ts`, consumed by Task 3 and Task 5's pages.

- [ ] **Step 1: Write failing tests for the item catalog**

Create `lib/items.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { ITEMS, STARTER_ITEM_IDS, findItem, computeItemsWithOwnership, clampPct, type OwnedItem } from './items';

function makeOwnedItem(overrides: Partial<OwnedItem> = {}): OwnedItem {
  return {
    id: 'owned-1',
    pet_id: 'pet-1',
    user_id: 'user-1',
    item_id: 'planta',
    acquired_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('ITEMS catalog', () => {
  it('has 8 items with unique ids', () => {
    expect(ITEMS).toHaveLength(8);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(8);
  });

  it('every item has a positive price except the 2 starter items, which are free', () => {
    for (const item of ITEMS) {
      if (STARTER_ITEM_IDS.includes(item.id)) {
        expect(item.priceCoins).toBe(0);
      } else {
        expect(item.priceCoins).toBeGreaterThan(0);
      }
    }
  });

  it('STARTER_ITEM_IDS references exactly 2 real catalog items', () => {
    expect(STARTER_ITEM_IDS).toHaveLength(2);
    for (const id of STARTER_ITEM_IDS) {
      expect(ITEMS.some((i) => i.id === id)).toBe(true);
    }
  });
});

describe('findItem', () => {
  it('returns the matching item', () => {
    expect(findItem('planta')?.name).toBe('Planta');
  });

  it('returns undefined for an unknown id', () => {
    expect(findItem('nonexistent')).toBeUndefined();
  });
});

describe('computeItemsWithOwnership', () => {
  it('marks every catalog item as not owned when the owned list is empty', () => {
    const result = computeItemsWithOwnership([]);
    expect(result).toHaveLength(8);
    expect(result.every((i) => i.owned === false)).toBe(true);
  });

  it('marks only the items present in the owned list as owned', () => {
    const owned = [makeOwnedItem({ item_id: 'planta' }), makeOwnedItem({ item_id: 'sofa' })];
    const result = computeItemsWithOwnership(owned);
    const planta = result.find((i) => i.id === 'planta')!;
    const sofa = result.find((i) => i.id === 'sofa')!;
    const vela = result.find((i) => i.id === 'vela')!;
    expect(planta.owned).toBe(true);
    expect(sofa.owned).toBe(true);
    expect(vela.owned).toBe(false);
  });

  it('preserves catalog order', () => {
    const result = computeItemsWithOwnership([]);
    expect(result.map((i) => i.id)).toEqual(ITEMS.map((i) => i.id));
  });
});

describe('clampPct', () => {
  it('leaves values already inside the placeable band unchanged', () => {
    expect(clampPct(50)).toBe(50);
    expect(clampPct(6)).toBe(6);
    expect(clampPct(94)).toBe(94);
  });

  it('clamps values below the band up to the minimum', () => {
    expect(clampPct(-10)).toBe(6);
    expect(clampPct(0)).toBe(6);
  });

  it('clamps values above the band down to the maximum', () => {
    expect(clampPct(150)).toBe(94);
    expect(clampPct(100)).toBe(94);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run lib/items.test.ts`
Expected: FAIL — `./items` module not found.

- [ ] **Step 3: Implement the item catalog module**

Create `lib/items.ts`:
```typescript
export interface Item {
  id: string;
  emoji: string;
  name: string;
  priceCoins: number;
}

export interface OwnedItem {
  id: string;
  pet_id: string;
  user_id: string;
  item_id: string;
  acquired_at: string;
}

export interface PlacedItem {
  id: string;
  pet_id: string;
  user_id: string;
  item_id: string;
  position_x_pct: number;
  placed_at: string;
}

export interface ItemWithOwnership extends Item {
  owned: boolean;
}

// Fixed catalog, same pattern as lib/missions.ts's MISSIONS constant: a
// closed set defined in code, never persisted. owned_items/placed_items
// only ever reference these ids by joining against this array at read time.
export const ITEMS: Item[] = [
  { id: 'planta', emoji: '🪴', name: 'Planta', priceCoins: 0 },
  { id: 'canasta', emoji: '🧺', name: 'Canasta', priceCoins: 0 },
  { id: 'vela', emoji: '🕯️', name: 'Vela', priceCoins: 10 },
  { id: 'cuadro', emoji: '🖼️', name: 'Cuadro', priceCoins: 15 },
  { id: 'alfombra', emoji: '🟫', name: 'Alfombra', priceCoins: 20 },
  { id: 'lampara', emoji: '💡', name: 'Lámpara', priceCoins: 25 },
  { id: 'sofa', emoji: '🛋️', name: 'Sofá', priceCoins: 40 },
  { id: 'cama', emoji: '🛏️', name: 'Cama', priceCoins: 80 },
];

export const STARTER_ITEM_IDS: string[] = ['planta', 'canasta'];

export function findItem(itemId: string): Item | undefined {
  return ITEMS.find((item) => item.id === itemId);
}

export function computeItemsWithOwnership(owned: OwnedItem[]): ItemWithOwnership[] {
  const ownedIds = new Set(owned.map((o) => o.item_id));
  return ITEMS.map((item) => ({ ...item, owned: ownedIds.has(item.id) }));
}

const WALK_MIN_PCT = 6;
const WALK_MAX_PCT = 94;

export function clampPct(pct: number): number {
  return Math.min(WALK_MAX_PCT, Math.max(WALK_MIN_PCT, pct));
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run lib/items.test.ts`
Expected: all PASS (9 tests).

- [ ] **Step 5: Implement the lazy starter-items sync**

Create `lib/room-sync.ts`:
```typescript
import { createClient } from './supabase/server';
import { STARTER_ITEM_IDS } from './items';
import type { PetRow } from './pet-engine';

// Soft background sync: grants the free starter items exactly once per pet.
// Never throws — a failure here must not break page render. Mirrors
// lib/diary-sync.ts / lib/missions-sync.ts's exact shape.
//
// KNOWN LIMITATION: not wrapped in a single transaction — a concurrent
// double-render could both see "not yet granted" and both attempt the
// insert. The `unique (pet_id, item_id)` constraint on owned_items makes
// this safe (the second insert fails with a unique-violation, which is
// caught and logged, not surfaced), so at most a harmless duplicate-insert
// error is logged, never a duplicate row. Same character as the
// already-documented read-modify-write risk elsewhere in this app.
export async function ensureStarterItemsOwned(pet: PetRow): Promise<void> {
  try {
    const supabase = await createClient();

    const { data: existingData, error: selectError } = await supabase
      .from('owned_items')
      .select('item_id')
      .eq('pet_id', pet.id)
      .in('item_id', STARTER_ITEM_IDS);

    if (selectError) {
      console.error('ensureStarterItemsOwned: failed to check existing starter items', selectError);
      return;
    }

    const alreadyOwnedIds = new Set((existingData ?? []).map((row) => row.item_id as string));
    const missingIds = STARTER_ITEM_IDS.filter((id) => !alreadyOwnedIds.has(id));
    if (missingIds.length === 0) return;

    const { error: insertError } = await supabase.from('owned_items').insert(
      missingIds.map((itemId) => ({
        pet_id: pet.id,
        user_id: pet.user_id,
        item_id: itemId,
      }))
    );

    if (insertError) {
      console.error('ensureStarterItemsOwned: failed to grant starter items', insertError);
    }
  } catch (err) {
    console.error('ensureStarterItemsOwned: unexpected error granting starter items', err);
  }
}
```

- [ ] **Step 6: Append the new schema block to `supabase/schema.sql`**

Append to the end of `supabase/schema.sql`:

```sql

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
```

- [ ] **Step 7: Run the full test suite, verify everything still passes**

Run: `npm run test`
Expected: every existing suite passes alongside the new `lib/items.test.ts` (9 tests) — `lib/pet-engine.test.ts`, `lib/diary.test.ts`, `lib/missions.test.ts`, `lib/gemini-client.test.ts`, `lib/onboarding-orchestration.test.ts`, `lib/validate-photo-files.test.ts`.

- [ ] **Step 8: Manually run only the new SQL against the real Supabase project**

Open the Supabase Dashboard for this project → SQL Editor → New query → paste **only** the new block from Step 6 (from `-- --- Casa & Tienda:` down to the closing `create index if not exists placed_items_pet_id_idx on placed_items (pet_id);` line) → Run.

Expected: "Success. No rows returned." Then check Table Editor: `owned_items` and `placed_items` both exist with the columns shown above. Under Table Editor for each new table → RLS Policies, confirm RLS is enabled and exactly 2 policies exist on `owned_items` (select, insert) and exactly 3 on `placed_items` (select, insert, delete) — no `for all` policy on either table.

- [ ] **Step 9: Commit**

```bash
git add lib/items.ts lib/items.test.ts lib/room-sync.ts supabase/schema.sql
git commit -m "feat: add owned/placed items schema and item catalog module"
```

---

### Task 2: Server Actions — buy, place, remove

**Files:**
- Create: `app/pet/casa/actions.ts`
- Create: `app/pet/casa/tienda/actions.ts`

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/server`; `findItem`, `clampPct` from `@/lib/items` (Task 1); `type PetRow` from `@/lib/pet-engine`.
- Produces: `placeItem(itemId: string, positionXPct: number): Promise<{ error: string | null }>`, `removePlacedItem(placedItemId: string): Promise<{ error: string | null }>` from `app/pet/casa/actions.ts`; `buyItem(itemId: string): Promise<{ error: string | null }>` from `app/pet/casa/tienda/actions.ts` — consumed by Task 4's `Room.tsx` and Task 5's `BuyButton.tsx`.

- [ ] **Step 1: Implement the room's place/remove Server Actions**

Create `app/pet/casa/actions.ts`:
```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { findItem, clampPct } from '@/lib/items';
import type { PetRow } from '@/lib/pet-engine';

async function loadPet(): Promise<{ error: string } | { pet: PetRow }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not logged in.' };

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) return { error: 'No pet found.' };
  return { pet: pet as PetRow };
}

export async function placeItem(itemId: string, positionXPct: number): Promise<{ error: string | null }> {
  const loaded = await loadPet();
  if ('error' in loaded) return loaded;

  const item = findItem(itemId);
  if (!item) return { error: 'Unknown item.' };

  const supabase = await createClient();

  const { data: owned } = await supabase
    .from('owned_items')
    .select('id')
    .eq('pet_id', loaded.pet.id)
    .eq('item_id', itemId)
    .maybeSingle();

  if (!owned) return { error: 'You do not own this item yet.' };

  const { error } = await supabase.from('placed_items').insert({
    pet_id: loaded.pet.id,
    user_id: loaded.pet.user_id,
    item_id: itemId,
    position_x_pct: clampPct(positionXPct),
  });

  if (error) return { error: error.message };

  revalidatePath('/pet/casa');
  return { error: null };
}

export async function removePlacedItem(placedItemId: string): Promise<{ error: string | null }> {
  const loaded = await loadPet();
  if ('error' in loaded) return loaded;

  const supabase = await createClient();

  const { error } = await supabase
    .from('placed_items')
    .delete()
    .eq('id', placedItemId)
    .eq('pet_id', loaded.pet.id);

  if (error) return { error: error.message };

  revalidatePath('/pet/casa');
  return { error: null };
}
```

- [ ] **Step 2: Implement the Tienda's buy Server Action**

Create `app/pet/casa/tienda/actions.ts`:
```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { findItem } from '@/lib/items';
import type { PetRow } from '@/lib/pet-engine';

async function loadPet(): Promise<{ error: string } | { pet: PetRow }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not logged in.' };

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) return { error: 'No pet found.' };
  return { pet: pet as PetRow };
}

export async function buyItem(itemId: string): Promise<{ error: string | null }> {
  const loaded = await loadPet();
  if ('error' in loaded) return loaded;

  const item = findItem(itemId);
  if (!item) return { error: 'Unknown item.' };

  const supabase = await createClient();

  const { data: alreadyOwned } = await supabase
    .from('owned_items')
    .select('id')
    .eq('pet_id', loaded.pet.id)
    .eq('item_id', itemId)
    .maybeSingle();

  if (alreadyOwned) return { error: 'You already own this item.' };

  // Re-read the current coin balance immediately before spending — never
  // trust the balance the client last rendered, since it may be stale
  // (another tab, another action completed since the page loaded).
  const { data: freshPet } = await supabase
    .from('pets')
    .select('coins')
    .eq('id', loaded.pet.id)
    .maybeSingle();

  const currentCoins = freshPet?.coins ?? loaded.pet.coins;
  if (currentCoins < item.priceCoins) return { error: 'Not enough coins.' };

  const { error: coinsError } = await supabase
    .from('pets')
    .update({ coins: currentCoins - item.priceCoins })
    .eq('id', loaded.pet.id);

  if (coinsError) return { error: coinsError.message };

  const { error: insertError } = await supabase.from('owned_items').insert({
    pet_id: loaded.pet.id,
    user_id: loaded.pet.user_id,
    item_id: itemId,
  });

  if (insertError) return { error: insertError.message };

  revalidatePath('/pet/casa/tienda');
  revalidatePath('/pet/casa');
  return { error: null };
}
```

- [ ] **Step 3: Verify the project builds cleanly**

Run: `npm run build`
Expected: build succeeds with no TypeScript/ESLint errors (no automated tests touch Server Actions that hit Supabase in this codebase, matching the precedent set by `app/pet/diary/actions.ts` and `app/pet/actions.ts` — verification here is `npm run build`, not Vitest).

- [ ] **Step 4: Commit**

```bash
git add app/pet/casa/actions.ts app/pet/casa/tienda/actions.ts
git commit -m "feat: add buy/place/remove item Server Actions"
```

---

### Task 3: The room — cat sprite, walking, rendering placed items

**Files:**
- Create: `app/pet/casa/CatSprite.tsx`
- Create: `app/pet/casa/Room.tsx`
- Create: `app/pet/casa/page.tsx`

**Interfaces:**
- Consumes: `placeItem`, `removePlacedItem` from `./actions` (Task 2); `ensureStarterItemsOwned` from `@/lib/room-sync` (Task 1); `computeItemsWithOwnership`, `clampPct`, `type OwnedItem`, `type PlacedItem`, `type ItemWithOwnership` from `@/lib/items` (Task 1); `createClient()`; `type PetRow` from `@/lib/pet-engine`.
- Produces: the `/pet/casa` route; `CatSprite` component (props: `facing: 'left' | 'right'`, `walking: boolean`); `Room` client component (props: `petName: string`, `coins: number`, `initialPlacedItems: PlacedItem[]`, `itemsWithOwnership: ItemWithOwnership[]`) — `Room` itself is extended in Task 4 with decorate mode, so its props/shape here must match exactly what Task 4 extends.

- [ ] **Step 1: Implement the flat 2D cat sprite**

Create `app/pet/casa/CatSprite.tsx`:
```tsx
export function CatSprite({ facing, walking }: { facing: 'left' | 'right'; walking: boolean }) {
  return (
    <div
      className={`relative h-16 w-16 ${walking ? 'animate-[cat-bob_0.3s_ease-in-out_infinite]' : ''}`}
      style={{ transform: facing === 'left' ? 'scaleX(-1)' : undefined }}
    >
      <svg viewBox="0 0 64 64" className="h-full w-full drop-shadow-md">
        {/* body */}
        <ellipse cx="32" cy="42" rx="18" ry="14" fill="#F4A651" />
        {/* head */}
        <circle cx="32" cy="22" r="14" fill="#F4A651" />
        {/* ears */}
        <polygon points="20,14 24,2 28,14" fill="#F4A651" />
        <polygon points="36,14 40,2 44,14" fill="#F4A651" />
        <polygon points="22,12 24,6 26,12" fill="#FBCB8B" />
        <polygon points="38,12 40,6 42,12" fill="#FBCB8B" />
        {/* face */}
        <circle cx="27" cy="22" r="2" fill="#3A2417" />
        <circle cx="37" cy="22" r="2" fill="#3A2417" />
        <path d="M 30 27 Q 32 29 34 27" stroke="#3A2417" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* tail */}
        <path
          d="M 48 44 Q 58 40 56 28"
          stroke="#F4A651"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
        {/* contact shadow */}
        <ellipse cx="32" cy="58" rx="14" ry="3" fill="#000000" opacity="0.15" />
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Add the walk-bob keyframe animation**

Modify `app/globals.css` — find the end of the file and append:
```css

@keyframes cat-bob {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}
```

If `app/globals.css` does not exist at that exact path, search for the project's actual global stylesheet (check `app/layout.tsx`'s CSS import) and append there instead — this codebase has exactly one global stylesheet imported once in the root layout.

- [ ] **Step 3: Implement the room client component**

Create `app/pet/casa/Room.tsx`:
```tsx
'use client';

import { useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { clampPct, type ItemWithOwnership, type PlacedItem } from '@/lib/items';
import { CatSprite } from './CatSprite';

const WALL_HEIGHT_PCT = 78;
const pillClass =
  'rounded-full bg-[#F0DEB4]/90 px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20 backdrop-blur-sm';

export function Room({
  petName,
  coins,
  initialPlacedItems,
  itemsWithOwnership,
}: {
  petName: string;
  coins: number;
  initialPlacedItems: PlacedItem[];
  itemsWithOwnership: ItemWithOwnership[];
}) {
  const [catX, setCatX] = useState(50);
  const [facing, setFacing] = useState<'left' | 'right'>('right');
  const [walking, setWalking] = useState(false);

  function handleRoomClick(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    const target = clampPct(pct);
    setFacing(target >= catX ? 'right' : 'left');
    setWalking(true);
    setCatX(target);
    window.setTimeout(() => setWalking(false), 600);
  }

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <div className="absolute inset-x-0 top-0" style={{ height: `${WALL_HEIGHT_PCT}%`, background: '#FDE9C8' }} />
      <div
        className="absolute inset-x-0 bottom-0 border-t-4 border-[#6B4226]"
        style={{ height: `${100 - WALL_HEIGHT_PCT}%`, background: '#C89B6C' }}
      />

      <div className="absolute inset-0" onClick={handleRoomClick}>
        {initialPlacedItems.map((placed) => {
          const item = itemsWithOwnership.find((i) => i.id === placed.item_id);
          if (!item) return null;
          return (
            <span
              key={placed.id}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-full text-4xl drop-shadow-md"
              style={{ left: `${placed.position_x_pct}%`, top: `${WALL_HEIGHT_PCT + 6}%` }}
            >
              {item.emoji}
            </span>
          );
        })}

        <div
          className="absolute -translate-x-1/2 -translate-y-full transition-[left] duration-500 ease-in-out"
          style={{ left: `${catX}%`, top: `${WALL_HEIGHT_PCT}%` }}
        >
          <CatSprite facing={facing} walking={walking} />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-4">
        <Link href="/pet" className={`${pillClass} pointer-events-auto`}>
          ← Back
        </Link>
        <h1 className={`${pillClass} pointer-events-auto font-[family-name:var(--font-display)]`}>{petName}</h1>
        <span className={`${pillClass} pointer-events-auto`}>🪙 {coins}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement the room's Server Component page**

Create `app/pet/casa/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ensureStarterItemsOwned } from '@/lib/room-sync';
import { computeItemsWithOwnership, type OwnedItem, type PlacedItem } from '@/lib/items';
import type { PetRow } from '@/lib/pet-engine';
import { Room } from './Room';

export default async function CasaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) redirect('/onboarding');

  const petRow = pet as PetRow;

  // Runs before re-reading owned_items below so a pet visiting /pet/casa
  // for the first time already has its starter items in the list.
  await ensureStarterItemsOwned(petRow);

  const [{ data: ownedData }, { data: placedData }] = await Promise.all([
    supabase.from('owned_items').select('*').eq('pet_id', petRow.id),
    supabase.from('placed_items').select('*').eq('pet_id', petRow.id),
  ]);

  const ownedItems = (ownedData ?? []) as OwnedItem[];
  const placedItems = (placedData ?? []) as PlacedItem[];
  const itemsWithOwnership = computeItemsWithOwnership(ownedItems);

  return (
    <Room
      petName={petRow.name}
      coins={petRow.coins}
      initialPlacedItems={placedItems}
      itemsWithOwnership={itemsWithOwnership}
    />
  );
}
```

- [ ] **Step 5: Verify the project builds**

Run: `npm run build`
Expected: build succeeds with no TypeScript/ESLint errors.

This task deliberately skips a live browser smoke-test step — verifying the room renders and walks correctly against a real logged-in user/real Supabase data is deferred to Task 6, matching how the diary and currency-missions plans handled this same situation.

- [ ] **Step 6: Commit**

```bash
git add app/pet/casa/CatSprite.tsx app/pet/casa/Room.tsx app/pet/casa/page.tsx app/globals.css
git commit -m "feat: add casa room with cat sprite and click-to-walk"
```

---

### Task 4: Decorate mode — tray, place, remove

**Files:**
- Modify: `app/pet/casa/Room.tsx` (full replacement)

**Interfaces:**
- Consumes: `placeItem`, `removePlacedItem` from `./actions` (Task 2) — new imports not present in Task 3's version.
- Produces: same `Room` component signature as Task 3 (props unchanged) — this task only adds internal state/behavior, not new props, so `app/pet/casa/page.tsx` from Task 3 needs no changes.

- [ ] **Step 1: Replace `Room.tsx` with the decorate-mode-aware version**

Replace the entire contents of `app/pet/casa/Room.tsx` with:
```tsx
'use client';

import { useState, useTransition, type MouseEvent } from 'react';
import Link from 'next/link';
import { clampPct, type ItemWithOwnership, type PlacedItem } from '@/lib/items';
import { CatSprite } from './CatSprite';
import { placeItem, removePlacedItem } from './actions';

const WALL_HEIGHT_PCT = 78;
const pillClass =
  'rounded-full bg-[#F0DEB4]/90 px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20 backdrop-blur-sm';

function randomPlacementPct(): number {
  return clampPct(6 + Math.random() * 88);
}

export function Room({
  petName,
  coins,
  initialPlacedItems,
  itemsWithOwnership,
}: {
  petName: string;
  coins: number;
  initialPlacedItems: PlacedItem[];
  itemsWithOwnership: ItemWithOwnership[];
}) {
  const [catX, setCatX] = useState(50);
  const [facing, setFacing] = useState<'left' | 'right'>('right');
  const [walking, setWalking] = useState(false);
  const [decorateMode, setDecorateMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRoomClick(e: MouseEvent<HTMLDivElement>) {
    if (decorateMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    const target = clampPct(pct);
    setFacing(target >= catX ? 'right' : 'left');
    setWalking(true);
    setCatX(target);
    window.setTimeout(() => setWalking(false), 600);
  }

  function handleTrayTap(item: ItemWithOwnership) {
    if (!item.owned) return;
    startTransition(async () => {
      const result = await placeItem(item.id, randomPlacementPct());
      setError(result.error);
    });
  }

  function handlePlacedItemTap(placedItemId: string) {
    startTransition(async () => {
      const result = await removePlacedItem(placedItemId);
      setError(result.error);
    });
  }

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <div className="absolute inset-x-0 top-0" style={{ height: `${WALL_HEIGHT_PCT}%`, background: '#FDE9C8' }} />
      <div
        className="absolute inset-x-0 bottom-0 border-t-4 border-[#6B4226]"
        style={{ height: `${100 - WALL_HEIGHT_PCT}%`, background: '#C89B6C' }}
      />

      <div className="absolute inset-0" onClick={handleRoomClick}>
        {initialPlacedItems.map((placed) => {
          const item = itemsWithOwnership.find((i) => i.id === placed.item_id);
          if (!item) return null;
          return (
            <button
              key={placed.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (decorateMode) handlePlacedItemTap(placed.id);
              }}
              disabled={isPending}
              className={`absolute -translate-x-1/2 -translate-y-full text-4xl drop-shadow-md transition-transform ${
                decorateMode ? 'cursor-pointer hover:scale-110' : 'pointer-events-none cursor-default'
              }`}
              style={{ left: `${placed.position_x_pct}%`, top: `${WALL_HEIGHT_PCT + 6}%` }}
              aria-label={decorateMode ? `Quitar ${item.name}` : item.name}
            >
              {item.emoji}
              {decorateMode && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#F4436C] text-[10px] text-white">
                  ✕
                </span>
              )}
            </button>
          );
        })}

        <div
          className="absolute -translate-x-1/2 -translate-y-full transition-[left] duration-500 ease-in-out"
          style={{ left: `${catX}%`, top: `${WALL_HEIGHT_PCT}%` }}
        >
          <CatSprite facing={facing} walking={walking} />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-4">
        <Link href="/pet" className={`${pillClass} pointer-events-auto`}>
          ← Back
        </Link>
        <h1 className={`${pillClass} pointer-events-auto font-[family-name:var(--font-display)]`}>{petName}</h1>
        <div className="pointer-events-auto flex items-center gap-2">
          <span className={pillClass}>🪙 {coins}</span>
          <button
            type="button"
            onClick={() => setDecorateMode((v) => !v)}
            className={`${pillClass} ${decorateMode ? 'bg-[#FFD98E]/90' : ''}`}
          >
            {decorateMode ? '✅ Listo' : '🎨 Decorar'}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="pointer-events-none absolute inset-x-0 top-16 text-center text-sm font-semibold text-[#F4436C]">
          {error}
        </p>
      )}

      {decorateMode && (
        <div className="absolute inset-x-0 bottom-0 flex gap-3 overflow-x-auto bg-[#FFF9EC]/95 p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.15)]">
          {itemsWithOwnership.map((item) =>
            item.owned ? (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTrayTap(item)}
                disabled={isPending}
                className="flex shrink-0 flex-col items-center gap-1 rounded-2xl border-2 border-[#C89B6C] bg-white px-3 py-2"
              >
                <span className="text-3xl">{item.emoji}</span>
                <span className="text-xs font-semibold text-[#8B5E3C]">{item.name}</span>
              </button>
            ) : (
              <Link
                key={item.id}
                href="/pet/casa/tienda"
                className="flex shrink-0 flex-col items-center gap-1 rounded-2xl border-2 border-[#C89B6C]/50 bg-white/50 px-3 py-2 opacity-50"
              >
                <span className="text-3xl">🔒</span>
                <span className="text-xs font-semibold text-[#8B5E3C]">{item.name}</span>
                <span className="text-[10px] font-semibold text-[#8B5E3C]">🪙 {item.priceCoins}</span>
              </Link>
            )
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the project builds**

Run: `npm run build`
Expected: build succeeds with no TypeScript/ESLint errors.

This task also skips a live browser smoke-test step, deferred to Task 6 for the same reason as Task 3 (verifying the tray, tap-to-place, and tap-to-remove interactions requires a logged-in user against real Supabase data).

- [ ] **Step 3: Commit**

```bash
git add app/pet/casa/Room.tsx
git commit -m "feat: add decorate mode tray with place/remove interactions"
```

---

### Task 5: Tienda page — item listing + buy flow

**Files:**
- Create: `app/pet/casa/tienda/page.tsx`
- Create: `app/pet/casa/tienda/BuyButton.tsx`

**Interfaces:**
- Consumes: `buyItem(itemId: string)` from `./actions` (Task 2); `computeItemsWithOwnership`, `type OwnedItem` from `@/lib/items` (Task 1); `ensureStarterItemsOwned` from `@/lib/room-sync` (Task 1); `createClient()`; `type PetRow` from `@/lib/pet-engine`.
- Produces: the `/pet/casa/tienda` route; `BuyButton` component (props: `itemId: string`, `affordable: boolean`).

- [ ] **Step 1: Create the buy button client component**

Create `app/pet/casa/tienda/BuyButton.tsx`:
```tsx
'use client';

import { useState, useTransition } from 'react';
import { buyItem } from './actions';

export function BuyButton({ itemId, affordable }: { itemId: string; affordable: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleBuy() {
    startTransition(async () => {
      const result = await buyItem(itemId);
      setError(result.error);
    });
  }

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        onClick={handleBuy}
        disabled={isPending || !affordable}
        className="rounded-full bg-gradient-to-b from-[#FF9EC4] to-[#FF6FA5] px-4 py-2 font-[family-name:var(--font-display)] font-bold text-white shadow-[0_4px_0_rgba(0,0,0,0.25)] transition-all active:translate-y-[3px] active:shadow-[0_1px_0_rgba(0,0,0,0.25)] disabled:opacity-50"
      >
        {isPending ? 'Comprando...' : 'Comprar'}
      </button>
      {error && <p role="alert" className="mt-1 text-xs font-semibold text-[#F4436C]">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Create the Tienda's Server Component page**

Create `app/pet/casa/tienda/page.tsx`:
```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ensureStarterItemsOwned } from '@/lib/room-sync';
import { computeItemsWithOwnership, type OwnedItem } from '@/lib/items';
import type { PetRow } from '@/lib/pet-engine';
import { BuyButton } from './BuyButton';

const cardClass =
  'rounded-[2rem] border-8 border-[#6B4226] ring-4 ring-inset ring-[#C89B6C] bg-[#FFF9EC] p-6 shadow-[inset_0_3px_6px_rgba(0,0,0,0.15),0_10px_20px_rgba(0,0,0,0.25)]';

export default async function TiendaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) redirect('/onboarding');

  const petRow = pet as PetRow;

  // Ensures a pet that reaches the Tienda without ever having visited
  // /pet/casa first still has its starter items already marked owned, so
  // they're never incorrectly offered here for "purchase".
  await ensureStarterItemsOwned(petRow);

  const { data: ownedData } = await supabase.from('owned_items').select('*').eq('pet_id', petRow.id);
  const ownedItems = (ownedData ?? []) as OwnedItem[];
  const itemsWithOwnership = computeItemsWithOwnership(ownedItems);

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-gradient-to-b from-[#BEE7F5] to-[#B7E4A0] px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/pet/casa" className="text-sm font-semibold text-[#4A3222] underline">
            ← Back
          </Link>
          <h1 className="text-xl font-[family-name:var(--font-display)] font-bold text-[#4A3222]">Tienda</h1>
        </div>

        <div className="flex justify-end">
          <span className="rounded-full bg-[#FFF3C4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20">
            🪙 {petRow.coins}
          </span>
        </div>

        <div className="space-y-3">
          {itemsWithOwnership.map((item) => (
            <div key={item.id} className={`flex items-center gap-3 ${cardClass}`}>
              <span className="text-4xl">{item.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="font-[family-name:var(--font-display)] font-bold text-[#4A3222]">{item.name}</p>
                <p className="text-xs font-semibold text-[#8B5E3C]">🪙 {item.priceCoins}</p>
              </div>
              {item.owned ? (
                <span className="shrink-0 rounded-full bg-[#F0DEB4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20">
                  ✅ Ya la tenés
                </span>
              ) : (
                <BuyButton itemId={item.id} affordable={petRow.coins >= item.priceCoins} />
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify the project builds**

Run: `npm run build`
Expected: build succeeds with no TypeScript/ESLint errors.

This task also skips a live browser smoke-test step for the same reason as Tasks 3–4, deferred to Task 6.

- [ ] **Step 4: Commit**

```bash
git add app/pet/casa/tienda/page.tsx app/pet/casa/tienda/BuyButton.tsx
git commit -m "feat: add tienda page with buy flow"
```

---

### Task 6: Nav wiring + end-to-end manual verification against the real Supabase project

**Files:**
- Modify: `app/pet/page.tsx` (full replacement)

**Interfaces:**
- Consumes: nothing new — reuses the existing `Link` import and pill class already in `app/pet/page.tsx`.
- Produces: a "🏠 Casa" nav pill on `/pet`, linking to `/pet/casa`.

- [ ] **Step 1: Add the "🏠 Casa" nav pill to `app/pet/page.tsx`**

Replace the entire contents of `app/pet/page.tsx` with:
```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { syncMissionsAndDailyBonus } from '@/lib/missions-sync';
import {
  computeCurrentStats,
  computeIsSick,
  computeLifeStage,
  computeMood,
  type PetRow,
} from '@/lib/pet-engine';
import { StatBar } from './StatBar';
import { ActionButtons } from './ActionButtons';

export default async function PetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) redirect('/onboarding');

  // Runs before re-reading the pet row below so any daily bonus / mission
  // payout from this visit shows up in the coin balance rendered on this page.
  await syncMissionsAndDailyBonus(pet as PetRow);

  const { data: freshPet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  const petRow = (freshPet ?? pet) as PetRow;

  const now = new Date();
  const stats = computeCurrentStats(petRow, now);
  const isSick = computeIsSick(petRow, now);
  const lifeStage = computeLifeStage(new Date(petRow.created_at), now);
  const mood = computeMood(stats, isSick, petRow.is_sleeping);

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-gradient-to-b from-[#BEE7F5] to-[#B7E4A0] px-4 py-10">
      <div className="w-full max-w-sm space-y-6 rounded-[2rem] border-8 border-[#6B4226] ring-4 ring-inset ring-[#C89B6C] bg-[#FFF9EC] p-6 shadow-[inset_0_3px_6px_rgba(0,0,0,0.15),0_10px_20px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-[family-name:var(--font-display)] font-bold text-[#4A3222]">{petRow.name}</h1>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#FFF3C4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20">
              🪙 {petRow.coins}
            </span>
            <Link
              href="/pet/casa"
              className="rounded-full bg-[#F0DEB4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20"
            >
              🏠 Casa
            </Link>
            <Link
              href="/pet/misiones"
              className="rounded-full bg-[#F0DEB4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20"
            >
              🎯 Misiones
            </Link>
            <Link
              href="/pet/diary"
              className="rounded-full bg-[#F0DEB4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20"
            >
              📔 Diario
            </Link>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className="-mb-4 h-6 w-40 rounded-full bg-[#8FBF6A]/50 blur-sm" />
          {lifeStage === 'egg' ? (
            <>
              <img src="/egg-sprite.svg" alt="Egg" width={180} height={180} className="drop-shadow-lg" />
              <p className="mt-2 text-sm font-semibold text-[#8B5E3C]">Your pet is about to hatch.</p>
            </>
          ) : (
            <img
              src={petRow.sprites[mood]}
              alt={petRow.name}
              className="drop-shadow-lg"
              style={{ width: lifeStage === 'baby' ? '55%' : '85%' }}
            />
          )}
        </div>

        <div className="space-y-3">
          <StatBar label="Hunger" value={stats.hunger} />
          <StatBar label="Happiness" value={stats.happiness} />
          <StatBar label="Energy" value={stats.energy} />
          <StatBar label="Cleanliness" value={stats.cleanliness} />
        </div>

        {lifeStage !== 'egg' && <ActionButtons isSleeping={petRow.is_sleeping} isSick={isSick} />}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify the project builds**

Run: `npm run build`
Expected: build succeeds with no TypeScript/ESLint errors.

- [ ] **Step 3: Commit**

```bash
git add app/pet/page.tsx
git commit -m "feat: add casa nav link to pet dashboard"
```

- [ ] **Step 4: Run the full automated suite**

Run: `npm run test`
Expected: every Vitest suite passes, including `lib/items.test.ts`'s 9 tests alongside all pre-existing suites (`lib/pet-engine.test.ts`, `lib/diary.test.ts`, `lib/missions.test.ts`, `lib/gemini-client.test.ts`, `lib/onboarding-orchestration.test.ts`, `lib/validate-photo-files.test.ts`).

The remaining steps below require a real, logged-in browser session against the live Supabase project. This app has no local Supabase CLI/Docker, so this is verified manually rather than via automated tests, per the app's established testing approach. If `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) is not present in this worktree, it needs to be re-supplied (ask the project owner) before continuing — it is gitignored and does not exist in a fresh worktree. If a check below surfaces a bug, fix it and commit that fix separately using the same `git add` + `git commit` convention as the tasks above.

- [ ] **Step 5: Confirm the schema change is live** (repeats Task 1 Step 8 as a final sanity check)

In the Supabase Dashboard → Table Editor: confirm `owned_items` and `placed_items` both exist, each with RLS enabled and exactly the select/insert (and, for `placed_items`, delete) policies from Task 1 — no `for all` policy on either table.

- [ ] **Step 6: Verify the nav link and starter items**

`npm run dev`, log in as an existing test user with a pet. On `/pet`, click **🏠 Casa**. Expected: lands on `/pet/casa`, full-bleed room (wall band on top, floor band on bottom, no card container, no sky/grass gradient), pet name + coin balance + Back pill floating at the top, cat sprite centered horizontally. In Table Editor → `owned_items`, confirm two rows now exist for this pet with `item_id` `planta` and `canasta` (granted by `ensureStarterItemsOwned` on this first visit). Confirm `placed_items` has **no** rows yet for this pet — the room is empty of furniture until something is explicitly placed.

- [ ] **Step 7: Verify click-to-walk**

On `/pet/casa`, click several different horizontal spots across the room (left side, right side, center). Expected: each click animates the cat sliding smoothly to that horizontal position (not an instant jump), bobbing while moving, and visually flipping to face the direction of travel. Clicking near the far left/right edge should still keep the cat fully on-screen (never clipped by the viewport edge).

- [ ] **Step 8: Verify decorate mode — placing owned items**

Click **🎨 Decorar**. Expected: the button becomes **✅ Listo**, and a horizontally-scrollable tray appears at the bottom showing all 8 catalog items — "Planta" and "Canasta" shown normally (owned), the other 6 shown greyed out with a 🔒 and their price (locked). Tap "Planta" in the tray. Expected: a 🪴 emoji appears somewhere on the floor at a random horizontal position; in Table Editor → `placed_items`, confirm a new row exists for this pet with `item_id = 'planta'` and a `position_x_pct` between 6 and 94. Tap "Canasta" too and confirm the same for `item_id = 'canasta'`.

- [ ] **Step 9: Verify decorate mode — removing placed items**

Still in decorate mode, tap the placed 🪴 icon on the floor. Expected: it disappears from the room and its `placed_items` row is deleted (confirm in Table Editor). Tap **✅ Listo** to exit decorate mode; confirm clicking the room now walks the cat again instead of doing nothing.

- [ ] **Step 10: Verify a locked tray item navigates to the Tienda**

Re-enter decorate mode, tap one of the locked (greyed out, 🔒) tray items, e.g. "Sofá". Expected: navigates to `/pet/casa/tienda` (not an in-place purchase).

- [ ] **Step 11: Verify buying an affordable item**

On `/pet/casa/tienda`, note the current coin balance. Find an item priced at or below that balance that is not yet owned (e.g. "Vela" at 10 coins) and click **Comprar**. Expected: after the page revalidates, that item now shows "✅ Ya la tenés" instead of a **Comprar** button, and the coin balance shown at the top of the page is exactly `item.priceCoins` lower than before. In Table Editor: `pets.coins` reflects the deduction, and a new `owned_items` row exists with that `item_id`. Navigate back to `/pet/casa`, enter decorate mode, and confirm the newly-bought item now appears unlocked in the tray.

- [ ] **Step 12: Verify buying rejects insufficient funds, both client- and server-side**

On `/pet/casa/tienda`, find an unowned item priced above the current coin balance (e.g. "Cama" at 80 coins, if the balance is lower). Expected: its **Comprar** button is disabled (greyed out, `disabled` attribute). As a server-side confirmation this isn't just a client-side UI check: open DevTools → Console on that page and temporarily edit the page's rendered HTML via DevTools to remove the `disabled` attribute from that button, then click it. Expected: the balance does **not** go negative and `owned_items` gets no new row for that item — `buyItem`'s server-side `currentCoins < item.priceCoins` re-check rejects it regardless of client state, surfacing "Not enough coins." beneath the button.

- [ ] **Step 13: Verify buying rejects a double-purchase of an already-owned item**

Attempt to trigger `buyItem` again for an item already confirmed owned in Step 11 (e.g. by re-enabling a disabled/hidden **Comprar** control via DevTools, or by calling the action a second time in quick succession before the page revalidates). Expected: the action returns `{ error: 'You already own this item.' }` and no duplicate `owned_items` row is created (the `unique (pet_id, item_id)` constraint backstops this at the database level even if the app-level check were ever bypassed).

- [ ] **Step 14: Verify RLS isolation across two accounts using the REST API directly (not just the UI)**

In a second browser (or incognito window), sign up as a different test user and onboard a second pet. Visit `/pet/casa` to trigger its own starter-item grant, then buy at least one item on `/pet/casa/tienda` and place at least one item in decorate mode. Confirm this second account's `/pet/casa` and `/pet/casa/tienda` show only its own, independent data (no leakage from the first account) — this is the app-level check.

Then confirm RLS itself (not just the app's own query filtering) blocks cross-account reads at the database level: in the second account's browser, open DevTools → Application → Cookies, and find the `sb-<project-ref>-auth-token` cookie — this contains the second account's session access token (same technique used in the diary and currency-missions plans' final verification tasks). Using that access token, `NEXT_PUBLIC_SUPABASE_URL` from `.env.local`, and the anon key, run:

```bash
curl -s "https://<project-ref>.supabase.co/rest/v1/owned_items?select=*&pet_id=eq.<first-account-pet-id>" \
  -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <second-account-access-token>"
```

Expected: an empty JSON array `[]` — RLS's `using (auth.uid() = user_id)` policy blocks the second account from reading the first account's `owned_items` rows even when directly querying by the first account's known `pet_id`. Repeat the same request against `/rest/v1/placed_items` with the same expectation. Then repeat both requests once more using a **DELETE** instead of a plain GET against `/rest/v1/placed_items?pet_id=eq.<first-account-pet-id>` with the second account's token — expected: no rows affected (`0` rows deleted), confirming the `for delete` policy also correctly scopes to `auth.uid() = user_id` and the second account cannot delete the first account's placed items.

---

## Self-Review

**Spec coverage:** every section of `docs/superpowers/specs/2026-08-23-casa-tienda-design.md` maps to a task. Summary/Goals (persistent, personalizable, strictly-2D room) → Task 3's `Room.tsx`/`CatSprite.tsx` (horizontal-only walking, no isometric/depth) + Task 1's schema (persisted `owned_items`/`placed_items`). Non-goals (no clothing, no multiplayer, no rotation/resize/layering, no coin-earning) → honored by omission throughout; nothing in any task introduces drag/resize/layering controls, a second player's room, or a new coin-earning path. Visual Direction (full-viewport flat 2D scene, flat-color wall/floor bands, flat 2D furniture icons with contact shadows, custom flat 2D cat, floating top bar with no card container, click-anywhere-to-walk with horizontal-only movement and no perspective) → Task 3's `Room.tsx` (wall/floor bands, floating pill top bar, no `<main>` card) + `CatSprite.tsx` (the actual flat SVG cat with a drop-shadow ellipse as its contact shadow) + Task 1's placed-item emoji rendering (each placed item also gets a `drop-shadow-md` contact shadow). Data Model (both tables, `item_id` as a fixed code catalog, owned-but-not-placed distinction) → Task 1 (`lib/items.ts`, schema) + Global Constraints' explicit "starter items are owned-only, never auto-placed" note. Room Interactions: Walking → Task 3; Decorate mode (toggle, tray of owned + greyed-out locked items, tap-to-place, tap-to-remove, locked-item-taps-to-Tienda) → Task 4. Tienda (listing with price/ownership, single Server Action buy flow with the re-read-before-spend defense) → Task 5 + Task 2's `buyItem`. Tech Stack (no new dependencies) → confirmed; every task uses only Next.js/React/Tailwind/Supabase already in `package.json`.

**RLS deviation requirement:** explicitly called out in Global Constraints with the full reasoning (matches the diary/mission_events precedent) and implemented directly in Task 1's schema block — no `for all` policy is ever written for either table, and no separate "hardening" follow-up task exists (the correct policies ship in the same commit as the tables).

**Placeholder scan:** searched for "TBD"/"implement later"/"add appropriate error handling"/hand-wavy descriptions — none found. Every code step has complete, runnable file contents (either full new files or explicit full-file replacements for `app/pet/page.tsx` and `app/pet/casa/Room.tsx`). The flat 2D cat SVG, the wall/floor band CSS, the walk-bob keyframes, the click-to-walk handler, and the decorate-mode tray markup are all written out as real, complete code — none are described abstractly. Manual verification steps (Task 6) give concrete expected values (exact table names, exact column checks, exact coin-delta reasoning) rather than vague "verify it works" instructions.

**Type consistency:** `Item`, `OwnedItem`, `PlacedItem`, `ItemWithOwnership` are defined once in `lib/items.ts` (Task 1) and re-imported with identical shapes everywhere else — `lib/room-sync.ts` imports nothing from these beyond `STARTER_ITEM_IDS`; `app/pet/casa/actions.ts` and `app/pet/casa/tienda/actions.ts` import `findItem`; `app/pet/casa/page.tsx` imports `computeItemsWithOwnership`, `OwnedItem`, `PlacedItem`; `app/pet/casa/Room.tsx` imports `ItemWithOwnership`, `PlacedItem`; `app/pet/casa/tienda/page.tsx` imports `computeItemsWithOwnership`, `OwnedItem`. Server Action signatures agree everywhere they're called: `placeItem(itemId: string, positionXPct: number): Promise<{ error: string | null }>` and `removePlacedItem(placedItemId: string): Promise<{ error: string | null }>` are defined in Task 2 and called with matching argument order/types in Task 4's `Room.tsx` (`placeItem(item.id, randomPlacementPct())`, `removePlacedItem(placed.id)`); `buyItem(itemId: string): Promise<{ error: string | null }>` is defined in Task 2 and called identically in Task 5's `BuyButton.tsx`. Layout constants (`WALL_HEIGHT_PCT = 78`, `WALK_MIN_PCT = 6`, `WALK_MAX_PCT = 94`) are identical between Task 3's initial `Room.tsx` and Task 4's full replacement, so the floor line and walk bounds don't visually shift between the two commits. `pillClass` is identical in both versions of `Room.tsx` too.

## Critical Files for Implementation

- `lib/items.ts`
- `app/pet/casa/Room.tsx`
- `app/pet/casa/actions.ts`
- `app/pet/casa/tienda/actions.ts`
- `supabase/schema.sql`
