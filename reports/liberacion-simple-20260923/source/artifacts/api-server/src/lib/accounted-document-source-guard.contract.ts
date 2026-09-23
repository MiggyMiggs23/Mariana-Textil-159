import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const SOURCE_ROOTS = ["artifacts", "lib", "scripts"];
const SOURCE_EXTENSION = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|sql)$/;
const EXCLUDED_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  "generated",
  "reports",
  "attached_assets",
  "deps",
  ".git",
]);
const CANONICAL_PRODUCTION_ALLOWLIST = new Set([
  "artifacts/api-server/src/lib/accounted-document.ts",
]);

type ManualPredicateCopy = {
  path: string;
  alias: string;
};

function sourceFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(entry.name)) walk(path);
      } else if (entry.isFile() && SOURCE_EXTENSION.test(entry.name)) {
        files.push(path);
      }
    }
  };
  for (const sourceRoot of SOURCE_ROOTS) {
    const path = join(root, sourceRoot);
    if (existsSync(path)) walk(path);
  }
  return files;
}

function withoutJavaScriptComments(source: string): string {
  let result = "";
  let state: "code" | "single" | "double" | "template" = "code";
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    const next = source[index + 1];
    if (state === "code" && character === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") {
        result += " ";
        index += 1;
      }
      result += source[index] ?? "";
      continue;
    }
    if (state === "code" && character === "/" && next === "*") {
      result += "  ";
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        result += source[index] === "\n" ? "\n" : " ";
        index += 1;
      }
      result += " ";
      continue;
    }
    result += character;
    if ((state === "single" || state === "double" || state === "template") && character === "\\") {
      result += next ?? "";
      index += 1;
      continue;
    }
    if (state === "code" && character === "'") state = "single";
    else if (state === "code" && character === "\"") state = "double";
    else if (state === "code" && character === "`") state = "template";
    else if (state === "single" && character === "'") state = "code";
    else if (state === "double" && character === "\"") state = "code";
    else if (state === "template" && character === "`") state = "code";
  }
  return result;
}

function fullCompoundPredicatePattern(): RegExp {
  const alias = String.raw`(?<alias>[A-Za-z_][A-Za-z0-9_]*)`;
  const field = (name: string) => String.raw`\k<alias>\s*\.\s*${name}`;
  const opening = String.raw`(?:\(\s*)*`;
  const closing = String.raw`(?:\s*\))*`;
  return new RegExp(
    [
      `${alias}\\s*\\.\\s*estado\\s*=\\s*'VENDIDO'\\s+AND\\s*${opening}`,
      `${field("documento_tipo")}\\s*=\\s*'TICKET'\\s+AND\\s*`,
      `${field("cobrado")}(?:\\s*=\\s*true)?${closing}\\s+OR\\s*${opening}`,
      `${field("documento_tipo")}\\s*=\\s*'NOTA'\\s+AND\\s*`,
      `${field("autorizacion_estado")}\\s*=\\s*'AUTORIZADA'${closing}`,
    ].join(""),
    "gi",
  );
}

function manualPredicateCopies(root: string): ManualPredicateCopy[] {
  return sourceFiles(root).flatMap((path) => {
    const relativePath = relative(root, path).split(sep).join("/");
    if (CANONICAL_PRODUCTION_ALLOWLIST.has(relativePath)) return [];
    const source = withoutJavaScriptComments(readFileSync(path, "utf8"));
    return [...source.matchAll(fullCompoundPredicatePattern())].map((match) => ({
      path: relativePath,
      alias: match.groups!.alias,
    }));
  });
}

function sourceGuardExitCode(root: string): number {
  return manualPredicateCopies(root).length === 0 ? 0 : 1;
}

function fullPredicate(alias: string, explicitTrue = false): string {
  const documentType = ["documento", "tipo"].join("_");
  const authorizationState = ["autorizacion", "estado"].join("_");
  const paid = ["cob", "rado"].join("");
  return [
    `${alias}.estado='VENDIDO' AND ((${alias}.${documentType}='TICKET' AND ${alias}.${paid}`,
    `${explicitTrue ? "=true" : ""}) OR (${alias}.${documentType}='NOTA' AND `,
    `${alias}.${authorizationState}='AUTORIZADA'))`,
  ].join("");
}

test("runtime source has no hand-written full accounted-document predicate", () => {
  assert.deepEqual(manualPredicateCopies(WORKSPACE_ROOT), []);
});

test("source guard detects aliases, bare and explicit true, then returns green after removal", () => {
  const root = mkdtempSync(join(tmpdir(), "accounted-document-guard-"));
  const directory = join(root, "artifacts");
  try {
    mkdirSync(directory, { recursive: true });
    for (const [alias, explicitTrue, extension] of [
      ["f", false, ".ts"],
      ["t", true, ".mts"],
      ["other", false, ".cts"],
    ] as const) {
      const file = join(directory, `manual${extension}`);
      writeFileSync(file, fullPredicate(alias, explicitTrue));
      assert.deepEqual(manualPredicateCopies(root), [{ path: `artifacts/manual${extension}`, alias }]);
      assert.equal(sourceGuardExitCode(root), 1);
      rmSync(file);
    }
    const file = join(directory, "manual.jsx");
    writeFileSync(file, [
      "other \n . estado = 'VENDIDO' aNd ((other . documento_tipo = 'TICKET' AND",
      "other . cobrado = true) oR (other . documento_tipo = 'NOTA' AND",
      "other . autorizacion_estado = 'AUTORIZADA'))",
    ].join("\n"));
    assert.deepEqual(manualPredicateCopies(root), [{ path: "artifacts/manual.jsx", alias: "other" }]);
    assert.equal(sourceGuardExitCode(root), 1);
    rmSync(file);
    assert.equal(sourceGuardExitCode(root), 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("source guard leaves partial, false-paid, mixed-alias, and comments alone", () => {
  const root = mkdtempSync(join(tmpdir(), "accounted-document-guard-"));
  try {
    const partial = join(root, "artifacts", "partial.ts");
    const fixture = join(root, "artifacts", "fixtures", "manual.ts");
    mkdirSync(dirname(fixture), { recursive: true });
    writeFileSync(partial, [
      "x.estado='VENDIDO' AND x.documento_tipo='TICKET' AND x.cobrado=false",
      "x.documento_tipo='NOTA' AND x.autorizacion_estado='AUTORIZADA'",
      "x.estado='VENDIDO' AND ((x.documento_tipo='TICKET' AND x.cobrado) OR (y.documento_tipo='NOTA' AND y.autorizacion_estado='AUTORIZADA'))",
      `/* ${fullPredicate("comment")} */`,
    ].join("\n"));
    writeFileSync(fixture, fullPredicate("fixture"));
    assert.deepEqual(manualPredicateCopies(root), [{ path: "artifacts/fixtures/manual.ts", alias: "fixture" }]);
    rmSync(fixture);
    assert.equal(sourceGuardExitCode(root), 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});