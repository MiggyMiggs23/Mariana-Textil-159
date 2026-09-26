import fs from "node:fs";
import net from "node:net";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "../../../lib/db/node_modules/pg/lib/index.js";

const expected = "scanner_collab_e2e_20260926";
const config = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const hash = crypto.createHash("sha256").update(fs.readFileSync(config.apiEntry)).digest("hex");
if (hash !== config.apiSha256) throw Error("API candidate fingerprint mismatch");
const url = new URL(process.env.DATABASE_URL);
if (url.pathname !== `/${expected}` || process.env.TEST_DATABASE_URL ||
    process.env.APPLICATION_DATABASE_URL) throw Error("Private bootstrap environment rejected");
const pool = new pg.Pool({ connectionString: url.href });
const identity = (await pool.query("SELECT current_database() AS database")).rows[0];
await pool.end();
if (identity.database !== expected) throw Error("Effective private process database mismatch");
fs.writeFileSync(new URL("./api-process-identity.json", import.meta.url), JSON.stringify({
  ...identity, pid: process.pid, apiSha256: hash, verifiedAt: new Date().toISOString(),
  startupMode: "INSPECTION", host: "127.0.0.1", port: Number(process.env.PORT),
}, null, 2));
// The application currently calls app.listen(port) without a host option.
// Narrow that invocation in this disposable process only, without changing candidate bytes.
const listen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  if (typeof args[0] === "number" || /^\d+$/.test(String(args[0]))) {
    if (typeof args[1] !== "string") args.splice(1, 0, "127.0.0.1");
    else if (args[1] !== "127.0.0.1") throw Error("Non-loopback listener forbidden");
  } else if (args[0] && typeof args[0] === "object" && args[0].port) {
    args[0] = { ...args[0], host: "127.0.0.1" };
  }
  return listen.apply(this, args);
};
await import(pathToFileURL(config.apiEntry).href);