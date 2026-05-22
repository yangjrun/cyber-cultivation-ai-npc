import { z } from "zod";
import type { ChatRequestBody, ResetRequestBody } from "../types/chat.js";

type ValidationResult<T> =
  | { ok: true; body: T }
  | { ok: false; status: number; message: string };

const sessionIdSchema = z.preprocess(
  (value) => typeof value === "string" ? value.trim() : value,
  z.string("sessionId 必须是 1 到 80 个字符。")
    .min(1, "sessionId 必须是 1 到 80 个字符。")
    .refine((value) => Array.from(value).length <= 80, "sessionId 必须是 1 到 80 个字符。")
);

const chatRequestSchema = z.object({
  playerInput: z.preprocess(
    (value) => typeof value === "string" ? value.trim() : value,
    z.string("playerInput 必须是字符串。")
      .min(1, "playerInput 必须是 1 到 80 个字符。")
      .refine((value) => Array.from(value).length <= 80, "playerInput 必须是 1 到 80 个字符。")
  ),
  npcId: z.preprocess(
    (value) => typeof value === "string" ? value.trim() : value,
    z.string("npcId 必须是字符串。").min(1, "npcId 必须是字符串。")
  ),
  sessionId: sessionIdSchema,
  inputMode: z.enum(["dialogue", "action", "monologue"]).optional()
});

const resetRequestSchema = z.object({
  npcId: z.preprocess(
    (value) => typeof value === "string" ? value.trim() : value,
    z.string("npcId 必须是字符串。").min(1, "npcId 必须是字符串。")
  ),
  sessionId: sessionIdSchema
});

export function validateChatRequest(body: unknown): ValidationResult<ChatRequestBody> {
  const parsed = chatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return { ok: false, status: 400, message: parsed.error.issues[0]?.message ?? "请求体格式不正确。" };
  }

  return { ok: true, body: parsed.data };
}

export function validateResetRequest(body: unknown): ValidationResult<ResetRequestBody> {
  const parsed = resetRequestSchema.safeParse(body);

  if (!parsed.success) {
    return { ok: false, status: 400, message: parsed.error.issues[0]?.message ?? "请求体格式不正确。" };
  }

  return { ok: true, body: parsed.data };
}
