import { createFileRoute } from "@tanstack/react-router";
import { ZodError } from "zod";
import { incrementMetric, measureRequest } from "../domain/metrics";
import { simulatorInputSchema } from "../domain/validation";
import { runSimulation } from "../server/simulator-service";

export const Route = createFileRoute("/api/simulate")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        measureRequest(async () => {
          incrementMetric("simulatorRequests");

          try {
            const body = await request.json().catch(() => ({}));
            const input = simulatorInputSchema.parse(body);
            return Response.json(await runSimulation(input));
          } catch (error) {
            if (error instanceof ZodError) {
              incrementMetric("validationFailures");
              return Response.json(
                {
                  error: "Invalid simulator input",
                  issues: error.issues,
                },
                { status: 400 },
              );
            }
            throw error;
          }
        }),
    },
  },
});
