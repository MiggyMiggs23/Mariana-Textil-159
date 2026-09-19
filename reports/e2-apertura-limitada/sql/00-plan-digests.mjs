#!/usr/bin/env node
// Offline-only coordinator helper. It never connects to PostgreSQL.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PLAN_VERSION, REPORT_DIGESTS, EVIDENCE_ARTIFACTS } from "./contracts.mjs";

const identity = process.argv[2];
const mode = process.argv[3];
if (!/^[0-9a-f]{64}$/.test(identity ?? "")) {
  throw new Error("usage: node 00-plan-digests.mjs <64-hex-identity-sha256> <CLOSED|LIMITED>");
}
if (mode !== "CLOSED" && mode !== "LIMITED") {
  throw new Error("mode must be CLOSED (apply) or LIMITED (revert)");
}
for (const artifact of EVIDENCE_ARTIFACTS) {
  if (createHash("sha256").update(readFileSync(new URL(artifact.file, import.meta.url))).digest("hex") !== artifact.sha256) {
    throw new Error(`Offline artifact digest mismatch: ${artifact.file}`);
  }
}
const material =
  `${PLAN_VERSION}|${identity}|${mode}` +
  `|${REPORT_DIGESTS.closedFunctionsSha256}|${REPORT_DIGESTS.triggersSha256}` +
  `|${REPORT_DIGESTS.auditAppendOnlyProsrcSha256}` +
  EVIDENCE_ARTIFACTS.map(({ sha256 }) => `|${sha256}`).join("");
process.stdout.write(`${createHash("sha256").update(material, "utf8").digest("hex")}\n`);