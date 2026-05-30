import { useGameStore } from "../state/store";

export function GatheringModal() {
  const open = useGameStore((state) => state.gatheringModalOpen);
  const loading = useGameStore((state) => state.gatheringLoading);
  const points = useGameStore((state) => state.gatheringPoints);
  const close = useGameStore((state) => state.closeGatheringModal);
  const gatherFromPoint = useGameStore((state) => state.gatherFromPoint);
  const lastResult = useGameStore((state) => state.lastGatheringResult);
  const resultTick = useGameStore((state) => state.gatheringResultTick);
  const player = useGameStore((state) => state.player);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="采集"
    >
      <div className="cultivation-panel cultivation-panel--emerald cultivation-corner w-full max-w-lg p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-emerald-300/70">// gathering_field</p>
            <h2 className="mt-1 text-xl font-semibold text-emerald-100">采集</h2>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded border border-slate-500/40 px-2 py-1 text-xs text-slate-200 hover:border-emerald-200"
          >
            关闭
          </button>
        </div>

        <div className="mb-3 flex items-center justify-between rounded-lg border border-emerald-300/15 bg-slate-950/60 px-3 py-2 text-xs">
          <span className="text-slate-400">当前灵气</span>
          <span className="font-mono text-emerald-100">{player.qiCurrent} / {player.qiCap}</span>
        </div>

        <div className="space-y-3">
          {points.length === 0 ? (
            <p className="rounded-lg border border-slate-500/20 bg-slate-950/60 px-3 py-4 text-center text-xs text-slate-400">
              {loading ? "勘察中..." : "此地没有可采集的资源。"}
            </p>
          ) : (
            points.map((point) => {
              const canAfford = player.qiCurrent >= point.qiCost;
              const disabled = loading || !point.available || !canAfford;

              return (
                <div
                  key={point.pointId}
                  className="rounded-xl border border-emerald-300/15 bg-slate-950/60 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-emerald-100">{point.name}</p>
                      <p className="mt-1 text-xs text-slate-400">{point.description}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-500">
                        <span>耗气 {point.qiCost}</span>
                        <span>冷却 {point.cooldownHours}h</span>
                        {point.alertRisk > 0 ? (
                          <span className="text-amber-400/80">天道警戒 +{point.alertRisk}</span>
                        ) : (
                          <span className="text-emerald-400/60">隐蔽</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => void gatherFromPoint(point.pointId)}
                      className="shrink-0 rounded-md bg-gradient-to-r from-emerald-400 to-teal-300 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-950 transition disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400"
                    >
                      {!point.available ? "冷却中" : !canAfford ? "灵气不足" : "采集"}
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {lastResult ? (
            <div
              key={resultTick}
              data-testid="gathering-result"
              className="animate-flash rounded-xl border border-emerald-300/25 bg-slate-950/60 px-3 py-2 text-xs text-emerald-100"
            >
              {lastResult}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
