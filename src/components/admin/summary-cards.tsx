import { formatMoney, formatMoneyWhole } from "../../domain/money";
import { speciesColorToken } from "../../domain/species-color";
import type { AdminData } from "../../server/auction-service";

type SummaryCardsProps = {
  statistics: AdminData["statistics"];
};

export function SummaryCards({ statistics }: SummaryCardsProps) {
  return (
    <section className="stat-strip" style={{ marginBottom: "1rem" }}>
      <div className="stat teal">
        <div className="label">Total sales</div>
        <div className="value">{formatMoneyWhole(statistics.totalSalesCents)}</div>
        <div className="delta">all time</div>
      </div>
      <div className="stat blue">
        <div className="label">Average bid</div>
        <div className="value">{formatMoneyWhole(statistics.averageBidCents)}</div>
        <div className="delta">accepted bids</div>
      </div>
      <div className="stat violet">
        <div className="label">Popular species</div>
        <div className="value">{statistics.popularFish[0]?.species ?? "—"}</div>
        <div className="delta">
          {statistics.popularFish[0] ? `${statistics.popularFish[0].bidCount} bids` : "no data"}
        </div>
      </div>
      <article className="card c-pink" style={{ gridColumn: "span 2" }}>
        <h2>Popular fish by bids</h2>
        <div className="list">
          {statistics.popularFish.map((fish) => (
            <div className="row" key={fish.species}>
              <div className="name-wrap">
                <span
                  className="sdot"
                  style={{ background: `var(${speciesColorToken(fish.species)})` }}
                  aria-hidden="true"
                />
                <strong>{fish.species}</strong>
              </div>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                {fish.bidCount} bids · {fish.totalKilogramsSold.toFixed(1)} kg ·{" "}
                {formatMoney(fish.totalSalesCents)}
              </span>
            </div>
          ))}
          {statistics.popularFish.length === 0 && <p className="muted">No sales data yet.</p>}
        </div>
      </article>
    </section>
  );
}
