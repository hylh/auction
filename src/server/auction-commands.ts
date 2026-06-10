import { trace } from "@opentelemetry/api";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { auctions, bids, fishItems, rejectedBids, users } from "../db/schema";
import { evaluateBid, type BidRuleResult } from "../domain/bid-rules";
import {
  bidAcceptedEvent,
  bidRejectedEvent,
  publishAuctionEvent,
  type BidSnapshot,
} from "../domain/events";
import { logInfo, logWarn } from "../domain/logger";
import { observeBidMutationDuration } from "../domain/metrics";
import { centsFromMajor } from "../domain/money";
import {
  auctionInputSchema,
  bidInputSchema,
  closeAuctionInputSchema,
  fishInputSchema,
  withdrawAuctionInputSchema,
  withdrawFishItemInputSchema,
} from "../domain/validation";
import { gramsFromKilograms } from "../domain/weight";
import { assertAdminUser, recordAdminAction, recordInventoryStatusChange } from "./auction-audit";
import { advanceAuctionLifecycle } from "./auction-clock";
import { closeAuctionInTransaction, publishCloseResult } from "./auction-lifecycle";
import { toFishSummary, toUserSummary } from "./auction-mappers";
import { findHighestBidWithBidder } from "./bid-selection";
import { lockAuctionRow, lockFishItemRow } from "./row-locks";
import type { AuctionSummary, CloseAuctionResult, PlaceBidResult } from "./auction-types";

const tracer = trace.getTracer("fish-auction");

type AuctionCommandTx = Parameters<typeof lockAuctionRow>[0];
type AuctionInputData = ReturnType<(typeof auctionInputSchema)["parse"]>;
type BidInputData = ReturnType<(typeof bidInputSchema)["parse"]>;
type RejectedBidDecision = Extract<BidRuleResult, { ok: false }>;

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
    await assertAdminUser(tx, data.adminUserId, "Only admins can create auctions");

    const fish = await loadAuctionableFish(tx, data.fishItemId);
    const initialStatus = data.startsAt <= now && now < data.endsAt ? "active" : "scheduled";
    const auction = await insertAuctionRecord(tx, data, fish.id, initialStatus);

    await markFishInAuction(tx, fish.id, now);
    await recordAuctionCreationAudit(tx, data, fish.id, fish.status, auction.id);

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

  logInfo("auction.created", {
    auctionId: createdAuction.id,
    fishItemId: data.fishItemId,
    status: createdAuction.status,
  });

  return createdAuction;
}

async function loadAuctionableFish(tx: AuctionCommandTx, fishItemId: string) {
  await lockFishItemRow(tx, fishItemId);

  const fish = await tx.query.fishItems.findFirst({
    where: eq(fishItems.id, fishItemId),
    with: {
      seller: true,
    },
  });

  if (!fish) {
    throw new Error(`Fish item ${fishItemId} was not found`);
  }
  if (fish.status !== "listed") {
    throw new Error("Only listed fish inventory can be auctioned");
  }

  return fish;
}

async function insertAuctionRecord(
  tx: AuctionCommandTx,
  data: AuctionInputData,
  fishItemId: string,
  initialStatus: "active" | "scheduled",
) {
  const [auction] = await tx
    .insert(auctions)
    .values({
      fishItemId,
      status: initialStatus,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      minimumIncrementCents: data.minimumIncrementCents,
    })
    .returning();

  return auction;
}

async function markFishInAuction(tx: AuctionCommandTx, fishItemId: string, now: Date) {
  await tx
    .update(fishItems)
    .set({ status: "in_auction", updatedAt: now })
    .where(eq(fishItems.id, fishItemId));
}

async function recordAuctionCreationAudit(
  tx: AuctionCommandTx,
  data: AuctionInputData,
  fishItemId: string,
  fromStatus: "listed",
  auctionId: string,
) {
  await recordInventoryStatusChange(tx, {
    fishItemId,
    auctionId,
    fromStatus,
    toStatus: "in_auction",
    changedByUserId: data.adminUserId,
    reason: "Auction created from listed inventory",
  });
  await recordAdminAction(tx, {
    adminUserId: data.adminUserId,
    action: "create_auction",
    auctionId,
    fishItemId,
    reason: "Auction created from listed inventory",
  });
}

export async function placeBid(input: unknown): Promise<PlaceBidResult> {
  const data = bidInputSchema.parse(input);
  await advanceAuctionLifecycle();

  const started = performance.now();

  const result = await tracer.startActiveSpan("placeBid", async (span) => {
    span.setAttribute("auction.id", data.auctionId);
    span.setAttribute("bid.amount_cents", data.amountCents);

    try {
      return await db.transaction((tx) => placeBidInTransaction(tx, data));
    } finally {
      span.end();
    }
  });

  observeBidMutationDuration(performance.now() - started);
  publishBidResult(result, data);

  return result;
}

async function placeBidInTransaction(
  tx: AuctionCommandTx,
  data: BidInputData,
): Promise<PlaceBidResult> {
  const context = await loadBidContext(tx, data);
  const bidDecision = evaluateBidForContext(data, context);

  if (!bidDecision.ok) {
    return recordRejectedBid(tx, data, bidDecision);
  }

  return recordAcceptedBid(tx, data, context.bidder);
}

async function loadBidContext(tx: AuctionCommandTx, data: BidInputData) {
  await lockAuctionRow(tx, data.auctionId);

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

  const currentHighestBid = await findHighestBidWithBidder(tx, data.auctionId);
  const bidder = await tx.query.users.findFirst({
    where: eq(users.id, data.bidderId),
  });

  if (!bidder) {
    throw new Error(`Bidder ${data.bidderId} was not found`);
  }

  return { auction, currentHighestBid, bidder };
}

type BidContext = Awaited<ReturnType<typeof loadBidContext>>;

function evaluateBidForContext(data: BidInputData, context: BidContext) {
  return evaluateBid({
    amountCents: data.amountCents,
    expectedHighestBidCents: data.expectedHighestBidCents,
    currentHighestBidCents: context.currentHighestBid?.amountCents ?? null,
    startingPriceCents: context.auction.fishItem.startingPriceCents,
    minimumIncrementCents: context.auction.minimumIncrementCents,
    auctionStatus: context.auction.status,
    startsAt: context.auction.startsAt,
    endsAt: context.auction.endsAt,
    now: new Date(),
    sellerId: context.auction.fishItem.sellerId,
    bidderId: data.bidderId,
  });
}

async function recordRejectedBid(
  tx: AuctionCommandTx,
  data: BidInputData,
  bidDecision: RejectedBidDecision,
): Promise<PlaceBidResult> {
  await tx.insert(rejectedBids).values({
    auctionId: data.auctionId,
    bidderId: data.bidderId,
    amountCents: data.amountCents,
    code: bidDecision.code,
    reason: bidDecision.message,
  });

  return {
    ok: false,
    code: bidDecision.code,
    message: bidDecision.message,
    currentHighestBidCents: bidDecision.currentHighestBidCents,
  };
}

async function recordAcceptedBid(
  tx: AuctionCommandTx,
  data: BidInputData,
  bidder: BidContext["bidder"],
): Promise<PlaceBidResult> {
  const [insertedBid] = await tx
    .insert(bids)
    .values({
      auctionId: data.auctionId,
      bidderId: data.bidderId,
      amountCents: data.amountCents,
    })
    .returning();

  const snapshot: BidSnapshot = {
    bidId: insertedBid.id,
    amountCents: insertedBid.amountCents,
    bidderDisplayName: bidder.displayName,
    acceptedAt: insertedBid.acceptedAt.toISOString(),
  };

  return {
    ok: true,
    event: bidAcceptedEvent(data.auctionId, snapshot),
  };
}

function publishBidResult(result: PlaceBidResult, data: BidInputData) {
  if (result.ok) {
    publishAuctionEvent(result.event);
    logInfo("bid.accepted", {
      auctionId: result.event.auctionId,
      bidId: result.event.bid.bidId,
      amountCents: result.event.bid.amountCents,
    });
  } else {
    const event = bidRejectedEvent({
      auctionId: data.auctionId,
      actorUserId: data.bidderId,
      code: result.code,
      message: result.message,
      currentHighestBidCents: result.currentHighestBidCents,
      rejectedAt: new Date(),
    });
    publishAuctionEvent(event);
    logWarn("bid.rejected", {
      auctionId: data.auctionId,
      bidderId: data.bidderId,
      code: result.code,
    });
  }
}

export async function closeAuction(input: unknown): Promise<CloseAuctionResult> {
  const data = closeAuctionInputSchema.parse(input);

  const result = await db.transaction(async (tx) => {
    await assertAdminUser(tx, data.adminUserId, "Only admins can close auctions");

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
    await assertAdminUser(tx, data.adminUserId, "Only admins can withdraw auctions");

    await lockAuctionRow(tx, data.auctionId);

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
    await assertAdminUser(tx, data.adminUserId, "Only admins can withdraw fish inventory");

    await lockFishItemRow(tx, data.fishItemId);

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
