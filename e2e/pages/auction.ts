import { expect, type Locator, type Page } from "@playwright/test";

export class AuctionPage {
  readonly page: Page;
  readonly placeBidHeading: Locator;
  readonly bidChainHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.placeBidHeading = page.getByRole("heading", { name: "Place bid" });
    this.bidChainHeading = page.getByRole("heading", { name: "Live bid chain" });
  }

  async expectLoaded(displayName: string) {
    await expect(this.page.getByRole("heading", { level: 1, name: displayName })).toBeVisible();
    await expect(this.placeBidHeading).toBeVisible();
    await expect(this.bidChainHeading).toBeVisible();
  }
}
