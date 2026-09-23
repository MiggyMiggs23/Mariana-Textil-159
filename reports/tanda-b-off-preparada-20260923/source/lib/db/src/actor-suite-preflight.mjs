const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);
const REQUIRED_IDENTITY = [
  "ACTOR_SUITE_RUN_ID",
  "ACTOR_SUITE_EXPECTED_TEST_DATABASE",
  "ACTOR_SUITE_EXPECTED_CONTROL_DATABASE",
  "ACTOR_SUITE_EXPECTED_DATABASE_OID",
  "ACTOR_SUITE_EXPECTED_CONTROL_DATABASE_OID",
  "ACTOR_SUITE_EXPECTED_USER",
  "ACTOR_SUITE_EXPECTED_DATA_DIRECTORY",
  "ACTOR_SUITE_EXPECTED_PORT",
  "ACTOR_SUITE_EXPECTED_SOCKET_DIRECTORY",
  "ACTOR_SUITE_SELECTION_SHA256",
  "ACTOR_SUITE_TSX_LOADER",
];

function explicitPostgresUrl(environment, name) {
  const raw = environment[name];
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error(`${name} debe ser una URL PostgreSQL local explícita.`);
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${name} debe ser una URL PostgreSQL válida.`);
  }
  if (!POSTGRES_PROTOCOLS.has(parsed.protocol) || !parsed.hostname ||
      !parsed.pathname || parsed.pathname === "/" || !parsed.username ||
      !parsed.password || !parsed.searchParams.get("port")) {
    throw new Error(`${name} no contiene la identidad PostgreSQL local completa.`);
  }
  return parsed;
}

export function restoreActorControlDatabaseUrlSync(environment = process.env) {
  const stableControl = explicitPostgresUrl(
    environment,
    "APPLICATION_DATABASE_URL",
  );
  environment.DATABASE_URL = stableControl.href;
  return stableControl;
}

export function assertActorSuiteEnvironmentSync(environment = process.env) {
  if (environment.NODE_ENV !== "test" ||
      environment.REQUIRE_ISOLATED_TEST_DATABASE !== "1" ||
      environment.ACTOR_SUITE_RUNNER !== "1") {
    throw new Error("El proceso actor no fue habilitado por el runner aislado.");
  }
  for (const name of REQUIRED_IDENTITY) {
    if (typeof environment[name] !== "string" || environment[name].trim() === "") {
      throw new Error(`Falta identidad actor obligatoria: ${name}.`);
    }
  }
  if (!/^\d+$/.test(environment.ACTOR_SUITE_EXPECTED_DATABASE_OID) ||
      !/^\d+$/.test(environment.ACTOR_SUITE_EXPECTED_CONTROL_DATABASE_OID) ||
      !/^\d+$/.test(environment.ACTOR_SUITE_EXPECTED_PORT) ||
      !/^[a-f0-9]{64}$/.test(environment.ACTOR_SUITE_SELECTION_SHA256)) {
    throw new Error("La identidad actor contiene OID, puerto o hash inválido.");
  }
  if (!environment.ACTOR_SUITE_TSX_LOADER.endsWith("/tsx/dist/loader.mjs")) {
    throw new Error("El loader TypeScript actor no es el loader ESM explícito de tsx.");
  }
  const target = explicitPostgresUrl(environment, "TEST_DATABASE_URL");
  const control = explicitPostgresUrl(environment, "DATABASE_URL");
  const stableControl = explicitPostgresUrl(
    environment,
    "APPLICATION_DATABASE_URL",
  );
  if (stableControl.href !== control.href) {
    throw new Error("DATABASE_URL no coincide con el control actor estable firmado.");
  }
  if (target.href === control.href || target.pathname === control.pathname) {
    throw new Error("TEST_DATABASE_URL y DATABASE_URL deben identificar bases locales distintas.");
  }
  const socket = environment.ACTOR_SUITE_EXPECTED_SOCKET_DIRECTORY;
  if (decodeURIComponent(target.hostname) !== socket ||
      decodeURIComponent(control.hostname) !== socket ||
      target.searchParams.get("port") !== environment.ACTOR_SUITE_EXPECTED_PORT ||
      control.searchParams.get("port") !== environment.ACTOR_SUITE_EXPECTED_PORT ||
      decodeURIComponent(target.pathname.slice(1)) !== environment.ACTOR_SUITE_EXPECTED_TEST_DATABASE ||
      decodeURIComponent(control.pathname.slice(1)) !== environment.ACTOR_SUITE_EXPECTED_CONTROL_DATABASE ||
      decodeURIComponent(target.username) !== environment.ACTOR_SUITE_EXPECTED_USER ||
      decodeURIComponent(control.username) !== environment.ACTOR_SUITE_EXPECTED_USER) {
    throw new Error("Las URLs actor no coinciden con la identidad local firmada por el runner.");
  }
  return Object.freeze({
    runId: environment.ACTOR_SUITE_RUN_ID,
    targetDatabase: environment.ACTOR_SUITE_EXPECTED_TEST_DATABASE,
    controlDatabase: environment.ACTOR_SUITE_EXPECTED_CONTROL_DATABASE,
    selectionSha256: environment.ACTOR_SUITE_SELECTION_SHA256,
  });
}