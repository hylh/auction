import { formatMoney } from "../../domain/money";
import { speciesColorToken } from "../../domain/species-color";
import type { AdminAuction } from "./types";

type AuctionsCardProps = {
  auctions: Array<AdminAuction>;
  isClosing: boolean;
  isWithdrawingAuction: boolean;
  onClose: (auctionId: string) => void;
  onWithdrawAuction: (auctionId: string) => void;
};

export function AuctionsCard({
  auctions,
  isClosing,
  isWithdrawingAuction,
  onClose,
  onWithdrawAuction,
}: AuctionsCardProps) {
  return (
    <article className="card c-amber">
      <h2>Auctions</h2>
      <div className="list">
        {auctions.map((auction) => (
          <div className="row" key={auction.id}>
            <div className="name-wrap">
              <span
                className="sdot"
                style={{ background: `var(${speciesColorToken(auction.fish.species)})` }}
                aria-hidden="true"
              />
              <div>
                <strong>{auction.fish.displayName}</strong>
                <div className="sub">
                  highest{" "}
                  {auction.currentHighestBid
                    ? formatMoney(auction.currentHighestBid.amountCents)
                    : "no bids"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <span className={`tag ${auction.status}`}>{auction.status}</span>
              <AuctionActions
                auction={auction}
                isClosing={isClosing}
                isWithdrawingAuction={isWithdrawingAuction}
                onClose={onClose}
                onWithdrawAuction={onWithdrawAuction}
              />
            </div>
          </div>
        ))}
        {auctions.length === 0 && <p className="muted">No auctions match the filters.</p>}
      </div>
    </article>
  );
}

type AuctionActionsProps = Omit<AuctionsCardProps, "auctions"> & {
  auction: AdminAuction;
};

function AuctionActions({
  auction,
  isClosing,
  isWithdrawingAuction,
  onClose,
  onWithdrawAuction,
}: AuctionActionsProps) {
  return (
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
      {auction.status === "active" && (
        <button
          className="button secondary"
          disabled={isClosing}
          onClick={() => onClose(auction.id)}
          type="button"
        >
          Close
        </button>
      )}
      {(auction.status === "active" || auction.status === "scheduled") && (
        <button
          className="button secondary"
          disabled={isWithdrawingAuction}
          onClick={() => onWithdrawAuction(auction.id)}
          type="button"
        >
          Withdraw
        </button>
      )}
    </div>
  );
}
