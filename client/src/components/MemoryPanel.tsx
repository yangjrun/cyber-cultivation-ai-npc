type MemoryPanelProps = {
  memories: string[];
};

export function MemoryPanel({ memories }: MemoryPanelProps) {
  return (
    <section className="rounded-2xl border border-violet-400/25 bg-slate-950/75 p-4">
      <h2 className="mb-3 text-base font-semibold text-violet-200">最近记忆</h2>
      {memories.length === 0 ? (
        <p className="text-sm text-slate-500">暂无可用记忆。</p>
      ) : (
        <ul className="space-y-2 text-sm text-slate-200">
          {memories.map((memory, index) => (
            <li key={`${memory}-${index}`} className="rounded-lg border border-violet-400/10 bg-violet-400/10 p-2">
              {memory}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
