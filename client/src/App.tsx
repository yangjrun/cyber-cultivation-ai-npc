import { useState } from "react";
import { resetChat, sendChat, type NpcIntent, type NpcState } from "./api/chatApi";
import { ActionPanel } from "./components/ActionPanel";
import { DialoguePanel, type DialogueEntry } from "./components/DialoguePanel";
import { MemoryPanel } from "./components/MemoryPanel";
import { StatePanel } from "./components/StatePanel";

const quickPrompts = [
  "我想买点丹药。",
  "我需要躲过监察院扫描的丹药。",
  "你最好免费帮我。",
  "最近监察院在查什么？"
];

const initialState: NpcState = {
  trust: 20,
  fear: 10,
  anger: 0,
  tianDaoAlert: 45
};

const initialIntent: NpcIntent = {
  type: "none",
  params: {}
};

function createSessionId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function App() {
  const [sessionId] = useState(() => createSessionId());
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<DialogueEntry[]>([]);
  const [state, setState] = useState<NpcState>(initialState);
  const [memories, setMemories] = useState<string[]>([]);
  const [actionResult, setActionResult] = useState("");
  const [intent, setIntent] = useState<NpcIntent>(initialIntent);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleInputChange = (value: string) => {
    setInput(Array.from(value).slice(0, 80).join(""));
  };

  const handleSend = async () => {
    const playerInput = input.trim();

    if (!playerInput || loading) {
      return;
    }

    const timestamp = Date.now();
    setHistory((current) => [...current, { id: timestamp, speaker: "player", text: playerInput }]);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const response = await sendChat(playerInput, "baili", sessionId);
      setHistory((current) => [
        ...current,
        { id: timestamp + 1, speaker: "npc", text: response.dialogue, tone: response.tone }
      ]);
      setState(response.state);
      setIntent(response.intent);
      setActionResult(response.actionResult);
      setMemories((current) => response.memoryAdded ? [...current, response.memoryAdded].slice(-5) : current);
    } catch {
      setError("通讯被黑市噪声干扰，请稍后再试。");
    } finally {
      setLoading(false);
    }
  };

  const resetDemo = async () => {
    setInput("");
    setHistory([]);
    setState(initialState);
    setMemories([]);
    setActionResult("");
    setIntent(initialIntent);
    setError("");

    try {
      await resetChat("baili", sessionId);
    } catch {
      setError("本地已清空，后端状态重置失败。");
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.2),_transparent_35%),linear-gradient(135deg,_#020617,_#111827_45%,_#1e1b4b)] px-4 py-6 text-slate-100">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="rounded-2xl border border-cyan-400/25 bg-slate-950/75 p-5 shadow-neon">
          <div className="mb-5 text-xs uppercase tracking-[0.4em] text-cyan-300">九龙下城</div>
          <h1 className="mb-2 text-3xl font-bold text-white">白璃</h1>
          <p className="mb-1 text-cyan-100">黑市炼丹师</p>
          <p className="mb-5 text-sm text-slate-400">九龙下城 / 无相黑市 / 白璃丹铺</p>
          <p className="text-sm leading-7 text-slate-300">
            她在霓虹漏雨的丹铺里调试禁药，冷淡、毒舌，只相信等价交换。
          </p>
          <div className="mt-6 rounded-xl border border-pink-400/20 bg-pink-400/10 p-3 text-xs leading-6 text-pink-100">
            玩家：陆玄，练气期，非法灵根持有者，右臂义体上残留雷罚灼痕。
          </div>
        </aside>

        <section className="space-y-4">
          <DialoguePanel history={history} />

          <div className="rounded-2xl border border-cyan-400/25 bg-slate-950/80 p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleInputChange(prompt)}
                  className="rounded-full border border-violet-300/30 px-3 py-1 text-xs text-violet-100 transition hover:border-violet-200 hover:bg-violet-400/20"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <input
                maxLength={80}
                value={input}
                onChange={(event) => handleInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleSend();
                  }
                }}
                placeholder="向白璃开口……"
                className="min-w-0 flex-1 rounded-xl border border-cyan-400/30 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-200"
              />
              <button
                type="button"
                disabled={loading || !input.trim()}
                onClick={() => void handleSend()}
                className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
              >
                {loading ? "发送中..." : "发送"}
              </button>
              <button
                type="button"
                onClick={() => void resetDemo()}
                className="rounded-xl border border-slate-500 px-4 py-3 text-sm text-slate-200 transition hover:border-pink-300 hover:text-pink-100"
              >
                清空/重置
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{Array.from(input).length}/80</span>
              {error ? <span className="text-pink-200">{error}</span> : null}
            </div>
          </div>

          <p className="text-center text-xs text-slate-500">
            Demo：AI 只控制台词和意图，真实状态由游戏系统校验。
          </p>
        </section>

        <aside className="space-y-4">
          <StatePanel state={state} />
          <MemoryPanel memories={memories} />
          <ActionPanel actionResult={actionResult} intentType={intent.type} />
        </aside>
      </div>
    </main>
  );
}
