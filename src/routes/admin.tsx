import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminActionsCard } from "../components/admin/admin-actions-card";
import { AdminFilters } from "../components/admin/admin-filters";
import { AdminMessage } from "../components/admin/admin-message";
import { AuctionsCard } from "../components/admin/auctions-card";
import { BidHistoryCard } from "../components/admin/bid-history-card";
import { CompletedSalesCard } from "../components/admin/completed-sales-card";
import { ListedInventoryCard } from "../components/admin/listed-inventory-card";
import { StatusHistoryCard } from "../components/admin/status-history-card";
import { SummaryCards } from "../components/admin/summary-cards";
import { emptyAdminFilters } from "../components/admin/types";
import { useAdminMutations } from "../components/admin/use-admin-mutations";
import { WithdrawnInventoryCard } from "../components/admin/withdrawn-inventory-card";
import { getAdminDataFn } from "../server/functions";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const [filters, setFilters] = useState(emptyAdminFilters);
  const [message, setMessage] = useState<string | null>(null);
  const admin = useQuery({
    queryKey: ["admin", filters],
    queryFn: () => getAdminDataFn({ data: filters }),
    refetchInterval: 5000,
  });
  const mutations = useAdminMutations(setMessage);

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
  const { closeMutation, createAuctionMutation, withdrawAuctionMutation, withdrawFishMutation } =
    mutations;

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

      <AdminFilters
        filters={filters}
        sellers={sellers}
        buyers={buyers}
        onChange={setFilters}
        onClear={() => setFilters(emptyAdminFilters)}
      />
      <AdminMessage message={message} />
      <SummaryCards statistics={data.statistics} />

      <section className="grid" style={{ marginTop: "1rem" }}>
        <ListedInventoryCard
          inventory={listedInventory}
          isStartingAuction={createAuctionMutation.isPending}
          isWithdrawingFish={withdrawFishMutation.isPending}
          onStartAuction={createAuctionMutation.mutate}
          onWithdrawFish={withdrawFishMutation.mutate}
        />
        <AuctionsCard
          auctions={data.auctions}
          isClosing={closeMutation.isPending}
          isWithdrawingAuction={withdrawAuctionMutation.isPending}
          onClose={closeMutation.mutate}
          onWithdrawAuction={withdrawAuctionMutation.mutate}
        />
        <CompletedSalesCard sales={data.completedSales} />
        <BidHistoryCard bids={data.bidHistory} />
        <WithdrawnInventoryCard inventory={data.withdrawnInventory} />
        <StatusHistoryCard changes={data.inventoryStatusChanges} />
        <AdminActionsCard actions={data.adminActions} />
      </section>
    </main>
  );
}
