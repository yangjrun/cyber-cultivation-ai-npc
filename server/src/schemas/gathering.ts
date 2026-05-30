import { z } from "zod";
import { listGatheringPointIds } from "../data/gatheringPoints.js";

type ValidationResult<T> =
  | { ok: true; body: T }
  | { ok: false; status: number; message: string };

export type GatherBody = {
  sessionId: string;
  pointId: string;
};

const knownPointIds = listGatheringPointIds();

const sessionIdSchema = z.string("sessionId 必须是字符串。").uuid("sessionId 格式不正确。");
const pointIdSchema = z
  .string("pointId 必须是字符串。")
  .refine((value) => knownPointIds.includes(value), "pointId 不是有效的采集点。");

const gatherSchema = z.object({
  sessionId: sessionIdSchema,
  pointId: pointIdSchema
});

export function validateGatherBody(body: unknown): ValidationResult<GatherBody> {
  const parsed = gatherSchema.safeParse(body);

  if (!parsed.success) {
    return { ok: false, status: 400, message: parsed.error.issues[0]?.message ?? "请求体格式不正确。" };
  }

  return { ok: true, body: parsed.data };
}
