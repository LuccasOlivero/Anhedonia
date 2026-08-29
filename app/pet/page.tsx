import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { syncMissionsAndDailyBonus } from '@/lib/missions-sync';
import { syncBondScore } from '@/lib/bond-sync';
import { syncDiaryEvents } from '@/lib/diary-sync';
import { ensureStarterItemsOwned } from '@/lib/room-sync';
import { computeBondTier } from '@/lib/bond';
import {
  computeCurrentStats,
  computeIsSick,
  computeLifeStage,
  computeMood,
  type PetRow,
} from '@/lib/pet-engine';
import { getPetThought } from '@/lib/attachment';
import { type OwnedItem, type PlacedItem } from '@/lib/items';
import {
  computeVirtualMilestones,
  mergeDiaryTimeline,
  type DiaryEntry,
} from '@/lib/diary';
import {
  computeMissionProgress,
  type MissionCompletion,
  type MissionEvent,
} from '@/lib/missions';
import type { NotificationPreferences } from '@/lib/notifications';
import { PetGameStage, type PetModalType } from './PetGameStage';

const VALID_MODALS: PetModalType[] = [
  'tienda',
  'diario',
  'misiones',
  'notificaciones',
  'decorar',
  'streak_reward',
];

export default async function PetPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const modalParam = searchParams?.modal;
  const modalStr = Array.isArray(modalParam) ? modalParam[0] : modalParam;
  const initialModal: PetModalType | null =
    typeof modalStr === 'string' && VALID_MODALS.includes(modalStr as PetModalType)
      ? (modalStr as PetModalType)
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: pet } = await supabase
    .from('pets')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!pet) redirect('/onboarding');

  const initialPetRow = pet as PetRow;

  // Run server syncs so all daily bonuses, starter items, mission payouts, and diary events are up-to-date
  await syncMissionsAndDailyBonus(initialPetRow);
  await syncBondScore(initialPetRow);
  await ensureStarterItemsOwned(initialPetRow);
  await syncDiaryEvents(initialPetRow);

  // Re-read fresh pet and load all game domain state in parallel
  const [
    { data: freshPet },
    { data: placedData },
    { data: ownedData },
    { data: diaryData },
    { data: eventsData },
    { data: completionsData },
    { data: prefsData },
  ] = await Promise.all([
    supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('placed_items').select('*').eq('pet_id', initialPetRow.id),
    supabase.from('owned_items').select('*').eq('pet_id', initialPetRow.id),
    supabase
      .from('diary_entries')
      .select('*')
      .eq('pet_id', initialPetRow.id)
      .order('occurred_at', { ascending: false }),
    supabase.from('mission_events').select('*').eq('pet_id', initialPetRow.id),
    supabase.from('mission_completions').select('*').eq('pet_id', initialPetRow.id),
    supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const petRow = (freshPet ?? initialPetRow) as PetRow;
  const now = new Date();
  const stats = computeCurrentStats(petRow, now);
  const isSick = computeIsSick(petRow, now);
  const lifeStage = computeLifeStage(new Date(petRow.created_at), now);
  const mood = computeMood(stats, isSick, petRow.is_sleeping);
  const bondTier = computeBondTier(petRow.bond_score);
  const thought = getPetThought(petRow, stats, isSick, mood);

  const placedItems = (placedData ?? []) as PlacedItem[];
  const ownedItems = (ownedData ?? []) as OwnedItem[];
  const realDiaryEntries = (diaryData ?? []) as DiaryEntry[];
  const virtualDiaryEntries = computeVirtualMilestones(petRow, now);
  const diaryTimeline = mergeDiaryTimeline(realDiaryEntries, virtualDiaryEntries);
  const missionEvents = (eventsData ?? []) as MissionEvent[];
  const missionCompletions = (completionsData ?? []) as MissionCompletion[];
  const missionProgress = computeMissionProgress(missionEvents, missionCompletions, now);
  const notificationPrefs: NotificationPreferences = (prefsData ?? {
    daily_bonus_email_enabled: false,
    last_daily_bonus_email_sent_date: null,
    streak_surprise_email_enabled: false,
    last_streak_surprise_email_sent_date: null,
  }) as NotificationPreferences;

  return (
    <PetGameStage
      initialModal={initialModal}
      petRow={petRow}
      stats={stats}
      isSick={isSick}
      mood={mood}
      lifeStage={lifeStage}
      bondTier={bondTier}
      thought={thought}
      placedItems={placedItems}
      ownedItems={ownedItems}
      diaryTimeline={diaryTimeline}
      realDiaryEntries={realDiaryEntries}
      virtualDiaryEntries={virtualDiaryEntries}
      missionProgress={missionProgress}
      prefs={notificationPrefs}
    />
  );
}
