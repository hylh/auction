import { formatMoney } from "../../domain/money";
import type { AdminData } from "../../server/auction-service";

type SummaryCardsProps = {
  statistics: AdminData["statistics"];
};

export function SummaryCards({ statistics }: SummaryCardsProps) {
  return (
    <section className="grid">
      <article className="card">
        <h2>Total sales</h2>
        <p className="metric">{formatMoney(statistics.totalSalesCents)}</p>
      </article>
      <article className="card">
        <h2>Average bid</h2>
        <p className="metric">{formatMoney(statistics.averageBidCents)}</p>
      </article>
      <article className="card">
        <h2>Popular fish</h2>
        <div className="list">
          {statistics.popularFish.map((fish) => (
            <div className="row" key={fish.species}>
              <strong>{fish.species}</strong>
              <span>
                {fish.bidCount} bids · {fish.totalKilogramsSold.toFixed(1)} kg sold
              </span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
