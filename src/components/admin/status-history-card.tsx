import { formatDate } from "../../domain/datetime";
import { speciesColorToken } from "../../domain/species-color";
import type { AdminData } from "../../server/auction-service";

type StatusHistoryCardProps = {
  changes: AdminData["inventoryStatusChanges"];
};

export function StatusHistoryCard({ changes }: StatusHistoryCardProps) {
  return (
    <article className="card c-blue">
      <h2>Status history</h2>
      <div className="list">
        {changes.map((change) => (
          <div className="row" key={change.id}>
            <div className="name-wrap">
              <span
                className="sdot"
                style={{ background: `var(${speciesColorToken(change.species)})` }}
                aria-hidden="true"
              />
              <div>
                <strong>{change.fishDisplayName}</strong>
                <div className="sub">
                  {change.fromStatus ?? "created"} → {change.toStatus} · {change.reason}
                </div>
              </div>
            </div>
            <span className="muted" style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>
              {formatDate(change.createdAt)}
            </span>
          </div>
        ))}
        {changes.length === 0 && <p className="muted">No status history matches the filters.</p>}
      </div>
    </article>
  );
}
