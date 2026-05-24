import type { StateCreator } from "zustand";
import { resetChat, sendChat, type InputMode } from "../../api/chatApi";
import type { ChatMessage } from "../../components/DialoguePanel";
import { ERROR_MESSAGE, NARRATOR_NPC_ID, PLAYER_NAME, initialNpcState } from "../constants";
import type { GameActions, GameStore } from "../types";
import {
  appendMemory,
  appendMessage,
  appendMessages,
  buildNarratorLabel,
  buildSendLog,
  clampInput,
  getNpcName,
  nowTime,
  uid
} from "../utils";

type ChatActions = Pick<
  GameActions,
  "setInput" | "setInputMode" | "selectQuickPrompt" | "sendMessage" | "resetDialogue"
>;

export const createChatSlice: StateCreator<GameStore, [], [], ChatActions> = (set, get) => ({
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
        name:
          reply.npcId === NARRATOR_NPC_ID
            ? buildNarratorLabel(reply.kind)
            : getNpcName(reply.npcId),
        text: reply.dialogue,
        actions: reply.actions && reply.actions.length > 0 ? reply.actions : undefined,
        intentType: reply.intent.type,
        kind: reply.kind,
        speakMode: reply.speakMode,
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
              get().appendLog(
                `${getNpcName(npcId)} 状态变动：警戒${npcState.tianDaoAlert}・怒${npcState.anger}。`
              );
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
  }
});
