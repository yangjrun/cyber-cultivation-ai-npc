import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { resetGameStoreForTests } from "./state/store";

const mockPlayer = {
  id: "player-1",
  sessionId: "session-1",
  name: "陆玄",
  realm: "练气期",
  hasIllegalChip: true,
  visibleTraits: ["右臂义体", "雷罚残痕", "非法灵根波形"],
  recentActions: ["救过白璃的药童"],
  spiritStones: 0,
  qiCurrent: 0,
  qiCap: 100,
  cultivationStageIdx: 0
};

const mockSessionResponse = {
  sessionId: "session-1",
  playerId: "player-1",
  player: mockPlayer,
  npcState: {
    trust: 20,
    fear: 10,
    anger: 0,
    tianDaoAlert: 45
  },
  memories: []
};

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
  actionResult: "任务已触发：偷取监察密钥。",
  player: mockPlayer
};

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetGameStoreForTests();
    vi.stubGlobal("fetch", createFetchMock());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    resetGameStoreForTests();
  });

  it("limits player input to 80 characters", async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    await user.type(input, "雷".repeat(100));

    expect(Array.from(input.value)).toHaveLength(80);
  });

  it("fills a quick prompt and renders the chat response", async () => {
    const user = userEvent.setup();
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await waitFor(() => {
      expect(window.localStorage.getItem("cyber-cultivation.sessionId")).toBe("session-1");
    });

    await user.click(screen.getByRole("button", { name: "我需要躲过监察院扫描的丹药。" }));
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText("能做，但你得先偷一枚监察密钥。")).toBeInTheDocument();
    });

    const chatCall = fetchMock.mock.calls.find(([input]) => String(input) === "/api/chat");
    expect(chatCall?.[1]?.body).toBe(JSON.stringify({
      playerInput: "我需要躲过监察院扫描的丹药。",
      npcId: "baili",
      sessionId: "session-1"
    }));
    expect(screen.getByText("语气：试探")).toBeInTheDocument();
    expect(screen.getByText("玩家想要躲避监察院扫描的丹药。")).toBeInTheDocument();
    expect(screen.getByText("任务已触发：偷取监察密钥。")).toBeInTheDocument();
    expect(screen.getByText("21")).toBeInTheDocument();
  });

  it("shows a user friendly error when the API fails", async () => {
    vi.stubGlobal("fetch", createFetchMock({ failChat: true }));
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(window.localStorage.getItem("cyber-cultivation.sessionId")).toBe("session-1");
    });

    const input = screen.getByRole("textbox");
    await user.type(input, "买药");
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText("链路中断：无法连接白璃丹铺。")).toBeInTheDocument();
    });
  });

  it("renders the initial welcome message, player panel, and system log", async () => {
    render(<App />);

    expect(screen.getByText("新面孔？右臂这焊痕，不是正经门路上的人吧。")).toBeInTheDocument();
    expect(screen.getByText("已连接白璃丹铺。")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("练气一层 · 非法灵根持有者")).toBeInTheDocument();
    });
    expect(screen.getByText("0 灵石")).toBeInTheDocument();
  });
});

type FetchMockOptions = {
  failChat?: boolean;
};

function createFetchMock(options: FetchMockOptions = {}) {
  return vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);

    if (url === "/api/session" || url === "/api/session/session-1") {
      return jsonResponse(mockSessionResponse);
    }

    if (url === "/api/chat/reset") {
      return jsonResponse({});
    }

    if (url === "/api/chat") {
      return options.failChat ? jsonResponse({ error: "failed" }, 500) : jsonResponse(mockChatResponse);
    }

    return jsonResponse({ error: "not found" }, 404);
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
