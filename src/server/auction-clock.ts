import { and, asc, eq, gt, inArray, lte } from "drizzle-orm";
import { db } from "../db/client";
import { auctions } from "../db/schema";
import { logInfo } from "../domain/logger";
import { closeAuctionInTransaction, publishCloseResult } from "./auction-lifecycle";
import type { CloseAuctionResult } from "./auction-types";

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
