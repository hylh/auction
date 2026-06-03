import { describe, expect, it } from "vitest";
import { evaluateBid } from "./bid-rules";

const baseBid = {
  amountCents: 1200,
  expectedHighestBidCents: null,
  currentHighestBidCents: null,
  startingPriceCents: 1000,
  minimumIncrementCents: 100,
  auctionStatus: "active",
  startsAt: new Date("2026-01-01T10:00:00Z"),
  endsAt: new Date("2026-01-01T12:00:00Z"),
  now: new Date("2026-01-01T11:00:00Z"),
  sellerId: "seller-1",
  bidderId: "buyer-1",
};

describe("evaluateBid", () => {
  it("accepts a first bid at or above starting price", () => {
    expect(evaluateBid(baseBid)).toEqual({
      ok: true,
      nextHighestBidCents: 1200,
    });
  });

  it("rejects stale bids based on the committed highest bid", () => {
    const result = evaluateBid({
      ...baseBid,
      expectedHighestBidCents: 1200,
      currentHighestBidCents: 1300,
      amountCents: 1400,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "STALE_BID",
      currentHighestBidCents: 1300,
    });
  });

  it("rejects sellers bidding on their own auction", () => {
    expect(
      evaluateBid({
        ...baseBid,
        bidderId: "seller-1",
      }),
    ).toMatchObject({
      ok: false,
      code: "SELLER_OWN_AUCTION",
    });
  });

  it("rejects bids below the minimum increment over the current highest bid", () => {
    expect(
      evaluateBid({
        ...baseBid,
        expectedHighestBidCents: 1200,
        currentHighestBidCents: 1200,
        amountCents: 1250,
      }),
    ).toMatchObject({
      ok: false,
      code: "INSUFFICIENT_INCREMENT",
    });
  });

  it("rejects auctions outside the active time window", () => {
    expect(
      evaluateBid({
        ...baseBid,
        now: new Date("2026-01-01T12:00:00Z"),
      }),
    ).toMatchObject({
      ok: false,
      code: "AUCTION_NOT_ACTIVE",
    });
  });
});
