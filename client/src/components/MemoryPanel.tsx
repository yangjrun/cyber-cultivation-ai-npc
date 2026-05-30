type MemoryPanelProps = {
  memories: string[];
  npcName: string;
};

export function MemoryPanel({ memories, npcName }: MemoryPanelProps) {
  return (
    <section className="cultivation-panel cultivation-corner relative overflow-hidden p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-200">
          {npcName}的记忆
        </h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
          local cache
        </span>
      </header>

      {memories.length === 0 ? (
        <p className="text-sm text-slate-500">暂无可用记忆。</p>
      ) : (
        <ul className="space-y-2 text-sm text-slate-200">
          {memories.map((memory, index) => (
            <li
              key={`${index}-${memory}`}
              className="flex items-start gap-2 rounded-md border border-violet-400/15 bg-violet-500/5 px-3 py-2"
            >
              <span className="mt-0.5 text-violet-300">◇</span>
              <span className="flex-1 leading-6">{memory}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
