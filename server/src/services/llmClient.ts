import Anthropic from "@anthropic-ai/sdk";
import { getMockResponder } from "./mockResponders/index.js";
import type { LlmMessage, LlmTextBlock } from "../types/llm.js";

type RequestLlmInput = {
  messages: LlmMessage[];
  playerInput: string;
  npcId?: string;
};

export async function generateNpcResponse(prompt: string, playerInput: string, npcId: string = "baili"): Promise<string> {
  return requestLlm({
    messages: [
      {
        role: "system",
        content: prompt
      }
    ],
    playerInput,
    npcId
  });
}

export async function requestLlm({ messages, playerInput, npcId = "baili" }: RequestLlmInput): Promise<string> {
  if (!process.env.LLM_API_KEY) {
    return JSON.stringify(getMockResponder(npcId)(playerInput));
  }

  const model = process.env.LLM_MODEL;

  if (!model) {
    throw new Error("LLM_MODEL is required when LLM_API_KEY is set");
  }

  const apiFormat = process.env.LLM_API_FORMAT === "claude" ? "claude" : "openai";

  return apiFormat === "claude"
    ? requestClaudeMessages(model, messages)
    : requestOpenAiCompatible(model, messages);
}

async function requestOpenAiCompatible(model: string, messages: LlmMessage[]): Promise<string> {
  const baseUrl = process.env.LLM_BASE_URL?.replace(/\/$/, "");

  if (!baseUrl) {
    throw new Error("LLM_BASE_URL is required for OpenAI-compatible LLM requests");
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 15000);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(resolveEndpoint(baseUrl, "/chat/completions"), {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LLM_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: messages.map((message) => ({
          role: message.role,
          content: stringifyContent(message.content)
        })),
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`LLM request failed with status ${response.status}`);
    }

    const payload = await response.json() as unknown;
    const content = extractOpenAiMessageContent(payload);

    if (!content) {
      throw new Error("LLM response did not include message content");
    }

    return content;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("LLM request timed out");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function requestClaudeMessages(model: string, messages: LlmMessage[]): Promise<string> {
  const client = new Anthropic({
    apiKey: process.env.LLM_API_KEY,
    authToken: null,
    baseURL: resolveClaudeBaseUrl(process.env.LLM_BASE_URL),
    timeout: Number(process.env.LLM_TIMEOUT_MS ?? 15000),
    maxRetries: 0,
    defaultHeaders: {
      "anthropic-version": process.env.ANTHROPIC_VERSION ?? "2023-06-01"
    }
  });
  const response = await client.messages.create({
    model,
    max_tokens: 512,
    system: toClaudeSystem(messages),
    messages: toClaudeMessages(messages)
  });
  const content = extractClaudeMessageContent(response);

  if (!content) {
    throw new Error("LLM response did not include message content");
  }

  return content;
}

function toClaudeSystem(messages: LlmMessage[]): Anthropic.TextBlockParam[] | undefined {
  const blocks = messages
    .filter((message) => message.role === "system")
    .flatMap((message) => toClaudeTextBlocks(message.content));

  return blocks.length > 0 ? blocks : undefined;
}

function toClaudeMessages(messages: LlmMessage[]): Anthropic.MessageParam[] {
  const nonSystem = messages.filter((message) => message.role !== "system");

  if (nonSystem.length === 0) {
    return [
      {
        role: "user",
        content: "继续。"
      }
    ];
  }

  return nonSystem.map((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: typeof message.content === "string" ? message.content : toClaudeTextBlocks(message.content)
  }));
}

function toClaudeTextBlocks(content: string | LlmTextBlock[]): Anthropic.TextBlockParam[] {
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }

  return content.map((block) => ({
    type: "text",
    text: block.text,
    ...(block.cacheControl ? { cache_control: block.cacheControl } : {})
  }));
}

function resolveEndpoint(baseUrl: string, path: "/chat/completions"): string {
  if (baseUrl.endsWith(path)) {
    return baseUrl;
  }

  if (baseUrl.endsWith("/v1")) {
    return `${baseUrl}${path}`;
  }

  return `${baseUrl}/v1${path}`;
}

function resolveClaudeBaseUrl(baseUrl: string | undefined): string | undefined {
  if (!baseUrl) {
    return undefined;
  }

  const normalized = baseUrl.replace(/\/$/, "");

  if (normalized.endsWith("/v1/messages")) {
    return normalized.slice(0, -"/v1/messages".length);
  }

  if (normalized.endsWith("/v1")) {
    return normalized.slice(0, -"/v1".length);
  }

  return normalized;
}

function extractClaudeMessageContent(response: unknown): string | null {
  const payload = typeof response === "string" ? parseJson(response) : response;

  if (!isRecord(payload) || !Array.isArray(payload.content)) {
    return null;
  }

  const textBlocks = payload.content
    .filter((block): block is Record<string, unknown> => isRecord(block) && block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string);

  return textBlocks.length > 0 ? textBlocks.join("\n") : null;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function extractOpenAiMessageContent(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    return null;
  }

  const [choice] = payload.choices;

  if (!isRecord(choice) || !isRecord(choice.message) || typeof choice.message.content !== "string") {
    return null;
  }

  return choice.message.content;
}

function stringifyContent(content: string | LlmTextBlock[]): string {
  if (typeof content === "string") {
    return content;
  }

  return content.map((block) => block.text).join("\n\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
