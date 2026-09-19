
"use strict";
const fs = require("node:fs");
const { fileURLToPath } = require("node:url");
const { syncBuiltinESMExports } = require("node:module");
const original = fs.readFileSync;
fs.readFileSync = function(path, options) {
  const result = original.apply(this, arguments);
  const actual = path instanceof URL ? fileURLToPath(path) : String(path);
  if (actual === "/home/runner/workspace/artifacts/mariana-textil/src/pages/caja/cuentas-destino.tsx" && options === "utf8") {
    if (typeof result !== "string" || !result.includes("Contado cobrado"))
      throw new Error("Mutation target unavailable: destino-label");
    console.error("SOURCE-IN-MEMORY MUTATION destino-label");
    return result.replaceAll("Contado cobrado", "Cobros directos");
  }
  return result;
};
syncBuiltinESMExports();
