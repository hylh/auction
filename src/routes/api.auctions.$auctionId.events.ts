import { createFileRoute } from "@tanstack/react-router";
import {
  shouldDeliverAuctionEventToSubscriber,
  subscribeToAuction,
  type AuctionEvent,
} from "../domain/events";

export const Route = createFileRoute("/api/auctions/$auctionId/events")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const userId = url.searchParams.get("userId");
        const encoder = new TextEncoder();

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            let closed = false;
            const send = (eventName: string, data: unknown) => {
              if (closed) return;
              controller.enqueue(
                encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`),
              );
            };

            const unsubscribe = subscribeToAuction(params.auctionId, (event: AuctionEvent) => {
              if (!shouldDeliverAuctionEventToSubscriber(event, userId)) {
                return;
              }
              send(event.type, event);
            });

            send("connected", {
              auctionId: params.auctionId,
              connectedAt: new Date().toISOString(),
            });

            request.signal.addEventListener(
              "abort",
              () => {
                closed = true;
                unsubscribe();
                controller.close();
              },
              { once: true },
            );
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
