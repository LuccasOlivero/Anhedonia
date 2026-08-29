import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingForm } from './OnboardingForm';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: pet } = await supabase.from('pets').select('id').eq('user_id', user.id).maybeSingle();
  if (pet) redirect('/pet');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-b from-[#BEE7F5] to-[#B7E4A0] px-4 py-12">
      <h1 className="text-center text-3xl font-[family-name:var(--font-display)] font-bold text-[#4A3222]">¡Hola! Creemos a tu mascota.</h1>
      <OnboardingForm />
    </main>
  );
}
