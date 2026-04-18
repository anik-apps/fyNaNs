import { test, expect } from "@playwright/test";
import { createAuthenticatedUser } from "./helpers";

test.describe("Savings Goals", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __FYNANS_E2E: boolean }).__FYNANS_E2E = true;
    });
    await createAuthenticatedUser(page);
  });

  test("create + add contribution", async ({ page }) => {
    await page.goto("/goals");
    await expect(page.getByRole("heading", { name: "Savings Goals" })).toBeVisible();

    await page.getByRole("button", { name: /new goal/i }).click();
    await page.getByLabel("Name").fill("E2E Trip");
    await page.getByLabel("Target amount").fill("1000");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("E2E Trip")).toBeVisible();
    await page.getByText("E2E Trip").click();

    await expect(page.getByText(/of \$1000/)).toBeVisible();
    await page.getByPlaceholder("Amount").fill("250");
    await page.getByRole("button", { name: "Add" }).click();

    await expect(page.getByText("$250.00")).toBeVisible();
  });
});
