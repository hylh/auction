import { describe, expect, it } from "vitest";
import { publishAuctionEvent, subscribeToAuction } from "./events";
import type { BidAcceptedEvent } from "./events";

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
