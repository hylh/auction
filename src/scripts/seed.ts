import { db, sqlClient } from "../db/client";
import {
  adminActions,
  auctions,
  bids,
  fishItems,
  inventoryStatusChanges,
  sales,
  users,
} from "../db/schema";
import { DEMO_AUCTIONS, DEMO_FISH, DEMO_USERS } from "../domain/constants";

const now = new Date();
const minutes = (value: number) => new Date(now.getTime() + value * 60_000);

async function main() {
  await db.delete(adminActions);
  await db.delete(inventoryStatusChanges);
  await db.delete(sales);
  await db.delete(bids);
  await db.delete(auctions);
  await db.delete(fishItems);
  await db.delete(users);

  await db.insert(users).values([
    {
      id: DEMO_USERS.sellerNorth,
      displayName: "Northern Nets AS",
      role: "seller",
    },
    {
      id: DEMO_USERS.sellerFjord,
      displayName: "Fjordline Catch Co",
      role: "seller",
    },
    {
      id: DEMO_USERS.buyerOslo,
      displayName: "Oslo Market Buyer",
      role: "buyer",
    },
    {
      id: DEMO_USERS.buyerBergen,
      displayName: "Bergen Seafood Buyer",
      role: "buyer",
    },
    {
      id: DEMO_USERS.admin,
      displayName: "Auction Admin",
      role: "admin",
    },
  ]);

  await db.insert(fishItems).values([
    {
      id: DEMO_FISH.salmon,
      species: "salmon",
      displayName: "Lofoten premium salmon crate",
      weightGrams: 48500,
      catchRegion: "Lofoten",
      grade: "A",
      startingPriceCents: 180000,
      sellerId: DEMO_USERS.sellerNorth,
      status: "in_auction",
      description: "Line-caught salmon packed in ice for same-day sale.",
    },
    {
      id: DEMO_FISH.cod,
      species: "cod",
      displayName: "Skrei cod morning landing",
      weightGrams: 72500,
      catchRegion: "Vestfjorden",
      grade: "A+",
      startingPriceCents: 140000,
      sellerId: DEMO_USERS.sellerFjord,
      status: "in_auction",
      description: "Fresh skrei cod, auctioned before noon.",
    },
    {
      id: DEMO_FISH.tuna,
      species: "tuna",
      displayName: "Bluefin tuna loin set",
      weightGrams: 31500,
      catchRegion: "North Sea",
      grade: "Sashimi",
      startingPriceCents: 420000,
      sellerId: DEMO_USERS.sellerNorth,
      status: "sold",
    },
    {
      id: DEMO_FISH.herring,
      species: "herring",
      displayName: "Herring bulk crate",
      weightGrams: 110000,
      catchRegion: "Møre",
      grade: "B",
      startingPriceCents: 90000,
      sellerId: DEMO_USERS.sellerFjord,
      status: "listed",
    },
    {
      id: DEMO_FISH.trout,
      species: "trout",
      displayName: "Withdrawn mountain trout batch",
      weightGrams: 28500,
      catchRegion: "Hardanger",
      grade: "A",
      startingPriceCents: 125000,
      sellerId: DEMO_USERS.sellerNorth,
      status: "withdrawn",
      description: "Withdrawn during quality inspection before auction.",
    },
    {
      id: DEMO_FISH.mackerel,
      species: "mackerel",
      displayName: "Mackerel shore seine batch",
      weightGrams: 64000,
      catchRegion: "Rogaland",
      grade: "B+",
      startingPriceCents: 80000,
      sellerId: DEMO_USERS.sellerNorth,
      status: "listed",
      description: "Extra listed inventory for simulator and admin demo flows.",
    },
    {
      id: DEMO_FISH.halibut,
      species: "halibut",
      displayName: "Halibut chef selection",
      weightGrams: 42000,
      catchRegion: "Helgeland",
      grade: "A",
      startingPriceCents: 260000,
      sellerId: DEMO_USERS.sellerFjord,
      status: "listed",
      description: "Premium listed fish ready for auction creation demos.",
    },
  ]);

  await db.insert(auctions).values([
    {
      id: DEMO_AUCTIONS.salmon,
      fishItemId: DEMO_FISH.salmon,
      status: "active",
      startsAt: minutes(-30),
      endsAt: minutes(90),
      minimumIncrementCents: 5000,
    },
    {
      id: DEMO_AUCTIONS.cod,
      fishItemId: DEMO_FISH.cod,
      status: "active",
      startsAt: minutes(-15),
      endsAt: minutes(120),
      minimumIncrementCents: 2500,
    },
    {
      id: DEMO_AUCTIONS.tuna,
      fishItemId: DEMO_FISH.tuna,
      status: "closed",
      startsAt: minutes(-180),
      endsAt: minutes(-60),
      minimumIncrementCents: 10000,
      closedAt: minutes(-55),
    },
  ]);

  const [tunaBid] = await db
    .insert(bids)
    .values({
      auctionId: DEMO_AUCTIONS.tuna,
      bidderId: DEMO_USERS.buyerBergen,
      amountCents: 465000,
      acceptedAt: minutes(-95),
    })
    .returning();

  await db.insert(bids).values([
    {
      auctionId: DEMO_AUCTIONS.salmon,
      bidderId: DEMO_USERS.buyerOslo,
      amountCents: 185000,
      acceptedAt: minutes(-20),
    },
    {
      auctionId: DEMO_AUCTIONS.salmon,
      bidderId: DEMO_USERS.buyerBergen,
      amountCents: 192500,
      acceptedAt: minutes(-5),
    },
    {
      auctionId: DEMO_AUCTIONS.cod,
      bidderId: DEMO_USERS.buyerOslo,
      amountCents: 142500,
      acceptedAt: minutes(-7),
    },
  ]);

  await db.insert(sales).values({
    auctionId: DEMO_AUCTIONS.tuna,
    fishItemId: DEMO_FISH.tuna,
    winningBidId: tunaBid.id,
    buyerId: DEMO_USERS.buyerBergen,
    sellerId: DEMO_USERS.sellerNorth,
    amountCents: 465000,
    completedAt: minutes(-50),
  });

  await db.insert(inventoryStatusChanges).values([
    {
      fishItemId: DEMO_FISH.salmon,
      auctionId: DEMO_AUCTIONS.salmon,
      fromStatus: "listed",
      toStatus: "in_auction",
      changedByUserId: DEMO_USERS.admin,
      reason: "Seeded auction created from listed inventory",
      createdAt: minutes(-35),
    },
    {
      fishItemId: DEMO_FISH.cod,
      auctionId: DEMO_AUCTIONS.cod,
      fromStatus: "listed",
      toStatus: "in_auction",
      changedByUserId: DEMO_USERS.admin,
      reason: "Seeded auction created from listed inventory",
      createdAt: minutes(-20),
    },
    {
      fishItemId: DEMO_FISH.tuna,
      auctionId: DEMO_AUCTIONS.tuna,
      fromStatus: "in_auction",
      toStatus: "sold",
      changedByUserId: DEMO_USERS.admin,
      reason: "Seeded auction closed with winning bid",
      createdAt: minutes(-55),
    },
    {
      fishItemId: DEMO_FISH.herring,
      auctionId: null,
      fromStatus: null,
      toStatus: "listed",
      changedByUserId: DEMO_USERS.sellerFjord,
      reason: "Seeded listed inventory",
      createdAt: minutes(-10),
    },
    {
      fishItemId: DEMO_FISH.trout,
      auctionId: null,
      fromStatus: "listed",
      toStatus: "withdrawn",
      changedByUserId: DEMO_USERS.admin,
      reason: "Seeded quality inspection withdrawal",
      createdAt: minutes(-8),
    },
  ]);

  await db.insert(adminActions).values([
    {
      adminUserId: DEMO_USERS.admin,
      action: "create_auction",
      auctionId: DEMO_AUCTIONS.salmon,
      fishItemId: DEMO_FISH.salmon,
      reason: "Seeded auction created from listed inventory",
      createdAt: minutes(-35),
    },
    {
      adminUserId: DEMO_USERS.admin,
      action: "create_auction",
      auctionId: DEMO_AUCTIONS.cod,
      fishItemId: DEMO_FISH.cod,
      reason: "Seeded auction created from listed inventory",
      createdAt: minutes(-20),
    },
    {
      adminUserId: DEMO_USERS.admin,
      action: "close_auction",
      auctionId: DEMO_AUCTIONS.tuna,
      fishItemId: DEMO_FISH.tuna,
      reason: "Seeded auction closed with winning bid",
      createdAt: minutes(-55),
    },
    {
      adminUserId: DEMO_USERS.admin,
      action: "withdraw_inventory",
      auctionId: null,
      fishItemId: DEMO_FISH.trout,
      reason: "Seeded quality inspection withdrawal",
      createdAt: minutes(-8),
    },
  ]);

  console.info("Seeded deterministic fish auction demo data.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sqlClient.end();
  });
