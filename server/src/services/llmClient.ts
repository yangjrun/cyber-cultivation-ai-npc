import { getMockResponder } from "./mockResponders/index.js";

export async function generateNpcResponse(prompt: string, playerInput: string, npcId: string = "baili"): Promise<string> {
  if (!process.env.LLM_API_KEY) {
    return JSON.stringify(getMockResponder(npcId)(playerInput));
  }

  const baseUrl = process.env.LLM_BASE_URL?.replace(/\/$/, "");
  const model = process.env.LLM_MODEL;

  if (!baseUrl || !model) {
    throw new Error("LLM_BASE_URL and LLM_MODEL are required when LLM_API_KEY is set");
  }

  const response = await requestLlm(baseUrl, model, prompt);

  if (!response.ok) {
    throw new Error(`LLM request failed with status ${response.status}`);
  }

  const payload = await response.json() as unknown;
  const content = extractMessageContent(payload);

  if (!content) {
    throw new Error("LLM response did not include message content");
  }

  return content;
}

async function requestLlm(baseUrl: string, model: string, prompt: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 15000);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const apiFormat = process.env.LLM_API_FORMAT === "claude" ? "claude" : "openai";
    return apiFormat === "claude"
      ? await requestClaudeMessages(baseUrl, model, prompt, controller.signal)
      : await requestOpenAiCompatible(baseUrl, model, prompt, controller.signal);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("LLM request timed out");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function requestOpenAiCompatible(baseUrl: string, model: string, prompt: string, signal: AbortSignal): Promise<Response> {
  return fetch(resolveEndpoint(baseUrl, "/chat/completions"), {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LLM_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: prompt
        }
      ],
      temperature: 0.7
    })
  });
}

async function requestClaudeMessages(baseUrl: string, model: string, prompt: string, signal: AbortSignal): Promise<Response> {
  return fetch(resolveEndpoint(baseUrl, "/messages"), {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.LLM_API_KEY ?? "",
      "anthropic-version": process.env.ANTHROPIC_VERSION ?? "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });
}

function resolveEndpoint(baseUrl: string, path: "/chat/completions" | "/messages"): string {
  if (baseUrl.endsWith(path)) {
    return baseUrl;
  }

  if (baseUrl.endsWith("/v1")) {
    return `${baseUrl}${path}`;
  }

  return `${baseUrl}/v1${path}`;
}

function extractMessageContent(payload: unknown): string | null {
  const openAiContent = extractOpenAiMessageContent(payload);

  if (openAiContent) {
    return openAiContent;
  }

  return extractClaudeMessageContent(payload);
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

function extractClaudeMessageContent(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.content)) {
    return null;
  }

  const textBlocks = payload.content
    .filter((block): block is Record<string, unknown> => isRecord(block) && block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string);

  return textBlocks.length > 0 ? textBlocks.join("\n") : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
