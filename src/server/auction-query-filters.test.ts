import { describe, expect, it } from "vitest";
import type { AdminFilters } from "../domain/validation";
import {
  adminActionQueryConditions,
  andAll,
  auctionQueryConditions,
  bidQueryConditions,
  fishQueryConditions,
  saleQueryConditions,
  statusChangeQueryConditions,
} from "./auction-query-filters";

const buyerId = "00000000-0000-4000-8000-000000000011";
const sellerId = "00000000-0000-4000-8000-000000000012";

function filters(overrides: Partial<AdminFilters> = {}): AdminFilters {
  return {
    status: undefined,
    species: undefined,
    sellerId: undefined,
    buyerId: undefined,
    fromDate: undefined,
    toDate: undefined,
    ...overrides,
  };
}

describe("auction query filter conditions", () => {
  it("returns no conditions when filters are absent", () => {
    expect(auctionQueryConditions()).toEqual([]);
    expect(bidQueryConditions()).toEqual([]);
    expect(saleQueryConditions()).toEqual([]);
    expect(fishQueryConditions()).toEqual([]);
    expect(statusChangeQueryConditions()).toEqual([]);
    expect(adminActionQueryConditions()).toEqual([]);
    expect(andAll([])).toBeUndefined();
  });

  it("builds auction filters for status, fish, buyer, and date ranges", () => {
    const conditions = auctionQueryConditions(
      "active",
      filters({
        status: "closed",
        species: "cod",
        sellerId,
        buyerId,
        fromDate: new Date("2026-06-01T00:00:00.000Z"),
        toDate: new Date("2026-06-09T00:00:00.000Z"),
      }),
    );

    expect(conditions).toHaveLength(7);
    expect(andAll(conditions)).toBeDefined();
  });

  it("maps incompatible buyer and status filters to false conditions", () => {
    expect(fishQueryConditions(filters({ buyerId }))).toHaveLength(1);
    expect(statusChangeQueryConditions(filters({ buyerId }))).toHaveLength(1);
    expect(adminActionQueryConditions(filters({ buyerId }))).toHaveLength(1);
    expect(saleQueryConditions(filters({ status: "active" }))).toHaveLength(1);
    expect(bidQueryConditions(filters({ status: "sold" }))).toHaveLength(1);
  });

  it("builds sale, bid, fish, status-change, and admin-action filters", () => {
    const commonFilters = filters({
      status: "sold",
      species: "salmon",
      sellerId,
      buyerId,
      fromDate: new Date("2026-06-01T00:00:00.000Z"),
      toDate: new Date("2026-06-09T00:00:00.000Z"),
    });

    expect(saleQueryConditions(commonFilters)).toHaveLength(5);
    expect(bidQueryConditions(commonFilters)).toHaveLength(6);
    expect(
      fishQueryConditions(filters({ status: "listed", species: "tuna", sellerId })),
    ).toHaveLength(3);
    expect(
      statusChangeQueryConditions(filters({ status: "withdrawn", species: "cod" })),
    ).toHaveLength(2);
    expect(
      adminActionQueryConditions(filters({ status: "withdrawn", species: "cod" })),
    ).toHaveLength(2);
    expect(adminActionQueryConditions(filters({ status: "closed" }))).toHaveLength(1);
    expect(adminActionQueryConditions(filters({ status: "sold" }))).toHaveLength(1);
  });
});
