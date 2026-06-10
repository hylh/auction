import type { DashboardData } from "../../server/auction-types";
import { HistoryCard } from "../history-card";
import { SpeciesDot } from "./species-dot";

export function RecentSalesCard({ sales }: { sales: DashboardData["recentSales"] }) {
  return (
    <HistoryCard
      className="c-amber"
      title="Recent sales"
      items={sales}
      emptyMessage="Completed auction sales will appear here."
      getKey={(sale) => sale.id}
      renderLeading={(sale) => <SpeciesDot species={sale.species} />}
      renderTitle={(sale) => sale.fishDisplayName}
      renderSubtitle={(sale) => `${sale.buyerDisplayName} ← ${sale.sellerDisplayName}`}
      getAmountCents={(sale) => sale.amountCents}
    />
  );
}
