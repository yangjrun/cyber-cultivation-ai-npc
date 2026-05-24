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

test("cultivate three times then breakthrough lifts the cultivation stage", async ({ page }) => {
  await page.goto("/");

  // Skip past the character creator using quick-start.
  await expect(page.getByRole("heading", { name: "注入身份" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /用默认/ }).click();

  await expect(page.getByRole("heading", { name: /黑市丹铺通信频道/ })).toBeVisible({
    timeout: 15_000
  });
  await expect(page.getByText("online", { exact: true })).toBeVisible({ timeout: 10_000 });

  // CultivationPanel: 打坐 30 秒 button. baseQiPerSecond=1.2 → +36 qi per click.
  // qiCap=100 by default → 3 clicks brings qi to >=100.
  const cultivateButton = page.getByRole("button", { name: /打坐 30 秒/ });
  const breakthroughButton = page.getByRole("button", { name: /尝试突破/ });

  // Breakthrough starts disabled
  await expect(breakthroughButton).toBeDisabled();

  // Click cultivate 3 times (waits for the request between clicks)
  for (let i = 0; i < 3; i += 1) {
    await cultivateButton.click();
    // Wait for it to come back from cultivating state
    await expect(cultivateButton).toBeEnabled({ timeout: 5_000 });
  }

  // Now breakthrough should be enabled
  await expect(breakthroughButton).toBeEnabled({ timeout: 5_000 });
  await breakthroughButton.click();

  // After breakthrough, a breakthrough result message renders. Could be success or failure
  // (RNG involved server-side), but the message text should appear.
  await expect(page.getByText(/突破结果/)).toBeVisible({ timeout: 5_000 });
});
