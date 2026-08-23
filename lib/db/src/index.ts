import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
export { ensureTicketIvaSchema } from "./lib/ticket-iva-schema";

const { Pool } = pg;

const isAutomatedTestProcess = process.argv.some((argument) =>
  /\.test\.[cm]?[jt]s$/.test(argument),
);

if (isAutomatedTestProcess) {
  const testConnectionString = process.env.TEST_DATABASE_URL;
  if (!testConnectionString) {
    throw new Error(
      "TEST_DATABASE_URL must be set before running database tests. Refusing to use the application database.",
    );
  }
  if (testConnectionString === process.env.DATABASE_URL) {
    throw new Error(
      "TEST_DATABASE_URL must point to a database different from DATABASE_URL.",
    );
  }
  process.env.DATABASE_URL = testConnectionString;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL must be set.");
}

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });

export * from "./schema";
