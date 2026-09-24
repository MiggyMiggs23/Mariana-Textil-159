import { createReadStream, statSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { extname, join, normalize } from "node:path";

const root = process.env.STATIC_ROOT;
const host = "127.0.0.1";
const port = Number(process.env.PROXY_PORT ?? "43820");
const apiPort = Number(process.env.API_PORT ?? "43821");

if (!root || !Number.isInteger(port) || !Number.isInteger(apiPort)) {
  throw new Error("STATIC_ROOT, PROXY_PORT and API_PORT are required.");
}

const types = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".woff2", "font/woff2"],
]);

function staticPath(url) {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const relative = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "").replace(/^[/\\]+/, "");
  const candidate = join(root, relative || "index.html");
  try {
    return statSync(candidate).isFile() ? candidate : join(root, "index.html");
  } catch {
    return join(root, "index.html");
  }
}

createServer((incoming, outgoing) => {
  if (incoming.url?.startsWith("/api")) {
    const proxied = httpRequest({
      host,
      port: apiPort,
      method: incoming.method,
      path: incoming.url,
      headers: { ...incoming.headers, host: `${host}:${apiPort}` },
    }, (response) => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(outgoing);
    });
    proxied.on("error", (error) => {
      outgoing.writeHead(502, { "content-type": "application/json" });
      outgoing.end(JSON.stringify({ error: `Isolated API unavailable: ${error.message}` }));
    });
    incoming.pipe(proxied);
    return;
  }

  const file = staticPath(incoming.url ?? "/");
  outgoing.writeHead(200, {
    "cache-control": "no-store",
    "content-type": types.get(extname(file)) ?? "application/octet-stream",
  });
  createReadStream(file).pipe(outgoing);
}).listen(port, host);