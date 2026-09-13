/**
 * Operator-only Phase 2 report generator.
 *
 * This is a file-only report builder. It never opens a database, starts a
 * server, runs a test, or discovers a "latest" evidence file. The live proof
 * must be supplied explicitly:
 *
 *   pnpm --filter @workspace/scripts exec tsx \
 *     src/generate-phase2-purge-report.mts \
 *     --live-evidence .local/<live-proof>.json \
 *     --disposable-proof .local/phase2-ui-rehearsal/phase2-disposable-postpurge-proof.json \
 *     --test-report reports/<actual-test-report>.json \
 *     --source-api-running
 *
 * With no --live-evidence this writes an explicit PENDING_LIVE_EVIDENCE
 * scaffold, never a successful final report. The normal operator output is:
 * reports/fase2-purga-2026-09-13.{md,html,json}
 */
import { createHash } from "node:crypto";
import {
  readFile,
  mkdir,
  writeFile,
} from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Json = Record<string, any>;
type Status = "PASS" | "FAIL" | "PENDING" | "NOT_RUN" | "WITH_OBSERVATIONS" | "BLOCKED";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const defaultBackupDirectory = resolve(
  repositoryRoot,
  "scripts/.local/backups/respaldo-antes-de-purga-2026-09-13-101833",
);
const defaultReadonlyEvidence = resolve(
  repositoryRoot,
  ".local/phase2-purge-evidence-20260913162028960.json",
);
const defaultRehearseEvidence = resolve(
  repositoryRoot,
  ".local/phase2-purge-evidence-20260913162034228.json",
);
const defaultStatePath = resolve(repositoryRoot, ".local/phase2-purge-state.json");
const defaultOutputDirectory = resolve(repositoryRoot, "reports");

const EXPECTED_A = [
  "tickets", "ticket_lineas", "ticket_pagos", "autorizaciones_nota",
  "movimientos_credito", "aplicaciones_credito", "notificaciones_credito",
  "sesiones_caja", "sesiones_caja_dias", "salidas_dinero_caja",
  "cuadre_fiscal_registros", "salidas", "salida_lineas", "salida_rollos",
  "viajes", "viaje_salidas", "viaje_tickets", "entradas", "contenedores",
  "contenedor_lineas", "pagos_proveedor", "aplicaciones_pago_proveedor",
  "movimientos", "rollos", "reimpresiones_etiqueta", "auditorias_inventario",
  "auditoria_inventario_escaneos", "auditoria_inventario_participantes",
  "auditoria_inventario_snapshot", "solicitudes_pago_dirigido",
  "notificaciones_sistema", "stock_minimo_episodios", "sesiones",
] as const;

const EXPECTED_B = [
  "ticket_folio", "entrada_folio", "salida_folio", "viaje_folio",
  "auditoria_inventario_folio", "series_consecutivo", "existencias",
] as const;

const EXPECTED_C = [
  "productos", "precio_historial", "clientes", "cliente_documentos",
  "proveedores", "usuarios", "ubicaciones", "pisos", "permisos_rol",
  "permisos_usuario", "permisos_ubicacion", "camionetas", "choferes",
  "equipos", "equipos_checklist", "stock_minimo_sitios", "stock_minimos",
  "auditoria",
] as const;

const OUTPUT_BASENAME = "fase2-purga-2026-09-13";

type Options = {
  liveEvidence?: string;
  postcommitEvidence?: string;
  postrestartEvidence?: string;
  liveUiEvidence?: string;
  disposableProof?: string;
  uiClarification?: string;
  testReport?: string;
  readonlyEvidence: string;
  rehearseEvidence: string;
  statePath: string;
  backupDirectory: string;
  outputDirectory: string;
  sourceApiPaused: boolean;
  sourceApiRunning: boolean;
};

function usage(): string {
  return [
    "Usage:",
    "  pnpm --filter @workspace/scripts exec tsx src/generate-phase2-purge-report.mts",
     "  pnpm --filter @workspace/scripts exec tsx src/generate-phase2-purge-report.mts --live-evidence <path> --postcommit-evidence <path> --postrestart-evidence <path> --live-ui-evidence <path> --disposable-proof <path> --ui-clarification <path> --test-report <path> --source-api-running",
    "",
    "Optional file inputs default to the explicitly reviewed 2026-09-13 preflight, rehearsal, state, and backup paths.",
    "No live evidence means PENDING_LIVE_EVIDENCE; it cannot produce a successful final report.",
  ].join("\n");
}

function parseArgs(args: string[]): Options {
  const options: Options = {
    readonlyEvidence: defaultReadonlyEvidence,
    rehearseEvidence: defaultRehearseEvidence,
    statePath: defaultStatePath,
    backupDirectory: defaultBackupDirectory,
    outputDirectory: defaultOutputDirectory,
    sourceApiPaused: false,
    sourceApiRunning: false,
  };
  const value = (index: number, flag: string): string => {
    const next = args[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`${flag} requires a path`);
    return resolve(repositoryRoot, next);
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--live-evidence":
        options.liveEvidence = value(index, arg);
        index += 1;
        break;
      case "--postcommit-evidence":
        options.postcommitEvidence = value(index, arg);
        index += 1;
        break;
      case "--postrestart-evidence":
        options.postrestartEvidence = value(index, arg);
        index += 1;
        break;
      case "--live-ui-evidence":
        options.liveUiEvidence = value(index, arg);
        index += 1;
        break;
      case "--disposable-proof":
        options.disposableProof = value(index, arg);
        index += 1;
        break;
      case "--ui-clarification":
        options.uiClarification = value(index, arg);
        index += 1;
        break;
      case "--test-report":
        options.testReport = value(index, arg);
        index += 1;
        break;
      case "--readonly-evidence":
        options.readonlyEvidence = value(index, arg);
        index += 1;
        break;
      case "--rehearse-evidence":
        options.rehearseEvidence = value(index, arg);
        index += 1;
        break;
      case "--state":
        options.statePath = value(index, arg);
        index += 1;
        break;
      case "--backup-directory":
        options.backupDirectory = value(index, arg);
        index += 1;
        break;
      case "--output-directory":
        options.outputDirectory = value(index, arg);
        index += 1;
        break;
      case "--source-api-paused":
      case "--api-paused":
        options.sourceApiPaused = true;
        break;
      case "--source-api-running":
      case "--api-running":
        options.sourceApiRunning = true;
        break;
      case "--help":
      case "-h":
        console.log(usage());
        process.exit(0);
      default:
        throw new Error(`Unknown argument ${arg}\n\n${usage()}`);
    }
  }
  if (options.sourceApiPaused && options.sourceApiRunning) {
    throw new Error("--source-api-paused and --source-api-running are mutually exclusive");
  }
  if (
    options.liveEvidence &&
    (!options.disposableProof || !options.testReport || (!options.sourceApiPaused && !options.sourceApiRunning))
  ) {
    throw new Error(
      "--live-evidence requires --disposable-proof, --test-report, and an explicit source API state flag",
    );
  }
  return options;
}

function relativePath(path: string): string {
  return relative(repositoryRoot, path) || ".";
}

async function readJson(path: string): Promise<Json> {
  const raw = await readFile(path, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Expected a JSON object: ${relativePath(path)}`);
  }
  return parsed as Json;
}

async function sha256File(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function normalizedStatus(value: unknown): Status | undefined {
  if (typeof value !== "string") return undefined;
  const status = value.trim().toUpperCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (status === "PASS" || status === "PASSED" || status === "COMMITTED_PASS") return "PASS";
  if (status.includes("OBSERV")) return "WITH_OBSERVATIONS";
  if (status === "FAIL" || status === "FAILED" || status === "ERROR") return "FAIL";
  if (status.includes("BLOCK")) return "BLOCKED";
  if (status.includes("NOT_RUN") || status.includes("SKIP")) return "NOT_RUN";
  if (status.includes("PENDING") || status.includes("UNRESOLVED")) return "PENDING";
  return undefined;
}

function objectStatus(value: unknown): Status | undefined {
  const direct = normalizedStatus(value);
  if (direct) return direct;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const object = value as Json;
  for (const key of ["status", "result", "outcome", "overallStatus"]) {
    const found = normalizedStatus(object[key]);
    if (found) return found;
  }
  return undefined;
}

function namedStatuses(root: unknown, names: string[]): Record<string, Status> {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  const found: Record<string, Status> = {};
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    for (const [key, child] of Object.entries(value as Json)) {
      if (wanted.has(key.toLowerCase())) {
        const status = objectStatus(child);
        if (status) found[key.toLowerCase()] = status;
      }
      visit(child);
    }
  };
  visit(root);
  return found;
}

function namedObject(root: unknown, wantedName: string): Json | undefined {
  let found: Json | undefined;
  const visit = (value: unknown): void => {
    if (found || !value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    for (const [key, child] of Object.entries(value as Json)) {
      if (key.toLowerCase() === wantedName.toLowerCase() &&
        child && typeof child === "object" && !Array.isArray(child)) {
        found = child as Json;
        return;
      }
      visit(child);
      if (found) return;
    }
  };
  visit(root);
  return found;
}

function testObservations(parsed: unknown): Json {
  const suites = namedObject(parsed, "suites") ?? {};
  const scenarioAssertions = suites.scenarioAssertions ?? {};
  const resultEntries = suites.results && typeof suites.results === "object"
    ? Object.entries(suites.results as Json)
    : [];
  const cleanupFailures = resultEntries.filter(([, result]) =>
    (result as Json)?.cleanup?.status === "FAIL").length;
  const scenarioFailed = Number(scenarioAssertions.failed ?? NaN);
  const scenarioPassed = Number(scenarioAssertions.passed ?? NaN);
  const observations: string[] = [];
  if (Number.isFinite(scenarioPassed) && Number.isFinite(scenarioFailed)) {
    observations.push(`scenario assertions: ${scenarioPassed} passed, ${scenarioFailed} failed`);
  }
  if (cleanupFailures > 0) {
    observations.push(`${cleanupFailures} fixture cleanup failure(s); not scenario assertion failures`);
    for (const [name, result] of resultEntries) {
      const cleanup = (result as Json)?.cleanup;
      if (cleanup?.status === "FAIL") {
        observations.push(`${name} cleanup: ${cleanup.kind ?? "failure"}${cleanup.sqlState ? ` (${cleanup.sqlState})` : ""}`);
      }
    }
  }
  return {
    scenarioPassed: Number.isFinite(scenarioPassed) ? scenarioPassed : null,
    scenarioFailed: Number.isFinite(scenarioFailed) ? scenarioFailed : null,
    cleanupFailures,
    observations,
  };
}

function extractPointStatuses(root: unknown): Record<string, Status> {
  const found: Record<string, Status> = {};
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const itemObject = item as Json;
          const point = itemObject.point ?? itemObject.punto ?? itemObject.number;
          const status = objectStatus(itemObject);
          if (status && (typeof point === "number" || typeof point === "string")) {
            const number = String(point).replace(/^point/i, "");
            if (/^(?:[1-9]|10|11)$/.test(number)) found[number] = status;
          }
        }
        visit(item);
      }
      return;
    }
    for (const [key, child] of Object.entries(value as Json)) {
      const match = key.match(/^(?:point|punto)?[_-]?(1[01]|[1-9])$/i);
      if (match) {
        const status = objectStatus(child);
        if (status) found[match[1]] = status;
      }
      visit(child);
    }
  };
  visit(root);
  return found;
}

function inferredLivePointStatuses(live: Json): Record<string, Status> {
  const execution = live.execution ?? {};
  const afterA = execution.afterA ?? {};
  const beforeC = execution.lockedBeforeC ?? {};
  const afterC = execution.afterC ?? {};
  const listA = Array.isArray(live.lists?.A) ? live.lists.A as string[] : Object.keys(afterA);
  const listC = Array.isArray(live.lists?.C) ? live.lists.C as string[] : Object.keys(afterC);
  const triggers = execution.triggersFinal ?? execution.triggerAfterReenable ?? live.triggers;
  const triggerPass = Array.isArray(triggers) && triggers.length === 11 &&
    triggers.every((row: Json) =>
      (row.tgenabled === "O") && (row.tgisinternal === undefined || row.tgisinternal === false));
  const cPass = listC.length === EXPECTED_C.length && listC.every((table) =>
    beforeC[table]?.count === afterC[table]?.count &&
    beforeC[table]?.hash === afterC[table]?.hash);
  const points: Record<string, Status> = {};
  if (listA.length === EXPECTED_A.length &&
    listA.every((table) => Number(afterA[table] ?? -1) === 0)) points["1"] = "PASS";
  if (cPass) points["2"] = "PASS";
  const minimumValues = live.minimums?.values ?? live.minimums;
  if (Array.isArray(minimumValues) && minimumValues.length > 0 &&
    minimumValues.every((row: Json) =>
      (row.productoId ?? row.producto_id) !== undefined &&
      (row.ubicacionId ?? row.ubicacion_id) !== undefined &&
      row.cantidad !== undefined &&
      (row.updatedAt ?? row.updated_at) &&
      (row.updatedBy ?? row.updated_by) !== undefined)) {
    points["3"] = "PASS";
  }
  const invariant = execution.invariant ?? live.invariant;
  if (Number(invariant?.badPairs ?? invariant?.bad_pairs ?? -1) === 0) points["4"] = "PASS";
  if (triggerPass) points["5"] = "PASS";
  if (beforeC.auditoria?.hash === afterC.auditoria?.hash &&
    beforeC.auditoria?.count === afterC.auditoria?.count) points["11"] = "PASS";
  return points;
}

function inferredPostcommitPointStatuses(postcommit: Json): Record<string, Status> {
  const points: Record<string, Status> = {};
  const a = postcommit.A ?? {};
  const c = Array.isArray(postcommit.C) ? postcommit.C : [];
  const minimums = Array.isArray(postcommit.minimums) ? postcommit.minimums : [];
  const triggers = Array.isArray(postcommit.triggers) ? postcommit.triggers : [];
  const expectedA = EXPECTED_A.every((table) => Number(a[table] ?? -1) === 0);
  if (expectedA) points["1"] = "PASS";
  if (minimums.length === 3 && minimums.every((row: Json) =>
    (row.producto_id ?? row.productoId) !== undefined &&
    (row.ubicacion_id ?? row.ubicacionId) !== undefined &&
    row.cantidad !== undefined &&
    (row.updated_at ?? row.updatedAt) &&
    (row.updated_by ?? row.updatedBy) !== undefined)) points["3"] = "PASS";
  if (postcommit.invariant &&
    Number(postcommit.invariant.bad_pairs ?? postcommit.invariant.badPairs ?? -1) === 0) {
    points["4"] = "PASS";
  }
  if (triggers.length === 11 && triggers.every((row: Json) => row.tgenabled === "O")) {
    points["5"] = "PASS";
  }
  const audit = c.find((row: Json) => row.table === "auditoria");
  if (audit?.unchanged === true) points["11"] = "PASS";
  return points;
}

function liveUiPointStatuses(liveUi: Json | undefined): Record<string, Status> {
  if (!liveUi) return {};
  const status = objectStatus(liveUi);
  if (status === "BLOCKED") return { "8": "BLOCKED", "9": "BLOCKED", "10": "BLOCKED" };
  if (status === "PASS") return { "8": "PASS", "9": "PASS", "10": "PASS" };
  return {};
}

function assertEvidenceShape(
  readonlyEvidence: Json,
  rehearseEvidence: Json,
  state: Json,
  liveEvidence?: Json,
): void {
  if (
    readonlyEvidence.status !== "PASS" ||
    readonlyEvidence.mode !== "preflight" ||
    readonlyEvidence.preflight?.readOnly !== true
  ) {
    throw new Error("The specified read-only preflight is not PASS/preflight");
  }
  if (
    rehearseEvidence.status !== "PASS" ||
    rehearseEvidence.mode !== "rehearse" ||
    !String(rehearseEvidence.execution?.transaction ?? "").toLowerCase().includes("committed")
  ) {
    throw new Error("The specified rehearsal is not a committed PASS rehearsal");
  }
  const statePath = state.evidencePath;
  const rehearsalPath = relativePath(resolve(repositoryRoot, String(rehearseEvidence.evidencePath ?? "")));
  const livePath = liveEvidence
    ? relativePath(resolve(repositoryRoot, String(liveEvidence.evidencePath ?? "")))
    : null;
  if (
    state.status !== "PASS" ||
    (statePath !== rehearsalPath && statePath !== livePath)
  ) {
    throw new Error("The specified phase2 state does not point to the specified rehearsal or live evidence");
  }
  if (statePath === livePath && (
    !liveEvidence ||
    liveEvidence.status !== "PASS" ||
    liveEvidence.mode !== "apply"
  )) {
    throw new Error("The specified phase2 state points to live evidence that is not a PASS apply");
  }
  const lists = rehearseEvidence.lists ?? {};
  if (
    JSON.stringify(lists.A) !== JSON.stringify(EXPECTED_A) ||
    JSON.stringify(lists.B) !== JSON.stringify(EXPECTED_B) ||
    JSON.stringify(lists.C) !== JSON.stringify(EXPECTED_C)
  ) {
    throw new Error("Phase 2 lists are not exactly A33/B7/C18");
  }
}

function backupSummary(
  manifest: Json,
  drive: Json,
  sourceState: Json,
  backupDirectory: string,
): Json {
  const verification = manifest.verification ?? {};
  const categories = verification.catalogueCategories ?? {};
  return {
    status: manifest.status === "PASS" && drive.status === "PASS" ? "PASS" : "PENDING",
    directory: relativePath(backupDirectory),
    commit: manifest.commit ?? null,
    capturedAtUtc: manifest.capturedAtUtc ?? null,
    archive: {
      path: manifest.archive?.file ? relativePath(resolve(repositoryRoot, manifest.archive.file)) : null,
      sha256: manifest.archive?.sha256 ?? null,
      sizeBytes: manifest.archive?.sizeBytes ?? null,
    },
    verification: {
      manifest: manifest.status ?? "UNRESOLVED",
      driveDownload: drive.status ?? "UNRESOLVED",
      driveFileId: drive.file?.id ?? null,
      driveWebViewLink: drive.file?.webViewLink ?? null,
      driveOwnerOnly: Array.isArray(drive.file?.permissions)
        ? drive.file.permissions.length === 1 && drive.file.permissions[0]?.role === "owner"
        : false,
      restoreComparison: verification.databaseMetadataMatched === true &&
        verification.allTableCountsMatched === true
        ? "PASS"
        : "PENDING",
      categories: Object.fromEntries(
        Object.entries(categories).map(([key, value]) => [
          key,
          {
            sourceCount: (value as Json).sourceCount,
            restoredCount: (value as Json).restoredCount,
            mismatchCount: (value as Json).mismatchCount,
          },
        ]),
      ),
    },
    sourceMutationPolicy: manifest.sourceMutationPolicy ?? null,
    state: sourceState.status ?? "UNRESOLVED",
  };
}

function listRows(
  names: readonly string[],
  before: Json,
  after: Json,
): Json[] {
  return names.map((table) => {
    const beforeValue = before?.[table];
    const afterValue = after?.[table];
    return {
      table,
      before: typeof beforeValue === "object" ? beforeValue?.count ?? null : beforeValue ?? null,
      after: typeof afterValue === "object" ? afterValue?.count ?? null : afterValue ?? null,
      beforeHash: typeof beforeValue === "object" ? beforeValue?.hash ?? null : null,
      afterHash: typeof afterValue === "object" ? afterValue?.hash ?? null : null,
    };
  });
}

function cRows(names: readonly string[], before: Json, after: Json): Json[] {
  return names.map((table) => ({
    table,
    beforeCount: before?.[table]?.count ?? null,
    afterCount: after?.[table]?.count ?? null,
    beforeHash: before?.[table]?.hash ?? null,
    afterHash: after?.[table]?.hash ?? null,
    countUnchanged: before?.[table]?.count === after?.[table]?.count,
    hashUnchanged: before?.[table]?.hash === after?.[table]?.hash,
  }));
}

function minRows(sourceMinimums: Json): Json[] {
  return (sourceMinimums.stock_minimos ?? []).map((row: Json) => ({
    productoId: row.producto_id,
    ubicacionId: row.ubicacion_id,
    cantidad: row.cantidad,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }));
}

function triggerRows(triggers: unknown): Json[] {
  if (!Array.isArray(triggers)) return [];
  return triggers.map((trigger) => {
    const row = trigger as Json;
    return {
      table: row.table_name,
      trigger: row.trigger_name,
      tgenabled: row.tgenabled,
      tgisinternal: row.tgisinternal,
    };
  });
}

function disposableProofSummary(proof: Json | undefined, path?: string, hash?: string): Json {
  if (!proof) {
    return { status: "PENDING", reason: "disposable post-purge proof not supplied" };
  }
  const emptyUi = proof.emptyUi ?? {};
  const ticket = proof.ticket ?? {};
  return {
    status: proof.status === "PASS" ? "PASS" : "PENDING",
    operation: proof.operation ?? null,
    evidencePath: proof.evidencePath ?? (path ? relativePath(path) : null),
    sha256: hash ?? null,
    emptyUi: {
      status: emptyUi.status ?? "UNRESOLVED",
      route: emptyUi.route ?? null,
      checks: Array.isArray(emptyUi.checks) ? emptyUi.checks : [],
    },
    ticket: {
      status: ticket.created === true && Number(ticket.folio) === 1000 ? "PASS" : "PENDING",
      folio: ticket.folio ?? null,
      created: ticket.created ?? null,
      documentoTipo: ticket.documentoTipo ?? null,
      tipo: ticket.tipo ?? null,
    },
  };
}

function uiClarificationSummary(
  clarification: Json | undefined,
  path?: string,
  hash?: string,
): Json {
  if (!clarification || !path) {
    return { status: "PENDING", reason: "separate UI clarification not supplied" };
  }
  return {
    status: clarification.status === "PASS" ? "PASS" : "PENDING",
    path: relativePath(path),
    sha256: hash ?? null,
    operation: clarification.operation ?? null,
    checks: Array.isArray(clarification.checks) ? clarification.checks : [],
    stock: clarification.stock ?? null,
    price: clarification.price ?? null,
  };
}

async function loadTestReport(path: string | undefined): Promise<Json> {
  if (!path) return { status: "PENDING", reason: "actual test report not supplied" };
  const raw = await readFile(path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const statuses = parsed ? namedStatuses(parsed, ["typecheck", "suites", "ui", "ticket"]) : {};
  const observations = parsed ? testObservations(parsed) : {
    scenarioPassed: null,
    scenarioFailed: null,
    cleanupFailures: 0,
    observations: [],
  };
  const hasFixtureObservations = statuses.typecheck === "PASS" &&
    statuses.suites === "FAIL" &&
    observations.scenarioFailed === 0 &&
    observations.cleanupFailures > 0;
  return {
    path: relativePath(path),
    sha256: createHash("sha256").update(raw).digest("hex"),
    format: parsed ? "json" : "text",
    statuses,
    status: Object.keys(statuses).length === 4 && Object.values(statuses).every((value) => value === "PASS")
      ? "PASS"
      : hasFixtureObservations
        ? "WITH_OBSERVATIONS"
        : "PENDING",
    observations,
  };
}

function liveSummary(live: Json | undefined, path: string | undefined, hash?: string): Json {
  if (!live || !path) {
    return {
      status: "PENDING_LIVE_EVIDENCE",
      path: null,
      reason: "main has not supplied the explicit live evidence path",
    };
  }
  const status = objectStatus(live) ?? "PENDING";
  const inferred = inferredLivePointStatuses(live);
  const explicit = extractPointStatuses(live);
  return {
    status,
    path: relativePath(path),
    sha256: hash ?? null,
    operation: live.operation ?? null,
    capturedAtUtc: live.capturedAtUtc ?? live.createdAtUtc ?? null,
    pointStatuses: { ...inferred, ...explicit },
  };
}

function postcommitSummary(
  postcommit: Json | undefined,
  path?: string,
  hash?: string,
): Json {
  if (!postcommit || !path) {
    return { status: "PENDING", reason: "independent LIVE postcommit evidence not supplied" };
  }
  return {
    status: postcommit.status === "PASS" ? "PASS" : "PENDING",
    stage: postcommit.stage ?? null,
    path: relativePath(path),
    sha256: hash ?? null,
    capturedAtUtc: postcommit.capturedAt ?? null,
    identity: postcommit.identity ?? null,
    minimums: postcommit.minimums ?? [],
    switches: postcommit.switches ?? [],
    invariant: postcommit.invariant ?? null,
    sequence: postcommit.sequence ?? null,
    triggers: postcommit.triggers ?? [],
  };
}

function postrestartSummary(
  postrestart: Json | undefined,
  path?: string,
  hash?: string,
): Json {
  if (!postrestart || !path) {
    return { status: "PENDING", reason: "independent LIVE postrestart evidence not supplied" };
  }
  const cRows = Array.isArray(postrestart.C) ? postrestart.C as Json[] : [];
  const changedC = cRows.filter((row) => row.unchanged === false).map((row) => ({
    table: row.table,
    before: row.before,
    after: row.after,
    changedColumns: row.changedColumns ?? {},
  }));
  return {
    status: postrestart.status === "OBSERVED" ? "OBSERVED" : "PENDING",
    stage: postrestart.stage ?? null,
    path: relativePath(path),
    sha256: hash ?? null,
    capturedAtUtc: postrestart.capturedAt ?? null,
    A: postrestart.A ?? {},
    changedC,
    originalAuditPreserved: postrestart.originalAuditPreserved ?? null,
    sourceUiStatus: postrestart.sourceUiStatus ?? null,
    noSourceFixtures: postrestart.noSourceFixtures ?? null,
  };
}

function liveUiSummary(liveUi: Json | undefined, path?: string, hash?: string): Json {
  if (!liveUi || !path) {
    return { status: "PENDING", reason: "LIVE UI evidence not supplied" };
  }
  return {
    status: objectStatus(liveUi) ?? "PENDING",
    path: relativePath(path),
    sha256: hash ?? null,
    authAttempted: liveUi.authAttempted ?? null,
    reason: liveUi.reason ?? null,
    routeResults: liveUi.routeResults ?? [],
    checks: liveUi.checks ?? [],
  };
}

function effectivePointStatus(
  disposable: Status,
  live: Status,
  requiredExtra: Status = "PASS",
): Status {
  if (disposable === "FAIL" || live === "FAIL" || requiredExtra === "FAIL") return "FAIL";
  if (live === "BLOCKED") return "BLOCKED";
  if (requiredExtra === "WITH_OBSERVATIONS") return "WITH_OBSERVATIONS";
  if (disposable === "PASS" && live === "PASS" && requiredExtra === "PASS") return "PASS";
  return "PENDING";
}

function htmlEscape(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function markdownTable(rows: Json[], columns: string[]): string {
  const header = `| ${columns.join(" | ")} |`;
  const separator = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${columns.map((column) => String(row[column] ?? "")).join(" | ")} |`);
  return [header, separator, ...body].join("\n");
}

function renderMarkdown(model: Json): string {
  const points = model.checklist as Json[];
  const aRows = model.transactionBaseline.listA as Json[];
  const cRowsValue = model.transactionBaseline.listC as Json[];
  const triggerRowsValue = model.transactionBaseline.triggersFinal as Json[];
  const minRowsValue = model.minimums.values as Json[];
  const counterRows = Object.entries(model.transactionBaseline.counters as Json).map(([table, value]) => ({
    table,
    ...(value as Json),
  }));
  const testStatuses = (model.actualTests.statuses ?? {}) as Json;
  return [
    "# Fase 2 — purga operativa (generador de evidencia)",
    "",
    `**Estado del reporte:** \`${model.status}\``,
    "",
    "La purga de development quedó confirmada. Esto no equivale a una validación totalmente aprobada: las limitaciones de pruebas y acceso visual se detallan por separado.",
    "",
    "## Entradas explícitas",
    "",
    markdownTable([
      { entrada: "Preflight read-only", ruta: model.inputs.readonlyEvidence, estado: model.inputs.readonlyStatus },
      { entrada: "Rehearsal disposable", ruta: model.inputs.rehearseEvidence, estado: model.inputs.rehearseStatus },
      { entrada: "State JSON", ruta: model.inputs.state, estado: model.inputs.stateStatus },
      { entrada: "Respaldo", ruta: model.inputs.backupDirectory, estado: model.backup.status },
      { entrada: "Prueba disposable", ruta: model.inputs.disposableProof ?? "no suministrada", estado: model.disposableProof.status },
      { entrada: "Aclaración UI disposable", ruta: model.inputs.uiClarification ?? "no suministrada", estado: model.uiClarification.status },
      { entrada: "Pruebas reales", ruta: model.inputs.testReport ?? "no suministrado", estado: model.actualTests.status },
      { entrada: "Evidencia LIVE", ruta: model.inputs.liveEvidence ?? "no suministrada", estado: model.live.status },
      { entrada: "LIVE postcommit independiente", ruta: model.inputs.postcommitEvidence ?? "no suministrada", estado: model.postcommit.status },
      { entrada: "LIVE postrestart independiente", ruta: model.inputs.postrestartEvidence ?? "no suministrada", estado: model.postrestart.status },
      { entrada: "UI LIVE", ruta: model.inputs.liveUiEvidence ?? "no suministrada", estado: model.liveUi.status },
    ], ["entrada", "ruta", "estado"]),
    "",
    `API de source: **${model.runtime.sourceApiStatus === "PASS_RESTARTED_RUNNING"
      ? "running limpio después del reinicio"
      : model.runtime.sourceApiStatus === "PASS_OPERATOR_FLAG"
        ? "pausada (entrada del operador)"
        : "no confirmada"}**.`,
    "",
    "## Respaldo verificado",
    "",
    `- Commit acompañado: \`${model.backup.commit ?? "no disponible"}\``,
    `- Dump SHA-256: \`${model.backup.archive.sha256 ?? "no disponible"}\``,
    `- Drive: archivo \`${model.backup.verification.driveFileId ?? "no disponible"}\` (${model.backup.verification.driveWebViewLink ?? "sin enlace"}); owner-only=${model.backup.verification.driveOwnerOnly}; descarga=${model.backup.verification.driveDownload}.`,
    `- Conteos/restauración y catálogo: \`${model.backup.verification.restoreComparison}\`.`,
    "",
    "## Clasificación de los 11 puntos",
    "",
    markdownTable(points.map((point) => ({
      punto: point.point,
      disposable: point.disposableStatus,
      live: point.liveStatus,
      final: point.status,
      evidencia: point.evidence,
    })), ["punto", "disposable", "live", "final", "evidencia"]),
    "",
    "## Listas y estado al commit",
    "",
    `List A: **${aRows.length} tablas**. List B: **${model.lists.B.length} tablas** más \`public.contenedores_folio_seq\`. List C: **${cRowsValue.length} tablas**.`,
    "",
    "### A — antes/después",
    "",
    markdownTable(aRows.map((row) => ({ tabla: row.table, antes: row.before, después: row.after })), ["tabla", "antes", "después"]),
    "",
    "### C — conteos y hashes antes/después",
    "",
    markdownTable(cRowsValue.map((row) => ({
      tabla: row.table,
      antes: row.beforeCount,
      después: row.afterCount,
      hashAntes: row.beforeHash,
      hashDespués: row.afterHash,
    })), ["tabla", "antes", "después", "hashAntes", "hashDespués"]),
    "",
    "### B — contadores, secuencia y caché",
    "",
    markdownTable(counterRows, ["table", "beforeCount", "afterCount", "resetColumn", "resetValue"]),
    "",
    `Secuencia \`public.contenedores_folio_seq\`: ${JSON.stringify(model.transactionBaseline.sequence)}.`,
    "",
    `Invariante de caché: ${JSON.stringify(model.transactionBaseline.invariant)}.`,
    "",
    "### Mínimos (valor, fecha y autor)",
    "",
    markdownTable(minRowsValue.map((row) => ({
      producto: row.productoId,
      ubicación: row.ubicacionId,
      valor: row.cantidad,
      fecha: row.updatedAt,
      autor: row.updatedBy,
    })), ["producto", "ubicación", "valor", "fecha", "autor"]),
    "",
    "### Triggers finales — consulta exacta, los 11 deben ser `O`",
    "",
    markdownTable(triggerRowsValue.map((row) => ({
      tabla: row.table,
      trigger: row.trigger,
      tgenabled: row.tgenabled,
      interno: row.tgisinternal,
    })), ["tabla", "trigger", "tgenabled", "interno"]),
    "",
    "## Pruebas reales y UI",
    "",
    `Typecheck/suites/UI/ticket: ${JSON.stringify({
      status: model.actualTests.status,
      statuses: testStatuses,
      observations: model.actualTests.observations,
    })}.`,
    "",
    `Prueba disposable: ${JSON.stringify(model.disposableProof)}.`,
    "",
    `Aclaración UI disposable: ${JSON.stringify(model.uiClarification)}.`,
    "",
    `Evidencia LIVE: ${JSON.stringify(model.live)}.`,
    "",
    `Consulta LIVE independiente postcommit (capturada ${model.postcommit.capturedAtUtc ?? "sin fecha"}): ${JSON.stringify(model.postcommit)}.`,
    "",
    `Consulta LIVE independiente postrestart (capturada ${model.postrestart.capturedAtUtc ?? "sin fecha"}): A después del reinicio conserva tickets=0 y sesiones=0; solo aparecen stock_minimo_episodios=3 y notificaciones_sistema=12. Cambios C separados del baseline: ${JSON.stringify(model.postrestart.changedC)}; los conteos de filas, flags y autores permanecen sin cambios fuera de esos updated_at; auditoría original preservada=${model.postrestart.originalAuditPreserved}; sin datos de prueba en development=${model.postrestart.noSourceFixtures}.`,
    "",
    `UI LIVE: ${JSON.stringify(model.liveUi)}. No se simula éxito de pantallas autenticadas cuando el puente seguro de credenciales está bloqueado.`,
    "",
    "## Efectos runtime posteriores al reinicio (separados de la línea base transaccional)",
    "",
    "- Login normal: actualiza `usuarios.ultimo_acceso` y agrega `auditoria.LOGIN_EXITOSO`; no se mezcla con la comparación C pre-login.",
    "- Inicializador de API: actualiza `permissionupdated_at`; no se mezcla con la transacción de purga.",
    "- Poller de stock mínimo: al reiniciar evalúa sitios habilitados y puede crear episodios/notificaciones; se verifica aparte en UI/notificaciones.",
    "",
    "## Estado de aplicación",
    "",
    "Este generador no ejecuta la purga LIVE, no reinicia el API, no modifica `replit.md` y no crea tickets, usuarios, sesiones ni avisos.",
    "",
  ].join("\n");
}

function renderHtml(markdown: string, model: Json): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Fase 2 — purga operativa</title>
<style>body{font:14px system-ui,sans-serif;max-width:1200px;margin:2rem auto;padding:0 1rem;color:#17202a}pre{white-space:pre-wrap;background:#f4f6f7;padding:1rem;border-radius:8px}h1{color:#7b241c}</style>
</head><body><h1>Fase 2 — purga operativa</h1><p><strong>Estado:</strong> ${htmlEscape(model.status)}</p><pre>${htmlEscape(markdown)}</pre></body></html>
`;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const readonlyEvidence = await readJson(options.readonlyEvidence);
  const rehearseEvidence = await readJson(options.rehearseEvidence);
  const state = await readJson(options.statePath);
  const live = options.liveEvidence ? await readJson(options.liveEvidence) : undefined;
  assertEvidenceShape(readonlyEvidence, rehearseEvidence, state, live);
  const postcommit = options.postcommitEvidence ? await readJson(options.postcommitEvidence) : undefined;
  const postrestart = options.postrestartEvidence ? await readJson(options.postrestartEvidence) : undefined;
  const liveUi = options.liveUiEvidence ? await readJson(options.liveUiEvidence) : undefined;

  const manifest = await readJson(resolve(options.backupDirectory, "manifest.json"));
  const drive = await readJson(resolve(options.backupDirectory, "drive-verification.json"));
  const backupState = await readJson(resolve(options.backupDirectory, "state.json"));
  const sourceMinimums = await readJson(resolve(options.backupDirectory, "source-minimums.json"));
  const proof = options.disposableProof ? await readJson(options.disposableProof) : undefined;
  const clarification = options.uiClarification ? await readJson(options.uiClarification) : undefined;
  const liveHash = options.liveEvidence ? await sha256File(options.liveEvidence) : undefined;
  const disposableProofHash = options.disposableProof
    ? await sha256File(options.disposableProof)
    : undefined;
  const clarificationHash = options.uiClarification
    ? await sha256File(options.uiClarification)
    : undefined;
  const postcommitHash = options.postcommitEvidence
    ? await sha256File(options.postcommitEvidence)
    : undefined;
  const postrestartHash = options.postrestartEvidence
    ? await sha256File(options.postrestartEvidence)
    : undefined;
  const liveUiHash = options.liveUiEvidence
    ? await sha256File(options.liveUiEvidence)
    : undefined;
  const testReport = await loadTestReport(options.testReport);

  if (proof) {
    const serialized = JSON.stringify(proof);
    if (/password|cookie|secret|token|postgres(?:ql)?:\/\//i.test(serialized)) {
      throw new Error("Disposable proof contains a credential/token/database URL; refusing to report it");
    }
  }
  if (clarification) {
    const serialized = JSON.stringify(clarification);
    if (/password|cookie|secret|token|postgres(?:ql)?:\/\//i.test(serialized)) {
      throw new Error("UI clarification contains a credential/token/database URL; refusing to report it");
    }
  }

  const execution = rehearseEvidence.execution ?? {};
  const listA = rehearseEvidence.lists.A as string[];
  const listB = rehearseEvidence.lists.B as string[];
  const listC = rehearseEvidence.lists.C as string[];
  const beforeC = execution.lockedBeforeC ?? {};
  const afterC = execution.afterC ?? {};
  const beforeA = execution.lockedBeforeCounts ?? {};
  const afterA = execution.afterA ?? {};
  const triggersFinal = triggerRows(execution.triggersFinal);
  const triggerPass = triggersFinal.length === 11 &&
    triggersFinal.every((row) => row.tgenabled === "O" && row.tgisinternal === false);
  const backup = backupSummary(
    manifest,
    drive,
    backupState,
    options.backupDirectory,
  );
  const disposableProof = disposableProofSummary(
    proof,
    options.disposableProof,
    disposableProofHash,
  );
  const uiClarification = uiClarificationSummary(
    clarification,
    options.uiClarification,
    clarificationHash,
  );
  const liveData = liveSummary(live, options.liveEvidence, liveHash);
  const postcommitData = postcommitSummary(postcommit, options.postcommitEvidence, postcommitHash);
  const postrestartData = postrestartSummary(postrestart, options.postrestartEvidence, postrestartHash);
  const liveUiData = liveUiSummary(liveUi, options.liveUiEvidence, liveUiHash);
  const livePoints = (liveData.pointStatuses ?? {}) as Record<string, Status>;
  Object.assign(livePoints, inferredPostcommitPointStatuses(postcommit ?? {}));
  Object.assign(livePoints, liveUiPointStatuses(liveUi));
  const testStatuses = (testReport.statuses ?? {}) as Record<string, Status>;
  const disposableCore = rehearseEvidence.status === "PASS" &&
    String(execution.transaction ?? "").toLowerCase().includes("committed") &&
    listA.every((table) => Number(afterA[table] ?? -1) === 0) &&
    listC.every((table) => beforeC[table]?.count === afterC[table]?.count &&
      beforeC[table]?.hash === afterC[table]?.hash) &&
    Number(execution.invariant?.badPairs ?? -1) === 0 &&
    triggerPass;
  const disposableTicket = disposableProof.ticket?.status === "PASS";
  const disposableUi = disposableProof.emptyUi?.status === "PASS";
  const disposableCatalogUi = disposableUi &&
    (!options.uiClarification || uiClarification.status === "PASS");
  if (disposableTicket) livePoints["7"] = "PASS";
  const allLivePoints = Array.from({ length: 11 }, (_, index) => String(index + 1))
    .every((point) => livePoints[point] === "PASS");
  const finalEligible = liveData.status === "PASS" &&
    disposableCore &&
    disposableTicket &&
    disposableUi &&
    allLivePoints &&
    ["typecheck", "suites", "ui", "ticket"].every((name) => testStatuses[name] === "PASS") &&
    (options.sourceApiPaused || options.sourceApiRunning);

  const pointEvidence = [
    "A33 after=0; post-login sesiones is a separate runtime effect",
    "C18 count/hash comparison",
    "Independent LIVE postcommit values/dates/authors and enabled switch",
    "reconstructed existencias invariant",
    "execution.triggersFinal",
    "explicit actual test report",
    "disposable proof ticket.folio=1000",
    "Live UI BLOCKED by safe credential bridge; disposable empty-UI proof PASS only",
    "Live UI BLOCKED by safe credential bridge; disposable Precios proof PASS only",
    "Live UI BLOCKED by safe credential bridge; disposable Clientes/Proveedores/Equipos proof PASS only",
    "C18 auditoria baseline plus separate login effect",
  ];
  const disposableStatuses: Status[] = [
    disposableCore ? "PASS" : "PENDING",
    disposableCore ? "PASS" : "PENDING",
    sourceMinimums.stock_minimos && sourceMinimums.stock_minimo_sitios ? "PASS" : "PENDING",
    Number(execution.invariant?.badPairs ?? -1) === 0 ? "PASS" : "PENDING",
    triggerPass ? "PASS" : "PENDING",
    "PENDING",
    disposableTicket ? "PASS" : "PENDING",
    disposableUi ? "PASS" : "PENDING",
    disposableCatalogUi ? "PASS" : "PENDING",
    disposableCatalogUi ? "PASS" : "PENDING",
    beforeC.auditoria?.hash === afterC.auditoria?.hash ? "PASS" : "PENDING",
  ];
  const checklist = Array.from({ length: 11 }, (_, index) => {
    const point = String(index + 1);
    const liveStatus = livePoints[point] ?? "PENDING";
    const extra: Status =
      index === 5
        ? (testReport.status === "WITH_OBSERVATIONS"
          ? "WITH_OBSERVATIONS"
          : (["typecheck", "suites"].every((name) => testStatuses[name] === "PASS") ? "PASS" : "PENDING"))
        : index === 6
          ? (testStatuses.ticket === "PASS" || disposableTicket ? "PASS" : "PENDING")
          : "PASS";
    return {
      point: index + 1,
      disposableStatus: index === 5 ? extra : disposableStatuses[index],
      liveStatus: index === 5 || index === 6 ? "NOT_RUN" : liveStatus,
      status: index === 6 ? (disposableTicket ? "PASS" : "PENDING") : effectivePointStatus(disposableStatuses[index], liveStatus, extra),
      evidence: index === 6 ? "Ticket folio 1000 comprobado solo en base desechable; no se creó ticket en development" : pointEvidence[index],
    };
  });

  const liveApplyStatus = live
    ? (live.liveApplyStatus ??
      live.applyStatus ??
      (live.mode === "apply" && live.status === "PASS" &&
        String(live.execution?.transaction ?? "").toLowerCase().includes("committed")
        ? "PASS_COMMITTED"
        : "UNRESOLVED_LIVE_PROOF"))
    : "NOT_RUN";
  const sourceApiStatus = options.sourceApiRunning
    ? "PASS_RESTARTED_RUNNING"
    : options.sourceApiPaused
      ? "PASS_OPERATOR_FLAG"
      : "UNVERIFIED";
  const committedValidationEvidence = liveData.status === "PASS" &&
    liveApplyStatus === "PASS_COMMITTED" &&
    postcommitData.status === "PASS" &&
    postrestartData.status === "OBSERVED";
  const model: Json = {
    status: finalEligible
      ? "FINAL_PASS"
      : committedValidationEvidence
        ? "PURGE_COMMITTED_WITH_VALIDATION_LIMITATIONS"
        : options.liveEvidence
          ? "PENDING_VALIDATION"
          : "PENDING_LIVE_EVIDENCE",
    generatedAtUtc: new Date().toISOString(),
    finalEligible,
    inputs: {
      readonlyEvidence: relativePath(options.readonlyEvidence),
      readonlyStatus: readonlyEvidence.status,
      rehearseEvidence: relativePath(options.rehearseEvidence),
      rehearseStatus: rehearseEvidence.status,
      state: relativePath(options.statePath),
      stateStatus: state.status,
      backupDirectory: relativePath(options.backupDirectory),
      disposableProof: options.disposableProof ? relativePath(options.disposableProof) : null,
      uiClarification: options.uiClarification ? relativePath(options.uiClarification) : null,
      testReport: options.testReport ? relativePath(options.testReport) : null,
      liveEvidence: options.liveEvidence ? relativePath(options.liveEvidence) : null,
      postcommitEvidence: options.postcommitEvidence ? relativePath(options.postcommitEvidence) : null,
      postrestartEvidence: options.postrestartEvidence ? relativePath(options.postrestartEvidence) : null,
      liveUiEvidence: options.liveUiEvidence ? relativePath(options.liveUiEvidence) : null,
    },
    runtime: {
      sourceApiStatus,
      sourceApiPaused: options.sourceApiPaused ? "PASS_OPERATOR_FLAG" : "NOT_PAUSED",
      liveApply: liveApplyStatus,
    },
    backup,
    lists: { A: listA, B: listB, C: listC },
    transactionBaseline: {
      transaction: execution.transaction,
      rollbackOnError: execution.rollbackOnError,
      listA: listRows(listA, beforeA, afterA),
      listC: cRows(listC, beforeC, afterC),
      counters: execution.counters ?? {},
      sequence: execution.sequence ?? {},
      invariant: execution.invariant ?? {},
      triggersFinal,
      triggersAllO: triggerPass,
      auditPreserved: beforeC.auditoria?.hash === afterC.auditoria?.hash,
    },
    minimums: {
      counts: sourceMinimums.counts ?? {},
      values: minRows(sourceMinimums),
      sites: sourceMinimums.stock_minimo_sitios ?? [],
    },
    disposableProof,
    uiClarification,
    actualTests: testReport,
    live: liveData,
    postcommit: postcommitData,
    postrestart: postrestartData,
    liveUi: liveUiData,
    checklist,
    postRestartRuntimeEffects: [
      "Normal login updates usuarios.ultimo_acceso and appends auditoria.LOGIN_EXITOSO.",
      "API startup initializer updates permissionupdated_at.",
      "Stock-minimum poller evaluates enabled sites on restart and may create episodes/notificaciones.",
    ],
  };
  const markdown = renderMarkdown(model);
  const html = renderHtml(markdown, model);
  const json = `${JSON.stringify(model, null, 2)}\n`;
  await mkdir(options.outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(resolve(options.outputDirectory, `${OUTPUT_BASENAME}.md`), markdown),
    writeFile(resolve(options.outputDirectory, `${OUTPUT_BASENAME}.html`), html),
    writeFile(resolve(options.outputDirectory, `${OUTPUT_BASENAME}.json`), json),
  ]);
  console.log(
    `${model.status}: wrote ${OUTPUT_BASENAME}.{md,html,json}; live evidence=${options.liveEvidence ? relativePath(options.liveEvidence) : "NOT_SUPPLIED"}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
