import { describe, expect, it } from "vitest";
import {
  publishAuctionEvent,
  shouldDeliverAuctionEventToSubscriber,
  subscribeToAuction,
} from "./events";
import type { AuctionClosedEvent, BidAcceptedEvent, BidRejectedEvent } from "./events";

describe("auction event broadcaster", () => {
  it("delivers ordered auction events to multiple listeners", () => {
    const auctionId = crypto.randomUUID();
    const first: Array<string> = [];
    const second: Array<string> = [];

    const unsubscribeFirst = subscribeToAuction(auctionId, (event) => {
      if (event.type === "bid.accepted") first.push(event.bid.bidId);
    });
    const unsubscribeSecond = subscribeToAuction(auctionId, (event) => {
      if (event.type === "bid.accepted") second.push(event.bid.bidId);
    });

    publishAuctionEvent(bidEvent(auctionId, "bid-1", 1000));
    publishAuctionEvent(bidEvent(auctionId, "bid-2", 1200));

    expect(first).toEqual(["bid-1", "bid-2"]);
    expect(second).toEqual(["bid-1", "bid-2"]);

    unsubscribeFirst();
    unsubscribeSecond();
  });

  it("only delivers rejected bid events to the acting user", () => {
    const auctionId = crypto.randomUUID();
    const actingUserId = crypto.randomUUID();
    const otherUserId = crypto.randomUUID();
    const rejected = rejectedBidEvent(auctionId, actingUserId);

    expect(shouldDeliverAuctionEventToSubscriber(rejected, actingUserId)).toBe(true);
    expect(shouldDeliverAuctionEventToSubscriber(rejected, otherUserId)).toBe(false);
    expect(shouldDeliverAuctionEventToSubscriber(rejected, null)).toBe(false);
    expect(shouldDeliverAuctionEventToSubscriber(bidEvent(auctionId, "bid-1", 1000), null)).toBe(
      true,
    );
    expect(shouldDeliverAuctionEventToSubscriber(closedEvent(auctionId), otherUserId)).toBe(true);
  });
});

function bidEvent(auctionId: string, bidId: string, amountCents: number): BidAcceptedEvent {
  const bid = {
    bidId,
    amountCents,
    bidderDisplayName: "Buyer",
    acceptedAt: new Date().toISOString(),
  };

  return {
    type: "bid.accepted",
    auctionId,
    bid,
    currentHighestBid: bid,
  };
}

function rejectedBidEvent(auctionId: string, actorUserId: string): BidRejectedEvent {
  return {
    type: "bid.rejected",
    auctionId,
    actorUserId,
    code: "STALE_BID",
    message: "The current highest bid changed before this bid was accepted",
    currentHighestBidCents: 1000,
    rejectedAt: new Date().toISOString(),
  };
}

function closedEvent(auctionId: string): AuctionClosedEvent {
  return {
    type: "auction.closed",
    auctionId,
    status: "closed",
    closedAt: new Date().toISOString(),
  };
}
