import { createServerFn } from "@tanstack/react-start";
import { ZodError } from "zod";
import { incrementMetric, measureRequest } from "../domain/metrics";
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

export const getDemoUsersFn = createServerFn({ method: "GET" }).handler(() =>
  observeServerFn(() => listDemoUsers()),
);

export const getDashboardFn = createServerFn({ method: "GET" }).handler(() =>
  observeServerFn(() => getDashboardData()),
);

export const getAuctionDetailFn = createServerFn({ method: "GET" })
  .inputValidator((data: { auctionId: string }) => data)
  .handler(({ data }) => observeServerFn(() => getAuctionDetail(data.auctionId)));

export const createFishItemFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data)
  .handler(({ data }) => observeServerFn(() => createFishItem(data)));

export const createAuctionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data)
  .handler(({ data }) => observeServerFn(() => createAuction(data)));

export const placeBidFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data)
  .handler(({ data }) => observeServerFn(() => placeBid(data)));

export const closeAuctionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data)
  .handler(({ data }) => observeServerFn(() => closeAuction(data), { closeFailure: true }));

export const withdrawAuctionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data)
  .handler(({ data }) => observeServerFn(() => withdrawAuction(data)));

export const withdrawFishItemFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data)
  .handler(({ data }) => observeServerFn(() => withdrawFishItem(data)));

export const getAdminDataFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => data)
  .handler(({ data }) => observeServerFn(() => getAdminData(data)));

async function observeServerFn<T>(
  operation: () => Promise<T>,
  options: { closeFailure?: boolean } = {},
) {
  try {
    return await measureRequest(operation);
  } catch (error) {
    if (error instanceof ZodError) {
      incrementMetric("validationFailures");
    }
    if (options.closeFailure) {
      incrementMetric("closeFailures");
    }
    throw error;
  }
}
