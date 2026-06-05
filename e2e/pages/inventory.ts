import { expect, type Locator, type Page } from "@playwright/test";

type FishItemInput = {
  displayName: string;
  weightKilograms: string;
  catchRegion: string;
  grade: string;
  startingPriceMajor: string;
  minimumIncrementMajor: string;
};

function toLocalInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export class InventoryPage {
  readonly page: Page;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.submitButton = page.getByRole("button", { name: /Add fish/i });
  }

  async goto() {
    await this.page.goto("/inventory/new");
  }

  async createActiveAuctionItem(input: FishItemInput) {
    await this.page.getByLabel("Display name").fill(input.displayName);
    await this.page.getByLabel("Weight (kg)").fill(input.weightKilograms);
    await this.page.getByLabel("Catch region").fill(input.catchRegion);
    await this.page.getByLabel("Freshness / grade").fill(input.grade);
    await this.page.getByLabel("Starting price (NOK)").fill(input.startingPriceMajor);

    const createAuction = this.page.getByLabel(
      "Create an auction from this inventory after listing it",
    );
    await createAuction.check();

    const now = new Date();
    const startsAt = new Date(now.getTime() - 5 * 60_000);
    const endsAt = new Date(now.getTime() + 25 * 60_000);
    await this.page.getByLabel("Starts at").fill(toLocalInputValue(startsAt));
    await this.page.getByLabel("Ends at").fill(toLocalInputValue(endsAt));
    await this.page.getByLabel("Minimum increment (NOK)").fill(input.minimumIncrementMajor);

    await this.submitButton.click();
  }

  async expectSuccessMessageContains(text: string) {
    await expect(this.page.getByText(text, { exact: false })).toBeVisible();
  }
}
