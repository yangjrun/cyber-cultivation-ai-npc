import { z } from "zod";
import { listNpcIds } from "../data/npcs.js";

type ValidationResult<T> =
  | { ok: true; body: T }
  | { ok: false; status: number; message: string };

export type TradeBody = {
  sessionId: string;
  npcId: string;
  itemId: string;
  quantity: number;
  quality?: "common" | "fine" | "perfect";
};

export type ShopParams = {
  sessionId: string;
  npcId: string;
};

const knownNpcIds = listNpcIds();

const sessionIdSchema = z.string("sessionId 必须是字符串。").uuid("sessionId 格式不正确。");
const npcIdSchema = z
  .string("npcId 必须是字符串。")
  .refine((value) => knownNpcIds.includes(value), "npcId 不是可交易的 NPC。");
const itemIdSchema = z.string("itemId 必须是字符串。").trim().min(1, "itemId 不能为空。").max(80, "itemId 过长。");
const quantitySchema = z
  .number("quantity 必须是数字。")
  .int("quantity 必须是整数。")
  .positive("quantity 必须大于 0。")
  .max(99, "quantity 过大。");
const qualitySchema = z.enum(["common", "fine", "perfect"]).optional();

const tradeSchema = z.object({
  sessionId: sessionIdSchema,
  npcId: npcIdSchema,
  itemId: itemIdSchema,
  quantity: quantitySchema,
  quality: qualitySchema
});

const shopParamsSchema = z.object({
  sessionId: sessionIdSchema,
  npcId: npcIdSchema
});

export function validateTradeBody(body: unknown): ValidationResult<TradeBody> {
  const parsed = tradeSchema.safeParse(body);

  if (!parsed.success) {
    return { ok: false, status: 400, message: parsed.error.issues[0]?.message ?? "请求体格式不正确。" };
  }

  return { ok: true, body: parsed.data };
}

export function validateShopParams(params: unknown): ValidationResult<ShopParams> {
  const parsed = shopParamsSchema.safeParse(params);

  if (!parsed.success) {
    return { ok: false, status: 400, message: parsed.error.issues[0]?.message ?? "请求参数不正确。" };
  }

  return { ok: true, body: parsed.data };
}
