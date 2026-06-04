import type { AdminData } from "../../server/auction-service";

export type AdminFilterState = {
  status: string;
  species: string;
  sellerId: string;
  buyerId: string;
  fromDate: string;
  toDate: string;
};

export const emptyAdminFilters: AdminFilterState = {
  status: "",
  species: "",
  sellerId: "",
  buyerId: "",
  fromDate: "",
  toDate: "",
};

export type AdminUser = AdminData["demoUsers"][number];
export type AdminAuction = AdminData["auctions"][number];
export type AdminFish = AdminData["inventoryNeedingAction"][number];
