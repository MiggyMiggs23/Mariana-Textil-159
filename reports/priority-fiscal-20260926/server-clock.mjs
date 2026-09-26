import fs from "node:fs";
const database = new URL(process.env.DATABASE_URL).pathname;
if (database !== "/priority_fiscal_20260926") throw Error("Clock only allowed in isolated fiscal database");
const config = JSON.parse(fs.readFileSync("/tmp/priority-fiscal-20260926/clock.json"));
if (config.clockISO !== "2026-10-02T18:00:00.000Z") throw Error("Clock reset/change forbidden");
const watermark = "/tmp/priority-fiscal-20260926/clock-started.json";
if (fs.existsSync(watermark)) {
  if (JSON.parse(fs.readFileSync(watermark)).epoch !== Date.parse(config.clockISO)) throw Error("Backward clock reset forbidden");
} else fs.writeFileSync(watermark, JSON.stringify({ epoch: Date.parse(config.clockISO), actualStart: new Date().toISOString() }), { mode: 0o600 });
await import("./browser-clock.js");
if (new Date().toISOString() !== config.clockISO) throw Error("Clock installation failed");