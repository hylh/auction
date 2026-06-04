import { formatMoney } from "../../domain/money";
import { speciesColorToken } from "../../domain/species-color";
import type { AdminData } from "../../server/auction-service";

type BidHistoryCardProps = {
  bids: AdminData["bidHistory"];
};

export function BidHistoryCard({ bids }: BidHistoryCardProps) {
  return (
    <article className="card c-blue">
      <h2>Bid history</h2>
      <div className="list">
        {bids.map((bid) => (
          <div className="row" key={bid.bidId}>
            <div className="name-wrap">
              <span
                className="sdot"
                style={{ background: `var(${speciesColorToken(bid.species)})` }}
                aria-hidden="true"
              />
              <div>
                <strong>{bid.fishDisplayName}</strong>
                <div className="sub">{bid.bidderDisplayName}</div>
              </div>
            </div>
            <span className="amount">{formatMoney(bid.amountCents)}</span>
          </div>
        ))}
        {bids.length === 0 && <p className="muted">No bid history matches the filters.</p>}
      </div>
    </article>
  );
}
