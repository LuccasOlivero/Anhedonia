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
