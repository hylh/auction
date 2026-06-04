import { aliasedTable } from "drizzle-orm/alias";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { auctions, bids, fishItems, sales, users } from "../db/schema";
import type { BidSnapshot } from "../domain/events";
import type { AdminFilters } from "../domain/validation";
import { toBidSnapshot, toFishSummary, toUserSummary } from "./auction-mappers";
import { advanceAuctionLifecycle } from "./auction-lifecycle";
import {
  andAll,
  auctionQueryConditions,
  bidQueryConditions,
  fishMatchesFilters,
  saleQueryConditions,
} from "./auction-query-filters";
import type { AuctionDetail, DashboardData, DemoUser } from "./auction-types";

export async function listDemoUsers(): Promise<Array<DemoUser>> {
  return db
    .select({
      id: users.id,
      displayName: users.displayName,
      role: users.role,
    })
    .from(users)
    .orderBy(asc(users.displayName));
}

export async function getDashboardData(): Promise<DashboardData> {
  await advanceAuctionLifecycle();

  const [demoUsers, activeAuctions, latestBids, recentSales, inventoryNeedingAction] =
    await Promise.all([
      listDemoUsers(),
      loadAuctionSummaries("active"),
      loadLatestBids(8),
      loadRecentSales(5),
      loadInventoryNeedingAction(),
    ]);

  return {
    demoUsers,
    activeAuctions,
    latestBids,
    recentSales,
    inventoryNeedingAction,
  };
}

export async function getAuctionDetail(auctionId: string): Promise<AuctionDetail> {
  await advanceAuctionLifecycle();

  const auction = await db.query.auctions.findFirst({
    where: eq(auctions.id, auctionId),
    with: {
      fishItem: {
        with: {
          seller: true,
        },
      },
      bids: {
        with: {
          bidder: true,
        },
        orderBy: [desc(bids.amountCents), desc(bids.acceptedAt)],
      },
    },
  });

  if (!auction) {
    throw new Error(`Auction ${auctionId} was not found`);
  }

  const bidSnapshots = auction.bids.map((bid) => toBidSnapshot(bid));

  return {
    id: auction.id,
    status: auction.status,
    startsAt: auction.startsAt.toISOString(),
    endsAt: auction.endsAt.toISOString(),
    minimumIncrementCents: auction.minimumIncrementCents,
    fish: toFishSummary(auction.fishItem),
    seller: toUserSummary(auction.fishItem.seller),
    currentHighestBid: bidSnapshots[0] ?? null,
    bids: bidSnapshots,
  };
}

export async function loadAuctionSummaries(status?: "active", filters?: AdminFilters) {
  const auctionRows = await db
    .select({
      id: auctions.id,
      status: auctions.status,
      startsAt: auctions.startsAt,
      endsAt: auctions.endsAt,
      minimumIncrementCents: auctions.minimumIncrementCents,
      fishId: fishItems.id,
      fishSpecies: fishItems.species,
      fishDisplayName: fishItems.displayName,
      fishWeightGrams: fishItems.weightGrams,
      fishCatchRegion: fishItems.catchRegion,
      fishGrade: fishItems.grade,
      fishStartingPriceCents: fishItems.startingPriceCents,
      fishCurrency: fishItems.currency,
      fishStatus: fishItems.status,
      sellerId: users.id,
      sellerDisplayName: users.displayName,
      sellerRole: users.role,
    })
    .from(auctions)
    .innerJoin(fishItems, eq(auctions.fishItemId, fishItems.id))
    .innerJoin(users, eq(fishItems.sellerId, users.id))
    .where(andAll(auctionQueryConditions(status, filters)))
    .orderBy(asc(auctions.endsAt))
    .limit(status ? 50 : 100);

  const highestBids = await loadHighestBidSnapshots(auctionRows.map((auction) => auction.id));

  return auctionRows.map((auction) => ({
    id: auction.id,
    status: auction.status,
    startsAt: auction.startsAt.toISOString(),
    endsAt: auction.endsAt.toISOString(),
    minimumIncrementCents: auction.minimumIncrementCents,
    fish: toFishSummary({
      id: auction.fishId,
      species: auction.fishSpecies,
      displayName: auction.fishDisplayName,
      weightGrams: auction.fishWeightGrams,
      catchRegion: auction.fishCatchRegion,
      grade: auction.fishGrade,
      startingPriceCents: auction.fishStartingPriceCents,
      currency: auction.fishCurrency,
      status: auction.fishStatus,
    }),
    seller: toUserSummary({
      id: auction.sellerId,
      displayName: auction.sellerDisplayName,
      role: auction.sellerRole,
    }),
    currentHighestBid: highestBids.get(auction.id) ?? null,
  }));
}

export async function loadLatestBids(limit: number, filters?: AdminFilters) {
  const bidRows = await db
    .select({
      id: bids.id,
      amountCents: bids.amountCents,
      acceptedAt: bids.acceptedAt,
      auctionId: bids.auctionId,
      bidderDisplayName: users.displayName,
      fishDisplayName: fishItems.displayName,
      species: fishItems.species,
    })
    .from(bids)
    .innerJoin(users, eq(bids.bidderId, users.id))
    .innerJoin(auctions, eq(bids.auctionId, auctions.id))
    .innerJoin(fishItems, eq(auctions.fishItemId, fishItems.id))
    .where(andAll(bidQueryConditions(filters)))
    .orderBy(desc(bids.acceptedAt))
    .limit(limit);

  return bidRows.map((bid) => ({
    bidId: bid.id,
    amountCents: bid.amountCents,
    bidderDisplayName: bid.bidderDisplayName,
    acceptedAt: bid.acceptedAt.toISOString(),
    auctionId: bid.auctionId,
    fishDisplayName: bid.fishDisplayName,
    species: bid.species,
  }));
}

export async function loadRecentSales(limit: number, filters?: AdminFilters) {
  const buyer = aliasedTable(users, "buyer");
  const seller = aliasedTable(users, "seller");
  const saleRows = await db
    .select({
      id: sales.id,
      auctionId: sales.auctionId,
      fishDisplayName: fishItems.displayName,
      species: fishItems.species,
      weightGrams: fishItems.weightGrams,
      buyerDisplayName: buyer.displayName,
      sellerDisplayName: seller.displayName,
      amountCents: sales.amountCents,
      completedAt: sales.completedAt,
    })
    .from(sales)
    .innerJoin(fishItems, eq(sales.fishItemId, fishItems.id))
    .innerJoin(buyer, eq(sales.buyerId, buyer.id))
    .innerJoin(seller, eq(sales.sellerId, seller.id))
    .where(andAll(saleQueryConditions(filters)))
    .orderBy(desc(sales.completedAt))
    .limit(limit);

  return saleRows.map((sale) => ({
    id: sale.id,
    auctionId: sale.auctionId,
    fishDisplayName: sale.fishDisplayName,
    species: sale.species,
    weightGrams: sale.weightGrams,
    buyerDisplayName: sale.buyerDisplayName,
    sellerDisplayName: sale.sellerDisplayName,
    amountCents: sale.amountCents,
    completedAt: sale.completedAt.toISOString(),
  }));
}

async function loadHighestBidSnapshots(auctionIds: Array<string>) {
  if (auctionIds.length === 0) {
    return new Map<string, BidSnapshot>();
  }

  const bidRows = await db.query.bids.findMany({
    where: inArray(bids.auctionId, auctionIds),
    with: {
      bidder: true,
    },
    orderBy: [desc(bids.amountCents), desc(bids.acceptedAt)],
  });
  const highestBids = new Map<string, BidSnapshot>();

  for (const bid of bidRows) {
    if (!highestBids.has(bid.auctionId)) {
      highestBids.set(bid.auctionId, toBidSnapshot(bid));
    }
  }

  return highestBids;
}

export async function loadInventoryNeedingAction(filters?: AdminFilters) {
  const fishRows = await db.query.fishItems.findMany({
    where: (item, { inArray }) => inArray(item.status, ["draft", "listed"]),
    orderBy: [desc(fishItems.createdAt)],
    limit: filters ? 50 : 8,
  });

  return fishRows.filter((fish) => fishMatchesFilters(fish, filters)).map(toFishSummary);
}
