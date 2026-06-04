import { formatMoney } from "../../domain/money";
import { speciesColorToken } from "../../domain/species-color";
import { FishSummary } from "./fish-summary";
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
    <article className="card c-amber">
      <h2>Listed inventory</h2>
      <div className="list">
        {inventory.map((fish) => (
          <div className="row" key={fish.id}>
            <div className="name-wrap">
              <span
                className="sdot"
                style={{ background: `var(${speciesColorToken(fish.species)})` }}
                aria-hidden="true"
              />
              <FishSummary fish={fish} detail={<>start {formatMoney(fish.startingPriceCents)}</>} />
            </div>
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
          </div>
        ))}
        {inventory.length === 0 && (
          <p className="muted">No listed inventory is waiting for an auction.</p>
        )}
      </div>
    </article>
  );
}
