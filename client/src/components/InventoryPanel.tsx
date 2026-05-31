import { useState } from "react";
import { useGameStore } from "../state/store";
import { PanelButton } from "./ui/PanelButton";

const qualityLabels: Record<string, string> = {
  perfect: "上品",
  fine: "良品",
  common: "普通"
};

const qualityClasses: Record<string, string> = {
  perfect: "border-amber-300/40 text-amber-200",
  fine: "border-cyan-300/40 text-cyan-200",
  common: "border-slate-400/30 text-slate-300"
};

export function InventoryPanel() {
  const [expanded, setExpanded] = useState(false);
  const inventory = useGameStore((state) => state.inventory);
  const alchemyLoading = useGameStore((state) => state.alchemyLoading);
  const lastAlchemyResult = useGameStore((state) => state.lastAlchemyResult);
  const alchemyResultTick = useGameStore((state) => state.alchemyResultTick);
  const consumeItem = useGameStore((state) => state.consumeItem);
  const openAlchemyModal = useGameStore((state) => state.openAlchemyModal);
  const openGatheringModal = useGameStore((state) => state.openGatheringModal);

  return (
    <section className="cultivation-panel cultivation-panel--amber cultivation-corner relative overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-wider text-amber-300/85">
        <span>背包 ({inventory.length})</span>
        <div className="flex items-center gap-2">
          <PanelButton
            variant="emerald"
            onClick={() => void openGatheringModal()}
            className="!px-2 !py-1 !text-[11px]"
          >
            采集
          </PanelButton>
          <PanelButton
            variant="amber"
            onClick={openAlchemyModal}
            className="!px-2 !py-1 !text-[11px]"
          >
            炼丹
          </PanelButton>
        </div>
      </div>

      <PanelButton
        variant="amber"
        fullWidth
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? "收起背包 ▲" : "展开背包 ▼"}
      </PanelButton>

      {expanded && (
        <>
          {inventory.length === 0 ? (
            <p className="mt-3 text-xs text-slate-400">背包空空，连丹渣都没有。</p>
          ) : (
            <div className="mt-3 space-y-2">
              {inventory.map((entry) => (
                <div key={`${entry.itemId}:${entry.quality ?? "none"}`} className="rounded-xl border border-amber-300/15 bg-slate-950/50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-amber-100">
                        {entry.item?.name ?? entry.itemId}
                        {entry.quality ? (
                          <span className={`ml-2 rounded border px-1.5 py-0.5 text-[10px] ${qualityClasses[entry.quality] ?? ""}`}>
                            {qualityLabels[entry.quality] ?? entry.quality}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">{entry.item?.description ?? "未知物品"}</p>
                    </div>
                    <span className="font-mono text-xs text-amber-100">×{entry.quantity}</span>
                  </div>
                  {entry.item?.type === "pill" && (
                    <PanelButton
                      variant="violet"
                      disabled={alchemyLoading}
                      onClick={() => void consumeItem(entry.itemId)}
                      className="mt-2 !text-[11px]"
                    >
                      使用
                    </PanelButton>
                  )}
                </div>
              ))}
            </div>
          )}

          {lastAlchemyResult && (
            <p
              key={alchemyResultTick}
              className="mt-3 animate-flash text-xs text-slate-300"
              data-testid="inventory-alchemy-result"
            >
              {lastAlchemyResult}
            </p>
          )}
        </>
      )}
    </section>
  );
}
