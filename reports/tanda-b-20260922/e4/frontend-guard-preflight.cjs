"use strict";
// Run ONLY from a physical temporary copy with frontend-offline-guard preloaded.
// No DNS lookup, socket connection/listen, child process or app/test is invoked.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const dns = require("node:dns");
const net = require("node:net");
const http = require("node:http");
const deny = net.Socket.prototype.connect;
assert.equal(globalThis.__E4_OFFLINE_GUARD__, true);
assert.match(String(deny), /E4_OFFLINE_ACCESS_BLOCKED/);
for (const api of [dns, dns.promises]) {
  assert.equal(typeof api.Resolver, "function");
  assert.ok(api.Resolver.prototype);
  const resolver = new api.Resolver();
  for (const key of ["resolve", "resolve4", "resolve6", "reverse"]) {
    assert.equal(api[key], deny, `DNS ${key} blocked`);
    assert.equal(resolver[key], deny, `Resolver ${key} blocked`);
  }
  assert.notEqual(api.getDefaultResultOrder, deny);
  assert.notEqual(api.setDefaultResultOrder, deny);
  const order = api.getDefaultResultOrder();
  api.setDefaultResultOrder(order);
}
assert.equal(net.Server.prototype.listen, deny);
assert.equal(http.request, deny);
assert.equal(require("node:https").request, deny);
assert.equal(require("node:tls").connect, deny);
assert.equal(require("node:dgram").Socket.prototype.send, deny);
assert.equal(globalThis.fetch, deny);
assert.equal(require("node:child_process").exec, deny);
const server = http.createServer();
assert.equal(server.listening, false);
assert.equal(server.listen, deny);
const file = path.join(process.env.E4_SANDBOX, "local-write-probe.txt");
fs.writeFileSync(file, "sandbox-only");
assert.equal(fs.readFileSync(file, "utf8"), "sandbox-only");
fs.unlinkSync(file);
console.log("PRELOAD_PREFLIGHT_OK: Resolver constructors/local DNS configuration/server construction preserved; query/connect/listen/child guards installed. No network, app or test executed.");