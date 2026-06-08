import { desc, eq } from "drizzle-orm";
import type { db } from "../db/client";
import { bids } from "../db/schema";
import type { Transaction } from "./auction-audit";

type BidReader = typeof db | Transaction;

export const highestBidOrder = [desc(bids.amountCents), desc(bids.acceptedAt)];

export function findHighestBid(client: BidReader, auctionId: string) {
  return client.query.bids.findFirst({
    where: eq(bids.auctionId, auctionId),
    orderBy: highestBidOrder,
  });
}

export function findHighestBidWithBidder(client: BidReader, auctionId: string) {
  return client.query.bids.findFirst({
    where: eq(bids.auctionId, auctionId),
    with: {
      bidder: true,
    },
    orderBy: highestBidOrder,
  });
}
