import { GoogleGenAI } from '@google/genai';
import type { SpriteState } from './pet-engine';

const STATE_PROMPTS: Record<SpriteState, string> = {
  happy: 'cute pixel-art style virtual pet based on this reference photo, joyful happy expression, transparent background, 512x512',
  sad: 'cute pixel-art style virtual pet based on this reference photo, sad droopy expression, transparent background, 512x512',
  eating: 'cute pixel-art style virtual pet based on this reference photo, eating food happily, transparent background, 512x512',
  sleeping: 'cute pixel-art style virtual pet based on this reference photo, eyes closed sleeping peacefully, transparent background, 512x512',
  dirty: 'cute pixel-art style virtual pet based on this reference photo, covered in dirt smudges, transparent background, 512x512',
  sick: 'cute pixel-art style virtual pet based on this reference photo, sick with a thermometer and pale face, transparent background, 512x512',
};

export async function generateSprite(photoUrls: string[], state: SpriteState): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const ai = new GoogleGenAI({ apiKey });

  const imageParts = await Promise.all(
    photoUrls.map(async (url) => {
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      const data = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = res.headers.get('content-type') ?? 'image/jpeg';
      return { inlineData: { mimeType, data } };
    })
  );

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [{ role: 'user', parts: [...imageParts, { text: STATE_PROMPTS[state] }] }],
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part) => part.inlineData?.data);

  if (!imagePart?.inlineData?.data) {
    throw new Error(`Gemini did not return an image for state "${state}"`);
  }

  return Buffer.from(imagePart.inlineData.data, 'base64');
}
