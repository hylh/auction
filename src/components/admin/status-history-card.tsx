import type { AdminData } from "../../server/auction-service";

type StatusHistoryCardProps = {
  changes: AdminData["inventoryStatusChanges"];
};

export function StatusHistoryCard({ changes }: StatusHistoryCardProps) {
  return (
    <article className="card">
      <h2>Status history</h2>
      <div className="list">
        {changes.map((change) => (
          <div className="row" key={change.id}>
            <div>
              <strong>{change.fishDisplayName}</strong>
              <div className="muted">
                {change.fromStatus ?? "created"} -&gt; {change.toStatus} · {change.reason}
              </div>
            </div>
            <span>{new Date(change.createdAt).toLocaleDateString()}</span>
          </div>
        ))}
        {changes.length === 0 && <p className="muted">No status history matches the filters.</p>}
      </div>
    </article>
  );
}
