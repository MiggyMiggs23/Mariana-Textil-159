"use strict";

const childProcess = require("node:child_process");
const dgram = require("node:dgram");
const dns = require("node:dns");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const path = require("node:path");
const tls = require("node:tls");
const workerThreads = require("node:worker_threads");
const { syncBuiltinESMExports } = require("node:module");

const GUARD = fs.realpathSync(__filename);
const GUARDED = Symbol.for("e1.offline.guard.installed");
const ORIGINALS = Symbol.for("e1.offline.guard.originals");
const REGISTER_LOOPBACK = Symbol.for("e1.offline.guard.registerLoopback");
const UNREGISTER_LOOPBACK = Symbol.for("e1.offline.guard.unregisterLoopback");
const STATIC_SERVER = Symbol.for("e1.offline.guard.staticServer");
const ERROR_CODE = "E1_OFFLINE_NETWORK_DISABLED";
const OFFLINE_DATABASE_URL = "postgresql://e1-offline.invalid:9/forbidden";
const STATIC_FIXTURE_MODE = process.env.E1_OFFLINE_STATIC_FIXTURE === "1";
const DATABASE_ENV = /^(?:DATABASE_URL|TEST_DATABASE_URL|DIRECT_URL|PG(?:HOST|PORT|DATABASE|USER|PASSWORD|SERVICE|SERVICEFILE|PASSFILE|SSLMODE|SSLROOTCERT|SSLCERT|SSLKEY|CHANNELBINDING)|POSTGRES(?:_URL|_HOST|_PORT|_DB|_DATABASE|_USER|_PASSWORD)?|REQUIRE_ISOLATED_TEST_DATABASE)$/i;

function disabled(kind) {
  const error = new Error(`${ERROR_CODE}: ${kind}`);
  error.code = ERROR_CODE;
  throw error;
}

function blocked(kind) {
  return function e1OfflineBlocked() {
    return disabled(kind);
  };
}

const allowedLoopbackPorts = new Map();

function registerLoopback(port, kind) {
  if (!STATIC_FIXTURE_MODE) disabled("loopback registration outside static fixture mode");
  const numericPort = Number(port);
  if (
    !Number.isInteger(numericPort) ||
    numericPort < 1024 ||
    numericPort > 65535 ||
    numericPort === 5432 ||
    numericPort === 8080 ||
    !["fixture", "cdp"].includes(kind)
  ) {
    disabled(`invalid ${kind} loopback registration`);
  }
  allowedLoopbackPorts.set(numericPort, kind);
  return `http://127.0.0.1:${numericPort}`;
}

function loopbackTarget(args) {
  const first = args[0];
  if (Array.isArray(first)) return loopbackTarget(first);
  if (first && typeof first === "object") {
    return {
      host: first.hostname ?? first.host,
      port: Number(first.port),
      path: first.path,
    };
  }
  return {
    port: Number(first),
    host: typeof args[1] === "string" ? args[1] : "localhost",
  };
}

function assertAllowedLoopback(args, operation) {
  const target = loopbackTarget(args);
  if (
    !STATIC_FIXTURE_MODE ||
    target.host !== "127.0.0.1" ||
    !allowedLoopbackPorts.has(target.port)
  ) {
    disabled(operation);
  }
}

function requestTarget(input) {
  try {
    if (input instanceof URL || typeof input === "string") return new URL(input);
    const protocol = input?.protocol ?? "http:";
    const hostname = input?.hostname ?? input?.host;
    return new URL(`${protocol}//${hostname}:${input?.port ?? 80}${input?.path ?? "/"}`);
  } catch {
    disabled("invalid HTTP target");
  }
}

function assertAllowedHttp(input, operation) {
  const url = requestTarget(input);
  if (
    !STATIC_FIXTURE_MODE ||
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    !allowedLoopbackPorts.has(Number(url.port || 80))
  ) {
    disabled(operation);
  }
}

function cleanEnvironment(source = process.env) {
  const clean = {};
  for (const [key, value] of Object.entries(source || {})) {
    const isOfflineDatabaseSentinel =
      key === "DATABASE_URL" && value === OFFLINE_DATABASE_URL;
    if (
      (!DATABASE_ENV.test(key) || isOfflineDatabaseSentinel) &&
      key !== "NODE_OPTIONS" &&
      value !== undefined
    ) {
      clean[key] = String(value);
    }
  }
  return clean;
}

function guardExecArgv(execArgv = []) {
  const args = [...execArgv];
  for (let index = 0; index < args.length; index += 1) {
    if (
      (args[index] === "--require" || args[index] === "-r") &&
      args[index + 1] &&
      path.resolve(args[index + 1]) === GUARD
    ) {
      return args;
    }
  }
  return ["--require", GUARD, ...args];
}

function real(candidate) {
  try {
    return fs.realpathSync(candidate);
  } catch {
    return null;
  }
}

const NODE = real(process.execPath);
const CHROMIUM = real("/repl/tools/bin/chromium");
const ESBUILD = new Set();
for (const root of [
  process.cwd(),
  path.resolve(__dirname, "../.."),
  path.resolve(__dirname, "../../artifacts/api-server"),
  path.resolve(__dirname, "../../artifacts/mariana-textil"),
]) {
  try {
    const packageFile = require.resolve("esbuild/package.json", { paths: [root] });
    const platformPackage = {
      "darwin arm64": "@esbuild/darwin-arm64",
      "darwin x64": "@esbuild/darwin-x64",
      "linux arm64": "@esbuild/linux-arm64",
      "linux x64": "@esbuild/linux-x64",
      "win32 arm64": "@esbuild/win32-arm64",
      "win32 ia32": "@esbuild/win32-ia32",
      "win32 x64": "@esbuild/win32-x64",
    }[`${process.platform} ${process.arch}`];
    if (platformPackage) {
      ESBUILD.add(real(require.resolve(`${platformPackage}/bin/esbuild`, {
        paths: [path.dirname(packageFile)],
      })));
    }
  } catch {
    // A package without esbuild does not add an allowed executable.
  }
}
ESBUILD.delete(null);

function classifyExecutable(file) {
  const resolved = real(String(file));
  if (resolved === NODE) return "node";
  if (resolved && ESBUILD.has(resolved)) return "esbuild";
  if (STATIC_FIXTURE_MODE && CHROMIUM && resolved === CHROMIUM) return "chromium";
  return null;
}

function safeChildOptions(options, executableKind) {
  const input = options && typeof options === "object" ? options : {};
  if (input.shell) disabled("child_process shell");
  const output = { ...input, shell: false, env: cleanEnvironment(input.env) };
  if (executableKind === "node") {
    const existing = input.execArgv || [];
    output.execArgv = guardExecArgv(existing);
  }
  return output;
}

function nodeArguments(args) {
  const input = Array.isArray(args) ? [...args] : [];
  return guardExecArgv(input);
}

if (!globalThis[GUARDED]) {
  for (const key of Object.keys(process.env)) {
    if (
      key === "NODE_OPTIONS" ||
      (DATABASE_ENV.test(key) &&
        !(key === "DATABASE_URL" && process.env[key] === OFFLINE_DATABASE_URL))
    ) {
      delete process.env[key];
    }
  }
  Object.defineProperty(globalThis, GUARDED, { value: true });
  Object.defineProperty(globalThis, ORIGINALS, {
    value: {
      spawn: childProcess.spawn,
      spawnSync: childProcess.spawnSync,
      execFile: childProcess.execFile,
      execFileSync: childProcess.execFileSync,
      Worker: workerThreads.Worker,
      socketConnect: net.Socket.prototype.connect,
      netCreateConnection: net.createConnection,
      netConnect: net.connect,
      serverListen: net.Server.prototype.listen,
      httpRequest: http.request,
      httpGet: http.get,
      httpCreateServer: http.createServer,
      fetch: globalThis.fetch,
    },
  });
  Object.defineProperty(globalThis, REGISTER_LOOPBACK, {
    value: registerLoopback,
  });
  Object.defineProperty(globalThis, UNREGISTER_LOOPBACK, {
    value(port) {
      allowedLoopbackPorts.delete(Number(port));
    },
  });

  net.Socket.prototype.connect = function guardedSocketConnect(...args) {
    assertAllowedLoopback(args, "net.Socket.connect");
    return globalThis[ORIGINALS].socketConnect.apply(this, args);
  };
  net.createConnection = function guardedCreateConnection(...args) {
    assertAllowedLoopback(args, "net.createConnection");
    return globalThis[ORIGINALS].netCreateConnection(...args);
  };
  net.connect = function guardedConnect(...args) {
    assertAllowedLoopback(args, "net.connect");
    return globalThis[ORIGINALS].netConnect(...args);
  };
  net.createServer = blocked("net.createServer");
  net.Server.prototype.listen = function guardedListen(...args) {
    const first = args[0];
    const port = typeof first === "object" ? Number(first.port) : Number(first);
    const host = typeof first === "object" ? first.host : args[1];
    if (
      !STATIC_FIXTURE_MODE ||
      this[STATIC_SERVER] !== true ||
      port !== 0 ||
      host !== "127.0.0.1"
    ) {
      return disabled("net.Server.listen");
    }
    const callbackIndex = args.findIndex((value) => typeof value === "function");
    const callback = callbackIndex >= 0 ? args[callbackIndex] : undefined;
    const onListening = () => {
      const address = this.address();
      if (!address || typeof address === "string") disabled("fixture server address");
      registerLoopback(address.port, "fixture");
      this.once("close", () => allowedLoopbackPorts.delete(address.port));
      callback?.();
    };
    if (callbackIndex >= 0) args[callbackIndex] = onListening;
    else args.push(onListening);
    return globalThis[ORIGINALS].serverListen.apply(this, args);
  };

  http.request = function guardedHttpRequest(input, ...args) {
    assertAllowedHttp(input, "http.request");
    return globalThis[ORIGINALS].httpRequest(input, ...args);
  };
  http.get = function guardedHttpGet(input, ...args) {
    assertAllowedHttp(input, "http.get");
    return globalThis[ORIGINALS].httpGet(input, ...args);
  };
  http.createServer = function guardedHttpCreateServer(...args) {
    if (!STATIC_FIXTURE_MODE) disabled("http.createServer");
    const server = globalThis[ORIGINALS].httpCreateServer(...args);
    Object.defineProperty(server, STATIC_SERVER, { value: true });
    return server;
  };
  https.request = blocked("https.request");
  https.get = blocked("https.get");
  https.createServer = blocked("https.createServer");
  globalThis.fetch = function guardedFetch(input, ...args) {
    assertAllowedHttp(input, "fetch");
    return globalThis[ORIGINALS].fetch(input, ...args);
  };

  for (const name of [
    "resolve", "resolve4", "resolve6", "resolveAny", "resolveCaa",
    "resolveCname", "resolveMx", "resolveNaptr", "resolveNs", "resolvePtr",
    "resolveSoa", "resolveSrv", "resolveTxt", "reverse",
  ]) {
    if (typeof dns[name] === "function") dns[name] = blocked(`dns.${name}`);
    if (dns.promises && typeof dns.promises[name] === "function") {
      dns.promises[name] = blocked(`dns.promises.${name}`);
    }
  }
  dns.lookup = function guardedLookup(hostname, options, callback) {
    if (!STATIC_FIXTURE_MODE || hostname !== "127.0.0.1") {
      return disabled("dns.lookup");
    }
    const actualOptions = typeof options === "object" ? options : {};
    const done = typeof options === "function" ? options : callback;
    if (typeof done !== "function") return disabled("dns.lookup without callback");
    queueMicrotask(() => {
      if (actualOptions.all) done(null, [{ address: "127.0.0.1", family: 4 }]);
      else done(null, "127.0.0.1", 4);
    });
  };
  if (dns.promises) {
    dns.promises.lookup = async function guardedPromisesLookup(hostname, options = {}) {
      if (!STATIC_FIXTURE_MODE || hostname !== "127.0.0.1") {
        return disabled("dns.promises.lookup");
      }
      return options.all
        ? [{ address: "127.0.0.1", family: 4 }]
        : { address: "127.0.0.1", family: 4 };
    };
  }

  dgram.createSocket = blocked("dgram.createSocket");
  for (const name of ["bind", "connect", "send"]) {
    if (typeof dgram.Socket.prototype[name] === "function") {
      dgram.Socket.prototype[name] = blocked(`dgram.Socket.${name}`);
    }
  }
  tls.connect = blocked("tls.connect");
  tls.createServer = blocked("tls.createServer");
  if (typeof tls.TLSSocket.prototype.connect === "function") {
    tls.TLSSocket.prototype.connect = blocked("tls.TLSSocket.connect");
  }

  childProcess.exec = blocked("child_process.exec");
  childProcess.execSync = blocked("child_process.execSync");
  childProcess.fork = blocked("child_process.fork");

  childProcess.spawn = function guardedSpawn(file, args, options) {
    const kind = classifyExecutable(file);
    if (!kind) return disabled(`child_process.spawn ${String(file)}`);
    const finalArgs = kind === "node" ? nodeArguments(args) : [...(args || [])];
    return globalThis[ORIGINALS].spawn(file, finalArgs, safeChildOptions(options, kind));
  };
  childProcess.spawnSync = function guardedSpawnSync(file, args, options) {
    const kind = classifyExecutable(file);
    if (!kind) return disabled(`child_process.spawnSync ${String(file)}`);
    const finalArgs = kind === "node" ? nodeArguments(args) : [...(args || [])];
    return globalThis[ORIGINALS].spawnSync(file, finalArgs, safeChildOptions(options, kind));
  };
  childProcess.execFile = function guardedExecFile(file, args, options, callback) {
    const kind = classifyExecutable(file);
    if (!kind) return disabled(`child_process.execFile ${String(file)}`);
    let actualArgs = args;
    let actualOptions = options;
    let actualCallback = callback;
    if (typeof args === "function") {
      actualCallback = args;
      actualArgs = [];
      actualOptions = {};
    } else if (typeof options === "function") {
      actualCallback = options;
      actualOptions = {};
    }
    const finalArgs = kind === "node" ? nodeArguments(actualArgs) : [...(actualArgs || [])];
    return globalThis[ORIGINALS].execFile(
      file,
      finalArgs,
      safeChildOptions(actualOptions, kind),
      actualCallback,
    );
  };
  childProcess.execFileSync = function guardedExecFileSync(file, args, options) {
    const kind = classifyExecutable(file);
    if (!kind) return disabled(`child_process.execFileSync ${String(file)}`);
    const finalArgs = kind === "node" ? nodeArguments(args) : [...(args || [])];
    return globalThis[ORIGINALS].execFileSync(file, finalArgs, safeChildOptions(options, kind));
  };

  workerThreads.Worker = class GuardedWorker extends globalThis[ORIGINALS].Worker {
    constructor(filename, options = {}) {
      if (options.eval) disabled("worker_threads eval Worker");
      super(filename, {
        ...options,
        env: cleanEnvironment(options.env),
        execArgv: guardExecArgv(options.execArgv || process.execArgv),
      });
    }
  };

  syncBuiltinESMExports();
}

module.exports = Object.freeze({
  ERROR_CODE,
  OFFLINE_DATABASE_URL,
  STATIC_FIXTURE_MODE,
  guardPath: GUARD,
  cleanEnvironment,
  isInstalled: () => globalThis[GUARDED] === true,
});