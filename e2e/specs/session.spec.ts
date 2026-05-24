import { test, expect } from "@playwright/test";

// Each spec starts from a clean slate. The store persists sessionId in
// localStorage; we wipe it before navigating to force a fresh session.
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await context.addInitScript(() => {
    try {
      window.localStorage.clear();
    } catch {
      /* hardened contexts */
    }
  });
});

test("character creator → session bootstraps and lands on the play page with white-jade NPC visible", async ({ page }) => {
  await page.goto("/");

  // First visit lands on CharacterCreator. Click "用默认" for the bootstrap flow.
  await expect(page.getByRole("heading", { name: "注入身份" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /用默认/ }).click();

  // After submit, the dialogue panel header should render.
  await expect(page.getByRole("heading", { name: /黑市丹铺通信频道/ })).toBeVisible({
    timeout: 15_000
  });

  // PlayerPanel sessionId becomes truthy → indicator flips from syncing to online.
  await expect(page.getByText("online", { exact: true })).toBeVisible({ timeout: 10_000 });

  // localStorage now holds the sessionId
  const stored = await page.evaluate(() => window.localStorage.getItem("cyber-cultivation.sessionId"));
  expect(stored).toMatch(/^[0-9a-f-]{36}$/i);

  // NPC list shows 白璃 in the active scene (黑市)
  await expect(page.getByRole("button", { name: /白璃.*T\d+.*A\d+/ })).toBeVisible();
});
