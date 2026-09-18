import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { access, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";

const frontendRoot = resolve(dirname(new URL(import.meta.url).pathname), "../..");
const frontendRequire = createRequire(
  new URL("../../package.json", import.meta.url),
);
const apiServerRequire = createRequire(
  new URL("../../../api-server/package.json", import.meta.url),
);
const tailwindRequire = createRequire(frontendRequire.resolve("@tailwindcss/vite"));
const { build } = apiServerRequire("esbuild") as {
  build: (options: Record<string, unknown>) => Promise<{ outputFiles?: Array<{ text: string; path: string }> }>;
};
const { compile } = tailwindRequire("@tailwindcss/node") as {
  compile: (
    css: string,
    options: { base: string; from: string; onDependency: (path: string) => void },
  ) => Promise<{ build: (candidates: string[]) => string }>;
};
const registerGuardedLoopback = (
  globalThis as typeof globalThis & {
    [key: symbol]: ((port: number, kind: "fixture" | "cdp") => string) | undefined;
  }
)[Symbol.for("e1.offline.guard.registerLoopback")];
const unregisterGuardedLoopback = (
  globalThis as typeof globalThis & {
    [key: symbol]: ((port: number) => void) | undefined;
  }
)[Symbol.for("e1.offline.guard.unregisterLoopback")];

type Viewport = { width: number; height: number };

export type BrowserFixtureOptions = {
  entrySource: string;
  moduleAliases?: Record<string, string>;
  viewport?: Viewport;
};

type CdpReply = { id?: number; result?: Record<string, unknown>; error?: { message?: string; code?: number }; method?: string; params?: Record<string, unknown>; sessionId?: string };

class CdpConnection {
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (result: Record<string, unknown>) => void; reject: (error: Error) => void }>();
  private readonly handlers = new Map<string, Array<(params: Record<string, unknown>) => void>>();

  constructor(private readonly socket: WebSocket) {
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as CdpReply;
      if (message.id !== undefined) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) {
          pending.reject(new Error(`${message.error.message ?? "CDP error"} (${message.error.code ?? "unknown"})`));
        } else {
          pending.resolve(message.result ?? {});
        }
        return;
      }
      for (const handler of this.handlers.get(message.method ?? "") ?? []) {
        handler(message.params ?? {});
      }
    });
    socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) pending.reject(new Error("CDP WebSocket closed"));
      this.pending.clear();
    });
  }

  on(method: string, handler: (params: Record<string, unknown>) => void) {
    const handlers = this.handlers.get(method) ?? [];
    handlers.push(handler);
    this.handlers.set(method, handlers);
  }

  call(method: string, params: Record<string, unknown> = {}, sessionId?: string, timeoutMs = 30_000) {
    const id = this.nextId++;
    const reply = new Promise<Record<string, unknown>>((resolveReply, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Chromium CDP timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timeout); resolveReply(value); },
        reject: (error) => { clearTimeout(timeout); reject(error); },
      });
    });
    try {
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    } catch (error) {
      this.pending.get(id)?.reject(error instanceof Error ? error : new Error(String(error)));
      this.pending.delete(id);
    }
    return reply;
  }

  close() {
    this.socket.close();
  }
}

async function fetchJson(url: string) {
  let lastError: unknown;
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return await response.json() as { webSocketDebuggerUrl: string };
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error(`No se pudo conectar a Chromium: ${String(lastError)}`);
}

async function connectCdp(url: string) {
  const socket = new WebSocket(url);
  await new Promise<void>((resolveConnection, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out connecting to Chromium CDP")), 10_000);
    socket.addEventListener("open", () => {
      clearTimeout(timeout);
      resolveConnection();
    }, { once: true });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("Could not open Chromium CDP WebSocket"));
    }, { once: true });
  });
  return new CdpConnection(socket);
}

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:[cm]?[jt]sx?|css)$/.test(entry.name) ? [path] : [];
  }));
  return nested.flat();
}

async function resolveSourcePath(basePath: string) {
  for (const extension of ["", ".tsx", ".ts", ".jsx", ".js"]) {
    const candidate = `${basePath}${extension}`;
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue to the next source extension.
    }
  }
  for (const extension of [".tsx", ".ts", ".jsx", ".js"]) {
    const candidate = join(basePath, `index${extension}`);
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue to the next index extension.
    }
  }
  throw new Error(`No se encontró el módulo de fixture: ${basePath}`);
}

function tailwindCandidates(source: string) {
  return source.match(/[A-Za-z0-9_!:[\]\/.%#(),=-]+/g) ?? [];
}

async function buildRealCss(extraSource: string) {
  const cssPath = join(frontendRoot, "src/index.css");
  const [cssSource, files] = await Promise.all([
    readFile(cssPath, "utf8"),
    sourceFiles(join(frontendRoot, "src")),
  ]);
  const compiler = await compile(cssSource, {
    base: frontendRoot,
    from: cssPath,
    onDependency() {},
  });
  const allSource = await Promise.all(files.map((file) => readFile(file, "utf8")));
  return compiler.build([
    ...tailwindCandidates(extraSource),
    ...allSource.flatMap(tailwindCandidates),
  ]);
}

async function bundleFixture(
  directory: string,
  options: BrowserFixtureOptions,
) {
  const fixturePath = join(directory, "fixture.tsx");
  const entryPath = join(directory, "entry.tsx");
  const bundlePath = join(directory, "fixture.js");
  await Promise.all([
    writeFile(fixturePath, options.entrySource, "utf8"),
    writeFile(
      entryPath,
      `
        import React from "react";
        import { createRoot } from "react-dom/client";
        import Fixture from "./fixture";
        const root = document.createElement("div");
        root.id = "observable-test-root";
        document.body.append(root);
        createRoot(root).render(React.createElement(Fixture));
      `,
      "utf8",
    ),
  ]);
  await build({
    entryPoints: [entryPath],
    outfile: bundlePath,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    logLevel: "silent",
    absWorkingDir: frontendRoot,
    loader: {
      ".png": "dataurl",
      ".jpg": "dataurl",
      ".jpeg": "dataurl",
      ".svg": "dataurl",
    },
    define: {
      "import.meta.env": JSON.stringify({
        BASE_URL: "/",
        MODE: "test",
        DEV: false,
        PROD: false,
        SSR: false,
      }),
    },
    plugins: [{
      name: "observable-fixture-aliases",
      setup(esbuild: {
        onResolve: (
          options: { filter: RegExp },
          callback: (args: { path: string }) => { path: string } | undefined | Promise<{ path: string } | undefined>,
        ) => void;
      }) {
        esbuild.onResolve({ filter: /^[^./]/ }, (args) => {
          const alias = options.moduleAliases?.[args.path];
          if (alias) return { path: alias };
          try {
            // Fixture aliases often live in /tmp; resolve their package imports
            // from the real frontend package rather than that transient folder.
            return { path: frontendRequire.resolve(args.path) };
          } catch {
            return undefined;
          }
        });
        esbuild.onResolve({ filter: /^@\// }, async (args) => ({
          path: await resolveSourcePath(resolve(frontendRoot, "src", args.path.slice(2))),
        }));
      },
    }],
  });
  return {
    javascript: await readFile(bundlePath, "utf8"),
    css: await buildRealCss(options.entrySource),
  };
}

async function startFixtureServer(files: { javascript: string; css: string }) {
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://fixture.test").pathname;
    if (path === "/" || path === "/index.html") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end('<!doctype html><html><head><link rel="stylesheet" href="/fixture.css"></head><body><script src="/fixture.js"></script></body></html>');
    } else if (path === "/fixture.js") {
      response.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
      response.end(files.javascript);
    } else if (path === "/fixture.css") {
      response.writeHead(200, { "content-type": "text/css; charset=utf-8" });
      response.end(files.css);
    } else {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveListen());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("El servidor de fixture no entregó un puerto");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
    },
  };
}

function resultValue(result: Record<string, unknown>) {
  const exception = result.exceptionDetails as { text?: string; exception?: { description?: string } } | undefined;
  if (exception) throw new Error(exception.exception?.description ?? exception.text ?? "La expresión del navegador falló");
  const remote = result.result as { value?: unknown; unserializableValue?: string } | undefined;
  return remote?.unserializableValue ?? remote?.value;
}

export async function withBrowserFixture<T>(
  options: BrowserFixtureOptions,
  usePage: (page: {
    evaluate<TValue>(expressionJS: string): Promise<TValue>;
    waitFor(expressionJS: string): Promise<void>;
    click(selector: string): Promise<void>;
    fill(selector: string, value: string): Promise<void>;
    press(selector: string, key: string): Promise<void>;
    viewport(width: number, height: number): Promise<void>;
  }) => Promise<T>,
): Promise<T> {
  // Keeping the entry below the package lets esbuild resolve the production
  // package's read-only node_modules exactly as the browser build does.
  const fixtureDirectory = await mkdtemp(join(frontendRoot, ".observable-capture-"));
  let fixtureServer: Awaited<ReturnType<typeof startFixtureServer>> | undefined;
  let browser: ReturnType<typeof spawn> | undefined;
  let profileDirectory: string | undefined;
  let cdp: CdpConnection | undefined;
  let targetId: string | undefined;
  let debugPort: number | undefined;
  const browserStderr: string[] = [];
  const runtimeExceptions: string[] = [];
  try {
    const files = await bundleFixture(fixtureDirectory, options);
    fixtureServer = await startFixtureServer(files);
    profileDirectory = await mkdtemp(join(tmpdir(), "observable-chromium-"));
    browser = spawn("/repl/tools/bin/chromium", [
      "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
      "--renderer-process-limit=1", "--disable-background-networking",
      "--disable-background-timer-throttling", "--disable-component-update",
      "--disable-default-apps", "--disable-domain-reliability", "--disable-sync",
      "--metrics-recording-only", "--no-first-run", "--no-proxy-server",
      "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
      "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0",
      `--user-data-dir=${profileDirectory}`, "about:blank",
    ], { stdio: ["ignore", "ignore", "pipe"] });
    browser.stderr?.on("data", (chunk) => browserStderr.push(String(chunk)));
    debugPort = await new Promise<number>((resolvePort, reject) => {
      const deadline = Date.now() + 10_000;
      const probe = () => {
        readFile(join(profileDirectory!, "DevToolsActivePort"), "utf8")
          .then((text) => resolvePort(Number(text.split("\n")[0])))
          .catch(() => Date.now() > deadline
            ? reject(new Error("Chromium no expuso CDP"))
            : setTimeout(probe, 50));
      };
      probe();
    });
    if (process.env.E1_OFFLINE_STATIC_FIXTURE === "1" && !registerGuardedLoopback) {
      throw new Error("E1 static fixture mode requires the offline guard");
    }
    registerGuardedLoopback?.(debugPort, "cdp");
    const version = await fetchJson(`http://127.0.0.1:${debugPort}/json/version`);
    cdp = await connectCdp(version.webSocketDebuggerUrl);
    const target = await cdp.call("Target.createTarget", { url: "about:blank" });
    targetId = String(target.targetId);
    const attached = await cdp.call("Target.attachToTarget", { targetId, flatten: true });
    const sessionId = String(attached.sessionId);
    const sessionCall = (method: string, params: Record<string, unknown> = {}) =>
      cdp!.call(method, params, sessionId);
    await sessionCall("Page.enable");
    await sessionCall("Runtime.enable");
    cdp.on("Runtime.exceptionThrown", (params) => {
      const details = params.exceptionDetails as { text?: string; exception?: { description?: string } } | undefined;
      runtimeExceptions.push(details?.exception?.description ?? details?.text ?? "Runtime.exceptionThrown");
    });
    await sessionCall("Emulation.setDeviceMetricsOverride", {
      width: options.viewport?.width ?? 1280, height: options.viewport?.height ?? 800,
      deviceScaleFactor: 1, mobile: false,
    });
    await sessionCall("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
    cdp.on("Fetch.requestPaused", (params) => {
      const url = String(params.request && (params.request as { url?: string }).url);
      const isFixtureRequest = (() => {
        try { return new URL(url).origin === fixtureServer!.origin; } catch { return false; }
      })();
      void sessionCall(isFixtureRequest
        ? "Fetch.continueRequest"
        : "Fetch.failRequest", isFixtureRequest
        ? { requestId: params.requestId as string }
        : { requestId: params.requestId as string, errorReason: "BlockedByClient" }).catch(() => {
          // The target may close while a blocked external request is resolving.
        });
    });
    await sessionCall("Page.navigate", { url: fixtureServer.origin });

    const evaluate = async <TValue>(expressionJS: string) => resultValue(
      await sessionCall("Runtime.evaluate", {
        expression: expressionJS, awaitPromise: true, returnByValue: true,
      }),
    ) as TValue;
    const waitFor = async (expressionJS: string) => {
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        if (await evaluate<boolean>(`Boolean(${expressionJS})`)) return;
        await new Promise((done) => setTimeout(done, 25));
      }
      const diagnostics = [
        ...runtimeExceptions.map((message) => `Runtime exception: ${message}`),
        ...(browserStderr.length ? [`Chromium stderr: ${browserStderr.join("").slice(-1_000)}`] : []),
      ];
      throw new Error(`Timed out waiting for browser condition: ${expressionJS}${diagnostics.length ? `\n${diagnostics.join("\n")}` : ""}`);
    };
    const page = {
      evaluate,
      waitFor,
      async click(selector: string) {
        const bounds = await evaluate<{ x: number; y: number; width: number; height: number }>(`(() => {
          const element = document.querySelector(${JSON.stringify(selector)});
          if (!(element instanceof HTMLElement)) throw new Error("No existe: " + ${JSON.stringify(selector)});
          element.scrollIntoView({ block: "center", inline: "center" });
          const rect = element.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) throw new Error("No es visible: " + ${JSON.stringify(selector)});
          return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
        })()`);
        const x = bounds.x + bounds.width / 2;
        const y = bounds.y + bounds.height / 2;
        await sessionCall("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", clickCount: 0 });
        await sessionCall("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
        await sessionCall("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
      },
      async fill(selector: string, value: string) {
        await evaluate(`(() => {
          const element = document.querySelector(${JSON.stringify(selector)});
          if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) throw new Error("No es campo editable: " + ${JSON.stringify(selector)});
          const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")?.set;
          setter?.call(element, ${JSON.stringify(value)});
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
        })()`);
      },
      async press(selector: string, key: string) {
        await evaluate(`(() => {
          const element = document.querySelector(${JSON.stringify(selector)});
          if (!(element instanceof HTMLElement)) throw new Error("No existe: " + ${JSON.stringify(selector)});
          element.focus();
        })()`);
        const code = key === "Enter" ? "Enter" : key;
        const keyCode = key === "Enter" ? 13 : key.length === 1 ? key.charCodeAt(0) : 0;
        await sessionCall("Input.dispatchKeyEvent", {
          type: "keyDown", key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode,
        });
        await sessionCall("Input.dispatchKeyEvent", {
          type: "keyUp", key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode,
        });
      },
      async viewport(width: number, height: number) {
        await sessionCall("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
        await evaluate("window.dispatchEvent(new Event('resize'))");
      },
    };
    return await usePage(page);
  } finally {
    if (cdp && targetId) {
      try { await cdp.call("Target.closeTarget", { targetId }, undefined, 2_000); } catch { /* Cleanup continues. */ }
    }
    cdp?.close();
    if (browser) {
      if (browser.exitCode === null && browser.signalCode === null) {
        const exited = new Promise<void>((done) => browser!.once("exit", () => done()));
        browser.kill("SIGTERM");
        await new Promise<void>((done) => {
          const deadline = setTimeout(() => {
            if (browser!.exitCode === null && browser!.signalCode === null) browser!.kill("SIGKILL");
            done();
          }, 3_000);
          void exited.then(() => {
            clearTimeout(deadline);
            done();
          });
        });
      }
      browser.stderr?.destroy();
      browser.unref();
    }
    if (debugPort !== undefined) unregisterGuardedLoopback?.(debugPort);
    if (profileDirectory) await rm(profileDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    if (fixtureServer) await fixtureServer.close();
    await rm(fixtureDirectory, { recursive: true, force: true });
  }
}