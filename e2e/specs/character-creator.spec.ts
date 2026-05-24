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

test("character creator submits with custom name + trait and propagates to NPC profile", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "注入身份" })).toBeVisible({ timeout: 10_000 });

  // Set custom name
  const nameInput = page.getByRole("textbox");
  await nameInput.fill("夜辰");

  // Pick the 雷罚残痕 trait
  await page.getByRole("button", { name: /雷罚残痕/ }).click();
  await expect(page.getByRole("button", { name: /雷罚残痕/ })).toHaveAttribute("aria-pressed", "true");

  // Submit
  await page.getByRole("button", { name: /进入九龙下城/ }).click();

  // Lands on play; player name flows through to NPC profile target line
  await expect(page.getByRole("heading", { name: /黑市丹铺通信频道/ })).toBeVisible({
    timeout: 15_000
  });
  // PlayerPanel heading shows the chosen name (it's an <h2>)
  await expect(page.getByRole("heading", { name: "夜辰" })).toBeVisible({ timeout: 5_000 });
  // NpcProfilePanel "目标:" line now picks up the chosen name + trait combo
  await expect(page.getByText(/玩家夜辰/)).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText(/雷罚残痕/).first()).toBeVisible({ timeout: 5_000 });
});

test("quick-start preserves the default 陆玄 identity", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "注入身份" })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: /用默认/ }).click();

  await expect(page.getByRole("heading", { name: /黑市丹铺通信频道/ })).toBeVisible({
    timeout: 15_000
  });
  await expect(page.getByRole("heading", { name: "陆玄" })).toBeVisible({ timeout: 5_000 });
});
