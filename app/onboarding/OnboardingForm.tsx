'use client';

import { useActionState, useState, type ChangeEvent } from 'react';
import { createPet } from './actions';
import { validatePhotoFiles } from '@/lib/validate-photo-files';

const initialState = { error: '' };
const cardClass =
  'rounded-[2rem] border-8 border-[#6B4226] ring-4 ring-inset ring-[#C89B6C] bg-[#FFF9EC] p-6 shadow-[inset_0_3px_6px_rgba(0,0,0,0.15),0_10px_20px_rgba(0,0,0,0.25)]';
const inputClass =
  'w-full rounded-full border-2 border-[#C89B6C] bg-white px-4 py-2 text-[#4A3222] focus:border-[#FF6FA5] focus:outline-none';
const labelClass = 'text-sm font-semibold text-[#8B5E3C]';

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createPet, initialState);
  const [clientError, setClientError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  function handleFilesChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const error = validatePhotoFiles(files);
    setClientError(error);
    setPreviews(error ? [] : files.map((f) => URL.createObjectURL(f)));
  }

  if (pending) {
    return (
      <div className={`flex flex-col items-center gap-4 ${cardClass} p-10`}>
        <span className="animate-wobble text-5xl">🥚</span>
        <p className="text-lg font-[family-name:var(--font-display)] font-bold text-[#4A3222]">Incubating your pet...</p>
      </div>
    );
  }

  return (
    <form action={formAction} className={`mx-auto w-full max-w-sm space-y-4 ${cardClass}`}>
      <label className="block space-y-1">
        <span className={labelClass}>Pet name</span>
        <input type="text" name="name" required className={inputClass} />
      </label>
      <label className="block space-y-1">
        <span className={labelClass}>Photos (1-3, max 5MB each)</span>
        <input
          type="file"
          name="photos"
          accept="image/*"
          multiple
          required
          onChange={handleFilesChange}
          className="w-full rounded-2xl border-2 border-dashed border-[#C89B6C] px-4 py-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[#F2B84B] file:px-3 file:py-1 file:font-semibold file:text-[#4A3222]"
        />
      </label>
      {previews.length > 0 && (
        <div className="flex gap-2">
          {previews.map((src) => (
            <img key={src} src={src} alt="Pet preview" className="h-16 w-16 rounded-2xl border-2 border-[#C89B6C] object-cover" />
          ))}
        </div>
      )}
      {clientError && <p role="alert" className="text-sm font-semibold text-[#F4436C]">{clientError}</p>}
      {state?.error && <p role="alert" className="text-sm font-semibold text-[#F4436C]">{state.error}</p>}
      <button
        type="submit"
        disabled={!!clientError}
        className="w-full rounded-full bg-gradient-to-b from-[#FFB199] to-[#FF8966] py-2 font-[family-name:var(--font-display)] font-bold text-white shadow-[0_4px_0_rgba(0,0,0,0.25)] transition-all active:translate-y-[3px] active:shadow-[0_1px_0_rgba(0,0,0,0.25)] disabled:opacity-50"
      >
        Create my pet
      </button>
    </form>
  );
}
