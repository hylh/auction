import { createServerFn } from "@tanstack/react-start";
import {
  closeAuction,
  createFishItem,
  getAdminData,
  getAuctionDetail,
  getDashboardData,
  listDemoUsers,
  placeBid,
} from "./auction-service";

export const getDemoUsersFn = createServerFn({ method: "GET" }).handler(() => listDemoUsers());

export const getDashboardFn = createServerFn({ method: "GET" }).handler(() => getDashboardData());

export const getAuctionDetailFn = createServerFn({ method: "GET" })
  .inputValidator((data: { auctionId: string }) => data)
  .handler(({ data }) => getAuctionDetail(data.auctionId));

export const createFishItemFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data)
  .handler(({ data }) => createFishItem(data));

export const placeBidFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data)
  .handler(({ data }) => placeBid(data));

export const closeAuctionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data)
  .handler(({ data }) => closeAuction(data));

export const getAdminDataFn = createServerFn({ method: "GET" }).handler(() => getAdminData());
