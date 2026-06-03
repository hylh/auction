import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { formatMoney } from "../domain/money";
import { formatKilograms } from "../domain/weight";
import type { AuctionEvent } from "../domain/events";
import type { AuctionDetail } from "../server/auction-service";
import { getAuctionDetailFn, getDemoUsersFn, placeBidFn } from "../server/functions";

export const Route = createFileRoute("/auctions/$auctionId")({
  component: AuctionDetailPage,
});

function AuctionDetailPage() {
  const { auctionId } = Route.useParams();
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ["demo-users"], queryFn: () => getDemoUsersFn() });
  const auction = useQuery({
    queryKey: ["auction", auctionId],
    queryFn: () => getAuctionDetailFn({ data: { auctionId } }),
  });

  const buyers = useMemo(
    () => users.data?.filter((user) => user.role === "buyer") ?? [],
    [users.data],
  );
  const [bidderId, setBidderId] = useState("");
  const [amountMajor, setAmountMajor] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!bidderId && buyers[0]) {
      setBidderId(buyers[0].id);
    }
  }, [bidderId, buyers]);

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
        setMessage(parsed.message);
      }
    };

    const onClosed = () => {
      queryClient.invalidateQueries({ queryKey: ["auction", auctionId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    };

    eventSource.addEventListener("bid.accepted", onAccepted);
    eventSource.addEventListener("bid.rejected", onRejected);
    eventSource.addEventListener("auction.closed", onClosed);
    eventSource.addEventListener("sale.completed", onClosed);

    return () => eventSource.close();
  }, [auctionId, bidderId, queryClient]);

  const bidMutation = useMutation({
    mutationFn: async () => {
      if (!auction.data) throw new Error("Auction is not loaded");
      const amountCents = Math.round(Number(amountMajor) * 100);
      return placeBidFn({
        data: {
          auctionId,
          bidderId,
          amountCents,
          expectedHighestBidCents: auction.data.currentHighestBid?.amountCents ?? null,
        },
      });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setMessage("Bid accepted and broadcast to listeners.");
      setAmountMajor("");
      queryClient.invalidateQueries({ queryKey: ["auction", auctionId] });
    },
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
  const nextMinimum =
    detail.currentHighestBid === null
      ? detail.fish.startingPriceCents
      : detail.currentHighestBid.amountCents + detail.minimumIncrementCents;

  return (
    <main className="page">
      <section className="hero">
        <span className="pill">{detail.status}</span>
        <h1>{detail.fish.displayName}</h1>
        <p>
          {detail.fish.species} · {detail.fish.grade} · {formatKilograms(detail.fish.weightGrams)}{" "}
          from {detail.fish.catchRegion}. Seller: {detail.seller.displayName}.
        </p>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Place bid</h2>
          <p className="metric">
            {detail.currentHighestBid
              ? formatMoney(detail.currentHighestBid.amountCents)
              : formatMoney(detail.fish.startingPriceCents)}
          </p>
          <p className="muted">
            Next valid bid: {formatMoney(nextMinimum)} · increment{" "}
            {formatMoney(detail.minimumIncrementCents)}
          </p>

          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              setMessage(null);
              bidMutation.mutate();
            }}
          >
            <label className="field">
              <span>Demo buyer</span>
              <select value={bidderId} onChange={(event) => setBidderId(event.currentTarget.value)}>
                {buyers.map((buyer) => (
                  <option key={buyer.id} value={buyer.id}>
                    {buyer.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Bid amount ({detail.fish.currency})</span>
              <input
                inputMode="decimal"
                value={amountMajor}
                onChange={(event) => setAmountMajor(event.currentTarget.value)}
                placeholder={(nextMinimum / 100).toFixed(2)}
              />
            </label>
            <button className="button" disabled={bidMutation.isPending} type="submit">
              {bidMutation.isPending ? "Submitting..." : "Submit bid"}
            </button>
          </form>

          {message && (
            <p className={message.includes("accepted") ? "success" : "error"}>{message}</p>
          )}
        </article>

        <article className="card">
          <h2>Live bid chain</h2>
          <div className="list">
            {detail.bids.map((bid) => (
              <div className="row" key={bid.bidId}>
                <div>
                  <strong>{bid.bidderDisplayName}</strong>
                  <div className="muted">{new Date(bid.acceptedAt).toLocaleTimeString()}</div>
                </div>
                <span>{formatMoney(bid.amountCents)}</span>
              </div>
            ))}
            {detail.bids.length === 0 && (
              <p className="muted">No accepted bids yet. Be the first buyer.</p>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
