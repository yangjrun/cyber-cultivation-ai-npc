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
    <section className="cultivation-panel cultivation-corner space-y-3 p-4">
      <header className="flex items-center justify-between text-[11px] uppercase tracking-wider text-amber-300/85">
        <span>任务日志</span>
        <span>进行中 {active.length} · 已完成 {finished.length}</span>
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
  const cooldownLabel = formatCooldown(quest);

  return (
    <li className={`rounded-md border p-2 ${STATUS_TONE[quest.status]}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold">
          {title}
          {quest.repeatable ? (
            <span className="ml-2 rounded border border-emerald-300/40 px-1 py-0.5 text-[9px] uppercase tracking-wider text-emerald-200">
              委托
            </span>
          ) : null}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.3em]">
          {STATUS_LABEL[quest.status]}
        </span>
      </div>
      {description ? (
        <p className="mt-1 text-[11px] leading-5 text-slate-200/80" title={description}>
          {description}
        </p>
      ) : null}
      {cooldownLabel ? (
        <p className="mt-1 text-[10px] text-emerald-300/70">{cooldownLabel}</p>
      ) : null}
    </li>
  );
}

function formatCooldown(quest: QuestProgress): string | null {
  if (!quest.repeatable || quest.status !== "completed" || !quest.nextAvailableAt) {
    return null;
  }

  const nextAvailable = new Date(quest.nextAvailableAt).getTime();
  const now = Date.now();

  if (now >= nextAvailable) {
    return "可再次接取";
  }

  const remainingMs = nextAvailable - now;
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) {
    return `冷却中 · 约 ${hours} 小时后可再接`;
  }

  return `冷却中 · 约 ${minutes} 分钟后可再接`;
}
