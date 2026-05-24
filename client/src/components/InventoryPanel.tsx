import { useGameStore } from "../state/store";

export function InventoryPanel() {
  const inventory = useGameStore((state) => state.inventory);
  const alchemyLoading = useGameStore((state) => state.alchemyLoading);
  const lastAlchemyResult = useGameStore((state) => state.lastAlchemyResult);
  const consumeItem = useGameStore((state) => state.consumeItem);
  const openAlchemyModal = useGameStore((state) => state.openAlchemyModal);

  return (
    <section className="cyber-panel cyber-panel--amber cyber-corner relative overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.35em] text-amber-300/70">
        <span>// inventory</span>
        <button
          type="button"
          onClick={openAlchemyModal}
          className="rounded border border-amber-300/30 px-2 py-1 text-[10px] text-amber-100 transition hover:border-amber-200"
        >
          炼丹
        </button>
      </div>

      {inventory.length === 0 ? (
        <p className="text-xs text-slate-400">背包空空，连丹渣都没有。</p>
      ) : (
        <div className="space-y-2">
          {inventory.map((entry) => (
            <div key={entry.itemId} className="rounded-xl border border-amber-300/15 bg-slate-950/50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-amber-100">{entry.item?.name ?? entry.itemId}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{entry.item?.description ?? "未知物品"}</p>
                </div>
                <span className="font-mono text-xs text-amber-100">×{entry.quantity}</span>
              </div>
              {entry.item?.type === "pill" ? (
                <button
                  type="button"
                  disabled={alchemyLoading}
                  onClick={() => void consumeItem(entry.itemId)}
                  className="mt-2 rounded border border-violet-300/25 px-2 py-1 text-[11px] text-violet-100 transition hover:border-violet-200 disabled:opacity-50"
                >
                  使用
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {lastAlchemyResult ? <p className="mt-3 text-xs text-slate-300">{lastAlchemyResult}</p> : null}
    </section>
  );
}
