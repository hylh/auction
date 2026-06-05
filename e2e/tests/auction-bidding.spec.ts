import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

type SimulateResponse = {
  createdAuctions: Array<{
    id: string;
    seller: { id: string };
    fish: { startingPriceCents: number };
    minimumIncrementCents: number;
    currentHighestBid: { amountCents: number } | null;
  }>;
};

const BUYER_LABEL = "Oslo Market Buyer";

const moneyFromCents = (cents: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "NOK" }).format(cents / 100);

async function simulate(page: Page, data: Record<string, unknown>) {
  return page.evaluate(async (payload) => {
    const response = await fetch("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    return { ok: response.ok, body };
  }, data);
}

async function createActiveAuction(page: Page, seedOffset: number) {
  const response = await simulate(page, {
    auctionCount: 1,
    bidCount: 0,
    closeAuctions: false,
    rejectionRate: 0,
    seed: 9_000 + seedOffset,
  });
  expect(response.ok).toBeTruthy();
  const body = response.body as SimulateResponse;
  expect(body.createdAuctions.length).toBe(1);
  return body.createdAuctions[0];
}

async function closeAuction(page: Page, auctionId: string) {
  const response = await simulate(page, {
    auctionCount: 0,
    bidCount: 0,
    closeAuctions: true,
    auctionIds: [auctionId],
    rejectionRate: 0,
    seed: 42,
  });
  expect(response.ok).toBeTruthy();
}

async function openAuction(page: Page, auctionId: string) {
  await page.goto(`/auctions/${auctionId}`);
  await expect(page.getByRole("heading", { name: "Place bid" })).toBeVisible();
}

async function submitBid(page: Page, bidder: string, amountMajor: string) {
  await page.getByLabel("Demo buyer").selectOption({ label: bidder });
  await page.getByLabel("Bid amount (NOK)").fill(amountMajor);
  await page.getByRole("button", { name: "Submit bid" }).click();
}

test("navigate to active auction and accept valid higher bid", async ({ page }) => {
  await page.goto("/");
  const auction = await createActiveAuction(page, 1);
  const nextMinimumCents =
    auction.currentHighestBid === null
      ? auction.fish.startingPriceCents
      : auction.currentHighestBid.amountCents + auction.minimumIncrementCents;
  const bidMajor = String(nextMinimumCents / 100);

  await openAuction(page, auction.id);
  await submitBid(page, BUYER_LABEL, bidMajor);

  await expect(page.getByText("Bid accepted and broadcast to listeners.")).toBeVisible();
  await expect(page.locator(".bid-bar-card .metric")).toContainText(moneyFromCents(nextMinimumCents));
  await expect(page.locator(".bid-chain-list .row").first()).toContainText(BUYER_LABEL);
});

test("reject insufficient increment bid", async ({ page }) => {
  await page.goto("/");
  const auction = await createActiveAuction(page, 2);
  const nextMinimumCents =
    auction.currentHighestBid === null
      ? auction.fish.startingPriceCents
      : auction.currentHighestBid.amountCents + auction.minimumIncrementCents;
  const tooLowMajor = String(Math.max(1, Math.floor(nextMinimumCents / 100) - 1));

  await openAuction(page, auction.id);
  await submitBid(page, BUYER_LABEL, tooLowMajor);

  await expect(page.getByText(/Bid must be at least \d+ cents/i)).toBeVisible();
});

test("reject seller bidding on own auction", async ({ page }) => {
  await page.goto("/");
  const auction = await createActiveAuction(page, 3);
  const nextMinimumCents =
    auction.currentHighestBid === null
      ? auction.fish.startingPriceCents
      : auction.currentHighestBid.amountCents + auction.minimumIncrementCents;

  await openAuction(page, auction.id);
  await page.getByLabel("Demo buyer").evaluate((node, sellerId) => {
    const select = node as HTMLSelectElement;
    const option = document.createElement("option");
    option.value = sellerId;
    option.textContent = "Synthetic Seller Option";
    select.appendChild(option);
    select.value = sellerId;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, auction.seller.id);
  await page.getByLabel("Bid amount (NOK)").fill(String(nextMinimumCents / 100));
  await page.getByRole("button", { name: "Submit bid" }).click();

  await expect(page.getByText("Sellers cannot bid on their own fish")).toBeVisible();
});

test("reject bid when auction is closed", async ({ page }) => {
  await page.goto("/");
  const auction = await createActiveAuction(page, 4);
  await closeAuction(page, auction.id);

  await openAuction(page, auction.id);
  await submitBid(page, BUYER_LABEL, String(auction.fish.startingPriceCents / 100));

  await expect(page.getByText("Only active auctions accept bids")).toBeVisible();
});
