import type { AdminData } from "../../server/auction-service";
import { InventoryCard } from "./inventory-card";

type WithdrawnInventoryCardProps = {
  inventory: AdminData["withdrawnInventory"];
};

export function WithdrawnInventoryCard({ inventory }: WithdrawnInventoryCardProps) {
  return (
    <InventoryCard
      title="Withdrawn inventory"
      inventory={inventory}
      emptyMessage="No withdrawn inventory matches the filters."
      renderDetail={(fish) => fish.catchRegion}
      renderAction={(fish) => <span className={`tag ${fish.status}`}>{fish.status}</span>}
    />
  );
}
