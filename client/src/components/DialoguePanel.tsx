export type DialogueEntry = {
  id: number;
  speaker: "player" | "npc";
  text: string;
  tone?: string;
};

type DialoguePanelProps = {
  history: DialogueEntry[];
};

export function DialoguePanel({ history }: DialoguePanelProps) {
  return (
    <section className="flex min-h-[460px] flex-col rounded-2xl border border-cyan-400/30 bg-slate-950/80 p-5 shadow-neon">
      <h2 className="mb-4 text-lg font-semibold text-cyan-200">黑市对话链路</h2>
      <div className="flex-1 space-y-3 overflow-y-auto pr-2">
        {history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-cyan-500/30 p-6 text-sm text-slate-400">
            丹铺的义体风铃正在低鸣。白璃抬眼，等你先开价。
          </div>
        ) : (
          history.map((entry) => (
            <article
              key={entry.id}
              className={entry.speaker === "player" ? "ml-8 rounded-xl bg-violet-500/15 p-3" : "mr-8 rounded-xl bg-cyan-500/10 p-3"}
            >
              <div className="mb-1 text-xs uppercase tracking-[0.25em] text-slate-400">
                {entry.speaker === "player" ? "陆玄" : "白璃"}
              </div>
              {entry.tone ? <div className="mb-1 text-xs text-pink-200">tone：{entry.tone}</div> : null}
              <p className="text-sm leading-6 text-slate-100">{entry.text}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
