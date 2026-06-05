import { test } from "@playwright/test";
import { AdminPage } from "../pages/admin";

test.describe("admin dashboard", () => {
  test("loads admin dashboard with key history and stats sections", async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.goto();
    await admin.expectLoaded();
    await admin.expectCoreHistoryAndStatsSections();
  });
});
