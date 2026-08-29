# Attachment: Reciprocity, Initiatives, and Vulnerability — Design Spec

**Date:** 2026-08-28  
**Status:** Approved by user, ready for implementation planning

## Summary

This specification defines the second slice of the **Apego (Attachment)** pillar for Pets Forever / Anhedonia, combining three key backlog items into a unified, cohesive mechanic:
1. **Reciprocity (`Apego: Reciprocidad`):** The pet performs gestures and gifts for the user (streak milestone rewards consisting of coins + memorial notes written by the pet in the Diary).
2. **Spontaneous Initiative (`Apego: La mascota inicia interacciones por sí misma`):** The pet initiates interactions with unprompted dialogue bubbles on `/pet`, varying by Bond Tier and current state.
3. **Vulnerability (`Apego: Vulnerabilidad y necesidad de cuidado`):** The pet communicates physical and emotional needs warmly in the present tense (e.g., asking for a warm bath, food, medicine, or playtime), making needs conversational rather than just cold meter bars.

It also integrates with the newly shipped Notification Infrastructure, allowing users to opt in to an email notification when their pet has a streak reward or surprise waiting.

---

## Goals

- Create a bidirectional emotional bond where the pet doesn't just receive care, but actively gives back and communicates.
- Reward daily care consistency through tangible, milestone-based reciprocity gifts (coins + automatic entries in `/pet/diary`).
- Make the main `/pet` dashboard feel alive with spontaneous speech bubbles that react to stats, mood, bond tier, and gifts.
- Seamlessly integrate with the existing Notification Infrastructure (`/pet/notificaciones` and daily cron) via a dedicated opt-in email toggle.
- Uphold the strict **anti-guilt design principle**: all dialogue, expressions of vulnerability, and email notifications must be warm, present-tense, and forward-looking, never referencing user absence or missed days.

---

## Non-goals (Explicitly Out of Scope)

- **Unbounded conversational AI / Chatbot:** Dialogue is curated deterministically by state/tier rather than streaming freeform LLM text on every page load (avoids latency, API cost, and potential anti-guilt guardrail violations).
- **Other unstarted Attachment backlog items:** Multi-generation inheritance (`Legado entre generaciones`), complex personality traits and fears (`Personalidad: Miedos/Rasgos/Autonomía`), and multi-account social features remain in their own subsequent roadmap slices.
- **Physical room object drops:** Gifts from the pet consist of currency (coins) and diary memories; custom exclusive furniture items belong to the future `Mundo: Objetos y juguetes` slice.

---

## Behavior & Mechanics

### 1. Care Streak Milestones & Reciprocity Gifts
Care streak is measured using `pets.bond_streak_days` (derived by `lib/bond.ts`). When a streak milestone is reached and hasn't been claimed yet (`bond_streak_days >= milestone` and `last_streak_milestone_claimed < milestone`), a surprise gift is marked as available.

**Milestone Table:**
| Milestone (Days) | Coin Reward | Diary Note Title | Diary Note Copy (Pet's Voice) |
|---|---|---|---|
| **3 days** | 30 🪙 | 🎁 ¡3 días de mimos juntos! | "¡Gracias por estar conmigo estos 3 días! Encontré unas moneditas y te las guardé con mucho cariño." |
| **7 days** | 70 🪙 | 🎁 ¡Una semana inseparable! | "¡Cumplimos una semana entera juntos! Me hace muy feliz que nos cuidemos tanto. ¡Acá tenés una sorpresa!" |
| **14 days** | 150 🪙 | 🎁 ¡Dos semanas de aventuras! | "¡Ya pasaron dos semanas! Sos mi persona favorita en el mundo. Te regalo estas monedas para nuestra casita." |
| **30 days** | 300 🪙 | 🎁 ¡Un mes de puro amor! | "¡Un mes completo compartiendo momentos! Gracias por tanto cariño cada día. ¡Por muchas más aventuras juntos!" |
| **Recurring (+30 days thereafter)** | 300 🪙 | 🎁 ¡Celebrando nuestra amistad! | "¡Otro mes más de amistad incondicional! Te guardé este regalo especial." |

**Claiming Flow:**
1. On `/pet`, the speech bubble announces: `¡Tengo una sorpresa para vos! 🎁`.
2. Clicking the bubble or surprise badge opens the `StreakRewardModal`.
3. Clicking *"¡Gracias! (Reclamar)"* calls a Server Action `claimStreakRewardAction`:
   - Adds coins to `pets.coins`.
   - Inserts the commemorative entry into `diary_entries` (with `occurred_at = now`).
   - Updates `pets.last_streak_milestone_claimed = milestone`.
   - Revalidates `/pet` and `/pet/diary`.

---

### 2. Spontaneous Initiative & Vulnerability Expressions
The speech bubble on `/pet` displays a message chosen via a deterministic priority chain:

```
+-------------------------------------------------------------+
| Priority 1: Unclaimed Streak Gift ("¡Tengo una sorpresa! 🎁")|
+-------------------------------------------------------------+
                              | (None)
                              v
+-------------------------------------------------------------+
| Priority 2: Vulnerability Expression (Low stat / Sick / Sad)|
+-------------------------------------------------------------+
                              | (None - Pet is healthy & happy)
                              v
+-------------------------------------------------------------+
| Priority 3: Spontaneous Thought (Modulated by Bond Tier)    |
+-------------------------------------------------------------+
```

**Vulnerability Expressions (Priority 2):**
- **Sick (`isSick = true`):** *"No me siento muy bien... ¿tenés una medicina? 💊"* → Direct action focus: `medicine`
- **Dirty (`cleanliness < 30`):** *"Me vendría genial un baño tibio... 🫧"* → Direct action focus: `bathe`
- **Hungry (`hunger < 30`):** *"Tengo un poquito de hambre... 🍖"* → Direct action focus: `feed`
- **Tired (`energy < 25`):** *"Tengo mucho sueñito... zzz 🌙"* → Direct action focus: `sleep`
- **Sad (`mood = 'sad'`):** *"¿Jugamos un ratito juntos? 😊"* → Direct action focus: `play`

**Spontaneous Thoughts by Bond Tier (Priority 3):**
- **Inseparables (75-100):** *"¡Qué felicidad compartir mis días con vos!", "¡Sos mi mejor amigo!", "¡Hoy me siento genial a tu lado!"*
- **Vínculo fuerte (50-74):** *"¡Qué lindo verte!", "¡Hagamos algo divertido hoy!", "¿Vemos la tiendita después?"*
- **Cercanos (25-49):** *"¡Hola!", "¿A qué jugamos hoy?", "¡Qué lindo día!"*
- **Conociéndose (0-24):** *"¡Hola!", "¡Qué lindo día para pasear!"*

---

### 3. Email Notification Integration
In `/pet/notificaciones`, a new independent toggle is added:
- **Label:** *"Avisarme cuando mi mascota tenga un regalo por racha o sorpresa"*
- **Field:** `streak_surprise_email_enabled` in `notification_preferences`.
- **Trigger:** Daily cron (`/api/cron/daily-notifications`) checks if an eligible streak reward is waiting and hasn't been claimed, and sends an email if not already notified today (`last_streak_surprise_email_sent_date != today`).
- **Subject:** `🎁 [Nombre de la mascota] te preparó una sorpresa especial`
- **Anti-guilt copy:** *"¡Hola! Tu mascota alcanzó un hito de cuidado y te guardó un regalo especial en su casita. Pasá a buscarlo cuando quieras 🎁."*

---

## Data Model

```sql
-- 1. Extension to pets table
alter table pets add column if not exists last_streak_milestone_claimed smallint not null default 0;

-- 2. Extension to notification_preferences table
alter table notification_preferences add column if not exists streak_surprise_email_enabled boolean not null default false;
alter table notification_preferences add column if not exists last_streak_surprise_email_sent_date date;
```

---

## Visual Design & UI Components (Pet Society Aesthetic)

### 1. `PetSpeechBubble.tsx`
- **Location:** Positioned right above the pet sprite with a talk-tail pointing down.
- **Styling:** Parchment cream fill (`#FFF9EC`), 2px dark wood border (`#6B4226`), dark ink text (`#4A3222`), rounded pill/speech balloon shape.
- **Micro-interactions:**
  - Entrance: Smooth scale pop (0.95 → 1.0).
  - Hover: Subtle 2px lift.
  - Action Click:
    - If gift: Opens `StreakRewardModal`.
    - If vulnerability: Triggers a smooth scroll and focus highlight to the corresponding care button.
    - If thought: Spawns a floating heart (❤️) and purr feedback.

### 2. `StreakRewardModal.tsx`
- **Frame:** Double wood-border sign with parchment interior.
- **Headers:** Baloo 2 font with warm golden celebration accents.
- **Button:** 3D gummy button with candy gloss and physical press effect (`active:translate-y-1`).

---

## Architecture & File Structure

1. **`lib/attachment.ts`** (Pure logic, no I/O):
   - `getAvailableStreakReward(pet)`: Pure computation of available milestone reward.
   - `getPetVulnerability(stats, mood)`: Pure derivation of urgent care requests.
   - `getPetThought(pet, stats, mood, now)`: Resolves prioritized speech bubble content.
2. **`lib/notifications.ts`** (Extension):
   - `shouldSendStreakSurpriseEmail(pet, prefs, now)`: Pure check for cron eligibility.
3. **`app/pet/actions.ts`** (Extension):
   - `claimStreakRewardAction()`: Server Action to persist reward coins, insert diary entry, and update `last_streak_milestone_claimed`.
4. **`app/pet/notificaciones/actions.ts`** (Extension):
   - `toggleStreakSurpriseEmailAction()`: Server action to toggle preference.
5. **`components/pet/PetSpeechBubble.tsx` & `components/pet/StreakRewardModal.tsx`**:
   - Interactive client components following Pet Society design system.
6. **`app/api/cron/daily-notifications/route.ts`** (Extension):
   - Evaluates and delivers streak surprise emails alongside daily bonus reminders.

---

## Testing & Verification Plan

1. **Unit Tests (`lib/attachment.test.ts`):**
   - Streak milestone calculations (boundary checks for 0, 2, 3, 6, 7, 13, 14, 29, 30, 60 days).
   - Correct milestone advancement and prevention of duplicate claims.
   - Priority resolution between gifts, vulnerability states, and idle thoughts.
   - Strict assertion that no vulnerability or thought copy references absence or guilt.
2. **Unit Tests (`lib/notifications.test.ts`):**
   - Cron eligibility verification with various streak states, toggle values, and date keys.
3. **Manual Verification:**
   - Verify speech bubble rendering and responsive positioning above the sprite on `/pet`.
   - Trigger a streak reward, open the modal, claim it, and verify coins increase and the diary entry appears in `/pet/diary`.
   - Test toggle in `/pet/notificaciones` and curl the cron route locally to verify email dispatch.
