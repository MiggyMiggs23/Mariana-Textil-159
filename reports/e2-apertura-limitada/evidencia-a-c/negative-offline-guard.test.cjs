"use strict";
const Module = require("node:module");
const { syncBuiltinESMExports } = Module;
const deny = () => { throw new Error("E2_OFFLINE_FORBIDDEN_IO"); };
for (const [name, methods] of Object.entries({
  "node:net": ["connect", "createConnection", "createServer"],
  "node:tls": ["connect", "createServer"],
  "node:http": ["request", "get", "createServer"],
  "node:https": ["request", "get", "createServer"],
  "node:dgram": ["createSocket"],
  "node:dns": ["lookup", "resolve"],
  "node:child_process": ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"],
})) {
  const api = require(name);
  for (const method of methods) api[method] = deny;
}
require("node:net").Socket.prototype.connect = deny;
require("node:net").Server.prototype.listen = deny;
globalThis.fetch = deny;
const original = Module._load;
Module._load = function(name, ...args) {
  if (/^(?:pg(?:\/|$)|postgres(?:\/|$)|@workspace\/db(?:\/|$))/.test(name)) deny();
  return original.call(this, name, ...args);
};
syncBuiltinESMExports();