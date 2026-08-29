'use client';

import { useActionState, useState } from 'react';
import { signIn, signUp } from './actions';

const initialState = { error: '' };

export function LoginForm() {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [signInState, signInAction, signInPending] = useActionState(signIn, initialState);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, initialState);

  return (
    <div className="w-full pet-wood-frame bg-[#FFF9EC] rounded-[28px] sm:rounded-[36px] p-6 sm:p-8 shadow-[inset_0_3px_8px_rgba(0,0,0,0.15),0_16px_36px_rgba(0,0,0,0.4)] space-y-6">
      {/* Switcher Tabs */}
      <div className="flex rounded-full bg-[#58331A]/10 p-1.5 border-2 border-[#58331A]/20 gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('signin')}
          className={`flex-1 py-2 px-3 rounded-full font-[family-name:var(--font-display)] font-bold text-sm sm:text-base transition-all cursor-pointer ${
            activeTab === 'signin'
              ? 'pet-candy-btn pet-candy-btn-gold text-[#58331A] shadow-[0_3px_0_#58331A]'
              : 'text-[#8B5E3C] hover:text-[#58331A] hover:bg-white/40'
          }`}
        >
          🔑 Iniciar sesión
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('signup')}
          className={`flex-1 py-2 px-3 rounded-full font-[family-name:var(--font-display)] font-bold text-sm sm:text-base transition-all cursor-pointer ${
            activeTab === 'signup'
              ? 'pet-candy-btn pet-candy-btn-orange text-white shadow-[0_3px_0_#58331A]'
              : 'text-[#8B5E3C] hover:text-[#58331A] hover:bg-white/40'
          }`}
        >
          ✨ Crear cuenta
        </button>
      </div>

      {/* Iniciar sesión Form */}
      {activeTab === 'signin' && (
        <form action={signInAction} className="space-y-4 animate-pet-pop">
          <div className="text-center space-y-0.5">
            <h2 className="text-xl sm:text-2xl font-[family-name:var(--font-display)] font-bold text-[#58331A]">
              ¡Qué lindo verte!
            </h2>
            <p className="text-xs text-[#8B5E3C] font-semibold">
              Ingresá con tus datos para reencontrarte con tu mascota
            </p>
          </div>

          <label className="block space-y-1">
            <span className="text-xs sm:text-sm font-bold text-[#58331A] flex items-center gap-1.5">
              ✉️ Email
            </span>
            <input
              type="email"
              name="email"
              required
              placeholder="tu-email@ejemplo.com"
              className="w-full rounded-full border-2 border-[#C89B6C] bg-white px-4 py-2.5 text-[#4A3222] font-semibold placeholder-[#BCA488] shadow-inner focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/30 focus:outline-none transition-all"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs sm:text-sm font-bold text-[#58331A] flex items-center gap-1.5">
              🔒 Contraseña
            </span>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              placeholder="••••••••"
              className="w-full rounded-full border-2 border-[#C89B6C] bg-white px-4 py-2.5 text-[#4A3222] font-semibold placeholder-[#BCA488] shadow-inner focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/30 focus:outline-none transition-all"
            />
          </label>

          {signInState?.error && (
            <div
              role="alert"
              className="rounded-2xl border-2 border-[#EF4444] bg-[#FEE2E2] px-4 py-2 text-center text-sm font-bold text-[#991B1B] shadow-sm"
            >
              {signInState.error}
            </div>
          )}

          <button
            type="submit"
            disabled={signInPending}
            className="pet-candy-btn pet-candy-btn-green w-full py-3 text-base sm:text-lg font-[family-name:var(--font-display)] font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {signInPending ? 'Ingresando...' : 'Ingresar al juego'}
          </button>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setActiveTab('signup')}
              className="text-xs font-bold text-[#8B5E3C] hover:text-[#58331A] underline decoration-[#C89B6C] cursor-pointer"
            >
              ¿No tenés cuenta todavía? Creá tu mascota acá
            </button>
          </div>
        </form>
      )}

      {/* Crear cuenta Form */}
      {activeTab === 'signup' && (
        <form action={signUpAction} className="space-y-4 animate-pet-pop">
          <div className="text-center space-y-0.5">
            <h2 className="text-xl sm:text-2xl font-[family-name:var(--font-display)] font-bold text-[#58331A]">
              ¡Unite a Pets Forever!
            </h2>
            <p className="text-xs text-[#8B5E3C] font-semibold">
              Creá tu cuenta gratis y adoptá a tu compañero virtual
            </p>
          </div>

          <label className="block space-y-1">
            <span className="text-xs sm:text-sm font-bold text-[#58331A] flex items-center gap-1.5">
              ✉️ Email
            </span>
            <input
              type="email"
              name="email"
              required
              placeholder="tu-email@ejemplo.com"
              className="w-full rounded-full border-2 border-[#C89B6C] bg-white px-4 py-2.5 text-[#4A3222] font-semibold placeholder-[#BCA488] shadow-inner focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/30 focus:outline-none transition-all"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs sm:text-sm font-bold text-[#58331A] flex items-center gap-1.5">
              🔒 Contraseña (mínimo 6 caracteres)
            </span>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
              className="w-full rounded-full border-2 border-[#C89B6C] bg-white px-4 py-2.5 text-[#4A3222] font-semibold placeholder-[#BCA488] shadow-inner focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/30 focus:outline-none transition-all"
            />
          </label>

          {signUpState?.error && (
            <div
              role="alert"
              className="rounded-2xl border-2 border-[#EF4444] bg-[#FEE2E2] px-4 py-2 text-center text-sm font-bold text-[#991B1B] shadow-sm"
            >
              {signUpState.error}
            </div>
          )}

          <button
            type="submit"
            disabled={signUpPending}
            className="pet-candy-btn pet-candy-btn-pink w-full py-3 text-base sm:text-lg font-[family-name:var(--font-display)] font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {signUpPending ? 'Creando cuenta...' : 'Crear mi cuenta'}
          </button>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setActiveTab('signin')}
              className="text-xs font-bold text-[#8B5E3C] hover:text-[#58331A] underline decoration-[#C89B6C] cursor-pointer"
            >
              ¿Ya tenés cuenta? Entrá a ver a tu mascota acá
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
