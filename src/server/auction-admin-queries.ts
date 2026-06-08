import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  adminActions,
  auctions,
  bids,
  fishItems,
  inventoryStatusChanges,
  sales,
  users,
} from "../db/schema";
import { adminFiltersSchema, type AdminFilters } from "../domain/validation";
import { advanceAuctionLifecycle } from "./auction-clock";
import { toFishSummary } from "./auction-mappers";
import {
  adminActionQueryConditions,
  andAll,
  bidQueryConditions,
  fishQueryConditions,
  saleQueryConditions,
  statusChangeQueryConditions,
} from "./auction-query-filters";
import {
  listDemoUsers,
  loadAuctionSummaries,
  loadInventoryNeedingAction,
  loadLatestBids,
  loadRecentSales,
} from "./auction-queries";
import type { AdminActionSummary, AdminData, InventoryStatusChangeSummary } from "./auction-types";

export async function getAdminData(input: unknown = {}): Promise<AdminData> {
  const filters = adminFiltersSchema.parse(input ?? {});
  await advanceAuctionLifecycle();

  const [
    demoUsers,
    allCompletedSales,
    allAuctions,
    inventoryNeedingAction,
    withdrawnInventory,
    statusChanges,
    actionHistory,
    bidHistory,
    statistics,
  ] = await Promise.all([
    listDemoUsers(),
    loadRecentSales(50, filters),
    loadAuctionSummaries(undefined, filters),
    loadInventoryNeedingAction(filters),
    loadWithdrawnInventory(filters),
    loadInventoryStatusChanges(filters),
    loadAdminActions(filters),
    loadLatestBids(50, filters),
    loadAdminStatistics(filters),
  ]);

  return {
    demoUsers,
    completedSales: allCompletedSales,
    auctions: allAuctions,
    inventoryNeedingAction,
    withdrawnInventory,
    inventoryStatusChanges: statusChanges,
    adminActions: actionHistory,
    bidHistory,
    statistics,
  };
}

async function loadAdminStatistics(filters: AdminFilters): Promise<AdminData["statistics"]> {
  const [salesAggregate] = await db
    .select({
      totalSalesCents: sql<number>`coalesce(sum(${sales.amountCents}), 0)`.mapWith(Number),
    })
    .from(sales)
    .innerJoin(fishItems, eq(sales.fishItemId, fishItems.id))
    .where(andAll(saleQueryConditions(filters)));

  const [bidAggregate] = await db
    .select({
      averageBidCents: sql<number>`coalesce(round(avg(${bids.amountCents})), 0)`.mapWith(Number),
    })
    .from(bids)
    .innerJoin(auctions, eq(bids.auctionId, auctions.id))
    .innerJoin(fishItems, eq(auctions.fishItemId, fishItems.id))
    .where(andAll(bidQueryConditions(filters)));

  const popularFish = await loadPopularFishStatistics(filters);

  return {
    totalSalesCents: salesAggregate?.totalSalesCents ?? 0,
    averageBidCents: bidAggregate?.averageBidCents ?? 0,
    popularFish,
  };
}

async function loadPopularFishStatistics(filters: AdminFilters) {
  const bidCounts = await db
    .select({
      species: fishItems.species,
      bidCount: sql<number>`count(*)`.mapWith(Number),
    })
    .from(bids)
    .innerJoin(auctions, eq(bids.auctionId, auctions.id))
    .innerJoin(fishItems, eq(auctions.fishItemId, fishItems.id))
    .where(andAll(bidQueryConditions(filters)))
    .groupBy(fishItems.species);

  const saleTotals = await db
    .select({
      species: fishItems.species,
      totalKilogramsSold: sql<number>`coalesce(sum(${fishItems.weightGrams}), 0) / 1000.0`.mapWith(
        Number,
      ),
      totalSalesCents: sql<number>`coalesce(sum(${sales.amountCents}), 0)`.mapWith(Number),
    })
    .from(sales)
    .innerJoin(fishItems, eq(sales.fishItemId, fishItems.id))
    .where(andAll(saleQueryConditions(filters)))
    .groupBy(fishItems.species);

  const popularBySpecies = new Map<
    string,
    {
      species: string;
      bidCount: number;
      totalKilogramsSold: number;
      totalSalesCents: number;
    }
  >();

  for (const bidCount of bidCounts) {
    popularBySpecies.set(bidCount.species, {
      species: bidCount.species,
      bidCount: bidCount.bidCount,
      totalKilogramsSold: 0,
      totalSalesCents: 0,
    });
  }

  for (const saleTotal of saleTotals) {
    const current = popularBySpecies.get(saleTotal.species) ?? {
      species: saleTotal.species,
      bidCount: 0,
      totalKilogramsSold: 0,
      totalSalesCents: 0,
    };
    current.totalKilogramsSold = saleTotal.totalKilogramsSold;
    current.totalSalesCents = saleTotal.totalSalesCents;
    popularBySpecies.set(saleTotal.species, current);
  }

  return [...popularBySpecies.values()].sort((left, right) => right.bidCount - left.bidCount);
}

async function loadWithdrawnInventory(filters?: AdminFilters) {
  const fishRows = await db.query.fishItems.findMany({
    where: and(eq(fishItems.status, "withdrawn"), ...fishQueryConditions(filters)),
    orderBy: [desc(fishItems.updatedAt)],
    limit: 50,
  });

  return fishRows.map(toFishSummary);
}

async function loadInventoryStatusChanges(
  filters?: AdminFilters,
): Promise<Array<InventoryStatusChangeSummary>> {
  const changes = await db
    .select({
      id: inventoryStatusChanges.id,
      fishItemId: inventoryStatusChanges.fishItemId,
      fishDisplayName: fishItems.displayName,
      species: fishItems.species,
      fromStatus: inventoryStatusChanges.fromStatus,
      toStatus: inventoryStatusChanges.toStatus,
      changedByDisplayName: users.displayName,
      reason: inventoryStatusChanges.reason,
      createdAt: inventoryStatusChanges.createdAt,
    })
    .from(inventoryStatusChanges)
    .innerJoin(fishItems, eq(inventoryStatusChanges.fishItemId, fishItems.id))
    .leftJoin(users, eq(inventoryStatusChanges.changedByUserId, users.id))
    .where(andAll(statusChangeQueryConditions(filters)))
    .orderBy(desc(inventoryStatusChanges.createdAt))
    .limit(100);

  return changes.map((change) => ({
    id: change.id,
    fishItemId: change.fishItemId,
    fishDisplayName: change.fishDisplayName,
    species: change.species,
    fromStatus: change.fromStatus,
    toStatus: change.toStatus,
    changedByDisplayName: change.changedByDisplayName ?? null,
    reason: change.reason,
    createdAt: change.createdAt.toISOString(),
  }));
}

async function loadAdminActions(filters?: AdminFilters): Promise<Array<AdminActionSummary>> {
  const actions = await db
    .select({
      id: adminActions.id,
      adminDisplayName: users.displayName,
      action: adminActions.action,
      auctionId: adminActions.auctionId,
      fishItemId: adminActions.fishItemId,
      fishDisplayName: fishItems.displayName,
      reason: adminActions.reason,
      createdAt: adminActions.createdAt,
    })
    .from(adminActions)
    .innerJoin(users, eq(adminActions.adminUserId, users.id))
    .leftJoin(auctions, eq(adminActions.auctionId, auctions.id))
    .leftJoin(fishItems, eq(adminActions.fishItemId, fishItems.id))
    .where(andAll(adminActionQueryConditions(filters)))
    .orderBy(desc(adminActions.createdAt))
    .limit(100);

  return actions.map((action) => ({
    id: action.id,
    adminDisplayName: action.adminDisplayName,
    action: action.action,
    auctionId: action.auctionId,
    fishItemId: action.fishItemId,
    fishDisplayName: action.fishDisplayName ?? null,
    reason: action.reason,
    createdAt: action.createdAt.toISOString(),
  }));
}
