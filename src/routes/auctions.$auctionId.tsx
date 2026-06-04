import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { centsFromMajor, formatMoney } from "../domain/money";
import { formatKilograms } from "../domain/weight";
import { speciesColorToken } from "../domain/species-color";
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
    refetchInterval: 5000,
  });

  const buyers = useMemo(
    () => users.data?.filter((user) => user.role === "buyer") ?? [],
    [users.data],
  );
  const [bidderId, setBidderId] = useState("");
  const [amountMajor, setAmountMajor] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);

  const suggestedAmountMajor = useMemo(() => {
    if (!auction.data) return "";
    const nextMinimum =
      auction.data.currentHighestBid === null
        ? auction.data.fish.startingPriceCents
        : auction.data.currentHighestBid.amountCents + auction.data.minimumIncrementCents;

    return (nextMinimum / 100).toFixed(2);
  }, [auction.data]);

  useEffect(() => {
    if (!bidderId && buyers[0]) {
      setBidderId(buyers[0].id);
    }
  }, [bidderId, buyers]);

  useEffect(() => {
    if (!amountMajor && suggestedAmountMajor) {
      setAmountMajor(suggestedAmountMajor);
    }
  }, [amountMajor, suggestedAmountMajor]);

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

  const bidMutation = useMutation({
    mutationFn: async () => {
      if (!auction.data) throw new Error("Auction is not loaded");
      if (!bidderId) throw new Error("Choose a demo buyer before submitting a bid");
      const amountCents = centsFromMajor(amountMajor);
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
      setMessage("Bid accepted and broadcast to listeners.");
      setAmountMajor("");
      queryClient.invalidateQueries({ queryKey: ["auction", auctionId] });
    },
    onError: (error) => setMessage(error.message),
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
        <div>
          <span className={`pill`}>{detail.status}</span>
          <h1>{detail.fish.displayName}</h1>
          <p>
            {detail.fish.species} · {detail.fish.grade} · {formatKilograms(detail.fish.weightGrams)}{" "}
            from {detail.fish.catchRegion}. Seller: {detail.seller.displayName}.
          </p>
        </div>
      </section>

      <section className="grid">
        <article className="card c-teal">
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
          {connectionMessage && <p className="muted">{connectionMessage}</p>}
        </article>

        <article className="card c-blue">
          <h2>
            Live bid chain{" "}
            {detail.status === "active" && <span className="badge stream">STREAMING</span>}
          </h2>
          <div className="list">
            {detail.bids.map((bid) => (
              <div className="row" key={bid.bidId}>
                <div className="name-wrap">
                  <span
                    className="sdot"
                    style={{ background: `var(${speciesColorToken(detail.fish.species)})` }}
                    aria-hidden="true"
                  />
                  <div>
                    <strong>{bid.bidderDisplayName}</strong>
                    <div className="sub">{new Date(bid.acceptedAt).toLocaleTimeString()}</div>
                  </div>
                </div>
                <span className="amount">{formatMoney(bid.amountCents)}</span>
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
