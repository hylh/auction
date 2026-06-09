import { Link } from "@tanstack/react-router";
import { formatMoney } from "../../domain/money";
import { formatKilograms } from "../../domain/weight";
import type { DashboardData } from "../../server/auction-types";
import { SpeciesDot } from "./species-dot";

export function ActiveAuctionsCard({
  auctions,
}: {
  auctions: DashboardData["activeAuctions"];
}) {
  return (
    <article className="card c-teal">
      <h2>
        Active auctions{" "}
        {auctions.length > 0 && <span className="badge live">{auctions.length} LIVE</span>}
      </h2>
      <div className="list">
        {auctions.map((auction) => (
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
        {auctions.length === 0 && <p className="muted">No active auctions right now.</p>}
      </div>
    </article>
  );
}
