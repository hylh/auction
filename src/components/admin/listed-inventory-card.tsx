import { formatMoney } from "../../domain/money";
import { InventoryCard } from "./inventory-card";
import type { AdminFish } from "./types";

type ListedInventoryCardProps = {
  inventory: Array<AdminFish>;
  isStartingAuction: boolean;
  isWithdrawingFish: boolean;
  onStartAuction: (fishItemId: string) => void;
  onWithdrawFish: (fishItemId: string) => void;
};

export function ListedInventoryCard({
  inventory,
  isStartingAuction,
  isWithdrawingFish,
  onStartAuction,
  onWithdrawFish,
}: ListedInventoryCardProps) {
  return (
    <InventoryCard
      className="c-amber"
      title="Listed inventory"
      inventory={inventory}
      emptyMessage="No listed inventory is waiting for an auction."
      renderDetail={(fish) => <>start {formatMoney(fish.startingPriceCents)}</>}
      renderAction={(fish) => (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            className="button secondary"
            disabled={isStartingAuction}
            onClick={() => onStartAuction(fish.id)}
            type="button"
          >
            Start auction
          </button>
          <button
            className="button secondary"
            disabled={isWithdrawingFish}
            onClick={() => onWithdrawFish(fish.id)}
            type="button"
          >
            Withdraw
          </button>
        </div>
      )}
    />
  );
}
