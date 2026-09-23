import {
  assertActorSuiteEnvironmentSync,
  restoreActorControlDatabaseUrlSync,
} from "./actor-suite-preflight.mjs";

// This synchronous gate runs before importing pg, tsx, application code, actors,
// or sessions. Never replace it with an async check hidden behind app imports.
restoreActorControlDatabaseUrlSync(process.env);
assertActorSuiteEnvironmentSync(process.env);

const { default: pg } = await import("pg");
const queryIdentity = async (connectionString) => {
  const pool = new pg.Pool({ connectionString, max: 1 });
  try {
    const result = await pool.query(`
      SELECT current_database() AS database,
             (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS database_oid,
             current_user AS "user",
             current_setting('data_directory') AS data_directory,
             current_setting('port') AS port,
             current_setting('unix_socket_directories') AS unix_socket_directories,
             current_setting('listen_addresses') AS listen_addresses
    `);
    return result.rows[0];
  } finally {
    await pool.end();
  }
};
const [target, control] = await Promise.all([
  queryIdentity(process.env.TEST_DATABASE_URL),
  queryIdentity(process.env.DATABASE_URL),
]);
const sockets = String(target?.unix_socket_directories ?? "").split(",").map(value => value.trim());
const controlSockets = String(control?.unix_socket_directories ?? "")
  .split(",").map(value => value.trim());
if (target?.database !== process.env.ACTOR_SUITE_EXPECTED_TEST_DATABASE ||
    control?.database !== process.env.ACTOR_SUITE_EXPECTED_CONTROL_DATABASE ||
    target?.database === control?.database ||
    target?.database_oid !== process.env.ACTOR_SUITE_EXPECTED_DATABASE_OID ||
    control?.database_oid !== process.env.ACTOR_SUITE_EXPECTED_CONTROL_DATABASE_OID ||
    target?.database_oid === control?.database_oid ||
    target?.user !== process.env.ACTOR_SUITE_EXPECTED_USER ||
    control?.user !== process.env.ACTOR_SUITE_EXPECTED_USER ||
    target?.data_directory !== process.env.ACTOR_SUITE_EXPECTED_DATA_DIRECTORY ||
    control?.data_directory !== process.env.ACTOR_SUITE_EXPECTED_DATA_DIRECTORY ||
    target?.port !== process.env.ACTOR_SUITE_EXPECTED_PORT ||
    control?.port !== process.env.ACTOR_SUITE_EXPECTED_PORT ||
    !sockets.includes(process.env.ACTOR_SUITE_EXPECTED_SOCKET_DIRECTORY) ||
    !controlSockets.includes(process.env.ACTOR_SUITE_EXPECTED_SOCKET_DIRECTORY) ||
    String(target?.listen_addresses ?? "").trim() !== "" ||
    String(control?.listen_addresses ?? "").trim() !== "") {
  throw new Error("La identidad efectiva no pertenece al target actor local firmado.");
}
process.env.ACTOR_SUITE_IDENTITY_VERIFIED = "1";

// Register the TypeScript loader only after both real database identities pass.
const { pathToFileURL } = await import("node:url");
await import(pathToFileURL(process.env.ACTOR_SUITE_TSX_LOADER).href);