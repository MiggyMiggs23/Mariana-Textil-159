import fs from "node:fs";
const dir = new URL("./measurements/", import.meta.url);
const samples = fs.readdirSync(dir).filter(f => f.endsWith(".json")).map(f => JSON.parse(fs.readFileSync(new URL(f, dir))));
const groups = [];
for (const phase of ["before", "after"]) for (const operation of ["list", "search", "account", "payment", "cut", "credit"]) {
  const rows = samples.filter(r => r.phase === phase && r.operation === operation);
  const valid = rows.filter(r => ["PASS", "SLOW"].includes(r.status)).map(r => r.durationMs).sort((a, b) => a - b);
  groups.push({ phase, operation, attempted: rows.length, succeeded: valid.length,
    blocked: rows.filter(r => !["PASS", "SLOW"].includes(r.status)).map(r => ({ sample: r.sample, status: r.status, error: r.error })),
    medianMs: valid.length ? (valid[Math.floor((valid.length - 1) / 2)] + valid[Math.floor(valid.length / 2)]) / 2 : null,
    maxMs: valid.length ? valid.at(-1) : null,
    allWithinGoal: valid.length === 3 && valid.every(n => n <= (operation === "credit" ? 3000 : 2000)) });
}
fs.writeFileSync(new URL("./summary.json", import.meta.url), JSON.stringify({ at: new Date().toISOString(), groups }, null, 2));
console.log(JSON.stringify(groups));