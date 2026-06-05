import { afterAll, afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, sqlClient } from "../db/client";
import {
  adminActions,
  auctions,
  bids,
  fishItems,
  inventoryStatusChanges,
  rejectedBids,
  sales,
  users,
} from "../db/schema";
import { DEMO_USERS } from "../domain/constants";
import { resetAuctionEventBus, subscribeToAuction, type AuctionEvent } from "../domain/events";
import {
  closeAuction,
  createAuction,
  createFishItem,
  getAdminData,
  getBidSubmissionContext,
  placeBid,
  withdrawAuction,
  withdrawFishItem,
} from "./auction-service";
import { runSimulation } from "./simulator-service";

const createdAuctionIds = new Set<string>();
const createdFishItemIds = new Set<string>();
const createdUserIds = new Set<string>();

describe("auction bidding integration", () => {
  afterEach(async () => {
    resetAuctionEventBus();

    for (const auctionId of createdAuctionIds) {
      await db.delete(sales).where(eq(sales.auctionId, auctionId));
      await db.delete(rejectedBids).where(eq(rejectedBids.auctionId, auctionId));
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
    const { auction, buyerOneId, buyerTwoId } = await createActiveTestAuction(
      "Race test halibut",
      "halibut",
    );

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

  it("publishes accepted bids after they are persisted", async () => {
    const { auction, buyerOneId } = await createActiveTestAuction("Evented cod lot");
    const events: Array<AuctionEvent> = [];
    const unsubscribe = subscribeToAuction(auction.id, (event) => events.push(event));

    const result = await placeBid({
      auctionId: auction.id,
      bidderId: buyerOneId,
      amountCents: 105_000,
      expectedHighestBidCents: null,
    });

    unsubscribe();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected accepted bid");
    }

    const persistedBid = await db.query.bids.findFirst({
      where: eq(bids.id, result.event.bid.bidId),
    });

    expect(persistedBid).toBeDefined();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "bid.accepted",
      auctionId: auction.id,
      bid: {
        bidId: result.event.bid.bidId,
      },
    });
  });

  it("rejects seller bids through the command interface and only notifies the acting subscriber", async () => {
    const { auction, sellerId, buyerOneId } =
      await createActiveTestAuction("Seller rejection trout");
    const sellerEvents: Array<AuctionEvent> = [];
    const buyerEvents: Array<AuctionEvent> = [];
    const unsubscribeSeller = subscribeToAuction(auction.id, (event) => sellerEvents.push(event), {
      userId: sellerId,
    });
    const unsubscribeBuyer = subscribeToAuction(auction.id, (event) => buyerEvents.push(event), {
      userId: buyerOneId,
    });

    const result = await placeBid({
      auctionId: auction.id,
      bidderId: sellerId,
      amountCents: 105_000,
      expectedHighestBidCents: null,
    });

    unsubscribeSeller();
    unsubscribeBuyer();

    expect(result).toMatchObject({
      ok: false,
      code: "SELLER_OWN_AUCTION",
    });
    expect(sellerEvents).toHaveLength(1);
    expect(sellerEvents[0]).toMatchObject({
      type: "bid.rejected",
      auctionId: auction.id,
    });
    expect(buyerEvents).toEqual([]);
  });

  it("closes an auction with a winning bid into a completed sale and broadcasts close events", async () => {
    const { auction, buyerOneId, adminId } = await createActiveTestAuction("Completed sale tuna");

    const bidResult = await placeBid({
      auctionId: auction.id,
      bidderId: buyerOneId,
      amountCents: 125_000,
      expectedHighestBidCents: null,
    });
    expect(bidResult.ok).toBe(true);

    const { closeResult, events, fish, sale } = await closeAuctionAndLoadState(
      auction.id,
      auction.fish.id,
      adminId,
    );

    expect(closeResult).toMatchObject({
      changed: true,
      status: "closed",
    });
    expect(closeResult.saleEvent).toMatchObject({
      type: "sale.completed",
      auctionId: auction.id,
      amountCents: 125_000,
    });
    expect(sale?.amountCents).toBe(125_000);
    expect(fish?.status).toBe("sold");
    expect(events.map((event) => event.type)).toEqual(["auction.closed", "sale.completed"]);

    const soldAdminData = await getAdminData({
      status: "sold",
      buyerId: buyerOneId,
    });

    expect(
      soldAdminData.completedSales.some((completedSale) => completedSale.id === sale?.id),
    ).toBe(true);
    expect(soldAdminData.bidHistory).toEqual([]);
  });

  it("closes an auction without bids as unsold and returns inventory to listed", async () => {
    const { auction, adminId } = await createActiveTestAuction("Unsold mackerel");
    const { closeResult, events, fish, sale } = await closeAuctionAndLoadState(
      auction.id,
      auction.fish.id,
      adminId,
    );

    expect(closeResult).toMatchObject({
      changed: true,
      status: "unsold",
      saleEvent: null,
    });
    expect(sale).toBeUndefined();
    expect(fish?.status).toBe("listed");
    expect(events.map((event) => event.type)).toEqual(["auction.closed"]);
  });

  it("escalates bids across rounds while alternating buyers in multi-round mode", async () => {
    await ensureDemoUsers();

    const result = await runSimulation({
      auctionCount: 1,
      bidCount: 0,
      bidRounds: 3,
      intervalMs: 0,
      durationMinutes: 30,
      rejectionRate: 0,
      seed: 40_002,
      buyerIds: undefined,
      auctionIds: undefined,
      closeAuctions: false,
    });

    for (const auction of result.createdAuctions) {
      createdAuctionIds.add(auction.id);
    }
    for (const fish of result.createdFish) {
      createdFishItemIds.add(fish.id);
    }

    expect(result.totals.acceptedBids).toBe(3);
    expect(result.totals.rejectedBids).toBe(0);

    const acceptedAmounts = result.bids
      .filter((bid) => bid.result.ok)
      .map((bid) => bid.amountCents);
    for (let index = 1; index < acceptedAmounts.length; index += 1) {
      expect(acceptedAmounts[index]).toBeGreaterThan(acceptedAmounts[index - 1]);
    }

    const bidders = result.bids.map((bid) => bid.bidderId);
    expect(bidders[0]).not.toBe(bidders[1]);
    expect(bidders[1]).not.toBe(bidders[2]);
  });

  it("exposes a submission-ready bid context that tracks the current highest bid", async () => {
    const { auction, buyerOneId } = await createActiveTestAuction("Bid context cod");

    const initialContext = await getBidSubmissionContext(auction.id);
    expect(initialContext).toMatchObject({
      auctionId: auction.id,
      auctionStatus: "active",
      currentHighestBid: null,
      expectedHighestBidCents: null,
      nextMinimumBidCents: initialContext.startingPriceCents,
    });

    const bidResult = await placeBid({
      auctionId: auction.id,
      bidderId: buyerOneId,
      amountCents: initialContext.nextMinimumBidCents,
      expectedHighestBidCents: initialContext.expectedHighestBidCents,
    });
    expect(bidResult.ok).toBe(true);

    const nextContext = await getBidSubmissionContext(auction.id);
    expect(nextContext.expectedHighestBidCents).toBe(initialContext.nextMinimumBidCents);
    expect(nextContext.nextMinimumBidCents).toBe(
      initialContext.nextMinimumBidCents + auction.minimumIncrementCents,
    );
    expect(nextContext.currentHighestBid?.amountCents).toBe(initialContext.nextMinimumBidCents);
  });

  it("requires admin users for auction and inventory admin commands", async () => {
    const { adminId, sellerId, buyerOneId } = await createTestUsers();
    const fish = await createTestFish(sellerId, "Permission test cod");

    await expect(
      createAuction({
        fishItemId: fish.id,
        adminUserId: buyerOneId,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 60 * 60_000),
        minimumIncrementCents: 5_000,
      }),
    ).rejects.toThrow("Only admins can create auctions");

    const auction = await createTestAuction(fish.id, adminId);

    await expect(
      closeAuction({
        auctionId: auction.id,
        adminUserId: buyerOneId,
      }),
    ).rejects.toThrow("Only admins can close auctions");
    await expect(
      withdrawAuction({
        auctionId: auction.id,
        adminUserId: buyerOneId,
      }),
    ).rejects.toThrow("Only admins can withdraw auctions");
    await expect(
      withdrawFishItem({
        fishItemId: fish.id,
        adminUserId: buyerOneId,
      }),
    ).rejects.toThrow("Only admins can withdraw fish inventory");
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

async function createActiveTestAuction(displayName: string, species: "cod" | "halibut" = "cod") {
  const { adminId, sellerId, buyerOneId, buyerTwoId } = await createTestUsers();
  const fish = await createTestFish(sellerId, displayName, species);
  const auction = await createTestAuction(fish.id, adminId);

  return {
    auction,
    adminId,
    sellerId,
    buyerOneId,
    buyerTwoId,
  };
}

async function createTestFish(
  sellerId: string,
  displayName: string,
  species: "cod" | "halibut" = "cod",
) {
  const fish = await createFishItem({
    species,
    displayName,
    weightKilograms: 25,
    catchRegion: "Test coast",
    grade: "A",
    startingPriceMajor: 1000,
    sellerId,
    description: "",
    imageUrl: "",
  });
  createdFishItemIds.add(fish.id);
  return fish;
}

async function createTestAuction(fishItemId: string, adminId: string) {
  const auction = await createAuction({
    fishItemId,
    adminUserId: adminId,
    startsAt: new Date(Date.now() - 60_000),
    endsAt: new Date(Date.now() + 60 * 60_000),
    minimumIncrementCents: 5_000,
  });
  createdAuctionIds.add(auction.id);
  return auction;
}

async function closeAuctionAndLoadState(auctionId: string, fishItemId: string, adminId: string) {
  const events: Array<AuctionEvent> = [];
  const unsubscribe = subscribeToAuction(auctionId, (event) => events.push(event));
  const closeResult = await closeAuction({
    auctionId,
    adminUserId: adminId,
  });
  unsubscribe();

  const [sale, fish] = await Promise.all([
    db.query.sales.findFirst({
      where: eq(sales.auctionId, auctionId),
    }),
    db.query.fishItems.findFirst({
      where: eq(fishItems.id, fishItemId),
    }),
  ]);

  return { closeResult, events, fish, sale };
}
