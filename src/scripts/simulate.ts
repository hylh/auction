export {};

const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:3000";

const bidCount = Number(getArg("--bid-count") ?? getArg("--bids") ?? process.env.BID_COUNT ?? "3");
const intervalMs = Number(getArg("--interval-ms") ?? process.env.BID_INTERVAL_MS ?? "1000");

async function main() {
  for (let index = 0; index < bidCount; index += 1) {
    const response = await fetch(`${appOrigin}/api/simulate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bidCount: 1 }),
    });

    if (!response.ok) {
      throw new Error(`Simulator request failed with ${response.status}`);
    }

    console.info(await response.text());
    if (index < bidCount - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}

function getArg(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
