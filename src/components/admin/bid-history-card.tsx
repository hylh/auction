import type { AdminData } from "../../server/auction-service";
import { SpeciesDot } from "../dashboard/species-dot";
import { HistoryCard } from "../history-card";

type BidHistoryCardProps = {
  bids: AdminData["bidHistory"];
};

export function BidHistoryCard({ bids }: BidHistoryCardProps) {
  return (
    <HistoryCard
      className="c-blue"
      title="Bid history"
      items={bids}
      emptyMessage="No bid history matches the filters."
      getKey={(bid) => bid.bidId}
      renderLeading={(bid) => <SpeciesDot species={bid.species} />}
      renderTitle={(bid) => bid.fishDisplayName}
      renderSubtitle={(bid) => bid.bidderDisplayName}
      getAmountCents={(bid) => bid.amountCents}
    />
  );
}
