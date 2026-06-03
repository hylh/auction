import { trace } from "@opentelemetry/api";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { auctions, bids, fishItems, sales, users } from "../db/schema";
import { evaluateBid, type BidErrorCode } from "../domain/bid-rules";
import { CURRENCY } from "../domain/constants";
import {
  publishAuctionEvent,
  type AuctionClosedEvent,
  type BidAcceptedEvent,
  type BidRejectedEvent,
  type BidSnapshot,
  type SaleCompletedEvent,
} from "../domain/events";
import { logInfo, logWarn } from "../domain/logger";
import { incrementMetric, observeBidMutationDuration } from "../domain/metrics";
import { centsFromMajor } from "../domain/money";
import { bidInputSchema, closeAuctionInputSchema, fishInputSchema } from "../domain/validation";
import { gramsFromKilograms } from "../domain/weight";

export type DemoUser = {
  id: string;
  displayName: string;
  role: "seller" | "buyer" | "admin";
};

export type AuctionSummary = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  minimumIncrementCents: number;
  fish: FishSummary;
  seller: DemoUser;
  currentHighestBid: BidSnapshot | null;
};

export type FishSummary = {
  id: string;
  species: string;
  displayName: string;
  weightGrams: number;
  catchRegion: string;
  grade: string;
  startingPriceCents: number;
  currency: string;
  status: string;
};

export type SaleSummary = {
  id: string;
  auctionId: string;
  fishDisplayName: string;
  species: string;
  buyerDisplayName: string;
  sellerDisplayName: string;
  amountCents: number;
  completedAt: string;
};

export type DashboardData = {
  demoUsers: Array<DemoUser>;
  activeAuctions: Array<AuctionSummary>;
  latestBids: Array<
    BidSnapshot & {
      auctionId: string;
      fishDisplayName: string;
      species: string;
    }
  >;
  recentSales: Array<SaleSummary>;
  inventoryNeedingAction: Array<FishSummary>;
};

export type AuctionDetail = AuctionSummary & {
  bids: Array<BidSnapshot>;
};

export type AdminData = {
  completedSales: Array<SaleSummary>;
  auctions: Array<AuctionSummary>;
  bidHistory: Array<
    BidSnapshot & {
      auctionId: string;
      fishDisplayName: string;
      species: string;
    }
  >;
  statistics: {
    totalSalesCents: number;
    averageBidCents: number;
    popularFish: Array<{
      species: string;
      bidCount: number;
      totalKilogramsSold: number;
      totalSalesCents: number;
    }>;
  };
};

export type PlaceBidResult =
  | {
      ok: true;
      event: BidAcceptedEvent;
    }
  | {
      ok: false;
      code: BidErrorCode;
      message: string;
      currentHighestBidCents: number | null;
    };

const tracer = trace.getTracer("fish-auction");

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

export async function createFishItem(input: unknown) {
  const data = fishInputSchema.parse(input);
  const [created] = await db
    .insert(fishItems)
    .values({
      species: data.species,
      displayName: data.displayName,
      weightGrams: gramsFromKilograms(data.weightKilograms),
      catchRegion: data.catchRegion,
      grade: data.grade,
      startingPriceCents: centsFromMajor(data.startingPriceMajor),
      sellerId: data.sellerId,
      status: "listed",
      description: data.description || null,
      imageUrl: data.imageUrl || null,
    })
    .returning();

  logInfo("fish_item.created", {
    fishItemId: created.id,
    species: created.species,
    sellerId: created.sellerId,
  });

  return toFishSummary(created);
}

export async function placeBid(input: unknown): Promise<PlaceBidResult> {
  const data = bidInputSchema.parse(input);
  const started = performance.now();

  const result = await tracer.startActiveSpan("placeBid", async (span) => {
    span.setAttribute("auction.id", data.auctionId);
    span.setAttribute("bid.amount_cents", data.amountCents);

    try {
      return await db.transaction(async (tx) => {
        await tx.execute(sql`select id from auctions where id = ${data.auctionId} for update`);

        const auction = await tx.query.auctions.findFirst({
          where: eq(auctions.id, data.auctionId),
          with: {
            fishItem: {
              with: {
                seller: true,
              },
            },
          },
        });

        if (!auction) {
          throw new Error(`Auction ${data.auctionId} was not found`);
        }

        const currentHighestBid = await tx.query.bids.findFirst({
          where: eq(bids.auctionId, data.auctionId),
          with: {
            bidder: true,
          },
          orderBy: [desc(bids.amountCents), desc(bids.acceptedAt)],
        });

        const bidDecision = evaluateBid({
          amountCents: data.amountCents,
          expectedHighestBidCents: data.expectedHighestBidCents,
          currentHighestBidCents: currentHighestBid?.amountCents ?? null,
          startingPriceCents: auction.fishItem.startingPriceCents,
          minimumIncrementCents: auction.minimumIncrementCents,
          auctionStatus: auction.status,
          startsAt: auction.startsAt,
          endsAt: auction.endsAt,
          now: new Date(),
          sellerId: auction.fishItem.sellerId,
          bidderId: data.bidderId,
        });

        if (!bidDecision.ok) {
          return {
            ok: false as const,
            code: bidDecision.code,
            message: bidDecision.message,
            currentHighestBidCents: bidDecision.currentHighestBidCents,
          };
        }

        const [insertedBid] = await tx
          .insert(bids)
          .values({
            auctionId: data.auctionId,
            bidderId: data.bidderId,
            amountCents: data.amountCents,
          })
          .returning();

        const bidder = await tx.query.users.findFirst({
          where: eq(users.id, data.bidderId),
        });

        if (!bidder) {
          throw new Error(`Bidder ${data.bidderId} was not found`);
        }

        const snapshot: BidSnapshot = {
          bidId: insertedBid.id,
          amountCents: insertedBid.amountCents,
          bidderDisplayName: bidder.displayName,
          acceptedAt: insertedBid.acceptedAt.toISOString(),
        };

        return {
          ok: true as const,
          event: {
            type: "bid.accepted" as const,
            auctionId: data.auctionId,
            bid: snapshot,
            currentHighestBid: snapshot,
          },
        };
      });
    } finally {
      span.end();
    }
  });

  observeBidMutationDuration(performance.now() - started);

  if (result.ok) {
    incrementMetric("acceptedBids");
    publishAuctionEvent(result.event);
    logInfo("bid.accepted", {
      auctionId: result.event.auctionId,
      bidId: result.event.bid.bidId,
      amountCents: result.event.bid.amountCents,
    });
  } else {
    incrementMetric("rejectedBids");
    const event: BidRejectedEvent = {
      type: "bid.rejected",
      auctionId: data.auctionId,
      actorUserId: data.bidderId,
      code: result.code,
      message: result.message,
      currentHighestBidCents: result.currentHighestBidCents,
      rejectedAt: new Date().toISOString(),
    };
    publishAuctionEvent(event);
    logWarn("bid.rejected", {
      auctionId: data.auctionId,
      bidderId: data.bidderId,
      code: result.code,
    });
  }

  return result;
}

export async function closeAuction(input: unknown) {
  const data = closeAuctionInputSchema.parse(input);

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select id from auctions where id = ${data.auctionId} for update`);

    const admin = await tx.query.users.findFirst({
      where: and(eq(users.id, data.adminUserId), eq(users.role, "admin")),
    });
    if (!admin) {
      throw new Error("Only admins can close auctions");
    }

    const auction = await tx.query.auctions.findFirst({
      where: eq(auctions.id, data.auctionId),
      with: {
        fishItem: true,
      },
    });
    if (!auction) {
      throw new Error(`Auction ${data.auctionId} was not found`);
    }
    if (auction.status !== "active") {
      throw new Error("Only active auctions can be closed");
    }

    const winningBid = await tx.query.bids.findFirst({
      where: eq(bids.auctionId, data.auctionId),
      orderBy: [desc(bids.amountCents), desc(bids.acceptedAt)],
    });

    const closedAt = new Date();
    if (!winningBid) {
      await tx
        .update(auctions)
        .set({ status: "unsold", closedAt, updatedAt: closedAt })
        .where(eq(auctions.id, data.auctionId));
      await tx
        .update(fishItems)
        .set({ status: "listed", updatedAt: closedAt })
        .where(eq(fishItems.id, auction.fishItemId));

      const closedEvent: AuctionClosedEvent = {
        type: "auction.closed",
        auctionId: data.auctionId,
        status: "unsold",
        closedAt: closedAt.toISOString(),
      };
      return { closedEvent, saleEvent: null };
    }

    await tx
      .update(auctions)
      .set({ status: "closed", closedAt, updatedAt: closedAt })
      .where(eq(auctions.id, data.auctionId));
    await tx
      .update(fishItems)
      .set({ status: "sold", updatedAt: closedAt })
      .where(eq(fishItems.id, auction.fishItemId));

    const [sale] = await tx
      .insert(sales)
      .values({
        auctionId: data.auctionId,
        fishItemId: auction.fishItemId,
        winningBidId: winningBid.id,
        buyerId: winningBid.bidderId,
        sellerId: auction.fishItem.sellerId,
        amountCents: winningBid.amountCents,
        currency: CURRENCY,
      })
      .returning();

    const closedEvent: AuctionClosedEvent = {
      type: "auction.closed",
      auctionId: data.auctionId,
      status: "closed",
      closedAt: closedAt.toISOString(),
    };
    const saleEvent: SaleCompletedEvent = {
      type: "sale.completed",
      auctionId: data.auctionId,
      saleId: sale.id,
      amountCents: sale.amountCents,
      completedAt: sale.completedAt.toISOString(),
    };
    return { closedEvent, saleEvent };
  });

  incrementMetric("auctionsClosed");
  publishAuctionEvent(result.closedEvent);

  if (result.saleEvent) {
    incrementMetric("salesCompleted");
    incrementMetric("totalSaleValueCents", result.saleEvent.amountCents);
    publishAuctionEvent(result.saleEvent);
  }

  logInfo("auction.closed", {
    auctionId: data.auctionId,
    status: result.closedEvent.status,
  });

  return result;
}

export async function getAdminData(): Promise<AdminData> {
  const [completedSales, allAuctions, bidHistory, saleRows, bidRows, popularityRows] =
    await Promise.all([
      loadRecentSales(50),
      loadAuctionSummaries(),
      loadLatestBids(50),
      db.select({ amountCents: sales.amountCents }).from(sales),
      db.select({ amountCents: bids.amountCents }).from(bids),
      db
        .select({
          species: fishItems.species,
          weightGrams: fishItems.weightGrams,
          bidId: bids.id,
          saleId: sales.id,
          saleAmountCents: sales.amountCents,
        })
        .from(fishItems)
        .leftJoin(auctions, eq(auctions.fishItemId, fishItems.id))
        .leftJoin(bids, eq(bids.auctionId, auctions.id))
        .leftJoin(sales, eq(sales.fishItemId, fishItems.id)),
    ]);

  const totalSalesCents = saleRows.reduce((sum, sale) => sum + sale.amountCents, 0);
  const averageBidCents =
    bidRows.length === 0
      ? 0
      : Math.round(bidRows.reduce((sum, bid) => sum + bid.amountCents, 0) / bidRows.length);

  const popularBySpecies = new Map<
    string,
    {
      species: string;
      bidCount: number;
      totalKilogramsSold: number;
      totalSalesCents: number;
      seenSaleIds: Set<string>;
    }
  >();

  for (const row of popularityRows) {
    const current = popularBySpecies.get(row.species) ?? {
      species: row.species,
      bidCount: 0,
      totalKilogramsSold: 0,
      totalSalesCents: 0,
      seenSaleIds: new Set<string>(),
    };

    if (row.bidId) {
      current.bidCount += 1;
    }
    if (row.saleId && row.saleAmountCents && !current.seenSaleIds.has(row.saleId)) {
      current.seenSaleIds.add(row.saleId);
      current.totalKilogramsSold += row.weightGrams / 1000;
      current.totalSalesCents += row.saleAmountCents;
    }

    popularBySpecies.set(row.species, current);
  }

  return {
    completedSales,
    auctions: allAuctions,
    bidHistory,
    statistics: {
      totalSalesCents,
      averageBidCents,
      popularFish: [...popularBySpecies.values()]
        .map(({ seenSaleIds: _seenSaleIds, ...fish }) => fish)
        .sort((left, right) => right.bidCount - left.bidCount),
    },
  };
}

async function loadAuctionSummaries(status?: "active") {
  const auctionRows = await db.query.auctions.findMany({
    where: status ? eq(auctions.status, status) : undefined,
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
        limit: 1,
      },
    },
    orderBy: [asc(auctions.endsAt)],
  });

  return auctionRows.map((auction) => ({
    id: auction.id,
    status: auction.status,
    startsAt: auction.startsAt.toISOString(),
    endsAt: auction.endsAt.toISOString(),
    minimumIncrementCents: auction.minimumIncrementCents,
    fish: toFishSummary(auction.fishItem),
    seller: toUserSummary(auction.fishItem.seller),
    currentHighestBid: auction.bids[0] ? toBidSnapshot(auction.bids[0]) : null,
  }));
}

async function loadLatestBids(limit: number) {
  const bidRows = await db.query.bids.findMany({
    with: {
      bidder: true,
      auction: {
        with: {
          fishItem: true,
        },
      },
    },
    orderBy: [desc(bids.acceptedAt)],
    limit,
  });

  return bidRows.map((bid) => ({
    ...toBidSnapshot(bid),
    auctionId: bid.auctionId,
    fishDisplayName: bid.auction.fishItem.displayName,
    species: bid.auction.fishItem.species,
  }));
}

async function loadRecentSales(limit: number) {
  const saleRows = await db.query.sales.findMany({
    with: {
      fishItem: true,
      buyer: true,
      seller: true,
    },
    orderBy: [desc(sales.completedAt)],
    limit,
  });

  return saleRows.map((sale) => ({
    id: sale.id,
    auctionId: sale.auctionId,
    fishDisplayName: sale.fishItem.displayName,
    species: sale.fishItem.species,
    buyerDisplayName: sale.buyer.displayName,
    sellerDisplayName: sale.seller.displayName,
    amountCents: sale.amountCents,
    completedAt: sale.completedAt.toISOString(),
  }));
}

async function loadInventoryNeedingAction() {
  const fishRows = await db.query.fishItems.findMany({
    where: (item, { inArray }) => inArray(item.status, ["draft", "listed"]),
    orderBy: [desc(fishItems.createdAt)],
    limit: 8,
  });

  return fishRows.map(toFishSummary);
}

function toBidSnapshot(bid: {
  id: string;
  amountCents: number;
  acceptedAt: Date;
  bidder: { displayName: string };
}): BidSnapshot {
  return {
    bidId: bid.id,
    amountCents: bid.amountCents,
    bidderDisplayName: bid.bidder.displayName,
    acceptedAt: bid.acceptedAt.toISOString(),
  };
}

function toFishSummary(fish: {
  id: string;
  species: string;
  displayName: string;
  weightGrams: number;
  catchRegion: string;
  grade: string;
  startingPriceCents: number;
  currency: string;
  status: string;
}) {
  return {
    id: fish.id,
    species: fish.species,
    displayName: fish.displayName,
    weightGrams: fish.weightGrams,
    catchRegion: fish.catchRegion,
    grade: fish.grade,
    startingPriceCents: fish.startingPriceCents,
    currency: fish.currency,
    status: fish.status,
  };
}

function toUserSummary(user: {
  id: string;
  displayName: string;
  role: "seller" | "buyer" | "admin";
}): DemoUser {
  return {
    id: user.id,
    displayName: user.displayName,
    role: user.role,
  };
}
