import type { ReactNode } from "react";
import { speciesColorToken } from "../../domain/species-color";
import { FishSummary } from "./fish-summary";
import type { AdminFish } from "./types";

type InventoryCardProps = {
  className?: string;
  title: string;
  inventory: Array<AdminFish>;
  emptyMessage: string;
  renderDetail: (fish: AdminFish) => ReactNode;
  renderAction: (fish: AdminFish) => ReactNode;
};

export function InventoryCard({
  className,
  title,
  inventory,
  emptyMessage,
  renderDetail,
  renderAction,
}: InventoryCardProps) {
  return (
    <article className={["card", className].filter(Boolean).join(" ")}>
      <h2>{title}</h2>
      <div className="list">
        {inventory.map((fish) => (
          <div className="row" key={fish.id}>
            <div className="name-wrap">
              <span
                className="sdot"
                style={{ background: `var(${speciesColorToken(fish.species)})` }}
                aria-hidden="true"
              />
              <FishSummary fish={fish} detail={renderDetail(fish)} />
            </div>
            {renderAction(fish)}
          </div>
        ))}
        {inventory.length === 0 && <p className="muted">{emptyMessage}</p>}
      </div>
    </article>
  );
}
