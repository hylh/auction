import { formatDate } from "../../domain/datetime";
import type { AdminData } from "../../server/auction-service";
import { SpeciesDot } from "../dashboard/species-dot";
import { HistoryCard } from "../history-card";

type CompletedSalesCardProps = {
  sales: AdminData["completedSales"];
};

export function CompletedSalesCard({ sales }: CompletedSalesCardProps) {
  return (
    <HistoryCard
      className="c-teal"
      title="Completed sales"
      items={sales}
      emptyMessage="No completed sales match the filters."
      getKey={(sale) => sale.id}
      renderLeading={(sale) => <SpeciesDot species={sale.species} />}
      renderTitle={(sale) => sale.fishDisplayName}
      renderSubtitle={(sale) => `${sale.buyerDisplayName} · ${formatDate(sale.completedAt)}`}
      getAmountCents={(sale) => sale.amountCents}
    />
  );
}
