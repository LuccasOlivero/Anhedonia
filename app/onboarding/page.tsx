import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingForm } from './OnboardingForm';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: pet } = await supabase
    .from('pets')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (pet) redirect('/pet');

  return (
    <main className="min-h-screen pet-sky-bg flex flex-col items-center justify-center p-4 sm:p-6 select-none relative overflow-x-hidden">
      <div className="w-full max-w-lg flex flex-col items-center gap-6 animate-pet-pop">
        {/* Welcome Plaque Banner */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="inline-flex items-center gap-2 sm:gap-3 px-5 sm:px-7 py-2 sm:py-2.5 rounded-full border-4 border-[#58331A] bg-gradient-to-b from-[#804A26] to-[#58331A] text-[#FFF9EC] shadow-[inset_0_2px_4px_rgba(0,0,0,0.45),0_8px_20px_rgba(0,0,0,0.35)]">
            <span className="text-2xl sm:text-3xl filter drop-shadow">✨</span>
            <h1 className="text-2xl sm:text-3xl font-[family-name:var(--font-display)] font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-b from-[#FFFDF8] via-[#FFEBB3] to-[#F5D480] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              ¡Hola! Creemos a tu mascota.
            </h1>
            <span className="text-2xl sm:text-3xl filter drop-shadow">🎨</span>
          </div>
          <p className="text-xs sm:text-sm font-semibold text-[#58331A] bg-[#FFF9EC]/90 px-4 py-1 rounded-full border border-[#C89B6C]/40 shadow-sm backdrop-blur-xs">
            Estudio de Adopción & Nacimiento Mágico
          </p>
        </div>

        {/* Form Container */}
        <OnboardingForm />
      </div>
    </main>
  );
}
