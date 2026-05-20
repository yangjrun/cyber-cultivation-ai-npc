import { create } from "zustand";
import { resetChat, sendChat, type NpcState } from "../api/chatApi";
import { createSession, defaultPlayer, getSession, type PlayerState } from "../api/sessionApi";
import type { ChatMessage } from "../components/DialoguePanel";
import type { SystemLog } from "../components/SystemLogPanel";

const STORAGE_KEY = "cyber-cultivation.sessionId";
const NPC_ID = "baili";
const NPC_NAME = "白璃";
const PLAYER_NAME = "陆玄";
const MAX_LOGS = 5;
const MAX_MEMORIES = 5;
const ERROR_MESSAGE = "链路中断：无法连接白璃丹铺。";

export const MAX_INPUT = 80;

export const initialNpcState: NpcState = {
  trust: 20,
  fear: 10,
  anger: 0,
  tianDaoAlert: 45
};

type GameState = {
  sessionId: string;
  playerId: string;
  player: PlayerState;
  sessionLoading: boolean;
  messages: ChatMessage[];
  input: string;
  loading: boolean;
  error: string;
  npcState: NpcState;
  memories: string[];
  lastActionResult: string;
  lastIntent: string;
  systemLogs: SystemLog[];
};

type GameActions = {
  initializeSession: () => Promise<void>;
  setInput: (value: string) => void;
  selectQuickPrompt: (value: string) => void;
  sendMessage: () => Promise<void>;
  resetDialogue: () => Promise<void>;
  appendLog: (text: string) => void;
};

export type GameStore = GameState & GameActions;

export const useGameStore = create<GameStore>((set, get) => ({
  ...createInitialState(),

  initializeSession: async () => {
    if (get().sessionLoading || get().sessionId) {
      return;
    }

    set({ sessionLoading: true, error: "" });

    try {
      const storedSessionId = readStoredSessionId();
      const session = storedSessionId ? await restoreOrCreateSession(storedSessionId) : await createSession();
      writeStoredSessionId(session.sessionId);
      set({
        sessionId: session.sessionId,
        playerId: session.playerId,
        player: session.player,
        npcState: session.npcState ?? initialNpcState,
        memories: session.memories.slice(-MAX_MEMORIES),
        sessionLoading: false
      });
      get().appendLog("玩家存档已载入。");
    } catch {
      set({
        sessionLoading: false,
        error: "存档链路中断：无法创建玩家会话。"
      });
      get().appendLog("存档链路异常：会话创建失败。");
    }
  },

  setInput: (value: string) => {
    set({ input: clampInput(value) });
  },

  selectQuickPrompt: (value: string) => {
    set({ input: clampInput(value) });
  },

  sendMessage: async () => {
    const trimmed = get().input.replace(/\n+/g, " ").trim();

    if (!trimmed || get().loading) {
      return;
    }

    if (!get().sessionId) {
      await get().initializeSession();
    }

    const activeSessionId = get().sessionId;

    if (!activeSessionId) {
      return;
    }

    const playerMessage: ChatMessage = {
      id: uid(),
      speaker: "player",
      name: PLAYER_NAME,
      text: trimmed,
      timestamp: nowTime()
    };

    set((state) => ({
      messages: [...state.messages, playerMessage],
      input: "",
      loading: true,
      error: ""
    }));
    get().appendLog("玩家发送灵识讯息。");

    try {
      const response = await sendChat(trimmed, NPC_ID, activeSessionId);
      const npcMessage: ChatMessage = {
        id: uid(),
        speaker: "npc",
        name: NPC_NAME,
        text: response.dialogue,
        tone: response.tone || undefined,
        intentType: response.intent.type,
        timestamp: nowTime()
      };

      set((state) => ({
        messages: [...state.messages, npcMessage],
        npcState: response.state ?? state.npcState,
        player: response.player,
        lastIntent: response.intent.type,
        lastActionResult: response.actionResult,
        memories: response.memoryAdded ? [...state.memories, response.memoryAdded].slice(-MAX_MEMORIES) : state.memories
      }));

      get().appendLog(`收到 NPC 回复：tone=${response.tone || "未知"}。`);
      get().appendLog(`intent=${response.intent.type} 已校验。`);

      if (response.memoryAdded) {
        get().appendLog("记忆已写入。");
      }

      if (response.actionResult) {
        get().appendLog(`动作触发：${response.actionResult}`);
      }
    } catch {
      set({ error: ERROR_MESSAGE });
      get().appendLog("链路异常：未能收到白璃回复。");
    } finally {
      set({ loading: false });
    }
  },

  resetDialogue: async () => {
    set({
      messages: [createWelcomeMessage()],
      input: "",
      error: "",
      npcState: initialNpcState,
      memories: [],
      lastActionResult: "",
      lastIntent: "none",
      systemLogs: [{ id: uid(), time: nowTime(), text: "演示状态已重置。" }]
    });

    try {
      await resetChat(NPC_ID, get().sessionId || undefined);
    } catch {
      get().appendLog("后端重置失败，仅清空本地状态。");
    }
  },

  appendLog: (text: string) => {
    set((state) => {
      const next = [...state.systemLogs, { id: uid(), time: nowTime(), text }];
      return { systemLogs: next.slice(-MAX_LOGS) };
    });
  }
}));

export function resetGameStoreForTests(): void {
  useGameStore.setState(createInitialState());
}

function createInitialState(): GameState {
  return {
    sessionId: "",
    playerId: "",
    player: defaultPlayer,
    sessionLoading: false,
    messages: [createWelcomeMessage()],
    input: "",
    loading: false,
    error: "",
    npcState: initialNpcState,
    memories: [],
    lastActionResult: "",
    lastIntent: "none",
    systemLogs: [createInitialLog()]
  };
}

async function restoreOrCreateSession(sessionId: string) {
  try {
    return await getSession(sessionId);
  } catch {
    return await createSession();
  }
}

function readStoredSessionId(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeStoredSessionId(sessionId: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, sessionId);
  } catch {
    // localStorage can be unavailable in hardened browser contexts.
  }
}

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
