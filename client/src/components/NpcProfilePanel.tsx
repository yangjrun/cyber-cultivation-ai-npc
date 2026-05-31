import { useGameStore } from "../state/store";

type Mode = "real" | "mock";

type NpcProfilePanelProps = {
  mode?: Mode;
};

const personalityTags = ["谨慎", "毒舌", "务实", "等价交换"];

const description = "她的丹炉接着旧城区的灵气废管，炉火是蓝紫色的。\n没人知道她炼的是药，还是监察院名单上的死人。";

export function NpcProfilePanel({ mode = "real" }: NpcProfilePanelProps) {
  const isReal = mode === "real";
  const player = useGameStore((state) => state.player);
  const traitLine = player.visibleTraits.length > 0 ? player.visibleTraits.join(" · ") : "未知灵根";

  return (
    <aside className="cultivation-panel cultivation-corner relative overflow-hidden p-5">
      <div className="mb-4 flex items-center justify-between text-[11px] uppercase tracking-wider text-cyan-300/85">
        <span>九龙下城 · 无相黑市</span>
        <span
          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] tracking-wider ${
            isReal
              ? "border-cyan-400/40 text-cyan-100"
              : "border-amber-400/40 text-amber-100"
          }`}
        >
          <span className={`cultivation-pulse-dot ${isReal ? "" : "!bg-amber-300 !shadow-[0_0_12px_rgba(251,191,36,0.7)]"}`} />
          {isReal ? "AI 在线" : "模拟模式"}
        </span>
      </div>

      <div className="flex flex-col items-center text-center">
        <div className="cultivation-portrait" aria-label="白璃立绘">
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-bold text-cyan-50 cultivation-glow-text">白璃</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.45em] text-cyan-200/80">Baili</div>
          </div>
        </div>

        <h1 className="mt-5 text-2xl font-semibold text-white cultivation-glow-text">白璃</h1>
        <p className="mt-1 text-sm text-cyan-200">黑市炼丹师</p>
        <p className="mt-1 text-xs text-slate-400">九龙下城 · 无相黑市 · 白璃丹铺</p>
        <p className="mt-2 inline-flex items-center rounded-full border border-violet-400/40 bg-violet-500/10 px-3 py-0.5 text-xs text-violet-100">
          派系 · 无相黑市
        </p>
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {personalityTags.map((tag) => (
          <span
            key={tag}
            className="rounded-md border border-cyan-400/30 bg-cyan-500/5 px-2 py-1 text-xs text-cyan-100"
          >
            #{tag}
          </span>
        ))}
      </div>

      <div className="mt-5 border-t border-cyan-400/15 pt-4">
        <div className="mb-2 text-[11px] uppercase tracking-wider text-cyan-300/85">
          档案记录
        </div>
        <p className="whitespace-pre-line text-sm leading-7 text-slate-300">{description}</p>
      </div>

      <div className="mt-5 rounded-lg border border-rose-400/25 bg-rose-500/5 p-3 text-xs leading-6 text-rose-100">
        <span className="font-semibold tracking-widest text-rose-200">目标：</span>
        玩家{player.name} · {player.realm} · {traitLine}。
      </div>
    </aside>
  );
}
