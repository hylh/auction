import { DEMO_USERS } from "../domain/constants";

const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:3000";

const options = {
  auctionCount: numberArg("--auction-count", "--auctions") ?? 1,
  bidCount: numberArg("--bid-count", "--bids") ?? Number(process.env.BID_COUNT ?? "3"),
  intervalMs: numberArg("--interval-ms") ?? Number(process.env.BID_INTERVAL_MS ?? "1000"),
  durationMinutes: numberArg("--duration-minutes") ?? 30,
  rejectionRate: numberArg("--rejection-rate") ?? 0.25,
  seed: numberArg("--seed") ?? Number(process.env.SIMULATOR_SEED ?? "20260604"),
  buyerIds: buyerIdsFromMix(getArg("--buyer-mix") ?? "all"),
  closeAuctions: !hasFlag("--no-close"),
};

async function main() {
  const beforeMetrics = await fetchMetrics();
  const response = await fetch(`${appOrigin}/api/simulate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Simulator request failed with ${response.status}: ${text}`);
  }

  const afterMetrics = await fetchMetrics();
  console.info(
    JSON.stringify(
      {
        simulator: JSON.parse(text) as unknown,
        metricsDelta: diffMetrics(beforeMetrics, afterMetrics),
      },
      null,
      2,
    ),
  );
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

async function fetchMetrics() {
  try {
    const response = await fetch(`${appOrigin}/metrics`);
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
