import { getNpcName, initialNpcState, useGameStore } from "../state/store";

export function NpcListPanel() {
  const scenes = useGameStore((state) => state.scenes);
  const activeSceneId = useGameStore((state) => state.activeSceneId);
  const activeNpcId = useGameStore((state) => state.activeNpcId);
  const npcStates = useGameStore((state) => state.npcStates);
  const selectNpc = useGameStore((state) => state.selectNpc);

  const currentScene = scenes.find((scene) => scene.sceneId === activeSceneId);
  const npcIds = currentScene?.npcIds ?? [];

  if (npcIds.length === 0) {
    return (
      <section className="cyber-panel cyber-corner p-4 text-sm text-slate-400">
        当前场景没有可对话的 NPC。
      </section>
    );
  }

  return (
    <section className="cyber-panel cyber-corner space-y-2 p-3">
      <header className="flex items-center justify-between text-[10px] uppercase tracking-[0.35em] text-cyan-300/70">
        <span>// in_scene</span>
        <span>{npcIds.length} NPC</span>
      </header>
      <ul className="space-y-2">
        {npcIds.map((npcId) => {
          const state = npcStates[npcId] ?? initialNpcState;
          const active = npcId === activeNpcId;
          return (
            <li key={npcId}>
              <button
                type="button"
                onClick={() => selectNpc(npcId)}
                aria-pressed={active}
                className={
                  active
                    ? "flex w-full items-center justify-between rounded-md border border-violet-300/70 bg-violet-500/10 px-3 py-2 text-left text-sm text-violet-100"
                    : "flex w-full items-center justify-between rounded-md border border-slate-600/40 bg-slate-900/40 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-violet-300/60 hover:text-violet-100"
                }
              >
                <span className="font-semibold">{getNpcName(npcId)}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-400">
                  T{state.trust} A{state.anger}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
