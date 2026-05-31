import { describe, expect, it } from "vitest";
import { buildActionNarrationSystemPrompt, buildActionNarrationUserPrompt } from "../actionNarration.js";
import type { ActionWitness } from "../../actionResolver.js";
import type { PlayerState } from "../../../types/player.js";
import type { SceneSnapshot } from "../../../types/scene.js";

describe("actionNarration prompts", () => {
  const mockPlayer: PlayerState = {
    id: "player-1",
    sessionId: "session-1",
    name: "陆玄",
    realm: "炼气三层",
    spiritStones: 100,
    qiCurrent: 300,
    qiCap: 1000,
    cultivationStageIdx: 0,
    roots: { metal: 10, wood: 10, water: 10, fire: 40, earth: 30 },
    activeTechniqueId: "",
    breakthroughBonusUntil: null,
    alertShieldUntil: null,
    alertShieldStrength: 0,
    passiveIncomeClaimedAt: null,
    hasIllegalSeal: false,
    visibleTraits: [],
    recentActions: []
  };

  describe("buildActionNarrationSystemPrompt", () => {
    it("includes narrator role and worldview", () => {
      const prompt = buildActionNarrationSystemPrompt();

      expect(prompt).toContain("旁白叙述者");
      expect(prompt).toContain("九龙下城");
      expect(prompt).toContain("叙述原则");
    });

    it("includes action type guidelines", () => {
      const prompt = buildActionNarrationSystemPrompt();

      expect(prompt).toContain("潜行");
      expect(prompt).toContain("出手");
      expect(prompt).toContain("搜查");
      expect(prompt).toContain("撤离");
    });

    it("includes NPC reaction guidelines", () => {
      const prompt = buildActionNarrationSystemPrompt();

      expect(prompt).toContain("NPC反应");
      expect(prompt).toContain("愤怒");
      expect(prompt).toContain("恐惧");
    });

    it("specifies output format", () => {
      const prompt = buildActionNarrationSystemPrompt();

      expect(prompt).toContain("输出格式");
      expect(prompt).toContain("纯文本");
      expect(prompt).toContain("不要JSON");
    });
  });

  describe("buildActionNarrationUserPrompt", () => {
    it("includes scene information when scene is provided", () => {
      const scene: SceneSnapshot = {
        scene: {
          sceneId: "black_market",
          name: "黑市丹铺",
          description: "昏暗的地下空间",
          backgroundAsset: "",
          npcIds: ["baili"],
          unlockedByDefault: true
        },
        npcs: [
          {
            profile: {
              npc_id: "baili",
              name: "白璃",
              role: "黑市炼丹师",
              faction: "无相黑市",
              personality: ["谨慎"],
              speaking_style: "冷淡",
              goal: "研究丹药",
              secret: "师父被抓",
              knowledge_scope: [],
              cannot_know: [],
              initialState: { trust: 20, fear: 10, anger: 0, tianDaoAlert: 45 },
              sceneIds: ["black_market"],
              mockResponderTag: "baili"
            },
            state: { trust: 20, fear: 10, anger: 0, tianDaoAlert: 45 }
          }
        ]
      };

      const prompt = buildActionNarrationUserPrompt({
        playerInput: "偷偷摸一下 白璃 大腿",
        actionVerb: "潜行",
        targetNpcId: "baili",
        scene,
        witnesses: [],
        player: mockPlayer
      });

      expect(prompt).toContain("黑市丹铺");
      expect(prompt).toContain("白璃");
      expect(prompt).toContain("黑市炼丹师");
    });

    it("handles no scene scenario", () => {
      const prompt = buildActionNarrationUserPrompt({
        playerInput: "练习剑法",
        actionVerb: "动作",
        targetNpcId: null,
        scene: undefined,
        witnesses: [],
        player: mockPlayer
      });

      expect(prompt).toContain("无特定场景");
      expect(prompt).toContain("独自行动");
    });

    it("includes player information", () => {
      const prompt = buildActionNarrationUserPrompt({
        playerInput: "偷偷摸一下 白璃 大腿",
        actionVerb: "潜行",
        targetNpcId: null,
        scene: undefined,
        witnesses: [],
        player: mockPlayer
      });

      expect(prompt).toContain("陆玄");
      expect(prompt).toContain("炼气三层");
    });

    it("includes action details", () => {
      const prompt = buildActionNarrationUserPrompt({
        playerInput: "偷偷摸一下 白璃 大腿",
        actionVerb: "潜行",
        targetNpcId: "baili",
        scene: undefined,
        witnesses: [],
        player: mockPlayer
      });

      expect(prompt).toContain("类型：潜行");
      expect(prompt).toContain("偷偷摸一下 白璃 大腿");
      expect(prompt).toContain("目标：白璃");
    });

    it("shows no target when targetNpcId is null", () => {
      const prompt = buildActionNarrationUserPrompt({
        playerInput: "四处张望",
        actionVerb: "动作",
        targetNpcId: null,
        scene: undefined,
        witnesses: [],
        player: mockPlayer
      });

      expect(prompt).toContain("目标：无特定目标");
    });

    it("includes witness reactions with state changes", () => {
      const witnesses: ActionWitness[] = [
        {
          npcId: "baili",
          tianDaoAlertDelta: 0,
          angerDelta: 8,
          fearDelta: 2,
          memory: "玩家动手了",
          state: { trust: 20, fear: 12, anger: 8, tianDaoAlert: 45 }
        }
      ];

      const prompt = buildActionNarrationUserPrompt({
        playerInput: "一拳打向 白璃",
        actionVerb: "出手",
        targetNpcId: "baili",
        scene: undefined,
        witnesses,
        player: mockPlayer
      });

      expect(prompt).toContain("NPC反应");
      expect(prompt).toContain("白璃");
      expect(prompt).toContain("愤怒+8");
      expect(prompt).toContain("恐惧+2");
    });

    it("shows witness without state changes", () => {
      const witnesses: ActionWitness[] = [
        {
          npcId: "baili",
          tianDaoAlertDelta: 0,
          angerDelta: 0,
          fearDelta: 0,
          memory: "玩家潜行",
          state: { trust: 20, fear: 10, anger: 0, tianDaoAlert: 45 }
        }
      ];

      const prompt = buildActionNarrationUserPrompt({
        playerInput: "偷偷溜走",
        actionVerb: "潜行",
        targetNpcId: null,
        scene: undefined,
        witnesses,
        player: mockPlayer
      });

      expect(prompt).toContain("白璃: 目睹了这一幕");
    });
  });
});
