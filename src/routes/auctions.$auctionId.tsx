import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type RefObject } from "react";
import { nextMinimumBidCents } from "../domain/bid-builder";
import { formatKilograms } from "../domain/weight";
import { BidChainCard } from "../components/auction/bid-chain-card";
import { PlaceBidCard } from "../components/auction/place-bid-card";
import { useAuctionEvents } from "../components/auction/use-auction-events";
import { useBidBarHeight } from "../components/auction/use-bid-bar-height";
import { usePlaceBid } from "../components/auction/use-place-bid";
import type { AuctionDetail } from "../server/auction-service";
import { getAuctionDetailFn, getDemoUsersFn } from "../server/functions";

export const Route = createFileRoute("/auctions/$auctionId")({
  component: AuctionDetailPage,
});

function AuctionDetailPage() {
  const { auctionId } = Route.useParams();
  const view = useAuctionDetailView(auctionId);

  if (view.auction.isLoading) return <AuctionLoadingState />;
  if (view.auction.isError || !view.auction.data) return <AuctionErrorState />;

  return (
    <main className="page auction-detail-page" ref={view.pageRef}>
      <AuctionHero detail={view.auction.data} />
      <AuctionBidSection
        detail={view.auction.data}
        buyers={view.buyers}
        bidderId={view.bidderId}
        onBidderChange={view.setSelectedBidderId}
        amountMajor={view.amountMajor}
        onAmountChange={view.setAmountInput}
        isPending={view.bidMutation.isPending}
        message={view.message}
        connectionMessage={view.connectionMessage}
        onSubmit={view.submitBid}
        bidBarRef={view.bidBarRef}
      />
    </main>
  );
}

function useAuctionDetailView(auctionId: string) {
  const { auction, buyers } = useAuctionQueries(auctionId);
  const bidDraft = useBidDraft(auction.data, buyers);
  const [message, setMessage] = useState<string | null>(null);
  const { pageRef, bidBarRef } = useBidBarHeight();

  const { connectionMessage } = useAuctionEvents({
    auctionId,
    bidderId: bidDraft.bidderId,
    onBidRejected: setMessage,
  });

  const bidMutation = usePlaceBid({
    auctionId,
    auction: auction.data,
    bidderId: bidDraft.bidderId,
    amountMajor: bidDraft.amountMajor,
    onMessage: setMessage,
    onAccepted: () => bidDraft.setAmountInput(""),
  });

  return {
    auction,
    buyers,
    bidderId: bidDraft.bidderId,
    setSelectedBidderId: bidDraft.setSelectedBidderId,
    amountMajor: bidDraft.amountMajor,
    setAmountInput: bidDraft.setAmountInput,
    bidMutation,
    message,
    connectionMessage,
    pageRef,
    bidBarRef,
    submitBid: () => {
      setMessage(null);
      bidMutation.mutate();
    },
  };
}

function useAuctionQueries(auctionId: string) {
  const users = useQuery({ queryKey: ["demo-users"], queryFn: () => getDemoUsersFn() });
  const auction = useQuery({
    queryKey: ["auction", auctionId],
    queryFn: () => getAuctionDetailFn({ data: { auctionId } }),
    refetchInterval: 5000,
  });
  const buyers = useMemo(
    () => users.data?.filter((user) => user.role === "buyer") ?? [],
    [users.data],
  );

  return { auction, buyers };
}

function useBidDraft(
  auction: AuctionDetail | undefined,
  buyers: Array<{ id: string; displayName: string }>,
) {
  const [selectedBidderId, setSelectedBidderId] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const bidderId = selectedBidderId || buyers[0]?.id || "";
  const suggestedAmountMajor = useMemo(() => {
    if (!auction) return "";
    return String(nextMinimumBid(auction) / 100);
  }, [auction]);

  return {
    bidderId,
    setSelectedBidderId,
    amountMajor: amountInput || suggestedAmountMajor,
    setAmountInput,
  };
}

function AuctionLoadingState() {
  return <main className="page">Loading auction...</main>;
}

function AuctionErrorState() {
  return (
    <main className="page">
      <div className="error">Could not load this auction.</div>
    </main>
  );
}

function AuctionHero({ detail }: { detail: AuctionDetail }) {
  return (
    <section className="hero">
      <div>
        <span className="pill">{detail.status}</span>
        <h1>{detail.fish.displayName}</h1>
        <p>
          {detail.fish.species} · {detail.fish.grade} · {formatKilograms(detail.fish.weightGrams)}{" "}
          from {detail.fish.catchRegion}. Seller: {detail.seller.displayName}.
        </p>
      </div>
    </section>
  );
}

function AuctionBidSection({
  detail,
  buyers,
  bidderId,
  onBidderChange,
  amountMajor,
  onAmountChange,
  isPending,
  message,
  connectionMessage,
  onSubmit,
  bidBarRef,
}: {
  detail: AuctionDetail;
  buyers: Array<{ id: string; displayName: string }>;
  bidderId: string;
  onBidderChange: (bidderId: string) => void;
  amountMajor: string;
  onAmountChange: (amount: string) => void;
  isPending: boolean;
  message: string | null;
  connectionMessage: string | null;
  onSubmit: () => void;
  bidBarRef: RefObject<HTMLElement | null>;
}) {
  return (
    <section className="grid">
      <PlaceBidCard
        detail={detail}
        buyers={buyers}
        bidderId={bidderId}
        onBidderChange={onBidderChange}
        amountMajor={amountMajor}
        onAmountChange={onAmountChange}
        nextMinimum={nextMinimumBid(detail)}
        isPending={isPending}
        message={message}
        connectionMessage={connectionMessage}
        onSubmit={onSubmit}
        bidBarRef={bidBarRef}
      />
      <BidChainCard detail={detail} />
    </section>
  );
}

function nextMinimumBid(detail: AuctionDetail) {
  return nextMinimumBidCents({
    currentHighestBidCents: detail.currentHighestBid?.amountCents ?? null,
    startingPriceCents: detail.fish.startingPriceCents,
    minimumIncrementCents: detail.minimumIncrementCents,
  });
}
