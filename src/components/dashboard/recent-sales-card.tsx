import { formatMoney } from "../../domain/money";
import type { DashboardData } from "../../server/auction-types";
import { SpeciesDot } from "./species-dot";

export function RecentSalesCard({ sales }: { sales: DashboardData["recentSales"] }) {
  return (
    <article className="card c-amber">
      <h2>Recent sales</h2>
      <div className="list">
        {sales.map((sale) => (
          <div className="row" key={sale.id}>
            <div className="name-wrap">
              <SpeciesDot species={sale.species} />
              <div>
                <strong>{sale.fishDisplayName}</strong>
                <div className="sub">
                  {sale.buyerDisplayName} ← {sale.sellerDisplayName}
                </div>
              </div>
            </div>
            <span className="amount">{formatMoney(sale.amountCents)}</span>
          </div>
        ))}
        {sales.length === 0 && <p className="muted">Completed auction sales will appear here.</p>}
      </div>
    </article>
  );
}
