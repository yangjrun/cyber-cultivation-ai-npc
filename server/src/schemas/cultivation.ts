import { z } from "zod";

type ValidationResult<T> =
  | { ok: true; body: T }
  | { ok: false; status: number; message: string };

export type CultivateBody = {
  sessionId: string;
  duration: number;
};

export type BreakthroughBody = {
  sessionId: string;
};

const sessionIdSchema = z.string("sessionId 必须是字符串。").uuid("sessionId 格式不正确。");

const cultivateSchema = z.object({
  sessionId: sessionIdSchema,
  duration: z.number("duration 必须是数字。").finite("duration 必须是有效数字。").positive("duration 必须大于 0。").max(300, "duration 不能超过 300 秒。")
});

const breakthroughSchema = z.object({
  sessionId: sessionIdSchema
});

export function validateCultivateBody(body: unknown): ValidationResult<CultivateBody> {
  const parsed = cultivateSchema.safeParse(body);

  if (!parsed.success) {
    return { ok: false, status: 400, message: parsed.error.issues[0]?.message ?? "请求体格式不正确。" };
  }

  return { ok: true, body: parsed.data };
}

export function validateBreakthroughBody(body: unknown): ValidationResult<BreakthroughBody> {
  const parsed = breakthroughSchema.safeParse(body);

  if (!parsed.success) {
    return { ok: false, status: 400, message: parsed.error.issues[0]?.message ?? "请求体格式不正确。" };
  }

  return { ok: true, body: parsed.data };
}
