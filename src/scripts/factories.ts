import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  adminActions,
  auctions,
  bids,
  fishItems,
  inventoryStatusChanges,
  rejectedBids,
  sales,
  users,
} from "../db/schema";
import { FISH_SPECIES } from "../domain/constants";

export type UserInsert = typeof users.$inferInsert;
export type FishItemInsert = typeof fishItems.$inferInsert;
export type AuctionInsert = typeof auctions.$inferInsert;
export type BidInsert = typeof bids.$inferInsert;
export type RejectedBidInsert = typeof rejectedBids.$inferInsert;
export type SaleInsert = typeof sales.$inferInsert;
export type InventoryStatusChangeInsert = typeof inventoryStatusChanges.$inferInsert;
export type AdminActionInsert = typeof adminActions.$inferInsert;

export type SeedDataset = {
  users: Array<UserInsert>;
  fishItems: Array<FishItemInsert>;
  auctions: Array<AuctionInsert>;
  bids: Array<BidInsert>;
  rejectedBids: Array<RejectedBidInsert>;
  sales: Array<SaleInsert>;
  inventoryStatusChanges: Array<InventoryStatusChangeInsert>;
  adminActions: Array<AdminActionInsert>;
};

type SpeciesProfile = {
  weightGramsRange: [number, number];
  startingPriceCentsRange: [number, number];
  grades: Array<string>;
  displayNames: Array<string>;
};

type ReferenceData = {
  catchRegions: Array<string>;
  sellerNamePrefixes: Array<string>;
  sellerNameSuffixes: Array<string>;
  buyerCities: Array<string>;
  buyerKinds: Array<string>;
  speciesProfiles: Record<string, SpeciesProfile>;
};

const referencePath = join(dirname(fileURLToPath(import.meta.url)), "seed-data", "reference.json");

const reference = JSON.parse(readFileSync(referencePath, "utf8")) as ReferenceData;

const REJECTION_CODES = [
  "INSUFFICIENT_INCREMENT",
  "STALE_BID",
  "SELLER_OWN_AUCTION",
  "INVALID_AMOUNT",
] as const;

const REJECTION_REASONS: Record<(typeof REJECTION_CODES)[number], string> = {
  INSUFFICIENT_INCREMENT: "Bid did not clear the minimum increment",
  STALE_BID: "The current highest bid changed before this bid was accepted",
  SELLER_OWN_AUCTION: "Sellers cannot bid on their own fish",
  INVALID_AMOUNT: "Bid amount must be a positive integer number of cents",
};

type Rng = () => number;

function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(rng: Rng, values: ReadonlyArray<T>): T {
  return values[Math.floor(rng() * values.length)];
}

function shuffle<T>(rng: Rng, values: ReadonlyArray<T>): Array<T> {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(rng() * (index + 1));
    [copy[index], copy[swapWith]] = [copy[swapWith], copy[index]];
  }
  return copy;
}

function seedUuid(prefix8: string, index: number): string {
  const tail = index.toString(16).padStart(12, "0");
  return `${prefix8}-0000-4000-8000-${tail}`;
}

const UUID_PREFIX = {
  seller: "a1a1a1a1",
  buyer: "b2b2b2b2",
  fish: "c3c3c3c3",
  auction: "d4d4d4d4",
  bid: "e5e5e5e5",
  rejected: "f6f6f6f6",
  sale: "a7a7a7a7",
  statusChange: "b8b8b8b8",
  adminAction: "c9c9c9c9",
} as const;

export type FixedUser = {
  id: string;
  displayName: string;
};

type UserPoolInput = {
  sellerCount: number;
  buyerCount: number;
  fixedSellers: Array<FixedUser>;
  fixedBuyers: Array<FixedUser>;
  admin: FixedUser;
};

type UserPool = {
  users: Array<UserInsert>;
  sellerIds: Array<string>;
  buyerIds: Array<string>;
  adminId: string;
};

function buildUserPool(rng: Rng, input: UserPoolInput): UserPool {
  const reservedNames = new Set<string>([
    ...input.fixedSellers.map((user) => user.displayName),
    ...input.fixedBuyers.map((user) => user.displayName),
  ]);

  const sellerNames = shuffle(
    rng,
    cartesian(reference.sellerNamePrefixes, reference.sellerNameSuffixes)
      .map(([prefix, suffix]) => `${prefix} ${suffix}`)
      .filter((name) => !reservedNames.has(name)),
  );
  const buyerNames = shuffle(
    rng,
    cartesian(reference.buyerCities, reference.buyerKinds)
      .map(([city, kind]) => `${city} ${kind}`)
      .filter((name) => !reservedNames.has(name)),
  );

  const users: Array<UserInsert> = [
    { id: input.admin.id, displayName: input.admin.displayName, role: "admin" },
  ];
  const sellerIds: Array<string> = [];
  const buyerIds: Array<string> = [];

  input.fixedSellers.forEach((seller) => {
    users.push({ id: seller.id, displayName: seller.displayName, role: "seller" });
    sellerIds.push(seller.id);
  });
  for (let index = 0; index < input.sellerCount - input.fixedSellers.length; index += 1) {
    const id = seedUuid(UUID_PREFIX.seller, index);
    users.push({ id, displayName: sellerNames[index], role: "seller" });
    sellerIds.push(id);
  }

  input.fixedBuyers.forEach((buyer) => {
    users.push({ id: buyer.id, displayName: buyer.displayName, role: "buyer" });
    buyerIds.push(buyer.id);
  });
  for (let index = 0; index < input.buyerCount - input.fixedBuyers.length; index += 1) {
    const id = seedUuid(UUID_PREFIX.buyer, index);
    users.push({ id, displayName: buyerNames[index], role: "buyer" });
    buyerIds.push(id);
  }

  return { users, sellerIds, buyerIds, adminId: input.admin.id };
}

type AuctionKind = "active" | "closed" | "unsold" | "withdrawn" | "scheduled";

type AuctionPlan = {
  kind: AuctionKind;
  manualClose: boolean;
};

export type DefaultDatasetInput = {
  seed: number;
  sellerCount: number;
  buyerCount: number;
  auctionCount: number;
  fixedSellers: Array<FixedUser>;
  fixedBuyers: Array<FixedUser>;
  admin: FixedUser;
  now?: Date;
};

type SeedCounters = {
  fish: number;
  auction: number;
  bid: number;
  rejected: number;
  sale: number;
  statusChange: number;
  adminAction: number;
};

type DatasetBuildContext = {
  rng: Rng;
  pool: UserPool;
  dataset: SeedDataset;
  counters: SeedCounters;
  minutes: (value: number) => Date;
};

type AuctionSeedBase = {
  sellerId: string;
  species: (typeof FISH_SPECIES)[number];
  profile: SpeciesProfile;
  fishId: string;
  auctionId: string;
  startingPriceCents: number;
  minimumIncrementCents: number;
};

type AuctionSeed = AuctionSeedBase & {
  timing: AuctionTiming;
};

export function buildDefaultDataset(input: DefaultDatasetInput): SeedDataset {
  const rng = createRng(input.seed);
  const now = input.now ?? new Date();
  const minutes = (value: number) => new Date(now.getTime() + value * 60_000);

  const pool = buildUserPool(rng, {
    sellerCount: input.sellerCount,
    buyerCount: input.buyerCount,
    fixedSellers: input.fixedSellers,
    fixedBuyers: input.fixedBuyers,
    admin: input.admin,
  });

  const dataset = createEmptyDataset(pool);
  const counters = createSeedCounters();
  const plans = buildAuctionPlans(rng, input.auctionCount);
  const context: DatasetBuildContext = { rng, pool, dataset, counters, minutes };

  for (const plan of plans) {
    appendAuctionPlan(context, plan);
  }

  appendStandaloneInventory({
    rng,
    dataset,
    pool,
    minutes,
    nextFishIndex: () => {
      const id = seedUuid(UUID_PREFIX.fish, counters.fish);
      counters.fish += 1;
      return id;
    },
    nextStatusChangeIndex: () => {
      const id = seedUuid(UUID_PREFIX.statusChange, counters.statusChange);
      counters.statusChange += 1;
      return id;
    },
  });

  return dataset;
}

function createEmptyDataset(pool: UserPool): SeedDataset {
  return {
    users: pool.users,
    fishItems: [],
    auctions: [],
    bids: [],
    rejectedBids: [],
    sales: [],
    inventoryStatusChanges: [],
    adminActions: [],
  };
}

function createSeedCounters(): SeedCounters {
  return {
    fish: 0,
    auction: 0,
    bid: 0,
    rejected: 0,
    sale: 0,
    statusChange: 0,
    adminAction: 0,
  };
}

function appendAuctionPlan(context: DatasetBuildContext, plan: AuctionPlan) {
  const seedBase = createAuctionSeed(context);
  const seed = appendAuctionInventory(context, plan, seedBase);
  appendAuctionCreationAudit(context, seed);

  const winningBid = appendBidHistory(context, plan, seed);
  appendCompletedSale(context, plan, seed, winningBid);
  appendUnsoldReturn(context, plan, seed);
  appendAuctionWithdrawal(context, plan, seed);
}

function createAuctionSeed(context: DatasetBuildContext): AuctionSeedBase {
  const { rng, pool, counters } = context;
  const sellerId = pool.sellerIds[counters.auction % pool.sellerIds.length];
  const species = pick(rng, FISH_SPECIES);
  const profile = reference.speciesProfiles[species];
  const fishId = seedUuid(UUID_PREFIX.fish, counters.fish);
  counters.fish += 1;
  const auctionId = seedUuid(UUID_PREFIX.auction, counters.auction);
  counters.auction += 1;

  return {
    sellerId,
    species,
    profile,
    fishId,
    auctionId,
    startingPriceCents: roundToHundred(
      randInt(rng, profile.startingPriceCentsRange[0], profile.startingPriceCentsRange[1]),
    ),
    minimumIncrementCents: pick(rng, [2500, 5000, 7500, 10000]),
  };
}

function appendAuctionInventory(
  { rng, dataset, minutes }: DatasetBuildContext,
  plan: AuctionPlan,
  seed: AuctionSeedBase,
): AuctionSeed {
  dataset.fishItems.push({
    id: seed.fishId,
    species: seed.species,
    displayName: `${pick(rng, seed.profile.displayNames)} #${dataset.fishItems.length + 1}`,
    weightGrams: randInt(rng, seed.profile.weightGramsRange[0], seed.profile.weightGramsRange[1]),
    catchRegion: pick(rng, reference.catchRegions),
    grade: pick(rng, seed.profile.grades),
    startingPriceCents: seed.startingPriceCents,
    sellerId: seed.sellerId,
    status: fishStatusForKind(plan.kind),
    description: "Seeded fish auction history.",
  });

  const timing = auctionTiming(rng, plan.kind, minutes);
  dataset.auctions.push({
    id: seed.auctionId,
    fishItemId: seed.fishId,
    status: plan.kind,
    startsAt: timing.startsAt,
    endsAt: timing.endsAt,
    minimumIncrementCents: seed.minimumIncrementCents,
    closedAt: timing.closedAt,
  });

  return { ...seed, timing };
}

function appendAuctionCreationAudit(
  { dataset, counters, pool }: DatasetBuildContext,
  seed: AuctionSeed,
) {
  dataset.inventoryStatusChanges.push({
    id: seedUuid(UUID_PREFIX.statusChange, counters.statusChange),
    fishItemId: seed.fishId,
    auctionId: seed.auctionId,
    fromStatus: "listed",
    toStatus: "in_auction",
    changedByUserId: pool.adminId,
    reason: "Auction created from listed inventory",
    createdAt: seed.timing.createdAt,
  });
  counters.statusChange += 1;

  dataset.adminActions.push({
    id: seedUuid(UUID_PREFIX.adminAction, counters.adminAction),
    adminUserId: pool.adminId,
    action: "create_auction",
    auctionId: seed.auctionId,
    fishItemId: seed.fishId,
    reason: "Auction created from listed inventory",
    createdAt: seed.timing.createdAt,
  });
  counters.adminAction += 1;
}

function appendBidHistory(
  { rng, dataset, counters, pool }: DatasetBuildContext,
  plan: AuctionPlan,
  seed: AuctionSeed,
): BidInsert | null {
  const hasBids = plan.kind === "active" || plan.kind === "closed";
  if (!hasBids) {
    return null;
  }

  const eligibleBuyerIds = pool.buyerIds.filter((id) => id !== seed.sellerId);
  const bidRows = buildEscalatingBids({
    rng,
    auctionId: seed.auctionId,
    startingPriceCents: seed.startingPriceCents,
    minimumIncrementCents: seed.minimumIncrementCents,
    buyerIds: shuffle(rng, eligibleBuyerIds).slice(0, randInt(rng, 2, 5)),
    count: randInt(rng, 3, 14),
    window: seed.timing,
    nextBidIndex: () => {
      const id = seedUuid(UUID_PREFIX.bid, counters.bid);
      counters.bid += 1;
      return id;
    },
  });

  dataset.bids.push(...bidRows);
  appendRejectedBidAttempts({ rng, dataset, counters }, seed, eligibleBuyerIds);
  return bidRows[bidRows.length - 1] ?? null;
}

function appendRejectedBidAttempts(
  context: Pick<DatasetBuildContext, "rng" | "dataset" | "counters">,
  seed: AuctionSeed,
  eligibleBuyerIds: Array<string>,
) {
  const rejectionCount = randInt(context.rng, 0, 4);
  for (let index = 0; index < rejectionCount; index += 1) {
    const code = pick(context.rng, REJECTION_CODES);
    const bidderId =
      code === "SELLER_OWN_AUCTION" ? seed.sellerId : pick(context.rng, eligibleBuyerIds);
    context.dataset.rejectedBids.push({
      id: seedUuid(UUID_PREFIX.rejected, context.counters.rejected),
      auctionId: seed.auctionId,
      bidderId,
      amountCents: code === "INVALID_AMOUNT" ? 0 : seed.startingPriceCents,
      code,
      reason: REJECTION_REASONS[code],
      rejectedAt: randomWithin(context.rng, seed.timing.startsAt, seed.timing.closeReference),
    });
    context.counters.rejected += 1;
  }
}

function appendCompletedSale(
  { dataset, counters, pool }: DatasetBuildContext,
  plan: AuctionPlan,
  seed: AuctionSeed,
  winningBid: BidInsert | null,
) {
  if (plan.kind !== "closed" || !winningBid || !seed.timing.closedAt) {
    return;
  }

  dataset.inventoryStatusChanges.push({
    id: seedUuid(UUID_PREFIX.statusChange, counters.statusChange),
    fishItemId: seed.fishId,
    auctionId: seed.auctionId,
    fromStatus: "in_auction",
    toStatus: "sold",
    changedByUserId: plan.manualClose ? pool.adminId : null,
    reason: plan.manualClose
      ? "Auction closed with winning bid"
      : "Auction expired with winning bid",
    createdAt: seed.timing.closedAt,
  });
  counters.statusChange += 1;

  if (plan.manualClose) {
    dataset.adminActions.push({
      id: seedUuid(UUID_PREFIX.adminAction, counters.adminAction),
      adminUserId: pool.adminId,
      action: "close_auction",
      auctionId: seed.auctionId,
      fishItemId: seed.fishId,
      reason: "Auction closed with winning bid",
      createdAt: seed.timing.closedAt,
    });
    counters.adminAction += 1;
  }

  dataset.sales.push({
    id: seedUuid(UUID_PREFIX.sale, counters.sale),
    auctionId: seed.auctionId,
    fishItemId: seed.fishId,
    winningBidId: winningBid.id as string,
    buyerId: winningBid.bidderId,
    sellerId: seed.sellerId,
    amountCents: winningBid.amountCents,
    completedAt: seed.timing.closedAt,
  });
  counters.sale += 1;
}

function appendUnsoldReturn(
  { dataset, counters }: DatasetBuildContext,
  plan: AuctionPlan,
  seed: AuctionSeed,
) {
  if (plan.kind !== "unsold" || !seed.timing.closedAt) {
    return;
  }

  dataset.inventoryStatusChanges.push({
    id: seedUuid(UUID_PREFIX.statusChange, counters.statusChange),
    fishItemId: seed.fishId,
    auctionId: seed.auctionId,
    fromStatus: "in_auction",
    toStatus: "listed",
    changedByUserId: null,
    reason: "Auction expired without bids",
    createdAt: seed.timing.closedAt,
  });
  counters.statusChange += 1;
}

function appendAuctionWithdrawal(
  { dataset, counters, pool }: DatasetBuildContext,
  plan: AuctionPlan,
  seed: AuctionSeed,
) {
  if (plan.kind !== "withdrawn" || !seed.timing.closedAt) {
    return;
  }

  dataset.inventoryStatusChanges.push({
    id: seedUuid(UUID_PREFIX.statusChange, counters.statusChange),
    fishItemId: seed.fishId,
    auctionId: seed.auctionId,
    fromStatus: "in_auction",
    toStatus: "withdrawn",
    changedByUserId: pool.adminId,
    reason: "Auction withdrawn by admin",
    createdAt: seed.timing.closedAt,
  });
  counters.statusChange += 1;

  dataset.adminActions.push({
    id: seedUuid(UUID_PREFIX.adminAction, counters.adminAction),
    adminUserId: pool.adminId,
    action: "withdraw_auction",
    auctionId: seed.auctionId,
    fishItemId: seed.fishId,
    reason: "Auction withdrawn by admin",
    createdAt: seed.timing.closedAt,
  });
  counters.adminAction += 1;
}

type AuctionTiming = {
  createdAt: Date;
  startsAt: Date;
  endsAt: Date;
  closedAt: Date | null;
  closeReference: Date;
};

function auctionTiming(
  rng: Rng,
  kind: AuctionKind,
  minutes: (value: number) => Date,
): AuctionTiming {
  if (kind === "active") {
    const startOffset = -randInt(rng, 10, 240);
    const endOffset = randInt(rng, 30, 300);
    return {
      createdAt: minutes(startOffset - 2),
      startsAt: minutes(startOffset),
      endsAt: minutes(endOffset),
      closedAt: null,
      closeReference: minutes(0),
    };
  }

  if (kind === "scheduled") {
    const startOffset = randInt(rng, 30, 600);
    const endOffset = startOffset + randInt(rng, 60, 240);
    return {
      createdAt: minutes(-randInt(rng, 5, 60)),
      startsAt: minutes(startOffset),
      endsAt: minutes(endOffset),
      closedAt: null,
      closeReference: minutes(startOffset),
    };
  }

  // closed, unsold, withdrawn: fully in the past.
  const startOffset = -randInt(rng, 600, 8640);
  const duration = randInt(rng, 60, 360);
  const endOffset = startOffset + duration;
  const closedOffset = endOffset + randInt(rng, 1, 10);
  return {
    createdAt: minutes(startOffset - 2),
    startsAt: minutes(startOffset),
    endsAt: minutes(endOffset),
    closedAt: minutes(closedOffset),
    closeReference: minutes(endOffset),
  };
}

type EscalatingBidsInput = {
  rng: Rng;
  auctionId: string;
  startingPriceCents: number;
  minimumIncrementCents: number;
  buyerIds: Array<string>;
  count: number;
  window: AuctionTiming;
  nextBidIndex: () => string;
};

function buildEscalatingBids(input: EscalatingBidsInput): Array<BidInsert> {
  const buyerIds = input.buyerIds.length > 0 ? input.buyerIds : [];
  if (buyerIds.length === 0) {
    return [];
  }

  const rows: Array<BidInsert> = [];
  const windowStart = input.window.startsAt.getTime();
  const windowEnd = input.window.closeReference.getTime();
  const span = Math.max(1, windowEnd - windowStart);

  let currentHighest: number | null = null;
  for (let index = 0; index < input.count; index += 1) {
    const floor: number =
      currentHighest === null
        ? input.startingPriceCents
        : currentHighest + input.minimumIncrementCents;
    const amountCents: number = floor + randInt(input.rng, 0, 2) * input.minimumIncrementCents;
    const acceptedAt = new Date(windowStart + Math.round((span * (index + 1)) / (input.count + 1)));

    rows.push({
      id: input.nextBidIndex(),
      auctionId: input.auctionId,
      bidderId: buyerIds[index % buyerIds.length],
      amountCents,
      acceptedAt,
    });
    currentHighest = amountCents;
  }

  return rows;
}

type StandaloneInput = {
  rng: Rng;
  dataset: SeedDataset;
  pool: UserPool;
  minutes: (value: number) => Date;
  nextFishIndex: () => string;
  nextStatusChangeIndex: () => string;
};

function appendStandaloneInventory(input: StandaloneInput) {
  const extras: Array<{ status: "listed" | "draft" | "withdrawn"; count: number }> = [
    { status: "listed", count: 12 },
    { status: "draft", count: 6 },
    { status: "withdrawn", count: 4 },
  ];

  for (const extra of extras) {
    for (let index = 0; index < extra.count; index += 1) {
      const sellerId = pick(input.rng, input.pool.sellerIds);
      const species = pick(input.rng, FISH_SPECIES);
      const profile = reference.speciesProfiles[species];
      const fishId = input.nextFishIndex();

      input.dataset.fishItems.push({
        id: fishId,
        species,
        displayName: `${pick(input.rng, profile.displayNames)} (${extra.status})`,
        weightGrams: randInt(input.rng, profile.weightGramsRange[0], profile.weightGramsRange[1]),
        catchRegion: pick(input.rng, reference.catchRegions),
        grade: pick(input.rng, profile.grades),
        startingPriceCents: roundToHundred(
          randInt(
            input.rng,
            profile.startingPriceCentsRange[0],
            profile.startingPriceCentsRange[1],
          ),
        ),
        sellerId,
        status: extra.status,
        description: `Seeded standalone ${extra.status} inventory.`,
      });

      const createdAt = input.minutes(-randInt(input.rng, 5, 720));
      if (extra.status === "withdrawn") {
        input.dataset.inventoryStatusChanges.push({
          id: input.nextStatusChangeIndex(),
          fishItemId: fishId,
          auctionId: null,
          fromStatus: "listed",
          toStatus: "withdrawn",
          changedByUserId: input.pool.adminId,
          reason: "Seeded inventory withdrawn before auction",
          createdAt,
        });
      } else {
        input.dataset.inventoryStatusChanges.push({
          id: input.nextStatusChangeIndex(),
          fishItemId: fishId,
          auctionId: null,
          fromStatus: null,
          toStatus: extra.status,
          changedByUserId: extra.status === "draft" ? sellerId : sellerId,
          reason: extra.status === "draft" ? "Seeded draft inventory" : "Seeded listed inventory",
          createdAt,
        });
      }
    }
  }
}

function buildAuctionPlans(rng: Rng, total: number): Array<AuctionPlan> {
  const closed = Math.round(total * 0.42);
  const active = Math.round(total * 0.25);
  const unsold = Math.round(total * 0.13);
  const withdrawn = Math.round(total * 0.08);
  const scheduled = Math.max(0, total - closed - active - unsold - withdrawn);

  const plans: Array<AuctionPlan> = [];
  for (let index = 0; index < closed; index += 1) {
    plans.push({ kind: "closed", manualClose: index % 2 === 0 });
  }
  pushKind(plans, "active", active);
  pushKind(plans, "unsold", unsold);
  pushKind(plans, "withdrawn", withdrawn);
  pushKind(plans, "scheduled", scheduled);

  return shuffle(rng, plans);
}

function pushKind(plans: Array<AuctionPlan>, kind: AuctionKind, count: number) {
  for (let index = 0; index < count; index += 1) {
    plans.push({ kind, manualClose: false });
  }
}

function fishStatusForKind(kind: AuctionKind): FishItemInsert["status"] {
  switch (kind) {
    case "active":
    case "scheduled":
      return "in_auction";
    case "closed":
      return "sold";
    case "unsold":
      return "listed";
    case "withdrawn":
      return "withdrawn";
  }
}

function cartesian<A, B>(left: ReadonlyArray<A>, right: ReadonlyArray<B>): Array<[A, B]> {
  const pairs: Array<[A, B]> = [];
  for (const a of left) {
    for (const b of right) {
      pairs.push([a, b]);
    }
  }
  return pairs;
}

function roundToHundred(value: number): number {
  return Math.round(value / 100) * 100;
}

function randomWithin(rng: Rng, start: Date, end: Date): Date {
  const startMs = start.getTime();
  const endMs = Math.max(startMs + 1, end.getTime());
  return new Date(startMs + Math.floor(rng() * (endMs - startMs)));
}
