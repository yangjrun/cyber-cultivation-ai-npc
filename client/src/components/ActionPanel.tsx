type ActionPanelProps = {
  actionResult: string;
  intentType: string;
};

export function ActionPanel({ actionResult, intentType }: ActionPanelProps) {
  const hasIntent = intentType && intentType !== "none";

  return (
    <section className="cultivation-panel cultivation-panel--rose cultivation-corner relative overflow-hidden p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-rose-200">
          动作结果
        </h2>
        <span
          className={`rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.25em] ${
            hasIntent
              ? "border-rose-400/40 bg-rose-500/10 text-rose-100"
              : "border-slate-600/60 bg-slate-800/50 text-slate-400"
          }`}
        >
          intent:{intentType || "none"}
        </span>
      </header>

      <p className="text-sm leading-6 text-slate-100">
        {actionResult || "暂无触发动作。"}
      </p>
    </section>
  );
}
