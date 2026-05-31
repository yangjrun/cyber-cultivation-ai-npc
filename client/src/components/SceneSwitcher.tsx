import { useNavigate } from "react-router-dom";
import { useGameStore } from "../state/store";
import type { SceneDefinition } from "../api/sceneApi";

export function SceneSwitcher() {
  const scenes = useGameStore((state) => state.scenes);
  const activeSceneId = useGameStore((state) => state.activeSceneId);
  const switchScene = useGameStore((state) => state.switchScene);
  const navigate = useNavigate();

  if (scenes.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="场景切换"
      className="cultivation-panel cultivation-corner flex items-center gap-2 overflow-x-auto p-3"
    >
      <span className="text-[11px] uppercase tracking-wider text-cyan-300/85">场景</span>
      <div className="flex flex-wrap gap-2">
        {scenes.map((scene) => (
          <SceneTab
            key={scene.sceneId}
            scene={scene}
            active={scene.sceneId === activeSceneId}
            onSelect={async () => {
              if (scene.sceneId === activeSceneId) return;
              await switchScene(scene.sceneId);
              navigate(`/play/scene/${scene.sceneId}`);
            }}
          />
        ))}
      </div>
    </nav>
  );
}

type SceneTabProps = {
  scene: SceneDefinition;
  active: boolean;
  onSelect: () => void;
};

function SceneTab({ scene, active, onSelect }: SceneTabProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={
        active
          ? "rounded-md border border-cyan-300/70 bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-cyan-100 shadow-[0_0_12px_-4px_rgba(34,211,238,0.6)]"
          : "rounded-md border border-slate-600/50 bg-slate-900/40 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-300 transition hover:border-cyan-300/60 hover:text-cyan-100"
      }
    >
      {scene.name}
    </button>
  );
}
