// Execute with node. Reuses the prior workload verbatim, changing isolation paths only.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
const root = process.cwd();
const source = root + "/reports/tanda-g-ampliada/tarea-4/load.mjs";
const original = fs.readFileSync(source, "utf8");
const privateRoot = root + "/.local/tanda-h";
if (!fs.existsSync(privateRoot + "/worker-databases.json")) {
  throw Error("MAIN must provide isolated performance worker-databases.json and start supervised COPY first");
}
const text = original
  .replaceAll("tanda-g-ampliada", "tanda-h")
  .replaceAll("tarea-4", "tarea-2")
  .replaceAll("tanda_ga_performance", "tanda_h_performance")
  .replaceAll("ga_performance", "h_performance")
  .replaceAll("55442", "55444")
  .replace("($2::int[])[1+(g-1)%7]", "($2::int[])[1+(g-1)%3]")
  .replace('"../../../scripts/node_modules/pg/lib/index.js"', JSON.stringify(root + "/scripts/node_modules/pg/lib/index.js"));
const generated = privateRoot + "/task2-load-generated.mjs";
fs.writeFileSync(generated, text, { mode: 0o600 });
fs.writeFileSync(root + "/reports/tanda-h/tarea-2/workload-source.json", JSON.stringify({
  source: "reports/tanda-g-ampliada/tarea-4/load.mjs",
  sha256: createHash("sha256").update(original).digest("hex"),
  tickets: 54750,
  explanation: "365 × 50 × 3 = 54,750, not 54,150; original hypothetical assumptions unchanged",
  changes: "Private/report paths, database identity, actor, port, absolute pg module import; available-roll distribution uses the three fresh stores rather than seven prior sites",
}, null, 2));
await import(pathToFileURL(generated).href);