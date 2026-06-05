import { expect, type Locator, type Page } from "@playwright/test";

export class AdminPage {
  readonly page: Page;
  readonly title: Locator;
  readonly inventoryTab: Locator;
  readonly salesTab: Locator;
  readonly listedInventoryHeading: Locator;
  readonly auctionsHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.getByRole("heading", { level: 1, name: "Admin auction history." });
    this.inventoryTab = page.getByRole("tab", { name: /Inventory & auctions/i });
    this.salesTab = page.getByRole("tab", { name: /Sales & bids/i });
    this.listedInventoryHeading = page.getByRole("heading", { name: "Listed inventory" });
    this.auctionsHeading = page.getByRole("heading", { name: "Auctions" });
  }

  async goto() {
    await this.page.goto("/admin");
  }

  async expectLoaded() {
    await expect(this.title).toBeVisible();
    await expect(this.inventoryTab).toBeVisible();
    await expect(this.salesTab).toBeVisible();
  }

  async expectCoreHistoryAndStatsSections() {
    await expect(this.page.getByText("Total sales")).toBeVisible();
    await expect(this.page.getByText("Average bid")).toBeVisible();
    await expect(this.page.getByRole("heading", { name: "Popular fish by bids" })).toBeVisible();
    await expect(this.listedInventoryHeading).toBeVisible();
    await expect(this.auctionsHeading).toBeVisible();
  }
}
