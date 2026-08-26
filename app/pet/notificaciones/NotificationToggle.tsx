'use client';

import { useState, useTransition } from 'react';
import { setDailyBonusEmailEnabled } from './actions';

export function NotificationToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    const next = !enabled;
    startTransition(async () => {
      const result = await setDailyBonusEmailEnabled(next);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setEnabled(next);
      }
    });
  }

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-center text-sm font-semibold text-[#F4436C]">{error}</p>}
      <label className="flex items-center justify-between gap-3">
        <span className="font-[family-name:var(--font-display)] font-bold text-[#4A3222]">
          Avisarme cuando mi bono diario esté listo
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={handleToggle}
          disabled={isPending}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            enabled ? 'bg-[#8B5CF6]' : 'bg-[#D8C7A8]'
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-[0_2px_0_rgba(0,0,0,0.15)] transition-transform ${
              enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`}
          />
        </button>
      </label>
    </div>
  );
}
