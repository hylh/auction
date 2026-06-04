import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://auction:auction@localhost:5432/auction";
const defaultApplicationName = "auction-app";

const databaseConnection = withApplicationName(connectionString, defaultApplicationName);
export const databaseApplicationName = databaseConnection.applicationName;

type SqlClient = ReturnType<typeof postgres>;

const globalForDb = globalThis as typeof globalThis & {
  __auctionSqlClient?: SqlClient;
  __auctionDbConnectionString?: string;
};

function createSqlClient() {
  return postgres(databaseConnection.connectionString, {
    max: 10,
    idle_timeout: 30,
    prepare: false,
  });
}

if (
  !globalForDb.__auctionSqlClient ||
  globalForDb.__auctionDbConnectionString !== databaseConnection.connectionString
) {
  globalForDb.__auctionSqlClient = createSqlClient();
  globalForDb.__auctionDbConnectionString = databaseConnection.connectionString;
}

export const sqlClient = globalForDb.__auctionSqlClient;

export const db = drizzle(sqlClient, { schema });

function withApplicationName(connectionStringValue: string, applicationName: string) {
  try {
    const url = new URL(connectionStringValue);
    const configuredApplicationName = url.searchParams.get("application_name");
    if (configuredApplicationName) {
      return {
        applicationName: configuredApplicationName,
        connectionString: url.toString(),
      };
    }

    url.searchParams.set("application_name", applicationName);
    return {
      applicationName,
      connectionString: url.toString(),
    };
  } catch {
    return {
      applicationName,
      connectionString: connectionStringValue,
    };
  }
}
