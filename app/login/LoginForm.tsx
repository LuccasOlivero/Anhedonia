'use client';

import { useActionState } from 'react';
import { signIn, signUp } from './actions';

const initialState = { error: '' };
const cardClass =
  'rounded-[2rem] border-8 border-[#6B4226] ring-4 ring-inset ring-[#C89B6C] bg-[#FFF9EC] p-6 shadow-[inset_0_3px_6px_rgba(0,0,0,0.15),0_10px_20px_rgba(0,0,0,0.25)] space-y-4';
const inputClass =
  'w-full rounded-full border-2 border-[#C89B6C] bg-white px-4 py-2 text-[#4A3222] focus:border-[#FF6FA5] focus:outline-none';
const labelClass = 'text-sm font-semibold text-[#8B5E3C]';
const buttonClass =
  'w-full rounded-full py-2 font-[family-name:var(--font-display)] font-bold text-white shadow-[0_4px_0_rgba(0,0,0,0.25)] transition-all active:translate-y-[3px] active:shadow-[0_1px_0_rgba(0,0,0,0.25)] disabled:opacity-50';

export function LoginForm() {
  const [signInState, signInAction, signInPending] = useActionState(signIn, initialState);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, initialState);

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <form action={signInAction} className={cardClass}>
        <h2 className="text-center text-2xl font-[family-name:var(--font-display)] font-bold text-[#4A3222]">Iniciar sesión</h2>
        <label className="block space-y-1">
          <span className={labelClass}>Email</span>
          <input type="email" name="email" required className={inputClass} />
        </label>
        <label className="block space-y-1">
          <span className={labelClass}>Contraseña</span>
          <input type="password" name="password" required minLength={6} className={inputClass} />
        </label>
        {signInState?.error && (
          <p role="alert" className="text-center text-sm font-semibold text-[#F4436C]">
            {signInState.error}
          </p>
        )}
        <button
          type="submit"
          disabled={signInPending}
          className={`${buttonClass} bg-gradient-to-b from-[#7EE8DB] to-[#4FD1C5]`}
        >
          {signInPending ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>

      <form action={signUpAction} className={cardClass}>
        <h2 className="text-center text-2xl font-[family-name:var(--font-display)] font-bold text-[#4A3222]">Crear cuenta</h2>
        <label className="block space-y-1">
          <span className={labelClass}>Email</span>
          <input type="email" name="email" required className={inputClass} />
        </label>
        <label className="block space-y-1">
          <span className={labelClass}>Contraseña (mínimo 6 caracteres)</span>
          <input type="password" name="password" required minLength={6} className={inputClass} />
        </label>
        {signUpState?.error && (
          <p role="alert" className="text-center text-sm font-semibold text-[#F4436C]">
            {signUpState.error}
          </p>
        )}
        <button
          type="submit"
          disabled={signUpPending}
          className={`${buttonClass} bg-gradient-to-b from-[#FFB199] to-[#FF8966]`}
        >
          {signUpPending ? 'Creando cuenta...' : 'Registrarme'}
        </button>
      </form>
    </div>
  );
}
