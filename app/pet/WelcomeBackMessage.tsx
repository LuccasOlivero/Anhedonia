'use client';

import { useState } from 'react';

// Renders once per page load (a fresh mount is a fresh `dismissed` state)
// and never blocks interaction with the rest of the page — dismissing it is
// purely local UI state, not persisted anywhere.
export function WelcomeBackMessage({ message }: { message: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-[#8B5CF6]/30 bg-[#F3EEFF] px-4 py-3">
      <p className="text-sm font-semibold text-[#5B3FA6]">{message}</p>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Cerrar"
        className="shrink-0 rounded-full bg-white/70 px-2 py-1 text-xs font-bold text-[#5B3FA6] ring-1 ring-inset ring-[#8B5CF6]/20"
      >
        ✕
      </button>
    </div>
  );
}
