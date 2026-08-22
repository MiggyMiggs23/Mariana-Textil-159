/**
 * Post-codegen script: rewrites lib/api-zod/src/index.ts to avoid
 * TypeScript TS2308 collision between Orval's Zod path-param schemas
 * (in generated/api.ts) and the query-param TS interfaces (in generated/types/).
 *
 * Orval always appends `export * from './generated/types'` to src/index.ts,
 * causing 4 name collisions:
 *   - ListComprasProveedorParams
 *   - EstadoCuentaProveedorParams
 *   - EstadisticasProveedorParams
 *   - ExportarProveedorXlsxParams
 *
 * This script replaces the barrel with a selective re-export that skips those
 * four and re-exports them under a `QueryParams` suffix alias instead.
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..", "..");
const apiZodSrc = resolve(root, "lib", "api-zod", "src");
const generatedTypes = resolve(apiZodSrc, "generated", "types");
const indexPath = resolve(apiZodSrc, "index.ts");

// Names that collide (Zod path-param schemas in api.ts vs TS query-param types in types/)
const COLLIDING = new Set([
  "listComprasProveedorParams",
  "estadoCuentaProveedorParams",
  "estadisticasProveedorParams",
  "exportarProveedorXlsxParams",
]);

// Build selective exports from generated/types/
const typeFiles = readdirSync(generatedTypes)
  .filter((f) => f.endsWith(".ts") && f !== "index.ts")
  .map((f) => f.replace(/\.ts$/, ""));

const nonColliding = typeFiles.filter((f) => !COLLIDING.has(f));
const colliding = typeFiles.filter((f) => COLLIDING.has(f));

// Map file name → the TS type/const names it exports (for aliasing)
const COLLIDING_TYPE_NAMES = {
  listComprasProveedorParams: "ListComprasProveedorParams",
  estadoCuentaProveedorParams: "EstadoCuentaProveedorParams",
  estadisticasProveedorParams: "EstadisticasProveedorParams",
  exportarProveedorXlsxParams: "ExportarProveedorXlsxParams",
};

const lines = [
  `// Auto-patched by fix-api-zod-barrel.mjs after orval codegen.`,
  `// Exports Zod schemas from api.ts first (path-param Params schemas live here).`,
  `// Then exports TS types from types/ selectively, skipping the four query-param`,
  `// Params types that share names with Zod schemas (TS2308 collision).`,
  `// Those four are re-exported under a QueryParams suffix alias.`,
  `export * from "./generated/api";`,
  ``,
  `// ── Non-colliding types ───────────────────────────────────────────────────`,
  ...nonColliding.map((f) => `export * from "./generated/types/${f}";`),
  ``,
  `// ── Colliding Params types re-exported under QueryParams alias ───────────`,
  `// (server uses the Zod versions from api.ts; these TS interfaces are for`,
  `//  the frontend – api-client-react generates its own hooks independently)`,
  ...colliding.map((f) => {
    const name = COLLIDING_TYPE_NAMES[f];
    return `export type { ${name} as ${name.replace("Params", "QueryParams")} } from "./generated/types/${f}";`;
  }),
];

writeFileSync(indexPath, lines.join("\n") + "\n");
console.log(`[fix-api-zod-barrel] Rewrote ${indexPath} (${nonColliding.length} direct + ${colliding.length} aliased exports)`);
