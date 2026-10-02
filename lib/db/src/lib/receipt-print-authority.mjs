import fs from "node:fs";
import { createHash } from "node:crypto";

const file = new URL("./receipt-print-authority.sql", import.meta.url);
export const RECEIPT_PRINT_AUTHORITY_SQL_SHA256 = "ee12bcaace99ed9b7c6abe51b80efa3a554c44d36f9bd94f30169761a68b66a5";

/**
 * Explicit, idempotent terminal step of an authorized E5/E11 schema installation.
 * Not a normal API startup initializer. Requires E5 and optional E11 to be
 * installed first; missing/unknown financial guards fail closed in the SQL.
 * The caller owns database identity, authorization, and the transaction.
 */
export async function installReceiptPrintAuthority(client) {
  const text = fs.readFileSync(file, "utf8");
  const sha256 = createHash("sha256").update(text).digest("hex");
  if (sha256 !== RECEIPT_PRINT_AUTHORITY_SQL_SHA256) throw new Error("Receipt print SQL revision drift");
  await client.query(text);
  return { file: "lib/db/src/lib/receipt-print-authority.sql", sha256, onlyFunction: "public.e5_insert_authority()" };
}