import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { centsFromMajor } from "../../domain/money";
import type { AuctionDetail, PlaceBidResult } from "../../server/auction-service";
import { placeBidFn } from "../../server/functions";

type UsePlaceBidParams = {
  auctionId: string;
  auction: AuctionDetail | undefined;
  bidderId: string;
  amountMajor: string;
  onMessage: (message: string) => void;
  onAccepted: () => void;
};

// Owns the place-bid mutation: builds the validated payload, patches the
// auction-detail cache on an accepted bid, and reports a message for both
// accepted and rejected outcomes.
export function usePlaceBid({
  auctionId,
  auction,
  bidderId,
  amountMajor,
  onMessage,
  onAccepted,
}: UsePlaceBidParams): UseMutationResult<PlaceBidResult, Error, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!auction) throw new Error("Auction is not loaded");
      if (!bidderId) throw new Error("Choose a demo buyer before submitting a bid");
      const amountCents = centsFromMajor(amountMajor);
      return placeBidFn({
        data: {
          auctionId,
          bidderId,
          amountCents,
          expectedHighestBidCents: auction.currentHighestBid?.amountCents ?? null,
        },
      });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        onMessage(result.message);
        return;
      }

      queryClient.setQueryData<AuctionDetail>(["auction", auctionId], (current) => {
        if (!current) return current;
        if (current.bids.some((bid) => bid.bidId === result.event.bid.bidId)) {
          return current;
        }

        return {
          ...current,
          currentHighestBid: result.event.currentHighestBid,
          bids: [result.event.bid, ...current.bids],
        };
      });
      onMessage("Bid accepted and broadcast to listeners.");
      onAccepted();
      queryClient.invalidateQueries({ queryKey: ["auction", auctionId] });
    },
    onError: (error) => onMessage(error.message),
  });
}
