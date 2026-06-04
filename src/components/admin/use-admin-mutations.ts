import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DEMO_USERS } from "../../domain/constants";
import {
  closeAuctionFn,
  createAuctionFn,
  withdrawAuctionFn,
  withdrawFishItemFn,
} from "../../server/functions";

export function useAdminMutations(onMessage: (message: string) => void) {
  const queryClient = useQueryClient();
  const invalidateDashboards = () => {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const onError = (error: Error) => onMessage(error.message);

  const closeMutation = useMutation({
    mutationFn: (auctionId: string) =>
      closeAuctionFn({ data: { auctionId, adminUserId: DEMO_USERS.admin } }),
    onSuccess: () => {
      onMessage("Auction closed and audit records updated.");
      invalidateDashboards();
    },
    onError,
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
      onMessage("Auction started from listed inventory.");
      invalidateDashboards();
    },
    onError,
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
      onMessage("Auction withdrawn and audit records updated.");
      invalidateDashboards();
    },
    onError,
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
      onMessage("Inventory withdrawn and audit records updated.");
      invalidateDashboards();
    },
    onError,
  });

  return { closeMutation, createAuctionMutation, withdrawAuctionMutation, withdrawFishMutation };
}
