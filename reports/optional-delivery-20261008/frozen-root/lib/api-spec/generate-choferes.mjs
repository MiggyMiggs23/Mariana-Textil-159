/**
 * Stage canonical Orval output and publish only Chofer declarations.
 * Run: node lib/api-spec/generate-choferes.mjs
 * No builds, migrations, or unrelated contract changes.
 */
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const staging = await mkdtemp(path.join(tmpdir(), "choferes-codegen-"));
const root = path.resolve(import.meta.dirname, "../..");
const specDirectory = path.join(root, "lib/api-spec");

function section(source, start, end) {
  const first = source.indexOf(start);
  const last = source.lastIndexOf(end);
  if (first < 0 || last < 0) throw new Error(`Missing generated section: ${start}`);
  return source.slice(first, last);
}

try {
  // Orval loads/bundles the canonical TypeScript config itself.
  const stagedConfig = path.join(staging, "orval.config.ts");
  await writeFile(stagedConfig, `
    import config from ${JSON.stringify(path.join(specDirectory, "orval.config.ts"))};
    export default Object.fromEntries(Object.entries(config).map(([name, project]) => [
      name, {
        ...project,
        input: { ...project.input, target: ${JSON.stringify(path.join(specDirectory, "openapi.yaml"))} },
        output: {
          ...project.output,
          workspace: ${JSON.stringify(staging)} + "/" + name,
          target: ${JSON.stringify(staging)} + "/" + name + "/generated/api.ts",
          ...(name === "zod" ? { schemas: {
            path: ${JSON.stringify(staging)} + "/zod/generated/types", type: "typescript"
          } } : {})
        }
      }
    ]));
  `);
  execFileSync("pnpm", ["exec", "orval", "--config", stagedConfig], {
    cwd: specDirectory, stdio: "inherit",
  });
  const outputs = new Map();
  for (const [project, library, file, start, end] of [
    ["zod", "api-zod", "api.ts", "/**\n * @summary Lista el catálogo histórico de choferes", "/**\n * @summary Lista equipos dentro del alcance de consulta"],
    ["zod", "api-zod", "api.ts", "/**\n * @summary Catálogo activo de transporte para crear viajes", "export const ListViajesEligibleDocumentsQueryParams"],
    ["api-client-react", "api-client-react", "api.schemas.ts", "export interface Chofer", "export type Role ="],
  ]) {
    const destination = path.join(root, "lib", library, "src/generated", file);
    const current = outputs.get(destination) ?? await readFile(destination, "utf8");
    const generated = await readFile(path.join(staging, project, "generated", file), "utf8");
    outputs.set(destination, current.replace(
      section(current, start, end), () => section(generated, start, end),
    ));
  }
  for (const file of ["chofer.ts", "choferInput.ts", "choferUpdate.ts", "choferTelefono.ts"]) {
    outputs.set(path.join(root, "lib/api-zod/src/generated/types", file),
      await readFile(path.join(staging, "zod/generated/types", file), "utf8"));
  }
  const barrel = path.join(root, "lib/api-zod/src/generated/types/index.ts");
  const currentBarrel = await readFile(barrel, "utf8");
  const exportLine = "export * from './choferTelefono';";
  outputs.set(barrel, currentBarrel.includes(exportLine) ? currentBarrel :
    currentBarrel.replace("export * from './choferUpdate';", `export * from './choferUpdate';\n${exportLine}`));
  // Resolve every section before publishing anything (fail closed on drift).
  for (const [destination, content] of outputs) await writeFile(destination, content);
} finally {
  await rm(staging, { recursive: true, force: true });
}