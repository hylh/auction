import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { speciesColorToken } from "../domain/species-color";
import { formatTime } from "../domain/datetime";
import { formatMoney, formatMoneyWhole } from "../domain/money";
import { formatKilograms } from "../domain/weight";
import { getDashboardFn } from "../server/functions";
import type { TickerEntry } from "../server/auction-types";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function avatarInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

// Deterministic avatar colour from buyer name
const AVATAR_COLORS = ["#0d9488", "#2563eb", "#db2777", "#d97706", "#7c3aed", "#0891b2", "#16a34a"];
function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? "#0d9488";
}

function SpeciesDot({ species }: { species: string }) {
  return (
    <span
      className="sdot"
      style={{ background: `var(${speciesColorToken(species)})` }}
      aria-hidden="true"
    />
  );
}

function Ticker({ series }: { series: Array<TickerEntry> }) {
  const [paused, setPaused] = useState(false);

  if (series.length === 0) return null;

  // Duplicate for seamless loop
  const items = [...series, ...series];

  return (
    <div className="ticker">
      <button
        aria-label={paused ? "Play ticker" : "Pause ticker"}
        aria-pressed={paused}
        className="ticker-toggle"
        onClick={() => setPaused((p) => !p)}
        type="button"
      >
        {paused ? "▶" : "⏸"}
      </button>
      <div className="ticker-viewport">
        <div className={`track${paused ? " paused" : ""}`}>
          {items.map((entry, idx) => (
            <span key={`${entry.species}-${idx}`} aria-hidden={idx >= series.length || undefined}>
              {entry.species.toUpperCase()} <b>{formatMoney(entry.latestPriceCents)}</b>
              {entry.deltaPct !== null && (
                <span className={entry.deltaPct >= 0 ? "up" : undefined}>
                  {entry.deltaPct >= 0 ? " ▲ +" : " ▼ "}
                  {Math.abs(entry.deltaPct).toFixed(1)}%
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboardFn(),
    refetchInterval: 5000,
  });

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
  const { stats, tickerSeries } = data;

  return (
    <>
      <Ticker series={tickerSeries} />
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

        <section className="stat-strip">
          <div className="stat teal">
            <div className="label">Total sales today</div>
            <div className="value">{formatMoneyWhole(stats.totalSalesTodayCents)}</div>
            <div className="delta">▲ from completed auctions</div>
          </div>
          <div className="stat blue">
            <div className="label">Average bid</div>
            <div className="value">{formatMoneyWhole(stats.averageBidCents)}</div>
            <div className="delta">all accepted bids</div>
          </div>
          <div className="stat amber">
            <div className="label">Active auctions</div>
            <div className="value">{stats.activeAuctionCount}</div>
            <div className="delta">live on the floor</div>
          </div>
          <div className="stat violet">
            <div className="label">Bids / min</div>
            <div className="value">{stats.bidsLastMinute}</div>
            <div className="delta">▲ last 60 seconds</div>
          </div>
        </section>

        <section className="grid">
          <article className="card c-teal">
            <h2>
              Active auctions{" "}
              {data.activeAuctions.length > 0 && (
                <span className="badge live">{data.activeAuctions.length} LIVE</span>
              )}
            </h2>
            <div className="list">
              {data.activeAuctions.map((auction) => (
                <div className="row" key={auction.id}>
                  <div className="name-wrap">
                    <SpeciesDot species={auction.fish.species} />
                    <div>
                      <Link to="/auctions/$auctionId" params={{ auctionId: auction.id }}>
                        {auction.fish.displayName}
                      </Link>
                      <div className="sub">
                        {auction.fish.species} · {auction.fish.catchRegion} ·{" "}
                        {formatKilograms(auction.fish.weightGrams)}
                      </div>
                    </div>
                  </div>
                  <Link
                    to="/auctions/$auctionId"
                    params={{ auctionId: auction.id }}
                    className="amount live"
                  >
                    {auction.currentHighestBid
                      ? formatMoney(auction.currentHighestBid.amountCents)
                      : formatMoney(auction.fish.startingPriceCents)}
                  </Link>
                </div>
              ))}
              {data.activeAuctions.length === 0 && (
                <p className="muted">No active auctions right now.</p>
              )}
            </div>
          </article>

          <article className="card c-blue">
            <h2>
              Latest accepted bids <span className="badge stream">STREAMING</span>
            </h2>
            <div className="list">
              {data.latestBids.map((bid) => (
                <div className="row" key={bid.bidId}>
                  <div className="name-wrap">
                    <span
                      className="avatar"
                      style={{ background: avatarColor(bid.bidderDisplayName) }}
                      aria-hidden="true"
                    >
                      {avatarInitials(bid.bidderDisplayName)}
                    </span>
                    <div>
                      <strong>{bid.bidderDisplayName}</strong>
                      <div className="sub">
                        {bid.fishDisplayName} · {formatTime(bid.acceptedAt)}
                      </div>
                    </div>
                  </div>
                  <span className="amount">{formatMoney(bid.amountCents)}</span>
                </div>
              ))}
              {data.latestBids.length === 0 && (
                <p className="muted">Accepted bid history will appear here.</p>
              )}
            </div>
          </article>

          <article className="card c-amber">
            <h2>Recent sales</h2>
            <div className="list">
              {data.recentSales.map((sale) => (
                <div className="row" key={sale.id}>
                  <div className="name-wrap">
                    <SpeciesDot species={sale.species} />
                    <div>
                      <strong>{sale.fishDisplayName}</strong>
                      <div className="sub">
                        {sale.buyerDisplayName} ← {sale.sellerDisplayName}
                      </div>
                    </div>
                  </div>
                  <span className="amount">{formatMoney(sale.amountCents)}</span>
                </div>
              ))}
              {data.recentSales.length === 0 && (
                <p className="muted">Completed auction sales will appear here.</p>
              )}
            </div>
          </article>

          <article className="card c-pink">
            <h2>Inventory needing action</h2>
            <div className="list">
              {data.inventoryNeedingAction.map((fish) => (
                <div className="row" key={fish.id}>
                  <div className="name-wrap">
                    <SpeciesDot species={fish.species} />
                    <div>
                      <strong>{fish.displayName}</strong>
                      <div className="sub">
                        {fish.grade} · {formatKilograms(fish.weightGrams)} ·{" "}
                        {formatMoney(fish.startingPriceCents)}
                      </div>
                    </div>
                  </div>
                  <span className={`tag ${fish.status}`}>{fish.status}</span>
                </div>
              ))}
              {data.inventoryNeedingAction.length === 0 && (
                <p className="muted">No inventory awaiting action.</p>
              )}
            </div>
          </article>
        </section>
      </main>
    </>
  );
}
