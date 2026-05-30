import { useEffect } from "react";
import { useGameStore } from "../state/store";

export function ArtifactPanel() {
  const sessionId = useGameStore((state) => state.sessionId);
  const artifacts = useGameStore((state) => state.artifacts);
  const loading = useGameStore((state) => state.artifactsLoading);
  const refresh = useGameStore((state) => state.refreshArtifacts);
  const equipArtifact = useGameStore((state) => state.equipArtifact);
  const unequipArtifact = useGameStore((state) => state.unequipArtifact);

  useEffect(() => {
    if (sessionId) void refresh();
  }, [sessionId, refresh]);

  return (
    <section className="cultivation-panel cultivation-corner relative overflow-hidden p-4">
      <header className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.35em] text-amber-300/80">
        <span>// artifacts</span>
        <span>{artifacts.length}</span>
      </header>

      {loading && artifacts.length === 0 ? (
        <p className="text-xs text-slate-500">望气法宝...</p>
      ) : artifacts.length === 0 ? (
        <p className="text-xs text-slate-400">还没拿到任何法宝。让派系记住你,法宝自然会到手。</p>
      ) : (
        <ul className="space-y-2">
          {artifacts.map((entry) => (
            <li
              key={entry.id}
              className="rounded-md border border-amber-300/20 bg-amber-500/5 p-2 text-[11px] leading-5 text-amber-100"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="font-semibold text-amber-100">{entry.name}</div>
                  <p className="mt-0.5 text-[11px] text-slate-400">{entry.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void (entry.equipped ? unequipArtifact(entry.id) : equipArtifact(entry.id))
                  }
                  aria-pressed={entry.equipped}
                  className={
                    entry.equipped
                      ? "rounded border border-violet-300/70 bg-violet-500/15 px-2 py-1 text-[10px] uppercase tracking-[0.25em] text-violet-100"
                      : "rounded border border-slate-500/60 px-2 py-1 text-[10px] uppercase tracking-[0.25em] text-slate-300 hover:border-amber-300/60 hover:text-amber-100"
                  }
                >
                  {entry.equipped ? "已佩戴" : "佩戴"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
