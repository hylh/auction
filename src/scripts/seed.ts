import { db, sqlClient } from "../db/client";
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
import { DEMO_USERS, SEED_SCENARIOS, type SeedScenario } from "../domain/constants";
import { buildDefaultDataset, type SeedDataset } from "./factories";

const now = new Date();
const minutes = (value: number) => new Date(now.getTime() + value * 60_000);

const scenario = resolveScenario();
const seedValue = Number(argValue("--seed") ?? process.env.SEED_VALUE ?? "20260605");
const sellerCount = Number(argValue("--sellers") ?? process.env.SEED_SELLERS ?? "60");
const buyerCount = Number(argValue("--buyers") ?? process.env.SEED_BUYERS ?? "60");
const auctionCount = Number(argValue("--auctions") ?? process.env.SEED_AUCTIONS ?? "120");

async function main() {
  await clearAll();

  switch (scenario) {
    case "default":
      await seedDefaultScenario();
      break;
    case "busy-auction":
      await insertUsers();
      await seedBusyAuctionScenario();
      break;
    case "all-expired":
      await insertUsers();
      await seedAllExpiredScenario();
      break;
    case "no-bids":
      await insertUsers();
      await seedNoBidsScenario();
      break;
  }

  console.info(`Seeded '${scenario}' fish auction demo data.`);
}

function resolveScenario(): SeedScenario {
  const requested = (argValue("--scenario") ?? process.env.SEED_SCENARIO ?? "default").trim();
  if (!(SEED_SCENARIOS as ReadonlyArray<string>).includes(requested)) {
    throw new Error(
      `Unknown seed scenario '${requested}'. Available scenarios: ${SEED_SCENARIOS.join(", ")}`,
    );
  }
  return requested as SeedScenario;
}

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  if (index !== -1 && index + 1 < process.argv.length) {
    return process.argv[index + 1];
  }
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : undefined;
}

async function clearAll() {
  await db.delete(adminActions);
  await db.delete(inventoryStatusChanges);
  await db.delete(sales);
  await db.delete(rejectedBids);
  await db.delete(bids);
  await db.delete(auctions);
  await db.delete(fishItems);
  await db.delete(users);
}

async function insertUsers() {
  await db.insert(users).values([
    { id: DEMO_USERS.sellerNorth, displayName: "Northern Nets AS", role: "seller" },
    { id: DEMO_USERS.sellerFjord, displayName: "Fjordline Catch Co", role: "seller" },
    { id: DEMO_USERS.buyerOslo, displayName: "Oslo Market Buyer", role: "buyer" },
    { id: DEMO_USERS.buyerBergen, displayName: "Bergen Seafood Buyer", role: "buyer" },
    { id: DEMO_USERS.admin, displayName: "Auction Admin", role: "admin" },
  ]);
}

async function seedDefaultScenario() {
  const dataset = buildDefaultDataset({
    seed: seedValue,
    sellerCount,
    buyerCount,
    auctionCount,
    now,
    admin: { id: DEMO_USERS.admin, displayName: "Auction Admin" },
    fixedSellers: [
      { id: DEMO_USERS.sellerNorth, displayName: "Northern Nets AS" },
      { id: DEMO_USERS.sellerFjord, displayName: "Fjordline Catch Co" },
    ],
    fixedBuyers: [
      { id: DEMO_USERS.buyerOslo, displayName: "Oslo Market Buyer" },
      { id: DEMO_USERS.buyerBergen, displayName: "Bergen Seafood Buyer" },
    ],
  });

  await insertDataset(dataset);
  await assertDatasetIntegrity();

  console.info(
    `  users=${dataset.users.length} fish=${dataset.fishItems.length} auctions=${dataset.auctions.length} ` +
      `bids=${dataset.bids.length} rejected=${dataset.rejectedBids.length} sales=${dataset.sales.length}`,
  );
}

async function insertDataset(dataset: SeedDataset) {
  await insertChunked(users, dataset.users);
  await insertChunked(fishItems, dataset.fishItems);
  await insertChunked(auctions, dataset.auctions);
  await insertChunked(bids, dataset.bids);
  await insertChunked(rejectedBids, dataset.rejectedBids);
  await insertChunked(sales, dataset.sales);
  await insertChunked(inventoryStatusChanges, dataset.inventoryStatusChanges);
  await insertChunked(adminActions, dataset.adminActions);
}

async function insertChunked<TTable extends Parameters<typeof db.insert>[0], TRow>(
  table: TTable,
  rows: Array<TRow>,
  chunkSize = 500,
) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    if (chunk.length > 0) {
      await db.insert(table).values(chunk as never);
    }
  }
}

async function assertDatasetIntegrity() {
  const checks: Array<{ label: string; query: ReturnType<typeof sqlClient> }> = [
    {
      label: "at least 60 sellers",
      query: sqlClient`select count(*) >= 60 as ok from users where role = 'seller'`,
    },
    {
      label: "at least 60 buyers",
      query: sqlClient`select count(*) >= 60 as ok from users where role = 'buyer'`,
    },
    {
      label: "every closed auction has exactly one sale",
      query: sqlClient`
        select count(*) = 0 as ok from auctions a
        where a.status = 'closed'
          and (select count(*) from sales s where s.auction_id = a.id) <> 1
      `,
    },
    {
      label: "unsold auctions have no bids and no sales",
      query: sqlClient`
        select count(*) = 0 as ok from auctions a
        where a.status = 'unsold'
          and (exists (select 1 from bids b where b.auction_id = a.id)
            or exists (select 1 from sales s where s.auction_id = a.id))
      `,
    },
    {
      label: "sale winning bid, buyer, and amount are consistent",
      query: sqlClient`
        select count(*) = 0 as ok from sales s
        join bids b on b.id = s.winning_bid_id
        where b.auction_id <> s.auction_id
          or b.bidder_id <> s.buyer_id
          or b.amount_cents <> s.amount_cents
      `,
    },
    {
      label: "sale fish item and seller match the auction and fish",
      query: sqlClient`
        select count(*) = 0 as ok from sales s
        join auctions a on a.id = s.auction_id
        join fish_items f on f.id = s.fish_item_id
        where a.fish_item_id <> s.fish_item_id or f.seller_id <> s.seller_id
      `,
    },
    {
      label: "fish status is consistent with auction status",
      query: sqlClient`
        select count(*) = 0 as ok from auctions a
        join fish_items f on f.id = a.fish_item_id
        where (a.status in ('active', 'scheduled') and f.status <> 'in_auction')
          or (a.status = 'closed' and f.status <> 'sold')
          or (a.status = 'unsold' and f.status <> 'listed')
          or (a.status = 'withdrawn' and f.status <> 'withdrawn')
      `,
    },
  ];

  for (const check of checks) {
    const [row] = (await check.query) as unknown as Array<{ ok: boolean }>;
    if (!row?.ok) {
      throw new Error(`Seed integrity check failed: ${check.label}`);
    }
  }
}

type EscalatingBidsInput = {
  auctionId: string;
  startingPriceCents: number;
  minimumIncrementCents: number;
  buyerIds: Array<string>;
  count: number;
  firstOffsetMinutes: number;
  stepMinutes: number;
};

/**
 * Inserts a run of strictly ascending bids, alternating buyers, with increasing
 * timestamps. Returns the inserted rows in chronological order, so the last row
 * is always the current highest bid.
 */
async function insertEscalatingBids(input: EscalatingBidsInput) {
  const values: Array<{
    auctionId: string;
    bidderId: string;
    amountCents: number;
    acceptedAt: Date;
  }> = [];

  let currentHighest: number | null = null;
  for (let index = 0; index < input.count; index += 1) {
    const floor: number =
      currentHighest === null
        ? input.startingPriceCents
        : currentHighest + input.minimumIncrementCents;
    const amountCents: number = floor + (index % 2) * input.minimumIncrementCents;
    values.push({
      auctionId: input.auctionId,
      bidderId: input.buyerIds[index % input.buyerIds.length],
      amountCents,
      acceptedAt: minutes(input.firstOffsetMinutes + index * input.stepMinutes),
    });
    currentHighest = amountCents;
  }

  if (values.length === 0) {
    return [];
  }

  return db.insert(bids).values(values).returning();
}

async function seedBusyAuctionScenario() {
  const [fish] = await db
    .insert(fishItems)
    .values({
      species: "salmon",
      displayName: "Busy auction salmon lot",
      weightGrams: 52000,
      catchRegion: "Lofoten",
      grade: "A+",
      startingPriceCents: 200000,
      sellerId: DEMO_USERS.sellerNorth,
      status: "in_auction",
      description: "One hot auction with many competing bids for stress-testing the UI.",
    })
    .returning();

  const [auction] = await db
    .insert(auctions)
    .values({
      fishItemId: fish.id,
      status: "active",
      startsAt: minutes(-45),
      endsAt: minutes(60),
      minimumIncrementCents: 5000,
    })
    .returning();

  await insertEscalatingBids({
    auctionId: auction.id,
    startingPriceCents: 200000,
    minimumIncrementCents: 5000,
    buyerIds: [DEMO_USERS.buyerOslo, DEMO_USERS.buyerBergen],
    count: 24,
    firstOffsetMinutes: -44,
    stepMinutes: 1,
  });

  await db.insert(inventoryStatusChanges).values({
    fishItemId: fish.id,
    auctionId: auction.id,
    fromStatus: "listed",
    toStatus: "in_auction",
    changedByUserId: DEMO_USERS.admin,
    reason: "Seeded busy auction created from listed inventory",
    createdAt: minutes(-46),
  });
  await db.insert(adminActions).values({
    adminUserId: DEMO_USERS.admin,
    action: "create_auction",
    auctionId: auction.id,
    fishItemId: fish.id,
    reason: "Seeded busy auction created from listed inventory",
    createdAt: minutes(-46),
  });
}

async function seedAllExpiredScenario() {
  const fishRows = await db
    .insert(fishItems)
    .values([
      {
        species: "cod",
        displayName: "Expired cod awaiting close (with bids)",
        weightGrams: 60000,
        catchRegion: "Vestfjorden",
        grade: "A",
        startingPriceCents: 130000,
        sellerId: DEMO_USERS.sellerFjord,
        status: "in_auction",
        description: "Auction window already ended; should close as a sale on next load.",
      },
      {
        species: "trout",
        displayName: "Expired trout awaiting close (no bids)",
        weightGrams: 30000,
        catchRegion: "Hardanger",
        grade: "B",
        startingPriceCents: 110000,
        sellerId: DEMO_USERS.sellerNorth,
        status: "in_auction",
        description: "Auction window already ended with no bids; should close as unsold.",
      },
    ])
    .returning();

  const [withBidsFish, noBidsFish] = fishRows;

  const auctionRows = await db
    .insert(auctions)
    .values([
      {
        fishItemId: withBidsFish.id,
        status: "active",
        startsAt: minutes(-180),
        endsAt: minutes(-30),
        minimumIncrementCents: 5000,
      },
      {
        fishItemId: noBidsFish.id,
        status: "active",
        startsAt: minutes(-120),
        endsAt: minutes(-20),
        minimumIncrementCents: 5000,
      },
    ])
    .returning();

  const [withBidsAuction, noBidsAuction] = auctionRows;

  await insertEscalatingBids({
    auctionId: withBidsAuction.id,
    startingPriceCents: 130000,
    minimumIncrementCents: 5000,
    buyerIds: [DEMO_USERS.buyerOslo, DEMO_USERS.buyerBergen],
    count: 5,
    firstOffsetMinutes: -150,
    stepMinutes: 10,
  });

  await db.insert(inventoryStatusChanges).values([
    {
      fishItemId: withBidsFish.id,
      auctionId: withBidsAuction.id,
      fromStatus: "listed",
      toStatus: "in_auction",
      changedByUserId: DEMO_USERS.admin,
      reason: "Seeded expired auction created from listed inventory",
      createdAt: minutes(-181),
    },
    {
      fishItemId: noBidsFish.id,
      auctionId: noBidsAuction.id,
      fromStatus: "listed",
      toStatus: "in_auction",
      changedByUserId: DEMO_USERS.admin,
      reason: "Seeded expired auction created from listed inventory",
      createdAt: minutes(-121),
    },
  ]);
}

async function seedNoBidsScenario() {
  const fishRows = await db
    .insert(fishItems)
    .values([
      {
        species: "halibut",
        displayName: "Closing soon halibut (no bids)",
        weightGrams: 41000,
        catchRegion: "Helgeland",
        grade: "A",
        startingPriceCents: 240000,
        sellerId: DEMO_USERS.sellerFjord,
        status: "in_auction",
        description: "Active auction about to end with no bids placed yet.",
      },
      {
        species: "trout",
        displayName: "Closing soon trout (no bids)",
        weightGrams: 27000,
        catchRegion: "Hardanger",
        grade: "B+",
        startingPriceCents: 120000,
        sellerId: DEMO_USERS.sellerNorth,
        status: "in_auction",
        description: "Active auction about to end with no bids placed yet.",
      },
    ])
    .returning();

  const auctionRows = await db
    .insert(auctions)
    .values(
      fishRows.map((fish, index) => ({
        fishItemId: fish.id,
        status: "active" as const,
        startsAt: minutes(-30),
        endsAt: minutes(5 + index * 3),
        minimumIncrementCents: 5000,
      })),
    )
    .returning();

  await db.insert(inventoryStatusChanges).values(
    auctionRows.map((auction, index) => ({
      fishItemId: fishRows[index].id,
      auctionId: auction.id,
      fromStatus: "listed" as const,
      toStatus: "in_auction" as const,
      changedByUserId: DEMO_USERS.admin,
      reason: "Seeded closing-soon auction created from listed inventory",
      createdAt: minutes(-31),
    })),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sqlClient.end();
  });
