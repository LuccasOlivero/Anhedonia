import { LoginForm } from './LoginForm';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-b from-[#BEE7F5] to-[#B7E4A0] px-4 py-12">
      <h1 className="text-4xl font-[family-name:var(--font-display)] font-bold text-[#4A3222]">🐾 Pets Forever</h1>
      <LoginForm />
    </main>
  );
}
