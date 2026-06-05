import { expect, test } from "@playwright/test";
import { AdminPage } from "../pages/admin";
import { expectNoHorizontalScroll } from "./helpers";

// The desktop breakpoint for the admin filters (CSS pairs max-width:640 with
// min-width:641). Above it the filters are always visible; below it they sit
// inside a collapsible <details>.
const DESKTOP_MIN = 641;

function isDesktop(width: number): boolean {
  return width >= DESKTOP_MIN;
}

test.describe("responsive: admin filters", () => {
  test("filter fields match the viewport's disclosure behaviour", async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.goto();
    await admin.expectLoaded();

    const width = page.viewportSize()?.width ?? 1280;

    if (isDesktop(width)) {
      // Regression for the ::details-content desktop bug: filters must be
      // visible without interacting with the summary toggle.
      await expect(admin.statusFilter).toBeVisible();
      await expect(admin.speciesFilter).toBeVisible();
    } else {
      // On phones the panel is collapsed by default and opens on tap.
      await expect(admin.filtersSummary).toBeVisible();
      await expect(admin.statusFilter).toBeHidden();
      await admin.filtersSummary.click();
      await expect(admin.statusFilter).toBeVisible();
    }
  });
});

test.describe("responsive: admin tabs", () => {
  test("all section tabs are reachable without horizontal scrolling", async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.goto();
    await admin.expectLoaded();

    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(4);
    for (let index = 0; index < 4; index++) {
      await expect(tabs.nth(index)).toBeVisible();
    }

    const width = page.viewportSize()?.width ?? 1280;
    if (!isDesktop(width)) {
      // The tablist must lay out as a wrapped grid, not an off-screen scroll
      // strip — so it must not overflow horizontally.
      const overflow = await page
        .locator(".tabs")
        .evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    }
  });
});

test.describe("responsive: no horizontal overflow", () => {
  for (const path of ["/", "/admin"]) {
    test(`'${path}' does not scroll horizontally`, async ({ page }) => {
      await page.goto(path);
      // Let the route settle (loading -> content) before measuring.
      await page.waitForLoadState("networkidle");
      await expectNoHorizontalScroll(page);
    });
  }
});

test.describe("responsive: metrics navigation", () => {
  test("metrics shows the bottom nav on phones and the top nav on desktop", async ({ page }) => {
    await page.goto("/metrics");

    const width = page.viewportSize()?.width ?? 1280;
    const bottomNav = page.locator(".bottom-nav");
    const topNav = page.locator(".topbar .nav");

    if (isDesktop(width)) {
      await expect(topNav).toBeVisible();
      await expect(bottomNav).toBeHidden();
    } else {
      await expect(bottomNav).toBeVisible();
      await expect(topNav).toBeHidden();
      // The Metrics tab is marked active on the metrics page.
      await expect(page.locator(".bottom-nav a.active")).toHaveText(/Metrics/);
    }
  });
});
