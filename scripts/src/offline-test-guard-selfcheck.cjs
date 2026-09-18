"use strict";

const assert = require("node:assert/strict");
const net = require("node:net");

assert.equal(process.env.E1_OFFLINE_GUARD_ACTIVE, "1");

function assertDenied(action) {
  assert.throws(action, (error) => error && error.code === "E1_OFFLINE_NETWORK_DISABLED");
}

assertDenied(() => new net.Socket().connect(1, "127.0.0.1"));
assertDenied(() => fetch("http://127.0.0.1:1/"));

process.stdout.write("E1_OFFLINE_GUARD_ACTIVE=1 network-denial-selfcheck=PASS\n");