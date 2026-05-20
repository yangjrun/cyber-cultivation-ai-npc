import { useEffect } from "react";
import { DialoguePanel } from "./components/DialoguePanel";
import { MemoryPanel } from "./components/MemoryPanel";
import { NpcProfilePanel } from "./components/NpcProfilePanel";
import { PlayerPanel } from "./components/PlayerPanel";
import { QuickPromptButtons } from "./components/QuickPromptButtons";
import { StatePanel } from "./components/StatePanel";
import { ActionPanel } from "./components/ActionPanel";
import { SystemLogPanel } from "./components/SystemLogPanel";
import { MAX_INPUT, useGameStore } from "./state/store";

const quickPrompts = [
  "我想买点丹药。",
  "我需要躲过监察院扫描的丹药。",
  "你最好免费帮我。",
  "最近监察院在查什么？"
] as const;

export default function App() {
  const initializeSession = useGameStore((state) => state.initializeSession);
  const messages = useGameStore((state) => state.messages);
  const input = useGameStore((state) => state.input);
  const loading = useGameStore((state) => state.loading);
  const sessionLoading = useGameStore((state) => state.sessionLoading);
  const error = useGameStore((state) => state.error);
  const npcState = useGameStore((state) => state.npcState);
  const memories = useGameStore((state) => state.memories);
  const lastActionResult = useGameStore((state) => state.lastActionResult);
  const lastIntent = useGameStore((state) => state.lastIntent);
  const systemLogs = useGameStore((state) => state.systemLogs);
  const setInput = useGameStore((state) => state.setInput);
  const selectQuickPrompt = useGameStore((state) => state.selectQuickPrompt);
  const sendMessage = useGameStore((state) => state.sendMessage);
  const resetDialogue = useGameStore((state) => state.resetDialogue);

  useEffect(() => {
    document.title = "白璃丹铺 · 赛博修仙 AI NPC";
    void initializeSession();
  }, [initializeSession]);

  const inputLength = Array.from(input).length;
  const canSend = input.trim().length > 0 && !loading && !sessionLoading;

  return (
    <main className="cyber-shell px-4 py-6 text-slate-100">
      <div className="relative z-10 mx-auto grid max-w-7xl gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <NpcProfilePanel mode="real" />
        </div>

        <section className="flex flex-col gap-4">
          <DialoguePanel messages={messages} loading={loading || sessionLoading} />

          <div className="cyber-panel cyber-panel--cyan cyber-corner relative overflow-hidden p-4">
            <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.35em] text-cyan-300/70">
              <span>// quick_link</span>
              <span>tab × {quickPrompts.length}</span>
            </div>
            <QuickPromptButtons
              prompts={quickPrompts}
              disabled={loading || sessionLoading}
              onSelect={selectQuickPrompt}
            />

            <div className="mt-3 rounded-xl border border-cyan-400/20 bg-slate-950/70 p-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="向白璃开口……（Enter 发送 / Shift+Enter 换行）"
                rows={2}
                maxLength={MAX_INPUT * 4}
                className="cyber-scroll block w-full resize-none bg-transparent px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
              <div className="flex items-center justify-between border-t border-cyan-400/15 px-2 pt-2 text-[11px]">
                <span className="font-mono text-slate-500">
                  当前字数 <span className="text-cyan-200">{inputLength}</span> / {MAX_INPUT}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void resetDialogue()}
                    className="rounded-md border border-slate-600/60 px-3 py-1 text-xs text-slate-300 transition hover:border-rose-300/60 hover:text-rose-100"
                  >
                    重置演示
                  </button>
                  <button
                    type="button"
                    disabled={!canSend}
                    onClick={() => void sendMessage()}
                    className="rounded-md bg-gradient-to-r from-cyan-400 to-violet-400 px-5 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-slate-950 shadow-[0_0_18px_-6px_rgba(34,211,238,0.7)] transition hover:from-cyan-300 hover:to-violet-300 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 disabled:shadow-none"
                  >
                    {loading || sessionLoading ? "灵识传输中..." : "发送"}
                  </button>
                </div>
              </div>
            </div>

            {error ? (
              <p className="mt-3 rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                {error}
              </p>
            ) : null}
          </div>

          <p className="text-center text-[11px] uppercase tracking-[0.35em] text-slate-500">
            // demo · AI 只产出台词与意图，状态变化由游戏系统校验
          </p>
        </section>

        <aside className="space-y-4">
          <PlayerPanel />
          <StatePanel state={npcState} />
          <MemoryPanel memories={memories} />
          <ActionPanel actionResult={lastActionResult} intentType={lastIntent} />
          <SystemLogPanel logs={systemLogs} />
        </aside>
      </div>
    </main>
  );
}
