import fs from "node:fs";
import net from "node:net";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "../../../../lib/db/node_modules/pg/lib/index.js";
const config = JSON.parse(fs.readFileSync(new URL("./candidate.json", import.meta.url)));
const hash = crypto.createHash("sha256").update(fs.readFileSync(config.apiEntry)).digest("hex");
if (hash !== config.apiSha256) throw Error("Frozen API changed");
const url = new URL(process.env.DATABASE_URL);
if (url.pathname !== "/release_perf_20260926" || !url.hostname.includes("neon.tech") ||
    process.env.TEST_DATABASE_URL || process.env.APPLICATION_DATABASE_URL)
  throw Error("Private bootstrap rejected");
const c = new pg.Client({ connectionString: url.href }); await c.connect();
const identity = (await c.query("SELECT current_database() database")).rows[0]; await c.end();
if (identity.database !== "release_perf_20260926") throw Error("Wrong effective database");
fs.writeFileSync(new URL("./api-process-identity.json", import.meta.url), JSON.stringify({
  ...identity, pid: process.pid, apiSha256: hash, startupMode: "INSPECTION",
  checkedAt: new Date().toISOString(),
}, null, 2));
const listen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  if (typeof args[0] === "number" || /^\d+$/.test(String(args[0]))) {
    if (typeof args[1] !== "string") args.splice(1, 0, "127.0.0.1");
    else if (args[1] !== "127.0.0.1") throw Error("Nonloopback forbidden");
  } else if (args[0]?.port) args[0] = { ...args[0], host: "127.0.0.1" };
  return listen.apply(this, args);
};
await import(pathToFileURL(config.apiEntry).href);