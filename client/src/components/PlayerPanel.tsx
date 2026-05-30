import { useGameStore } from "../state/store";
import { RootsRadarChart } from "./RootsRadarChart";
import { StatBar } from "./StatBar";

const stageLabels = [
  "练气一层", "练气二层", "练气三层", "练气四层", "练气五层", "练气六层", "练气七层", "练气八层", "练气九层",
  "筑基初期", "筑基中期", "筑基后期", "金丹初期", "金丹中期", "金丹后期"
];

export function PlayerPanel() {
  const player = useGameStore((state) => state.player);
  const qiPercent = player.qiCap > 0 ? Math.round((player.qiCurrent / player.qiCap) * 100) : 0;
  const stageLabel = stageLabels[player.cultivationStageIdx] ?? player.realm;
  const progressValue = Math.round((player.cultivationStageIdx / Math.max(1, stageLabels.length - 1)) * 100);

  return (
    <section className="cultivation-panel cultivation-panel--violet cultivation-corner relative overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.35em] text-violet-300/70">
        <span>// player_core</span>
        <span>{player.sessionId ? "online" : "syncing"}</span>
      </div>

      <div className="mb-4 rounded-xl border border-violet-300/20 bg-violet-500/10 p-3">
        <p className="text-xs uppercase tracking-[0.3em] text-violet-200/70">avatar / cultivator</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-violet-100">{player.name}</h2>
            <p className="mt-1 text-xs text-slate-400">{stageLabel} · 非法灵根持有者</p>
          </div>
          <span className="rounded-full border border-violet-300/30 px-2 py-1 font-mono text-xs text-violet-100">
            {player.spiritStones} 灵石
          </span>
        </div>
      </div>

      <RootsRadarChart roots={player.roots} />

      <div className="mt-3 space-y-3">
        <StatBar label="qi_pool" sublabel={`${player.qiCurrent}/${player.qiCap}`} value={qiPercent} tone="violet" />
        <StatBar label="cultivation" sublabel={player.realm} value={progressValue} tone="cyan" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {player.visibleTraits.map((trait) => (
          <span key={trait} className="rounded-full border border-violet-300/20 bg-slate-950/50 px-2 py-1 text-[11px] text-violet-100/80">
            {trait}
          </span>
        ))}
      </div>
    </section>
  );
}
