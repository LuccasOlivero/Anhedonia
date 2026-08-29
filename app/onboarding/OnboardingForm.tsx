'use client';

import { useActionState, useState, type ChangeEvent } from 'react';
import { createPet } from './actions';
import { validatePhotoFiles } from '@/lib/validate-photo-files';

const initialState = { error: '' };

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
      <div className="w-full max-w-lg pet-wood-frame bg-[#FFF9EC] rounded-[28px] sm:rounded-[36px] p-8 sm:p-12 flex flex-col items-center justify-center text-center gap-5 shadow-[inset_0_3px_8px_rgba(0,0,0,0.15),0_16px_36px_rgba(0,0,0,0.4)] animate-pet-pop">
        <div className="relative">
          <span className="animate-wobble text-7xl sm:text-8xl inline-block filter drop-shadow-lg select-none">
            🥚
          </span>
          <span className="absolute -top-1 -right-2 text-2xl animate-bounce">✨</span>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-[family-name:var(--font-display)] font-bold text-[#58331A]">
            Incubando a tu mascota...
          </h2>
          <p className="text-sm sm:text-base font-medium text-[#8B5E3C] max-w-sm">
            Nuestra IA está preparando su hogar, sus expresiones y su espíritu mágico. ¡En unos segundos va a nacer!
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border-2 border-[#58331A] bg-[#FFFDF8] text-xs font-bold text-[#58331A] shadow-inner">
          <span className="animate-spin text-sm">⏳</span> Preparando sprites mágicos...
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="w-full max-w-lg pet-wood-frame bg-[#FFF9EC] rounded-[28px] sm:rounded-[36px] p-6 sm:p-8 shadow-[inset_0_3px_8px_rgba(0,0,0,0.15),0_16px_36px_rgba(0,0,0,0.4)] space-y-5"
    >
      {/* Name Input */}
      <div className="space-y-1.5">
        <label className="block">
          <span className="font-[family-name:var(--font-display)] text-sm sm:text-base font-bold text-[#58331A] flex items-center gap-1.5">
            🏷️ Nombre de tu mascota
          </span>
          <input
            type="text"
            name="name"
            required
            placeholder="Ej: Milo, Luna, Rocco, Charly..."
            className="w-full mt-1 rounded-full border-2 border-[#C89B6C] bg-white px-4 py-2.5 text-[#4A3222] font-semibold placeholder-[#BCA488] shadow-inner focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/30 focus:outline-none transition-all"
          />
        </label>
      </div>

      {/* Photo Upload Dropzone */}
      <div className="space-y-2">
        <label className="block">
          <span className="font-[family-name:var(--font-display)] text-sm sm:text-base font-bold text-[#58331A] flex items-center gap-1.5">
            📸 Fotos de tu mascota real (1 a 3)
          </span>
          <span className="text-xs text-[#8B5E3C] font-medium block mt-0.5">
            Subí fotos claras de tu perrito o gatito para que la IA capture sus colores y personalidad.
          </span>
          <input
            type="file"
            name="photos"
            accept="image/*"
            multiple
            required
            onChange={handleFilesChange}
            className="w-full mt-2 rounded-2xl border-2 border-dashed border-[#C89B6C] hover:border-[#804A26] bg-[#FFFDF8] px-4 py-3 text-xs sm:text-sm text-[#58331A] file:mr-3 file:rounded-full file:border-2 file:border-[#58331A] file:bg-gradient-to-b file:from-[#FDE047] file:to-[#F59E0B] file:px-4 file:py-1.5 file:font-bold file:text-[#58331A] file:shadow-[0_2px_0_#58331A] file:cursor-pointer shadow-inner cursor-pointer transition-colors"
          />
        </label>
      </div>

      {/* Golden Beveled Preview Frames */}
      {previews.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {previews.map((src, index) => (
            <div
              key={src}
              className="relative group w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 border-[#F59E0B] ring-2 ring-[#58331A] shadow-[0_4px_10px_rgba(0,0,0,0.25),inset_0_2px_4px_rgba(255,255,255,0.6)] overflow-hidden bg-[#58331A]/10 transition-transform hover:scale-105"
            >
              <img
                src={src}
                alt={`Vista previa ${index + 1} de tu mascota`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 pointer-events-none rounded-xl border border-white/40 shadow-inner" />
            </div>
          ))}
        </div>
      )}

      {/* Error messages */}
      {clientError && (
        <div
          role="alert"
          className="rounded-2xl border-2 border-[#EF4444] bg-[#FEE2E2] px-4 py-2 text-center text-sm font-bold text-[#991B1B] shadow-sm"
        >
          {clientError}
        </div>
      )}
      {state?.error && (
        <div
          role="alert"
          className="rounded-2xl border-2 border-[#EF4444] bg-[#FEE2E2] px-4 py-2 text-center text-sm font-bold text-[#991B1B] shadow-sm"
        >
          {state.error}
        </div>
      )}

      {/* 3D Candy Button */}
      <button
        type="submit"
        disabled={!!clientError}
        className="pet-candy-btn pet-candy-btn-green w-full py-3.5 text-lg sm:text-xl font-[family-name:var(--font-display)] font-extrabold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        Crear mi mascota
      </button>
    </form>
  );
}
