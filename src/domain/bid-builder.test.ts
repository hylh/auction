import { describe, expect, it } from "vitest";
import { buildValidBidInput, nextMinimumBidCents } from "./bid-builder";

describe("nextMinimumBidCents", () => {
  it("uses the starting price when there is no current highest bid", () => {
    expect(
      nextMinimumBidCents({
        currentHighestBidCents: null,
        startingPriceCents: 1000,
        minimumIncrementCents: 100,
      }),
    ).toBe(1000);
  });

  it("adds the minimum increment to the current highest bid", () => {
    expect(
      nextMinimumBidCents({
        currentHighestBidCents: 1500,
        startingPriceCents: 1000,
        minimumIncrementCents: 100,
      }),
    ).toBe(1600);
  });

  it("treats a zero current highest bid as an existing bid, not a missing one", () => {
    expect(
      nextMinimumBidCents({
        currentHighestBidCents: 0,
        startingPriceCents: 1000,
        minimumIncrementCents: 100,
      }),
    ).toBe(100);
  });
});

describe("buildValidBidInput", () => {
  it("builds a first bid at the starting price floor", () => {
    expect(
      buildValidBidInput({
        auctionId: "auction-1",
        bidderId: "buyer-1",
        currentHighestBidCents: null,
        startingPriceCents: 1000,
        minimumIncrementCents: 100,
      }),
    ).toEqual({
      auctionId: "auction-1",
      bidderId: "buyer-1",
      amountCents: 1000,
      expectedHighestBidCents: null,
    });
  });

  it("raises the amount by the requested number of increment steps", () => {
    expect(
      buildValidBidInput({
        auctionId: "auction-1",
        bidderId: "buyer-1",
        currentHighestBidCents: 1500,
        startingPriceCents: 1000,
        minimumIncrementCents: 100,
        incrementSteps: 2,
      }),
    ).toEqual({
      auctionId: "auction-1",
      bidderId: "buyer-1",
      amountCents: 1800,
      expectedHighestBidCents: 1500,
    });
  });

  it("never drops below the floor for negative increment steps", () => {
    expect(
      buildValidBidInput({
        auctionId: "auction-1",
        bidderId: "buyer-1",
        currentHighestBidCents: 1500,
        startingPriceCents: 1000,
        minimumIncrementCents: 100,
        incrementSteps: -5,
      }).amountCents,
    ).toBe(1600);
  });
});
