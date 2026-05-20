import { Link } from "react-router-dom";
import { useGameStore } from "../state/store";

export function SettingsPage() {
  const sessionId = useGameStore((state) => state.sessionId);
  const playerId = useGameStore((state) => state.playerId);
  const activeSceneId = useGameStore((state) => state.activeSceneId);
  const activeNpcId = useGameStore((state) => state.activeNpcId);

  return (
    <section className="cyber-panel cyber-corner mx-auto max-w-2xl space-y-4 p-6">
      <header>
        <h1 className="text-lg font-semibold text-cyan-50 cyber-glow-text">设置与调试</h1>
        <p className="mt-1 text-xs uppercase tracking-[0.3em] text-cyan-200/60">// settings</p>
      </header>

      <dl className="grid grid-cols-1 gap-2 text-sm text-slate-200 sm:grid-cols-2">
        <Row label="Session ID" value={sessionId || "(未创建)"} />
        <Row label="Player ID" value={playerId || "(未创建)"} />
        <Row label="当前场景" value={activeSceneId} />
        <Row label="当前 NPC" value={activeNpcId} />
      </dl>

      <div className="flex flex-wrap items-center gap-3 border-t border-cyan-400/15 pt-4 text-xs">
        <button
          type="button"
          onClick={() => {
            try {
              window.localStorage.removeItem("cyber-cultivation.sessionId");
            } catch {
              // localStorage may be unavailable; ignore.
            }
            window.location.reload();
          }}
          className="rounded-md border border-rose-300/60 px-3 py-1 text-rose-100 transition hover:bg-rose-500/10"
        >
          清空本地 Session，刷新
        </button>
        <Link
          to="/play"
          className="rounded-md border border-cyan-300/60 px-3 py-1 text-cyan-100 transition hover:bg-cyan-500/10"
        >
          返回对话
        </Link>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-700/50 bg-slate-900/40 px-3 py-2">
      <dt className="text-[10px] uppercase tracking-[0.3em] text-slate-400">{label}</dt>
      <dd className="mt-1 break-all font-mono text-[12px] text-slate-100">{value}</dd>
    </div>
  );
}
