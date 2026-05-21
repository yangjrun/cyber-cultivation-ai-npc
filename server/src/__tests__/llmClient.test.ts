import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateNpcResponse, requestLlm } from "../services/llmClient.js";

describe("llmClient", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://relay.example.com/v1";
    process.env.LLM_MODEL = "test-model";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("calls OpenAI-compatible chat completions by default", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "{\"dialogue\":\"少废话。\"}" } }]
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const content = await generateNpcResponse("prompt", "买药");
    const [, options] = fetchMock.mock.calls[0];

    expect(fetchMock.mock.calls[0][0]).toBe("https://relay.example.com/v1/chat/completions");
    expect((options as RequestInit).headers).toMatchObject({ Authorization: "Bearer test-key" });
    expect(content).toBe("{\"dialogue\":\"少废话。\"}");
  });

  it("calls Claude Messages API when LLM_API_FORMAT is claude", async () => {
    process.env.LLM_API_FORMAT = "claude";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: "text", text: "{\"dialogue\":\"少废话。\"}" }]
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const content = await generateNpcResponse("prompt", "买药");
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string) as Record<string, unknown>;

    const headers = (options as RequestInit).headers as Headers;

    expect(fetchMock.mock.calls[0][0]).toBe("https://relay.example.com/v1/messages");
    expect(headers.get("x-api-key")).toBe("test-key");
    expect(headers.get("anthropic-version")).toBe("2023-06-01");
    expect(headers.has("authorization")).toBe(false);
    expect(body).toMatchObject({ model: "test-model", max_tokens: 512 });
    expect(content).toBe("{\"dialogue\":\"少废话。\"}");
  });

  it("maps internal cacheControl blocks to Claude cache_control", async () => {
    process.env.LLM_API_FORMAT = "claude";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: "text", text: "{\"dialogue\":\"少废话。\"}" }]
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await requestLlm({
      npcId: "baili",
      playerInput: "买药",
      messages: [
        {
          role: "system",
          content: [{ type: "text", text: "stable role card", cacheControl: { type: "ephemeral" } }]
        },
        {
          role: "user",
          content: "dynamic turn"
        }
      ]
    });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string) as {
      system: Array<{ cache_control?: { type: string }; text: string }>;
      messages: Array<{ role: string; content: string }>;
    };

    expect(body.system[0]).toMatchObject({
      text: "stable role card",
      cache_control: { type: "ephemeral" }
    });
    expect(body.messages).toEqual([{ role: "user", content: "dynamic turn" }]);
  });

  it("accepts a root relay URL as LLM_BASE_URL", async () => {
    process.env.LLM_API_FORMAT = "claude";
    process.env.LLM_BASE_URL = "https://relay.example.com";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: "text", text: "{\"dialogue\":\"少废话。\"}" }]
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await generateNpcResponse("prompt", "买药");

    expect(fetchMock.mock.calls[0][0]).toBe("https://relay.example.com/v1/messages");
  });

  it("accepts a full Claude Messages endpoint as LLM_BASE_URL", async () => {
    process.env.LLM_API_FORMAT = "claude";
    process.env.LLM_BASE_URL = "https://relay.example.com/v1/messages";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: "text", text: "{\"dialogue\":\"少废话。\"}" }]
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await generateNpcResponse("prompt", "买药");

    expect(fetchMock.mock.calls[0][0]).toBe("https://relay.example.com/v1/messages");
  });
});
