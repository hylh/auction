import { createFileRoute } from "@tanstack/react-router";
import { ZodError } from "zod";
import { DEMO_USERS, FISH_SPECIES } from "../domain/constants";
import { incrementMetric, measureRequest } from "../domain/metrics";
import { simulatorInputSchema, type SimulatorInput } from "../domain/validation";
import {
  closeAuction,
  createAuction,
  createFishItem,
  getDashboardData,
  listDemoUsers,
  placeBid,
  type AuctionSummary,
  type CloseAuctionResult,
  type FishSummary,
  type PlaceBidResult,
} from "../server/auction-service";

type SimulatedBid = {
  auctionId: string;
  bidderId: string;
  amountCents: number;
  intendedOutcome: "accepted" | "rejected";
  result: PlaceBidResult;
};

type SimulatorSummary = {
  seed: number;
  createdFish: Array<FishSummary>;
  createdAuctions: Array<AuctionSummary>;
  bids: Array<SimulatedBid>;
  closedAuctions: Array<CloseAuctionResult>;
  totals: {
    acceptedBids: number;
    rejectedBids: number;
    closedAuctions: number;
    completedSales: number;
  };
};

export const Route = createFileRoute("/api/simulate")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        measureRequest(async () => {
          incrementMetric("simulatorRequests");

          try {
            const body = await request.json().catch(() => ({}));
            const input = simulatorInputSchema.parse(body);
            return Response.json(await runSimulation(input));
          } catch (error) {
            if (error instanceof ZodError) {
              incrementMetric("validationFailures");
              return Response.json(
                {
                  error: "Invalid simulator input",
                  issues: error.issues,
                },
                { status: 400 },
              );
            }
            throw error;
          }
        }),
    },
  },
});

async function runSimulation(input: SimulatorInput): Promise<SimulatorSummary> {
  const random = seededRandom(input.seed);
  const users = await listDemoUsers();
  const sellers = users.filter((user) => user.role === "seller");
  const buyers = users.filter(
    (user) => user.role === "buyer" && (!input.buyerIds || input.buyerIds.includes(user.id)),
  );

  if (sellers.length === 0) {
    throw new Error("Simulator requires at least one seeded seller");
  }
  if (buyers.length === 0) {
    throw new Error("Simulator requires at least one seeded buyer");
  }

  const createdFish: Array<FishSummary> = [];
  const createdAuctions: Array<AuctionSummary> = [];
  const startsAt = new Date(Date.now() - 1_000);
  const endsAt = new Date(Date.now() + input.durationMinutes * 60_000);

  for (let index = 0; index < input.auctionCount; index += 1) {
    const seller = sellers[index % sellers.length];
    const species = FISH_SPECIES[(input.seed + index) % FISH_SPECIES.length];
    const fish = await createFishItem({
      species,
      displayName: `Simulator ${species} lot ${input.seed}-${index + 1}`,
      weightKilograms: 20 + Math.round(random() * 80),
      catchRegion: simulatorRegion(index),
      grade: simulatorGrade(index),
      startingPriceMajor: 700 + Math.round(random() * 2_000),
      sellerId: seller.id,
      description: "Created by pnpm simulate through the application service path.",
      imageUrl: "",
    });
    createdFish.push(fish);

    createdAuctions.push(
      await createAuction({
        fishItemId: fish.id,
        adminUserId: DEMO_USERS.admin,
        startsAt,
        endsAt,
        minimumIncrementCents: 5_000 + (index % 3) * 2_500,
      }),
    );
  }

  const dashboard = await getDashboardData();
  const activeAuctions = createdAuctions.length > 0 ? createdAuctions : dashboard.activeAuctions;
  const bids: Array<SimulatedBid> = [];

  for (let index = 0; index < input.bidCount; index += 1) {
    const auction = activeAuctions[index % activeAuctions.length];
    const buyer = buyers[index % buyers.length];
    if (!auction || !buyer) break;

    const currentHighestBidCents = auction.currentHighestBid?.amountCents ?? null;
    const nextMinimum =
      currentHighestBidCents === null
        ? auction.fish.startingPriceCents
        : currentHighestBidCents + auction.minimumIncrementCents;
    const shouldReject = input.rejectionRate > 0 && random() < input.rejectionRate;
    const amountCents = shouldReject
      ? Math.max(1, nextMinimum - 1)
      : nextMinimum + Math.floor(random() * 3) * auction.minimumIncrementCents;

    const result = await placeBid({
      auctionId: auction.id,
      bidderId: buyer.id,
      amountCents,
      expectedHighestBidCents: currentHighestBidCents,
    });

    if (result.ok) {
      auction.currentHighestBid = result.event.currentHighestBid;
    }

    bids.push({
      auctionId: auction.id,
      bidderId: buyer.id,
      amountCents,
      intendedOutcome: shouldReject ? "rejected" : "accepted",
      result,
    });

    if (input.intervalMs > 0 && index < input.bidCount - 1) {
      await delay(input.intervalMs);
    }
  }

  const closedAuctions = input.closeAuctions
    ? await closeCreatedAuctions(createdAuctions.map((auction) => auction.id))
    : [];

  return {
    seed: input.seed,
    createdFish,
    createdAuctions,
    bids,
    closedAuctions,
    totals: {
      acceptedBids: bids.filter((bid) => bid.result.ok).length,
      rejectedBids: bids.filter((bid) => !bid.result.ok).length,
      closedAuctions: closedAuctions.filter((result) => result.changed).length,
      completedSales: closedAuctions.filter((result) => result.saleEvent !== null).length,
    },
  };
}

async function closeCreatedAuctions(auctionIds: Array<string>) {
  const results: Array<CloseAuctionResult> = [];
  for (const auctionId of auctionIds) {
    try {
      results.push(
        await closeAuction({
          auctionId,
          adminUserId: DEMO_USERS.admin,
        }),
      );
    } catch (error) {
      incrementMetric("closeFailures");
      throw error;
    }
  }
  return results;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x100000000;
  };
}

function simulatorRegion(index: number) {
  const regions = ["Lofoten", "Vestfjorden", "Helgeland", "Møre", "Hardanger"];
  return regions[index % regions.length];
}

function simulatorGrade(index: number) {
  const grades = ["A", "A+", "B+", "Sashimi"];
  return grades[index % grades.length];
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
