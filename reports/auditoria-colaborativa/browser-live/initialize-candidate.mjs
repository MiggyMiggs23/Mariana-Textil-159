import fs from "node:fs";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "../../../lib/db/node_modules/pg/lib/index.js";

const config = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const apiSha256 = crypto.createHash("sha256").update(fs.readFileSync(config.apiEntry)).digest("hex");
if (apiSha256 !== config.apiSha256) throw Error("Initializer candidate fingerprint mismatch");
if (process.env.NODE_ENV !== "test" ||
    new URL(process.env.TEST_DATABASE_URL).pathname !== "/scanner_collab_e2e_20260926" ||
    new URL(process.env.DATABASE_URL).pathname !== "/scanner_collab_guard_20260926")
  throw Error("Initializer isolated environment mismatch");
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
try {
  const identity = (await pool.query("SELECT current_database() AS database")).rows[0];
  if (identity.database !== "scanner_collab_e2e_20260926") throw Error("Initializer DB mismatch");
  // Exact approved bundle export; NODE_ENV=test suppresses its automatic startServer.
  // Its own database isolation guard compares two empty/seeded disposable databases.
  const candidate = await import(pathToFileURL(config.apiEntry).href);
  await candidate.ensureStartupSchemas();
  fs.writeFileSync(new URL("./candidate-initialized.json", import.meta.url), JSON.stringify({
    ...identity, apiSha256, initializer: "approved-bundle.ensureStartupSchemas",
    comparatorDatabase: "scanner_collab_guard_20260926",
    completedAt: new Date().toISOString(), serverStarted: false,
  }, null, 2));
  await pool.end();
  process.exit(0);
} catch (error) {
  fs.writeFileSync("/tmp/scanner-e2e-isolated/initializer-error.txt",
    JSON.stringify({ message: error.message, stack: error.stack, cause: error.cause?.message,
      nestedCause: error.cause?.cause?.message }), { mode: 0o600 });
  await pool.end();
  process.exit(1);
}