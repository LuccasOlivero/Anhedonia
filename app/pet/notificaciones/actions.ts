'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function setDailyBonusEmailEnabled(enabled: boolean): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not logged in.' };

  const { error } = await supabase
    .from('notification_preferences')
    .upsert({ user_id: user.id, daily_bonus_email_enabled: enabled }, { onConflict: 'user_id' });

  if (error) return { error: error.message };

  revalidatePath('/pet/notificaciones');
  return { error: null };
}
