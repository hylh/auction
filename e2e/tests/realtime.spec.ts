import { expect, test } from "@playwright/test";

type SimulateResponse = {
  createdAuctions: Array<{
    id: string;
    fish: { startingPriceCents: number };
  }>;
};

const BUYER_LABEL = "Oslo Market Buyer";

const moneyFromCents = (cents: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "NOK" }).format(cents / 100);

test("updates second viewer via SSE after first viewer places bid", async ({ browser, baseURL }) => {
  const bootstrap = await browser.newContext({ baseURL });
  const bootstrapPage = await bootstrap.newPage();
  await bootstrapPage.goto("/");
  const setup = (await bootstrapPage.evaluate(async () => {
    const response = await fetch("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auctionCount: 1,
        bidCount: 0,
        closeAuctions: false,
        rejectionRate: 0,
        seed: 9_999,
      }),
    });
    return { ok: response.ok, body: await response.json() };
  })) as { ok: boolean; body: SimulateResponse };
  expect(setup.ok).toBeTruthy();
  const auction = setup.body.createdAuctions[0];
  await bootstrap.close();
  const bidCents = auction.fish.startingPriceCents;

  const contextA = await browser.newContext({ baseURL });
  const contextB = await browser.newContext({ baseURL });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await Promise.all([pageA.goto(`/auctions/${auction.id}`), pageB.goto(`/auctions/${auction.id}`)]);
  await Promise.all([
    expect(pageA.getByRole("heading", { name: "Place bid" })).toBeVisible(),
    expect(pageB.getByRole("heading", { name: "Place bid" })).toBeVisible(),
  ]);

  const bidsBeforeB = await pageB.locator(".bid-chain-list .row").count();

  const bidInput = pageA.getByLabel("Bid amount (NOK)");
  const nextBidMajor = await bidInput.getAttribute("placeholder");
  expect(nextBidMajor).toBeTruthy();

  await pageA.getByLabel("Demo buyer").selectOption({ label: BUYER_LABEL });
  await bidInput.fill(nextBidMajor ?? String(bidCents / 100));
  await pageA.getByRole("button", { name: "Submit bid" }).click();
  await expect(pageA.getByText("Bid accepted and broadcast to listeners.")).toBeVisible({ timeout: 10_000 });

  await expect.poll(async () => pageB.locator(".bid-chain-list .row").count()).toBeGreaterThan(bidsBeforeB);
  await expect(pageB.locator(".bid-chain-list .row").first()).toContainText(BUYER_LABEL);
  await expect(pageB.locator(".bid-bar-card .metric")).toContainText(moneyFromCents(bidCents));

  await Promise.all([contextA.close(), contextB.close()]);
});
