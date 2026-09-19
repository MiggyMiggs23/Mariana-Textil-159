
"use strict";
const fs = require("node:fs");
const { fileURLToPath } = require("node:url");
const { syncBuiltinESMExports } = require("node:module");
const original = fs.readFileSync;
fs.readFileSync = function(path, options) {
  const result = original.apply(this, arguments);
  const actual = path instanceof URL ? fileURLToPath(path) : String(path);
  if (actual === "/home/runner/workspace/artifacts/mariana-textil/src/pages/caja/tiempo-real.tsx" && options === "utf8") {
    if (typeof result !== "string" || !result.includes("aria-label=\"Cobranza del periodo\""))
      throw new Error("Mutation target unavailable: realtime-aria");
    console.error("SOURCE-IN-MEMORY MUTATION realtime-aria");
    return result.replace("aria-label=\"Cobranza del periodo\"", "aria-label=\"Cobrado en el periodo\"");
  }
  return result;
};
syncBuiltinESMExports();
