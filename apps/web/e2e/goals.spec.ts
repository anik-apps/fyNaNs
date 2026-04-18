import { test, expect } from "@playwright/test";
import { createAuthenticatedUser } from "./helpers";

// The test above uses one authenticated user + runs all scenarios sequentially
// to stay under the API's 5-login/minute rate limit. Don't split into multiple
// tests with separate `createAuthenticatedUser` calls.

test.describe("Savings Goals", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __FYNANS_E2E: boolean }).__FYNANS_E2E = true;
    });
  });

  test("full flow: empty → create → contribute → archive → completion", async ({
    page,
  }) => {
    await createAuthenticatedUser(page);

    // 1. Empty state on fresh user
    await page.goto("/goals");
    await expect(
      page.getByRole("heading", { name: "Savings Goals" })
    ).toBeVisible();
    await expect(page.getByText("No goals yet")).toBeVisible();
    await expect(
      page.getByText(/Create your first savings goal/i)
    ).toBeVisible();

    // 2. Create a goal
    await page.getByRole("button", { name: /new goal/i }).click();
    await page.getByLabel("Name").fill("E2E Trip");
    await page.getByLabel("Target amount").fill("1000");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("E2E Trip")).toBeVisible();

    // 3. Detail page + add contribution
    await page.getByText("E2E Trip").click();
    await expect(page.getByText(/of \$1000/)).toBeVisible();
    await page.getByPlaceholder("Amount").fill("250");
    await page.getByRole("button", { name: "Add" }).click();
    // $250.00 appears in both the header amount and the contribution row;
    // use .first() to resolve the strict-mode ambiguity.
    await expect(page.getByText("$250.00").first()).toBeVisible();
    await expect(
      page.getByRole("listitem").filter({ hasText: "$250.00" })
    ).toBeVisible();

    // 4. Archive this goal, verify it moves to the Archived section
    await page.getByRole("button", { name: "Archive" }).click();
    await page.goto("/goals");
    await expect(page.getByText(/Archived \(1\)/)).toBeVisible();
    await page.getByText(/Archived \(1\)/).click();
    await expect(page.getByText("E2E Trip")).toBeVisible();

    // 5. Completion flow — create a new goal and tip it over the target.
    //    Relies on the instant-completion behavior from PR #56 (merge that
    //    first, or this step will fail because the goal stays "active"
    //    until the nightly job).
    await page.getByRole("button", { name: /new goal/i }).click();
    await page.getByLabel("Name").fill("Quick Win");
    await page.getByLabel("Target amount").fill("100");
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByText("Quick Win").click();
    await page.getByPlaceholder("Amount").fill("100");
    await page.getByRole("button", { name: "Add" }).click();

    await expect(
      page.getByRole("button", { name: "Acknowledge" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Acknowledge" }).click();
    await expect(
      page.getByRole("button", { name: "Acknowledge" })
    ).toHaveCount(0);
  });
});
