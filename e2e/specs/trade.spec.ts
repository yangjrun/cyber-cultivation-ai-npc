import { test, expect } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try {
      window.localStorage.clear();
    } catch {
      /* hardened contexts */
    }
  });
});

test("send a trade message to baili and receive an NPC reply with intent badge", async ({ page }) => {
  await page.goto("/");

  // Skip past the character creator using quick-start.
  await expect(page.getByRole("heading", { name: "注入身份" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /用默认/ }).click();

  // Wait for session bootstrap
  await expect(page.getByRole("heading", { name: /黑市丹铺通信频道/ })).toBeVisible({
    timeout: 15_000
  });
  await expect(page.getByText("online", { exact: true })).toBeVisible({ timeout: 10_000 });

  // Type into the textarea directly + press Enter to send (more deterministic
  // than clicking a quick-prompt then chasing the send button's enabled state).
  const textarea = page.getByRole("textbox");
  await textarea.fill("我想买点丹药。");
  await textarea.press("Enter");

  // The quick-prompt button also carries this text via aria-label, so target
  // the chat bubble's <p> specifically.
  await expect(page.locator('p:has-text("我想买点丹药。")')).toBeVisible({ timeout: 10_000 });

  // baili's mock matches "丹药" first → give_quest branch. Both dialogue and
  // intent are deterministic.
  await expect(page.getByText("能做，但你得先偷一枚监察密钥。")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/intent:\s*give_quest/).first()).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText(/intent=give_quest 已校验/)).toBeVisible({ timeout: 5_000 });
});
