import { createFileRoute } from "@tanstack/react-router";
import { getDashboardData, placeBid } from "../server/auction-service";

export const Route = createFileRoute("/api/simulate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          bidCount?: number;
        };
        const dashboard = await getDashboardData();
        const buyers = dashboard.demoUsers.filter((user) => user.role === "buyer");
        const bidCount = body.bidCount ?? 1;
        const results = [];

        for (let index = 0; index < bidCount; index += 1) {
          const auction = dashboard.activeAuctions[index % dashboard.activeAuctions.length];
          const buyer = buyers[index % buyers.length];
          if (!auction || !buyer) break;

          const current = auction.currentHighestBid?.amountCents ?? null;
          const amountCents =
            current === null
              ? auction.fish.startingPriceCents
              : current + auction.minimumIncrementCents;

          results.push(
            await placeBid({
              auctionId: auction.id,
              bidderId: buyer.id,
              amountCents,
              expectedHighestBidCents: current,
            }),
          );
        }

        return Response.json({ results });
      },
    },
  },
});
