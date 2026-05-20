import { useGameStore } from "../state/store";

const SCENE_GRADIENT: Record<string, string> = {
  black_market: "from-fuchsia-900/40 via-violet-900/30 to-slate-950",
  inspector_outpost: "from-cyan-900/40 via-slate-900/40 to-slate-950",
  thunder_tavern: "from-amber-900/30 via-rose-900/30 to-slate-950",
  player_cave: "from-emerald-900/30 via-slate-900/40 to-slate-950"
};

export function SceneBackdrop() {
  const activeSceneId = useGameStore((state) => state.activeSceneId);
  const scenes = useGameStore((state) => state.scenes);
  const scene = scenes.find((s) => s.sceneId === activeSceneId);

  if (!scene) {
    return null;
  }

  const gradient = SCENE_GRADIENT[scene.sceneId] ?? "from-slate-900 via-slate-900 to-slate-950";

  return (
    <section
      className={`cyber-panel cyber-corner overflow-hidden bg-gradient-to-br ${gradient} p-4`}
      aria-label={`场景背景：${scene.name}`}
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-cyan-50 cyber-glow-text">{scene.name}</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-200/70">
          {scene.sceneId}
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-6 text-slate-200/80">{scene.description}</p>
    </section>
  );
}
