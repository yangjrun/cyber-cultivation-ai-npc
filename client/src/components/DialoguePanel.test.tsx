import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DialoguePanel, type ChatMessage } from "./DialoguePanel";

const baseTimestamp = "12:34";

function player(id: string, text: string): ChatMessage {
  return { id, speaker: "player", name: "陆玄", text, timestamp: baseTimestamp };
}

function npc(id: string, text: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return { id, speaker: "npc", npcId: "baili", name: "白璃", text, timestamp: baseTimestamp, ...extra };
}

function narrator(id: string, text: string, kind: ChatMessage["kind"]): ChatMessage {
  return { id, speaker: "narrator", name: "旁白", text, timestamp: baseTimestamp, kind };
}

describe("DialoguePanel", () => {
  afterEach(() => cleanup());

  it("shows placeholder when there are no messages", () => {
    render(<DialoguePanel messages={[]} loading={false} />);
    expect(screen.getByText("丹铺的义体风铃正在低鸣。")).toBeTruthy();
  });

  it("shows loading indicator when loading=true", () => {
    render(<DialoguePanel messages={[]} loading={true} />);
    expect(screen.getByText(/灵识传输中/)).toBeTruthy();
  });

  it("renders player and npc bubbles in order with their text", () => {
    render(
      <DialoguePanel
        messages={[player("p1", "买药。"), npc("n1", "嗯。", { intentType: "respond_question" })]}
        loading={false}
      />
    );
    expect(screen.getByText("买药。")).toBeTruthy();
    expect(screen.getByText("嗯。")).toBeTruthy();
    expect(screen.getByText(/intent:\s*respond_question/)).toBeTruthy();
  });

  it("renders a narrator bubble with data-kind matching the message kind", () => {
    const { container } = render(
      <DialoguePanel messages={[narrator("nr1", "（你心头一颤）", "monologue")]} loading={false} />
    );
    const narratorEl = container.querySelector('[data-testid="narrator-bubble"]');
    expect(narratorEl?.getAttribute("data-kind")).toBe("monologue");
    expect(narratorEl?.textContent).toContain("（你心头一颤）");
  });

  it("renders an action-only bubble when npc has actions but no text", () => {
    const { container } = render(
      <DialoguePanel
        messages={[npc("n2", "", { actions: ["*转身*", "*沉默*"] })]}
        loading={false}
      />
    );
    expect(container.querySelector('[data-testid="action-only-bubble"]')).toBeTruthy();
    expect(screen.getByText(/\*转身\*/)).toBeTruthy();
  });

  it("shows [打断] marker when an npc reply has speakMode=interrupt", () => {
    render(
      <DialoguePanel
        messages={[npc("n3", "等等！", { speakMode: "interrupt" })]}
        loading={false}
      />
    );
    expect(screen.getByText("[打断]")).toBeTruthy();
  });
});
