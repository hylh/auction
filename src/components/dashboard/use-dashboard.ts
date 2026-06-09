import { useQuery } from "@tanstack/react-query";
import { getDashboardFn } from "../../server/functions";

// Owns the live dashboard query, including the 5s refetch interval that keeps
// active auctions, latest bids, and aggregate stats current.
export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboardFn(),
    refetchInterval: 5000,
  });
}
