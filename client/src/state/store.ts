import { create } from "zustand";
import { refineAlchemy, type MaterialSelection } from "../api/alchemyApi";
import { resetChat, sendChat, type NpcState } from "../api/chatApi";
import { breakthrough as requestBreakthrough, cultivate as requestCultivate } from "../api/cultivationApi";
import { useInventoryItem } from "../api/inventoryApi";
import { createSession, defaultPlayer, getSession, type InventoryItem, type PlayerState } from "../api/sessionApi";
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
  inventory: InventoryItem[];
  sessionLoading: boolean;
  messages: ChatMessage[];
  input: string;
  loading: boolean;
  cultivationLoading: boolean;
  breakthroughLoading: boolean;
  alchemyLoading: boolean;
  error: string;
  npcState: NpcState;
  memories: string[];
  lastActionResult: string;
  lastIntent: string;
  lastCultivationResult: string;
  lastBreakthroughResult: string;
  lastAlchemyResult: string;
  alchemyModalOpen: boolean;
  systemLogs: SystemLog[];
};

type GameActions = {
  initializeSession: () => Promise<void>;
  setInput: (value: string) => void;
  selectQuickPrompt: (value: string) => void;
  sendMessage: () => Promise<void>;
  resetDialogue: () => Promise<void>;
  cultivate: (duration: number) => Promise<void>;
  breakthrough: () => Promise<void>;
  refineAlchemy: (recipeId: string, materials: MaterialSelection[], fireLevel: number) => Promise<void>;
  useItem: (itemId: string) => Promise<void>;
  openAlchemyModal: () => void;
  closeAlchemyModal: () => void;
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
        inventory: session.inventory,
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

  cultivate: async (duration: number) => {
    const sessionId = await ensureSession(get);

    if (!sessionId) {
      return;
    }

    set({ cultivationLoading: true, error: "" });

    try {
      const response = await requestCultivate(sessionId, duration);
      set({ player: response.player, lastCultivationResult: response.message });
      get().appendLog(`打坐完成：+${response.qiGained} 灵气。`);
    } catch {
      set({ error: "修炼链路中断：打坐失败。" });
      get().appendLog("修炼失败：后端未响应。");
    } finally {
      set({ cultivationLoading: false });
    }
  },

  breakthrough: async () => {
    const sessionId = await ensureSession(get);

    if (!sessionId) {
      return;
    }

    set({ breakthroughLoading: true, error: "" });

    try {
      const response = await requestBreakthrough(sessionId);
      set({
        player: response.player,
        npcState: response.npcState ?? get().npcState,
        lastBreakthroughResult: response.message
      });
      get().appendLog(`突破结果：${response.message}`);
    } catch {
      set({ error: "突破链路中断：请稍后再试。" });
      get().appendLog("突破失败：后端未响应。");
    } finally {
      set({ breakthroughLoading: false });
    }
  },

  refineAlchemy: async (recipeId: string, materials: MaterialSelection[], fireLevel: number) => {
    const sessionId = await ensureSession(get);

    if (!sessionId) {
      return;
    }

    set({ alchemyLoading: true, error: "" });

    try {
      const response = await refineAlchemy(sessionId, recipeId, materials, fireLevel);
      set({ inventory: response.inventory, lastAlchemyResult: response.message, alchemyModalOpen: false });
      get().appendLog(`炼丹结果：${response.message}`);
    } catch {
      set({ error: "炼丹链路中断：材料或炉火出了问题。" });
      get().appendLog("炼丹失败：后端拒绝结算。");
    } finally {
      set({ alchemyLoading: false });
    }
  },

  useItem: async (itemId: string) => {
    const sessionId = await ensureSession(get);

    if (!sessionId) {
      return;
    }

    set({ alchemyLoading: true, error: "" });

    try {
      const response = await useInventoryItem(sessionId, itemId);
      set({
        player: response.player,
        npcState: response.npcState ?? get().npcState,
        inventory: response.inventory,
        lastAlchemyResult: response.message
      });
      get().appendLog(`服用物品：${response.message}`);
    } catch {
      set({ error: "物品使用失败。" });
      get().appendLog("背包结算失败：无法使用物品。");
    } finally {
      set({ alchemyLoading: false });
    }
  },

  openAlchemyModal: () => {
    set({ alchemyModalOpen: true });
  },

  closeAlchemyModal: () => {
    set({ alchemyModalOpen: false });
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
    inventory: [],
    sessionLoading: false,
    messages: [createWelcomeMessage()],
    input: "",
    loading: false,
    cultivationLoading: false,
    breakthroughLoading: false,
    alchemyLoading: false,
    error: "",
    npcState: initialNpcState,
    memories: [],
    lastActionResult: "",
    lastIntent: "none",
    lastCultivationResult: "",
    lastBreakthroughResult: "",
    lastAlchemyResult: "",
    alchemyModalOpen: false,
    systemLogs: [createInitialLog()]
  };
}

async function ensureSession(get: () => GameStore): Promise<string> {
  if (!get().sessionId) {
    await get().initializeSession();
  }

  return get().sessionId;
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
