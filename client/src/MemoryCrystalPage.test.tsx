import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { MemoryCrystalPage } from "./pages/MemoryCrystalPage";
import { resetGameStoreForTests, useGameStore } from "./state/store";

beforeEach(() => {
  resetGameStoreForTests();
  useGameStore.setState({ sessionId: "session-1", activeNpcId: "baili" });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetGameStoreForTests();
});

describe("MemoryCrystalPage", () => {
  it("renders evolved traits and recent memories for the active NPC", async () => {
    vi.stubGlobal("fetch", createFetchMock());

    render(
      <MemoryRouter>
        <MemoryCrystalPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("对玩家保持警觉，开炉前会多扫一眼。")).toBeInTheDocument();
    });
    expect(screen.getByText("玩家威胁过白璃")).toBeInTheDocument();
    expect(screen.getByText("威胁次数")).toBeInTheDocument();
  });

  it("switches NPC and refetches data", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <MemoryCrystalPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("对玩家保持警觉，开炉前会多扫一眼。")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "苏鹤" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/personality/session-1/suhe"),
        expect.anything()
      );
    });
  });

  it("shows empty states when no data", async () => {
    vi.stubGlobal("fetch", createFetchMock({ empty: true }));

    render(
      <MemoryRouter>
        <MemoryCrystalPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("尚未触发任何演化条件。")).toBeInTheDocument();
    });
    expect(screen.getByText("该 NPC 还没记下任何关于你的事。")).toBeInTheDocument();
  });

  it("hides everything when sessionId is empty", () => {
    useGameStore.setState({ sessionId: "" });

    render(
      <MemoryRouter>
        <MemoryCrystalPage />
      </MemoryRouter>
    );

    expect(screen.getByText("尚未建立会话，无可查记忆。")).toBeInTheDocument();
  });
});

type FetchOptions = { empty?: boolean };

function createFetchMock(options: FetchOptions = {}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.startsWith("/api/personality/")) {
      if (options.empty) {
        return jsonResponse({
          sessionId: "session-1",
          npcId: "baili",
          evolvedTraits: [],
          counters: {},
          updatedAt: ""
        });
      }

      return jsonResponse({
        sessionId: "session-1",
        npcId: url.includes("/suhe") ? "suhe" : "baili",
        evolvedTraits: ["对玩家保持警觉，开炉前会多扫一眼。"],
        counters: { threats: 5 },
        updatedAt: "2026-05-20T13:09:35.461Z"
      });
    }

    if (url.startsWith("/api/memory/")) {
      if (options.empty) {
        return jsonResponse({ sessionId: "session-1", npcId: "baili", memories: [] });
      }

      return jsonResponse({
        sessionId: "session-1",
        npcId: url.includes("/suhe") ? "suhe" : "baili",
        memories: [
          { id: 1, content: "玩家威胁过白璃", createdAt: "2026-05-20T13:09:35.461Z" }
        ]
      });
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
