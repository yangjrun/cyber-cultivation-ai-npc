import { useEffect, useRef } from "react";
import type { InputMode } from "../api/chatApi";

export type ChatMessage = {
  id: string;
  speaker: "player" | "npc" | "narrator";
  npcId?: string;
  name: string;
  text: string;
  tone?: string;
  actions?: string[];
  intentType?: string;
  kind?: InputMode;
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
  if (message.speaker === "narrator") {
    return <NarratorBubble message={message} />;
  }

  const isPlayer = message.speaker === "player";
  const intent = message.intentType && message.intentType !== "none" ? message.intentType : null;
  const tone = getNpcTone(message.npcId);

  return (
    <article
      className={
        isPlayer
          ? "ml-10 rounded-xl border border-cyan-400/30 bg-cyan-500/5 p-3 text-right shadow-[0_0_18px_-12px_rgba(34,211,238,0.7)]"
          : `mr-10 rounded-xl border p-3 shadow-[0_0_18px_-12px] ${tone.bubble}`
      }
    >
      <header
        className={
          isPlayer
            ? "mb-1 flex items-center justify-end gap-3 text-[10px] uppercase tracking-[0.3em] text-cyan-200"
            : `mb-1 flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] ${tone.header}`
        }
      >
        <span>{message.name}</span>
        <span className="font-mono text-slate-500">{message.timestamp}</span>
      </header>

      {message.actions && message.actions.length > 0 ? (
        <div
          className={
            isPlayer
              ? "mb-1 text-[12px] italic text-cyan-200/70"
              : "mb-1 text-[12px] italic text-slate-400/85"
          }
        >
          {message.actions.join("  ")}
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
        <div className={`mt-2 inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-[0.3em] ${tone.intent}`}>
          intent: {intent}
        </div>
      ) : null}
    </article>
  );
}

function NarratorBubble({ message }: { message: ChatMessage }) {
  const style = getNarratorStyle(message.kind);

  return (
    <article
      data-testid="narrator-bubble"
      data-kind={message.kind ?? "action"}
      className={`mx-12 rounded-xl border ${style.border} ${style.bg} p-3 text-center shadow-[0_0_18px_-12px]`}
    >
      <header className={`mb-1 flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.3em] ${style.header}`}>
        <span>{message.name}</span>
        <span className="font-mono text-slate-500">{message.timestamp}</span>
      </header>
      <p className={`text-sm italic leading-6 ${style.text}`}>{message.text}</p>
    </article>
  );
}

function getNarratorStyle(kind: ChatMessage["kind"]) {
  if (kind === "monologue") {
    return {
      border: "border-violet-400/30",
      bg: "bg-violet-500/5",
      header: "text-violet-200/80",
      text: "text-violet-100/80"
    };
  }

  return {
    border: "border-rose-400/30",
    bg: "bg-rose-500/5",
    header: "text-rose-200/80",
    text: "text-rose-100"
  };
}

function getNpcTone(npcId: string | undefined) {
  if (npcId === "chimu") {
    return {
      bubble: "border-rose-400/30 bg-rose-500/5 shadow-rose-500/70",
      header: "text-rose-200",
      meta: "text-rose-200/80",
      intent: "border-rose-400/40 bg-rose-500/10 text-rose-200"
    };
  }

  if (npcId === "qinggu") {
    return {
      bubble: "border-amber-400/30 bg-amber-500/5 shadow-amber-500/70",
      header: "text-amber-200",
      meta: "text-amber-200/80",
      intent: "border-amber-400/40 bg-amber-500/10 text-amber-200"
    };
  }

  if (npcId === "suhe") {
    return {
      bubble: "border-emerald-400/30 bg-emerald-500/5 shadow-emerald-500/70",
      header: "text-emerald-200",
      meta: "text-emerald-200/80",
      intent: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
    };
  }

  return {
    bubble: "border-violet-400/30 bg-violet-500/5 shadow-violet-500/70",
    header: "text-violet-200",
    meta: "text-rose-200/80",
    intent: "border-rose-400/40 bg-rose-500/10 text-rose-200"
  };
}
