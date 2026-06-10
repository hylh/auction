import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildDefaultDataset, type SeedDataset } from "./factories";

const now = new Date("2026-06-09T12:00:00.000Z");
const admin = { id: "00000000-0000-4000-8000-000000000001", displayName: "Admin" };
const fixedSellers = [{ id: "00000000-0000-4000-8000-000000000002", displayName: "Seller A" }];
const fixedBuyers = [{ id: "00000000-0000-4000-8000-000000000003", displayName: "Buyer A" }];

function dataset(): SeedDataset {
  return buildDefaultDataset({
    seed: 20260609,
    sellerCount: 8,
    buyerCount: 9,
    auctionCount: 24,
    now,
    admin,
    fixedSellers,
    fixedBuyers,
  });
}

function groupBy<T>(values: Array<T>, keyFor: (value: T) => string): Map<string, Array<T>> {
  const groups = new Map<string, Array<T>>();
  for (const value of values) {
    const key = keyFor(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups;
}

function required<T>(value: T | null | undefined, label: string): T {
  expect(value, label).toBeDefined();
  if (value === null || value === undefined) {
    throw new Error(`${label} is required`);
  }
  return value;
}

describe("buildDefaultDataset", () => {
  it("builds deterministic fish auction demo data", () => {
    const result = dataset();

    expect(createHash("sha256").update(JSON.stringify(result)).digest("hex")).toBe(
      "0b9991faa90e04aa059de4316d69cee72eadf52353415c81118af2ef0c84ac3b",
    );
    expect({
      users: result.users.length,
      fish: result.fishItems.length,
      auctions: result.auctions.length,
      bids: result.bids.length,
      rejected: result.rejectedBids.length,
      sales: result.sales.length,
      changes: result.inventoryStatusChanges.length,
      actions: result.adminActions.length,
    }).toEqual({
      users: 18,
      fish: 46,
      auctions: 24,
      bids: 156,
      rejected: 32,
      sales: 10,
      changes: 61,
      actions: 31,
    });
  });

  it("keeps accepted bids ordered, valid, and clear of seller self-bids", () => {
    const result = dataset();
    const fishById = new Map(result.fishItems.map((fish) => [fish.id, fish]));
    const bidsByAuction = groupBy(result.bids, (bid) => required(bid.auctionId, "bid auction id"));

    for (const auction of result.auctions) {
      const auctionId = required(auction.id, "auction id");
      const startsAt = required(auction.startsAt, `${auctionId} starts at`);
      const endsAt = required(auction.endsAt, `${auctionId} ends at`);
      const fish = required(
        fishById.get(required(auction.fishItemId, `${auctionId} fish item id`)),
        `${auctionId} fish`,
      );

      const auctionBids = bidsByAuction.get(auctionId) ?? [];
      if (auction.status === "active" || auction.status === "closed") {
        expect(auctionBids.length, auctionId).toBeGreaterThan(0);
      } else {
        expect(auctionBids, auctionId).toHaveLength(0);
      }

      let previousAmount: number | null = null;
      for (const bid of auctionBids) {
        const bidId = required(bid.id, "bid id");
        const acceptedAt = required(bid.acceptedAt, `${bidId} accepted at`);
        expect(bid.bidderId, bidId).not.toBe(fish.sellerId);
        expect(acceptedAt.getTime(), bidId).toBeGreaterThan(startsAt.getTime());
        expect(acceptedAt.getTime(), bidId).toBeLessThan((auction.closedAt ?? endsAt).getTime());

        const expectedFloor =
          previousAmount === null
            ? fish.startingPriceCents
            : previousAmount + auction.minimumIncrementCents;
        expect(bid.amountCents, bidId).toBeGreaterThanOrEqual(expectedFloor ?? 0);
        previousAmount = bid.amountCents;
      }
    }
  });

  it("links completed sales to the winning bid and sold inventory transition", () => {
    const result = dataset();
    const auctionsById = new Map(result.auctions.map((auction) => [auction.id, auction]));
    const fishById = new Map(result.fishItems.map((fish) => [fish.id, fish]));
    const bidsById = new Map(result.bids.map((bid) => [bid.id, bid]));

    for (const sale of result.sales) {
      const auction = auctionsById.get(sale.auctionId);
      const fish = fishById.get(sale.fishItemId);
      const winningBid = bidsById.get(sale.winningBidId);
      const soldChange = result.inventoryStatusChanges.find(
        (change) =>
          change.auctionId === sale.auctionId &&
          change.fishItemId === sale.fishItemId &&
          change.fromStatus === "in_auction" &&
          change.toStatus === "sold",
      );

      expect(auction?.status, sale.id).toBe("closed");
      expect(fish?.status, sale.id).toBe("sold");
      expect(winningBid?.auctionId, sale.id).toBe(sale.auctionId);
      expect(winningBid?.bidderId, sale.id).toBe(sale.buyerId);
      expect(winningBid?.amountCents, sale.id).toBe(sale.amountCents);
      expect(sale.sellerId, sale.id).toBe(fish?.sellerId);
      expect(soldChange, sale.id).toBeDefined();
    }
  });

  it("adds standalone listed, draft, and withdrawn inventory history", () => {
    const result = dataset();
    const standaloneChanges = result.inventoryStatusChanges.filter(
      (change) => change.auctionId === null,
    );
    const changesByStatus = groupBy(standaloneChanges, (change) => change.toStatus);

    expect(changesByStatus.get("listed")).toHaveLength(12);
    expect(changesByStatus.get("draft")).toHaveLength(6);
    expect(changesByStatus.get("withdrawn")).toHaveLength(4);
    expect(
      changesByStatus.get("withdrawn")?.every((change) => change.fromStatus === "listed"),
    ).toBe(true);
  });
});
