'use client';

import { useActionState, useEffect, useRef } from 'react';
import { addDiaryNote } from './actions';

// addDiaryNote returns { error: '' } as the untouched initial shape, { error: 'message' }
// on validation/Supabase failure, and { error: null } on success. Unlike OnboardingForm's
// createPet (which redirects away on success), this form stays on the page, so we watch
// for the `error === null` success signal to reset the uncontrolled textarea.
const initialState: { error: string | null } = { error: '' };

const labelClass = 'text-sm font-semibold text-[#8B5E3C]';
const textareaClass =
  'w-full rounded-2xl border-2 border-[#C89B6C] bg-white px-4 py-2 text-[#4A3222] focus:border-[#FF6FA5] focus:outline-none';

export function AddNoteForm() {
  const [state, formAction, pending] = useActionState(addDiaryNote, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.error === null) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <label className="block space-y-1">
        <span className={labelClass}>Sumar un recuerdo</span>
        <textarea
          name="text"
          required
          maxLength={280}
          rows={3}
          placeholder="Escribí algo lindo que quieras recordar..."
          className={textareaClass}
        />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm font-semibold text-[#F4436C]">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-gradient-to-b from-[#FF9EC4] to-[#FF6FA5] py-2 font-[family-name:var(--font-display)] font-bold text-white shadow-[0_4px_0_rgba(0,0,0,0.25)] transition-all active:translate-y-[3px] active:shadow-[0_1px_0_rgba(0,0,0,0.25)] disabled:opacity-50"
      >
        {pending ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  );
}
