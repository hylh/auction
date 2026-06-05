import { expect, type Locator, type Page } from "@playwright/test";

export class DashboardPage {
  readonly page: Page;
  readonly activeAuctionsHeading: Locator;
  readonly latestBidsHeading: Locator;
  readonly recentSalesHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.activeAuctionsHeading = page.getByRole("heading", { name: "Active auctions" });
    this.latestBidsHeading = page.getByRole("heading", { name: "Latest accepted bids" });
    this.recentSalesHeading = page.getByRole("heading", { name: "Recent sales" });
  }

  async goto() {
    await this.page.goto("/");
  }

  auctionLink(displayName: string) {
    return this.page.getByRole("link", { name: displayName });
  }

  firstAuctionLink() {
    return this.activeAuctionsHeading
      .locator("xpath=ancestor::article[1]")
      .getByRole("link")
      .first();
  }

  async expectCoreSectionsVisible() {
    await expect(this.activeAuctionsHeading).toBeVisible();
    await expect(this.latestBidsHeading).toBeVisible();
    await expect(this.recentSalesHeading).toBeVisible();
  }
}
