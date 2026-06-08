import { and, sql, type SQL } from "drizzle-orm";
import {
  adminActions,
  auctions,
  bids,
  fishItems,
  inventoryStatusChanges,
  sales,
} from "../db/schema";
import { AUCTION_STATUSES, INVENTORY_STATUSES } from "../domain/constants";
import type { AdminFilters } from "../domain/validation";

export function auctionQueryConditions(status?: "active", filters?: AdminFilters) {
  const conditions: Array<SQL> = [];

  if (status) {
    conditions.push(sql`${auctions.status}::text = ${status}`);
  }
  if (!filters) {
    return conditions;
  }
  addAuctionStatusCondition(conditions, filters);
  addFishFilterConditions(conditions, filters);
  if (filters.buyerId) {
    conditions.push(sql`(
      exists (
        select 1 from ${bids}
        where ${bids.auctionId} = ${auctions.id} and ${bids.bidderId} = ${filters.buyerId}
      )
      or exists (
        select 1 from ${sales}
        where ${sales.auctionId} = ${auctions.id} and ${sales.buyerId} = ${filters.buyerId}
      )
    )`);
  }
  conditions.push(
    ...dateQueryConditions(sql`coalesce(${auctions.closedAt}, ${auctions.startsAt})`, filters),
  );
  return conditions;
}

export function bidQueryConditions(filters?: AdminFilters) {
  const conditions: Array<SQL> = [];

  if (!filters) {
    return conditions;
  }
  addAuctionStatusCondition(conditions, filters);
  addFishFilterConditions(conditions, filters);
  if (filters.buyerId) {
    conditions.push(sql`${bids.bidderId} = ${filters.buyerId}`);
  }
  conditions.push(...dateQueryConditions(sql`${bids.acceptedAt}`, filters));
  return conditions;
}

export function saleQueryConditions(filters?: AdminFilters) {
  const conditions: Array<SQL> = [];

  if (!filters) {
    return conditions;
  }
  if (filters.status && filters.status !== "closed" && filters.status !== "sold") {
    conditions.push(sql`false`);
  }
  addFishFilterConditions(conditions, filters);
  if (filters.buyerId) {
    conditions.push(sql`${sales.buyerId} = ${filters.buyerId}`);
  }
  conditions.push(...dateQueryConditions(sql`${sales.completedAt}`, filters));
  return conditions;
}

export function fishQueryConditions(filters?: AdminFilters) {
  const conditions: Array<SQL> = [];

  if (!filters) {
    return conditions;
  }
  if (filters.buyerId) {
    conditions.push(sql`false`);
  }
  addInventoryStatusCondition(conditions, sql`${fishItems.status}`, filters);
  addFishFilterConditions(conditions, filters);
  conditions.push(...dateQueryConditions(sql`${fishItems.updatedAt}`, filters));
  return conditions;
}

export function statusChangeQueryConditions(filters?: AdminFilters) {
  const conditions: Array<SQL> = [];

  if (!filters) {
    return conditions;
  }
  if (filters.buyerId) {
    conditions.push(sql`false`);
  }
  addInventoryStatusCondition(conditions, sql`${inventoryStatusChanges.toStatus}`, filters);
  addFishFilterConditions(conditions, filters);
  conditions.push(...dateQueryConditions(sql`${inventoryStatusChanges.createdAt}`, filters));
  return conditions;
}

export function adminActionQueryConditions(filters?: AdminFilters) {
  const conditions: Array<SQL> = [];

  if (!filters) {
    return conditions;
  }
  if (filters.buyerId) {
    conditions.push(sql`false`);
  }
  addAdminActionStatusCondition(conditions, filters);
  addFishFilterConditions(conditions, filters);
  conditions.push(...dateQueryConditions(sql`${adminActions.createdAt}`, filters));
  return conditions;
}

export function andAll(conditions: Array<SQL>) {
  return conditions.length === 0 ? undefined : and(...conditions);
}

function dateQueryConditions(dateExpression: SQL, filters: AdminFilters) {
  const conditions: Array<SQL> = [];
  if (filters.fromDate) {
    conditions.push(sql`${dateExpression} >= ${filters.fromDate}`);
  }
  if (filters.toDate) {
    const toDateInclusive = new Date(filters.toDate);
    toDateInclusive.setDate(toDateInclusive.getDate() + 1);
    conditions.push(sql`${dateExpression} < ${toDateInclusive}`);
  }
  return conditions;
}

function addAuctionStatusCondition(conditions: Array<SQL>, filters: AdminFilters) {
  if (filters.status) {
    conditions.push(
      isAuctionStatus(filters.status)
        ? sql`${auctions.status}::text = ${filters.status}`
        : sql`false`,
    );
  }
}

function addInventoryStatusCondition(
  conditions: Array<SQL>,
  statusExpression: SQL,
  filters: AdminFilters,
) {
  if (filters.status) {
    conditions.push(
      isInventoryStatus(filters.status)
        ? sql`${statusExpression}::text = ${filters.status}`
        : sql`false`,
    );
  }
}

function addAdminActionStatusCondition(conditions: Array<SQL>, filters: AdminFilters) {
  if (!filters.status) {
    return;
  }

  const statusSides: Array<SQL> = [];
  if (isInventoryStatus(filters.status)) {
    statusSides.push(sql`${fishItems.status}::text = ${filters.status}`);
  }
  if (isAuctionStatus(filters.status)) {
    statusSides.push(sql`${auctions.status}::text = ${filters.status}`);
  }

  conditions.push(
    statusSides.length === 0 ? sql`false` : sql`(${sql.join(statusSides, sql` or `)})`,
  );
}

function addFishFilterConditions(conditions: Array<SQL>, filters: AdminFilters) {
  if (filters.species) {
    conditions.push(sql`${fishItems.species}::text = ${filters.species}`);
  }
  if (filters.sellerId) {
    conditions.push(sql`${fishItems.sellerId} = ${filters.sellerId}`);
  }
}

function isAuctionStatus(status: string) {
  return (AUCTION_STATUSES as readonly string[]).includes(status);
}

function isInventoryStatus(status: string) {
  return (INVENTORY_STATUSES as readonly string[]).includes(status);
}
