import { create } from "zustand";
import { refineAlchemy, type MaterialSelection } from "../api/alchemyApi";
import { resetChat, sendChat, type InputMode, type NpcState } from "../api/chatApi";
import { breakthrough as requestBreakthrough, cultivate as requestCultivate } from "../api/cultivationApi";
import { useInventoryItem } from "../api/inventoryApi";
import { listQuests, type QuestProgress } from "../api/questApi";
import { listScenes, switchScene as requestSwitchScene, type SceneDefinition } from "../api/sceneApi";
import { createSession, defaultPlayer, getSession, type InventoryItem, type NpcStateSnapshot, type PlayerState } from "../api/sessionApi";
import type { ChatMessage } from "../components/DialoguePanel";
import type { SystemLog } from "../components/SystemLogPanel";

const STORAGE_KEY = "cyber-cultivation.sessionId";
const DEFAULT_NPC_ID = "baili";
const DEFAULT_SCENE_ID = "black_market";
const PLAYER_NAME = "陆玄";
const NARRATOR_NPC_ID = "narrator";
const MAX_LOGS = 5;
const MAX_MEMORIES = 5;
const ERROR_MESSAGE = "链路中断：无法连接 NPC。";

export const MAX_INPUT = 80;

export const NPC_NAMES: Record<string, string> = {
  baili: "白璃",
  suhe: "苏鹤",
  chimu: "赤目",
  qinggu: "青姑"
};

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
  activeSceneId: string;
  activeNpcId: string;
  inputMode: InputMode;
  scenes: SceneDefinition[];
  scenesLoading: boolean;
  npcStates: Record<string, NpcStateSnapshot>;
  quests: QuestProgress[];
  questsLoading: boolean;
  messagesByNpc: Record<string, ChatMessage[]>;
  memoriesByNpc: Record<string, string[]>;
  input: string;
  loading: boolean;
  cultivationLoading: boolean;
  breakthroughLoading: boolean;
  alchemyLoading: boolean;
  error: string;
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
  setInputMode: (mode: InputMode) => void;
  selectQuickPrompt: (value: string) => void;
  sendMessage: () => Promise<void>;
  resetDialogue: () => Promise<void>;
  switchScene: (sceneId: string) => Promise<void>;
  selectNpc: (npcId: string) => void;
  refreshQuests: () => Promise<void>;
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
      const [storedSessionId, scenes] = await Promise.all([
        Promise.resolve(readStoredSessionId()),
        listScenes().catch(() => [])
      ]);
      const session = storedSessionId ? await restoreOrCreateSession(storedSessionId) : await createSession();
      writeStoredSessionId(session.sessionId);

      const activeSceneId = session.activeSceneId || DEFAULT_SCENE_ID;
      const sceneNpcIds = scenes.find((s) => s.sceneId === activeSceneId)?.npcIds ?? [];
      const activeNpcId = sceneNpcIds[0] ?? DEFAULT_NPC_ID;
      const memoriesForActive = session.memories.slice(-MAX_MEMORIES);

      set({
        sessionId: session.sessionId,
        playerId: session.playerId,
        player: session.player,
        inventory: session.inventory,
        scenes,
        activeSceneId,
        activeNpcId,
        npcStates: session.npcStates,
        quests: session.quests,
        memoriesByNpc: memoriesForActive.length > 0 ? { [activeNpcId]: memoriesForActive } : {},
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

  setInputMode: (mode: InputMode) => {
    if (mode !== get().inputMode) {
      set({ inputMode: mode });
    }
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
    const activeNpcId = get().activeNpcId;
    const activeMode = get().inputMode;

    if (!activeSessionId || !activeNpcId) {
      return;
    }

    const playerMessage: ChatMessage = {
      id: uid(),
      speaker: "player",
      name: PLAYER_NAME,
      text: trimmed,
      kind: activeMode,
      timestamp: nowTime()
    };

    set((state) => ({
      messagesByNpc: appendMessage(state.messagesByNpc, activeNpcId, playerMessage),
      input: "",
      loading: true,
      error: ""
    }));
    get().appendLog(buildSendLog(activeMode));

    try {
      const response = await sendChat(trimmed, activeNpcId, activeSessionId, activeMode);
      const npcMessages: ChatMessage[] = response.replies.map((reply) => ({
        id: uid(),
        speaker: reply.npcId === NARRATOR_NPC_ID ? "narrator" : "npc",
        npcId: reply.npcId,
        name: reply.npcId === NARRATOR_NPC_ID ? buildNarratorLabel(reply.kind) : getNpcName(reply.npcId),
        text: reply.dialogue,
        actions: reply.actions && reply.actions.length > 0 ? reply.actions : undefined,
        intentType: reply.intent.type,
        kind: reply.kind,
        timestamp: nowTime()
      }));

      set((state) => {
        const nextNpcStates = response.replies.reduce((acc, reply) => {
          if (reply.npcId === NARRATOR_NPC_ID) {
            if (reply.affectedStates) {
              return { ...acc, ...reply.affectedStates };
            }
            return acc;
          }
          if (!reply.state) {
            return acc;
          }
          return { ...acc, [reply.npcId]: reply.state };
        }, state.npcStates);
        const nextMemories = response.replies.reduce((acc, reply) => {
          if (reply.npcId === NARRATOR_NPC_ID || !reply.memoryAdded) {
            return acc;
          }
          return appendMemory(acc, reply.npcId, reply.memoryAdded);
        }, state.memoriesByNpc);

        return {
          messagesByNpc: appendMessages(state.messagesByNpc, activeNpcId, npcMessages),
          npcStates: nextNpcStates,
          player: response.player,
          lastIntent: response.intent.type,
          lastActionResult: response.actionResult,
          memoriesByNpc: nextMemories
        };
      });

      for (const reply of response.replies) {
        if (reply.npcId === NARRATOR_NPC_ID) {
          get().appendLog(`旁白：${reply.tone || "无声"}。`);
          if (reply.affectedStates) {
            for (const [npcId, npcState] of Object.entries(reply.affectedStates)) {
              get().appendLog(`${getNpcName(npcId)} 状态变动：警戒${npcState.tianDaoAlert}・怒${npcState.anger}。`);
            }
          }
        } else {
          get().appendLog(`收到 ${getNpcName(reply.npcId)} 回复：tone=${reply.tone || "未知"}。`);
        }
      }
      get().appendLog(`intent=${response.intent.type} 已校验。`);

      if (response.replies.some((reply) => reply.npcId !== NARRATOR_NPC_ID && reply.memoryAdded)) {
        get().appendLog("记忆已写入。");
      }

      if (response.actionResult) {
        get().appendLog(`动作触发：${response.actionResult}`);
        void get().refreshQuests();
      }
    } catch {
      set({ error: ERROR_MESSAGE });
      get().appendLog("链路异常：未能收到 NPC 回复。");
    } finally {
      set({ loading: false });
    }
  },

  resetDialogue: async () => {
    const activeNpcId = get().activeNpcId;

    set((state) => ({
      messagesByNpc: { ...state.messagesByNpc, [activeNpcId]: [] },
      memoriesByNpc: { ...state.memoriesByNpc, [activeNpcId]: [] },
      input: "",
      error: "",
      npcStates: { ...state.npcStates, [activeNpcId]: initialNpcState },
      lastActionResult: "",
      lastIntent: "none",
      systemLogs: [{ id: uid(), time: nowTime(), text: `${getNpcName(activeNpcId)} 状态已重置。` }]
    }));

    try {
      await resetChat(activeNpcId, get().sessionId || undefined);
    } catch {
      get().appendLog("后端重置失败，仅清空本地状态。");
    }
  },

  switchScene: async (sceneId: string) => {
    const sessionId = get().sessionId;

    if (!sessionId || get().activeSceneId === sceneId) {
      return;
    }

    const scene = get().scenes.find((s) => s.sceneId === sceneId);

    if (!scene) {
      return;
    }

    try {
      await requestSwitchScene(sessionId, sceneId);
    } catch {
      get().appendLog("场景切换失败。");
      return;
    }

    const fallbackNpcId = scene.npcIds[0] ?? get().activeNpcId;
    const nextNpcId = scene.npcIds.includes(get().activeNpcId) ? get().activeNpcId : fallbackNpcId;

    set({ activeSceneId: sceneId, activeNpcId: nextNpcId });
    get().appendLog(`场景切换至：${scene.name}`);
  },

  selectNpc: (npcId: string) => {
    if (npcId !== get().activeNpcId) {
      set({ activeNpcId: npcId, input: "" });
      get().appendLog(`目标切换至：${getNpcName(npcId)}`);
    }
  },

  refreshQuests: async () => {
    const sessionId = get().sessionId;

    if (!sessionId || get().questsLoading) {
      return;
    }

    set({ questsLoading: true });

    try {
      const quests = await listQuests(sessionId);
      set({ quests, questsLoading: false });
    } catch {
      set({ questsLoading: false });
      get().appendLog("任务列表刷新失败。");
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
      const activeNpcId = get().activeNpcId;

      set((state) => ({
        player: response.player,
        npcStates: response.npcState
          ? { ...state.npcStates, [activeNpcId]: response.npcState }
          : state.npcStates,
        lastBreakthroughResult: response.message
      }));
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
      const activeNpcId = get().activeNpcId;

      set((state) => ({
        player: response.player,
        npcStates: response.npcState
          ? { ...state.npcStates, [activeNpcId]: response.npcState }
          : state.npcStates,
        inventory: response.inventory,
        lastAlchemyResult: response.message
      }));
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

export function getNpcName(npcId: string): string {
  return NPC_NAMES[npcId] ?? npcId;
}

const EMPTY_MESSAGES: ChatMessage[] = [];
const EMPTY_MEMORIES: string[] = [];

export function getActiveMessages(state: GameStore): ChatMessage[] {
  return state.messagesByNpc[state.activeNpcId] ?? EMPTY_MESSAGES;
}

export function getActiveMemories(state: GameStore): string[] {
  return state.memoriesByNpc[state.activeNpcId] ?? EMPTY_MEMORIES;
}

export function getActiveNpcState(state: GameStore): NpcState {
  return state.npcStates[state.activeNpcId] ?? initialNpcState;
}

function createInitialState(): GameState {
  return {
    sessionId: "",
    playerId: "",
    player: defaultPlayer,
    inventory: [],
    sessionLoading: false,
    activeSceneId: DEFAULT_SCENE_ID,
    activeNpcId: DEFAULT_NPC_ID,
    inputMode: "dialogue",
    scenes: [],
    scenesLoading: false,
    npcStates: {},
    quests: [],
    questsLoading: false,
    messagesByNpc: {},
    memoriesByNpc: {},
    input: "",
    loading: false,
    cultivationLoading: false,
    breakthroughLoading: false,
    alchemyLoading: false,
    error: "",
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

function appendMessage(map: Record<string, ChatMessage[]>, npcId: string, message: ChatMessage): Record<string, ChatMessage[]> {
  return appendMessages(map, npcId, [message]);
}

function appendMessages(map: Record<string, ChatMessage[]>, npcId: string, messages: ChatMessage[]): Record<string, ChatMessage[]> {
  const current = map[npcId] ?? [];
  return { ...map, [npcId]: [...current, ...messages] };
}

function appendMemory(map: Record<string, string[]>, npcId: string, memory: string): Record<string, string[]> {
  const current = map[npcId] ?? [];
  return { ...map, [npcId]: [...current, memory].slice(-MAX_MEMORIES) };
}

function buildSendLog(mode: InputMode): string {
  if (mode === "action") {
    return "玩家执行动作。";
  }
  if (mode === "monologue") {
    return "玩家心声闪过。";
  }
  return "玩家发送灵识讯息。";
}

function buildNarratorLabel(mode: InputMode): string {
  if (mode === "action") {
    return "旁白";
  }
  if (mode === "monologue") {
    return "心声";
  }
  return "旁白";
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

function createInitialLog(): SystemLog {
  return {
    id: "init",
    time: nowTime(),
    text: "已连接对话核心。"
  };
}
