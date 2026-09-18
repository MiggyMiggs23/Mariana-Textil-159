#!/bin/bash

# Re-run the tests cleanly for the report

echo "# E10 Fondo Mariana - Negative Proofs & Verifications" > ../workspace/reports/e10-aislado-2026-09-18.md
echo "## Setup and Fixes" >> ../workspace/reports/e10-aislado-2026-09-18.md
echo "1. src/lib/utils.ts restored." >> ../workspace/reports/e10-aislado-2026-09-18.md
echo "2. formatFondoCurrency isolated." >> ../workspace/reports/e10-aislado-2026-09-18.md
echo "3. Vitest purged, contract added to safe.txt." >> ../workspace/reports/e10-aislado-2026-09-18.md

echo "## Mutant 1: Export Auth Role Transition Bypass" >> ../workspace/reports/e10-aislado-2026-09-18.md
sed -i 's/if (!currentUser || currentUser.rol !== "ADMIN") {/\/\/ if (!currentUser || currentUser.rol !== "ADMIN") {/g' artifacts/mariana-textil/src/hooks/fondo.ts
echo '```text' >> ../workspace/reports/e10-aislado-2026-09-18.md
node ../workspace/scripts/src/frontend-test-runner.mjs --app-root=artifacts/mariana-textil --file=src/components/fondo/fondo-summary.contract.test.ts --test-name-pattern="Maneja exportación" >> ../workspace/reports/e10-aislado-2026-09-18.md 2>&1
echo '```' >> ../workspace/reports/e10-aislado-2026-09-18.md
sed -i 's/\/\/ if (!currentUser || currentUser.rol !== "ADMIN") {/if (!currentUser || currentUser.rol !== "ADMIN") {/g' artifacts/mariana-textil/src/hooks/fondo.ts

echo "## Mutant 2: Precision Loss on Large Amounts" >> ../workspace/reports/e10-aislado-2026-09-18.md
cat << 'INNER_EOF' > artifacts/mariana-textil/src/lib/fondo-utils.ts
export function formatFondoCurrency(value: number | string): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}
INNER_EOF
echo '```text' >> ../workspace/reports/e10-aislado-2026-09-18.md
node ../workspace/scripts/src/frontend-test-runner.mjs --app-root=artifacts/mariana-textil --file=src/components/fondo/fondo-summary.contract.test.ts --test-name-pattern="Exact money" >> ../workspace/reports/e10-aislado-2026-09-18.md 2>&1
echo '```' >> ../workspace/reports/e10-aislado-2026-09-18.md

cat << 'INNER_EOF' > artifacts/mariana-textil/src/lib/fondo-utils.ts
export function formatFondoCurrency(value: number | string): string {
  if (typeof value === "string") {
    const isNegative = value.startsWith("-");
    const absValue = isNegative ? value.slice(1) : value;
    const [int, dec = "00"] = absValue.split(".");
    const formattedInt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return \`\${isNegative ? "-" : ""}$\${formattedInt}.\${dec.padEnd(2, "0").slice(0, 2)}\`;
  }
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
INNER_EOF
sed -i 's/\\`/\`/g' artifacts/mariana-textil/src/lib/fondo-utils.ts
sed -i 's/\\$/$/g' artifacts/mariana-textil/src/lib/fondo-utils.ts

echo "## Restored Verification (GREEN)" >> ../workspace/reports/e10-aislado-2026-09-18.md
echo '```text' >> ../workspace/reports/e10-aislado-2026-09-18.md
node ../workspace/scripts/src/frontend-test-runner.mjs --app-root=artifacts/mariana-textil --file=src/components/fondo/fondo-summary.contract.test.ts >> ../workspace/reports/e10-aislado-2026-09-18.md 2>&1
echo '```' >> ../workspace/reports/e10-aislado-2026-09-18.md
