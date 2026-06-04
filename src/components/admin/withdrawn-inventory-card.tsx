import type { AdminData } from "../../server/auction-service";
import { FishSummary } from "./fish-summary";

type WithdrawnInventoryCardProps = {
  inventory: AdminData["withdrawnInventory"];
};

export function WithdrawnInventoryCard({ inventory }: WithdrawnInventoryCardProps) {
  return (
    <article className="card">
      <h2>Withdrawn inventory</h2>
      <div className="list">
        {inventory.map((fish) => (
          <div className="row" key={fish.id}>
            <FishSummary fish={fish} detail={fish.catchRegion} />
            <span>{fish.status}</span>
          </div>
        ))}
        {inventory.length === 0 && (
          <p className="muted">No withdrawn inventory matches the filters.</p>
        )}
      </div>
    </article>
  );
}
