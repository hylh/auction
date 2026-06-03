import type { BidErrorCode } from "./bid-rules";

export type BidSnapshot = {
  bidId: string;
  amountCents: number;
  bidderDisplayName: string;
  acceptedAt: string;
};

export type BidAcceptedEvent = {
  type: "bid.accepted";
  auctionId: string;
  bid: BidSnapshot;
  currentHighestBid: BidSnapshot;
};

export type BidRejectedEvent = {
  type: "bid.rejected";
  auctionId: string;
  actorUserId: string;
  code: BidErrorCode;
  message: string;
  currentHighestBidCents: number | null;
  rejectedAt: string;
};

export type AuctionClosedEvent = {
  type: "auction.closed";
  auctionId: string;
  status: "closed" | "unsold";
  closedAt: string;
};

export type SaleCompletedEvent = {
  type: "sale.completed";
  auctionId: string;
  saleId: string;
  amountCents: number;
  completedAt: string;
};

export type AuctionEvent =
  | BidAcceptedEvent
  | BidRejectedEvent
  | AuctionClosedEvent
  | SaleCompletedEvent;

export type AuctionEventListener = (event: AuctionEvent) => void;

const listeners = new Map<string, Set<AuctionEventListener>>();

export function publishAuctionEvent(event: AuctionEvent) {
  const subscribers = listeners.get(event.auctionId);
  if (!subscribers) return;

  for (const listener of subscribers) {
    listener(event);
  }
}

export function subscribeToAuction(auctionId: string, listener: AuctionEventListener) {
  const auctionListeners = listeners.get(auctionId) ?? new Set<AuctionEventListener>();
  auctionListeners.add(listener);
  listeners.set(auctionId, auctionListeners);

  return () => {
    auctionListeners.delete(listener);
    if (auctionListeners.size === 0) {
      listeners.delete(auctionId);
    }
  };
}
