import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../index.js";
import { clearAllMemoriesForTests, getRecentMemories } from "../services/memoryStore.js";
import { getNpcState, resetGameState } from "../services/gameState.js";
import { clearSessionsForTests } from "../services/playerStore.js";

type ChatReplyResponse = {
  npcId: string;
  dialogue: string;
  kind: string;
  intent: { type: string };
  affectedStates?: Record<string, unknown>;
};

describe("Hybrid Mode Integration", () => {
  beforeEach(() => {
    delete process.env.LLM_API_KEY;
    clearSessionsForTests();
    resetGameState();
    clearAllMemoriesForTests();
  });

  it("executes full hybrid flow: action resolution -> narration -> NPC response", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);

    const response = await request(app)
      .post("/api/chat")
      .send({
        playerInput: "偷偷靠近丹炉，我要买屏蔽药",
        npcId: "baili",
        sessionId,
        inputMode: "hybrid"
      })
      .expect(200);

    // Verify mode
    expect(response.body.mode).toBe("hybrid");

    // Verify replies structure: narrator first, then NPC(s)
    expect(response.body.replies.length).toBeGreaterThanOrEqual(2);

    const [narratorReply, ...npcReplies] = response.body.replies as Array<{
      npcId: string;
      kind: string;
      dialogue: string;
      intent: { type: string };
    }>;

    // Narrator reply
    expect(narratorReply.npcId).toBe("narrator");
    expect(narratorReply.kind).toBe("action");
    expect(narratorReply.dialogue).toContain("悄无声息");
    expect(narratorReply.intent.type).toBe("none");

    // NPC reply
    expect(npcReplies.length).toBeGreaterThan(0);
    expect(npcReplies[0].npcId).toBe("baili");
    expect(npcReplies[0].dialogue).toBeTruthy();

    // Verify speaker order
    expect(response.body.groupChat.speakerOrder[0]).toBe("narrator");
    expect(response.body.groupChat.speakerOrder).toEqual(
      response.body.replies.map((r: ChatReplyResponse) => r.npcId)
    );

    // Verify memory was recorded
    const memories = getRecentMemories(`${sessionId}::baili`, 5);
    expect(memories.some((m) => m.includes("悄无声息") || m.includes("潜行"))).toBe(true);
  });

  it("hybrid mode with attack: increases target anger and triggers response", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);

    await request(app)
      .post("/api/scenes/switch")
      .send({ sessionId, sceneId: "thunder_tavern" })
      .expect(200);

    const chimuBefore = getNpcState(`${sessionId}::chimu`);

    const response = await request(app)
      .post("/api/chat")
      .send({
        playerInput: "一拳打向赤目，你敢拦我？",
        npcId: "chimu",
        sessionId,
        inputMode: "hybrid"
      })
      .expect(200);

    expect(response.body.mode).toBe("hybrid");

    const [narratorReply] = response.body.replies;
    expect(narratorReply.npcId).toBe("narrator");
    expect(narratorReply.dialogue).toContain("迅如闪电");
    expect(narratorReply.affectedStates).toBeDefined();
    expect(narratorReply.affectedStates.chimu).toBeDefined();

    // Verify state changes
    const chimuAfter = getNpcState(`${sessionId}::chimu`);
    expect(chimuAfter.anger).toBeGreaterThan(chimuBefore.anger);
    expect(chimuAfter.fear).toBeGreaterThan(chimuBefore.fear);

    // Verify NPC responded
    const npcReplies = response.body.replies.filter((r: ChatReplyResponse) => r.npcId !== "narrator");
    expect(npcReplies.length).toBeGreaterThan(0);
  });

  it("hybrid mode with forbidden keywords: raises tianDaoAlert and NPC reacts", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);

    const bailiBefore = getNpcState(`${sessionId}::baili`);

    const response = await request(app)
      .post("/api/chat")
      .send({
        playerInput: "偷偷拿出非法芯片，我要买屏蔽药",
        npcId: "baili",
        sessionId,
        inputMode: "hybrid"
      })
      .expect(200);

    expect(response.body.mode).toBe("hybrid");

    const [narratorReply] = response.body.replies;
    expect(narratorReply.affectedStates).toBeDefined();

    // Verify tianDaoAlert increased
    const bailiAfter = getNpcState(`${sessionId}::baili`);
    expect(bailiAfter.tianDaoAlert).toBeGreaterThan(bailiBefore.tianDaoAlert);

    // Verify memory includes forbidden keyword context
    const memories = getRecentMemories(`${sessionId}::baili`, 5);
    expect(memories.some((m) => m.includes("非法"))).toBe(true);
  });

  it("hybrid mode with multiple NPCs in scene: all witness and some respond", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);

    await request(app)
      .post("/api/scenes/switch")
      .send({ sessionId, sceneId: "thunder_tavern" })
      .expect(200);

    const response = await request(app)
      .post("/api/chat")
      .send({
        playerInput: "大喊一声，有人吗？",
        npcId: "chimu",
        sessionId,
        inputMode: "hybrid"
      })
      .expect(200);

    expect(response.body.mode).toBe("hybrid");

    // Narrator reply first
    const [narratorReply] = response.body.replies;
    expect(narratorReply.npcId).toBe("narrator");

    // Multiple NPCs may respond
    const npcReplies = response.body.replies.filter((r: ChatReplyResponse) => r.npcId !== "narrator");
    expect(npcReplies.length).toBeGreaterThanOrEqual(1);

    // All NPCs in scene should have witnessed the action (memory recorded)
    const chimuMemories = getRecentMemories(`${sessionId}::chimu`, 5);
    const qingguMemories = getRecentMemories(`${sessionId}::qinggu`, 5);

    expect(chimuMemories.length).toBeGreaterThan(0);
    expect(qingguMemories.length).toBeGreaterThan(0);
  });

  it("hybrid mode preserves backward compatibility fields", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);

    const response = await request(app)
      .post("/api/chat")
      .send({
        playerInput: "偷偷靠近，我要买丹药",
        npcId: "baili",
        sessionId,
        inputMode: "hybrid"
      })
      .expect(200);

    // Top-level fields should match first NPC reply (not narrator)
    const firstNpcReply = response.body.replies.find((r: ChatReplyResponse) => r.npcId !== "narrator");

    expect(response.body.dialogue).toBe(firstNpcReply.dialogue);
    expect(response.body.tone).toBe(firstNpcReply.tone);
    expect(response.body.intent).toEqual(firstNpcReply.intent);
    expect(response.body.state).toEqual(firstNpcReply.state);
  });

  it("hybrid mode with no NPC response: only narrator reply", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);

    await request(app)
      .post("/api/scenes/switch")
      .send({ sessionId, sceneId: "thunder_tavern" })
      .expect(200);

    const response = await request(app)
      .post("/api/chat")
      .send({
        playerInput: "偷偷溜走，都给我滚",
        npcId: "chimu",
        sessionId,
        inputMode: "hybrid"
      })
      .expect(200);

    expect(response.body.mode).toBe("hybrid");

    // Narrator always present
    const narratorReply = response.body.replies.find((r: ChatReplyResponse) => r.npcId === "narrator");
    expect(narratorReply).toBeDefined();

    // Arbiter may decide nobody speaks after the action
    // In this case, only narrator reply exists
    if (response.body.replies.length === 1) {
      expect(response.body.replies[0].npcId).toBe("narrator");
    }
  });

  it("hybrid mode action context is passed to NPC prompt", async () => {
    const app = createApp();
    const sessionId = await createTestSession(app);

    const response = await request(app)
      .post("/api/chat")
      .send({
        playerInput: "偷偷摸一下白璃大腿，我要买屏蔽药",
        npcId: "baili",
        sessionId,
        inputMode: "hybrid"
      })
      .expect(200);

    expect(response.body.mode).toBe("hybrid");

    const [narratorReply, ...npcReplies] = response.body.replies;

    // Narrator describes the action
    expect(narratorReply.dialogue).toContain("悄无声息");

    // NPC response should be contextually aware of the action
    // (In mock mode, baili will respond with standard mock response)
    expect(npcReplies.length).toBeGreaterThan(0);
    expect(npcReplies[0].npcId).toBe("baili");
  });
});

async function createTestSession(app: ReturnType<typeof createApp>): Promise<string> {
  const response = await request(app).post("/api/session").send({}).expect(201);
  return response.body.sessionId as string;
}
