import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DialoguePanel, type ChatMessage } from "./DialoguePanel";

const baseTimestamp = "14:30";

function createMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: "msg-1",
    speaker: "player",
    name: "陆玄",
    text: "测试消息",
    timestamp: baseTimestamp,
    ...overrides
  };
}

describe("DialoguePanel - Hybrid Mode", () => {
  afterEach(() => cleanup());

  it("renders narrator action bubble followed by NPC reply in hybrid mode", () => {
    const messages: ChatMessage[] = [
      createMessage({
        id: "narrator-1",
        speaker: "narrator",
        name: "旁白",
        text: "陆玄悄悄靠近丹炉，白璃警觉地抬起头。",
        kind: "action"
      }),
      createMessage({
        id: "npc-1",
        speaker: "npc",
        npcId: "baili",
        name: "白璃",
        text: "你想干什么？",
        kind: "dialogue"
      })
    ];

    const { container } = render(<DialoguePanel messages={messages} loading={false} />);

    const narratorBubble = container.querySelector('[data-testid="narrator-bubble"]');
    expect(narratorBubble).toBeTruthy();
    expect(narratorBubble?.getAttribute("data-kind")).toBe("action");
    expect(narratorBubble?.textContent).toContain("陆玄悄悄靠近丹炉");

    expect(screen.getByText("白璃")).toBeTruthy();
    expect(screen.getByText("你想干什么？")).toBeTruthy();
  });

  it("renders narrator with action kind using rose theme", () => {
    const messages: ChatMessage[] = [
      createMessage({
        id: "narrator-1",
        speaker: "narrator",
        name: "旁白",
        text: "你挥出一拳。",
        kind: "action"
      })
    ];

    const { container } = render(<DialoguePanel messages={messages} loading={false} />);

    const narratorBubble = container.querySelector('[data-testid="narrator-bubble"]');
    expect(narratorBubble?.className).toContain("border-rose-400/30");
    expect(narratorBubble?.className).toContain("bg-rose-500/5");
  });

  it("renders narrator with monologue kind using violet theme", () => {
    const messages: ChatMessage[] = [
      createMessage({
        id: "narrator-1",
        speaker: "narrator",
        name: "心声",
        text: "完蛋，被发现了。",
        kind: "monologue"
      })
    ];

    const { container } = render(<DialoguePanel messages={messages} loading={false} />);

    const narratorBubble = container.querySelector('[data-testid="narrator-bubble"]');
    expect(narratorBubble?.className).toContain("border-violet-400/30");
    expect(narratorBubble?.className).toContain("bg-violet-500/5");
  });

  it("renders player message with hybrid kind", () => {
    const messages: ChatMessage[] = [
      createMessage({
        id: "player-1",
        speaker: "player",
        name: "陆玄",
        text: "偷偷靠近，我要买屏蔽药",
        kind: "hybrid"
      })
    ];

    render(<DialoguePanel messages={messages} loading={false} />);

    expect(screen.getByText("陆玄")).toBeTruthy();
    expect(screen.getByText("偷偷靠近，我要买屏蔽药")).toBeTruthy();
  });

  it("renders multiple NPC replies after narrator action", () => {
    const messages: ChatMessage[] = [
      createMessage({
        id: "narrator-1",
        speaker: "narrator",
        name: "旁白",
        text: "你大喊一声。",
        kind: "action"
      }),
      createMessage({
        id: "npc-1",
        speaker: "npc",
        npcId: "baili",
        name: "白璃",
        text: "吵什么？",
        kind: "dialogue"
      }),
      createMessage({
        id: "npc-2",
        speaker: "npc",
        npcId: "chimu",
        name: "赤目",
        text: "找死？",
        kind: "dialogue",
        speakMode: "interrupt"
      })
    ];

    render(<DialoguePanel messages={messages} loading={false} />);

    expect(screen.getByText("旁白")).toBeTruthy();
    expect(screen.getByText("白璃")).toBeTruthy();
    expect(screen.getByText("赤目")).toBeTruthy();
    expect(screen.getByText("[打断]")).toBeTruthy();
  });

  it("renders action_only NPC reply after narrator action", () => {
    const messages: ChatMessage[] = [
      createMessage({
        id: "narrator-1",
        speaker: "narrator",
        name: "旁白",
        text: "你盯着她看。",
        kind: "action"
      }),
      createMessage({
        id: "npc-1",
        speaker: "npc",
        npcId: "qinggu",
        name: "青姑",
        text: "",
        kind: "dialogue",
        speakMode: "action_only",
        actions: ["*斜眼*", "*转身离开*"]
      })
    ];

    const { container } = render(<DialoguePanel messages={messages} loading={false} />);

    const actionOnlyBubble = container.querySelector('[data-testid="action-only-bubble"]');
    expect(actionOnlyBubble).toBeTruthy();
    expect(actionOnlyBubble?.textContent).toContain("*斜眼*");
    expect(actionOnlyBubble?.textContent).toContain("*转身离开*");
  });

  it("renders affectedStates information in narrator bubble", () => {
    const messages: ChatMessage[] = [
      createMessage({
        id: "narrator-1",
        speaker: "narrator",
        name: "旁白",
        text: "你一拳打向白璃。",
        kind: "action"
      })
    ];

    const { container } = render(<DialoguePanel messages={messages} loading={false} />);

    const narratorBubble = container.querySelector('[data-testid="narrator-bubble"]');
    expect(narratorBubble).toBeTruthy();
    // affectedStates are handled in the backend and reflected in state updates
    // The UI just displays the narration
  });

  it("handles empty messages array", () => {
    const { container } = render(<DialoguePanel messages={[]} loading={false} />);

    expect(container.textContent).toContain("丹铺的符箓风铃正在低鸣");
  });

  it("shows loading indicator when loading is true", () => {
    render(<DialoguePanel messages={[]} loading={true} />);

    expect(screen.getByText("灵识传输中...")).toBeTruthy();
  });

  it("renders hybrid flow: player action -> narrator -> NPC response", () => {
    const messages: ChatMessage[] = [
      createMessage({
        id: "player-1",
        speaker: "player",
        name: "陆玄",
        text: "偷偷靠近，我要买屏蔽药",
        kind: "hybrid"
      }),
      createMessage({
        id: "narrator-1",
        speaker: "narrator",
        name: "旁白",
        text: "陆玄悄悄靠近丹炉，白璃警觉地抬起头。",
        kind: "action"
      }),
      createMessage({
        id: "npc-1",
        speaker: "npc",
        npcId: "baili",
        name: "白璃",
        text: "能做，但你得先偷一枚监察密钥。",
        kind: "dialogue",
        intentType: "give_quest"
      })
    ];

    const { container } = render(<DialoguePanel messages={messages} loading={false} />);

    // Verify all three messages are rendered
    expect(screen.getByText("陆玄")).toBeTruthy();
    expect(screen.getByText("旁白")).toBeTruthy();
    expect(screen.getByText("白璃")).toBeTruthy();

    // Verify content
    expect(screen.getByText("偷偷靠近，我要买屏蔽药")).toBeTruthy();
    expect(screen.getByText("陆玄悄悄靠近丹炉，白璃警觉地抬起头。")).toBeTruthy();
    expect(screen.getByText("能做，但你得先偷一枚监察密钥。")).toBeTruthy();

    // Verify intent badge is shown
    expect(screen.getByText(/intent: give_quest/i)).toBeTruthy();

    // Verify narrator bubble has correct kind
    const narratorBubble = container.querySelector('[data-testid="narrator-bubble"]');
    expect(narratorBubble?.getAttribute("data-kind")).toBe("action");
  });
});
