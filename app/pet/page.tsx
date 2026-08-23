import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  computeCurrentStats,
  computeIsSick,
  computeLifeStage,
  computeMood,
  type PetRow,
} from '@/lib/pet-engine';
import { StatBar } from './StatBar';

export default async function PetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) redirect('/onboarding');

  const petRow = pet as PetRow;
  const now = new Date();
  const stats = computeCurrentStats(petRow, now);
  const isSick = computeIsSick(petRow, now);
  const lifeStage = computeLifeStage(new Date(petRow.created_at), now);
  const mood = computeMood(stats, isSick, petRow.is_sleeping);

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-gradient-to-b from-[#BEE7F5] to-[#B7E4A0] px-4 py-10">
      <div className="w-full max-w-sm space-y-6 rounded-[2rem] border-8 border-[#6B4226] ring-4 ring-inset ring-[#C89B6C] bg-[#FFF9EC] p-6 shadow-[inset_0_3px_6px_rgba(0,0,0,0.15),0_10px_20px_rgba(0,0,0,0.25)]">
        <h1 className="text-center text-2xl font-[family-name:var(--font-display)] font-bold text-[#4A3222]">{petRow.name}</h1>

        <div className="flex flex-col items-center">
          <div className="-mb-4 h-6 w-40 rounded-full bg-[#8FBF6A]/50 blur-sm" />
          {lifeStage === 'egg' ? (
            <>
              <img src="/egg-sprite.svg" alt="Egg" width={180} height={180} className="drop-shadow-lg" />
              <p className="mt-2 text-sm font-semibold text-[#8B5E3C]">Your pet is about to hatch.</p>
            </>
          ) : (
            <img
              src={petRow.sprites[mood]}
              alt={petRow.name}
              className="drop-shadow-lg"
              style={{ width: lifeStage === 'baby' ? '55%' : '85%' }}
            />
          )}
        </div>

        <div className="space-y-3">
          <StatBar label="Hunger" value={stats.hunger} />
          <StatBar label="Happiness" value={stats.happiness} />
          <StatBar label="Energy" value={stats.energy} />
          <StatBar label="Cleanliness" value={stats.cleanliness} />
        </div>
      </div>
    </main>
  );
}
