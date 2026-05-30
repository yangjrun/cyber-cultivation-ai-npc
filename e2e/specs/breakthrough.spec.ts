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

  // CultivationPanel: three default meditation clicks should fill the qi cap.
  const breakthroughButton = page.getByRole("button", { name: /尝试突破/ });

  // Breakthrough starts disabled
  await expect(breakthroughButton).toBeDisabled();

  // Click cultivate 3 times (waits for each request between clicks). On the
  // final click the button intentionally changes to "灵气已满" instead of coming
  // back as "打坐 30 秒".
  for (let i = 0; i < 3; i += 1) {
    const cultivateButton = page.getByRole("button", { name: /打坐 30 秒/ });
    await cultivateButton.click();

    if (i < 2) {
      await expect(cultivateButton).toBeEnabled({ timeout: 5_000 });
    }
  }

  await expect(page.getByRole("button", { name: /灵气已满/ })).toBeDisabled({ timeout: 5_000 });

  // Now breakthrough should be enabled
  await expect(breakthroughButton).toBeEnabled({ timeout: 5_000 });
  await breakthroughButton.click();

  // After breakthrough, a breakthrough result message renders. Could be success or failure
  // (RNG involved server-side), but the message text should appear.
  await expect(page.getByText(/突破结果/)).toBeVisible({ timeout: 5_000 });
});
