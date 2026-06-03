import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { formatMoney } from "../domain/money";
import { formatKilograms } from "../domain/weight";
import { getDashboardFn } from "../server/functions";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboardFn(),
  });

  if (dashboard.isLoading) {
    return <main className="page">Loading live auction floor...</main>;
  }

  if (dashboard.isError || !dashboard.data) {
    return (
      <main className="page">
        <div className="error">
          Could not load auction data. Start PostgreSQL, run migrations, then seed the demo data.
        </div>
      </main>
    );
  }

  const data = dashboard.data;

  return (
    <main className="page">
      <section className="hero">
        <span className="pill">Live fish auction POC</span>
        <h1>Real-time bids for fresh Nordic catch.</h1>
        <p>
          Active auctions, accepted bids, completed sales, and fish inventory are backed by
          PostgreSQL, Drizzle, TanStack Start server functions, TanStack Query, and per-auction
          Server-Sent Events.
        </p>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Active auctions</h2>
          <div className="list">
            {data.activeAuctions.map((auction) => (
              <div className="row" key={auction.id}>
                <div>
                  <strong>{auction.fish.displayName}</strong>
                  <div className="muted">
                    {auction.fish.species} from {auction.fish.catchRegion} ·{" "}
                    {formatKilograms(auction.fish.weightGrams)}
                  </div>
                </div>
                <div>
                  <Link to="/auctions/$auctionId" params={{ auctionId: auction.id }}>
                    {auction.currentHighestBid
                      ? formatMoney(auction.currentHighestBid.amountCents)
                      : formatMoney(auction.fish.startingPriceCents)}
                  </Link>
                </div>
              </div>
            ))}
            {data.activeAuctions.length === 0 && (
              <p className="muted">No active auctions are seeded yet.</p>
            )}
          </div>
        </article>

        <article className="card">
          <h2>Latest accepted bids</h2>
          <div className="list">
            {data.latestBids.map((bid) => (
              <div className="row" key={bid.bidId}>
                <div>
                  <strong>{bid.bidderDisplayName}</strong>
                  <div className="muted">{bid.fishDisplayName}</div>
                </div>
                <span>{formatMoney(bid.amountCents)}</span>
              </div>
            ))}
            {data.latestBids.length === 0 && (
              <p className="muted">Accepted bid history will appear here.</p>
            )}
          </div>
        </article>

        <article className="card">
          <h2>Recent sales</h2>
          <div className="list">
            {data.recentSales.map((sale) => (
              <div className="row" key={sale.id}>
                <div>
                  <strong>{sale.fishDisplayName}</strong>
                  <div className="muted">
                    {sale.buyerDisplayName} bought from {sale.sellerDisplayName}
                  </div>
                </div>
                <span>{formatMoney(sale.amountCents)}</span>
              </div>
            ))}
            {data.recentSales.length === 0 && (
              <p className="muted">Completed auction sales will appear here.</p>
            )}
          </div>
        </article>

        <article className="card">
          <h2>Inventory needing action</h2>
          <div className="list">
            {data.inventoryNeedingAction.map((fish) => (
              <div className="row" key={fish.id}>
                <div>
                  <strong>{fish.displayName}</strong>
                  <div className="muted">
                    {fish.status} · {fish.grade} · {formatKilograms(fish.weightGrams)}
                  </div>
                </div>
                <span>{formatMoney(fish.startingPriceCents)}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
