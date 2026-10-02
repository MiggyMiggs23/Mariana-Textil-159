import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { installReceiptPrintAuthority, RECEIPT_PRINT_AUTHORITY_SQL_SHA256 } from "./receipt-print-authority.mjs";
test("explicit financial bootstrap installs only the pinned terminal receipt guard", async () => {
  const calls = [];
  const fakeClient = { async query(sql) { calls.push(sql); } };
  const first = await installReceiptPrintAuthority(fakeClient);
  const second = await installReceiptPrintAuthority(fakeClient);
  assert.deepEqual(first, second); assert.equal(calls.length, 2);
  assert.equal(createHash("sha256").update(calls[0]).digest("hex"), RECEIPT_PRINT_AUTHORITY_SQL_SHA256);
  assert.equal(calls[0], calls[1]);
  assert.match(calls[0], /installed branch drift/);
  assert.match(calls[0], /IF position\('RECEIPT_MATRIX_PRINT_V1' in original\)>0 THEN RETURN/);
  assert.doesNotMatch(calls[0], /DISABLE TRIGGER|session_replication_role|UPDATE public\.|DELETE FROM|DROP /);
  const startup = fs.readFileSync(new URL("../../../../artifacts/api-server/src/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(startup, /e5_insert_authority|receipt-print-authority|01-preparado\.sql/);
});