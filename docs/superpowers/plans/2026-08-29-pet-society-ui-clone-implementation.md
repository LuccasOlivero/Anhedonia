# Pet Society UI/UX Clone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the entire application into an authentic, unified, responsive clone of the iconic web game **Pet Society**, featuring a centered wooden-framed game canvas, 4 circular status meters, 2.5D decorated living room, bottom care tool dock, and in-game themed popups (Shop, Diary, Missions, Settings).

**Architecture:** A unified central stage (`PetGameStage`) renders the top HUD, 2.5D room with live pet and furniture, bottom care dock, and in-game modal drawers without full-page reloads. Sub-routes seamlessly map into in-game modals.

**Tech Stack:** Next.js 15 (App Router, Server Actions, React 19), Tailwind CSS 4, Lucide/SVG Icons, Vitest.

**Spec:** [`docs/superpowers/specs/2026-08-29-pet-society-ui-clone-design.md`](file:///C:/Users/luccas/Desktop/IA%20proyects/Anhedonia/docs/superpowers/specs/2026-08-29-pet-society-ui-clone-design.md)

## Global Constraints
- Strictly uphold the **anti-guilt principle**: warm, present-tense, no guilt or absence tracking.
- All UI text, tooltips, and labels must be in **Spanish Rioplatense** (*vos, alimentá, jugá, bañá, mirá, tenés*).
- Authentic **Pet Society visual design**: double oak/walnut borders (`#58331A` / `#804A26` / `#C89B6C`), candy glossy buttons with 3D bottom bevel and active press, parchment `#FFF9EC`, sky blue cloud background.
- Zero test regressions across existing 135 unit tests.

---

### Task 1: Global Theme, CSS Utilities & Game Frame (`app/globals.css`, `app/pet/PetGameStage.tsx`)

**Files:**
- Modify: `app/globals.css`
- Create: `app/pet/PetGameStage.tsx`
- Test: `app/pet/PetGameStage.test.tsx`

**Interfaces:**
- Produces: `PetGameStage({ petRow, stats, isSick, mood, bondTier, thought, placedItems, ownedItems, diaryTimeline, missionProgress, prefs })`

- [ ] **Step 1: Write test for PetGameStage rendering and modal switching**

```typescript
// app/pet/PetGameStage.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
// Verify modal open/close state logic
```

- [ ] **Step 2: Add Pet Society CSS classes in `app/globals.css`**
Add `.pet-wood-frame`, `.pet-candy-btn`, `.pet-wood-pill`, `.pet-sky-bg` utility styles with shadows and gradients.

- [ ] **Step 3: Implement `PetGameStage.tsx`**
Container with 960x640 max-ratio, centered, managing `activeModal` state (`null | 'tienda' | 'diario' | 'misiones' | 'notificaciones' | 'decorar' | 'streak_reward'`).

- [ ] **Step 4: Run unit tests**
Run: `npx vitest run app/pet/PetGameStage.test.tsx` (or `npm run test`)
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add app/globals.css app/pet/PetGameStage.tsx app/pet/PetGameStage.test.tsx
git commit -m "feat(ui): add PetGameStage frame and Pet Society CSS utilities"
```

---

### Task 2: Pet Society Circular Status Gauges & Top HUD (`app/pet/StatusGauge.tsx`, `app/pet/PetHUD.tsx`)

**Files:**
- Create: `app/pet/StatusGauge.tsx`
- Create: `app/pet/PetHUD.tsx`
- Test: `app/pet/StatusGauge.test.tsx`

**Interfaces:**
- Consumes: `PetRow`, `PetStats`, `BondTierInfo`
- Produces: `PetHUD({ petName, coins, bondScore, bondTier, stats })`

- [ ] **Step 1: Write tests for StatusGauge percentage clamping & color interpolation**
- [ ] **Step 2: Implement `StatusGauge.tsx`**
SVG circle with candy gradient border, glossy reflection, center icon, and tooltip on hover with exact value.
- [ ] **Step 3: Implement `PetHUD.tsx`**
Top bar featuring Golden Paw Level badge, carved wooden Nameplate, 4 Circular Gauges (🍖 Hambre, 😊 Felicidad, ⚡ Energía, ✨ Higiene), and shiny Golden Coin pill.
- [ ] **Step 4: Run tests**
Run: `npm run test`
Expected: PASS
- [ ] **Step 5: Commit**
```bash
git add app/pet/StatusGauge.tsx app/pet/PetHUD.tsx app/pet/StatusGauge.test.tsx
git commit -m "feat(ui): add Pet Society circular status gauges and PetHUD"
```

---

### Task 3: 2.5D Living Room Stage (`app/pet/PetRoomStage.tsx`)

**Files:**
- Create: `app/pet/PetRoomStage.tsx`
- Modify: `app/pet/PetSpeechBubble.tsx` (ensure positioning over room stage)

**Interfaces:**
- Consumes: `placedItems`, `CatSprite`, `PetSpeechBubble`, `lifeStage`, `mood`
- Produces: `PetRoomStage({ petRow, stats, isSick, mood, lifeStage, thought, placedItems, itemsWithOwnership, isDecorating, isSleeping, onOpenStreakModal })`

- [ ] **Step 1: Implement `PetRoomStage.tsx`**
2.5D Room with striped wallpaper, wood wainscot, floorboards, free walking `CatSprite` on floor click, placed furniture items with remove triggers when decorating, egg incubation stage.
- [ ] **Step 2: Verify speech bubble integration and action highlight**
- [ ] **Step 3: Run unit tests**
Run: `npm run test`
Expected: PASS
- [ ] **Step 4: Commit**
```bash
git add app/pet/PetRoomStage.tsx app/pet/PetSpeechBubble.tsx
git commit -m "feat(ui): implement 2.5D living room stage with interactive pet and furniture"
```

---

### Task 4: Pet Care Dock Toolbar (`app/pet/PetCareDock.tsx`)

**Files:**
- Create: `app/pet/PetCareDock.tsx`
- Modify: `app/pet/ActionButtons.tsx` (adapt to circular toolbar format)

**Interfaces:**
- Consumes: Server Actions (`feed`, `play`, `bathe`, `toggleSleep`, `medicine`)
- Produces: `PetCareDock({ isSleeping, isSick, isDecorating, onToggleDecorate, onOpenModal })`

- [ ] **Step 1: Implement `PetCareDock.tsx`**
Bottom carved wood toolbar with glossy round tool buttons:
- 🍖 Alimentar (feed)
- 🎾 Jugar (play)
- 🧼 Bañar (bathe)
- 💤 Dormir / ☀️ Despertar (sleep)
- 💊 Medicina (medicine - glowing pulse when sick)
- Divider + Menu buttons: 🎨 Decorar, 🏬 Tienda, 📔 Diario, 🎯 Misiones, ✉️ Notificaciones.
- [ ] **Step 2: Run unit tests**
Run: `npm run test`
Expected: PASS
- [ ] **Step 3: Commit**
```bash
git add app/pet/PetCareDock.tsx app/pet/ActionButtons.tsx
git commit -m "feat(ui): implement PetCareDock bottom toolbar with care actions and in-game modal triggers"
```

---

### Task 5: Themed In-Game Modals (`app/pet/modals/`)

**Files:**
- Create: `app/pet/modals/TiendaModal.tsx`
- Create: `app/pet/modals/DiarioModal.tsx`
- Create: `app/pet/modals/MisionesModal.tsx`
- Create: `app/pet/modals/NotificacionesModal.tsx`
- Create: `app/pet/modals/ModalWrapper.tsx`

**Interfaces:**
- Consumes: `ModalWrapper({ title, onClose, children })`
- Produces: Themed in-game popups rendered inside `PetGameStage`.

- [ ] **Step 1: Implement `ModalWrapper.tsx`**
Wooden-frame popup with backdrop blur, parchment body, red circular `✕` close button, and pop-in animation.
- [ ] **Step 2: Implement `TiendaModal.tsx`**
Shelves with items, coin costs, instant buy with balance deduction.
- [ ] **Step 3: Implement `DiarioModal.tsx`**
Leather memory book with note composer (`AddNoteForm`) and timeline entries.
- [ ] **Step 4: Implement `MisionesModal.tsx`**
Wooden bulletin board with missions, progress bars, and coin rewards.
- [ ] **Step 5: Implement `NotificacionesModal.tsx`**
Parchment scroll with notification switches.
- [ ] **Step 6: Run tests**
Run: `npm run test`
Expected: PASS
- [ ] **Step 7: Commit**
```bash
git add app/pet/modals/
git commit -m "feat(ui): create in-game themed popups for Tienda, Diario, Misiones, and Notificaciones"
```

---

### Task 6: Unified `/pet` Experience & Sub-route Deep Linking

**Files:**
- Modify: `app/pet/page.tsx`
- Modify: `app/pet/casa/page.tsx`
- Modify: `app/pet/casa/tienda/page.tsx`
- Modify: `app/pet/diary/page.tsx`
- Modify: `app/pet/misiones/page.tsx`
- Modify: `app/pet/notificaciones/page.tsx`

**Interfaces:**
- Consumes: All server data loaded in `app/pet/page.tsx` and passed to `PetGameStage`.

- [ ] **Step 1: Update `app/pet/page.tsx`**
Query all required state (pet, stats, placed items, owned items, diary timeline, missions, notification prefs) and render `<PetGameStage initialModal={searchParams.modal} ... />`.
- [ ] **Step 2: Update sub-routes to redirect to `/pet?modal=...` or wrap in `PetGameStage`**
- [ ] **Step 3: Run all unit tests**
Run: `npm run test`
Expected: PASS
- [ ] **Step 4: Commit**
```bash
git add app/pet/
git commit -m "feat(pet): integrate unified PetGameStage into /pet and handle sub-route modal links"
```

---

### Task 7: Pet Society Theming for Login & Onboarding (`app/login/`, `app/onboarding/`)

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `app/login/LoginForm.tsx`
- Modify: `app/onboarding/page.tsx`
- Modify: `app/onboarding/OnboardingForm.tsx`

- [ ] **Step 1: Style `app/login/page.tsx` & `LoginForm.tsx`**
Wooden welcome arch, candy buttons, glowing logo.
- [ ] **Step 2: Style `app/onboarding/page.tsx` & `OnboardingForm.tsx`**
Enchanted pet laboratory theme, photo upload previews in golden frames.
- [ ] **Step 3: Run unit tests**
Run: `npm run test`
Expected: PASS
- [ ] **Step 4: Commit**
```bash
git add app/login/ app/onboarding/
git commit -m "feat(ui): theme login and onboarding pages in Pet Society aesthetic"
```

---

### Task 8: Full Verification, Production Build & GitHub Push

**Files:** None (testing & build check)

- [ ] **Step 1: Run full unit test suite**
Run: `npm run test`
Expected: 135+ tests passing.

- [ ] **Step 2: Run production Next.js build**
Run: `npm run build`
Expected: 0 errors, all 14 routes compiled.

- [ ] **Step 3: Push commits to GitHub**
Run: `git push origin master`
Expected: Remote master updated.
