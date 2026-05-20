import { z } from "zod";

type ValidationResult<T> =
  | { ok: true; body: T }
  | { ok: false; status: number; message: string };

export type RefineBody = {
  sessionId: string;
  recipeId: string;
  materials: Array<{ itemId: string; quantity: number }>;
  fireLevel: number;
};

export type UseItemBody = {
  sessionId: string;
  itemId: string;
};

const sessionIdSchema = z.string("sessionId 必须是字符串。").uuid("sessionId 格式不正确。");
const itemIdSchema = z.string("itemId 必须是字符串。").trim().min(1, "itemId 不能为空。").max(80, "itemId 过长。");

const materialSchema = z.object({
  itemId: itemIdSchema,
  quantity: z.number("quantity 必须是数字。").int("quantity 必须是整数。").positive("quantity 必须大于 0。").max(99, "quantity 过大。")
});

const refineSchema = z.object({
  sessionId: sessionIdSchema,
  recipeId: z.string("recipeId 必须是字符串。").trim().min(1, "recipeId 不能为空。").max(80, "recipeId 过长。"),
  materials: z.array(materialSchema).max(8, "材料种类过多。").default([]),
  fireLevel: z.number("fireLevel 必须是数字。").int("fireLevel 必须是整数。").min(0, "fireLevel 不能小于 0。").max(100, "fireLevel 不能超过 100。")
});

const useItemSchema = z.object({
  sessionId: sessionIdSchema,
  itemId: itemIdSchema
});

export function validateRefineBody(body: unknown): ValidationResult<RefineBody> {
  const parsed = refineSchema.safeParse(body);

  if (!parsed.success) {
    return { ok: false, status: 400, message: parsed.error.issues[0]?.message ?? "请求体格式不正确。" };
  }

  return { ok: true, body: parsed.data };
}

export function validateUseItemBody(body: unknown): ValidationResult<UseItemBody> {
  const parsed = useItemSchema.safeParse(body);

  if (!parsed.success) {
    return { ok: false, status: 400, message: parsed.error.issues[0]?.message ?? "请求体格式不正确。" };
  }

  return { ok: true, body: parsed.data };
}
