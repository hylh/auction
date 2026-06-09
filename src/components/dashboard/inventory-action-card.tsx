import { formatMoney } from "../../domain/money";
import { formatKilograms } from "../../domain/weight";
import type { DashboardData } from "../../server/auction-types";
import { SpeciesDot } from "./species-dot";

export function InventoryActionCard({
  inventory,
}: {
  inventory: DashboardData["inventoryNeedingAction"];
}) {
  return (
    <article className="card c-pink">
      <h2>Inventory needing action</h2>
      <div className="list">
        {inventory.map((fish) => (
          <div className="row" key={fish.id}>
            <div className="name-wrap">
              <SpeciesDot species={fish.species} />
              <div>
                <strong>{fish.displayName}</strong>
                <div className="sub">
                  {fish.grade} · {formatKilograms(fish.weightGrams)} ·{" "}
                  {formatMoney(fish.startingPriceCents)}
                </div>
              </div>
            </div>
            <span className={`tag ${fish.status}`}>{fish.status}</span>
          </div>
        ))}
        {inventory.length === 0 && <p className="muted">No inventory awaiting action.</p>}
      </div>
    </article>
  );
}
