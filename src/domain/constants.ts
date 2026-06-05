export const CURRENCY = "NOK";

export const USER_ROLES = ["seller", "buyer", "admin"] as const;

export const FISH_SPECIES = [
  "salmon",
  "cod",
  "tuna",
  "halibut",
  "mackerel",
  "trout",
  "herring",
] as const;

export const INVENTORY_STATUSES = ["draft", "listed", "in_auction", "sold", "withdrawn"] as const;

export const AUCTION_STATUSES = ["scheduled", "active", "closed", "unsold", "withdrawn"] as const;

export const ADMIN_STATUSES = [
  "draft",
  "listed",
  "in_auction",
  "sold",
  "withdrawn",
  "scheduled",
  "active",
  "closed",
  "unsold",
] as const;

export const DEMO_USERS = {
  sellerNorth: "00000000-0000-4000-8000-000000000001",
  sellerFjord: "00000000-0000-4000-8000-000000000002",
  buyerOslo: "00000000-0000-4000-8000-000000000003",
  buyerBergen: "00000000-0000-4000-8000-000000000004",
  admin: "00000000-0000-4000-8000-000000000005",
} as const;

export const SEED_SCENARIOS = ["default", "busy-auction", "all-expired", "no-bids"] as const;

export type SeedScenario = (typeof SEED_SCENARIOS)[number];
