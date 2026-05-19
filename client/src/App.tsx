import { useCallback, useEffect, useState } from "react";
import {
  resetChat,
  sendChat,
  type ChatResponse,
  type NpcState
} from "./api/chatApi";
import { ActionPanel } from "./components/ActionPanel";
import { DialoguePanel, type ChatMessage } from "./components/DialoguePanel";
import { MemoryPanel } from "./components/MemoryPanel";
import { NpcProfilePanel } from "./components/NpcProfilePanel";
import { QuickPromptButtons } from "./components/QuickPromptButtons";
import { StatePanel } from "./components/StatePanel";
import { SystemLogPanel, type SystemLog } from "./components/SystemLogPanel";

const quickPrompts = [
  "我想买点丹药。",
  "我需要躲过监察院扫描的丹药。",
  "你最好免费帮我。",
  "最近监察院在查什么？"
] as const;

const initialState: NpcState = {
  trust: 20,
  fear: 10,
  anger: 0,
  tianDaoAlert: 45
};

const NPC_NAME = "白璃";
const PLAYER_NAME = "陆玄";
const MAX_INPUT = 80;
const MAX_LOGS = 5;
const MAX_MEMORIES = 5;
const ERROR_MESSAGE = "链路中断：无法连接白璃丹铺。";

function nowTime(): string {
  const date = new Date();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function uid(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createSessionId(): string {
  return uid();
}

function clampInput(value: string): string {
  return Array.from(value).slice(0, MAX_INPUT).join("");
}

function createWelcomeMessage(): ChatMessage {
  return {
    id: "welcome",
    speaker: "npc",
    name: NPC_NAME,
    text: "新面孔？右臂这焊痕，不是正经门路上的人吧。",
    tone: "冷淡",
    intentType: "none",
    timestamp: nowTime()
  };
}

function createInitialLog(): SystemLog {
  return {
    id: "init",
    time: nowTime(),
    text: "已连接白璃丹铺。"
  };
}

export default function App() {
  const [sessionId] = useState(() => createSessionId());
  const [messages, setMessages] = useState<ChatMessage[]>(() => [createWelcomeMessage()]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [npcState, setNpcState] = useState<NpcState>(initialState);
  const [memories, setMemories] = useState<string[]>([]);
  const [lastActionResult, setLastActionResult] = useState("");
  const [lastIntent, setLastIntent] = useState("none");
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>(() => [createInitialLog()]);

  const appendLog = useCallback((text: string) => {
    setSystemLogs((current) => {
      const next = [...current, { id: uid(), time: nowTime(), text }];
      return next.slice(-MAX_LOGS);
    });
  }, []);

  const handleInputChange = (value: string) => {
    setInput(clampInput(value));
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(clampInput(prompt));
  };

  const handleSend = async () => {
    const trimmed = input.replace(/\n+/g, " ").trim();

    if (!trimmed || loading) {
      return;
    }

    const playerMessage: ChatMessage = {
      id: uid(),
      speaker: "player",
      name: PLAYER_NAME,
      text: trimmed,
      timestamp: nowTime()
    };

    setMessages((current) => [...current, playerMessage]);
    setInput("");
    setLoading(true);
    setError("");
    appendLog("玩家发送灵识讯息。");

    try {
      const response: ChatResponse = await sendChat(trimmed, "baili", sessionId);

      const npcMessage: ChatMessage = {
        id: uid(),
        speaker: "npc",
        name: NPC_NAME,
        text: response.dialogue,
        tone: response.tone || undefined,
        intentType: response.intent.type,
        timestamp: nowTime()
      };

      setMessages((current) => [...current, npcMessage]);

      if (response.state) {
        setNpcState(response.state);
      }

      setLastIntent(response.intent.type);
      setLastActionResult(response.actionResult);

      if (response.memoryAdded) {
        setMemories((current) => [...current, response.memoryAdded].slice(-MAX_MEMORIES));
      }

      appendLog(`收到 NPC 回复：tone=${response.tone || "未知"}。`);
      appendLog(`intent=${response.intent.type} 已校验。`);

      if (response.memoryAdded) {
        appendLog("记忆已写入。");
      }

      if (response.actionResult) {
        appendLog(`动作触发：${response.actionResult}`);
      }
    } catch {
      setError(ERROR_MESSAGE);
      appendLog("链路异常：未能收到白璃回复。");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setMessages([createWelcomeMessage()]);
    setInput("");
    setError("");
    setNpcState(initialState);
    setMemories([]);
    setLastActionResult("");
    setLastIntent("none");
    setSystemLogs([{ id: uid(), time: nowTime(), text: "演示状态已重置。" }]);

    try {
      await resetChat("baili", sessionId);
    } catch {
      appendLog("后端重置失败，仅清空本地状态。");
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  useEffect(() => {
    document.title = "白璃丹铺 · 赛博修仙 AI NPC";
  }, []);

  const inputLength = Array.from(input).length;
  const canSend = input.trim().length > 0 && !loading;

  return (
    <main className="cyber-shell px-4 py-6 text-slate-100">
      <div className="relative z-10 mx-auto grid max-w-7xl gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <NpcProfilePanel mode="real" />
        </div>

        <section className="flex flex-col gap-4">
          <DialoguePanel messages={messages} loading={loading} />

          <div className="cyber-panel cyber-panel--cyan cyber-corner relative overflow-hidden p-4">
            <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.35em] text-cyan-300/70">
              <span>// quick_link</span>
              <span>tab × {quickPrompts.length}</span>
            </div>
            <QuickPromptButtons
              prompts={quickPrompts}
              disabled={loading}
              onSelect={handleQuickPrompt}
            />

            <div className="mt-3 rounded-xl border border-cyan-400/20 bg-slate-950/70 p-2">
              <textarea
                value={input}
                onChange={(event) => handleInputChange(event.target.value)}
                onKeyDown={handleKeyDown}
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
                    onClick={() => void handleReset()}
                    className="rounded-md border border-slate-600/60 px-3 py-1 text-xs text-slate-300 transition hover:border-rose-300/60 hover:text-rose-100"
                  >
                    重置演示
                  </button>
                  <button
                    type="button"
                    disabled={!canSend}
                    onClick={() => void handleSend()}
                    className="rounded-md bg-gradient-to-r from-cyan-400 to-violet-400 px-5 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-slate-950 shadow-[0_0_18px_-6px_rgba(34,211,238,0.7)] transition hover:from-cyan-300 hover:to-violet-300 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 disabled:shadow-none"
                  >
                    {loading ? "灵识传输中..." : "发送"}
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
          <StatePanel state={npcState} />
          <MemoryPanel memories={memories} />
          <ActionPanel actionResult={lastActionResult} intentType={lastIntent} />
          <SystemLogPanel logs={systemLogs} />
        </aside>
      </div>
    </main>
  );
}
