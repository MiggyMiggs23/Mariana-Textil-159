"use strict";
// Used only by the E4 runner. No socket, DNS, fetch, database driver or child escape.
const { syncBuiltinESMExports } = require("node:module");
const Module = require("node:module");
const deny = () => { const error = new Error("E4_OFFLINE_ACCESS_BLOCKED"); error.code = "E4_OFFLINE_ACCESS_BLOCKED"; throw error; };
for (const name of Object.keys(process.env)) {
  if (/DATABASE|POSTGRES|^PG[A-Z_]|^DIRECT_URL$/.test(name)) delete process.env[name];
}
for (const [mod, methods] of [
  ["node:net", ["connect", "createConnection", "createServer"]],
  ["node:tls", ["connect", "createServer"]],
  ["node:http", ["request", "get", "createServer"]],
  ["node:https", ["request", "get", "createServer"]],
  ["node:dgram", ["createSocket"]],
  ["node:dns", ["lookup", "resolve", "resolve4", "resolve6"]],
  ["node:child_process", ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]],
]) {
  const object = require(mod);
  for (const method of methods) object[method] = deny;
}
require("node:net").Socket.prototype.connect = deny;
require("node:net").Server.prototype.listen = deny;
require("node:dns").promises.lookup = deny;
require("node:dns").promises.resolve = deny;
global.fetch = deny;
global.WebSocket = class { constructor() { deny(); } };
require("node:worker_threads").Worker = class { constructor() { deny(); } };
const originalLoad = Module._load;
Module._load = function(request, ...rest) {
  if (/^(pg|postgres|postgresql|@workspace\/db)(\/|$)/.test(request)) deny();
  return originalLoad.call(this, request, ...rest);
};
syncBuiltinESMExports();