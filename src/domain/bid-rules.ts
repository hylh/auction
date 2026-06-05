import { nextMinimumBidCents } from "./bid-builder";

export type BidErrorCode =
  | "STALE_BID"
  | "AUCTION_NOT_ACTIVE"
  | "SELLER_OWN_AUCTION"
  | "INSUFFICIENT_INCREMENT"
  | "INVALID_AMOUNT";

export type BidRuleInput = {
  amountCents: number;
  expectedHighestBidCents: number | null;
  currentHighestBidCents: number | null;
  startingPriceCents: number;
  minimumIncrementCents: number;
  auctionStatus: string;
  startsAt: Date;
  endsAt: Date;
  now: Date;
  sellerId: string;
  bidderId: string;
};

export type BidRuleResult =
  | {
      ok: true;
      nextHighestBidCents: number;
    }
  | {
      ok: false;
      code: BidErrorCode;
      message: string;
      currentHighestBidCents: number | null;
    };

export function evaluateBid(input: BidRuleInput): BidRuleResult {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return reject("INVALID_AMOUNT", "Bid amount must be a positive integer number of cents", input);
  }

  const activeByClock = input.startsAt <= input.now && input.endsAt > input.now;
  if (input.auctionStatus !== "active" || !activeByClock) {
    return reject("AUCTION_NOT_ACTIVE", "Only active auctions accept bids", input);
  }

  if (input.sellerId === input.bidderId) {
    return reject("SELLER_OWN_AUCTION", "Sellers cannot bid on their own fish", input);
  }

  if (input.expectedHighestBidCents !== input.currentHighestBidCents) {
    return reject(
      "STALE_BID",
      "The current highest bid changed before this bid was accepted",
      input,
    );
  }

  const floor = nextMinimumBidCents(input);

  if (input.amountCents < floor) {
    return reject("INSUFFICIENT_INCREMENT", `Bid must be at least ${floor} cents`, input);
  }

  return {
    ok: true,
    nextHighestBidCents: input.amountCents,
  };
}

function reject(code: BidErrorCode, message: string, input: BidRuleInput): BidRuleResult {
  return {
    ok: false,
    code,
    message,
    currentHighestBidCents: input.currentHighestBidCents,
  };
}
