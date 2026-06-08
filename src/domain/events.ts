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

export function bidAcceptedEvent(auctionId: string, snapshot: BidSnapshot): BidAcceptedEvent {
  return {
    type: "bid.accepted",
    auctionId,
    bid: snapshot,
    currentHighestBid: snapshot,
  };
}

export function bidRejectedEvent(input: {
  auctionId: string;
  actorUserId: string;
  code: BidErrorCode;
  message: string;
  currentHighestBidCents: number | null;
  rejectedAt: Date;
}): BidRejectedEvent {
  return {
    type: "bid.rejected",
    auctionId: input.auctionId,
    actorUserId: input.actorUserId,
    code: input.code,
    message: input.message,
    currentHighestBidCents: input.currentHighestBidCents,
    rejectedAt: input.rejectedAt.toISOString(),
  };
}

export function auctionClosedEvent(
  auctionId: string,
  status: "closed" | "unsold",
  closedAt: Date,
): AuctionClosedEvent {
  return {
    type: "auction.closed",
    auctionId,
    status,
    closedAt: closedAt.toISOString(),
  };
}

export function saleCompletedEvent(
  auctionId: string,
  saleId: string,
  amountCents: number,
  completedAt: Date,
): SaleCompletedEvent {
  return {
    type: "sale.completed",
    auctionId,
    saleId,
    amountCents,
    completedAt: completedAt.toISOString(),
  };
}

type AuctionEventSubscription = {
  userId: string | null | undefined;
  listener: AuctionEventListener;
};

class AuctionEventBus {
  private readonly listeners = new Map<string, Set<AuctionEventSubscription>>();

  publish(event: AuctionEvent) {
    const subscribers = this.listeners.get(event.auctionId);
    if (!subscribers) return;

    for (const subscriber of subscribers) {
      if (shouldDeliverAuctionEventToSubscriber(event, subscriber.userId)) {
        subscriber.listener(event);
      }
    }
  }

  subscribe(
    auctionId: string,
    listener: AuctionEventListener,
    options: { userId?: string | null } = {},
  ) {
    const auctionListeners = this.listeners.get(auctionId) ?? new Set<AuctionEventSubscription>();
    const subscription = {
      userId: options.userId,
      listener,
    };
    auctionListeners.add(subscription);
    this.listeners.set(auctionId, auctionListeners);

    return () => {
      auctionListeners.delete(subscription);
      if (auctionListeners.size === 0) {
        this.listeners.delete(auctionId);
      }
    };
  }

  reset() {
    this.listeners.clear();
  }
}

export function shouldDeliverAuctionEventToSubscriber(
  event: AuctionEvent,
  userId: string | null | undefined,
) {
  return event.type !== "bid.rejected" || event.actorUserId === userId;
}

const defaultAuctionEventBus = new AuctionEventBus();

export function publishAuctionEvent(event: AuctionEvent) {
  defaultAuctionEventBus.publish(event);
}

export function subscribeToAuction(
  auctionId: string,
  listener: AuctionEventListener,
  options: { userId?: string | null } = {},
) {
  return defaultAuctionEventBus.subscribe(auctionId, listener, options);
}

export function resetAuctionEventBus() {
  defaultAuctionEventBus.reset();
}
