import { formatMoney } from "../../domain/money";
import type { AdminData } from "../../server/auction-service";

type BidHistoryCardProps = {
  bids: AdminData["bidHistory"];
};

export function BidHistoryCard({ bids }: BidHistoryCardProps) {
  return (
    <article className="card">
      <h2>Bid history</h2>
      <div className="list">
        {bids.map((bid) => (
          <div className="row" key={bid.bidId}>
            <div>
              <strong>{bid.fishDisplayName}</strong>
              <div className="muted">{bid.bidderDisplayName}</div>
            </div>
            <span>{formatMoney(bid.amountCents)}</span>
          </div>
        ))}
        {bids.length === 0 && <p className="muted">No bid history matches the filters.</p>}
      </div>
    </article>
  );
}
