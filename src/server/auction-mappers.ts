import type { BidSnapshot } from "../domain/events";
import type { DemoUser, FishSummary } from "./auction-types";

export function toBidSnapshot(bid: {
  id: string;
  amountCents: number;
  acceptedAt: Date;
  bidder: { displayName: string };
}): BidSnapshot {
  return {
    bidId: bid.id,
    amountCents: bid.amountCents,
    bidderDisplayName: bid.bidder.displayName,
    acceptedAt: bid.acceptedAt.toISOString(),
  };
}

export function toFishSummary(fish: {
  id: string;
  species: string;
  displayName: string;
  weightGrams: number;
  catchRegion: string;
  grade: string;
  startingPriceCents: number;
  currency: string;
  status: string;
}): FishSummary {
  return {
    id: fish.id,
    species: fish.species,
    displayName: fish.displayName,
    weightGrams: fish.weightGrams,
    catchRegion: fish.catchRegion,
    grade: fish.grade,
    startingPriceCents: fish.startingPriceCents,
    currency: fish.currency,
    status: fish.status,
  };
}

export function toUserSummary(user: {
  id: string;
  displayName: string;
  role: "seller" | "buyer" | "admin";
}): DemoUser {
  return {
    id: user.id,
    displayName: user.displayName,
    role: user.role,
  };
}
