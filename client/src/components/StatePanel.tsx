import type { NpcState } from "../api/chatApi";
import { StatBar } from "./StatBar";

type StatePanelProps = {
  state: NpcState;
};

export function StatePanel({ state }: StatePanelProps) {
  const tianDaoWarn = state.tianDaoAlert > 70;
  const angerWarn = state.anger > 70;

  return (
    <section className="cultivation-panel cultivation-panel--cyan cultivation-corner relative overflow-hidden p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200">
          NPC 状态
        </h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
          0 — 100
        </span>
      </header>

      <div className="space-y-3">
        <StatBar label="信任" sublabel="trust" value={state.trust} tone="cyan" />
        <StatBar label="恐惧" sublabel="fear" value={state.fear} tone="amber" />
        <StatBar label="愤怒" sublabel="anger" value={state.anger} tone="rose" />
        <StatBar
          label="天道警戒"
          sublabel="tianDaoAlert"
          value={state.tianDaoAlert}
          tone="violet"
        />
      </div>

      {(tianDaoWarn || angerWarn) && (
        <div className="mt-4 space-y-2">
          {tianDaoWarn ? (
            <p className="rounded-md border border-violet-400/40 bg-violet-500/15 px-3 py-2 text-[11px] leading-5 text-violet-100">
              警告：天道镜正在锁定你的灵根烙印。
            </p>
          ) : null}
          {angerWarn ? (
            <p className="rounded-md border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-[11px] leading-5 text-rose-100">
              警告：白璃可能拒绝交易或举报你。
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
