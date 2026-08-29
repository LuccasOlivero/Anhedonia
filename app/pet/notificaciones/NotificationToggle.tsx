'use client';

import { useState, useTransition } from 'react';
import { setDailyBonusEmailEnabled } from './actions';

interface NotificationToggleProps {
  label?: string;
  id?: string;
  initialEnabled: boolean;
  onToggle?: (enabled: boolean) => Promise<{ error?: string | null }>;
}

export function NotificationToggle({
  label = 'Avisarme cuando mi bono diario esté listo',
  id = 'daily-bonus-email',
  initialEnabled,
  onToggle = setDailyBonusEmailEnabled,
}: NotificationToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    const next = !enabled;
    startTransition(async () => {
      const result = await onToggle(next);
      if (result?.error) {
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
      <label className="flex items-center justify-between gap-3 cursor-pointer">
        <span id={`${id}-label`} className="font-[family-name:var(--font-display)] font-bold text-[#4A3222]">
          {label}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby={`${id}-label`}
          onClick={handleToggle}
          disabled={isPending}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 cursor-pointer ${
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
