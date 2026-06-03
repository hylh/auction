import { createServerFn } from "@tanstack/react-start";
import {
  closeAuction,
  createAuction,
  createFishItem,
  getAdminData,
  getAuctionDetail,
  getDashboardData,
  listDemoUsers,
  placeBid,
  withdrawAuction,
  withdrawFishItem,
} from "./auction-service";

export const getDemoUsersFn = createServerFn({ method: "GET" }).handler(() => listDemoUsers());

export const getDashboardFn = createServerFn({ method: "GET" }).handler(() => getDashboardData());

export const getAuctionDetailFn = createServerFn({ method: "GET" })
  .inputValidator((data: { auctionId: string }) => data)
  .handler(({ data }) => getAuctionDetail(data.auctionId));

export const createFishItemFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data)
  .handler(({ data }) => createFishItem(data));

export const createAuctionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data)
  .handler(({ data }) => createAuction(data));

export const placeBidFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data)
  .handler(({ data }) => placeBid(data));

export const closeAuctionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data)
  .handler(({ data }) => closeAuction(data));

export const withdrawAuctionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data)
  .handler(({ data }) => withdrawAuction(data));

export const withdrawFishItemFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data)
  .handler(({ data }) => withdrawFishItem(data));

export const getAdminDataFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => data)
  .handler(({ data }) => getAdminData(data));
