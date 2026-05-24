import { useEffect } from "react";
import { useGameStore } from "../state/store";

export function ChroniclePage() {
  const sessionId = useGameStore((state) => state.sessionId);
  const chronicles = useGameStore((state) => state.chronicles);
  const chronicleLoading = useGameStore((state) => state.chronicleLoading);
  const generateChronicle = useGameStore((state) => state.generateChronicle);
  const refreshChronicles = useGameStore((state) => state.refreshChronicles);

  useEffect(() => {
    if (sessionId) void refreshChronicles();
  }, [sessionId, refreshChronicles]);

  return (
    <section className="cyber-panel cyber-corner mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-start justify-between border-b border-cyan-400/15 pb-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.4em] text-cyan-300/70">// chronicle</div>
          <h1 className="mt-1 text-2xl font-semibold text-cyan-50 cyber-glow-text">史册</h1>
          <p className="mt-1 text-xs text-slate-400">
            史官记下你这一世的回望。可以多次回望——每一次都是不同的笔触。
          </p>
        </div>
        <button
          type="button"
          disabled={!sessionId || chronicleLoading}
          onClick={() => void generateChronicle()}
          className="rounded-md bg-gradient-to-r from-cyan-400 to-violet-400 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-950 transition hover:from-cyan-300 hover:to-violet-300 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400"
        >
          {chronicleLoading ? "落笔中..." : "回望本世"}
        </button>
      </header>

      {chronicles.length === 0 ? (
        <p className="text-sm text-slate-500">史官还没为你写过任何回望。</p>
      ) : (
        <ul className="space-y-4">
          {chronicles.map((entry) => (
            <li
              key={entry.id}
              className="rounded-xl border border-cyan-400/20 bg-slate-950/40 p-4 shadow-[0_0_18px_-12px_rgba(34,211,238,0.6)]"
            >
              <header className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-cyan-200/80">
                <span>回望 #{entry.id}</span>
                <span className="font-mono text-slate-500">{formatTimestamp(entry.createdAt)}</span>
              </header>
              <p className="whitespace-pre-line text-sm leading-7 text-slate-200">{entry.content}</p>
              {entry.milestonesSnapshot.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {entry.milestonesSnapshot.map((id) => (
                    <span key={id} className="rounded-full border border-violet-300/30 bg-slate-950/50 px-2 py-0.5 text-[10px] text-violet-100">
                      {id}
                    </span>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
