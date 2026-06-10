import { DEMO_USERS } from "../domain/constants";
import type { SimulatorSummary } from "../server/simulator-service";

const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:3015";

const runSeconds =
  numberArg("--run-seconds", "--load-duration-seconds") ??
  Number(process.env.SIMULATOR_RUN_SECONDS ?? "60");
const auctionIntervalMs =
  numberArg("--auction-interval-ms") ?? Number(process.env.AUCTION_INTERVAL_MS ?? "10000");
const bidIntervalMs =
  numberArg("--bid-interval-ms", "--interval-ms") ?? Number(process.env.BID_INTERVAL_MS ?? "1000");

const existingAuctionIds = listArg("--auction-ids", "--auctionIds");
const explicitAuctionCount = numberArg("--auction-count", "--auctions");
const bidRounds = numberArg("--bid-rounds");

const options = {
  runSeconds,
  auctionIntervalMs,
  bidIntervalMs,
  maxAuctions:
    explicitAuctionCount ??
    (existingAuctionIds.length > 0 ? 0 : auctionsForRun(runSeconds, auctionIntervalMs)),
  maxBids:
    numberArg("--bid-count", "--bids") ??
    Number(process.env.BID_COUNT ?? bidsForRun(runSeconds, bidIntervalMs).toString()),
  auctionDurationMinutes: numberArg("--duration-minutes") ?? 30,
  rejectionRate: numberArg("--rejection-rate") ?? 0.25,
  seed: numberArg("--seed") ?? Number(process.env.SIMULATOR_SEED ?? "20260604"),
  buyerIds: buyerIdsFromMix(getArg("--buyer-mix") ?? "all"),
  closeAuctions: hasFlag("--close"),
  existingAuctionIds,
  bidRounds,
};

async function main() {
  if (options.bidRounds !== undefined) {
    await runBatchMode();
    return;
  }

  await runLoadProfileMode();
}

async function runLoadProfileMode() {
  const beforeMetrics = await fetchMetrics();
  const summary = emptySummary(options.seed);
  const auctionIds: Array<string> = [...options.existingAuctionIds];
  const startedAt = Date.now();
  const endsAt = startedAt + options.runSeconds * 1000;
  let nextAuctionAt = startedAt;
  let nextBidAt = startedAt;
  let createdAuctions = 0;
  let placedBids = 0;

  while (
    Date.now() < endsAt &&
    (createdAuctions < options.maxAuctions || placedBids < options.maxBids)
  ) {
    const now = Date.now();
    const shouldCreateAuction = createdAuctions < options.maxAuctions && now >= nextAuctionAt;
    const shouldPlaceBid =
      placedBids < options.maxBids && auctionIds.length > 0 && now >= nextBidAt;

    if (shouldCreateAuction) {
      await createAuctionPulse(summary, auctionIds, createdAuctions);
      createdAuctions += 1;
      nextAuctionAt += options.auctionIntervalMs;
    }

    if (shouldPlaceBid) {
      await placeBidPulse(summary, auctionIds, placedBids);
      placedBids += 1;
      nextBidAt += options.bidIntervalMs;
    }

    const nextWorkAt = Math.min(
      createdAuctions < options.maxAuctions ? nextAuctionAt : endsAt,
      placedBids < options.maxBids && auctionIds.length > 0 ? nextBidAt : endsAt,
      endsAt,
    );
    const waitMs = Math.max(0, nextWorkAt - Date.now());
    if (waitMs > 0) {
      await delay(waitMs);
    }
  }

  await closeAuctionPulse(summary, auctionIds);

  recomputeTotals(summary);
  const afterMetrics = await fetchMetrics();
  printLoadProfileSummary(summary, beforeMetrics, afterMetrics, createdAuctions, placedBids);
}

async function createAuctionPulse(
  summary: SimulatorSummary,
  auctionIds: Array<string>,
  createdAuctions: number,
) {
  mergeSummary(
    summary,
    await postSimulation({
      auctionCount: 1,
      bidCount: 0,
      intervalMs: 0,
      durationMinutes: options.auctionDurationMinutes,
      rejectionRate: options.rejectionRate,
      seed: options.seed + createdAuctions,
      buyerIds: options.buyerIds,
      closeAuctions: false,
    }),
  );
  auctionIds.push(...summary.createdAuctions.slice(createdAuctions).map((auction) => auction.id));
}

async function placeBidPulse(
  summary: SimulatorSummary,
  auctionIds: Array<string>,
  placedBids: number,
) {
  mergeSummary(
    summary,
    await postSimulation({
      auctionCount: 0,
      bidCount: 1,
      intervalMs: 0,
      durationMinutes: options.auctionDurationMinutes,
      rejectionRate: options.rejectionRate,
      seed: options.seed + options.maxAuctions + placedBids,
      buyerIds: buyerIdsForBid(placedBids, options.buyerIds),
      auctionIds: [auctionIds[placedBids % auctionIds.length]],
      closeAuctions: false,
    }),
  );
}

async function closeAuctionPulse(summary: SimulatorSummary, auctionIds: Array<string>) {
  if (!options.closeAuctions || auctionIds.length === 0) {
    return;
  }

  for (const auctionId of auctionIds) {
    mergeSummary(
      summary,
      await postSimulation({
        auctionCount: 0,
        bidCount: 0,
        intervalMs: 0,
        durationMinutes: options.auctionDurationMinutes,
        rejectionRate: options.rejectionRate,
        auctionIds: [auctionId],
        closeAuctions: true,
      }),
    );
  }
}

function printLoadProfileSummary(
  summary: SimulatorSummary,
  beforeMetrics: Map<string, number>,
  afterMetrics: Map<string, number>,
  createdAuctions: number,
  placedBids: number,
) {
  console.info(
    JSON.stringify(
      {
        loadProfile: {
          runSeconds: options.runSeconds,
          auctionIntervalMs: options.auctionIntervalMs,
          bidIntervalMs: options.bidIntervalMs,
          createdAuctions,
          placedBids,
          closeAuctions: options.closeAuctions,
        },
        simulator: summary,
        metricsDelta: diffMetrics(beforeMetrics, afterMetrics),
      },
      null,
      2,
    ),
  );
}

async function runBatchMode() {
  const beforeMetrics = await fetchMetrics();
  // runSeconds-derived auction counts are meaningless in batch mode, so default to a
  // small explicit count and keep it within the /api/simulate schema cap.
  const batchAuctionCount = Math.min(
    10,
    explicitAuctionCount ?? (options.existingAuctionIds.length > 0 ? 0 : 1),
  );
  const summary = await postSimulation({
    auctionCount: batchAuctionCount,
    bidCount: 0,
    bidRounds: options.bidRounds,
    durationMinutes: options.auctionDurationMinutes,
    rejectionRate: options.rejectionRate,
    seed: options.seed,
    buyerIds: options.buyerIds,
    auctionIds: options.existingAuctionIds.length > 0 ? options.existingAuctionIds : undefined,
    closeAuctions: options.closeAuctions,
  });
  const afterMetrics = await fetchMetrics();

  console.info(
    JSON.stringify(
      {
        mode: "batch",
        bidRounds: options.bidRounds,
        targetedAuctionIds: options.existingAuctionIds,
        createdAuctions: batchAuctionCount,
        simulator: summary,
        metricsDelta: diffMetrics(beforeMetrics, afterMetrics),
      },
      null,
      2,
    ),
  );
}

async function postSimulation(payload: Record<string, unknown>) {
  const response = await fetch(`${appOrigin}/api/simulate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Simulator request failed with ${response.status}: ${text}`);
  }

  return JSON.parse(text) as SimulatorSummary;
}

function emptySummary(seed: number): SimulatorSummary {
  return {
    seed,
    createdFish: [],
    createdAuctions: [],
    bids: [],
    closedAuctions: [],
    totals: {
      acceptedBids: 0,
      rejectedBids: 0,
      closedAuctions: 0,
      completedSales: 0,
    },
  };
}

function mergeSummary(target: SimulatorSummary, source: SimulatorSummary) {
  target.createdFish.push(...source.createdFish);
  target.createdAuctions.push(...source.createdAuctions);
  target.bids.push(...source.bids);
  target.closedAuctions.push(...source.closedAuctions);
  recomputeTotals(target);
}

function recomputeTotals(summary: SimulatorSummary) {
  summary.totals = {
    acceptedBids: summary.bids.filter((bid) => bid.result.ok).length,
    rejectedBids: summary.bids.filter((bid) => !bid.result.ok).length,
    closedAuctions: summary.closedAuctions.filter((result) => result.changed).length,
    completedSales: summary.closedAuctions.filter((result) => result.saleEvent !== null).length,
  };
}

function getArg(...names: Array<string>) {
  for (const name of names) {
    const index = process.argv.indexOf(name);
    if (index !== -1) {
      return process.argv[index + 1];
    }
  }
  return undefined;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function numberArg(...names: Array<string>) {
  const value = getArg(...names);
  return value === undefined ? undefined : Number(value);
}

function listArg(...names: Array<string>) {
  const value = getArg(...names);
  if (value === undefined) {
    return [];
  }
  return value
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function buyerIdsFromMix(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "all") return undefined;
  if (normalized === "oslo") return [DEMO_USERS.buyerOslo];
  if (normalized === "bergen") return [DEMO_USERS.buyerBergen];

  return normalized.split(",").map((entry) => {
    const buyer = entry.trim();
    if (buyer === "oslo") return DEMO_USERS.buyerOslo;
    if (buyer === "bergen") return DEMO_USERS.buyerBergen;
    return buyer;
  });
}

function buyerIdsForBid(index: number, buyerIds: Array<string> | undefined) {
  const selectedBuyerIds = buyerIds ?? [DEMO_USERS.buyerOslo, DEMO_USERS.buyerBergen];
  return [selectedBuyerIds[index % selectedBuyerIds.length]];
}

async function fetchMetrics() {
  try {
    const response = await fetch(`${appOrigin}/metrics?format=prometheus`);
    if (!response.ok) {
      console.warn(`Metrics scrape failed with ${response.status}`);
      return new Map<string, number>();
    }
    return parseMetrics(await response.text());
  } catch (error) {
    console.warn(`Metrics scrape failed: ${(error as Error).message}`);
    return new Map<string, number>();
  }
}

function parseMetrics(text: string) {
  const metrics = new Map<string, number>();
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;

    const [name, value] = line.split(/\s+/, 2);
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      metrics.set(name, parsed);
    }
  }
  return metrics;
}

function diffMetrics(before: Map<string, number>, after: Map<string, number>) {
  const diff: Record<string, number> = {};
  for (const [name, value] of after) {
    const delta = value - (before.get(name) ?? 0);
    if (delta !== 0) {
      diff[name] = delta;
    }
  }
  return diff;
}

function auctionsForRun(durationSeconds: number, intervalMs: number) {
  return Math.max(1, Math.ceil((durationSeconds * 1000) / intervalMs));
}

function bidsForRun(durationSeconds: number, intervalMs: number) {
  return Math.max(1, Math.ceil((durationSeconds * 1000) / intervalMs));
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
