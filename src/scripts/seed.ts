import { db, sqlClient } from "../db/client";
import { auctions, bids, fishItems, sales, users } from "../db/schema";
import { DEMO_AUCTIONS, DEMO_FISH, DEMO_USERS } from "../domain/constants";

const now = new Date();
const minutes = (value: number) => new Date(now.getTime() + value * 60_000);

async function main() {
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
