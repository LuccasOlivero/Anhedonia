import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { syncDiaryEvents } from '@/lib/diary-sync';
import { computeVirtualMilestones, mergeDiaryTimeline, type DiaryEntry, type VirtualDiaryEntry } from '@/lib/diary';
import type { PetRow } from '@/lib/pet-engine';
import { AddNoteForm } from './AddNoteForm';

const cardClass =
  'rounded-[2rem] border-8 border-[#6B4226] ring-4 ring-inset ring-[#C89B6C] bg-[#FFF9EC] p-6 shadow-[inset_0_3px_6px_rgba(0,0,0,0.15),0_10px_20px_rgba(0,0,0,0.25)]';

type AnyEntry = DiaryEntry | VirtualDiaryEntry;

// These labels are the exact copy from the diary spec — interpolated at render
// time so auto-events never need to store their own text.
function labelFor(petName: string, entry: AnyEntry): string {
  switch (entry.entry_type) {
    case 'hatched':
      return `${petName} salió del huevo 🐣`;
    case 'grew_up':
      return `${petName} creció y ya es adulto 🌟`;
    case 'got_sick':
      return `${petName} se enfermó 🤒`;
    case 'recovered':
      return `${petName} se recuperó 💊✨`;
    case 'note':
      return `A memory about ${petName} 📝`;
  }
}

function imageFor(petRow: PetRow, entry: AnyEntry): string {
  switch (entry.entry_type) {
    case 'hatched':
      return '/egg-sprite.svg';
    case 'grew_up':
      return petRow.sprites.happy;
    default:
      return petRow.sprites[entry.mood_snapshot];
  }
}

export default async function DiaryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: pet } = await supabase.from('pets').select('*').eq('user_id', user.id).maybeSingle();
  if (!pet) redirect('/onboarding');

  const petRow = pet as PetRow;

  // Runs before reading entries so any newly-detected got_sick/recovered event
  // shows up in this same render.
  await syncDiaryEvents(petRow);

  const { data: entries } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('pet_id', petRow.id)
    .order('occurred_at', { ascending: false });

  const realEntries = (entries ?? []) as DiaryEntry[];
  const virtualEntries = computeVirtualMilestones(petRow, new Date());
  const timeline = mergeDiaryTimeline(realEntries, virtualEntries);

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-gradient-to-b from-[#BEE7F5] to-[#B7E4A0] px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/pet" className="text-sm font-semibold text-[#4A3222] underline">
            ← Back
          </Link>
          <h1 className="text-xl font-[family-name:var(--font-display)] font-bold text-[#4A3222]">
            {petRow.name}&apos;s Diary
          </h1>
        </div>

        <div className={cardClass}>
          <AddNoteForm />
        </div>

        <div className="space-y-3">
          {timeline.length === 0 && (
            <p className="text-center text-sm font-semibold text-[#8B5E3C]">
              No memories yet. Check back soon!
            </p>
          )}
          {timeline.map((item) => (
            <div
              key={`${item.kind}-${item.entry.entry_type}-${item.entry.occurred_at}`}
              className={`flex gap-3 ${cardClass}`}
            >
              <img
                src={imageFor(petRow, item.entry)}
                alt=""
                className="h-14 w-14 shrink-0 rounded-2xl border-2 border-[#C89B6C] object-cover"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-[family-name:var(--font-display)] font-bold text-[#4A3222]">
                  {labelFor(petRow.name, item.entry)}
                </p>
                <p className="text-xs font-semibold text-[#8B5E3C]">
                  {new Date(item.entry.occurred_at).toLocaleString()}
                </p>
                {item.kind === 'real' && item.entry.entry_type === 'note' && item.entry.text && (
                  <p className="text-sm text-[#4A3222]">{item.entry.text}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
