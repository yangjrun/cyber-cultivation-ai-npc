import type { NpcState } from "../api/chatApi";
import { StatBar } from "./StatBar";

type StatePanelProps = {
  state: NpcState;
};

export function StatePanel({ state }: StatePanelProps) {
  const tianDaoWarn = state.tianDaoAlert > 70;
  const angerWarn = state.anger > 70;

  return (
    <section className="cyber-panel cyber-panel--cyan cyber-corner relative overflow-hidden p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200">
          NPC 状态
        </h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
          0 — 100
        </span>
      </header>

      <div className="space-y-3">
        <StatBar label="trust" sublabel="信任" value={state.trust} tone="cyan" />
        <StatBar label="fear" sublabel="恐惧" value={state.fear} tone="amber" />
        <StatBar label="anger" sublabel="愤怒" value={state.anger} tone="rose" />
        <StatBar
          label="tianDaoAlert"
          sublabel="天道警戒"
          value={state.tianDaoAlert}
          tone="violet"
        />
      </div>

      {(tianDaoWarn || angerWarn) && (
        <div className="mt-4 space-y-2">
          {tianDaoWarn ? (
            <p className="rounded-md border border-violet-400/40 bg-violet-500/15 px-3 py-2 text-[11px] leading-5 text-violet-100">
              警告：天道云正在锁定你的灵根波形。
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
