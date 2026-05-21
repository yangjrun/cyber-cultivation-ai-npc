import { beforeEach, describe, expect, it } from "vitest";
import { resetGameState } from "../services/gameState.js";
import { clearAllMemoriesForTests } from "../services/memoryStore.js";
import { clearRelationsForTests } from "../services/npcRelationsStore.js";
import { clearSessionsForTests, createSession, getPlayer } from "../services/playerStore.js";
import { buildPromptMessages, buildSystemPrompt, buildUserTurn, mergeMemoriesForPrompt } from "../services/promptBuilder.js";
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

  describe("buildPromptMessages", () => {
    it("keeps stable system content cacheable and moves evolved traits to dynamic context", () => {
      const session = createSession();
      const player = getPlayer(session.sessionId);

      if (!player) throw new Error("Player missing");

      const first = buildPromptMessages({
        scopedNpcId: scopedNpcId(session.sessionId, "baili"),
        npcId: "baili",
        playerInput: "我想买药",
        memories: ["玩家上次来过"],
        player,
        evolvedTraits: ["更容易信任玩家"]
      });
      const second = buildPromptMessages({
        scopedNpcId: scopedNpcId(session.sessionId, "baili"),
        npcId: "baili",
        playerInput: "我想打听苏鹤",
        memories: ["玩家提到监察院"],
        player,
        evolvedTraits: ["更警惕免费请求"]
      });
      const firstSystem = first[0].content;
      const secondSystem = second[0].content;

      if (typeof firstSystem === "string" || typeof secondSystem === "string") {
        throw new Error("Expected structured system blocks");
      }

      expect(firstSystem[0].text).toBe(secondSystem[0].text);
      expect(firstSystem[0].cacheControl).toEqual({ type: "ephemeral" });
      expect(firstSystem[0].text).not.toContain("更容易信任玩家");
      expect(first[1].content).toContain("更容易信任玩家");
      expect(second[1].content).toContain("更警惕免费请求");
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

  describe("mergeMemoriesForPrompt", () => {
    it("places retrieved memories before recent ones", () => {
      const merged = mergeMemoriesForPrompt(
        [{ content: "玩家想买屏蔽丹" }, { content: "玩家威胁过白璃" }],
        ["最近一次玩家来访"]
      );

      expect(merged).toEqual([
        "玩家想买屏蔽丹",
        "玩家威胁过白璃",
        "最近一次玩家来访"
      ]);
    });

    it("deduplicates across retrieved and recent", () => {
      const merged = mergeMemoriesForPrompt(
        [{ content: "玩家提到苏鹤" }],
        ["玩家提到苏鹤", "玩家走时回头"]
      );

      expect(merged).toEqual(["玩家提到苏鹤", "玩家走时回头"]);
    });

    it("caps merged list at 5 entries", () => {
      const merged = mergeMemoriesForPrompt(
        Array.from({ length: 10 }, (_, i) => ({ content: `r${i}` })),
        Array.from({ length: 5 }, (_, i) => `n${i}`)
      );

      expect(merged).toHaveLength(5);
      expect(merged.every((entry) => entry.startsWith("r"))).toBe(true);
    });

    it("truncates very long memory entries", () => {
      const long = "啊".repeat(100);
      const merged = mergeMemoriesForPrompt([{ content: long }], []);

      expect(merged[0].length).toBeLessThanOrEqual(61);
      expect(merged[0].endsWith("…")).toBe(true);
    });

    it("ignores blank entries", () => {
      const merged = mergeMemoriesForPrompt(
        [{ content: "" }, { content: "  " }, { content: "实际记忆" }],
        ["  ", "另一条记忆"]
      );

      expect(merged).toEqual(["实际记忆", "另一条记忆"]);
    });
  });
});
