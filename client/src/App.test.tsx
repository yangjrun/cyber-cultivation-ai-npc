import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const mockChatResponse = {
  dialogue: "能做，但你得先偷一枚监察密钥。",
  tone: "试探",
  intent: {
    type: "give_quest",
    params: {
      quest_id: "steal_inspector_key"
    }
  },
  state: {
    trust: 21,
    fear: 11,
    anger: 0,
    tianDaoAlert: 45
  },
  memoryAdded: "玩家想要躲避监察院扫描的丹药。",
  actionResult: "任务已触发：偷取监察密钥。"
};

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockChatResponse
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("limits player input to 80 characters", async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText("向白璃开口……") as HTMLInputElement;
    await user.type(input, "雷".repeat(100));

    expect(Array.from(input.value)).toHaveLength(80);
  });

  it("fills a quick prompt and renders the chat response", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "我需要躲过监察院扫描的丹药。" }));
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText("能做，但你得先偷一枚监察密钥。")).toBeInTheDocument();
    });

    expect(screen.getByText("tone：试探")).toBeInTheDocument();
    expect(screen.getByText("玩家想要躲避监察院扫描的丹药。")).toBeInTheDocument();
    expect(screen.getByText("任务已触发：偷取监察密钥。")).toBeInTheDocument();
    expect(screen.getByText("21")).toBeInTheDocument();
  });

  it("shows a user friendly error when the API fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText("向白璃开口……");
    await user.type(input, "买药");
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText("通讯被黑市噪声干扰，请稍后再试。"));
    });
  });
});
