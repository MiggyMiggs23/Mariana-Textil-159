import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import net from "node:net";
const root = "/tmp/postrelease-review-20260926";
const report = "reports/postrelease-review-20260926";
const sha = s => crypto.createHash("sha256").update(s).digest("hex");
const journals = [
  ["tarea-1", "browser"], ["tarea-2-historical", "browser-task2"], ["tarea-2-cashv10", "browser-task2-cashv10"],
];
const evidence = [];
for (const [campaign, directory] of journals) {
  const filename = `${root}/postreview_financial_20260926/${directory}/task1-state.json`;
  const raw = fs.readFileSync(filename, "utf8");
  const state = JSON.parse(raw);
  if (state.database !== "postreview_financial_20260926") throw Error("Journal campaign mismatch");
  const operations = Object.entries(state.operations).map(([key, value]) => ({
    operationKeySha256: sha(key),
    ...(key === "task2-collect-16" ? { operation: key, ticketId: 16 } : {}),
    status: ["ACK", "UNCERTAIN", "PENDING", "STARTED", "FAILED", "INTENT"].includes(value.status) ? value.status : "OTHER",
    ...(Number.isInteger(value.http) ? { httpStatus: value.http } : {}),
    ...(Number.isInteger(value.actorId) ? { syntheticActorId: value.actorId } : {}),
    ...(typeof value.startedAt === "string" && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(value.startedAt)
      ? { startedAt: value.startedAt } : {}),
  }));
  evidence.push({ campaign, sourceJournalSha256: sha(raw), operations });
}
const uncertain = evidence.find(x => x.campaign === "tarea-2-historical").operations.find(x => x.ticketId === 16);
if (uncertain?.status !== "UNCERTAIN") throw Error("Expected uncertain ticket16 evidence absent");
const ports = await Promise.all([18327, 18328, 18337, 18338, 18347, 18348].map(port => new Promise(resolve => {
  const s = net.createConnection({ host: "127.0.0.1", port });
  s.setTimeout(1500);
  s.once("connect", () => { s.destroy(); resolve({ port, closed: false }); });
  s.once("error", e => resolve({ port, closed: e.code === "ECONNREFUSED", result: e.code }));
  s.once("timeout", () => { s.destroy(); resolve({ port, closed: false, result: "TIMEOUT" }); });
})));
if (ports.some(p => !p.closed)) throw Error("Private port remains open or unverified");
const reports = ["tarea-1/informe.md", "tarea-2/informe.md", "tarea-3/resultado.md", "tarea-4/informe.md"]
  .map(file => ({ file: `${report}/${file}`, sha256: sha(fs.readFileSync(path.join(report, file))) }));
const archive = {
  at: new Date().toISOString(), journals: evidence, ports, reports,
  uncertainTicketPolicy: "Historical ticket16 remains UNCERTAIN. No replay, resolution, or database mutation performed during cleanup.",
  privacy: "Terminal status/http/time/synthetic actor IDs and hashes only; no request/response bodies, routes, SQL, cookies, credentials, customer data, or raw logs.",
  ownerNightDirectoryExists: fs.existsSync("/tmp/owner-night-20260926"),
};
fs.writeFileSync(`${report}/infra/terminal-evidence-archive.json`, JSON.stringify(archive, null, 2));
console.log(JSON.stringify({
  journals: evidence.map(x => ({ campaign: x.campaign, operations: x.operations.length })),
  uncertainTicket: uncertain, ports, ownerNightDirectoryExists: archive.ownerNightDirectoryExists,
}));