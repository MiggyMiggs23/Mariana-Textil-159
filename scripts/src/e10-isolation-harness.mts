/**
 * Guarded E10 harness connection helper. No connection or side effect on import.
 * Destination input is rejected against the immutable allowlist before connect.
 */
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pg = require("../../lib/db/node_modules/pg") as typeof import("pg");
const READY_MANIFEST = "/home/runner/workspace/reports/e10-aislado-2026-09-18/aislamiento.json";
export const E10_TARGET = Object.freeze({
  host: "/tmp/e10-0918-pg",
  port: 55432,
  database: "e10_ensayo_20260918",
  user: "postgres",
  dataDirectory: "/home/runner/workspace/.local/backups/e10-20260918-isolated/cluster",
  systemIdentifier: "7686927739928200230",
});
export type E10Destination = {
  host: string;
  port: number;
  database: string;
  user: string;
};

export function assertE10DestinationBeforeConnect(destination: E10Destination): void {
  assert.deepEqual(destination, {
    host: E10_TARGET.host, port: E10_TARGET.port, database: E10_TARGET.database, user: E10_TARGET.user,
  }, "REFUSED BEFORE CONNECT: destination is not the exact E10 isolated allowlist");
  assert.match(destination.host, /^\/tmp\/e10-0918-pg$/, "REFUSED BEFORE CONNECT: Unix socket required");
  assert.notEqual(destination.database, "heliumdb", "REFUSED BEFORE CONNECT: operational database");
}

export async function connectExactE10(destination: E10Destination = {
  host: E10_TARGET.host, port: E10_TARGET.port, database: E10_TARGET.database, user: E10_TARGET.user,
}) {
  assertE10DestinationBeforeConnect(destination);
  const manifest = JSON.parse(await fs.readFile(READY_MANIFEST, "utf8")) as {
    status?: unknown;
    verification?: { status?: unknown };
    target?: {
      socketDirectory?: unknown; port?: unknown; database?: unknown; role?: unknown;
      dataDirectory?: unknown; systemIdentifier?: unknown; listenAddresses?: unknown;
      backendNetworkAddress?: unknown;
    };
  };
  assert.equal(manifest.status, "READY", "REFUSED BEFORE CONNECT: E10 manifest is not READY");
  assert.equal(manifest.verification?.status, "PASS",
    "REFUSED BEFORE CONNECT: E10 semantic verification is not PASS");
  assert.deepEqual(manifest.target, {
    socketDirectory: E10_TARGET.host,
    port: E10_TARGET.port,
    database: E10_TARGET.database,
    dataDirectory: E10_TARGET.dataDirectory,
    systemIdentifier: E10_TARGET.systemIdentifier,
    role: E10_TARGET.user,
    listenAddresses: "",
    backendNetworkAddress: null,
  }, "REFUSED BEFORE CONNECT: manifest target differs from exact E10 allowlist");
  const socket = await fs.realpath(destination.host);
  assert.equal(socket, E10_TARGET.host, "REFUSED BEFORE CONNECT: socket symlink/redirect");
  const client = new pg.Client({
    host: destination.host, port: destination.port, database: destination.database, user: destination.user,
    ssl: false, password: async () => { throw new Error("REFUSED: isolated Unix socket requested credentials"); },
    options: "-c search_path=pg_catalog,public -c timezone=UTC",
    application_name: "e10-exact-isolated-harness", connectionTimeoutMillis: 5000,
    statement_timeout: 15000, query_timeout: 20000,
  });
  try {
    await client.connect();
    const { rows: [identity] } = await client.query(`SELECT current_database() database,current_user role,
      current_setting('data_directory') data_directory,current_setting('unix_socket_directories') socket,
      current_setting('port') port,current_setting('listen_addresses') listen,
      inet_server_addr()::text address,inet_server_port() server_port,
      (SELECT system_identifier::text FROM pg_control_system()) system_identifier`);
    assert.equal(identity.database, E10_TARGET.database);
    assert.equal(identity.role, E10_TARGET.user);
    assert.equal(await fs.realpath(identity.data_directory), E10_TARGET.dataDirectory);
    assert.equal(identity.socket, E10_TARGET.host);
    assert.equal(identity.port, String(E10_TARGET.port));
    assert.equal(identity.listen, "");
    assert.equal(identity.address, null);
    assert.equal(identity.server_port, null);
    assert.equal(identity.system_identifier, E10_TARGET.systemIdentifier);
    return client;
  } catch (error) {
    await client.end().catch(() => undefined);
    throw error;
  }
}

/** Pure negative probes: all must reject before any pg.Client is constructed. */
export function e10DestinationRejectionProof(): { status: "PASS"; cases: string[] } {
  const cases: [string, E10Destination][] = [
    ["wrongDB", { ...E10_TARGET, database: "heliumdb" }],
    ["wrongSocket", { ...E10_TARGET, host: "/tmp/not-e10" }],
    ["networkHost", { ...E10_TARGET, host: "127.0.0.1" }],
  ];
  for (const [name, target] of cases) {
    assert.throws(() => assertE10DestinationBeforeConnect(target), /REFUSED BEFORE CONNECT/);
    void name;
  }
  return { status: "PASS", cases: cases.map(([name]) => name) };
}