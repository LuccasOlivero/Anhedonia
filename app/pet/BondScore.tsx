// Deliberately its own small section, not a fifth StatBar row: StatBar's
// red/yellow/green scale communicates "needs attention", which is exactly
// the wrong read for a relationship-depth indicator that should never
// punish the user for leaving it alone. Purple/violet is used here
// specifically because it doesn't appear in StatBar's need-urgency palette.
export function BondScore({ score, tierLabel }: { score: number; tierLabel: string }) {
  return (
    <div className="space-y-1.5 rounded-2xl border-2 border-[#8B5CF6]/30 bg-[#F3EEFF] px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[#5B3FA6]">💜 Vínculo</span>
        <span className="rounded-full bg-[#8B5CF6] px-2 py-0.5 text-xs font-bold text-white">{tierLabel}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/70 ring-1 ring-inset ring-[#8B5CF6]/20">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#C9A7FF] to-[#8B5CF6] transition-all"
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-right text-xs font-semibold text-[#5B3FA6]/70">{score}/100</p>
    </div>
  );
}
