import { z } from "zod";
import type { PlayerTraitId } from "../data/playerTraits.js";

const rootsSchema = z.object({
  metal: z.number().int().min(0).max(100),
  wood: z.number().int().min(0).max(100),
  water: z.number().int().min(0).max(100),
  fire: z.number().int().min(0).max(100),
  earth: z.number().int().min(0).max(100)
});

export const createSessionBodySchema = z
  .object({
    name: z.string().trim().min(1).max(12).optional(),
    roots: rootsSchema.optional(),
    traitId: z.enum(["yiti_arm", "leifa_scar", "feifagen"]).optional()
  })
  .strict();

export type CreateSessionBody = {
  name?: string;
  roots?: { metal: number; wood: number; water: number; fire: number; earth: number };
  traitId?: PlayerTraitId;
};

export function validateCreateSessionBody(raw: unknown):
  | { ok: true; body: CreateSessionBody }
  | { ok: false; status: number; message: string } {
  // Treat null / undefined / empty body as a valid default-only request.
  if (raw === undefined || raw === null) {
    return { ok: true, body: {} };
  }
  if (typeof raw === "object" && !Array.isArray(raw) && Object.keys(raw as object).length === 0) {
    return { ok: true, body: {} };
  }
  const parsed = createSessionBodySchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      status: 400,
      message: first ? `${first.path.join(".") || "body"}: ${first.message}` : "session body 格式错误。"
    };
  }
  return { ok: true, body: parsed.data };
}
