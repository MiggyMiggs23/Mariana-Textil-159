const { syncBuiltinESMExports } = require("node:module");
const deny = () => { throw new Error("TAREA5: network/process/SQL execution forbidden"); };
for (const name of ["node:net", "node:tls", "node:http", "node:https", "node:dgram", "node:child_process"]) {
  const mod = require(name);
  for (const key of ["connect", "createConnection", "createServer", "request", "get", "createSocket", "spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]) {
    if (key in mod) mod[key] = deny;
  }
  if (mod.Socket?.prototype) mod.Socket.prototype.connect = deny;
  if (mod.Server?.prototype) mod.Server.prototype.listen = deny;
}
globalThis.fetch = deny;
globalThis.WebSocket = deny;
const Module = require("node:module");
const original = Module._load;
Module._load = function(name, ...args) {
  if (/^(pg|postgres|@neondatabase|@workspace\/db)(\/|$)/.test(name)) deny();
  return original.call(this, name, ...args);
};
syncBuiltinESMExports();