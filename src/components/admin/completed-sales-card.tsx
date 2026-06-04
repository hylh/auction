import { formatMoney } from "../../domain/money";
import type { AdminData } from "../../server/auction-service";

type CompletedSalesCardProps = {
  sales: AdminData["completedSales"];
};

export function CompletedSalesCard({ sales }: CompletedSalesCardProps) {
  return (
    <article className="card">
      <h2>Completed sales</h2>
      <div className="list">
        {sales.map((sale) => (
          <div className="row" key={sale.id}>
            <div>
              <strong>{sale.fishDisplayName}</strong>
              <div className="muted">
                {sale.buyerDisplayName} · {new Date(sale.completedAt).toLocaleDateString()}
              </div>
            </div>
            <span>{formatMoney(sale.amountCents)}</span>
          </div>
        ))}
        {sales.length === 0 && <p className="muted">No completed sales match the filters.</p>}
      </div>
    </article>
  );
}
