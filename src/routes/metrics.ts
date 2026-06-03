import { createFileRoute } from "@tanstack/react-router";
import { measureRequest, metricsText } from "../domain/metrics";

export const Route = createFileRoute("/metrics")({
  server: {
    handlers: {
      GET: async () =>
        measureRequest(
          async () =>
            new Response(metricsText(), {
              headers: {
                "Content-Type": "text/plain; version=0.0.4",
              },
            }),
        ),
    },
  },
});
