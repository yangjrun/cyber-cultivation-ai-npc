import { useState, useMemo } from "react";
import { getActiveNpcState, useGameStore } from "../state/store";
import { StatBar } from "./StatBar";
import { PanelButton } from "./ui/PanelButton";

export function CultivationPanel() {
  const [expanded, setExpanded] = useState(false);

  const player = useGameStore((state) => state.player);
  const npcState = useGameStore(getActiveNpcState);
  const cultivationLoading = useGameStore((state) => state.cultivationLoading);
  const breakthroughLoading = useGameStore((state) => state.breakthroughLoading);
  const lastCultivationResult = useGameStore((state) => state.lastCultivationResult);
  const lastBreakthroughResult = useGameStore((state) => state.lastBreakthroughResult);
  const cultivationResultTick = useGameStore((state) => state.cultivationResultTick);
  const passiveIncomeLoading = useGameStore((state) => state.passiveIncomeLoading);
  const lastPassiveIncomeResult = useGameStore((state) => state.lastPassiveIncomeResult);
  const cultivate = useGameStore((state) => state.cultivate);
  const breakthrough = useGameStore((state) => state.breakthrough);
  const claimPassiveIncome = useGameStore((state) => state.claimPassiveIncome);

  const qiPercent = useMemo(
    () => player.qiCap > 0 ? Math.round((player.qiCurrent / player.qiCap) * 100) : 0,
    [player.qiCurrent, player.qiCap]
  );

  const qiFull = useMemo(
    () => player.qiCurrent >= player.qiCap,
    [player.qiCurrent, player.qiCap]
  );

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
      <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-wider text-cyan-300/85">
        <span>修炼核心</span>
        <span>{player.realm}</span>
      </div>

      <PanelButton
        variant="cyan"
        fullWidth
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? "收起修炼 ▲" : "展开修炼 ▼"}
      </PanelButton>

      {expanded && (
        <>
          <div className="mt-3 space-y-3">
            <StatBar label="灵气" sublabel={`${player.qiCurrent}/${player.qiCap}`} value={qiPercent} tone="cyan" />
            <StatBar label="警戒" sublabel="天道警戒" value={npcState.tianDaoAlert} tone={npcState.tianDaoAlert >= 70 ? "rose" : "amber"} />
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
            <PanelButton
              variant="cyan"
              disabled={!canCultivate}
              onClick={() => void cultivate(30)}
            >
              {cultivateLabel}
            </PanelButton>
            <PanelButton
              variant="violet"
              disabled={!canBreakthrough}
              onClick={() => void breakthrough()}
            >
              {breakthroughLoading ? "突破中..." : "尝试突破"}
            </PanelButton>
          </div>

          {canClaimPassiveIncome && (
            <PanelButton
              variant="emerald"
              fullWidth
              disabled={passiveIncomeLoading}
              onClick={() => void claimPassiveIncome()}
              className="mt-2"
            >
              {passiveIncomeLoading ? "凝聚中..." : "凝聚灵石"}
            </PanelButton>
          )}

          {lastPassiveIncomeResult && (
            <p className="mt-2 text-[11px] text-emerald-300/80" data-testid="passive-income-result">
              {lastPassiveIncomeResult}
            </p>
          )}

          {resultText && (
            <p
              key={cultivationResultTick}
              className="mt-3 animate-flash text-xs text-slate-300"
              data-testid="cultivation-result"
            >
              {resultText}
            </p>
          )}
        </>
      )}
    </section>
  );
}
