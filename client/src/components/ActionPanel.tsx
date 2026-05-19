type ActionPanelProps = {
  actionResult: string;
  intentType: string;
};

export function ActionPanel({ actionResult, intentType }: ActionPanelProps) {
  return (
    <section className="rounded-2xl border border-pink-400/25 bg-slate-950/75 p-4">
      <h2 className="mb-3 text-base font-semibold text-pink-200">动作结果</h2>
      <div className="mb-2 text-xs text-slate-400">intent：{intentType}</div>
      <p className="text-sm text-slate-200">{actionResult || "尚未触发动作。"}</p>
    </section>
  );
}
