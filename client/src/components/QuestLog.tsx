import { useGameStore } from "../state/store";
import type { QuestProgress } from "../api/questApi";

const STATUS_LABEL: Record<QuestProgress["status"], string> = {
  available: "可接",
  accepted: "已接",
  in_progress: "进行中",
  completed: "已完成",
  failed: "失败"
};

const STATUS_TONE: Record<QuestProgress["status"], string> = {
  available: "border-slate-500/40 bg-slate-900/40 text-slate-300",
  accepted: "border-cyan-400/40 bg-cyan-500/10 text-cyan-100",
  in_progress: "border-amber-400/40 bg-amber-500/10 text-amber-100",
  completed: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
  failed: "border-rose-400/40 bg-rose-500/10 text-rose-100"
};

export function QuestLog() {
  const quests = useGameStore((state) => state.quests);
  const active = quests.filter((q) => q.status === "accepted" || q.status === "in_progress");
  const finished = quests.filter((q) => q.status === "completed" || q.status === "failed");

  return (
    <section className="cyber-panel cyber-corner space-y-3 p-4">
      <header className="flex items-center justify-between text-[10px] uppercase tracking-[0.35em] text-amber-300/80">
        <span>// quest_log</span>
        <span>active {active.length} · done {finished.length}</span>
      </header>

      {quests.length === 0 ? (
        <p className="text-xs text-slate-400">还没有任何任务记录。</p>
      ) : (
        <ul className="space-y-2">
          {[...active, ...finished].map((quest) => (
            <QuestEntry key={quest.questId} quest={quest} />
          ))}
        </ul>
      )}
    </section>
  );
}

function QuestEntry({ quest }: { quest: QuestProgress }) {
  const title = quest.definition?.title ?? quest.questId;
  const description = quest.definition?.description ?? "";

  return (
    <li className={`rounded-md border p-2 ${STATUS_TONE[quest.status]}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold">{title}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.3em]">
          {STATUS_LABEL[quest.status]}
        </span>
      </div>
      {description ? (
        <p className="mt-1 text-[11px] leading-5 text-slate-200/80" title={description}>
          {description}
        </p>
      ) : null}
    </li>
  );
}
