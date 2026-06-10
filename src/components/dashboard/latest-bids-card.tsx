import { formatTime } from "../../domain/datetime";
import type { DashboardData } from "../../server/auction-types";
import { HistoryCard } from "../history-card";
import { avatarColor, avatarInitials } from "./avatar";

export function LatestBidsCard({ bids }: { bids: DashboardData["latestBids"] }) {
  return (
    <HistoryCard
      className="c-blue"
      title={
        <>
          Latest accepted bids <span className="badge stream">STREAMING</span>
        </>
      }
      items={bids}
      emptyMessage="Accepted bid history will appear here."
      getKey={(bid) => bid.bidId}
      renderLeading={(bid) => (
        <span
          className="avatar"
          style={{ background: avatarColor(bid.bidderDisplayName) }}
          aria-hidden="true"
        >
          {avatarInitials(bid.bidderDisplayName)}
        </span>
      )}
      renderTitle={(bid) => bid.bidderDisplayName}
      renderSubtitle={(bid) => `${bid.fishDisplayName} · ${formatTime(bid.acceptedAt)}`}
      getAmountCents={(bid) => bid.amountCents}
    />
  );
}
