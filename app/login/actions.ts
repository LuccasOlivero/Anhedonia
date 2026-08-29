'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

function formatAuthError(error: unknown): string {
  const msg =
    typeof error === 'string'
      ? error
      : (error as { message?: string })?.message || String(error);

  if (
    msg.toLowerCase().includes('failed to fetch') ||
    msg.toLowerCase().includes('fetch failed') ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')
  ) {
    return 'No se pudo conectar con Supabase. Configurá las credenciales reales de tu proyecto (NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY) en .env.local.';
  }

  if (msg.toLowerCase().includes('invalid login credentials')) {
    return 'Email o contraseña incorrectos.';
  }

  if (msg.toLowerCase().includes('user already registered')) {
    return 'Este email ya está registrado. Probá iniciando sesión.';
  }

  if (msg.toLowerCase().includes('password should be at least')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }

  return msg || 'Ocurrió un error inesperado al autenticar.';
}

export async function signUp(_prevState: { error: string }, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      return { error: formatAuthError(error) };
    }
  } catch (err) {
    return { error: formatAuthError(err) };
  }

  redirect('/onboarding');
}

export async function signIn(_prevState: { error: string }, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { error: formatAuthError(error) };
    }
  } catch (err) {
    return { error: formatAuthError(err) };
  }

  redirect('/pet');
}

export async function signOut() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.error('signOut error:', err);
  }
  redirect('/login');
}
