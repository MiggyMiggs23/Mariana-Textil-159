#!/usr/bin/env node
// Offline-only coordinator helper. It never connects to PostgreSQL.
import { createHash } from "node:crypto";
import { PLAN_VERSION, REPORT_DIGESTS } from "./contracts.mjs";

const identity = process.argv[2];
const mode = process.argv[3];
if (!/^[0-9a-f]{64}$/.test(identity ?? "")) {
  throw new Error("usage: node 00-plan-digests.mjs <64-hex-identity-sha256> <CLOSED|LIMITED>");
}
if (mode !== "CLOSED" && mode !== "LIMITED") {
  throw new Error("mode must be CLOSED (apply) or LIMITED (revert)");
}
const material =
  `${PLAN_VERSION}|${identity}|${mode}` +
  `|${REPORT_DIGESTS.closedFunctionsSha256}|${REPORT_DIGESTS.triggersSha256}` +
  `|${REPORT_DIGESTS.auditAppendOnlyProsrcSha256}`;
process.stdout.write(`${createHash("sha256").update(material, "utf8").digest("hex")}\n`);