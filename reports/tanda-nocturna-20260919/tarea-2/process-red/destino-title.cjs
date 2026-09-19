
"use strict";
const fs = require("node:fs");
const { fileURLToPath } = require("node:url");
const { syncBuiltinESMExports } = require("node:module");
const original = fs.readFileSync;
fs.readFileSync = function(path, options) {
  const result = original.apply(this, arguments);
  const actual = path instanceof URL ? fileURLToPath(path) : String(path);
  if (actual === "/home/runner/workspace/artifacts/mariana-textil/src/pages/caja/cuentas-destino.tsx" && options === "utf8") {
    if (typeof result !== "string" || !result.includes("Cobranza del periodo"))
      throw new Error("Mutation target unavailable: destino-title");
    console.error("SOURCE-IN-MEMORY MUTATION destino-title");
    return result.replaceAll("Cobranza del periodo", "Cobrado");
  }
  return result;
};
syncBuiltinESMExports();
