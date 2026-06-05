import { expect, test } from "@playwright/test";
import { AuctionPage } from "../pages/auction";
import { DashboardPage } from "../pages/dashboard";
import { InventoryPage } from "../pages/inventory";

test.describe("dashboard", () => {
  test("shows core live sections and opens auction details from dashboard link", async ({
    page,
  }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.createActiveAuctionItem({
      displayName: `E2E dashboard salmon ${Date.now()}`,
      weightKilograms: "44.2",
      catchRegion: "Lofoten",
      grade: "A",
      startingPriceMajor: "2100",
      minimumIncrementMajor: "100",
    });
    await inventory.expectSuccessMessageContains("was listed and active auction");

    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.expectCoreSectionsVisible();

    const auctionLink = dashboard.firstAuctionLink();
    await expect(auctionLink).toBeVisible();
    await auctionLink.click();

    await expect(page).toHaveURL(/\/auctions\/[0-9a-f-]+$/i);
    await expect(new AuctionPage(page).placeBidHeading).toBeVisible();
    await expect(new AuctionPage(page).bidChainHeading).toBeVisible();
  });
});
