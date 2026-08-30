import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const SOURCE_ROOT = dirname(fileURLToPath(import.meta.url));
const MUTATORS = new Set([
  "ajustarRollo",
  "consumirBolsasFifo",
  "moverRollo",
  "recibirTransferencia",
  "revertirMovimiento",
  "salidaMostrador",
  "transferirRolloInmediato",
  "venderRollo",
]);

const EXPECTED = new Set([
  "lib/auditoria-inventario.ts:ajustarRollo",
  "lib/auditoria-inventario.ts:recibirTransferencia",
  "lib/auditoria-inventario.ts:transferirRolloInmediato",
  "lib/pos.ts:consumirBolsasFifo",
  "lib/pos.ts:revertirMovimiento",
  "lib/pos.ts:venderRollo",
  "lib/salidas.ts:moverRollo",
  "lib/salidas.ts:recibirTransferencia",
  "lib/salidas.ts:salidaMostrador",
]);

type LoopCall = {
  key: string;
  functionNode: ts.Node;
  loopNode: ts.IterationStatement;
  sourceFile: ts.SourceFile;
};

function productionFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionFiles(path);
    if (
      !entry.name.endsWith(".ts") ||
      entry.name.endsWith(".test.ts") ||
      entry.name.endsWith(".contract.ts")
    ) {
      return [];
    }
    return [path];
  });
}

function inventoryLoopCalls(): LoopCall[] {
  const calls: LoopCall[] = [];
  for (const path of productionFiles(SOURCE_ROOT)) {
    const sourceFile = ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (
      node: ts.Node,
      loopNode?: ts.IterationStatement,
      functionNode?: ts.Node,
    ) => {
      const currentFunction = ts.isFunctionLike(node) ? node : functionNode;
      const currentLoop = ts.isIterationStatement(node, false) ? node : loopNode;
      if (
        currentLoop &&
        currentFunction &&
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        MUTATORS.has(node.expression.text)
      ) {
        calls.push({
          key: `${relative(SOURCE_ROOT, path)}:${node.expression.text}`,
          functionNode: currentFunction,
          loopNode: currentLoop,
          sourceFile,
        });
      }
      ts.forEachChild(node, (child) =>
        visit(child, currentLoop, currentFunction),
      );
    };
    visit(sourceFile);
  }
  return calls;
}

function hasPrelock(call: LoopCall): boolean {
  let found = false;
  const visit = (node: ts.Node) => {
    if (node.getStart(call.sourceFile) >= call.loopNode.getStart(call.sourceFile)) return;
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "lockInventoryPairs"
    ) {
      found = true;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(call.functionNode, visit);
  return found;
}

test("the manifest contains every production loop that calls the inventory engine", () => {
  const calls = inventoryLoopCalls();
  assert.deepEqual(
    new Set(calls.map((call) => call.key)),
    EXPECTED,
    "Update the manifest and lock contract whenever a new engine loop is added.",
  );
  for (const call of calls) {
    assert.equal(
      hasPrelock(call),
      true,
      `${call.key} enters its loop without a prior lockInventoryPairs call.`,
    );
  }
});

test("the definitive document names every mutator in the loop manifest", () => {
  const documentation = readFileSync(
    new URL("../../../docs/inventory-engine-lock-loops.md", import.meta.url),
    "utf8",
  );
  for (const key of EXPECTED) {
    const mutator = key.slice(key.lastIndexOf(":") + 1);
    assert.match(documentation, new RegExp(`\\\`${mutator}\\\``));
  }
});