// Synthetic, empty PostgreSQL fixture reconstructed from archived catalog metadata.
// No backup, business rows, live database or E1/E10 clone is used.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = process.argv[2];
if (!root?.startsWith("/tmp/e2-release-preparation-")) throw new Error("Isolated export required.");
const archive = JSON.parse(fs.readFileSync(path.join(root,
  "reports/e10-operativo-2026-09-18/operational-run-1789757757707-63932.json"), "utf8"));
const schema = archive.after.schema;
const enums = await import(pathToFileURL(path.join(root, "lib/db/src/schema/enums.ts")));
const quote = value => `"${value.replaceAll('"', '""')}"`;
const out = ["-- EMPTY TEST FIXTURE ONLY. No domain rows or credentials.", "BEGIN;"];
for (const value of Object.values(enums)) {
  if (typeof value === "function" && value.enumName && value.enumValues) {
    out.push(`CREATE TYPE public.${quote(value.enumName)} AS ENUM (${value.enumValues.map(x => `'${x.replaceAll("'", "''")}'`).join(",")});`);
  }
}
for (const row of schema.filter(x => x.kind === "sequence")) {
  const [type, start, min, max, increment, cycle, cache] = row.definition.split(":");
  out.push(`CREATE SEQUENCE public.${quote(row.object_name)} AS ${type} INCREMENT ${increment} MINVALUE ${min} MAXVALUE ${max} START ${start} CACHE ${cache} ${cycle === "t" ? "CYCLE" : "NO CYCLE"};`);
}
for (const table of schema.filter(x => x.kind === "table")) {
  const columns = schema.filter(x => x.kind === "column" && x.object_name === table.object_name).map(row => {
    const [, type, nullable, expression] = row.definition.match(/^(.+?):([tf]):(.*)$/s);
    return `${quote(row.parent_name)} ${type}${nullable === "t" ? " NOT NULL" : ""}${expression ? ` DEFAULT ${expression}` : ""}`;
  });
  out.push(`CREATE TABLE public.${quote(table.object_name)} (${columns.join(",")});`);
}
for (const row of schema.filter(x => x.kind === "function")) out.push(`${row.definition};`);
// Unique keys must exist before referencing FKs.
const constraints = schema.filter(x => x.kind === "constraint");
for (const row of [...constraints.filter(x => !x.definition.startsWith("FOREIGN KEY")),
  ...constraints.filter(x => x.definition.startsWith("FOREIGN KEY"))]) {
  out.push(`ALTER TABLE public.${quote(row.parent_name)} ADD CONSTRAINT ${quote(row.object_name)} ${row.definition};`);
}
const constraintNames = new Set(constraints.map(x => x.object_name));
for (const row of schema.filter(x => x.kind === "index" && !constraintNames.has(x.object_name))) out.push(`${row.definition};`);
for (const row of schema.filter(x => x.kind === "trigger")) out.push(`${row.definition};`);
out.push("COMMIT;");
process.stdout.write(`${out.join("\n")}\n`);