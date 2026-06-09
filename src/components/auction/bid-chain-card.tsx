import { formatTime } from "../../domain/datetime";
import { formatMoney } from "../../domain/money";
import { speciesColorToken } from "../../domain/species-color";
import type { AuctionDetail } from "../../server/auction-service";

type BidChainCardProps = {
  detail: AuctionDetail;
};

export function BidChainCard({ detail }: BidChainCardProps) {
  return (
    <article className="card c-blue">
      <h2>
        Live bid chain{" "}
        {detail.status === "active" && <span className="badge stream">STREAMING</span>}
      </h2>
      <div className="list bid-chain-list">
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
                <div className="sub">{formatTime(bid.acceptedAt)}</div>
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
  );
}
