import { describe, it, expect, vi } from 'vitest';
import { generateSpriteWithRetry, generateAllSprites, SPRITE_STATES } from './onboarding-orchestration';
import type { SpriteState } from './pet-engine';

describe('generateSpriteWithRetry', () => {
  it('returns the buffer on the first successful attempt', async () => {
    const generateFn = vi.fn().mockResolvedValue(Buffer.from('sprite-bytes'));
    const result = await generateSpriteWithRetry(generateFn, ['url'], 'happy');
    expect(result).toEqual(Buffer.from('sprite-bytes'));
    expect(generateFn).toHaveBeenCalledTimes(1);
  });

  it('retries after failures and returns the buffer once it succeeds', async () => {
    const generateFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockRejectedValueOnce(new Error('rate limited again'))
      .mockResolvedValueOnce(Buffer.from('sprite-bytes'));

    const result = await generateSpriteWithRetry(generateFn, ['url'], 'sad');
    expect(result).toEqual(Buffer.from('sprite-bytes'));
    expect(generateFn).toHaveBeenCalledTimes(3);
  });

  it('returns null after exhausting all attempts', async () => {
    const generateFn = vi.fn().mockRejectedValue(new Error('always fails'));
    const result = await generateSpriteWithRetry(generateFn, ['url'], 'sick');
    expect(result).toBeNull();
    expect(generateFn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });
});

describe('generateAllSprites', () => {
  it('returns one generated result per sprite state when all succeed', async () => {
    const generateFn = vi.fn().mockImplementation(async (_urls: string[], state: SpriteState) =>
      Buffer.from(`bytes-for-${state}`)
    );

    const results = await generateAllSprites(generateFn, ['url']);

    expect(results).toHaveLength(SPRITE_STATES.length);
    for (const state of SPRITE_STATES) {
      const result = results.find((r) => r.state === state);
      expect(result?.source).toBe('generated');
      if (result?.source === 'generated') {
        expect(result.buffer).toEqual(Buffer.from(`bytes-for-${state}`));
      }
    }
  });

  it('falls back to the bundled SVG path for a state that fails after all retries', async () => {
    const generateFn = vi.fn().mockImplementation(async (_urls: string[], state: SpriteState) => {
      if (state === 'sick') throw new Error('always fails for sick');
      return Buffer.from(`bytes-for-${state}`);
    });

    const results = await generateAllSprites(generateFn, ['url']);

    const sickResult = results.find((r) => r.state === 'sick');
    expect(sickResult).toEqual({ state: 'sick', source: 'fallback', fallbackPath: '/fallback-sprites/sick.svg' });

    const happyResult = results.find((r) => r.state === 'happy');
    expect(happyResult?.source).toBe('generated');
  });
});
