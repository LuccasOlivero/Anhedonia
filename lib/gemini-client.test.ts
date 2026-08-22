import { describe, it, expect, vi, beforeEach } from 'vitest';

const { generateContentMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function () {
    return { models: { generateContent: generateContentMock } };
  }),
}));

import { generateSprite } from './gemini-client';

beforeEach(() => {
  generateContentMock.mockReset();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      arrayBuffer: async () => new TextEncoder().encode('fake-photo-bytes').buffer,
      headers: { get: () => 'image/jpeg' },
    })
  );
  process.env.GEMINI_API_KEY = 'test-key';
});

describe('generateSprite', () => {
  it('throws when GEMINI_API_KEY is not set', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(generateSprite(['https://example.com/a.jpg'], 'happy')).rejects.toThrow(
      'GEMINI_API_KEY is not set'
    );
  });

  it('returns an image buffer when Gemini responds with inline image data', async () => {
    const expectedBytes = Buffer.from('fake-sprite-png-bytes');
    generateContentMock.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ inlineData: { mimeType: 'image/png', data: expectedBytes.toString('base64') } }],
          },
        },
      ],
    });

    const result = await generateSprite(['https://example.com/a.jpg'], 'happy');
    expect(result).toEqual(expectedBytes);
  });

  it('throws a state-specific error when the response has no image part', async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: 'no image here' }] } }],
    });

    await expect(generateSprite(['https://example.com/a.jpg'], 'sick')).rejects.toThrow(
      'Gemini did not return an image for state "sick"'
    );
  });
});
