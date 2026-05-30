import { getActiveNpcState, useGameStore } from "../state/store";
import { StatBar } from "./StatBar";

export function CultivationPanel() {
  const player = useGameStore((state) => state.player);
  const npcState = useGameStore(getActiveNpcState);
  const cultivationLoading = useGameStore((state) => state.cultivationLoading);
  const breakthroughLoading = useGameStore((state) => state.breakthroughLoading);
  const lastCultivationResult = useGameStore((state) => state.lastCultivationResult);
  const lastBreakthroughResult = useGameStore((state) => state.lastBreakthroughResult);
  const cultivationResultTick = useGameStore((state) => state.cultivationResultTick);
  const cultivate = useGameStore((state) => state.cultivate);
  const breakthrough = useGameStore((state) => state.breakthrough);
  const claimPassiveIncome = useGameStore((state) => state.claimPassiveIncome);
  const passiveIncomeLoading = useGameStore((state) => state.passiveIncomeLoading);
  const lastPassiveIncomeResult = useGameStore((state) => state.lastPassiveIncomeResult);
  const qiPercent = player.qiCap > 0 ? Math.round((player.qiCurrent / player.qiCap) * 100) : 0;
  const qiFull = player.qiCurrent >= player.qiCap;
  const canBreakthrough = qiFull && !breakthroughLoading;
  const canCultivate = !cultivationLoading && !qiFull;
  // 筑基期及以上（境界索引 >= 9）才能凝聚灵石
  const canClaimPassiveIncome = player.cultivationStageIdx >= 9;
  const cultivateLabel = cultivationLoading
    ? "打坐中..."
    : qiFull
      ? "灵气已满"
      : "打坐 30 秒";
  const resultText = lastBreakthroughResult || lastCultivationResult;

  return (
    <section className="cultivation-panel cultivation-panel--cyan cultivation-corner relative overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.35em] text-cyan-300/70">
        <span>// cultivation_core</span>
        <span>{player.realm}</span>
      </div>

      <div className="space-y-3">
        <StatBar label="qi" sublabel={`${player.qiCurrent}/${player.qiCap}`} value={qiPercent} tone="cyan" />
        <StatBar label="alert" sublabel="天道警戒" value={npcState.tianDaoAlert} tone={npcState.tianDaoAlert >= 70 ? "rose" : "amber"} />
      </div>

      {qiFull ? (
        <p className="mt-3 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-100">
          灵气已满，继续打坐不会再涨，请尝试突破。
        </p>
      ) : null}

      {npcState.tianDaoAlert >= 70 ? (
        <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
          天道镜警戒过高，突破会触发雷罚反噬。
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!canCultivate}
          onClick={() => void cultivate(30)}
          className="rounded-md border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cultivateLabel}
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

      {canClaimPassiveIncome ? (
        <button
          type="button"
          disabled={passiveIncomeLoading}
          onClick={() => void claimPassiveIncome()}
          className="mt-2 w-full rounded-md border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:border-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {passiveIncomeLoading ? "凝聚中..." : "凝聚灵石"}
        </button>
      ) : null}

      {lastPassiveIncomeResult ? (
        <p className="mt-2 text-[11px] text-emerald-300/80" data-testid="passive-income-result">
          {lastPassiveIncomeResult}
        </p>
      ) : null}

      {resultText ? (
        <p
          key={cultivationResultTick}
          className="mt-3 animate-flash text-xs text-slate-300"
          data-testid="cultivation-result"
        >
          {resultText}
        </p>
      ) : null}
    </section>
  );
}
