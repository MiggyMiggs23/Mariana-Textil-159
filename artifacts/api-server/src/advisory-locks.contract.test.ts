import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import test from "node:test";
import { ADVISORY_LOCK_NAMESPACES } from "@workspace/db/advisory-locks";

const expectedDomains = [
  "INVENTORY_PAIR",
  "INVENTORY_ENTRY_IDEMPOTENCY",
  "INVENTORY_AUDIT_SITE",
  "POS_TICKET_IDEMPOTENCY",
  "CASH_SESSION_SITE",
  "CUSTOMER_CREDIT",
  "SUPPLIER_LEDGER",
  "OUTBOUND_DRAFT",
  "OUTBOUND_IDEMPOTENCY",
  "PRODUCT_CATALOG",
  "PRODUCT_PRICING",
  "ADMIN_RECOVERY",
  "SCHEMA_ROLE",
  "SCHEMA_CAMIONETAS",
  "SCHEMA_CHOFERES",
  "SCHEMA_VIAJES",
  "SCHEMA_INVENTORY_AUDIT",
  "SCHEMA_PISOS",
  "SCRIPT_PRODUCT_NORMALIZATION",
  "SCRIPT_BAG_PRODUCTS",
  "SCRIPT_OPERATIONAL_CLEANUP",
] as const;

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(path) : [path];
    }),
  );
  return files.flat().filter((path) =>
    [".ts", ".mts", ".js", ".mjs"].includes(extname(path)),
  );
}

test("advisory lock namespaces are complete, int32, and unique", () => {
  assert.deepEqual(
    Object.keys(ADVISORY_LOCK_NAMESPACES).sort(),
    [...expectedDomains].sort(),
  );
  const values = Object.values(ADVISORY_LOCK_NAMESPACES);
  assert.equal(new Set(values).size, values.length);
  for (const value of values) {
    assert.ok(Number.isInteger(value));
    assert.ok(value >= -2147483648 && value <= 2147483647);
  }
});

test("all API and database advisory SQL is owned by the shared helper", async () => {
  const workspace = resolve(import.meta.dirname, "../../..");
  const helper = resolve(workspace, "lib/db/src/lib/advisory-locks.mjs");
  const roots = [
    resolve(workspace, "artifacts/api-server/src"),
    resolve(workspace, "lib/db/src"),
  ];
  const offenders: string[] = [];
  for (const file of (await Promise.all(roots.map(sourceFiles))).flat()) {
    if (file === helper || file.endsWith(".test.ts")) continue;
    const source = await readFile(file, "utf8");
    if (/pg_(?:try_)?advisory_|pg_advisory_unlock/.test(source)) {
      offenders.push(file.replace(`${workspace}/`, ""));
    }
  }
  assert.deepEqual(offenders, []);
});