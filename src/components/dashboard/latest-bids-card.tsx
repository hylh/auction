import { formatTime } from "../../domain/datetime";
import { formatMoney } from "../../domain/money";
import type { DashboardData } from "../../server/auction-types";
import { avatarColor, avatarInitials } from "./avatar";

export function LatestBidsCard({ bids }: { bids: DashboardData["latestBids"] }) {
  return (
    <article className="card c-blue">
      <h2>
        Latest accepted bids <span className="badge stream">STREAMING</span>
      </h2>
      <div className="list">
        {bids.map((bid) => (
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
        {bids.length === 0 && <p className="muted">Accepted bid history will appear here.</p>}
      </div>
    </article>
  );
}
