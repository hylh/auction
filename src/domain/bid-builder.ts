export type BidFloorInput = {
  currentHighestBidCents: number | null;
  startingPriceCents: number;
  minimumIncrementCents: number;
};

export type BidInput = {
  auctionId: string;
  bidderId: string;
  amountCents: number;
  expectedHighestBidCents: number | null;
};

export function nextMinimumBidCents(input: BidFloorInput): number {
  return input.currentHighestBidCents === null
    ? input.startingPriceCents
    : input.currentHighestBidCents + input.minimumIncrementCents;
}

export function buildValidBidInput(
  params: BidFloorInput & {
    auctionId: string;
    bidderId: string;
    incrementSteps?: number;
  },
): BidInput {
  const floor = nextMinimumBidCents(params);
  const steps = Math.max(0, Math.trunc(params.incrementSteps ?? 0));

  return {
    auctionId: params.auctionId,
    bidderId: params.bidderId,
    amountCents: floor + steps * params.minimumIncrementCents,
    expectedHighestBidCents: params.currentHighestBidCents,
  };
}
