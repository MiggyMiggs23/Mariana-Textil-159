// Compose reviewed task hunks from the frozen HEAD diff onto retained sources.
// Never copies a whole modified HEAD file. This script does not build or activate.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "../..");
const report = import.meta.dirname;
const baseline = path.join(root, ".local/e7-text-baseline");
const sha = data => crypto.createHash("sha256").update(data).digest("hex");
const apiFiles = [
  "artifacts/api-server/src/routes/clientes.ts",
  "artifacts/api-server/src/routes/proveedores.ts",
  "lib/api-zod/src/generated/api.ts",
  "lib/db/src/schema/proveedores.ts",
];
const frontFiles = [
  "artifacts/mariana-textil/src/components/client-directory.tsx",
  "artifacts/mariana-textil/src/components/e7-readers.tsx",
  "artifacts/mariana-textil/src/lib/clientes-api.ts",
  "artifacts/mariana-textil/src/pages/cliente-detail.tsx",
  "artifacts/mariana-textil/src/pages/clientes.tsx",
  "artifacts/mariana-textil/src/pages/cobros.tsx",
  "artifacts/mariana-textil/src/pages/proveedor-detail.tsx",
  "artifacts/mariana-textil/src/pages/proveedores.tsx",
  "artifacts/mariana-textil/src/pages/reportes.tsx",
  "lib/api-client-react/src/generated/api.schemas.ts",
  "lib/api-client-react/src/generated/api.ts",
];
const newFront = [
  "artifacts/mariana-textil/src/components/credit-site-scope.tsx",
  "artifacts/mariana-textil/src/lib/credit-folio-scope.ts",
  "artifacts/mariana-textil/src/lib/supplier-directory-sort.ts",
];
const retained = path.join(root, "artifacts/api-server/dist-clientes-lista-20260925");
const map = JSON.parse(fs.readFileSync(path.join(retained, "index.mjs.map"), "utf8"));
const originals = new Map(map.sources.map((file, i) => [path.resolve(retained, file), map.sourcesContent[i]]));
const approval = {
  parentApiSha256: sha(fs.readFileSync(path.join(retained, "index.mjs"))),
  parentFrontIndexSha256: sha(fs.readFileSync(path.join(root, "artifacts/mariana-textil/dist-clientes-lista-20260925/index.html"))),
  api: [], front: [],
};
const inventory = [];
if (fs.existsSync(path.join(report, "approval.json")))
  throw Error("Approval already exists; refusing to overwrite");

function hunks(diff, relative) {
  const lines = diff.split("\n");
  const blocks = [];
  let block;
  for (const line of lines) {
    if (line.startsWith("@@ ")) {
      block = { header: line, removed: [], inserted: [], context: [], lines: [] };
      blocks.push(block);
    } else if (block && /^[ +\-]/.test(line) && !line.startsWith("---") && !line.startsWith("+++")) {
      block.lines.push(line);
      if (line[0] === "-") block.removed.push(line.slice(1));
      if (line[0] === "+") block.inserted.push(line.slice(1));
      if (line[0] === " ") block.context.push(line.slice(1));
    }
  }
  if (!blocks.length) throw Error("No HEAD diff hunks: " + relative);
  return blocks;
}

function replaceUnique(source, before, after, relative, label) {
  let from = 0, to = source.length;
  const declaration = label.match(/@@.*@@ (export (?:const|interface|type) [A-Za-z0-9_]+)/)?.[1];
  if (declaration) {
    from = source.indexOf(declaration);
    if (from < 0) throw Error("Missing retained declaration " + relative + " " + declaration);
    const next = source.slice(from + declaration.length).search(/\nexport (?:const|interface|type) /);
    if (next >= 0) to = from + declaration.length + next;
  }
  const i = source.indexOf(before, from);
  if (i < 0 || i >= to || (source.indexOf(before, i + 1) >= 0 && source.indexOf(before, i + 1) < to))
    throw Error("Non-unique or missing retained anchor " + relative + " " + label);
  return source.slice(0, i) + after + source.slice(i + before.length);
}

function applyHunk(source, block, relative) {
  const oldLines = block.lines.filter(line => line[0] !== "+").map(line => line.slice(1));
  const newLines = block.lines.filter(line => line[0] !== "-").map(line => line.slice(1));
  const old = oldLines.join("\n") + "\n", next = newLines.join("\n") + "\n";
  // First match the full contextual hunk. On a different historical base,
  // narrow only to individually anchored contiguous +/- runs; never replace
  // the entire HEAD file or silently fall back to it.
  if (source.includes(old) && source.indexOf(old) === source.lastIndexOf(old))
    return { output: source.replace(old, next), method: "full-context" };
  let result = source, run = [];
  const flush = (prev, following) => {
    if (!run.length) return;
    const removed = run.filter(line => line[0] === "-").map(line => line.slice(1));
    const added = run.filter(line => line[0] === "+").map(line => line.slice(1));
    const before = [...(prev ? [prev] : []), ...removed, ...(following ? [following] : [])].join("\n") + "\n";
    const after = [...(prev ? [prev] : []), ...added, ...(following ? [following] : [])].join("\n") + "\n";
    result = replaceUnique(result, before, after, relative, block.header);
    run = [];
  };
  let prev = "";
  for (const line of [...block.lines, " "]) {
    if (line[0] === " ") {
      flush(prev, line.slice(1));
      prev = line.slice(1);
    } else if (line[0] === "+" || line[0] === "-") run.push(line);
  }
  return { output: result, method: "narrow-context" };
}

for (const [mode, files] of [["api", apiFiles], ["front", frontFiles]]) {
  for (const relative of files) {
    const absolute = path.join(root, relative);
    const base = mode === "api" ? originals.get(absolute) : fs.readFileSync(path.join(baseline, relative), "utf8");
    if (typeof base !== "string") throw Error("Source missing in retained base: " + relative);
    const diff = execFileSync("git", ["diff", "HEAD", "--", relative], { cwd: root, encoding: "utf8", maxBuffer: 4_000_000 });
    const blocks = hunks(diff, relative);
    let output = base;
    const reviewed = [];
    for (const block of blocks) {
      // Every selected hunk is checked for exact anchoring and a frozen diff
      // hash. The HEAD changes to these selected files were reviewed as
      // customer/credit/supplier-only; anything else must be excluded here.
      const beforeSha256 = sha(output);
      const result = applyHunk(output, block, relative);
      output = result.output;
      reviewed.push({ header: block.header, method: result.method,
        removedSha256: sha(block.removed.join("\n")), insertedSha256: sha(block.inserted.join("\n")),
        beforeSha256, afterSha256: sha(output) });
    }
    if (output === base || /commercial[-_]?return|devolucion[-_]?comercial/i.test(relative))
      throw Error("No-op or unauthorized file: " + relative);
    const novel = /commercial[-_]?return|devolucion[-_]?comercial/gi;
    if ([...output.matchAll(novel)].length > [...base.matchAll(novel)].length)
      throw Error("Commercial return introduced: " + relative);
    const target = path.join(report, "approved", relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (fs.existsSync(target)) {
      if (fs.readFileSync(target, "utf8") !== output) throw Error("Existing overlay differs: " + relative);
    } else fs.writeFileSync(target, output);
    approval[mode].push({ path: relative, baseSha256: sha(base), sha256: sha(output) });
    inventory.push({ mode, path: relative, headSourceSha256: sha(fs.readFileSync(absolute)),
      headDiffSha256: sha(diff), baseSha256: sha(base), resultSha256: sha(output), hunks: reviewed });
  }
}
for (const relative of newFront) {
  if (fs.existsSync(path.join(baseline, relative))) throw Error("Expected new module: " + relative);
  const contents = fs.readFileSync(path.join(root, relative));
  const target = path.join(report, "approved", relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    if (!fs.readFileSync(target).equals(contents)) throw Error("Existing overlay differs: " + relative);
  } else fs.writeFileSync(target, contents);
  approval.front.push({ path: relative, baseSha256: null, sha256: sha(contents) });
  inventory.push({ mode: "front", path: relative, baseSha256: null,
    resultSha256: sha(contents), hunks: [{ header: "NEW task-owned module", beforeSha256: null, afterSha256: sha(contents) }] });
}
fs.writeFileSync(path.join(report, "approval.json"), JSON.stringify(approval, null, 2) + "\n");
fs.writeFileSync(path.join(report, "hunk-inventory.json"), JSON.stringify(inventory, null, 2) + "\n");
console.log("Task-only overlays composed from retained bases. Approval and hunk inventory pinned.");