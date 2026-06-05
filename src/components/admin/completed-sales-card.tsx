import { formatDate } from "../../domain/datetime";
import { formatMoney } from "../../domain/money";
import { speciesColorToken } from "../../domain/species-color";
import type { AdminData } from "../../server/auction-service";

type CompletedSalesCardProps = {
  sales: AdminData["completedSales"];
};

export function CompletedSalesCard({ sales }: CompletedSalesCardProps) {
  return (
    <article className="card c-teal">
      <h2>Completed sales</h2>
      <div className="list">
        {sales.map((sale) => (
          <div className="row" key={sale.id}>
            <div className="name-wrap">
              <span
                className="sdot"
                style={{ background: `var(${speciesColorToken(sale.species)})` }}
                aria-hidden="true"
              />
              <div>
                <strong>{sale.fishDisplayName}</strong>
                <div className="sub">
                  {sale.buyerDisplayName} · {formatDate(sale.completedAt)}
                </div>
              </div>
            </div>
            <span className="amount">{formatMoney(sale.amountCents)}</span>
          </div>
        ))}
        {sales.length === 0 && <p className="muted">No completed sales match the filters.</p>}
      </div>
    </article>
  );
}
