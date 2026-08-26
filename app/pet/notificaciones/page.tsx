import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { PetRow } from '@/lib/pet-engine';
import { NotificationToggle } from './NotificationToggle';

const cardClass =
  'rounded-[2rem] border-8 border-[#6B4226] ring-4 ring-inset ring-[#C89B6C] bg-[#FFF9EC] p-6 shadow-[inset_0_3px_6px_rgba(0,0,0,0.15),0_10px_20px_rgba(0,0,0,0.25)]';

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) redirect('/onboarding');

  const petRow = pet as PetRow;

  // May not exist yet if the user has never toggled this before — a missing
  // row means "not opted in," so it's treated as disabled by default rather
  // than backfilled.
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('daily_bonus_email_enabled')
    .eq('user_id', user.id)
    .maybeSingle();

  const dailyBonusEmailEnabled = prefs?.daily_bonus_email_enabled ?? false;

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-gradient-to-b from-[#BEE7F5] to-[#B7E4A0] px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/pet" className="text-sm font-semibold text-[#4A3222] underline">
            ← Back
          </Link>
          <h1 className="text-xl font-[family-name:var(--font-display)] font-bold text-[#4A3222]">
            {petRow.name}&apos;s Notificaciones
          </h1>
        </div>

        <div className={cardClass}>
          <NotificationToggle initialEnabled={dailyBonusEmailEnabled} />
        </div>
      </div>
    </main>
  );
}
