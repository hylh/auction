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

export const DEMO_AUCTIONS = {
  salmon: "10000000-0000-4000-8000-000000000001",
  cod: "10000000-0000-4000-8000-000000000002",
  tuna: "10000000-0000-4000-8000-000000000003",
} as const;

export const DEMO_FISH = {
  salmon: "20000000-0000-4000-8000-000000000001",
  cod: "20000000-0000-4000-8000-000000000002",
  tuna: "20000000-0000-4000-8000-000000000003",
  herring: "20000000-0000-4000-8000-000000000004",
  trout: "20000000-0000-4000-8000-000000000005",
  mackerel: "20000000-0000-4000-8000-000000000006",
  halibut: "20000000-0000-4000-8000-000000000007",
} as const;
