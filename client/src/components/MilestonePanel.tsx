import { useEffect } from "react";
import { useGameStore } from "../state/store";

export function MilestonePanel() {
  const sessionId = useGameStore((state) => state.sessionId);
  const milestones = useGameStore((state) => state.milestones);
  const total = useGameStore((state) => state.milestonesTotal);
  const loading = useGameStore((state) => state.milestonesLoading);
  const refresh = useGameStore((state) => state.refreshMilestones);

  useEffect(() => {
    if (sessionId) void refresh();
  }, [sessionId, refresh]);

  return (
    <section className="cultivation-panel cultivation-corner relative overflow-hidden p-4">
      <header className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-wider text-violet-300/85">
        <span>里程碑</span>
        <span>
          {milestones.length}
          {total > 0 ? ` / ${total}` : ""}
        </span>
      </header>

      {loading && milestones.length === 0 ? (
        <p className="text-xs text-slate-500">望气中...</p>
      ) : milestones.length === 0 ? (
        <p className="text-xs text-slate-400">还没刻下任何里程碑。继续走,有人会看见。</p>
      ) : (
        <ul className="space-y-1.5">
          {milestones.map((entry) => (
            <li
              key={entry.id}
              className="rounded-md border border-violet-400/20 bg-violet-500/5 px-2 py-1.5 text-[11px] leading-5 text-violet-100"
              title={entry.description}
            >
              <span className="font-semibold text-violet-100">{entry.title}</span>
              <span className="ml-1 text-slate-400">· {entry.description}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
