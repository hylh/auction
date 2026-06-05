import { trace } from "@opentelemetry/api";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { auctions, bids, fishItems, rejectedBids, users } from "../db/schema";
import { evaluateBid } from "../domain/bid-rules";
import { publishAuctionEvent, type BidRejectedEvent, type BidSnapshot } from "../domain/events";
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
import {
  advanceAuctionLifecycle,
  closeAuctionInTransaction,
  publishCloseResult,
} from "./auction-lifecycle";
import { toFishSummary, toUserSummary } from "./auction-mappers";
import type { AuctionSummary, CloseAuctionResult, PlaceBidResult } from "./auction-types";

const tracer = trace.getTracer("fish-auction");

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

        const bidder = await tx.query.users.findFirst({
          where: eq(users.id, data.bidderId),
        });

        if (!bidder) {
          throw new Error(`Bidder ${data.bidderId} was not found`);
        }

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
          await tx.insert(rejectedBids).values({
            auctionId: data.auctionId,
            bidderId: data.bidderId,
            amountCents: data.amountCents,
            code: bidDecision.code,
            reason: bidDecision.message,
          });

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
    publishAuctionEvent(result.event);
    logInfo("bid.accepted", {
      auctionId: result.event.auctionId,
      bidId: result.event.bid.bidId,
      amountCents: result.event.bid.amountCents,
    });
  } else {
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
    await assertAdminUser(tx, data.adminUserId, "Only admins can withdraw fish inventory");

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
