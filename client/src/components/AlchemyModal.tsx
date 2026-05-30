import { useState } from "react";
import { useGameStore } from "../state/store";

const recipes = [
  {
    id: "cloud_veil_pill",
    name: "遮云丹",
    materials: "影髓草 ×2 / 劫灰盐 ×1",
    hint: "降低天道警戒，突破前最实用。"
  },
  {
    id: "breakthrough_pill",
    name: "破境丹",
    materials: "影髓草 ×1 / 劫灰盐 ×2",
    hint: "提升下一次突破成功率。"
  }
] as const;

export function AlchemyModal() {
  const open = useGameStore((state) => state.alchemyModalOpen);
  const loading = useGameStore((state) => state.alchemyLoading);
  const close = useGameStore((state) => state.closeAlchemyModal);
  const refine = useGameStore((state) => state.refineAlchemy);
  const lastAlchemyResult = useGameStore((state) => state.lastAlchemyResult);
  const alchemyResultTick = useGameStore((state) => state.alchemyResultTick);
  const [recipeId, setRecipeId] = useState<string>(recipes[0].id);
  const [fireLevel, setFireLevel] = useState(62);
  const recipe = recipes.find((item) => item.id === recipeId) ?? recipes[0];

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="炼丹炉">
      <div className="cultivation-panel cultivation-panel--rose cultivation-corner w-full max-w-lg p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-rose-300/70">// alchemy_furnace</p>
            <h2 className="mt-1 text-xl font-semibold text-rose-100">黑市炼丹炉</h2>
          </div>
          <button type="button" onClick={close} className="rounded border border-slate-500/40 px-2 py-1 text-xs text-slate-200 hover:border-rose-200">
            关闭
          </button>
        </div>

        <div className="space-y-4">
          <label className="block text-xs text-slate-300">
            配方
            <select
              value={recipeId}
              onChange={(event) => setRecipeId(event.target.value)}
              className="mt-2 block w-full rounded-md border border-rose-300/25 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none"
            >
              {recipes.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>

          <div className="rounded-xl border border-rose-300/15 bg-slate-950/60 p-3 text-xs text-slate-300">
            <p className="text-rose-100">材料：{recipe.materials}</p>
            <p className="mt-1 text-slate-400">{recipe.hint}</p>
          </div>

          <label className="block text-xs text-slate-300">
            火候：<span className="font-mono text-rose-100">{fireLevel}</span>
            <input
              type="range"
              min="0"
              max="100"
              value={fireLevel}
              onChange={(event) => setFireLevel(Number(event.target.value))}
              className="mt-2 block w-full accent-rose-300"
            />
          </label>

          <button
            type="button"
            disabled={loading}
            onClick={() => void refine(recipeId, [], fireLevel)}
            className="w-full rounded-md bg-gradient-to-r from-rose-400 to-amber-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-950 transition disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400"
          >
            {loading ? "开炉中..." : lastAlchemyResult ? "再炼一炉" : "开炉炼制"}
          </button>

          {lastAlchemyResult ? (
            <div
              key={alchemyResultTick}
              data-testid="alchemy-result"
              className="animate-flash rounded-xl border border-rose-300/25 bg-slate-950/60 px-3 py-2 text-xs text-rose-100"
            >
              {lastAlchemyResult}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
