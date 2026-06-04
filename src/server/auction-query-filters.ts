import { and, sql, type SQL } from "drizzle-orm";
import { auctions, bids, fishItems, sales } from "../db/schema";
import { AUCTION_STATUSES } from "../domain/constants";
import type { AdminFilters } from "../domain/validation";

export function auctionQueryConditions(status?: "active", filters?: AdminFilters) {
  const conditions: Array<SQL> = [];

  if (status) {
    conditions.push(sql`${auctions.status} = ${status}`);
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

export function andAll(conditions: Array<SQL>) {
  return conditions.length === 0 ? undefined : and(...conditions);
}

export function fishMatchesFilters(
  fish: { status: string; species: string; sellerId: string; updatedAt?: Date },
  filters?: AdminFilters,
) {
  if (!filters) return true;
  return [
    matchesOptional(filters.status, fish.status),
    matchesOptional(filters.species, fish.species),
    matchesOptional(filters.sellerId, fish.sellerId),
    isEmptyFilter(filters.buyerId),
    matchesOptionalDate(fish.updatedAt, filters),
  ].every(Boolean);
}

export function statusChangeMatchesFilters(
  change: {
    toStatus: string;
    createdAt: Date;
    fishItem: { species: string; sellerId: string };
  },
  filters?: AdminFilters,
) {
  if (!filters) return true;
  return [
    matchesOptional(filters.status, change.toStatus),
    matchesOptional(filters.species, change.fishItem.species),
    matchesOptional(filters.sellerId, change.fishItem.sellerId),
    isEmptyFilter(filters.buyerId),
    dateMatches(change.createdAt, filters),
  ].every(Boolean);
}

export function adminActionMatchesFilters(
  action: {
    action: string;
    createdAt: Date;
    auction: { status: string } | null;
    fishItem: { species: string; sellerId: string; status?: string } | null;
  },
  filters?: AdminFilters,
) {
  if (!filters) return true;
  return [
    adminActionMatchesStatus(action, filters.status),
    isEmptyFilter(filters.buyerId),
    matchesOptional(filters.species, action.fishItem?.species),
    matchesOptional(filters.sellerId, action.fishItem?.sellerId),
    dateMatches(action.createdAt, filters),
  ].every(Boolean);
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
      isAuctionStatus(filters.status) ? sql`${auctions.status} = ${filters.status}` : sql`false`,
    );
  }
}

function addFishFilterConditions(conditions: Array<SQL>, filters: AdminFilters) {
  if (filters.species) {
    conditions.push(sql`${fishItems.species} = ${filters.species}`);
  }
  if (filters.sellerId) {
    conditions.push(sql`${fishItems.sellerId} = ${filters.sellerId}`);
  }
}

function isAuctionStatus(status: string) {
  return (AUCTION_STATUSES as readonly string[]).includes(status);
}

function adminActionMatchesStatus(
  action: {
    action: string;
    auction: { status: string } | null;
    fishItem: { status?: string } | null;
  },
  status: string,
) {
  if (!status) return true;
  const directMatch = action.fishItem?.status === status || action.auction?.status === status;
  const closedSaleMatch =
    action.action === "close_auction" && status === "sold" && action.fishItem?.status === "sold";

  return directMatch || closedSaleMatch;
}

function dateMatches(date: Date, filters: AdminFilters) {
  if (filters.fromDate && date < filters.fromDate) return false;
  if (filters.toDate) {
    const toDateInclusive = new Date(filters.toDate);
    toDateInclusive.setDate(toDateInclusive.getDate() + 1);
    if (date >= toDateInclusive) return false;
  }
  return true;
}

function matchesOptional(expected: string | undefined, actual: string | undefined) {
  return expected ? actual === expected : true;
}

function isEmptyFilter(value: string | undefined) {
  return !value;
}

function matchesOptionalDate(date: Date | undefined, filters: AdminFilters) {
  return date ? dateMatches(date, filters) : true;
}
