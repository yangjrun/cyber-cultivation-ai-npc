import { beforeEach, describe, expect, it } from "vitest";
import { resetGameState } from "../services/gameState.js";
import { clearAllMemoriesForTests } from "../services/memoryStore.js";
import { clearRelationsForTests } from "../services/npcRelationsStore.js";
import { clearSessionsForTests, createSession, getPlayer } from "../services/playerStore.js";
import { buildSystemPrompt, buildUserTurn } from "../services/promptBuilder.js";
import { clearQuestProgressForTests } from "../services/questStore.js";
import { getSceneSnapshot } from "../services/sceneStore.js";
import { scopedNpcId } from "../services/scopedNpcId.js";
import { clearInventoryForTests } from "../services/inventoryStore.js";

describe("promptBuilder", () => {
  beforeEach(() => {
    clearQuestProgressForTests();
    clearRelationsForTests();
    clearAllMemoriesForTests();
    clearInventoryForTests();
    clearSessionsForTests();
    resetGameState();
  });

  describe("buildSystemPrompt", () => {
    it("is byte-identical across many calls for the same npc (caching prereq)", () => {
      const reference = buildSystemPrompt({ npcId: "baili" });

      for (let i = 0; i < 50; i += 1) {
        expect(buildSystemPrompt({ npcId: "baili" })).toBe(reference);
      }
    });

    it("differs per npcId", () => {
      const baili = buildSystemPrompt({ npcId: "baili" });
      const suhe = buildSystemPrompt({ npcId: "suhe" });
      const chimu = buildSystemPrompt({ npcId: "chimu" });
      const qinggu = buildSystemPrompt({ npcId: "qinggu" });

      const unique = new Set([baili, suhe, chimu, qinggu]);
      expect(unique.size).toBe(4);
    });

    it("includes NPC name and role-card chars", () => {
      expect(buildSystemPrompt({ npcId: "baili" })).toContain("白璃");
      expect(buildSystemPrompt({ npcId: "suhe" })).toContain("苏鹤");
      expect(buildSystemPrompt({ npcId: "chimu" })).toContain("赤目");
      expect(buildSystemPrompt({ npcId: "qinggu" })).toContain("青姑");
    });

    it("lists quest_id whitelist for NPCs that give quests", () => {
      expect(buildSystemPrompt({ npcId: "baili" })).toContain("steal_inspector_key");
      expect(buildSystemPrompt({ npcId: "chimu" })).toContain("pay_thunder_toll");
      expect(buildSystemPrompt({ npcId: "qinggu" })).toContain("verify_suhe_identity");
    });

    it("marks NPCs that do not give quests as 不派任务", () => {
      expect(buildSystemPrompt({ npcId: "suhe" })).toContain("不派任务");
    });
  });

  describe("buildUserTurn", () => {
    it("includes dynamic NPC state, memories, and player narrative", () => {
      const session = createSession();
      const player = getPlayer(session.sessionId);

      if (!player) throw new Error("Player missing");

      const scoped = scopedNpcId(session.sessionId, "baili");
      const userTurn = buildUserTurn({
        scopedNpcId: scoped,
        npcId: "baili",
        playerInput: "我想买药",
        memories: ["上次玩家来过"],
        player
      });

      expect(userTurn).toContain("# 当前情境");
      expect(userTurn).toContain("trust=20");
      expect(userTurn).toContain("上次玩家来过");
      expect(userTurn).toContain("我想买药");
      expect(userTurn).toContain("陆玄");
    });

    it("renders scene context when scene snapshot is provided", () => {
      const session = createSession();
      const player = getPlayer(session.sessionId);
      const scene = getSceneSnapshot(session.sessionId, "thunder_tavern");

      if (!player) throw new Error("Player missing");
      if (!scene) throw new Error("Scene missing");

      const userTurn = buildUserTurn({
        scopedNpcId: scopedNpcId(session.sessionId, "chimu"),
        npcId: "chimu",
        playerInput: "让我过",
        memories: [],
        player,
        scene
      });

      expect(userTurn).toContain("场景：雷罚酒馆");
      expect(userTurn).toContain("青姑");
    });

    it("includes active quests when supplied", () => {
      const session = createSession();
      const player = getPlayer(session.sessionId);

      if (!player) throw new Error("Player missing");

      const userTurn = buildUserTurn({
        scopedNpcId: scopedNpcId(session.sessionId, "baili"),
        npcId: "baili",
        playerInput: "完事了",
        memories: [],
        player,
        activeQuests: [
          {
            sessionId: session.sessionId,
            questId: "steal_inspector_key",
            status: "in_progress",
            progress: {},
            acceptedAt: new Date().toISOString(),
            completedAt: null,
            updatedAt: new Date().toISOString()
          }
        ]
      });

      expect(userTurn).toContain("steal_inspector_key");
      expect(userTurn).toContain("in_progress");
    });

    it("varies output with NPC state changes", () => {
      const session = createSession();
      const player = getPlayer(session.sessionId);

      if (!player) throw new Error("Player missing");

      const baseline = buildUserTurn({
        scopedNpcId: scopedNpcId(session.sessionId, "baili"),
        npcId: "baili",
        playerInput: "嗨",
        memories: [],
        player
      });

      const withCustomState = buildUserTurn({
        scopedNpcId: scopedNpcId(session.sessionId, "baili"),
        npcId: "baili",
        playerInput: "嗨",
        memories: [],
        player,
        npcState: { trust: 99, fear: 1, anger: 2, tianDaoAlert: 3 }
      });

      expect(baseline).not.toBe(withCustomState);
      expect(withCustomState).toContain("trust=99");
    });
  });
});
