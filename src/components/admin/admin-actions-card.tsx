import type { AdminData } from "../../server/auction-service";

type AdminActionsCardProps = {
  actions: AdminData["adminActions"];
};

export function AdminActionsCard({ actions }: AdminActionsCardProps) {
  return (
    <article className="card c-pink">
      <h2>Admin actions</h2>
      <div className="list">
        {actions.map((action) => (
          <div className="row" key={action.id}>
            <div>
              <strong>{action.action.replaceAll("_", " ")}</strong>
              <div className="sub">
                {action.adminDisplayName} · {action.fishDisplayName ?? action.auctionId} ·{" "}
                {action.reason}
              </div>
            </div>
            <span className="muted" style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>
              {new Date(action.createdAt).toLocaleDateString()}
            </span>
          </div>
        ))}
        {actions.length === 0 && <p className="muted">No admin actions match the filters.</p>}
      </div>
    </article>
  );
}
