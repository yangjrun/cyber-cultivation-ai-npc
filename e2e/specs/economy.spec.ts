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

async function bootstrapSession(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "注入身份" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /用默认/ }).click();
  await expect(page.getByRole("heading", { name: /黑市丹铺通信频道/ })).toBeVisible({ timeout: 15_000 });
}

test("gathering flow: cultivate qi, open panel, then gather", async ({ page }) => {
  await bootstrapSession(page);

  // New players start with 0 qi; gathering costs qi, so meditate first to bank some.
  await page.getByRole("button", { name: /打坐 30 秒/ }).click();
  // Wait for qi to rise (cultivation result confirms the qi gain settled)
  await expect(page.getByTestId("cultivation-result")).toBeVisible({ timeout: 10_000 });

  // Open the gathering modal from the inventory panel
  await page.getByRole("button", { name: "采集", exact: true }).click();

  // The gathering dialog should appear with the black_market gathering point
  const dialog = page.getByRole("dialog", { name: "采集" });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByText("废弃药摊", { exact: true })).toBeVisible({ timeout: 5_000 });

  // With qi banked, the gather button should be enabled (text "采集", not "灵气不足")
  const gatherButton = dialog.getByRole("button", { name: "采集", exact: true });
  await expect(gatherButton).toBeEnabled({ timeout: 5_000 });
  await gatherButton.click();

  // A result message should appear (success or failure, both are valid outcomes)
  await expect(dialog.getByTestId("gathering-result")).toBeVisible({ timeout: 10_000 });
});

test("alchemy flow: open furnace and refine a pill", async ({ page }) => {
  await bootstrapSession(page);

  // Open the alchemy modal from the inventory panel
  await page.getByRole("button", { name: "炼丹", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "炼丹炉" });
  await expect(dialog).toBeVisible({ timeout: 10_000 });

  // Refine with the default recipe (starter inventory has materials for one cloud_veil_pill)
  await dialog.getByRole("button", { name: /开炉炼制/ }).click();

  // A result should appear in the modal
  await expect(dialog.getByTestId("alchemy-result")).toBeVisible({ timeout: 10_000 });
});
