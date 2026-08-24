import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { syncMissionsAndDailyBonus } from '@/lib/missions-sync';
import { computeMissionProgress, type MissionCompletion, type MissionEvent } from '@/lib/missions';
import type { PetRow } from '@/lib/pet-engine';

const cardClass =
  'rounded-[2rem] border-8 border-[#6B4226] ring-4 ring-inset ring-[#C89B6C] bg-[#FFF9EC] p-6 shadow-[inset_0_3px_6px_rgba(0,0,0,0.15),0_10px_20px_rgba(0,0,0,0.25)]';

export default async function MissionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) redirect('/onboarding');

  const petRow = pet as PetRow;

  // Runs before re-reading events/completions/coins below so any daily bonus
  // or mission payout from this visit shows up in this same render — this
  // page is a valid entry point on its own, not only reachable via /pet.
  await syncMissionsAndDailyBonus(petRow);

  const [{ data: freshPet }, { data: eventsData }, { data: completionsData }] = await Promise.all([
    supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('mission_events').select('*').eq('pet_id', petRow.id),
    supabase.from('mission_completions').select('*').eq('pet_id', petRow.id),
  ]);

  const freshPetRow = (freshPet ?? petRow) as PetRow;
  const events = (eventsData ?? []) as MissionEvent[];
  const completions = (completionsData ?? []) as MissionCompletion[];
  const progress = computeMissionProgress(events, completions, new Date());

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-gradient-to-b from-[#BEE7F5] to-[#B7E4A0] px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/pet" className="text-sm font-semibold text-[#4A3222] underline">
            ← Back
          </Link>
          <h1 className="text-xl font-[family-name:var(--font-display)] font-bold text-[#4A3222]">
            {freshPetRow.name}&apos;s Missions
          </h1>
        </div>

        <div className="flex justify-end">
          <span className="rounded-full bg-[#FFF3C4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20">
            🪙 {freshPetRow.coins}
          </span>
        </div>

        <div className="space-y-3">
          {progress.map((p) => (
            <div key={p.mission.id} className={cardClass}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-[family-name:var(--font-display)] font-bold text-[#4A3222]">
                    {p.mission.description}
                  </p>
                  <p className="text-xs font-semibold text-[#8B5E3C]">
                    {p.mission.period === 'daily' ? 'Daily' : 'Weekly'} ·{' '}
                    {Math.min(p.count, p.mission.threshold)}/{p.mission.threshold}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#FFF3C4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20">
                  +{p.mission.rewardCoins} 🪙
                </span>
              </div>
              {p.isCompleted && (
                <p className="mt-2 text-sm font-semibold text-[#4FD1C5]">✅ Completed for this period</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
