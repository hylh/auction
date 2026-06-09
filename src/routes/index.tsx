import { createFileRoute } from "@tanstack/react-router";
import { ActiveAuctionsCard } from "../components/dashboard/active-auctions-card";
import { InventoryActionCard } from "../components/dashboard/inventory-action-card";
import { LatestBidsCard } from "../components/dashboard/latest-bids-card";
import { RecentSalesCard } from "../components/dashboard/recent-sales-card";
import { StatStrip } from "../components/dashboard/stat-strip";
import { Ticker } from "../components/dashboard/ticker";
import { useDashboard } from "../components/dashboard/use-dashboard";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const dashboard = useDashboard();

  if (dashboard.isLoading) {
    return (
      <>
        <div className="ticker" style={{ height: "2.2rem" }} />
        <main className="page">Loading live auction floor...</main>
      </>
    );
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
    <>
      <Ticker series={data.tickerSeries} />
      <main className="page">
        <section className="hero">
          <div>
            <span className="pill">
              <span className="dot" />
              Auction floor live
            </span>
            <h1>Real-time bids for fresh Nordic catch.</h1>
            <p>
              PostgreSQL + Drizzle + TanStack Start, streamed over per-auction Server-Sent Events.
            </p>
          </div>
        </section>

        <StatStrip stats={data.stats} />

        <section className="grid">
          <ActiveAuctionsCard auctions={data.activeAuctions} />
          <LatestBidsCard bids={data.latestBids} />
          <RecentSalesCard sales={data.recentSales} />
          <InventoryActionCard inventory={data.inventoryNeedingAction} />
        </section>
      </main>
    </>
  );
}
