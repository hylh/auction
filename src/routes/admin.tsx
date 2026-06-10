import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminActionsCard } from "../components/admin/admin-actions-card";
import { AdminFilters } from "../components/admin/admin-filters";
import { AdminMessage } from "../components/admin/admin-message";
import { AdminTabs, type AdminTab, type AdminTabId } from "../components/admin/admin-tabs";
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

type AdminData = Awaited<ReturnType<typeof getAdminDataFn>>;
type AdminMutations = ReturnType<typeof useAdminMutations>;

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const [filters, setFilters] = useState(emptyAdminFilters);
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTabId>("live");
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

  const tabs = buildAdminTabs(data, listedInventory.length);

  return (
    <main className="page">
      <section className="hero">
        <div>
          <span className="pill">Audit and statistics</span>
          <h1>Admin auction history.</h1>
          <p>
            Completed sales, bid history, open auctions, and live aggregate statistics are computed
            from PostgreSQL records.
          </p>
        </div>
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

      <AdminTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <section
        className="grid"
        style={{ marginTop: "1rem" }}
        role="tabpanel"
        id={`admin-panel-${activeTab}`}
        aria-labelledby={`admin-tab-${activeTab}`}
      >
        <AdminTabPanel
          activeTab={activeTab}
          data={data}
          listedInventory={listedInventory}
          mutations={mutations}
        />
      </section>
    </main>
  );
}

function buildAdminTabs(data: AdminData, listedInventoryCount: number): Array<AdminTab> {
  return [
    {
      id: "live",
      label: "Inventory & auctions",
      count: listedInventoryCount + data.auctions.length,
    },
    {
      id: "sales",
      label: "Sales & bids",
      count: data.completedSales.length + data.bidHistory.length,
    },
    {
      id: "inventory-history",
      label: "Inventory history",
      count: data.withdrawnInventory.length + data.inventoryStatusChanges.length,
    },
    { id: "actions", label: "Admin actions", count: data.adminActions.length },
  ];
}

function AdminTabPanel({
  activeTab,
  data,
  listedInventory,
  mutations,
}: {
  activeTab: AdminTabId;
  data: AdminData;
  listedInventory: AdminData["inventoryNeedingAction"];
  mutations: AdminMutations;
}) {
  if (activeTab === "live") {
    return <LiveAdminTab data={data} listedInventory={listedInventory} mutations={mutations} />;
  }
  if (activeTab === "sales") {
    return <SalesAdminTab data={data} />;
  }
  if (activeTab === "inventory-history") {
    return <InventoryHistoryAdminTab data={data} />;
  }
  return <AdminActionsCard actions={data.adminActions} />;
}

function LiveAdminTab({
  data,
  listedInventory,
  mutations,
}: {
  data: AdminData;
  listedInventory: AdminData["inventoryNeedingAction"];
  mutations: AdminMutations;
}) {
  const { closeMutation, createAuctionMutation, withdrawAuctionMutation, withdrawFishMutation } =
    mutations;

  return (
    <>
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
    </>
  );
}

function SalesAdminTab({ data }: { data: AdminData }) {
  return (
    <>
      <CompletedSalesCard sales={data.completedSales} />
      <BidHistoryCard bids={data.bidHistory} />
    </>
  );
}

function InventoryHistoryAdminTab({ data }: { data: AdminData }) {
  return (
    <>
      <WithdrawnInventoryCard inventory={data.withdrawnInventory} />
      <StatusHistoryCard changes={data.inventoryStatusChanges} />
    </>
  );
}
