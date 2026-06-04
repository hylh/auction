import { afterAll, afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, sqlClient } from "../db/client";
import {
  adminActions,
  auctions,
  bids,
  fishItems,
  inventoryStatusChanges,
  sales,
  users,
} from "../db/schema";
import { DEMO_USERS } from "../domain/constants";
import { createAuction, createFishItem, placeBid } from "./auction-service";
import { runSimulation } from "./simulator-service";

const createdAuctionIds = new Set<string>();
const createdFishItemIds = new Set<string>();
const createdUserIds = new Set<string>();

describe("auction bidding integration", () => {
  afterEach(async () => {
    for (const auctionId of createdAuctionIds) {
      await db.delete(sales).where(eq(sales.auctionId, auctionId));
      await db.delete(bids).where(eq(bids.auctionId, auctionId));
      await db.delete(adminActions).where(eq(adminActions.auctionId, auctionId));
      await db
        .delete(inventoryStatusChanges)
        .where(eq(inventoryStatusChanges.auctionId, auctionId));
      await db.delete(auctions).where(eq(auctions.id, auctionId));
    }

    for (const fishItemId of createdFishItemIds) {
      await db.delete(adminActions).where(eq(adminActions.fishItemId, fishItemId));
      await db
        .delete(inventoryStatusChanges)
        .where(eq(inventoryStatusChanges.fishItemId, fishItemId));
      await db.delete(fishItems).where(eq(fishItems.id, fishItemId));
    }

    for (const userId of createdUserIds) {
      await db.delete(users).where(eq(users.id, userId));
    }

    createdAuctionIds.clear();
    createdFishItemIds.clear();
    createdUserIds.clear();
  });

  afterAll(async () => {
    await sqlClient.end();
  });

  it("rejects the losing stale bid when concurrent bids race on the auction row lock", async () => {
    const { adminId, sellerId, buyerOneId, buyerTwoId } = await createTestUsers();
    const fish = await createFishItem({
      species: "halibut",
      displayName: "Race test halibut",
      weightKilograms: 25,
      catchRegion: "Test coast",
      grade: "A",
      startingPriceMajor: 1000,
      sellerId,
      description: "",
      imageUrl: "",
    });
    createdFishItemIds.add(fish.id);

    const auction = await createAuction({
      fishItemId: fish.id,
      adminUserId: adminId,
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 60 * 60_000),
      minimumIncrementCents: 5_000,
    });
    createdAuctionIds.add(auction.id);

    const results = await Promise.all([
      placeBid({
        auctionId: auction.id,
        bidderId: buyerOneId,
        amountCents: 105_000,
        expectedHighestBidCents: null,
      }),
      placeBid({
        auctionId: auction.id,
        bidderId: buyerTwoId,
        amountCents: 106_000,
        expectedHighestBidCents: null,
      }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok && result.code === "STALE_BID")).toHaveLength(1);
  });

  it("does not wait for simulator bid intervals inside the server request", async () => {
    await ensureDemoUsers();

    const started = performance.now();
    const result = await runSimulation({
      auctionCount: 1,
      bidCount: 2,
      intervalMs: 10_000,
      durationMinutes: 30,
      rejectionRate: 0,
      seed: 30_001,
      buyerIds: undefined,
      auctionIds: undefined,
      closeAuctions: true,
    });
    const elapsedMs = performance.now() - started;

    for (const auction of result.createdAuctions) {
      createdAuctionIds.add(auction.id);
    }
    for (const fish of result.createdFish) {
      createdFishItemIds.add(fish.id);
    }

    expect(result.totals.acceptedBids).toBe(2);
    expect(result.totals.completedSales).toBe(1);
    expect(elapsedMs).toBeLessThan(5_000);
  });
});

async function ensureDemoUsers() {
  await db
    .insert(users)
    .values([
      {
        id: DEMO_USERS.sellerNorth,
        displayName: "Northern Nets AS",
        role: "seller",
      },
      {
        id: DEMO_USERS.sellerFjord,
        displayName: "Fjordline Catch Co",
        role: "seller",
      },
      {
        id: DEMO_USERS.buyerOslo,
        displayName: "Oslo Market Buyer",
        role: "buyer",
      },
      {
        id: DEMO_USERS.buyerBergen,
        displayName: "Bergen Seafood Buyer",
        role: "buyer",
      },
      {
        id: DEMO_USERS.admin,
        displayName: "Auction Admin",
        role: "admin",
      },
    ])
    .onConflictDoNothing();
}

async function createTestUsers() {
  const [seller, buyerOne, buyerTwo, admin] = await db
    .insert(users)
    .values([
      { displayName: "Race Test Seller", role: "seller" },
      { displayName: "Race Test Buyer One", role: "buyer" },
      { displayName: "Race Test Buyer Two", role: "buyer" },
      { displayName: "Race Test Admin", role: "admin" },
    ])
    .returning();

  for (const user of [seller, buyerOne, buyerTwo, admin]) {
    createdUserIds.add(user.id);
  }

  return {
    adminId: admin.id,
    sellerId: seller.id,
    buyerOneId: buyerOne.id,
    buyerTwoId: buyerTwo.id,
  };
}
