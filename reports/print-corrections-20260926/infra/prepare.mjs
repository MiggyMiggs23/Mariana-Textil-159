// Generate the same full-copy/isolation harness with explicit current release identities.
import fs from "node:fs";
const report = "reports/print-corrections-20260926/infra";
let setup = fs.readFileSync("reports/postrelease-review-20260926/infra/setup.mjs", "utf8")
  .replaceAll("/tmp/postrelease-review-20260926", "/tmp/print-corrections-20260926")
  .replaceAll("reports/postrelease-review-20260926/infra", report)
  .replaceAll("br-calm-wildflower-ax5d3p8e", "br-quiet-queen-axtwmlv9")
  .replaceAll("dist-owner-login-v9-20260926", "dist-owner-cash-v10-20260926")
  .replaceAll("3aa7706416313c4bf5bbb0cfce03ee7f2151d0c36d6008579346b022d9c5a9ea", "dafb028d684e3de6f04232908c5fa5054c9bb1757d5dc4bb7f40eb2a29585df1")
  .replaceAll("reports/priority-20260926/credit-presentation/candidate.json", "reports/postrelease-review-20260926/tarea-4/final-candidate.json")
  .replaceAll("af0541fd749f49ffe917aaae51ba6adc8c1f99f1dd5ad1de419a57a2a0c578b5", "92f6123346e12d569a724840102d9fff57f915086a8f0e48d4c5b7ccf774bf72")
  .replace('[["financial", 18327, 18328], ["permissions", 18337, 18338], ["review", 18347, 18348]]', '[["runtime", 18427, 18428]]')
  .replaceAll("`postreview_${kind}_20260926`", '"print_corrections_20260926"')
  .replaceAll("Isolated postreview", "Isolated print correction")
  .replaceAll("e2e.postreview.", "e2e.printcorrection.")
  .replaceAll("THREE_COMPLETE_COPIES_READY_NOT_STARTED", "ONE_PRINT_COPY_READY_NOT_STARTED")
  .replaceAll("THREE_COPIES_READY_NOT_STARTED; native workers create scoped actors using seed admin", "PRINT_COPY_READY_NOT_STARTED")
  .replaceAll("Financial then concurrency sequentially on financial copy; permissions isolated; review isolated", "Native print browser tests only; no financial SQL fixtures")
  .replaceAll("Only seed ADMIN/TODAS inserted; worker must create cashier/auditor users and scoped assignments through native API/UI", "Only seed ADMIN/TODAS inserted; browser creates any test transactions through native UI/API")
  .replace(`.replaceAll('["login","perf"]', '["financial","permissions","review"]')`, `.replaceAll('["login","perf"]', '["runtime"]')`)
  .replace('.replaceAll("release_${kind}_20260926", "postreview_${kind}_20260926")', '.replaceAll("release_${kind}_20260926", "print_corrections_20260926")');
fs.writeFileSync(`${report}/setup.mjs`, setup);