// Mirrors PLAN_VERSION/REPORT_DIGESTS in the coordinated offline SQL contract.
export const LIMITED_STARTUP_REVISION = "e2-limited-readonly-v3";
export const LIMITED_STARTUP_ROUTE = "/api";
export const LIMITED_STARTUP_SQL_PLAN_FINGERPRINTS = [
  "59dd73520c3d11cc65b3f2fac25f46a4560ca45700c5c981c21e17dfe80988fd",
  "982aa15dcce33633ccf42ae5a79f03858bd2ff0eee26724da8858f1216accb05",
  "9e7e5b8de15d7079105c3d29416142e6f2825c8cd1828f85f8b67a1e4e842099",
  "dd99574f022b4d325a73238bf0d1e348e015003d2dad3ebc9de00ede8b094cbd",
  "522f8bac6d8b78e2eee158e47249aac8e8fac264cabd64546b00b6f3bf7ae4bc",
  "1bb36ac4eddd07d54e28686b83a3ded3d98b115e4190fbce6e97a11c7576587d",
  "f5870c20276001bd2c8269e534b2ef696217e13087a27cd350127ce8dfa9b5d2",
] as const;
export const LIMITED_STARTUP_VERIFICATIONS = [
  "identity",
  "schema",
  "E1P01",
  "E1A01",
  "E1C01",
] as const;

export interface LimitedStartupApproval {
  mode: "EXPLICIT_LIMITED";
  approved: true;
  route: typeof LIMITED_STARTUP_ROUTE;
  revision: typeof LIMITED_STARTUP_REVISION;
  database: { name: string; oid: string };
  identitySha256: string;
  guardState: "CLOSED" | "LIMITED";
  sqlPlanFingerprints: typeof LIMITED_STARTUP_SQL_PLAN_FINGERPRINTS;
  verifications: typeof LIMITED_STARTUP_VERIFICATIONS;
}

export type StartupMode =
  | { kind: "normal" }
  | { kind: "inspection" }
  | { kind: "limited"; approval: LimitedStartupApproval };

export interface StartupCreditFeatureState {
  incomeCapture: boolean;
  abonoEvidence: boolean;
  returnCapture: boolean;
  pendingReceipts: boolean;
  historicalAttribution: boolean;
}

function exactKeys(value: object, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === [...expected].sort()[index]);
}

function parseLimitedApproval(raw: string | undefined): LimitedStartupApproval {
  if (!raw) {
    throw new Error("EXPLICIT_LIMITED requires API_LIMITED_STARTUP_APPROVAL exact JSON.");
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("API_LIMITED_STARTUP_APPROVAL is not valid JSON.");
  }
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
    || !exactKeys(value, ["mode", "approved", "route", "revision", "database", "identitySha256", "guardState", "sqlPlanFingerprints", "verifications"])
  ) {
    throw new Error("API_LIMITED_STARTUP_APPROVAL has an unexpected JSON shape.");
  }
  const candidate = value as Record<string, unknown>;
  const database = candidate.database;
  const verifications = candidate.verifications;
  if (
    candidate.mode !== "EXPLICIT_LIMITED"
    || candidate.approved !== true
    || candidate.route !== LIMITED_STARTUP_ROUTE
    || candidate.revision !== LIMITED_STARTUP_REVISION
    || !database
    || typeof database !== "object"
    || Array.isArray(database)
    || !exactKeys(database, ["name", "oid"])
    || typeof (database as Record<string, unknown>).name !== "string"
    || !(database as Record<string, unknown>).name
    || typeof (database as Record<string, unknown>).oid !== "string"
    || !/^\d+$/.test((database as Record<string, unknown>).oid as string)
    || typeof candidate.identitySha256 !== "string"
    || !/^[0-9a-f]{64}$/.test(candidate.identitySha256)
    || !["CLOSED", "LIMITED"].includes(String(candidate.guardState))
    || !Array.isArray(candidate.sqlPlanFingerprints)
    || candidate.sqlPlanFingerprints.length !== LIMITED_STARTUP_SQL_PLAN_FINGERPRINTS.length
    || !candidate.sqlPlanFingerprints.every(
      (fingerprint, index) => fingerprint === LIMITED_STARTUP_SQL_PLAN_FINGERPRINTS[index],
    )
    || !Array.isArray(verifications)
    || verifications.length !== LIMITED_STARTUP_VERIFICATIONS.length
    || !verifications.every((item, index) => item === LIMITED_STARTUP_VERIFICATIONS[index])
  ) {
    throw new Error("API_LIMITED_STARTUP_APPROVAL does not exactly match the required approved state.");
  }
  return value as LimitedStartupApproval;
}

/** Every non-normal startup is explicit and must never fall through to maintenance. */
export function startupMode(
  env: Record<string, string | undefined>,
  creditFeatures: StartupCreditFeatureState = {
    incomeCapture: false,
    abonoEvidence: false,
    returnCapture: false,
    pendingReceipts: false,
    historicalAttribution: false,
  },
): StartupMode {
  const requested = env.API_STARTUP_MODE;
  if (
    creditFeatures.returnCapture
    || creditFeatures.pendingReceipts
    || creditFeatures.historicalAttribution
  ) {
    throw new Error("Limited startup requires return, pending and historical credit features closed.");
  }
  if (creditFeatures.incomeCapture !== creditFeatures.abonoEvidence) {
    throw new Error("Cash income capture and mandatory A+C evidence must be enabled or closed together.");
  }
  if (creditFeatures.incomeCapture && requested !== "EXPLICIT_LIMITED") {
    throw new Error("Cash income capture requires EXPLICIT_LIMITED preflight; refusing startup.");
  }
  if (requested === "EXPLICIT_LIMITED") {
    if (env.API_INSPECTION_BOOT === "1") {
      throw new Error("Conflicting limited and inspection startup modes.");
    }
    const approval = parseLimitedApproval(env.API_LIMITED_STARTUP_APPROVAL);
    const expectedState = creditFeatures.incomeCapture ? "LIMITED" : "CLOSED";
    if (approval.guardState !== expectedState) {
      throw new Error("Cash income capture flag and approved guardState mismatch.");
    }
    return { kind: "limited", approval };
  }
  if (requested !== undefined && requested !== "" && requested !== "NORMAL") {
    throw new Error(`Unknown API_STARTUP_MODE "${requested}"; refusing normal startup fallthrough.`);
  }
  if (env.API_INSPECTION_BOOT !== "1") return { kind: "normal" };
  if (env.NODE_ENV !== "development") {
    throw new Error("API_INSPECTION_BOOT requires explicit NODE_ENV=development.");
  }
  return { kind: "inspection" };
}