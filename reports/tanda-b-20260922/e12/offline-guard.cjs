"use strict";
const Module = require("node:module");
const deny = () => { throw new Error("E12_OFFLINE_ACCESS_BLOCKED"); };
for (const key of Object.keys(process.env)) if (/DATABASE|POSTGRES|^PG[A-Z_]|^DIRECT_URL$/.test(key)) delete process.env[key];
for (const [name, methods] of [
  ["node:net", ["connect", "createConnection", "createServer"]],
  ["node:tls", ["connect", "createServer"]],
  ["node:http", ["request", "get", "createServer"]],
  ["node:https", ["request", "get", "createServer"]],
  ["node:dgram", ["createSocket"]],
  ["node:dns", ["lookup", "resolve", "resolve4", "resolve6"]],
  ["node:child_process", ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]],
]) for (const method of methods) require(name)[method] = deny;
require("node:net").Socket.prototype.connect = deny;
require("node:net").Server.prototype.listen = deny;
require("node:dns").promises.lookup = deny;
require("node:dns").promises.resolve = deny;
require("node:worker_threads").Worker = class { constructor() { deny(); } };
global.fetch = deny;
global.WebSocket = class { constructor() { deny(); } };
const load = Module._load;
Module._load = function(name, ...rest) {
  if (/^(pg|postgres|postgresql|@workspace\/db)(\/|$)/.test(name)) deny();
  return load.call(this, name, ...rest);
};
Module.syncBuiltinESMExports();