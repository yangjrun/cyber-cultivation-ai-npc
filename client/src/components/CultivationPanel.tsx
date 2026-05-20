import { getActiveNpcState, useGameStore } from "../state/store";
import { StatBar } from "./StatBar";

export function CultivationPanel() {
  const player = useGameStore((state) => state.player);
  const npcState = useGameStore(getActiveNpcState);
  const cultivationLoading = useGameStore((state) => state.cultivationLoading);
  const breakthroughLoading = useGameStore((state) => state.breakthroughLoading);
  const lastCultivationResult = useGameStore((state) => state.lastCultivationResult);
  const lastBreakthroughResult = useGameStore((state) => state.lastBreakthroughResult);
  const cultivate = useGameStore((state) => state.cultivate);
  const breakthrough = useGameStore((state) => state.breakthrough);
  const qiPercent = player.qiCap > 0 ? Math.round((player.qiCurrent / player.qiCap) * 100) : 0;
  const canBreakthrough = player.qiCurrent >= player.qiCap && !breakthroughLoading;

  return (
    <section className="cyber-panel cyber-panel--cyan cyber-corner relative overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.35em] text-cyan-300/70">
        <span>// cultivation_core</span>
        <span>{player.realm}</span>
      </div>

      <div className="space-y-3">
        <StatBar label="qi" sublabel={`${player.qiCurrent}/${player.qiCap}`} value={qiPercent} tone="cyan" />
        <StatBar label="alert" sublabel="天道警戒" value={npcState.tianDaoAlert} tone={npcState.tianDaoAlert >= 70 ? "rose" : "amber"} />
      </div>

      {npcState.tianDaoAlert >= 70 ? (
        <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
          天道云警戒过高，突破会触发雷罚反噬。
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={cultivationLoading}
          onClick={() => void cultivate(30)}
          className="rounded-md border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cultivationLoading ? "打坐中..." : "打坐 30 秒"}
        </button>
        <button
          type="button"
          disabled={!canBreakthrough}
          onClick={() => void breakthrough()}
          className="rounded-md border border-violet-300/30 bg-violet-400/10 px-3 py-2 text-xs font-semibold text-violet-100 transition hover:border-violet-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {breakthroughLoading ? "突破中..." : "尝试突破"}
        </button>
      </div>

      {lastCultivationResult || lastBreakthroughResult ? (
        <p className="mt-3 text-xs text-slate-300">
          {lastBreakthroughResult || lastCultivationResult}
        </p>
      ) : null}
    </section>
  );
}
