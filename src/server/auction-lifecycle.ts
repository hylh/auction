import { and, asc, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db/client";
import { auctions, bids, fishItems, sales } from "../db/schema";
import { CURRENCY } from "../domain/constants";
import {
  publishAuctionEvent,
  type AuctionClosedEvent,
  type SaleCompletedEvent,
} from "../domain/events";
import { logInfo } from "../domain/logger";
import { incrementMetric } from "../domain/metrics";
import { recordAdminAction, recordInventoryStatusChange, type Transaction } from "./auction-audit";
import type {
  AuctionLifecycleStatus,
  CloseAuctionResult,
  CloseReason,
  InventoryLifecycleStatus,
} from "./auction-types";

type AuctionForClose = {
  id: string;
  status: AuctionLifecycleStatus;
  endsAt: Date;
  fishItemId: string;
  fishItem: {
    status: InventoryLifecycleStatus;
    sellerId: string;
  };
};

type WinningBid = {
  id: string;
  bidderId: string;
  amountCents: number;
};

type CloseAuctionInput = {
  auctionId: string;
  adminUserId: string | null;
  now: Date;
  reason: CloseReason;
};

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

export async function closeAuctionInTransaction(
  tx: Transaction,
  input: CloseAuctionInput,
): Promise<CloseAuctionResult> {
  await tx.execute(sql`select id from auctions where id = ${input.auctionId} for update`);

  const auction = await loadAuctionForClose(tx, input.auctionId);
  if (!auction) {
    throw new Error(`Auction ${input.auctionId} was not found`);
  }
  if (isFinishedAuctionStatus(auction.status)) {
    return unchangedCloseResult(auction.id, auction.status);
  }

  assertAuctionCanClose(auction, input);
  const winningBid = await tx.query.bids.findFirst({
    where: eq(bids.auctionId, input.auctionId),
    orderBy: [desc(bids.amountCents), desc(bids.acceptedAt)],
  });

  return winningBid
    ? closeAuctionWithWinningBid(tx, input, auction, winningBid)
    : closeAuctionWithoutBids(tx, input, auction);
}

export function publishCloseResult(result: CloseAuctionResult) {
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

async function loadAuctionForClose(tx: Transaction, auctionId: string) {
  return tx.query.auctions.findFirst({
    where: eq(auctions.id, auctionId),
    with: {
      fishItem: true,
    },
  });
}

function isFinishedAuctionStatus(status: AuctionLifecycleStatus) {
  return status === "closed" || status === "unsold" || status === "withdrawn";
}

function unchangedCloseResult(
  auctionId: string,
  status: AuctionLifecycleStatus,
): CloseAuctionResult {
  return {
    auctionId,
    status,
    changed: false,
    closedEvent: null,
    saleEvent: null,
  };
}

function assertAuctionCanClose(auction: AuctionForClose, input: CloseAuctionInput) {
  if (auction.status === "scheduled" && input.reason === "manual") {
    throw new Error("Only active auctions can be closed manually");
  }
  if (input.reason === "expired" && auction.endsAt > input.now) {
    throw new Error("Only expired auctions can be closed automatically");
  }
  if (auction.status !== "active" && auction.status !== "scheduled") {
    throw new Error("Only active or expired scheduled auctions can be closed");
  }
}

async function closeAuctionWithoutBids(
  tx: Transaction,
  input: CloseAuctionInput,
  auction: AuctionForClose,
): Promise<CloseAuctionResult> {
  const closedAt = input.now;
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

  return {
    auctionId: input.auctionId,
    status: "unsold",
    changed: true,
    closedEvent: auctionClosedEvent(input.auctionId, "unsold", closedAt),
    saleEvent: null,
  };
}

async function closeAuctionWithWinningBid(
  tx: Transaction,
  input: CloseAuctionInput,
  auction: AuctionForClose,
  winningBid: WinningBid,
): Promise<CloseAuctionResult> {
  const closedAt = input.now;
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

  return {
    auctionId: input.auctionId,
    status: "closed",
    changed: true,
    closedEvent: auctionClosedEvent(input.auctionId, "closed", closedAt),
    saleEvent: saleCompletedEvent(input.auctionId, sale.id, sale.amountCents, sale.completedAt),
  };
}

function auctionClosedEvent(
  auctionId: string,
  status: "closed" | "unsold",
  closedAt: Date,
): AuctionClosedEvent {
  return {
    type: "auction.closed",
    auctionId,
    status,
    closedAt: closedAt.toISOString(),
  };
}

function saleCompletedEvent(
  auctionId: string,
  saleId: string,
  amountCents: number,
  completedAt: Date,
): SaleCompletedEvent {
  return {
    type: "sale.completed",
    auctionId,
    saleId,
    amountCents,
    completedAt: completedAt.toISOString(),
  };
}
