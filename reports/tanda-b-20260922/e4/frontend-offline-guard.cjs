"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { syncBuiltinESMExports } = require("node:module");
const sandbox = fs.realpathSync(process.env.E4_SANDBOX);
const deny = () => { throw new Error("E4_OFFLINE_ACCESS_BLOCKED"); };
function readable(value) {
  if (typeof value === "number") return;
  const file = value instanceof URL ? require("node:url").fileURLToPath(value) : String(value);
  if (!fs.existsSync(file)) return;
  const real = fs.realpathSync(file);
  if (real.startsWith(process.env.E4_LIVE_ROOT + path.sep) && !real.includes(`${path.sep}node_modules${path.sep}`))
    throw Error(`E4_LIVE_SOURCE_ESCAPE: ${real}`);
}
for (const api of [fs, fs.promises]) {
  for (const key of ["readFile", "readFileSync"]) {
    const original = api[key];
    if (original) api[key] = function (target, ...args) { readable(target); return original.call(this, target, ...args); };
  }
}
for (const name of ["node:net", "node:tls", "node:http", "node:https", "node:http2", "node:dgram", "node:dns"]) {
  const mod = require(name);
  for (const key of ["connect", "createConnection", "request", "get", "createSocket", "lookup", "resolve", "resolve4", "resolve6"]) {
    if (typeof mod[key] === "function") mod[key] = deny;
  }
}
require("node:net").Socket.prototype.connect = deny;
require("node:net").Server.prototype.listen = deny;
for (const api of [require("node:dns"), require("node:dns").promises]) {
  // Preserve Resolver constructors and local DNS configuration methods.
  // Both callback and promise Resolver query prototypes are patched below.
  const resolverPrototype = api.Resolver?.prototype;
  for (const key of Object.keys(api)) {
    if (/^(resolve|reverse|lookup)/.test(key) && typeof api[key] === "function") api[key] = deny;
  }
  if (resolverPrototype) for (const key of Object.getOwnPropertyNames(resolverPrototype)) {
    if (/^(resolve|reverse|lookup)/.test(key)) resolverPrototype[key] = deny;
  }
}
// Vite resolves its local default host even without opening a listener.
// Answer only these literal loopback names from a fixed table: NEVER delegate
// to OS DNS/getaddrinfo, including on invalid options or unknown hostnames.
function localLookup(hostname, options = {}) {
  const hosts = { localhost: ["127.0.0.1", "::1"], "127.0.0.1": ["127.0.0.1"], "::1": ["::1"] };
  if (!Object.hasOwn(hosts, hostname)) return deny();
  const opts = typeof options === "number" ? { family: options } : options;
  if (!opts || ![undefined, 0, 4, 6].includes(opts.family)) return deny();
  const results = hosts[hostname].map(address => ({ address, family: address.includes(":") ? 6 : 4 }))
    .filter(value => !opts.family || value.family === opts.family);
  if (!results.length) return deny();
  return opts.all ? results : results[0];
}
require("node:dns").lookup = (hostname, options, callback) => {
  if (typeof options === "function") { callback = options; options = {}; }
  if (typeof callback !== "function") return deny();
  const result = localLookup(hostname, options);
  queueMicrotask(() => Array.isArray(result) ? callback(null, result) : callback(null, result.address, result.family));
};
require("node:dns").promises.lookup = async (hostname, options) => localLookup(hostname, options);
for (const key of ["send", "bind", "connect"]) require("node:dgram").Socket.prototype[key] = deny;
globalThis.fetch = deny;
globalThis.WebSocket = class { constructor() { deny(); } };
const cp = require("node:child_process");
const spawn = cp.spawn;
cp.spawn = function (command, args, options) {
  // Vite's one necessary native compiler, exact verified binary and service protocol.
  if (fs.realpathSync(command) !== process.env.E4_ESBUILD ||
      !Array.isArray(args) || args.length !== 2 || !/^--service=\d+\.\d+\.\d+$/.test(args[0]) || args[1] !== "--ping" ||
      options?.shell) deny();
  return spawn.call(this, command, args, { ...options, env: {
    PATH: process.env.PATH, HOME: sandbox, TMPDIR: sandbox,
  } });
};
for (const key of ["exec", "execSync", "execFile", "execFileSync", "spawnSync", "fork"]) cp[key] = deny;
function writable(value) {
  if (typeof value === "number") deny();
  let target = path.resolve(value instanceof URL ? require("node:url").fileURLToPath(value) : String(value));
  while (!fs.existsSync(target)) target = path.dirname(target);
  const real = fs.realpathSync(target);
  if (real !== sandbox && !real.startsWith(sandbox + path.sep)) deny();
}
for (const key of ["createWriteStream", "writeFile", "writeFileSync", "appendFile", "appendFileSync", "mkdir", "mkdirSync", "rm", "rmSync", "unlink", "unlinkSync", "rmdir", "rmdirSync", "truncate", "truncateSync", "utimes", "utimesSync"]) {
  const original = fs[key];
  fs[key] = function (target, ...args) { writable(target); return original.call(this, target, ...args); };
}
for (const key of ["rename", "renameSync", "copyFile", "copyFileSync"]) {
  const original = fs[key];
  fs[key] = function (from, to, ...args) { if (key.startsWith("rename")) writable(from); writable(to); return original.call(this, from, to, ...args); };
}
for (const key of ["symlink", "symlinkSync", "link", "linkSync", "chmod", "chmodSync", "chown", "chownSync"]) fs[key] = deny;
for (const key of ["open", "openSync"]) {
  const original = fs[key];
  fs[key] = function (target, flags, ...args) {
    readable(target);
    if (typeof flags === "number" ? (flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT)) !== 0 : /[wa+]/.test(flags)) writable(target);
    return original.call(this, target, flags, ...args);
  };
}
for (const key of ["writeFile", "appendFile", "mkdir", "rm", "unlink", "rmdir", "truncate", "open"]) {
  const original = fs.promises[key];
  fs.promises[key] = async function (target, ...args) {
    if (key === "open") readable(target);
    if (key !== "open" || args[0] !== "r") writable(target);
    return original.call(this, target, ...args);
  };
}
for (const key of ["rename", "copyFile"]) {
  const original = fs.promises[key];
  fs.promises[key] = async function (from, to, ...args) {
    if (key === "rename") writable(from);
    writable(to); return original.call(this, from, to, ...args);
  };
}
for (const key of ["symlink", "link", "chmod", "chown", "lchmod", "lchown", "cp", "utimes"]) {
  if (fs.promises[key]) fs.promises[key] = deny;
}
for (const key of ["ftruncate", "ftruncateSync", "fchmod", "fchmodSync", "fchown", "fchownSync", "cp", "cpSync"]) {
  if (fs[key]) fs[key] = deny;
}
globalThis.__E4_OFFLINE_GUARD__ = true;
syncBuiltinESMExports();