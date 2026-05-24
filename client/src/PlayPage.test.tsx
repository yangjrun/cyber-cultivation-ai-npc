import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { resetGameStoreForTests, useGameStore } from "./state/store";

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

const mockNpcStates = {
  baili: { trust: 20, fear: 10, anger: 0, tianDaoAlert: 45 },
  chimu: { trust: 0, fear: 0, anger: 30, tianDaoAlert: 30 },
  qinggu: { trust: 10, fear: 5, anger: 0, tianDaoAlert: 25 },
  suhe: { trust: 0, fear: 0, anger: 0, tianDaoAlert: 60 }
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

const mockSession = {
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

const mockSwitchScene = vi.fn<(sessionId: string, sceneId: string) => void>();

function renderApp(initialPath = "/play") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>
  );
}

describe("PlayPage scene + NPC navigation", () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Pre-seed a stored sessionId so App auto-restores the session without
    // routing through CharacterCreatorPage.
    window.localStorage.setItem("cyber-cultivation.sessionId", "session-1");
    resetGameStoreForTests();
    mockSwitchScene.mockClear();
    vi.stubGlobal("fetch", createFetchMock());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    resetGameStoreForTests();
  });

  it("renders scene tabs from /api/scenes and marks active one", async () => {
    renderApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "无相黑市" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "雷罚酒馆" })).toBeInTheDocument();
    });

    const blackMarketTab = screen.getByRole("button", { name: "无相黑市" });
    expect(blackMarketTab).toHaveAttribute("aria-pressed", "true");
  });

  it("switches scene when a different tab is clicked", async () => {
    const user = userEvent.setup();
    renderApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "雷罚酒馆" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "雷罚酒馆" }));

    await waitFor(() => {
      expect(useGameStore.getState().activeSceneId).toBe("thunder_tavern");
    });

    expect(mockSwitchScene).toHaveBeenCalledWith("session-1", "thunder_tavern");
  });

  it("lists NPCs for the active scene and allows selection", async () => {
    const user = userEvent.setup();
    renderApp();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "雷罚酒馆" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "雷罚酒馆" }));

    await waitFor(() => {
      expect(useGameStore.getState().activeSceneId).toBe("thunder_tavern");
    });

    const chimuButton = await screen.findByRole("button", { name: /赤目/ });
    const qingguButton = await screen.findByRole("button", { name: /青姑/ });
    expect(chimuButton).toBeInTheDocument();
    expect(qingguButton).toBeInTheDocument();

    await user.click(qingguButton);

    await waitFor(() => {
      expect(useGameStore.getState().activeNpcId).toBe("qinggu");
    });
  });

  it("URL drives scene selection when navigating directly to a scene path", async () => {
    renderApp("/play/scene/thunder_tavern");

    await waitFor(() => {
      expect(useGameStore.getState().activeSceneId).toBe("thunder_tavern");
    });
  });

  it("renders multiple NPC replies from one player message", async () => {
    vi.stubGlobal("fetch", createFetchMock({
      chatResponse: {
        dialogue: "过路费，三十灵石。",
        tone: "不耐烦",
        intent: { type: "give_quest", params: { quest_id: "pay_thunder_toll" } },
        state: { trust: 0, fear: 0, anger: 30, tianDaoAlert: 30 },
        memoryAdded: "玩家试图通过赤目的卡口。",
        actionResult: "接受任务：应付雷罚帮过路费",
        player: mockPlayer,
        replies: [
          {
            npcId: "chimu",
            dialogue: "过路费，三十灵石。",
            tone: "不耐烦",
            intent: { type: "give_quest", params: { quest_id: "pay_thunder_toll" } },
            state: { trust: 0, fear: 0, anger: 30, tianDaoAlert: 30 },
            memoryAdded: "玩家试图通过赤目的卡口。",
            actionResult: "接受任务：应付雷罚帮过路费"
          },
          {
            npcId: "qinggu",
            dialogue: "你不去验一验？",
            tone: "勾人",
            intent: { type: "give_quest", params: { quest_id: "verify_suhe_identity" } },
            state: { trust: 12, fear: 5, anger: 0, tianDaoAlert: 25 },
            memoryAdded: "玩家怀疑苏鹤的身份，青姑顺势卖了线索。",
            actionResult: ""
          }
        ]
      }
    }));
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole("button", { name: "雷罚酒馆" }));
    await waitFor(() => {
      expect(useGameStore.getState().activeSceneId).toBe("thunder_tavern");
    });
    await user.type(screen.getByPlaceholderText(/向赤目开口/), "让我过");
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText("过路费，三十灵石。")).toBeInTheDocument();
      expect(screen.getByText("你不去验一验？")).toBeInTheDocument();
    });
    expect(screen.getAllByText("赤目").length).toBeGreaterThan(0);
    expect(screen.getAllByText("青姑").length).toBeGreaterThan(0);
    expect(useGameStore.getState().npcStates.qinggu).toEqual({ trust: 12, fear: 5, anger: 0, tianDaoAlert: 25 });
  });

  it("renders quest log when quest data is loaded", async () => {
    vi.stubGlobal("fetch", createFetchMock({
      questsList: [
        {
          sessionId: "session-1",
          questId: "verify_suhe_identity",
          status: "in_progress",
          progress: {},
          acceptedAt: "2025-01-01T00:00:00.000Z",
          completedAt: null,
          updatedAt: "2025-01-01T00:00:01.000Z",
          definition: {
            questId: "verify_suhe_identity",
            title: "印证苏鹤的身份",
            description: "test desc",
            giverNpcId: "qinggu",
            involvedNpcIds: ["qinggu", "suhe"]
          }
        }
      ]
    }));

    renderApp();

    await waitFor(() => {
      expect(useGameStore.getState().sessionId).toBe("session-1");
    });

    await useGameStore.getState().refreshQuests();

    await waitFor(() => {
      expect(screen.getByText("印证苏鹤的身份")).toBeInTheDocument();
    });
  });

  it("sends inputMode=action and renders a narrator bubble for action mode", async () => {
    const fetchMock = createFetchMock({
      chatResponse: {
        mode: "action",
        dialogue: "（潜行：偷摸过去）",
        tone: "旁白",
        intent: { type: "none", params: {} },
        state: null,
        memoryAdded: "",
        actionResult: "",
        player: mockPlayer,
        replies: [
          {
            npcId: "narrator",
            dialogue: "（潜行：偷摸过去）",
            tone: "旁白",
            intent: { type: "none", params: {} },
            state: null,
            memoryAdded: "",
            actionResult: "",
            kind: "action"
          }
        ],
        groupChat: { sceneId: "black_market", speakerOrder: ["narrator"] }
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderApp();

    await waitFor(() => {
      expect(useGameStore.getState().sessionId).toBe("session-1");
    });

    await user.click(screen.getByRole("radio", { name: /动作模式/ }));
    const textarea = screen.getByPlaceholderText(/描述一个动作/);
    await user.type(textarea, "偷摸过去");
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByTestId("narrator-bubble")).toBeInTheDocument();
    });

    const bubble = screen.getByTestId("narrator-bubble");
    expect(bubble).toHaveAttribute("data-kind", "action");
    expect(bubble).toHaveTextContent("旁白");
    expect(bubble).toHaveTextContent("（潜行：偷摸过去）");

    const chatCall = fetchMock.mock.calls.find(([input]) => String(input) === "/api/chat");
    const body = JSON.parse(String(chatCall?.[1]?.body ?? "{}")) as Record<string, unknown>;
    expect(body.inputMode).toBe("action");
  });

  it("renders a violet monologue bubble for monologue mode", async () => {
    vi.stubGlobal("fetch", createFetchMock({
      chatResponse: {
        mode: "monologue",
        dialogue: "完蛋",
        tone: "心声",
        intent: { type: "none", params: {} },
        state: null,
        memoryAdded: "",
        actionResult: "",
        player: mockPlayer,
        replies: [
          {
            npcId: "narrator",
            dialogue: "完蛋",
            tone: "心声",
            intent: { type: "none", params: {} },
            state: null,
            memoryAdded: "",
            actionResult: "",
            kind: "monologue"
          }
        ],
        groupChat: { sceneId: "black_market", speakerOrder: ["narrator"] }
      }
    }));

    const user = userEvent.setup();
    renderApp();

    await waitFor(() => {
      expect(useGameStore.getState().sessionId).toBe("session-1");
    });

    await user.click(screen.getByRole("radio", { name: /心声模式/ }));
    const textarea = screen.getByPlaceholderText(/心声闪过/);
    await user.type(textarea, "完蛋");
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByTestId("narrator-bubble")).toBeInTheDocument();
    });

    const bubble = screen.getByTestId("narrator-bubble");
    expect(bubble).toHaveAttribute("data-kind", "monologue");
    expect(bubble).toHaveTextContent("心声");
  });
});

type FetchOptions = {
  questsList?: unknown[];
  chatResponse?: unknown;
};

function createFetchMock(options: FetchOptions = {}) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url === "/api/session" || url === "/api/session/session-1") {
      return jsonResponse(mockSession);
    }

    if (url === "/api/scenes") {
      return jsonResponse(mockScenes);
    }

    if (url === "/api/scenes/switch") {
      const body = init?.body ? JSON.parse(String(init.body)) as { sceneId: string } : { sceneId: "" };
      mockSwitchScene("session-1", body.sceneId);
      return jsonResponse({ sessionId: "session-1", activeSceneId: body.sceneId });
    }

    if (url.startsWith("/api/scenes/") && url.includes("/snapshot")) {
      return jsonResponse({
        scene: mockScenes.scenes[0],
        npcs: []
      });
    }

    if (url.startsWith("/api/quests/")) {
      return jsonResponse({ quests: options.questsList ?? [] });
    }

    if (url === "/api/chat/reset") {
      return jsonResponse({});
    }

    if (url === "/api/chat") {
      return jsonResponse(options.chatResponse ?? {});
    }

    return jsonResponse({ error: "not found" }, 404);
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
