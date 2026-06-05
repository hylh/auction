import { expect, test } from "@playwright/test";
import { InventoryPage } from "../pages/inventory";
import { uniqueFishName } from "./helpers";

test.describe("inventory form", () => {
  test("submits a valid fish item successfully", async ({ page }, testInfo) => {
    const fishName = uniqueFishName("E2E inventory cod", testInfo);
    const inventory = new InventoryPage(page);
    await inventory.goto();

    await inventory.createActiveAuctionItem({
      displayName: fishName,
      weightKilograms: "31.8",
      catchRegion: "Bergen",
      grade: "A",
      startingPriceMajor: "1800",
      minimumIncrementMajor: "75",
    });

    await inventory.expectSuccessMessageContains("was listed and active auction");
  });

  test("shows validation errors for missing fields and invalid weight", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();

    await page.getByLabel("Display name").fill("");
    await page.getByLabel("Weight (kg)").fill("-1");
    await page.getByLabel("Catch region").fill("");
    await page.getByLabel("Freshness / grade").fill("");
    await page.getByLabel("Starting price (NOK)").fill("");
    await page.getByRole("combobox", { name: "Seller" }).selectOption("");
    await inventory.submitButton.click();

    await expect(page.getByText("Fix the highlighted fields before adding inventory.")).toBeVisible();
    await expect(page.locator(".field-error").first()).toBeVisible();
    await expect(page.getByText("was listed", { exact: false })).not.toBeVisible();
  });
});
