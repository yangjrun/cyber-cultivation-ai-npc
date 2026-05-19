type StatBarTone = "cyan" | "amber" | "rose" | "violet";

type StatBarProps = {
  label: string;
  sublabel?: string;
  value: number;
  tone: StatBarTone;
};

const trackTone: Record<StatBarTone, string> = {
  cyan: "from-cyan-500 via-cyan-300 to-sky-200",
  amber: "from-amber-500 via-amber-300 to-yellow-200",
  rose: "from-rose-500 via-rose-400 to-pink-300",
  violet: "from-violet-500 via-fuchsia-400 to-purple-300"
};

const labelTone: Record<StatBarTone, string> = {
  cyan: "text-cyan-200",
  amber: "text-amber-200",
  rose: "text-rose-200",
  violet: "text-violet-200"
};

const dotTone: Record<StatBarTone, string> = {
  cyan: "bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.8)]",
  amber: "bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.8)]",
  rose: "bg-rose-300 shadow-[0_0_10px_rgba(244,114,182,0.8)]",
  violet: "bg-violet-300 shadow-[0_0_10px_rgba(139,92,246,0.8)]"
};

export function StatBar({ label, sublabel, value, tone }: StatBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className={`flex items-center gap-2 ${labelTone[tone]}`}>
          <span className={`h-2 w-2 rounded-full ${dotTone[tone]}`} />
          <span className="font-mono uppercase tracking-[0.18em]">{label}</span>
          {sublabel ? <span className="text-slate-400">/ {sublabel}</span> : null}
        </span>
        <span className="font-mono text-slate-100">{value}</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full border border-slate-700/60 bg-slate-900/70">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${trackTone[tone]} transition-all duration-500`}
          style={{ width: `${clamped}%` }}
        />
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-slate-200/10" />
      </div>
    </div>
  );
}
