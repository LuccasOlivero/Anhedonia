# Attachment: Reciprocity, Initiatives, and Vulnerability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the second slice of the Apego (Attachment) pillar: Care Streak Reciprocity Gifts (coins + Diary memories), Spontaneous Pet Speech Bubbles (initiatives & vulnerability expressions), and Streak Surprise Email Notifications.

**Architecture:** 
- Pure engine in `lib/attachment.ts` resolving prioritized pet thoughts, vulnerability calls, and streak reward availability without I/O or LLM latency.
- Reactive UI in `app/pet/PetSpeechBubble.tsx` and `app/pet/StreakRewardModal.tsx` following the tactile *Pet Society* design system.
- Server Actions in `app/pet/actions.ts` to atomically reward coins, write commemorative notes into `diary_entries`, and update milestone markers.
- Scheduled email dispatch via existing Vercel Cron route (`/api/cron/daily-notifications`) with anti-guilt copy.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Supabase (Postgres, Auth), Tailwind CSS, Vitest, Resend.

**Spec:** `docs/superpowers/specs/2026-08-28-attachment-reciprocity-initiatives-design.md`

## Global Constraints

- **Anti-guilt principle:** All copy (speech bubbles, diary entries, vulnerability expressions, email notifications) must be warm, present-tense, and forward-looking. Never reference, imply, or hint at user absence or missed care days.
- **Visual Design System (Pet Society):** Parchment `#FFF9EC`, wood borders (`#6B4226` / `#C89B6C`), ink text `#4A3222`, gummy candy buttons with physical press (`active:translate-y-1`), fonts: `Baloo 2` (display) + `Quicksand` (body).
- **Pure Logic Isolation:** `lib/attachment.ts` and `lib/notifications.ts` remain 100% pure, deterministic, and covered by Vitest unit tests.
- **Security:** Service-role Supabase client is strictly restricted to cron route handlers and never imported into client components or user-facing server actions.

---

### Task 1: Schema Updates and Type Definitions

**Files:**
- Create: `supabase/migrations/20260828000000_attachment_reciprocity.sql`
- Modify: `lib/pet-engine.ts:30-45`
- Modify: `lib/notifications.ts:1-10`

**Interfaces:**
- Produces:
  - `PetRow.last_streak_milestone_claimed: number`
  - `NotificationPreferences.streak_surprise_email_enabled: boolean`
  - `NotificationPreferences.last_streak_surprise_email_sent_date: string | null`

- [ ] **Step 1: Create SQL migration file**

```sql
-- supabase/migrations/20260828000000_attachment_reciprocity.sql
alter table pets add column if not exists last_streak_milestone_claimed smallint not null default 0;

alter table notification_preferences add column if not exists streak_surprise_email_enabled boolean not null default false;
alter table notification_preferences add column if not exists last_streak_surprise_email_sent_date date;
```

- [ ] **Step 2: Update `PetRow` interface in `lib/pet-engine.ts`**

Add `last_streak_milestone_claimed: number;` to the `PetRow` interface.

- [ ] **Step 3: Update `NotificationPreferences` interface in `lib/notifications.ts`**

Add `streak_surprise_email_enabled: boolean;` and `last_streak_surprise_email_sent_date: string | null;` to `NotificationPreferences`.

- [ ] **Step 4: Run typecheck / Vitest to verify compilation**

Run: `npm run test`
Expected: All existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260828000000_attachment_reciprocity.sql lib/pet-engine.ts lib/notifications.ts
git commit -m "feat(attachment): add schema extensions and types for reciprocity and notifications"
```

---

### Task 2: Core Attachment Engine (`lib/attachment.ts`) with TDD

**Files:**
- Create: `lib/attachment.ts`
- Test: `lib/attachment.test.ts`

**Interfaces:**
- Produces:
  - `StreakReward`: `{ milestone: number, coins: number, message: string, diaryTitle: string, diaryContent: string }`
  - `VulnerabilityExpression`: `{ action: 'medicine' | 'bathe' | 'feed' | 'sleep' | 'play', message: string }`
  - `PetThought`: `{ type: 'gift' | 'vulnerability' | 'initiative', message: string, action?: string, reward?: StreakReward }`
  - `getAvailableStreakReward(pet: { bond_streak_days: number, last_streak_milestone_claimed: number }): StreakReward | null`
  - `getPetVulnerability(stats: PetStats, isSick: boolean, isSleeping: boolean, mood: PetMood): VulnerabilityExpression | null`
  - `getPetThought(pet: PetRow, stats: PetStats, isSick: boolean, mood: PetMood): PetThought`

- [ ] **Step 1: Write failing unit tests in `lib/attachment.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import {
  getAvailableStreakReward,
  getPetVulnerability,
  getPetThought,
  STREAK_MILESTONES,
} from './attachment';
import type { PetRow, PetStats } from './pet-engine';

describe('getAvailableStreakReward', () => {
  it('returns null when streak is below the first milestone (3 days)', () => {
    expect(getAvailableStreakReward({ bond_streak_days: 0, last_streak_milestone_claimed: 0 })).toBeNull();
    expect(getAvailableStreakReward({ bond_streak_days: 2, last_streak_milestone_claimed: 0 })).toBeNull();
  });

  it('returns 3-day reward when streak is 3 and last claimed is 0', () => {
    const reward = getAvailableStreakReward({ bond_streak_days: 3, last_streak_milestone_claimed: 0 });
    expect(reward).not.toBeNull();
    expect(reward?.milestone).toBe(3);
    expect(reward?.coins).toBe(30);
    expect(reward?.diaryTitle).toContain('3 días');
  });

  it('returns null if 3-day reward is already claimed', () => {
    expect(getAvailableStreakReward({ bond_streak_days: 3, last_streak_milestone_claimed: 3 })).toBeNull();
    expect(getAvailableStreakReward({ bond_streak_days: 5, last_streak_milestone_claimed: 3 })).toBeNull();
  });

  it('advances through 7, 14, 30 and recurring milestones', () => {
    expect(getAvailableStreakReward({ bond_streak_days: 7, last_streak_milestone_claimed: 3 })?.milestone).toBe(7);
    expect(getAvailableStreakReward({ bond_streak_days: 14, last_streak_milestone_claimed: 7 })?.milestone).toBe(14);
    expect(getAvailableStreakReward({ bond_streak_days: 30, last_streak_milestone_claimed: 14 })?.milestone).toBe(30);
    expect(getAvailableStreakReward({ bond_streak_days: 60, last_streak_milestone_claimed: 30 })?.milestone).toBe(60);
  });
});

describe('getPetVulnerability', () => {
  const baseStats: PetStats = { hunger: 100, happiness: 100, energy: 100, cleanliness: 100 };

  it('identifies sickness as highest vulnerability', () => {
    const vuln = getPetVulnerability(baseStats, true, false, 'sick');
    expect(vuln).not.toBeNull();
    expect(vuln?.action).toBe('medicine');
    expect(vuln?.message).toContain('medicina');
  });

  it('identifies dirty pet when cleanliness < 30', () => {
    const vuln = getPetVulnerability({ ...baseStats, cleanliness: 25 }, false, false, 'dirty');
    expect(vuln?.action).toBe('bathe');
    expect(vuln?.message).toContain('baño');
  });

  it('identifies hunger when hunger < 30', () => {
    const vuln = getPetVulnerability({ ...baseStats, hunger: 20 }, false, false, 'happy');
    expect(vuln?.action).toBe('feed');
    expect(vuln?.message).toContain('hambre');
  });

  it('identifies tiredness when energy < 25 and not sleeping', () => {
    const vuln = getPetVulnerability({ ...baseStats, energy: 15 }, false, false, 'happy');
    expect(vuln?.action).toBe('sleep');
    expect(vuln?.message).toContain('sueñito');
  });

  it('identifies sadness when mood is sad', () => {
    const vuln = getPetVulnerability(baseStats, false, false, 'sad');
    expect(vuln?.action).toBe('play');
    expect(vuln?.message).toContain('Jugamos');
  });

  it('returns null when pet is healthy and happy', () => {
    expect(getPetVulnerability(baseStats, false, false, 'happy')).toBeNull();
  });
});

describe('getPetThought (Priorities & Anti-Guilt)', () => {
  const mockPet = {
    bond_score: 80,
    bond_streak_days: 7,
    last_streak_milestone_claimed: 0,
    is_sleeping: false,
  } as PetRow;

  const baseStats: PetStats = { hunger: 100, happiness: 100, energy: 100, cleanliness: 100 };

  it('prioritizes gift over vulnerability and spontaneous thoughts', () => {
    const thought = getPetThought(mockPet, { ...baseStats, hunger: 10 }, false, 'happy');
    expect(thought.type).toBe('gift');
    expect(thought.reward?.milestone).toBe(7);
  });

  it('prioritizes vulnerability when no gift is pending', () => {
    const claimedPet = { ...mockPet, last_streak_milestone_claimed: 7 };
    const thought = getPetThought(claimedPet, { ...baseStats, hunger: 10 }, false, 'happy');
    expect(thought.type).toBe('vulnerability');
    expect(thought.action).toBe('feed');
  });

  it('returns spontaneous thought by tier when healthy and no gift pending', () => {
    const claimedPet = { ...mockPet, last_streak_milestone_claimed: 7, bond_score: 80 };
    const thought = getPetThought(claimedPet, baseStats, false, 'happy');
    expect(thought.type).toBe('initiative');
    expect(thought.message.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/attachment.test.ts`
Expected: FAIL with "Cannot find module './attachment'".

- [ ] **Step 3: Implement `lib/attachment.ts`**

```typescript
import type { PetMood, PetRow, PetStats } from './pet-engine';
import { computeBondTier } from './bond';

export interface StreakReward {
  milestone: number;
  coins: number;
  message: string;
  diaryTitle: string;
  diaryContent: string;
}

export const STREAK_MILESTONE_DEFINITIONS: Record<number, { coins: number; title: string; content: string }> = {
  3: {
    coins: 30,
    title: '🎁 ¡3 días de mimos juntos!',
    content: '¡Gracias por estar conmigo estos 3 días! Encontré unas moneditas y te las guardé con mucho cariño.',
  },
  7: {
    coins: 70,
    title: '🎁 ¡Una semana inseparable!',
    content: '¡Cumplimos una semana entera juntos! Me hace muy feliz que nos cuidemos tanto. ¡Acá tenés una sorpresa!',
  },
  14: {
    coins: 150,
    title: '🎁 ¡Dos semanas de aventuras!',
    content: '¡Ya pasaron dos semanas! Sos mi persona favorita en el mundo. Te regalo estas monedas para nuestra casita.',
  },
  30: {
    coins: 300,
    title: '🎁 ¡Un mes de puro amor!',
    content: '¡Un mes completo compartiendo momentos! Gracias por tanto cariño cada día. ¡Por muchas más aventuras juntos!',
  },
};

export const STREAK_MILESTONES = [3, 7, 14, 30];

export function getAvailableStreakReward(pet: {
  bond_streak_days: number;
  last_streak_milestone_claimed: number;
}): StreakReward | null {
  const streak = pet.bond_streak_days;
  const lastClaimed = pet.last_streak_milestone_claimed;

  // Determine next milestone
  let targetMilestone: number | null = null;

  for (const m of STREAK_MILESTONES) {
    if (streak >= m && lastClaimed < m) {
      targetMilestone = m;
      break;
    }
  }

  // Handle recurring milestones (+30 days after 30)
  if (!targetMilestone && streak >= 30) {
    const recurringStep = Math.floor(streak / 30) * 30;
    if (recurringStep > lastClaimed) {
      targetMilestone = recurringStep;
    }
  }

  if (!targetMilestone) return null;

  const def = STREAK_MILESTONE_DEFINITIONS[targetMilestone] ?? {
    coins: 300,
    title: `🎁 ¡Celebrando ${targetMilestone} días de amistad!`,
    content: `¡Llegamos a ${targetMilestone} días de amistad incondicional! Te guardé este regalo especial con mucho amor.`,
  };

  return {
    milestone: targetMilestone,
    coins: def.coins,
    message: `¡Tengo una sorpresa especial para vos por nuestros ${targetMilestone} días juntos! 🎁`,
    diaryTitle: def.title,
    diaryContent: def.content,
  };
}

export interface VulnerabilityExpression {
  action: 'medicine' | 'bathe' | 'feed' | 'sleep' | 'play';
  message: string;
}

export function getPetVulnerability(
  stats: PetStats,
  isSick: boolean,
  isSleeping: boolean,
  mood: PetMood
): VulnerabilityExpression | null {
  if (isSick) {
    return {
      action: 'medicine',
      message: 'No me siento muy bien... ¿tenés una medicina? 💊',
    };
  }

  if (stats.cleanliness < 30) {
    return {
      action: 'bathe',
      message: 'Me vendría genial un baño tibio y espumoso... 🫧',
    };
  }

  if (stats.hunger < 30) {
    return {
      action: 'feed',
      message: 'Tengo un poquito de hambre... ¿comemos algo rico? 🍖',
    };
  }

  if (stats.energy < 25 && !isSleeping) {
    return {
      action: 'sleep',
      message: 'Tengo mucho sueñito... zzz 🌙',
    };
  }

  if (mood === 'sad') {
    return {
      action: 'play',
      message: '¿Jugamos un ratito juntos? Me haría muy feliz 😊',
    };
  }

  return null;
}

export interface PetThought {
  type: 'gift' | 'vulnerability' | 'initiative';
  message: string;
  action?: 'medicine' | 'bathe' | 'feed' | 'sleep' | 'play';
  reward?: StreakReward;
}

const SPONTANEOUS_THOUGHTS_BY_TIER: Record<string, string[]> = {
  inseparables: [
    '¡Qué felicidad compartir mis días con vos! 🥰',
    '¡Sos mi persona favorita en el mundo! 💛',
    '¡Hoy me siento con ganas de aprender algo nuevo juntos!',
  ],
  'vinculo-fuerte': [
    '¡Qué alegría verte! Hagamos algo divertido hoy 😊',
    '¡Me encanta cuando pasamos tiempo juntos! ✨',
    '¿Vemos qué cosas lindas hay en la tienda después? 🏠',
  ],
  cercanos: [
    '¡Hola! ¿A qué jugamos hoy? 🎈',
    '¡Qué lindo día para pasear! 🐾',
    '¡Me siento súper contento! 😊',
  ],
  conociendose: [
    '¡Hola! Qué lindo verte por acá 👋',
    '¡Qué lindo día! ☀️',
  ],
};

export function getPetThought(
  pet: PetRow,
  stats: PetStats,
  isSick: boolean,
  mood: PetMood
): PetThought {
  // Priority 1: Streak Gift
  const reward = getAvailableStreakReward(pet);
  if (reward) {
    return {
      type: 'gift',
      message: '¡Tengo una sorpresa para vos! 🎁',
      reward,
    };
  }

  // Priority 2: Vulnerability
  const vuln = getPetVulnerability(stats, isSick, pet.is_sleeping, mood);
  if (vuln) {
    return {
      type: 'vulnerability',
      message: vuln.message,
      action: vuln.action,
    };
  }

  // Priority 3: Spontaneous Thought
  const tierInfo = computeBondTier(pet.bond_score);
  const thoughts = SPONTANEOUS_THOUGHTS_BY_TIER[tierInfo.tier] ?? SPONTANEOUS_THOUGHTS_BY_TIER.conociendose;
  const message = thoughts[0];

  return {
    type: 'initiative',
    message,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/attachment.test.ts`
Expected: PASS with all test suites passing.

- [ ] **Step 5: Commit**

```bash
git add lib/attachment.ts lib/attachment.test.ts
git commit -m "feat(attachment): implement pure attachment engine and tests"
```

---

### Task 3: Streak Surprise Notification Logic (`lib/notifications.ts`)

**Files:**
- Modify: `lib/notifications.ts`
- Modify: `lib/notifications.test.ts`

**Interfaces:**
- Consumes: `getAvailableStreakReward` from `lib/attachment.ts`, `computePeriodKey` from `lib/missions.ts`
- Produces: `shouldSendStreakSurpriseEmail(pet: PetRow, prefs: NotificationPreferences, now: Date): boolean`

- [ ] **Step 1: Write failing unit test in `lib/notifications.test.ts`**

Add tests for `shouldSendStreakSurpriseEmail`:
```typescript
describe('shouldSendStreakSurpriseEmail', () => {
  const mockPet = {
    bond_streak_days: 7,
    last_streak_milestone_claimed: 0,
  } as PetRow;

  const mockPrefs: NotificationPreferences = {
    daily_bonus_email_enabled: false,
    last_daily_bonus_email_sent_date: null,
    streak_surprise_email_enabled: true,
    last_streak_surprise_email_sent_date: null,
  };

  it('returns false if streak_surprise_email_enabled is false', () => {
    expect(shouldSendStreakSurpriseEmail(mockPet, { ...mockPrefs, streak_surprise_email_enabled: false }, new Date())).toBe(false);
  });

  it('returns false if already sent today', () => {
    const now = new Date('2026-08-28T12:00:00Z');
    expect(shouldSendStreakSurpriseEmail(mockPet, { ...mockPrefs, last_streak_surprise_email_sent_date: '2026-08-28' }, now)).toBe(false);
  });

  it('returns false if no streak reward is available', () => {
    const claimedPet = { ...mockPet, last_streak_milestone_claimed: 7 };
    expect(shouldSendStreakSurpriseEmail(claimedPet, mockPrefs, new Date())).toBe(false);
  });

  it('returns true if opted in, not sent today, and streak reward is available', () => {
    expect(shouldSendStreakSurpriseEmail(mockPet, mockPrefs, new Date('2026-08-28T12:00:00Z'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/notifications.test.ts`
Expected: FAIL with `shouldSendStreakSurpriseEmail is not a function`.

- [ ] **Step 3: Implement `shouldSendStreakSurpriseEmail` in `lib/notifications.ts`**

```typescript
import { getAvailableStreakReward } from './attachment';

export function shouldSendStreakSurpriseEmail(
  pet: PetRow,
  prefs: NotificationPreferences,
  now: Date
): boolean {
  if (!prefs.streak_surprise_email_enabled) return false;

  const todayKey = computePeriodKey('daily', now);
  if (prefs.last_streak_surprise_email_sent_date === todayKey) return false;

  const availableReward = getAvailableStreakReward(pet);
  return availableReward !== null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/notifications.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/notifications.ts lib/notifications.test.ts
git commit -m "feat(notifications): add shouldSendStreakSurpriseEmail check and tests"
```

---

### Task 4: Server Actions for Claiming Streak Rewards

**Files:**
- Modify: `app/pet/actions.ts`
- Modify: `app/pet/notificaciones/actions.ts`

**Interfaces:**
- Produces:
  - `claimStreakRewardAction(): Promise<{ success: boolean; coins?: number; error?: string }>`
  - `toggleStreakSurpriseEmailAction(enabled: boolean): Promise<{ error?: string }>`

- [ ] **Step 1: Add `claimStreakRewardAction` to `app/pet/actions.ts`**

```typescript
export async function claimStreakRewardAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const { data: pet } = await supabase
    .from('pets')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!pet) return { error: 'Mascota no encontrada' };

  const petRow = pet as PetRow;
  const reward = getAvailableStreakReward(petRow);
  if (!reward) return { error: 'No hay ninguna recompensa disponible' };

  const newCoins = (petRow.coins || 0) + reward.coins;
  const nowIso = new Date().toISOString();

  // 1. Update pet coins & last_streak_milestone_claimed
  const { error: petUpdateError } = await supabase
    .from('pets')
    .update({
      coins: newCoins,
      last_streak_milestone_claimed: reward.milestone,
    })
    .eq('id', petRow.id);

  if (petUpdateError) return { error: 'Error al actualizar las monedas' };

  // 2. Insert memorial note into diary_entries
  await supabase.from('diary_entries').insert({
    pet_id: petRow.id,
    user_id: user.id,
    type: 'user_note',
    title: reward.diaryTitle,
    content: reward.diaryContent,
    occurred_at: nowIso,
  });

  revalidatePath('/pet');
  revalidatePath('/pet/diary');
  return { success: true, coins: reward.coins };
}
```

- [ ] **Step 2: Add `toggleStreakSurpriseEmailAction` to `app/pet/notificaciones/actions.ts`**

```typescript
export async function toggleStreakSurpriseEmailAction(enabled: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const { error } = await supabase
    .from('notification_preferences')
    .upsert({
      user_id: user.id,
      streak_surprise_email_enabled: enabled,
    });

  if (error) return { error: 'Error al actualizar preferencias' };
  revalidatePath('/pet/notificaciones');
  return {};
}
```

- [ ] **Step 3: Run test/typecheck**

Run: `npm run test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/pet/actions.ts app/pet/notificaciones/actions.ts
git commit -m "feat(actions): add claimStreakRewardAction and toggleStreakSurpriseEmailAction"
```

---

### Task 5: UI Components (`PetSpeechBubble.tsx`, `StreakRewardModal.tsx`)

**Files:**
- Create: `app/pet/PetSpeechBubble.tsx`
- Create: `app/pet/StreakRewardModal.tsx`
- Modify: `app/pet/page.tsx`

- [ ] **Step 1: Create `app/pet/StreakRewardModal.tsx`**

```tsx
'use client';

import { useState } from 'react';
import type { StreakReward } from '@/lib/attachment';
import { claimStreakRewardAction } from './actions';

interface Props {
  reward: StreakReward;
  petName: string;
  onClose: () => void;
}

export function StreakRewardModal({ reward, petName, onClose }: Props) {
  const [claiming, setClaiming] = useState(false);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      await claimStreakRewardAction();
      onClose();
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[2rem] border-8 border-[#6B4226] ring-4 ring-inset ring-[#C89B6C] bg-[#FFF9EC] p-6 text-center shadow-[inset_0_3px_6px_rgba(0,0,0,0.15),0_10px_20px_rgba(0,0,0,0.3)] animate-in fade-in zoom-in duration-200">
        <div className="mb-3 text-4xl">🎁</div>
        <h2 className="text-xl font-[family-name:var(--font-display)] font-bold text-[#4A3222]">
          ¡Sorpresa de {petName}!
        </h2>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#8B5E3C]">
          Racha de {reward.milestone} días de cuidado
        </p>

        <div className="my-4 rounded-xl border-2 border-[#6B4226]/20 bg-[#FFF3C4]/60 p-4 text-sm font-medium text-[#4A3222] italic">
          &ldquo;{reward.diaryContent}&rdquo;
        </div>

        <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#FFF3C4] px-4 py-1.5 text-base font-bold text-[#8B5E3C] ring-2 ring-[#6B4226]/20">
          <span>+{reward.coins} Monedas</span> 🪙
        </div>

        <p className="mb-5 text-xs text-[#8B5E3C]">
          ✨ Se guardará esta cartita en tu Diario de recuerdos.
        </p>

        <button
          onClick={handleClaim}
          disabled={claiming}
          className="w-full rounded-2xl border-4 border-[#6B4226] bg-gradient-to-b from-[#FCD34D] to-[#F59E0B] px-6 py-3 font-[family-name:var(--font-display)] text-lg font-bold text-[#4A3222] shadow-[0_4px_0_#6B4226] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
        >
          {claiming ? 'Guardando...' : '¡Gracias! (Reclamar)'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/pet/PetSpeechBubble.tsx`**

```tsx
'use client';

import { useState } from 'react';
import type { PetThought } from '@/lib/attachment';
import { StreakRewardModal } from './StreakRewardModal';

interface Props {
  thought: PetThought;
  petName: string;
}

export function PetSpeechBubble({ thought, petName }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [loved, setLoved] = useState(false);

  const handleClick = () => {
    if (thought.type === 'gift' && thought.reward) {
      setShowModal(true);
    } else if (thought.type === 'vulnerability' && thought.action) {
      const el = document.getElementById(`action-${thought.action}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-amber-400');
        setTimeout(() => el.classList.remove('ring-4', 'ring-amber-400'), 1500);
      }
    } else {
      setLoved(true);
      setTimeout(() => setLoved(false), 2000);
    }
  };

  return (
    <>
      <div className="relative flex flex-col items-center">
        <button
          onClick={handleClick}
          className="group relative max-w-[280px] rounded-2xl border-2 border-[#6B4226] bg-[#FFF9EC] px-4 py-2.5 text-center text-sm font-semibold text-[#4A3222] shadow-[0_3px_6px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
        >
          {loved ? '¡Prrr! ❤️' : thought.message}
          {thought.type === 'gift' && (
            <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-[#6B4226] ring-2 ring-[#6B4226] animate-bounce">
              🎁
            </span>
          )}
          {/* Bubble tail */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-0 w-0 border-x-8 border-x-transparent border-t-8 border-t-[#6B4226]" />
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-0 w-0 border-x-7 border-x-transparent border-t-7 border-t-[#FFF9EC]" />
        </button>
      </div>

      {showModal && thought.reward && (
        <StreakRewardModal
          reward={thought.reward}
          petName={petName}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Integrate into `app/pet/page.tsx`**

Import `getPetThought` and `PetSpeechBubble`. Calculate `thought = getPetThought(petRow, stats, isSick, mood)` and render `<PetSpeechBubble thought={thought} petName={petRow.name} />` directly above the sprite display.

- [ ] **Step 4: Run test to verify build and tests pass**

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/pet/PetSpeechBubble.tsx app/pet/StreakRewardModal.tsx app/pet/page.tsx
git commit -m "feat(ui): add PetSpeechBubble and StreakRewardModal components to /pet"
```

---

### Task 6: Notifications Page & Cron Integration

**Files:**
- Modify: `app/pet/notificaciones/page.tsx`
- Modify: `app/api/cron/daily-notifications/route.ts`

- [ ] **Step 1: Add second toggle switch in `app/pet/notificaciones/page.tsx`**

Add the toggle for `streak_surprise_email_enabled` with `toggleStreakSurpriseEmailAction`.

- [ ] **Step 2: Update `app/api/cron/daily-notifications/route.ts`**

Add check for `shouldSendStreakSurpriseEmail`:
```typescript
if (shouldSendStreakSurpriseEmail(pet, prefs, now)) {
  const availableReward = getAvailableStreakReward(pet);
  if (availableReward) {
    const subject = `🎁 ${pet.name} tiene una sorpresa especial para vos`;
    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #FFF9EC; border: 4px solid #6B4226; border-radius: 16px;">
        <h1 style="color: #4A3222; font-size: 20px;">¡Hola!</h1>
        <p style="color: #4A3222; font-size: 16px; line-height: 1.5;">
          ${pet.name} alcanzó un hito de cuidado contigo y te preparó un regalo especial en su casita. Pasá a buscarlo cuando quieras 🎁.
        </p>
        <div style="text-align: center; margin-top: 24px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://anhedonia.vercel.app'}/pet" style="display: inline-block; background: #FCD34D; color: #4A3222; font-weight: bold; padding: 12px 24px; border-radius: 12px; text-decoration: none; border: 2px solid #6B4226;">
            Ver la sorpresa de ${pet.name}
          </a>
        </div>
      </div>
    `;

    await sendEmail(userEmail, subject, html);
    await adminSupabase
      .from('notification_preferences')
      .update({ last_streak_surprise_email_sent_date: todayKey })
      .eq('user_id', prefs.user_id);
  }
}
```

- [ ] **Step 3: Run test suite**

Run: `npm run test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/pet/notificaciones/page.tsx app/api/cron/daily-notifications/route.ts
git commit -m "feat(cron): integrate streak surprise email delivery in daily cron"
```

---

### Task 7: Full Verification & Build Check

**Files:** None (testing & validation)

- [ ] **Step 1: Run all unit test suites**

Run: `npm run test`
Expected: 100% tests passing across the repository.

- [ ] **Step 2: Run production Next.js build**

Run: `npm run build`
Expected: Build passes with 0 TypeScript or lint errors.

- [ ] **Step 3: Manual flow check**
Verify speech bubble on `/pet`, reward modal opening, diary note creation, and toggle in `/pet/notificaciones`.
