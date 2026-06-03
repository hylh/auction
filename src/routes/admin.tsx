import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DEMO_USERS, FISH_SPECIES } from "../domain/constants";
import { formatMoney } from "../domain/money";
import { formatKilograms } from "../domain/weight";
import {
  closeAuctionFn,
  createAuctionFn,
  getAdminDataFn,
  withdrawAuctionFn,
  withdrawFishItemFn,
} from "../server/functions";

type AdminFilterState = {
  status: string;
  species: string;
  sellerId: string;
  buyerId: string;
  fromDate: string;
  toDate: string;
};

const STATUS_FILTERS = [
  "draft",
  "listed",
  "in_auction",
  "sold",
  "withdrawn",
  "scheduled",
  "active",
  "closed",
  "unsold",
];

const emptyFilters: AdminFilterState = {
  status: "",
  species: "",
  sellerId: "",
  buyerId: "",
  fromDate: "",
  toDate: "",
};

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<AdminFilterState>(emptyFilters);
  const [message, setMessage] = useState<string | null>(null);
  const admin = useQuery({
    queryKey: ["admin", filters],
    queryFn: () => getAdminDataFn({ data: filters }),
    refetchInterval: 5000,
  });
  const closeMutation = useMutation({
    mutationFn: (auctionId: string) =>
      closeAuctionFn({
        data: {
          auctionId,
          adminUserId: DEMO_USERS.admin,
        },
      }),
    onSuccess: () => {
      setMessage("Auction closed and audit records updated.");
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => setMessage(error.message),
  });
  const createAuctionMutation = useMutation({
    mutationFn: (fishItemId: string) => {
      const startsAt = new Date();
      const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

      return createAuctionFn({
        data: {
          fishItemId,
          adminUserId: DEMO_USERS.admin,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          minimumIncrementCents: 10_000,
        },
      });
    },
    onSuccess: () => {
      setMessage("Auction started from listed inventory.");
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => setMessage(error.message),
  });
  const withdrawAuctionMutation = useMutation({
    mutationFn: (auctionId: string) =>
      withdrawAuctionFn({
        data: {
          auctionId,
          adminUserId: DEMO_USERS.admin,
          reason: "Admin withdrew auction from dashboard",
        },
      }),
    onSuccess: () => {
      setMessage("Auction withdrawn and audit records updated.");
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => setMessage(error.message),
  });
  const withdrawFishMutation = useMutation({
    mutationFn: (fishItemId: string) =>
      withdrawFishItemFn({
        data: {
          fishItemId,
          adminUserId: DEMO_USERS.admin,
          reason: "Admin withdrew listed inventory from dashboard",
        },
      }),
    onSuccess: () => {
      setMessage("Inventory withdrawn and audit records updated.");
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => setMessage(error.message),
  });

  if (admin.isLoading) {
    return <main className="page">Loading admin dashboard...</main>;
  }

  if (admin.isError || !admin.data) {
    return (
      <main className="page">
        <div className="error">Could not load admin data.</div>
      </main>
    );
  }

  const data = admin.data;
  const sellers = data.demoUsers.filter((user) => user.role === "seller");
  const buyers = data.demoUsers.filter((user) => user.role === "buyer");
  const listedInventory = data.inventoryNeedingAction.filter((fish) => fish.status === "listed");

  return (
    <main className="page">
      <section className="hero">
        <span className="pill">Audit and statistics</span>
        <h1>Admin auction history.</h1>
        <p>
          Completed sales, bid history, open auctions, and live aggregate statistics are computed
          from PostgreSQL records.
        </p>
      </section>

      <section className="card" style={{ marginBottom: "1rem" }}>
        <h2>Filters</h2>
        <form className="form">
          <div className="grid">
            <label className="field">
              <span>Status</span>
              <select
                value={filters.status}
                onChange={(event) => setFilters({ ...filters, status: event.currentTarget.value })}
              >
                <option value="">All statuses</option>
                {STATUS_FILTERS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Species</span>
              <select
                value={filters.species}
                onChange={(event) => setFilters({ ...filters, species: event.currentTarget.value })}
              >
                <option value="">All species</option>
                {FISH_SPECIES.map((species) => (
                  <option key={species} value={species}>
                    {species}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Seller</span>
              <select
                value={filters.sellerId}
                onChange={(event) =>
                  setFilters({ ...filters, sellerId: event.currentTarget.value })
                }
              >
                <option value="">All sellers</option>
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Buyer</span>
              <select
                value={filters.buyerId}
                onChange={(event) => setFilters({ ...filters, buyerId: event.currentTarget.value })}
              >
                <option value="">All buyers</option>
                {buyers.map((buyer) => (
                  <option key={buyer.id} value={buyer.id}>
                    {buyer.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>From</span>
              <input
                type="date"
                value={filters.fromDate}
                onChange={(event) =>
                  setFilters({ ...filters, fromDate: event.currentTarget.value })
                }
              />
            </label>
            <label className="field">
              <span>To</span>
              <input
                type="date"
                value={filters.toDate}
                onChange={(event) => setFilters({ ...filters, toDate: event.currentTarget.value })}
              />
            </label>
          </div>
          <button
            className="button secondary"
            onClick={() => setFilters(emptyFilters)}
            type="button"
          >
            Clear filters
          </button>
        </form>
      </section>

      {message && (
        <p
          className={
            message.includes("updated") || message.includes("started") ? "success" : "error"
          }
        >
          {message}
        </p>
      )}

      <section className="grid">
        <article className="card">
          <h2>Total sales</h2>
          <p className="metric">{formatMoney(data.statistics.totalSalesCents)}</p>
        </article>
        <article className="card">
          <h2>Average bid</h2>
          <p className="metric">{formatMoney(data.statistics.averageBidCents)}</p>
        </article>
        <article className="card">
          <h2>Popular fish</h2>
          <div className="list">
            {data.statistics.popularFish.map((fish) => (
              <div className="row" key={fish.species}>
                <strong>{fish.species}</strong>
                <span>
                  {fish.bidCount} bids · {fish.totalKilogramsSold.toFixed(1)} kg sold
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid" style={{ marginTop: "1rem" }}>
        <article className="card">
          <h2>Listed inventory</h2>
          <div className="list">
            {listedInventory.map((fish) => (
              <div className="row" key={fish.id}>
                <div>
                  <strong>{fish.displayName}</strong>
                  <div className="muted">
                    {fish.species} · {formatKilograms(fish.weightGrams)} · start{" "}
                    {formatMoney(fish.startingPriceCents)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    className="button secondary"
                    disabled={createAuctionMutation.isPending}
                    onClick={() => createAuctionMutation.mutate(fish.id)}
                    type="button"
                  >
                    Start auction
                  </button>
                  <button
                    className="button secondary"
                    disabled={withdrawFishMutation.isPending}
                    onClick={() => withdrawFishMutation.mutate(fish.id)}
                    type="button"
                  >
                    Withdraw
                  </button>
                </div>
              </div>
            ))}
            {listedInventory.length === 0 && (
              <p className="muted">No listed inventory is waiting for an auction.</p>
            )}
          </div>
        </article>

        <article className="card">
          <h2>Auctions</h2>
          <div className="list">
            {data.auctions.map((auction) => (
              <div className="row" key={auction.id}>
                <div>
                  <strong>{auction.fish.displayName}</strong>
                  <div className="muted">
                    {auction.status} · highest{" "}
                    {auction.currentHighestBid
                      ? formatMoney(auction.currentHighestBid.amountCents)
                      : "no bids"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {auction.status === "active" && (
                    <button
                      className="button secondary"
                      disabled={closeMutation.isPending}
                      onClick={() => closeMutation.mutate(auction.id)}
                      type="button"
                    >
                      Close
                    </button>
                  )}
                  {(auction.status === "active" || auction.status === "scheduled") && (
                    <button
                      className="button secondary"
                      disabled={withdrawAuctionMutation.isPending}
                      onClick={() => withdrawAuctionMutation.mutate(auction.id)}
                      type="button"
                    >
                      Withdraw
                    </button>
                  )}
                </div>
              </div>
            ))}
            {data.auctions.length === 0 && <p className="muted">No auctions match the filters.</p>}
          </div>
        </article>

        <article className="card">
          <h2>Completed sales</h2>
          <div className="list">
            {data.completedSales.map((sale) => (
              <div className="row" key={sale.id}>
                <div>
                  <strong>{sale.fishDisplayName}</strong>
                  <div className="muted">
                    {sale.buyerDisplayName} · {new Date(sale.completedAt).toLocaleDateString()}
                  </div>
                </div>
                <span>{formatMoney(sale.amountCents)}</span>
              </div>
            ))}
            {data.completedSales.length === 0 && (
              <p className="muted">No completed sales match the filters.</p>
            )}
          </div>
        </article>

        <article className="card">
          <h2>Bid history</h2>
          <div className="list">
            {data.bidHistory.map((bid) => (
              <div className="row" key={bid.bidId}>
                <div>
                  <strong>{bid.fishDisplayName}</strong>
                  <div className="muted">{bid.bidderDisplayName}</div>
                </div>
                <span>{formatMoney(bid.amountCents)}</span>
              </div>
            ))}
            {data.bidHistory.length === 0 && (
              <p className="muted">No bid history matches the filters.</p>
            )}
          </div>
        </article>

        <article className="card">
          <h2>Withdrawn inventory</h2>
          <div className="list">
            {data.withdrawnInventory.map((fish) => (
              <div className="row" key={fish.id}>
                <div>
                  <strong>{fish.displayName}</strong>
                  <div className="muted">
                    {fish.species} · {formatKilograms(fish.weightGrams)} · {fish.catchRegion}
                  </div>
                </div>
                <span>{fish.status}</span>
              </div>
            ))}
            {data.withdrawnInventory.length === 0 && (
              <p className="muted">No withdrawn inventory matches the filters.</p>
            )}
          </div>
        </article>

        <article className="card">
          <h2>Status history</h2>
          <div className="list">
            {data.inventoryStatusChanges.map((change) => (
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
            {data.inventoryStatusChanges.length === 0 && (
              <p className="muted">No status history matches the filters.</p>
            )}
          </div>
        </article>

        <article className="card">
          <h2>Admin actions</h2>
          <div className="list">
            {data.adminActions.map((action) => (
              <div className="row" key={action.id}>
                <div>
                  <strong>{action.action.replaceAll("_", " ")}</strong>
                  <div className="muted">
                    {action.adminDisplayName} · {action.fishDisplayName ?? action.auctionId} ·{" "}
                    {action.reason}
                  </div>
                </div>
                <span>{new Date(action.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
            {data.adminActions.length === 0 && (
              <p className="muted">No admin actions match the filters.</p>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
