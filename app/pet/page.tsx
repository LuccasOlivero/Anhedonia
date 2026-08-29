import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { syncMissionsAndDailyBonus } from '@/lib/missions-sync';
import { syncBondScore } from '@/lib/bond-sync';
import { computeBondTier } from '@/lib/bond';
import {
  computeCurrentStats,
  computeIsSick,
  computeLifeStage,
  computeMood,
  type PetRow,
} from '@/lib/pet-engine';
import { getPetThought } from '@/lib/attachment';
import { StatBar } from './StatBar';
import { ActionButtons } from './ActionButtons';
import { BondScore } from './BondScore';
import { WelcomeBackMessage } from './WelcomeBackMessage';
import { PetSpeechBubble } from './PetSpeechBubble';

export default async function PetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) redirect('/onboarding');

  // Both syncs run before re-reading the pet row below so this visit's daily
  // bonus, mission payout, and bond score update all show up immediately.
  await syncMissionsAndDailyBonus(pet as PetRow);
  await syncBondScore(pet as PetRow);

  const { data: freshPet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  const petRow = (freshPet ?? pet) as PetRow;

  const now = new Date();
  const stats = computeCurrentStats(petRow, now);
  const isSick = computeIsSick(petRow, now);
  const lifeStage = computeLifeStage(new Date(petRow.created_at), now);
  const mood = computeMood(stats, isSick, petRow.is_sleeping);
  const bondTier = computeBondTier(petRow.bond_score);
  const thought = getPetThought(petRow, stats, isSick, mood);

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-gradient-to-b from-[#BEE7F5] to-[#B7E4A0] px-4 py-10">
      <div className="w-full max-w-sm space-y-6 rounded-[2rem] border-8 border-[#6B4226] ring-4 ring-inset ring-[#C89B6C] bg-[#FFF9EC] p-6 shadow-[inset_0_3px_6px_rgba(0,0,0,0.15),0_10px_20px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-[family-name:var(--font-display)] font-bold text-[#4A3222]">{petRow.name}</h1>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="whitespace-nowrap rounded-full bg-[#FFF3C4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20">
              🪙 {petRow.coins}
            </span>
            <Link
              href="/pet/casa"
              className="whitespace-nowrap rounded-full bg-[#F0DEB4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20"
            >
              🏠 Casa
            </Link>
            <Link
              href="/pet/misiones"
              className="whitespace-nowrap rounded-full bg-[#F0DEB4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20"
            >
              🎯 Misiones
            </Link>
            <Link
              href="/pet/diary"
              className="whitespace-nowrap rounded-full bg-[#F0DEB4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20"
            >
              📔 Diario
            </Link>
            <Link
              href="/pet/notificaciones"
              className="whitespace-nowrap rounded-full bg-[#F0DEB4] px-3 py-1 text-sm font-semibold text-[#8B5E3C] ring-1 ring-inset ring-[#6B4226]/20"
            >
              ✉️ Notificaciones
            </Link>
          </div>
        </div>

        <WelcomeBackMessage message={bondTier.message} />

        {lifeStage !== 'egg' && (
          <PetSpeechBubble thought={thought} petName={petRow.name} />
        )}

        <div className="flex flex-col items-center">
          <div className="-mb-4 h-6 w-40 rounded-full bg-[#8FBF6A]/50 blur-sm" />
          {lifeStage === 'egg' ? (
            <>
              <img src="/egg-sprite.svg" alt="Huevo" width={180} height={180} className="drop-shadow-lg" />
              <p className="mt-2 text-sm font-semibold text-[#8B5E3C]">Tu mascota está a punto de salir del huevo.</p>
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
          <StatBar label="Hambre" value={stats.hunger} />
          <StatBar label="Felicidad" value={stats.happiness} />
          <StatBar label="Energía" value={stats.energy} />
          <StatBar label="Higiene" value={stats.cleanliness} />
        </div>

        <BondScore score={petRow.bond_score} tierLabel={bondTier.label} />

        {lifeStage !== 'egg' && <ActionButtons isSleeping={petRow.is_sleeping} isSick={isSick} />}
      </div>
    </main>
  );
}
