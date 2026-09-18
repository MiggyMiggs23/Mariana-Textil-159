"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const net = require("node:net");

assert.equal(process.env.E1_OFFLINE_STATIC_FIXTURE, "1");

function assertDenied(action) {
  assert.throws(action, (error) => error?.code === "E1_OFFLINE_NETWORK_DISABLED");
}

assertDenied(() => net.connect(5432, "127.0.0.1"));
assertDenied(() => net.connect(8080, "127.0.0.1"));
assertDenied(() => net.connect("/tmp/e1-forbidden.sock"));
assertDenied(() => http.get("http://127.0.0.1:8080/"));

const server = http.createServer((request, response) => {
  if (request.url !== "/fixture.txt") {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { "content-type": "text/plain" });
  response.end("static-fixture-ok");
});

server.listen(0, "127.0.0.1", async () => {
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const body = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${address.port}/fixture.txt`, (response) => {
        let text = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => { text += chunk; });
        response.on("end", () => resolve(text));
      }).once("error", reject);
    });
    assert.equal(body, "static-fixture-ok");
    process.stdout.write(
      "E1_STATIC_FIXTURE_GUARD=PASS blocked=5432,8080,unix allowed=ephemeral-loopback\n",
    );
  } finally {
    server.closeAllConnections();
    server.close();
  }
});