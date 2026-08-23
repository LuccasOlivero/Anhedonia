'use server';

import { createClient } from '@/lib/supabase/server';
import { generateSprite } from '@/lib/gemini-client';
import { generateAllSprites } from '@/lib/onboarding-orchestration';
import type { SpriteState } from '@/lib/pet-engine';
import { redirect } from 'next/navigation';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function createPet(_prevState: { error: string }, formData: FormData) {
  const name = formData.get('name') as string;
  const photos = formData.getAll('photos') as File[];

  if (!name?.trim()) {
    return { error: 'Please enter a pet name.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'You must be logged in.' };
  }

  const photoUrls: string[] = [];
  for (let i = 0; i < photos.length; i++) {
    const file = photos[i];
    const filePath = `${user.id}/${Date.now()}-${i}.jpg`;
    const { error: uploadError } = await supabase.storage.from('pet-photos').upload(filePath, file);
    if (uploadError) {
      return { error: `Failed to upload photo: ${uploadError.message}` };
    }
    const { data: signed } = await supabase.storage
      .from('pet-photos')
      .createSignedUrl(filePath, 60 * 10);
    if (signed?.signedUrl) photoUrls.push(signed.signedUrl);
  }

  const results = await generateAllSprites(generateSprite, photoUrls);

  const sprites: Partial<Record<SpriteState, string>> = {};
  let uploadedCount = 0;

  for (const result of results) {
    const destPath = `${user.id}/${result.state}.png`;
    const bytes =
      result.source === 'generated'
        ? result.buffer
        : await readFile(path.join(process.cwd(), 'public', 'fallback-sprites', `${result.state}.svg`));

    const { error: uploadError } = await supabase.storage.from('pet-sprites').upload(destPath, bytes, {
      contentType: result.source === 'generated' ? 'image/png' : 'image/svg+xml',
      upsert: true,
    });

    if (!uploadError) {
      const { data: publicUrl } = supabase.storage.from('pet-sprites').getPublicUrl(destPath);
      sprites[result.state] = publicUrl.publicUrl;
      uploadedCount++;
    }
  }

  if (uploadedCount === 0) {
    return { error: 'Could not create your pet sprites. Please try again.' };
  }

  const { error: insertError } = await supabase.from('pets').insert({
    user_id: user.id,
    name: name.trim(),
    sprites,
  });

  if (insertError) {
    return { error: `Failed to create pet: ${insertError.message}` };
  }

  redirect('/pet');
}
