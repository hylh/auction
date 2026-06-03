import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://auction:auction@localhost:5432/auction";

export const sqlClient = postgres(connectionString, {
  max: 10,
  prepare: false,
});

export const db = drizzle(sqlClient, { schema });
