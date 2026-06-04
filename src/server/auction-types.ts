import type { BidErrorCode } from "../domain/bid-rules";
import type {
  AuctionClosedEvent,
  BidAcceptedEvent,
  BidSnapshot,
  SaleCompletedEvent,
} from "../domain/events";

export type AuctionLifecycleStatus = "scheduled" | "active" | "closed" | "unsold" | "withdrawn";
export type InventoryLifecycleStatus = "draft" | "listed" | "in_auction" | "sold" | "withdrawn";
export type CloseReason = "manual" | "expired";

export type DemoUser = {
  id: string;
  displayName: string;
  role: "seller" | "buyer" | "admin";
};

export type FishSummary = {
  id: string;
  species: string;
  displayName: string;
  weightGrams: number;
  catchRegion: string;
  grade: string;
  startingPriceCents: number;
  currency: string;
  status: string;
};

export type AuctionSummary = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  minimumIncrementCents: number;
  fish: FishSummary;
  seller: DemoUser;
  currentHighestBid: BidSnapshot | null;
};

export type SaleSummary = {
  id: string;
  auctionId: string;
  fishDisplayName: string;
  species: string;
  weightGrams: number;
  buyerDisplayName: string;
  sellerDisplayName: string;
  amountCents: number;
  completedAt: string;
};

export type InventoryStatusChangeSummary = {
  id: string;
  fishItemId: string;
  fishDisplayName: string;
  species: string;
  fromStatus: string | null;
  toStatus: string;
  changedByDisplayName: string | null;
  reason: string;
  createdAt: string;
};

export type AdminActionSummary = {
  id: string;
  adminDisplayName: string;
  action: string;
  auctionId: string | null;
  fishItemId: string | null;
  fishDisplayName: string | null;
  reason: string;
  createdAt: string;
};

export type DashboardData = {
  demoUsers: Array<DemoUser>;
  activeAuctions: Array<AuctionSummary>;
  latestBids: Array<
    BidSnapshot & {
      auctionId: string;
      fishDisplayName: string;
      species: string;
    }
  >;
  recentSales: Array<SaleSummary>;
  inventoryNeedingAction: Array<FishSummary>;
};

export type AuctionDetail = AuctionSummary & {
  bids: Array<BidSnapshot>;
};

export type AdminData = {
  demoUsers: Array<DemoUser>;
  completedSales: Array<SaleSummary>;
  auctions: Array<AuctionSummary>;
  inventoryNeedingAction: Array<FishSummary>;
  withdrawnInventory: Array<FishSummary>;
  inventoryStatusChanges: Array<InventoryStatusChangeSummary>;
  adminActions: Array<AdminActionSummary>;
  bidHistory: Array<
    BidSnapshot & {
      auctionId: string;
      fishDisplayName: string;
      species: string;
    }
  >;
  statistics: {
    totalSalesCents: number;
    averageBidCents: number;
    popularFish: Array<{
      species: string;
      bidCount: number;
      totalKilogramsSold: number;
      totalSalesCents: number;
    }>;
  };
};

export type CloseAuctionResult = {
  auctionId: string;
  status: AuctionLifecycleStatus;
  changed: boolean;
  closedEvent: AuctionClosedEvent | null;
  saleEvent: SaleCompletedEvent | null;
};

export type PlaceBidResult =
  | {
      ok: true;
      event: BidAcceptedEvent;
    }
  | {
      ok: false;
      code: BidErrorCode;
      message: string;
      currentHighestBidCents: number | null;
    };
