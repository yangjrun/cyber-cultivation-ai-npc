import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { resetGameStoreForTests } from "./state/store";

const mockPlayer = {
  id: "player-1",
  sessionId: "session-1",
  name: "陆玄",
  realm: "练气期",
  hasIllegalSeal: true,
  visibleTraits: ["右臂经脉", "雷罚残痕", "非法灵根烙印"],
  recentActions: ["救过白璃的药童"],
  spiritStones: 0,
  qiCurrent: 0,
  qiCap: 100,
  cultivationStageIdx: 0
};

const mockNpcStates = {
  baili: { trust: 20, fear: 10, anger: 0, tianDaoAlert: 45 },
  suhe: { trust: 0, fear: 0, anger: 0, tianDaoAlert: 60 },
  chimu: { trust: 0, fear: 0, anger: 30, tianDaoAlert: 30 },
  qinggu: { trust: 10, fear: 5, anger: 0, tianDaoAlert: 25 }
};

const mockScenes = {
  scenes: [
    {
      sceneId: "black_market",
      name: "无相黑市",
      description: "九龙下城最深处的黑市。",
      backgroundAsset: "/scenes/black_market.png",
      npcIds: ["baili"],
      unlockedByDefault: true
    },
    {
      sceneId: "thunder_tavern",
      name: "雷罚酒馆",
      description: "雷罚帮在地下三层开的酒馆。",
      backgroundAsset: "/scenes/thunder_tavern.png",
      npcIds: ["chimu", "qinggu"],
      unlockedByDefault: true
    }
  ]
};

const mockSessionResponse = {
  sessionId: "session-1",
  playerId: "player-1",
  player: mockPlayer,
  npcState: mockNpcStates.baili,
  npcStates: mockNpcStates,
  activeSceneId: "black_market",
  quests: [],
  memories: [],
  inventory: []
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
    trust: 23,
    fear: 11,
    anger: 0,
    tianDaoAlert: 45
  },
  memoryAdded: "玩家想要躲避监察院望气的丹药。",
  actionResult: "接受任务：偷一枚监察密钥 / baili 情绪变动",
  player: mockPlayer
};

function renderApp(initialEntries: string[] = ["/play"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>
  );
}

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Pre-seed a stored sessionId so App auto-restores the session without
    // routing through CharacterCreatorPage.
    window.localStorage.setItem("lower-city.sessionId", "session-1");
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
    renderApp();

    await waitFor(() => {
      expect(window.localStorage.getItem("lower-city.sessionId")).toBe("session-1");
    });

    const input = await screen.findByRole("textbox");
    // Use paste instead of type for performance with large strings
    await user.click(input);
    await user.paste("雷".repeat(100));

    expect(Array.from((input as HTMLTextAreaElement).value)).toHaveLength(80);
  });

  it("fills a quick prompt and renders the chat response", async () => {
    const user = userEvent.setup();
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    renderApp();

    await waitFor(() => {
      expect(window.localStorage.getItem("lower-city.sessionId")).toBe("session-1");
    });

    await user.click(await screen.findByRole("button", { name: "我需要躲过监察院望气的丹药。" }));
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText("能做，但你得先偷一枚监察密钥。")).toBeInTheDocument();
    });

    const chatCall = fetchMock.mock.calls.find(([input]) => String(input) === "/api/chat");
    expect(chatCall?.[1]?.body).toBe(JSON.stringify({
      playerInput: "我需要躲过监察院望气的丹药。",
      npcId: "baili",
      sessionId: "session-1",
      inputMode: "dialogue"
    }));
    expect(screen.getByText("玩家想要躲避监察院望气的丹药。")).toBeInTheDocument();
    expect(screen.getAllByText(/接受任务：偷一枚监察密钥/).length).toBeGreaterThan(0);
  });

  it("shows a user friendly error when the API fails", async () => {
    vi.stubGlobal("fetch", createFetchMock({ failChat: true }));
    const user = userEvent.setup();
    renderApp();

    await waitFor(() => {
      expect(window.localStorage.getItem("lower-city.sessionId")).toBe("session-1");
    });

    const input = await screen.findByRole("textbox");
    await user.type(input, "买药");
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText("链路中断：无法连接 NPC。")).toBeInTheDocument();
    });
  });

  it("renders top nav with play and settings links", async () => {
    renderApp();

    expect(screen.getByRole("link", { name: "对话" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "设置" })).toBeInTheDocument();
  });

  it("renders the settings page when navigated", async () => {
    renderApp(["/settings"]);

    expect(await screen.findByText("设置与调试")).toBeInTheDocument();
  });

  it("renders a 404 for unknown routes", async () => {
    renderApp(["/no/such/path"]);

    expect(await screen.findByText("404 · 此路不通")).toBeInTheDocument();
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

    if (url === "/api/scenes") {
      return jsonResponse(mockScenes);
    }

    if (url.startsWith("/api/scenes/") && url.includes("/snapshot")) {
      return jsonResponse({
        scene: mockScenes.scenes[0],
        npcs: [
          {
            profile: { npc_id: "baili", name: "白璃", role: "黑市炼丹师", faction: "无相黑市" },
            state: mockNpcStates.baili
          }
        ]
      });
    }

    if (url.startsWith("/api/quests/")) {
      return jsonResponse({ quests: [] });
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
