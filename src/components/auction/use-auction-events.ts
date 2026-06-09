import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { AuctionEvent } from "../../domain/events";
import type { AuctionDetail } from "../../server/auction-service";

type UseAuctionEventsParams = {
  auctionId: string;
  bidderId: string;
  onBidRejected: (message: string) => void;
};

type UseAuctionEventsResult = {
  connectionMessage: string | null;
};

// Owns the live Server-Sent Events connection for one auction: patches the
// auction-detail query cache on accepted bids, invalidates aggregates on close,
// and surfaces a connection message when the stream drops.
export function useAuctionEvents({
  auctionId,
  bidderId,
  onBidRejected,
}: UseAuctionEventsParams): UseAuctionEventsResult {
  const queryClient = useQueryClient();
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);

  // Keep the latest rejection handler in a ref so passing a new inline callback
  // each render does not tear down and re-open the EventSource.
  const onBidRejectedRef = useRef(onBidRejected);
  onBidRejectedRef.current = onBidRejected;

  useEffect(() => {
    const eventSource = new EventSource(
      `/api/auctions/${auctionId}/events${bidderId ? `?userId=${bidderId}` : ""}`,
    );

    const onAccepted = (event: MessageEvent<string>) => {
      const parsed = JSON.parse(event.data) as AuctionEvent;
      if (parsed.type !== "bid.accepted") return;

      queryClient.setQueryData<AuctionDetail>(["auction", auctionId], (current) => {
        if (!current) return current;
        if (current.bids.some((bid) => bid.bidId === parsed.bid.bidId)) {
          return current;
        }

        return {
          ...current,
          currentHighestBid: parsed.currentHighestBid,
          bids: [parsed.bid, ...current.bids],
        };
      });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    };

    const onRejected = (event: MessageEvent<string>) => {
      const parsed = JSON.parse(event.data) as AuctionEvent;
      if (parsed.type === "bid.rejected") {
        onBidRejectedRef.current(parsed.message);
      }
    };

    const onClosed = () => {
      queryClient.invalidateQueries({ queryKey: ["auction", auctionId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    };

    const onConnected = () => {
      setConnectionMessage(null);
      queryClient.invalidateQueries({ queryKey: ["auction", auctionId] });
    };

    const onRealtimeError = () => {
      setConnectionMessage(
        "Realtime connection interrupted. The browser will reconnect and this auction refreshes every few seconds.",
      );
    };

    eventSource.addEventListener("bid.accepted", onAccepted);
    eventSource.addEventListener("bid.rejected", onRejected);
    eventSource.addEventListener("auction.closed", onClosed);
    eventSource.addEventListener("sale.completed", onClosed);
    eventSource.addEventListener("connected", onConnected);
    eventSource.addEventListener("error", onRealtimeError);

    return () => eventSource.close();
  }, [auctionId, bidderId, queryClient]);

  return { connectionMessage };
}
