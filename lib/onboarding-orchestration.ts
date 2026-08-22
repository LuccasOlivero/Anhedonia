import type { SpriteState } from './pet-engine';

export const SPRITE_STATES: SpriteState[] = ['happy', 'sad', 'eating', 'sleeping', 'dirty', 'sick'];
export const MAX_ATTEMPTS = 3; // 1 initial attempt + 2 retries

export type GenerateSpriteFn = (photoUrls: string[], state: SpriteState) => Promise<Buffer>;

export async function generateSpriteWithRetry(
  generateFn: GenerateSpriteFn,
  photoUrls: string[],
  state: SpriteState,
  maxAttempts: number = MAX_ATTEMPTS
): Promise<Buffer | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await generateFn(photoUrls, state);
    } catch {
      // swallow and retry; caller falls back once attempts are exhausted
    }
  }
  return null;
}

export type SpriteGenerationResult =
  | { state: SpriteState; source: 'generated'; buffer: Buffer }
  | { state: SpriteState; source: 'fallback'; fallbackPath: string };

export async function generateAllSprites(
  generateFn: GenerateSpriteFn,
  photoUrls: string[]
): Promise<SpriteGenerationResult[]> {
  return Promise.all(
    SPRITE_STATES.map(async (state): Promise<SpriteGenerationResult> => {
      const buffer = await generateSpriteWithRetry(generateFn, photoUrls, state);
      if (buffer) {
        return { state, source: 'generated', buffer };
      }
      return { state, source: 'fallback', fallbackPath: `/fallback-sprites/${state}.svg` };
    })
  );
}
