import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { nextMinimumBidCents } from "../domain/bid-builder";
import { formatKilograms } from "../domain/weight";
import { BidChainCard } from "../components/auction/bid-chain-card";
import { PlaceBidCard } from "../components/auction/place-bid-card";
import { useAuctionEvents } from "../components/auction/use-auction-events";
import { useBidBarHeight } from "../components/auction/use-bid-bar-height";
import { usePlaceBid } from "../components/auction/use-place-bid";
import { getAuctionDetailFn, getDemoUsersFn } from "../server/functions";

export const Route = createFileRoute("/auctions/$auctionId")({
  component: AuctionDetailPage,
});

function AuctionDetailPage() {
  const { auctionId } = Route.useParams();
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

  const [selectedBidderId, setSelectedBidderId] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const { pageRef, bidBarRef } = useBidBarHeight();

  // Derive the effective buyer and bid amount during render instead of syncing
  // them with effects: fall back to the first buyer and the suggested next
  // minimum bid until the user explicitly picks their own values.
  const bidderId = selectedBidderId || buyers[0]?.id || "";

  const suggestedAmountMajor = useMemo(() => {
    if (!auction.data) return "";
    const nextMinimum = nextMinimumBidCents({
      currentHighestBidCents: auction.data.currentHighestBid?.amountCents ?? null,
      startingPriceCents: auction.data.fish.startingPriceCents,
      minimumIncrementCents: auction.data.minimumIncrementCents,
    });

    return String(nextMinimum / 100);
  }, [auction.data]);

  const amountMajor = amountInput || suggestedAmountMajor;

  const { connectionMessage } = useAuctionEvents({
    auctionId,
    bidderId,
    onBidRejected: setMessage,
  });

  const bidMutation = usePlaceBid({
    auctionId,
    auction: auction.data,
    bidderId,
    amountMajor,
    onMessage: setMessage,
    onAccepted: () => setAmountInput(""),
  });

  if (auction.isLoading) {
    return <main className="page">Loading auction...</main>;
  }

  if (auction.isError || !auction.data) {
    return (
      <main className="page">
        <div className="error">Could not load this auction.</div>
      </main>
    );
  }

  const detail = auction.data;
  const nextMinimum = nextMinimumBidCents({
    currentHighestBidCents: detail.currentHighestBid?.amountCents ?? null,
    startingPriceCents: detail.fish.startingPriceCents,
    minimumIncrementCents: detail.minimumIncrementCents,
  });

  return (
    <main className="page auction-detail-page" ref={pageRef}>
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

      <section className="grid">
        <PlaceBidCard
          detail={detail}
          buyers={buyers}
          bidderId={bidderId}
          onBidderChange={setSelectedBidderId}
          amountMajor={amountMajor}
          onAmountChange={setAmountInput}
          nextMinimum={nextMinimum}
          isPending={bidMutation.isPending}
          message={message}
          connectionMessage={connectionMessage}
          onSubmit={() => {
            setMessage(null);
            bidMutation.mutate();
          }}
          bidBarRef={bidBarRef}
        />
        <BidChainCard detail={detail} />
      </section>
    </main>
  );
}
