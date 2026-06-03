import { trace } from "@opentelemetry/api";
import { and, asc, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  adminActions,
  auctions,
  bids,
  fishItems,
  inventoryStatusChanges,
  sales,
  users,
} from "../db/schema";
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
import {
  adminFiltersSchema,
  type AdminFilters,
  auctionInputSchema,
  bidInputSchema,
  closeAuctionInputSchema,
  fishInputSchema,
  withdrawAuctionInputSchema,
  withdrawFishItemInputSchema,
} from "../domain/validation";
import { gramsFromKilograms } from "../domain/weight";

type AuctionLifecycleStatus = "scheduled" | "active" | "closed" | "unsold" | "withdrawn";
type InventoryLifecycleStatus = "draft" | "listed" | "in_auction" | "sold" | "withdrawn";
type CloseReason = "manual" | "expired";
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
  weightGrams: number;
  buyerDisplayName: string;
  sellerDisplayName: string;
  amountCents: number;
  completedAt: string;
};

export type InventoryStatusChangeSummary = {
  id: string;
  fishItemId: string;
  fishDisplayName: string;
  species: string;
  fromStatus: string | null;
  toStatus: string;
  changedByDisplayName: string | null;
  reason: string;
  createdAt: string;
};

export type AdminActionSummary = {
  id: string;
  adminDisplayName: string;
  action: string;
  auctionId: string | null;
  fishItemId: string | null;
  fishDisplayName: string | null;
  reason: string;
  createdAt: string;
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
  demoUsers: Array<DemoUser>;
  completedSales: Array<SaleSummary>;
  auctions: Array<AuctionSummary>;
  inventoryNeedingAction: Array<FishSummary>;
  withdrawnInventory: Array<FishSummary>;
  inventoryStatusChanges: Array<InventoryStatusChangeSummary>;
  adminActions: Array<AdminActionSummary>;
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

export type CloseAuctionResult = {
  auctionId: string;
  status: AuctionLifecycleStatus;
  changed: boolean;
  closedEvent: AuctionClosedEvent | null;
  saleEvent: SaleCompletedEvent | null;
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

export async function createFishItem(input: unknown) {
  const data = fishInputSchema.parse(input);
  const created = await db.transaction(async (tx) => {
    const [fish] = await tx
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

    await recordInventoryStatusChange(tx, {
      fishItemId: fish.id,
      auctionId: null,
      fromStatus: null,
      toStatus: "listed",
      changedByUserId: data.sellerId,
      reason: "Fish inventory listed",
    });

    return fish;
  });

  logInfo("fish_item.created", {
    fishItemId: created.id,
    species: created.species,
    sellerId: created.sellerId,
  });

  return toFishSummary(created);
}

export async function createAuction(input: unknown): Promise<AuctionSummary> {
  const data = auctionInputSchema.parse(input);
  const now = new Date();

  if (data.endsAt <= now) {
    throw new Error("Auction end time must be in the future");
  }

  const createdAuction = await db.transaction(async (tx) => {
    const admin = await tx.query.users.findFirst({
      where: and(eq(users.id, data.adminUserId), eq(users.role, "admin")),
    });
    if (!admin) {
      throw new Error("Only admins can create auctions");
    }

    await tx.execute(sql`select id from fish_items where id = ${data.fishItemId} for update`);

    const fish = await tx.query.fishItems.findFirst({
      where: eq(fishItems.id, data.fishItemId),
      with: {
        seller: true,
      },
    });
    if (!fish) {
      throw new Error(`Fish item ${data.fishItemId} was not found`);
    }
    if (fish.status !== "listed") {
      throw new Error("Only listed fish inventory can be auctioned");
    }

    const initialStatus = data.startsAt <= now && now < data.endsAt ? "active" : "scheduled";
    const [auction] = await tx
      .insert(auctions)
      .values({
        fishItemId: fish.id,
        status: initialStatus,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        minimumIncrementCents: data.minimumIncrementCents,
      })
      .returning();

    await tx
      .update(fishItems)
      .set({ status: "in_auction", updatedAt: now })
      .where(eq(fishItems.id, fish.id));

    await recordInventoryStatusChange(tx, {
      fishItemId: fish.id,
      auctionId: auction.id,
      fromStatus: fish.status,
      toStatus: "in_auction",
      changedByUserId: data.adminUserId,
      reason: "Auction created from listed inventory",
    });
    await recordAdminAction(tx, {
      adminUserId: data.adminUserId,
      action: "create_auction",
      auctionId: auction.id,
      fishItemId: fish.id,
      reason: "Auction created from listed inventory",
    });

    return {
      id: auction.id,
      status: auction.status,
      startsAt: auction.startsAt.toISOString(),
      endsAt: auction.endsAt.toISOString(),
      minimumIncrementCents: auction.minimumIncrementCents,
      fish: toFishSummary({ ...fish, status: "in_auction" }),
      seller: toUserSummary(fish.seller),
      currentHighestBid: null,
    };
  });

  incrementMetric("auctionsCreated");
  logInfo("auction.created", {
    auctionId: createdAuction.id,
    fishItemId: data.fishItemId,
    status: createdAuction.status,
  });

  return createdAuction;
}

export async function placeBid(input: unknown): Promise<PlaceBidResult> {
  const data = bidInputSchema.parse(input);
  await advanceAuctionLifecycle();

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

export async function closeAuction(input: unknown): Promise<CloseAuctionResult> {
  const data = closeAuctionInputSchema.parse(input);

  const result = await db.transaction(async (tx) => {
    const admin = await tx.query.users.findFirst({
      where: and(eq(users.id, data.adminUserId), eq(users.role, "admin")),
    });
    if (!admin) {
      throw new Error("Only admins can close auctions");
    }

    return closeAuctionInTransaction(tx, {
      auctionId: data.auctionId,
      adminUserId: data.adminUserId,
      now: new Date(),
      reason: "manual",
    });
  });

  publishCloseResult(result);

  return result;
}

export async function withdrawAuction(input: unknown) {
  const data = withdrawAuctionInputSchema.parse(input);
  const reason = data.reason ?? "Auction withdrawn by admin";

  const result = await db.transaction(async (tx) => {
    const admin = await tx.query.users.findFirst({
      where: and(eq(users.id, data.adminUserId), eq(users.role, "admin")),
    });
    if (!admin) {
      throw new Error("Only admins can withdraw auctions");
    }

    await tx.execute(sql`select id from auctions where id = ${data.auctionId} for update`);

    const auction = await tx.query.auctions.findFirst({
      where: eq(auctions.id, data.auctionId),
      with: {
        fishItem: true,
      },
    });
    if (!auction) {
      throw new Error(`Auction ${data.auctionId} was not found`);
    }
    if (auction.status === "withdrawn") {
      return { changed: false as const, auctionId: auction.id, fishItemId: auction.fishItemId };
    }
    if (auction.status !== "active" && auction.status !== "scheduled") {
      throw new Error("Only active or scheduled auctions can be withdrawn");
    }

    const now = new Date();
    await tx
      .update(auctions)
      .set({ status: "withdrawn", closedAt: now, updatedAt: now })
      .where(eq(auctions.id, auction.id));
    await tx
      .update(fishItems)
      .set({ status: "withdrawn", updatedAt: now })
      .where(eq(fishItems.id, auction.fishItemId));

    await recordInventoryStatusChange(tx, {
      fishItemId: auction.fishItemId,
      auctionId: auction.id,
      fromStatus: auction.fishItem.status,
      toStatus: "withdrawn",
      changedByUserId: data.adminUserId,
      reason,
    });
    await recordAdminAction(tx, {
      adminUserId: data.adminUserId,
      action: "withdraw_auction",
      auctionId: auction.id,
      fishItemId: auction.fishItemId,
      reason,
    });

    return { changed: true as const, auctionId: auction.id, fishItemId: auction.fishItemId };
  });

  if (result.changed) {
    logInfo("auction.withdrawn", {
      auctionId: result.auctionId,
      fishItemId: result.fishItemId,
    });
  }

  return result;
}

export async function withdrawFishItem(input: unknown) {
  const data = withdrawFishItemInputSchema.parse(input);
  const reason = data.reason ?? "Fish inventory withdrawn by admin";

  const result = await db.transaction(async (tx) => {
    const admin = await tx.query.users.findFirst({
      where: and(eq(users.id, data.adminUserId), eq(users.role, "admin")),
    });
    if (!admin) {
      throw new Error("Only admins can withdraw fish inventory");
    }

    await tx.execute(sql`select id from fish_items where id = ${data.fishItemId} for update`);

    const fish = await tx.query.fishItems.findFirst({
      where: eq(fishItems.id, data.fishItemId),
    });
    if (!fish) {
      throw new Error(`Fish item ${data.fishItemId} was not found`);
    }
    if (fish.status === "withdrawn") {
      return { changed: false as const, fishItemId: fish.id };
    }
    if (fish.status === "sold") {
      throw new Error("Sold fish inventory cannot be withdrawn");
    }
    if (fish.status === "in_auction") {
      throw new Error("Withdraw the active auction instead of withdrawing in-auction inventory");
    }

    const now = new Date();
    await tx
      .update(fishItems)
      .set({ status: "withdrawn", updatedAt: now })
      .where(eq(fishItems.id, fish.id));
    await recordInventoryStatusChange(tx, {
      fishItemId: fish.id,
      auctionId: null,
      fromStatus: fish.status,
      toStatus: "withdrawn",
      changedByUserId: data.adminUserId,
      reason,
    });
    await recordAdminAction(tx, {
      adminUserId: data.adminUserId,
      action: "withdraw_inventory",
      auctionId: null,
      fishItemId: fish.id,
      reason,
    });

    return { changed: true as const, fishItemId: fish.id };
  });

  if (result.changed) {
    logInfo("fish_item.withdrawn", { fishItemId: result.fishItemId });
  }

  return result;
}

export async function getAdminData(input: unknown = {}): Promise<AdminData> {
  const filters = adminFiltersSchema.parse(input ?? {});
  await advanceAuctionLifecycle();

  const [
    demoUsers,
    allCompletedSales,
    allAuctions,
    inventoryNeedingAction,
    withdrawnInventory,
    statusChanges,
    actionHistory,
    allBidHistory,
  ] = await Promise.all([
    listDemoUsers(),
    loadRecentSales(null, filters),
    loadAuctionSummaries(undefined, filters),
    loadInventoryNeedingAction(filters),
    loadWithdrawnInventory(filters),
    loadInventoryStatusChanges(filters),
    loadAdminActions(filters),
    loadLatestBids(null, filters),
  ]);

  const completedSales = allCompletedSales.slice(0, 50);
  const bidHistory = allBidHistory.slice(0, 50);
  const totalSalesCents = allCompletedSales.reduce((sum, sale) => sum + sale.amountCents, 0);
  const averageBidCents =
    allBidHistory.length === 0
      ? 0
      : Math.round(
          allBidHistory.reduce((sum, bid) => sum + bid.amountCents, 0) / allBidHistory.length,
        );

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

  for (const bid of allBidHistory) {
    const current = popularBySpecies.get(bid.species) ?? {
      species: bid.species,
      bidCount: 0,
      totalKilogramsSold: 0,
      totalSalesCents: 0,
      seenSaleIds: new Set<string>(),
    };
    current.bidCount += 1;
    popularBySpecies.set(bid.species, current);
  }

  for (const sale of allCompletedSales) {
    const current = popularBySpecies.get(sale.species) ?? {
      species: sale.species,
      bidCount: 0,
      totalKilogramsSold: 0,
      totalSalesCents: 0,
      seenSaleIds: new Set<string>(),
    };
    if (!current.seenSaleIds.has(sale.id)) {
      current.seenSaleIds.add(sale.id);
      current.totalKilogramsSold += sale.weightGrams / 1000;
      current.totalSalesCents += sale.amountCents;
    }
    popularBySpecies.set(sale.species, current);
  }

  return {
    demoUsers,
    completedSales,
    auctions: allAuctions,
    inventoryNeedingAction,
    withdrawnInventory,
    inventoryStatusChanges: statusChanges,
    adminActions: actionHistory,
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

export async function advanceAuctionLifecycle(now = new Date()) {
  const activatedAuctions = await db
    .update(auctions)
    .set({ status: "active", updatedAt: now })
    .where(
      and(eq(auctions.status, "scheduled"), lte(auctions.startsAt, now), gt(auctions.endsAt, now)),
    )
    .returning({ id: auctions.id });

  for (const auction of activatedAuctions) {
    logInfo("auction.activated", { auctionId: auction.id });
  }

  const expiredAuctions = await db
    .select({ id: auctions.id })
    .from(auctions)
    .where(and(inArray(auctions.status, ["active", "scheduled"]), lte(auctions.endsAt, now)))
    .orderBy(asc(auctions.endsAt));

  const closeResults: Array<CloseAuctionResult> = [];
  for (const auction of expiredAuctions) {
    const result = await db.transaction((tx) =>
      closeAuctionInTransaction(tx, {
        auctionId: auction.id,
        adminUserId: null,
        now,
        reason: "expired",
      }),
    );
    publishCloseResult(result);
    closeResults.push(result);
  }

  return {
    activatedCount: activatedAuctions.length,
    closedCount: closeResults.filter((result) => result.changed).length,
  };
}

async function closeAuctionInTransaction(
  tx: Transaction,
  input: {
    auctionId: string;
    adminUserId: string | null;
    now: Date;
    reason: CloseReason;
  },
): Promise<CloseAuctionResult> {
  await tx.execute(sql`select id from auctions where id = ${input.auctionId} for update`);

  const auction = await tx.query.auctions.findFirst({
    where: eq(auctions.id, input.auctionId),
    with: {
      fishItem: true,
    },
  });
  if (!auction) {
    throw new Error(`Auction ${input.auctionId} was not found`);
  }

  if (
    auction.status === "closed" ||
    auction.status === "unsold" ||
    auction.status === "withdrawn"
  ) {
    return {
      auctionId: auction.id,
      status: auction.status,
      changed: false,
      closedEvent: null,
      saleEvent: null,
    };
  }

  if (auction.status === "scheduled" && input.reason === "manual") {
    throw new Error("Only active auctions can be closed manually");
  }
  if (input.reason === "expired" && auction.endsAt > input.now) {
    throw new Error("Only expired auctions can be closed automatically");
  }
  if (auction.status !== "active" && auction.status !== "scheduled") {
    throw new Error("Only active or expired scheduled auctions can be closed");
  }

  const winningBid = await tx.query.bids.findFirst({
    where: eq(bids.auctionId, input.auctionId),
    orderBy: [desc(bids.amountCents), desc(bids.acceptedAt)],
  });

  const closedAt = input.now;
  if (!winningBid) {
    await tx
      .update(auctions)
      .set({ status: "unsold", closedAt, updatedAt: closedAt })
      .where(eq(auctions.id, input.auctionId));
    await tx
      .update(fishItems)
      .set({ status: "listed", updatedAt: closedAt })
      .where(eq(fishItems.id, auction.fishItemId));
    await recordInventoryStatusChange(tx, {
      fishItemId: auction.fishItemId,
      auctionId: auction.id,
      fromStatus: auction.fishItem.status,
      toStatus: "listed",
      changedByUserId: input.adminUserId,
      reason:
        input.reason === "manual" ? "Auction closed without bids" : "Auction expired without bids",
    });
    if (input.adminUserId) {
      await recordAdminAction(tx, {
        adminUserId: input.adminUserId,
        action: "close_auction",
        auctionId: auction.id,
        fishItemId: auction.fishItemId,
        reason: "Auction closed without bids",
      });
    }

    const closedEvent: AuctionClosedEvent = {
      type: "auction.closed",
      auctionId: input.auctionId,
      status: "unsold",
      closedAt: closedAt.toISOString(),
    };
    return {
      auctionId: input.auctionId,
      status: "unsold",
      changed: true,
      closedEvent,
      saleEvent: null,
    };
  }

  await tx
    .update(auctions)
    .set({ status: "closed", closedAt, updatedAt: closedAt })
    .where(eq(auctions.id, input.auctionId));
  await tx
    .update(fishItems)
    .set({ status: "sold", updatedAt: closedAt })
    .where(eq(fishItems.id, auction.fishItemId));
  await recordInventoryStatusChange(tx, {
    fishItemId: auction.fishItemId,
    auctionId: auction.id,
    fromStatus: auction.fishItem.status,
    toStatus: "sold",
    changedByUserId: input.adminUserId,
    reason:
      input.reason === "manual"
        ? "Auction closed with winning bid"
        : "Auction expired with winning bid",
  });

  const [sale] = await tx
    .insert(sales)
    .values({
      auctionId: input.auctionId,
      fishItemId: auction.fishItemId,
      winningBidId: winningBid.id,
      buyerId: winningBid.bidderId,
      sellerId: auction.fishItem.sellerId,
      amountCents: winningBid.amountCents,
      currency: CURRENCY,
      completedAt: closedAt,
    })
    .returning();

  if (input.adminUserId) {
    await recordAdminAction(tx, {
      adminUserId: input.adminUserId,
      action: "close_auction",
      auctionId: auction.id,
      fishItemId: auction.fishItemId,
      reason: "Auction closed with winning bid",
    });
  }

  const closedEvent: AuctionClosedEvent = {
    type: "auction.closed",
    auctionId: input.auctionId,
    status: "closed",
    closedAt: closedAt.toISOString(),
  };
  const saleEvent: SaleCompletedEvent = {
    type: "sale.completed",
    auctionId: input.auctionId,
    saleId: sale.id,
    amountCents: sale.amountCents,
    completedAt: sale.completedAt.toISOString(),
  };

  return {
    auctionId: input.auctionId,
    status: "closed",
    changed: true,
    closedEvent,
    saleEvent,
  };
}

function publishCloseResult(result: CloseAuctionResult) {
  if (!result.changed || !result.closedEvent) {
    return;
  }

  incrementMetric("auctionsClosed");
  publishAuctionEvent(result.closedEvent);

  if (result.saleEvent) {
    incrementMetric("salesCompleted");
    incrementMetric("totalSaleValueCents", result.saleEvent.amountCents);
    publishAuctionEvent(result.saleEvent);
  }

  logInfo("auction.closed", {
    auctionId: result.auctionId,
    status: result.status,
  });
}

async function loadAuctionSummaries(status?: "active", filters?: AdminFilters) {
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
      },
      sales: true,
    },
    orderBy: [asc(auctions.endsAt)],
  });

  return auctionRows
    .filter((auction) => auctionMatchesFilters(auction, filters))
    .map((auction) => ({
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

async function loadLatestBids(limit: number | null, filters?: AdminFilters) {
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
  });

  const mappedBids = bidRows
    .filter((bid) => bidMatchesFilters(bid, filters))
    .map((bid) => ({
      ...toBidSnapshot(bid),
      auctionId: bid.auctionId,
      fishDisplayName: bid.auction.fishItem.displayName,
      species: bid.auction.fishItem.species,
    }));

  return limit === null ? mappedBids : mappedBids.slice(0, limit);
}

async function loadRecentSales(limit: number | null, filters?: AdminFilters) {
  const saleRows = await db.query.sales.findMany({
    with: {
      fishItem: true,
      buyer: true,
      seller: true,
    },
    orderBy: [desc(sales.completedAt)],
  });

  const mappedSales = saleRows
    .filter((sale) => saleMatchesFilters(sale, filters))
    .map((sale) => ({
      id: sale.id,
      auctionId: sale.auctionId,
      fishDisplayName: sale.fishItem.displayName,
      species: sale.fishItem.species,
      weightGrams: sale.fishItem.weightGrams,
      buyerDisplayName: sale.buyer.displayName,
      sellerDisplayName: sale.seller.displayName,
      amountCents: sale.amountCents,
      completedAt: sale.completedAt.toISOString(),
    }));

  return limit === null ? mappedSales : mappedSales.slice(0, limit);
}

async function loadInventoryNeedingAction(filters?: AdminFilters) {
  const fishRows = await db.query.fishItems.findMany({
    where: (item, { inArray }) => inArray(item.status, ["draft", "listed"]),
    orderBy: [desc(fishItems.createdAt)],
    limit: filters ? 50 : 8,
  });

  return fishRows.filter((fish) => fishMatchesFilters(fish, filters)).map(toFishSummary);
}

async function loadWithdrawnInventory(filters?: AdminFilters) {
  const fishRows = await db.query.fishItems.findMany({
    where: eq(fishItems.status, "withdrawn"),
    orderBy: [desc(fishItems.updatedAt)],
    limit: 50,
  });

  return fishRows.filter((fish) => fishMatchesFilters(fish, filters)).map(toFishSummary);
}

async function loadInventoryStatusChanges(
  filters?: AdminFilters,
): Promise<Array<InventoryStatusChangeSummary>> {
  const changes = await db.query.inventoryStatusChanges.findMany({
    with: {
      fishItem: true,
      changedBy: true,
    },
    orderBy: [desc(inventoryStatusChanges.createdAt)],
    limit: 100,
  });

  return changes
    .filter((change) => statusChangeMatchesFilters(change, filters))
    .map((change) => ({
      id: change.id,
      fishItemId: change.fishItemId,
      fishDisplayName: change.fishItem.displayName,
      species: change.fishItem.species,
      fromStatus: change.fromStatus,
      toStatus: change.toStatus,
      changedByDisplayName: change.changedBy?.displayName ?? null,
      reason: change.reason,
      createdAt: change.createdAt.toISOString(),
    }));
}

async function loadAdminActions(filters?: AdminFilters): Promise<Array<AdminActionSummary>> {
  const actions = await db.query.adminActions.findMany({
    with: {
      admin: true,
      auction: true,
      fishItem: true,
    },
    orderBy: [desc(adminActions.createdAt)],
    limit: 100,
  });

  return actions
    .filter((action) => adminActionMatchesFilters(action, filters))
    .map((action) => ({
      id: action.id,
      adminDisplayName: action.admin.displayName,
      action: action.action,
      auctionId: action.auctionId,
      fishItemId: action.fishItemId,
      fishDisplayName: action.fishItem?.displayName ?? null,
      reason: action.reason,
      createdAt: action.createdAt.toISOString(),
    }));
}

async function recordInventoryStatusChange(
  tx: Transaction,
  input: {
    fishItemId: string;
    auctionId: string | null;
    fromStatus: InventoryLifecycleStatus | null;
    toStatus: InventoryLifecycleStatus;
    changedByUserId: string | null;
    reason: string;
  },
) {
  if (input.fromStatus === input.toStatus) return;

  await tx.insert(inventoryStatusChanges).values({
    fishItemId: input.fishItemId,
    auctionId: input.auctionId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    changedByUserId: input.changedByUserId,
    reason: input.reason,
  });
}

async function recordAdminAction(
  tx: Transaction,
  input: {
    adminUserId: string;
    action: string;
    auctionId: string | null;
    fishItemId: string | null;
    reason: string;
  },
) {
  await tx.insert(adminActions).values(input);
}

function auctionMatchesFilters(
  auction: {
    status: string;
    startsAt: Date;
    closedAt: Date | null;
    fishItem: { species: string; sellerId: string };
    bids: Array<{ bidderId: string }>;
    sales: Array<{ buyerId: string }>;
  },
  filters?: AdminFilters,
) {
  if (!filters) return true;
  if (filters.status && auction.status !== filters.status) return false;
  if (filters.species && auction.fishItem.species !== filters.species) return false;
  if (filters.sellerId && auction.fishItem.sellerId !== filters.sellerId) return false;
  if (
    filters.buyerId &&
    !auction.bids.some((bid) => bid.bidderId === filters.buyerId) &&
    !auction.sales.some((sale) => sale.buyerId === filters.buyerId)
  ) {
    return false;
  }
  return dateMatches(auction.closedAt ?? auction.startsAt, filters);
}

function bidMatchesFilters(
  bid: {
    bidderId: string;
    acceptedAt: Date;
    auction: { status: string; fishItem: { species: string; sellerId: string } };
  },
  filters?: AdminFilters,
) {
  if (!filters) return true;
  if (filters.status && bid.auction.status !== filters.status) return false;
  if (filters.species && bid.auction.fishItem.species !== filters.species) return false;
  if (filters.sellerId && bid.auction.fishItem.sellerId !== filters.sellerId) return false;
  if (filters.buyerId && bid.bidderId !== filters.buyerId) return false;
  return dateMatches(bid.acceptedAt, filters);
}

function saleMatchesFilters(
  sale: {
    buyerId: string;
    completedAt: Date;
    fishItem: { species: string; sellerId: string };
  },
  filters?: AdminFilters,
) {
  if (!filters) return true;
  if (filters.status && filters.status !== "closed" && filters.status !== "sold") return false;
  if (filters.species && sale.fishItem.species !== filters.species) return false;
  if (filters.sellerId && sale.fishItem.sellerId !== filters.sellerId) return false;
  if (filters.buyerId && sale.buyerId !== filters.buyerId) return false;
  return dateMatches(sale.completedAt, filters);
}

function fishMatchesFilters(
  fish: { status: string; species: string; sellerId: string; updatedAt?: Date },
  filters?: AdminFilters,
) {
  if (!filters) return true;
  if (filters.status && fish.status !== filters.status) return false;
  if (filters.species && fish.species !== filters.species) return false;
  if (filters.sellerId && fish.sellerId !== filters.sellerId) return false;
  if (filters.buyerId) return false;
  return fish.updatedAt ? dateMatches(fish.updatedAt, filters) : true;
}

function statusChangeMatchesFilters(
  change: {
    toStatus: string;
    createdAt: Date;
    fishItem: { species: string; sellerId: string };
  },
  filters?: AdminFilters,
) {
  if (!filters) return true;
  if (filters.status && change.toStatus !== filters.status) return false;
  if (filters.species && change.fishItem.species !== filters.species) return false;
  if (filters.sellerId && change.fishItem.sellerId !== filters.sellerId) return false;
  if (filters.buyerId) return false;
  return dateMatches(change.createdAt, filters);
}

function adminActionMatchesFilters(
  action: {
    action: string;
    createdAt: Date;
    auction: { status: string } | null;
    fishItem: { species: string; sellerId: string } | null;
  },
  filters?: AdminFilters,
) {
  if (!filters) return true;
  if (filters.status && !adminActionMatchesStatus(action, filters.status)) return false;
  if (filters.buyerId) return false;
  if (filters.species && action.fishItem?.species !== filters.species) return false;
  if (filters.sellerId && action.fishItem?.sellerId !== filters.sellerId) return false;
  return dateMatches(action.createdAt, filters);
}

function adminActionMatchesStatus(
  action: {
    action: string;
    auction: { status: string } | null;
    fishItem: { status?: string } | null;
  },
  status: string,
) {
  if (action.fishItem?.status === status || action.auction?.status === status) {
    return true;
  }
  if (
    action.action === "close_auction" &&
    status === "sold" &&
    action.fishItem?.status === "sold"
  ) {
    return true;
  }
  return false;
}

function dateMatches(date: Date, filters: AdminFilters) {
  if (filters.fromDate && date < filters.fromDate) return false;
  if (filters.toDate) {
    const toDateInclusive = new Date(filters.toDate);
    toDateInclusive.setDate(toDateInclusive.getDate() + 1);
    if (date >= toDateInclusive) return false;
  }
  return true;
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
