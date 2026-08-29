const STAT_ICONS: Record<string, string> = {
  Hambre: '🍖',
  Felicidad: '😊',
  Energía: '⚡',
  Higiene: '✨',
  Hunger: '🍖',
  Happiness: '😊',
  Energy: '⚡',
  Cleanliness: '✨',
};

function colorFor(value: number): string {
  if (value >= 60) return 'bg-gradient-to-b from-[#8EE896] to-[#6FCF7B]';
  if (value >= 30) return 'bg-gradient-to-b from-[#F7CE7A] to-[#F2B84B]';
  return 'bg-gradient-to-b from-[#FF8FA3] to-[#F4436C]';
}

export function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xl">{STAT_ICONS[label] ?? ''}</span>
      <div className="flex-1">
        <div className="mb-1 flex justify-between text-xs font-semibold text-[#8B5E3C]">
          <span>{label}</span>
          <span>{Math.round(value)}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-[#F0DEB4] ring-1 ring-inset ring-[#6B4226]/20">
          <div className={`h-full rounded-full transition-all ${colorFor(value)}`} style={{ width: `${value}%` }} />
        </div>
      </div>
    </div>
  );
}
