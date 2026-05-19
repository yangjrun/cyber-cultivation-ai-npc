import { useEffect, useRef } from "react";

export type ChatMessage = {
  id: string;
  speaker: "player" | "npc";
  name: string;
  text: string;
  tone?: string;
  intentType?: string;
  timestamp: string;
};

type DialoguePanelProps = {
  messages: ChatMessage[];
  loading: boolean;
};

export function DialoguePanel({ messages, loading }: DialoguePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;

    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages, loading]);

  return (
    <section className="cyber-panel cyber-corner flex min-h-[520px] flex-1 flex-col overflow-hidden p-5">
      <header className="mb-4 flex items-end justify-between border-b border-cyan-400/15 pb-3">
        <div>
          <div className="text-xs uppercase tracking-[0.4em] text-cyan-200/70">channel</div>
          <h2 className="mt-1 text-xl font-semibold text-cyan-50 cyber-glow-text">
            黑市丹铺通信频道
          </h2>
          <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-violet-200/70">
            加密灵识链路 · Tiandao Cloud Unverified
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-emerald-200">
          <span className="cyber-pulse-dot !bg-emerald-300 !shadow-[0_0_12px_rgba(110,231,183,0.8)]" />
          live
        </div>
      </header>

      <div
        ref={scrollRef}
        className="cyber-scroll flex-1 space-y-3 overflow-y-auto pr-2"
      >
        {messages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-cyan-500/30 p-6 text-sm text-slate-400">
            丹铺的义体风铃正在低鸣。
          </div>
        ) : (
          messages.map((message) => <ChatBubble key={message.id} message={message} />)
        )}

        {loading ? (
          <div className="mr-10 flex items-center gap-3 rounded-xl border border-violet-400/20 bg-violet-500/5 px-4 py-3 text-sm text-violet-100">
            <span className="cyber-pulse-dot !bg-violet-300 !shadow-[0_0_12px_rgba(139,92,246,0.8)]" />
            灵识传输中...
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isPlayer = message.speaker === "player";
  const intent = message.intentType && message.intentType !== "none" ? message.intentType : null;

  return (
    <article
      className={
        isPlayer
          ? "ml-10 rounded-xl border border-cyan-400/30 bg-cyan-500/5 p-3 text-right shadow-[0_0_18px_-12px_rgba(34,211,238,0.7)]"
          : "mr-10 rounded-xl border border-violet-400/30 bg-violet-500/5 p-3 shadow-[0_0_18px_-12px_rgba(139,92,246,0.7)]"
      }
    >
      <header
        className={
          isPlayer
            ? "mb-1 flex items-center justify-end gap-3 text-[10px] uppercase tracking-[0.3em] text-cyan-200"
            : "mb-1 flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-violet-200"
        }
      >
        <span>{message.name}</span>
        <span className="font-mono text-slate-500">{message.timestamp}</span>
      </header>

      {message.tone ? (
        <div
          className={
            isPlayer
              ? "mb-1 text-[11px] text-cyan-300/80"
              : "mb-1 text-[11px] text-rose-200/80"
          }
        >
          语气：{message.tone}
        </div>
      ) : null}

      <p
        className={
          isPlayer
            ? "text-sm leading-6 text-cyan-50"
            : "text-sm leading-6 text-slate-100"
        }
      >
        {message.text}
      </p>

      {!isPlayer && intent ? (
        <div className="mt-2 inline-flex items-center rounded-md border border-rose-400/40 bg-rose-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.3em] text-rose-200">
          intent: {intent}
        </div>
      ) : null}
    </article>
  );
}
