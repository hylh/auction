import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DEMO_USERS } from "../domain/constants";
import { formatMoney } from "../domain/money";
import { getAdminDataFn, closeAuctionFn } from "../server/functions";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const queryClient = useQueryClient();
  const admin = useQuery({ queryKey: ["admin"], queryFn: () => getAdminDataFn() });
  const closeMutation = useMutation({
    mutationFn: (auctionId: string) =>
      closeAuctionFn({
        data: {
          auctionId,
          adminUserId: DEMO_USERS.admin,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  if (admin.isLoading) {
    return <main className="page">Loading admin dashboard...</main>;
  }

  if (admin.isError || !admin.data) {
    return (
      <main className="page">
        <div className="error">Could not load admin data.</div>
      </main>
    );
  }

  const data = admin.data;

  return (
    <main className="page">
      <section className="hero">
        <span className="pill">Audit and statistics</span>
        <h1>Admin auction history.</h1>
        <p>
          Completed sales, bid history, open auctions, and live aggregate statistics are computed
          from PostgreSQL records.
        </p>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Total sales</h2>
          <p className="metric">{formatMoney(data.statistics.totalSalesCents)}</p>
        </article>
        <article className="card">
          <h2>Average bid</h2>
          <p className="metric">{formatMoney(data.statistics.averageBidCents)}</p>
        </article>
        <article className="card">
          <h2>Popular fish</h2>
          <div className="list">
            {data.statistics.popularFish.map((fish) => (
              <div className="row" key={fish.species}>
                <strong>{fish.species}</strong>
                <span>
                  {fish.bidCount} bids · {fish.totalKilogramsSold.toFixed(1)} kg sold
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid" style={{ marginTop: "1rem" }}>
        <article className="card">
          <h2>Auctions</h2>
          <div className="list">
            {data.auctions.map((auction) => (
              <div className="row" key={auction.id}>
                <div>
                  <strong>{auction.fish.displayName}</strong>
                  <div className="muted">
                    {auction.status} · highest{" "}
                    {auction.currentHighestBid
                      ? formatMoney(auction.currentHighestBid.amountCents)
                      : "no bids"}
                  </div>
                </div>
                {auction.status === "active" && (
                  <button
                    className="button secondary"
                    disabled={closeMutation.isPending}
                    onClick={() => closeMutation.mutate(auction.id)}
                    type="button"
                  >
                    Close
                  </button>
                )}
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <h2>Completed sales</h2>
          <div className="list">
            {data.completedSales.map((sale) => (
              <div className="row" key={sale.id}>
                <div>
                  <strong>{sale.fishDisplayName}</strong>
                  <div className="muted">
                    {sale.buyerDisplayName} · {new Date(sale.completedAt).toLocaleDateString()}
                  </div>
                </div>
                <span>{formatMoney(sale.amountCents)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <h2>Bid history</h2>
          <div className="list">
            {data.bidHistory.map((bid) => (
              <div className="row" key={bid.bidId}>
                <div>
                  <strong>{bid.fishDisplayName}</strong>
                  <div className="muted">{bid.bidderDisplayName}</div>
                </div>
                <span>{formatMoney(bid.amountCents)}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
