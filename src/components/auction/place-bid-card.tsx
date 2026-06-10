import type { RefObject } from "react";
import { formatMoney } from "../../domain/money";
import type { AuctionDetail } from "../../server/auction-service";

type PlaceBidCardProps = {
  detail: AuctionDetail;
  buyers: Array<{ id: string; displayName: string }>;
  bidderId: string;
  onBidderChange: (bidderId: string) => void;
  amountMajor: string;
  onAmountChange: (amount: string) => void;
  nextMinimum: number;
  isPending: boolean;
  message: string | null;
  connectionMessage: string | null;
  onSubmit: () => void;
  bidBarRef: RefObject<HTMLElement | null>;
};

export function PlaceBidCard({
  detail,
  buyers,
  bidderId,
  onBidderChange,
  amountMajor,
  onAmountChange,
  nextMinimum,
  isPending,
  message,
  connectionMessage,
  onSubmit,
  bidBarRef,
}: PlaceBidCardProps) {
  return (
    <article className="card c-teal bid-bar-card" ref={bidBarRef}>
      <h2>Place bid</h2>
      <p className="metric">
        {detail.currentHighestBid
          ? formatMoney(detail.currentHighestBid.amountCents)
          : formatMoney(detail.fish.startingPriceCents)}
      </p>
      <p className="muted">
        Next valid bid: {formatMoney(nextMinimum)} · increment{" "}
        {formatMoney(detail.minimumIncrementCents)}
      </p>

      <PlaceBidForm
        buyers={buyers}
        bidderId={bidderId}
        onBidderChange={onBidderChange}
        currency={detail.fish.currency}
        amountMajor={amountMajor}
        onAmountChange={onAmountChange}
        nextMinimum={nextMinimum}
        isPending={isPending}
        onSubmit={onSubmit}
      />

      <BidStatusMessages message={message} connectionMessage={connectionMessage} />
    </article>
  );
}

function PlaceBidForm({
  buyers,
  bidderId,
  onBidderChange,
  currency,
  amountMajor,
  onAmountChange,
  nextMinimum,
  isPending,
  onSubmit,
}: {
  buyers: PlaceBidCardProps["buyers"];
  bidderId: string;
  onBidderChange: (bidderId: string) => void;
  currency: string;
  amountMajor: string;
  onAmountChange: (amount: string) => void;
  nextMinimum: number;
  isPending: boolean;
  onSubmit: () => void;
}) {
  return (
    <form
      className="form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="field">
        <span>Demo buyer</span>
        <select value={bidderId} onChange={(event) => onBidderChange(event.currentTarget.value)}>
          {buyers.map((buyer) => (
            <option key={buyer.id} value={buyer.id}>
              {buyer.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Bid amount ({currency})</span>
        <input
          inputMode="numeric"
          value={amountMajor}
          onChange={(event) => onAmountChange(event.currentTarget.value)}
          placeholder={String(nextMinimum / 100)}
        />
      </label>
      <button className="button" disabled={isPending} type="submit">
        {isPending ? "Submitting..." : "Submit bid"}
      </button>
    </form>
  );
}

function BidStatusMessages({
  message,
  connectionMessage,
}: {
  message: string | null;
  connectionMessage: string | null;
}) {
  return (
    <>
      {message && <p className={message.includes("accepted") ? "success" : "error"}>{message}</p>}
      {connectionMessage && <p className="muted">{connectionMessage}</p>}
    </>
  );
}
