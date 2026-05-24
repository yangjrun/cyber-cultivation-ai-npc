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

test("can generate a chronicle and see it on the 史册 page", async ({ page }) => {
  await page.goto("/");

  // Quick-start with default identity
  await expect(page.getByRole("heading", { name: "注入身份" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /用默认/ }).click();

  // Land on play
  await expect(page.getByRole("heading", { name: /黑市丹铺通信频道/ })).toBeVisible({
    timeout: 15_000
  });

  // Navigate to 史册
  await page.getByRole("link", { name: "史册" }).click();
  await expect(page.getByRole("heading", { name: "史册" })).toBeVisible({ timeout: 5_000 });

  // Initially placeholder
  await expect(page.getByText("史官还没为你写过任何回望。")).toBeVisible();

  // Click 回望本世
  await page.getByRole("button", { name: /回望本世/ }).click();

  // After generation, the placeholder disappears and a 回望 entry shows.
  await expect(page.getByText(/回望 #/).first()).toBeVisible({ timeout: 10_000 });
  // The mock chronicle contains the player's name 陆玄
  await expect(page.getByText(/陆玄/).first()).toBeVisible();
});

test("milestones panel on play page reflects unlocked progress", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "注入身份" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /用默认/ }).click();

  await expect(page.getByRole("heading", { name: /黑市丹铺通信频道/ })).toBeVisible({
    timeout: 15_000
  });

  // MilestonePanel renders the header "// milestones"
  await expect(page.getByText("// milestones")).toBeVisible({ timeout: 5_000 });
  // With no actions taken, the empty-state copy shows
  await expect(page.getByText(/还没刻下任何里程碑/)).toBeVisible();
});
