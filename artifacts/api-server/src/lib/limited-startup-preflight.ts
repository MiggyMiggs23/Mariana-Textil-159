import { createHash } from "node:crypto";
import { getTableColumns, getTableName, is, Table } from "drizzle-orm";
import {
  LIMITED_STARTUP_REVISION,
  type LimitedStartupApproval,
} from "./startup-mode";

type QueryResult = { rows: Array<Record<string, unknown>> };
export interface ReadonlyPreflightClient {
  query(sql: string, values?: readonly unknown[]): Promise<QueryResult>;
  release(): void;
}
export interface ReadonlyPreflightPool {
  connect(): Promise<ReadonlyPreflightClient>;
}

export const LIMITED_SCHEMA_MANIFEST = {
  revision: LIMITED_STARTUP_REVISION,
  columns: [
    ["usuarios", "id", "integer"], ["usuarios", "usuario", "text"],
    ["sesiones", "id", "uuid"], ["clientes", "id", "integer"],
    ["clientes", "saldo_credito", "numeric"], ["tickets", "id", "integer"],
    ["ticket_lineas", "ticket_id", "integer"], ["ticket_pagos", "ticket_id", "integer"],
    ["sesiones_caja", "id", "integer"],
    ["operaciones_credito_e1", "productor", "text"],
    ["operaciones_credito_e1", "clave", "uuid"],
    ["movimientos_credito", "id", "integer"],
    ["movimientos_credito", "operacion_productor", "text"],
    ["movimientos_credito", "operacion_clave", "uuid"],
    ["movimientos_credito", "naturaleza", "USER-DEFINED"],
    ["cobros_credito_pendientes_e1", "operacion_clave", "uuid"],
    ["atribuciones_credito_e1", "id", "uuid"],
  ] as const,
  constraints: [
    "operaciones_pk_e1", "movimientos_operacion_fk_e1", "cobros_pk_e1",
    "cobros_operacion_fk_e1", "cobros_importe_ck_e1", "atribuciones_pk_e1",
    "atribuciones_movimiento_fk_e1", "atribuciones_cadena_uq_e1",
  ] as const,
  indexes: [
    "movimientos_operacion_uq_e1",
    "movimientos_credito_cliente_created_at_idx",
    "ticket_pagos_ticket_idx",
  ] as const,
} as const;

export interface LimitedSchemaManifest {
  revision: string;
  columns: ReadonlyArray<readonly [string, string, string]>;
  constraints: readonly string[];
  indexes: readonly string[];
}

const BUILTIN_TYPES = new Set([
  "bigint", "boolean", "date", "double precision", "integer", "json", "jsonb",
  "real", "smallint", "text", "time without time zone", "time with time zone",
  "timestamp without time zone", "timestamp with time zone", "uuid",
]);

function catalogDataType(sqlType: string): string {
  const type = sqlType.toLowerCase();
  if (type === "serial") return "integer";
  if (type === "bigserial") return "bigint";
  if (type.startsWith("numeric") || type.startsWith("decimal")) return "numeric";
  if (type.startsWith("varchar")) return "character varying";
  if (type.startsWith("char")) return "character";
  return BUILTIN_TYPES.has(type) ? type : "USER-DEFINED";
}

/** Build the runtime manifest from every table exported by the Drizzle schema. */
export function buildDrizzleSchemaManifest(
  schemaExports: Record<string, unknown>,
): LimitedSchemaManifest {
  const columns: Array<readonly [string, string, string]> = [];
  const seen = new Set<string>();
  for (const value of Object.values(schemaExports)) {
    if (!is(value, Table)) continue;
    const table = getTableName(value);
    if (seen.has(table)) continue;
    seen.add(table);
    for (const column of Object.values(getTableColumns(value))) {
      columns.push([table, column.name, catalogDataType(column.getSQLType())]);
    }
  }
  columns.sort(([ta, ca], [tb, cb]) => ta.localeCompare(tb) || ca.localeCompare(cb));
  if (!columns.length) throw new Error("Limited startup Drizzle schema manifest is empty.");
  return {
    revision: LIMITED_SCHEMA_MANIFEST.revision,
    columns,
    constraints: LIMITED_SCHEMA_MANIFEST.constraints,
    indexes: LIMITED_SCHEMA_MANIFEST.indexes,
  };
}

export const LIMITED_CONSTRAINT_EXPECTATIONS: Record<string, {
  type: string;
  fragments: readonly string[];
}> = {
  operaciones_pk_e1: { type: "p", fragments: ["PRIMARY KEY", "(productor, clave)"] },
  movimientos_operacion_fk_e1: { type: "f", fragments: ["FOREIGN KEY (operacion_productor, operacion_clave)", "operaciones_credito_e1(productor, clave)", "MATCH FULL"] },
  cobros_pk_e1: { type: "p", fragments: ["PRIMARY KEY", "(operacion_productor, operacion_clave)"] },
  cobros_operacion_fk_e1: { type: "f", fragments: ["FOREIGN KEY (operacion_productor, operacion_clave)", "operaciones_credito_e1(productor, clave)", "MATCH FULL"] },
  cobros_importe_ck_e1: { type: "c", fragments: ["CHECK", "importe > 0"] },
  atribuciones_pk_e1: { type: "p", fragments: ["PRIMARY KEY", "(id)"] },
  atribuciones_movimiento_fk_e1: { type: "f", fragments: ["FOREIGN KEY (movimiento_id)", "movimientos_credito(id)"] },
  atribuciones_cadena_uq_e1: { type: "u", fragments: ["UNIQUE NULLS NOT DISTINCT", "(movimiento_id, anterior_id)"] },
};

export const LIMITED_INDEX_EXPECTATIONS: Record<string, readonly string[]> = {
  movimientos_operacion_uq_e1: ["CREATE UNIQUE INDEX", "(operacion_productor, operacion_clave)", "WHERE (operacion_productor IS NOT NULL)"],
  movimientos_credito_cliente_created_at_idx: ["CREATE INDEX", "(cliente_id, created_at)"],
  ticket_pagos_ticket_idx: ["CREATE INDEX", "(ticket_id)"],
};

const GUARDS = [
  {
    code: "E1C01",
    table: "movimientos_credito",
    trigger: "zz_e1_cash_capture_closed",
    function: "e1_guard_cash_capture_closed",
  },
  {
    code: "E1P01",
    table: "cobros_credito_pendientes_e1",
    trigger: "zz_e1_pending_receipts_closed",
    function: "e1_guard_pending_receipts_closed",
  },
  {
    code: "E1A01",
    table: "atribuciones_credito_e1",
    trigger: "zz_e1_historical_attribution_closed",
    function: "e1_guard_historical_attribution_closed",
  },
] as const;

const E1_TRIGGER_EXPECTATIONS = [
  ["movimientos_credito", "movimientos_credito_inmutables", 27, "prevent_financial_record_mutation"],
  ["movimientos_credito", "movimientos_credito_reversos_validos", 7, "validate_credit_reversal"],
  ["movimientos_credito", "movimientos_validos_e1", 5, "validar_movimiento_credito_e1"],
  ["movimientos_credito", "zz_e1_cash_capture_closed", 5, "e1_guard_cash_capture_closed"],
  ["cobros_credito_pendientes_e1", "cobros_inmutables_e1", 58, "impedir_mutacion_credito_e1"],
  ["cobros_credito_pendientes_e1", "cobros_validos_e1", 5, "validar_cobro_pendiente_e1"],
  ["cobros_credito_pendientes_e1", "zz_e1_pending_receipts_closed", 4, "e1_guard_pending_receipts_closed"],
  ["atribuciones_credito_e1", "atribuciones_inmutables_e1", 58, "impedir_mutacion_credito_e1"],
  ["atribuciones_credito_e1", "atribuciones_validas_e1", 7, "validar_atribucion_credito_e1"],
  ["atribuciones_credito_e1", "zz_e1_historical_attribution_closed", 4, "e1_guard_historical_attribution_closed"],
  ["auditoria", "auditoria_append_only", 27, "proteger_auditoria_append_only"],
] as const;

const AUDIT_APPEND_ONLY_SOURCE = `
       BEGIN
         RAISE EXCEPTION 'auditoria es append-only';
       END;
       `;

const CASH_GUARD_SOURCE = {
  CLOSED: `
BEGIN
  IF NEW.forma_pago::text = 'EFECTIVO'
     AND NEW.naturaleza::text IN ('INGRESO_FISICO', 'DEVOLUCION_FISICA') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'E1C01',
      MESSAGE = 'E1: la captura física de efectivo de crédito está deshabilitada.';
  END IF;
  RETURN NEW;
END;
`,
  LIMITED: `
BEGIN
  IF NEW.forma_pago::text = 'EFECTIVO'
     AND NEW.naturaleza::text IN ('INGRESO_FISICO', 'DEVOLUCION_FISICA')
     AND (
       NEW.naturaleza::text = 'DEVOLUCION_FISICA'
       OR NEW.tipo::text IS DISTINCT FROM 'ABONO'
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'E1C01',
      MESSAGE = 'E1: la captura física de efectivo de crédito está deshabilitada.';
  END IF;
  RETURN NEW;
END;
`,
} as const;

const OTHER_GUARD_SOURCE = {
  E1P01: `
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'E1P01',
    MESSAGE = 'E1: el cobro retenido de crédito está deshabilitado.';
  RETURN NULL;
END;
`,
  E1A01: `
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'E1A01',
    MESSAGE = 'E1: la atribución histórica de crédito está deshabilitada.';
  RETURN NULL;
END;
`,
} as const;

export interface LimitedPreflightResult {
  identity: { databaseName: string; databaseOid: string; schemaName: string };
  revision: string;
  checked: { columns: number; constraints: number; indexes: number; guards: number };
}

export const ABONO_EVIDENCE_COLUMNS = [
  ["movimientos_credito", "e2_insert_xid", "xid8"],
  ["cobros_credito_pendientes_e1", "e2_insert_xid", "xid8"],
  ["finalizaciones_abono_e2", "abono_id", "integer"],
  ["finalizaciones_abono_e2", "operacion_productor", "text"],
  ["finalizaciones_abono_e2", "operacion_clave", "uuid"],
  ["finalizaciones_abono_e2", "cliente_id", "integer"],
  ["finalizaciones_abono_e2", "importe", "numeric"],
  ["finalizaciones_abono_e2", "resultado", "text"],
  ["finalizaciones_abono_e2", "aplicado", "numeric"],
  ["finalizaciones_abono_e2", "evaluacion", "jsonb"],
  ["finalizaciones_abono_e2", "contrato_revision", "text"],
  ["finalizaciones_abono_e2", "created_at", "timestamp with time zone"],
  ["evidencia_no_aplicada_e2", "fuente", "text"],
  ["evidencia_no_aplicada_e2", "abono_id", "integer"],
  ["evidencia_no_aplicada_e2", "cobro_productor", "text"],
  ["evidencia_no_aplicada_e2", "cobro_clave", "uuid"],
  ["evidencia_no_aplicada_e2", "cliente_id", "integer"],
  ["evidencia_no_aplicada_e2", "importe", "numeric"],
  ["evidencia_no_aplicada_e2", "forma_pago", "text"],
  ["evidencia_no_aplicada_e2", "naturaleza", "text"],
  ["evidencia_no_aplicada_e2", "created_at", "timestamp with time zone"],
] as const;

export const ABONO_EVIDENCE_NULLABLE_COLUMNS = ["abono_id", "cobro_productor", "cobro_clave"] as const;

// Exact pg_get_constraintdef contract; whitespace only is normalized.
// PostgreSQL execution/format confirmation still requires separate authorization.
export const ABONO_EVIDENCE_CONSTRAINTS = [
  ["finalizaciones_abono_e2", "finalizaciones_abono_e2_pkey", "PRIMARY KEY (abono_id)"],
  ["finalizaciones_abono_e2", "finalizaciones_abono_e2_abono_id_fkey", "FOREIGN KEY (abono_id) REFERENCES movimientos_credito(id)"],
  ["finalizaciones_abono_e2", "finalizaciones_abono_e2_cliente_id_fkey", "FOREIGN KEY (cliente_id) REFERENCES clientes(id)"],
  ["finalizaciones_abono_e2", "finalizaciones_abono_e2_operacion_productor_operacion_clave_key", "UNIQUE (operacion_productor, operacion_clave)"],
  ["finalizaciones_abono_e2", "finalizaciones_abono_e2_importe_check", "CHECK (((importe > (0)::numeric) AND (importe < 'Infinity'::numeric)))"],
  ["finalizaciones_abono_e2", "finalizaciones_abono_e2_resultado_check", "CHECK ((resultado = ANY (ARRAY['UNUSED'::text, 'PARTIAL'::text, 'FULL'::text])))"],
  ["finalizaciones_abono_e2", "finalizaciones_abono_e2_aplicado_check", "CHECK (((aplicado >= (0)::numeric) AND (aplicado <= importe)))"],
  ["finalizaciones_abono_e2", "finalizaciones_abono_e2_evaluacion_check", "CHECK ((jsonb_typeof(evaluacion) = 'object'::text))"],
  ["finalizaciones_abono_e2", "finalizaciones_abono_e2_contrato_revision_check", "CHECK ((contrato_revision = 'e2-abono-evidence-v1'::text))"],
  ["finalizaciones_abono_e2", "finalizaciones_abono_e2_check", "CHECK ((((resultado = 'UNUSED'::text) AND (aplicado = (0)::numeric)) OR ((resultado = 'PARTIAL'::text) AND (aplicado > (0)::numeric) AND (aplicado < importe)) OR ((resultado = 'FULL'::text) AND (aplicado = importe))))"],
  ["finalizaciones_abono_e2", "finalizaciones_abono_e2_operacion_productor_check", "CHECK ((operacion_productor = ANY (ARRAY['ABONO_ORDINARIO'::text, 'ABONO_DIRIGIDO'::text])))"],
  ["evidencia_no_aplicada_e2", "evidencia_no_aplicada_e2_pkey", "PRIMARY KEY (fuente)"],
  ["evidencia_no_aplicada_e2", "evidencia_no_aplicada_e2_abono_id_key", "UNIQUE (abono_id)"],
  ["evidencia_no_aplicada_e2", "evidencia_no_aplicada_e2_cobro_clave_key", "UNIQUE (cobro_clave)"],
  ["evidencia_no_aplicada_e2", "evidencia_no_aplicada_e2_cobro_productor_cobro_clave_fkey", "FOREIGN KEY (cobro_productor, cobro_clave) REFERENCES cobros_credito_pendientes_e1(operacion_productor, operacion_clave)"],
  ["evidencia_no_aplicada_e2", "evidencia_no_aplicada_e2_abono_id_fkey", "FOREIGN KEY (abono_id) REFERENCES finalizaciones_abono_e2(abono_id)"],
  ["evidencia_no_aplicada_e2", "evidencia_no_aplicada_e2_cliente_id_fkey", "FOREIGN KEY (cliente_id) REFERENCES clientes(id)"],
  ["evidencia_no_aplicada_e2", "evidencia_no_aplicada_e2_importe_check", "CHECK (((importe > (0)::numeric) AND (importe < 'Infinity'::numeric)))"],
  ["evidencia_no_aplicada_e2", "evidencia_no_aplicada_e2_forma_pago_check", "CHECK ((forma_pago = 'EFECTIVO'::text))"],
  ["evidencia_no_aplicada_e2", "evidencia_no_aplicada_e2_naturaleza_check", "CHECK ((naturaleza = 'INGRESO_FISICO'::text))"],
  ["evidencia_no_aplicada_e2", "evidencia_no_aplicada_e2_check", "CHECK ((((abono_id IS NOT NULL) AND (cobro_productor IS NULL) AND (cobro_clave IS NULL) AND (fuente = ('ABONO:'::text || (abono_id)::text))) OR ((abono_id IS NULL) AND (cobro_productor IS NOT NULL) AND (cobro_clave IS NOT NULL) AND (cobro_productor = 'COBRO_PENDIENTE'::text) AND (fuente = ('COBRO_RETENIDO:'::text || (cobro_clave)::text)))))"],
] as const;

const ABONO_EVIDENCE_TRIGGER_EXPECTATIONS = [
  ["movimientos_credito", "e2_source_insert_transaction", 23, "e2_stamp_insert_transaction", false],
  ["cobros_credito_pendientes_e1", "e2_retained_insert_transaction", 23, "e2_stamp_insert_transaction", false],
  ["finalizaciones_abono_e2", "e2_finalization_immutable", 58, "e2_reject_evidence_mutation", false],
  ["finalizaciones_abono_e2", "e2_validate_abono_finalization", 7, "e2_validate_abono_finalization", false],
  ["evidencia_no_aplicada_e2", "e2_proof_immutable", 58, "e2_reject_evidence_mutation", false],
  ["evidencia_no_aplicada_e2", "e2_validate_unused_proof", 7, "e2_validate_unused_proof", false],
  ["movimientos_credito", "e2_abono_finalization_complete", 5, "e2_require_abono_finalization", true],
  ["aplicaciones_credito", "e2_capture_application_order", 7, "e2_guard_finalized_capture_application", false],
] as const;

const ABONO_EVIDENCE_FUNCTION_HASHES: Record<string, string> = {
  e2_stamp_insert_transaction: "5746c222b6f13659a6d37447152f3735864491f6c1430a925d5010fda517c05a",
  e2_reject_evidence_mutation: "4e4d98bf9efa299671f666d86e8285a76438cdf492ef529bd8f7f0cf359da25a",
  e2_validate_abono_finalization: "e32be7709fafef94efa649c8182fa2d8c31e66ac2810332dc4b1ceea7c3fe354",
  e2_validate_unused_proof: "f9f709434dccf7083861658acbde7e84af2040e9add05633c3f0142599cd4d60",
  e2_attest_new_retained: "3498c293a24f45a9782c7cc550d8194eaefbbdfe83e5c7d9451506195a9fb69c",
  e2_guard_finalized_capture_application: "47c13486b9f4c0933746e64d1e3b89e906244f2f090e60d2365cf0d3e27ef603",
  e2_finalize_new_abono: "a8ff080835bd6873e6ae2ec0c88a92ba4bf74b1d9e131a886fb20df7368bf32f",
  e2_require_abono_finalization: "b706f7a06badbe932d6f08f276ff7ebe3c780b47416e4b58c012f084d7151ad7",
};

export interface LimitedPreflightOptions {
  requireAbonoEvidence?: boolean;
}

export async function runLimitedStartupPreflight(
  pool: ReadonlyPreflightPool,
  approval: LimitedStartupApproval,
  manifest: LimitedSchemaManifest = LIMITED_SCHEMA_MANIFEST,
  options: LimitedPreflightOptions = {},
): Promise<LimitedPreflightResult> {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    transactionOpen = true;
    const identityResult = await client.query(`
      SELECT current_database() AS database_name,
             (SELECT oid::text FROM pg_database WHERE datname = current_database()) AS database_oid,
             current_schema() AS schema_name,
             current_user AS database_role,
             COALESCE(inet_server_addr()::text, '<local>') AS server_address,
             COALESCE(inet_server_port()::text, '<local>') AS server_port,
             current_setting('server_version_num') AS server_version_num,
             current_setting('transaction_read_only') AS transaction_read_only
    `);
    const identity = identityResult.rows[0];
    const identityMaterial = identity
      ? [
          identity.database_name,
          identity.database_oid,
          identity.database_role,
          identity.server_address,
          identity.server_port,
          identity.server_version_num,
        ].join("|")
      : "";
    const identitySha256 = createHash("sha256").update(identityMaterial, "utf8").digest("hex");
    if (
      !identity
      || identity.database_name !== approval.database.name
      || identity.database_oid !== approval.database.oid
      || identity.schema_name !== "public"
      || identity.transaction_read_only !== "on"
      || identitySha256 !== approval.identitySha256
    ) {
      throw new Error("Limited startup database identity/read-only state mismatch.");
    }

    const tables = [...new Set(manifest.columns.map(([table]) => table))];
    const columnsResult = await client.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])
    `, [tables]);
    const actualColumns = new Set(columnsResult.rows.map(
      (row) => `${row.table_name}.${row.column_name}:${row.data_type}`,
    ));
    const missingColumns = manifest.columns
      .map(([table, column, type]) => `${table}.${column}:${type}`)
      .filter((entry) => !actualColumns.has(entry));
    if (missingColumns.length) {
      throw new Error(`Limited startup schema column mismatch: ${missingColumns.join(", ")}`);
    }

    const constraintsResult = await client.query(`
      SELECT conname AS name, contype AS type, pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public' AND conname = ANY($1::text[])
    `, [[...manifest.constraints]]);
    const missingConstraints = manifest.constraints.filter((name) => {
      const row = constraintsResult.rows.find((candidate) => candidate.name === name);
      const expected = LIMITED_CONSTRAINT_EXPECTATIONS[name];
      const definition = String(row?.definition ?? "");
      return !row || row.type !== expected?.type
        || !expected.fragments.every((fragment) => definition.includes(fragment));
    });
    if (missingConstraints.length) {
      throw new Error(`Limited startup constraint mismatch: ${missingConstraints.join(", ")}`);
    }

    const indexesResult = await client.query(`
      SELECT indexname AS name, indexdef AS definition FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = ANY($1::text[])
    `, [[...manifest.indexes]]);
    const missingIndexes = manifest.indexes.filter((name) => {
      const row = indexesResult.rows.find((candidate) => candidate.name === name);
      const definition = String(row?.definition ?? "");
      return !row || !LIMITED_INDEX_EXPECTATIONS[name]?.every(
        (fragment) => definition.includes(fragment),
      );
    });
    if (missingIndexes.length) {
      throw new Error(`Limited startup index mismatch: ${missingIndexes.join(", ")}`);
    }

    const evidenceColumns = await client.query(`
        SELECT table_name, column_name,
               CASE WHEN column_name = 'e2_insert_xid' THEN udt_name ELSE data_type END AS data_type, is_nullable,
               numeric_precision, numeric_scale, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (table_name IN ('finalizaciones_abono_e2','evidencia_no_aplicada_e2')
            OR (table_name IN ('movimientos_credito','cobros_credito_pendientes_e1')
                AND column_name = 'e2_insert_xid'))
      `);
    const evidencePresent = evidenceColumns.rows.length > 0;
    const checkEvidence = options.requireAbonoEvidence || approval.guardState === "LIMITED" || evidencePresent;
    if (checkEvidence) {
      const actualEvidenceColumns = new Set(evidenceColumns.rows.map(
        (row) => `${row.table_name}.${row.column_name}:${row.data_type}`,
      ));
      const missingEvidenceColumns = ABONO_EVIDENCE_COLUMNS
        .map(([table, column, type]) => `${table}.${column}:${type}`)
        .filter((entry) => !actualEvidenceColumns.has(entry));
      if (missingEvidenceColumns.length) {
        throw new Error(`Limited startup A+C evidence column mismatch: ${missingEvidenceColumns.join(", ")}`);
      }
      if (evidenceColumns.rows.length !== ABONO_EVIDENCE_COLUMNS.length
        || evidenceColumns.rows.some((row) => {
          const expectedDefault = row.column_name === "created_at" ? "transaction_timestamp()"
            : row.column_name === "forma_pago" ? "'EFECTIVO'::text"
            : row.column_name === "naturaleza" ? "'INGRESO_FISICO'::text" : null;
          const nullable = row.column_name === "e2_insert_xid"
            || (row.table_name === "evidencia_no_aplicada_e2"
              && (ABONO_EVIDENCE_NULLABLE_COLUMNS as readonly unknown[]).includes(row.column_name));
          return row.is_nullable !== (nullable ? "YES" : "NO") || row.column_default !== expectedDefault
            || (row.data_type === "numeric"
              && (Number(row.numeric_precision) !== 12 || Number(row.numeric_scale) !== 2));
        })) {
        throw new Error("Limited startup A+C evidence column metadata mismatch.");
      }
      const evidenceConstraints = await client.query(`
        SELECT t.relname AS table_name, c.conname AS name,
               pg_get_constraintdef(c.oid) AS definition, c.convalidated,
               c.condeferrable, c.condeferred,
               CASE WHEN c.contype IN ('p','u')
                 THEN i.indisvalid AND i.indisready AND i.indisunique
                 ELSE true END AS index_valid
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        LEFT JOIN pg_index i ON i.indexrelid = c.conindid
        WHERE n.nspname = 'public'
          AND t.relname IN ('finalizaciones_abono_e2','evidencia_no_aplicada_e2')
      `);
      const normalize = (value: unknown) => String(value).replace(/\s+/g, " ").trim();
      if (evidenceConstraints.rows.length !== ABONO_EVIDENCE_CONSTRAINTS.length
        || ABONO_EVIDENCE_CONSTRAINTS.some(([table, name, definition]) => {
          const row = evidenceConstraints.rows.find((r) => r.table_name === table && r.name === name);
          return !row || normalize(row.definition) !== normalize(definition)
            || row.convalidated !== true || row.condeferrable !== false
            || row.condeferred !== false || row.index_valid !== true;
        })) {
        throw new Error("Limited startup A+C evidence constraint mismatch.");
      }
      const evidenceCatalog = await client.query(`
        SELECT c.relname AS table_name, t.tgname AS trigger_name, t.tgenabled,
                t.tgtype, t.tgconstraint <> 0 AS has_constraint,
                t.tgdeferrable, t.tginitdeferred,
                p.proname AS function_name, fn.nspname AS function_schema,
                p.prosrc, p.prokind, p.provolatile,
               p.proparallel, p.prosecdef, p.proleakproof, p.proisstrict,
               p.proretset, p.proacl, p.proconfig,
               l.lanname AS language_name, r.rolname AS owner_name,
               pg_get_function_result(p.oid) AS result_type,
               pg_get_function_identity_arguments(p.oid) AS identity_arguments,
               octet_length(t.tgargs) AS args_length, t.tgattr::text AS trigger_attr,
               t.tgparentid <> 0 AS has_parent, t.tgqual IS NOT NULL AS has_qual
        FROM pg_trigger t
        JOIN pg_class c ON c.oid=t.tgrelid
        JOIN pg_namespace n ON n.oid=c.relnamespace
        JOIN pg_proc p ON p.oid=t.tgfoid
        JOIN pg_namespace fn ON fn.oid=p.pronamespace
        JOIN pg_language l ON l.oid=p.prolang
        JOIN pg_roles r ON r.oid=p.proowner
         WHERE n.nspname='public'
          AND (c.relname IN ('finalizaciones_abono_e2','evidencia_no_aplicada_e2')
            OR t.tgname = ANY($1::text[])) AND NOT t.tgisinternal
      `, [[...ABONO_EVIDENCE_TRIGGER_EXPECTATIONS.map(([, trigger]) => trigger)]]);
      if (evidenceCatalog.rows.length !== ABONO_EVIDENCE_TRIGGER_EXPECTATIONS.length) {
        throw new Error("Limited startup A+C evidence trigger inventory mismatch.");
      }
      for (const [table, trigger, type, functionName, constrained] of ABONO_EVIDENCE_TRIGGER_EXPECTATIONS) {
        const row = evidenceCatalog.rows.find((candidate) => candidate.trigger_name === trigger);
        const expectedHash = ABONO_EVIDENCE_FUNCTION_HASHES[functionName];
        const sourceHash = createHash("sha256").update(String(row?.prosrc ?? ""), "utf8").digest("hex");
        if (!row || row.table_name !== table || row.tgenabled !== "O"
          || Number(row.tgtype) !== type || row.function_name !== functionName
           || row.function_schema !== "public"
          || row.has_constraint !== constrained || Number(row.args_length) !== 0
           || row.tgdeferrable !== constrained || row.tginitdeferred !== constrained
          || row.trigger_attr !== "" || row.has_parent !== false || row.has_qual !== false
          || row.prokind !== "f" || row.provolatile !== "v" || row.proparallel !== "u"
          || row.prosecdef !== false || row.proleakproof !== false
          || row.proisstrict !== false || row.proretset !== false || row.proacl !== null
          || JSON.stringify(row.proconfig) !== JSON.stringify(["search_path=pg_catalog, public"])
          || row.language_name !== "plpgsql" || row.owner_name !== "postgres"
          || row.result_type !== "trigger" || row.identity_arguments !== ""
          || sourceHash !== expectedHash) {
          throw new Error(`Limited startup A+C evidence trigger ${trigger} mismatch.`);
        }
      }
      for (const [functionName, identityArguments] of [
        ["e2_finalize_new_abono", "p_abono_id integer, p_productor text, p_resultado text, p_aplicado_cents bigint, p_evaluacion jsonb, p_contrato_revision text"],
        ["e2_attest_new_retained", "p_clave uuid"],
      ] as const) {
      const finalizer = await client.query(`
        SELECT p.prosrc, p.prokind, p.provolatile, p.proparallel, p.prosecdef,
               p.proleakproof, p.proisstrict, p.proretset, p.proacl, p.proconfig,
               l.lanname AS language_name, r.rolname AS owner_name,
               pg_get_function_result(p.oid) AS result_type,
               pg_get_function_identity_arguments(p.oid) AS identity_arguments
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid=p.pronamespace
        JOIN pg_language l ON l.oid=p.prolang
        JOIN pg_roles r ON r.oid=p.proowner
         WHERE n.nspname='public' AND p.proname=$1
      `, [functionName]);
      const row = finalizer.rows[0];
      const sourceHash = createHash("sha256").update(String(row?.prosrc ?? ""), "utf8").digest("hex");
      if (finalizer.rows.length !== 1 || !row
        || row.prokind !== "f" || row.provolatile !== "v" || row.proparallel !== "u"
        || row.prosecdef !== false || row.proleakproof !== false
        || row.proisstrict !== false || row.proretset !== false || row.proacl !== null
        || JSON.stringify(row.proconfig) !== JSON.stringify(["search_path=pg_catalog, public"])
        || row.language_name !== "plpgsql" || row.owner_name !== "postgres"
        || row.result_type !== "void"
        || row.identity_arguments !== identityArguments
        || sourceHash !== ABONO_EVIDENCE_FUNCTION_HASHES[functionName]) {
        throw new Error("Limited startup A+C evidence finalizer mismatch.");
      }
      }
    }

    const guardsResult = await client.query(`
      SELECT c.relname AS table_name, t.tgname AS trigger_name, t.tgenabled,
             t.tgtype, p.proname AS function_name, p.prosrc AS function_source,
             p.prokind, p.provolatile, p.proparallel, p.prosecdef, p.proleakproof,
             p.proisstrict, p.proretset, p.proacl, p.proconfig,
             pg_get_function_result(p.oid) AS result_type,
             l.lanname AS language_name, r.rolname AS owner_name,
             fn.nspname AS function_schema, octet_length(t.tgargs) AS args_length,
             t.tgattr::text AS trigger_attr, t.tgconstraint <> 0 AS has_constraint,
             t.tgparentid <> 0 AS has_parent, t.tgqual IS NOT NULL AS has_qual,
             EXISTS (
               SELECT 1
               FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
               WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
             ) AS public_execute
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_proc p ON p.oid = t.tgfoid
      JOIN pg_namespace fn ON fn.oid = p.pronamespace
      JOIN pg_language l ON l.oid = p.prolang
      JOIN pg_roles r ON r.oid = p.proowner
      WHERE n.nspname = 'public' AND c.relname = ANY($1::text[]) AND NOT t.tgisinternal
    `, [[...new Set(E1_TRIGGER_EXPECTATIONS.map(([table]) => table))]]);
    // A+C adds one independently verified trigger on movimientos_credito.
    // Exclude only that exact row after its complete validation above.
    const e1GuardRows = guardsResult.rows.filter((row) => !(
      checkEvidence
      && row.table_name === "movimientos_credito"
      && row.trigger_name === "e2_abono_finalization_complete"
    ));
    if (e1GuardRows.length !== E1_TRIGGER_EXPECTATIONS.length) {
      throw new Error("Limited startup permanent E1 trigger inventory mismatch.");
    }
    for (const [table, trigger, triggerType, functionName] of E1_TRIGGER_EXPECTATIONS) {
      const row = guardsResult.rows.find((candidate) => candidate.trigger_name === trigger);
      if (!row || row.table_name !== table || row.tgenabled !== "O"
        || Number(row.tgtype) !== triggerType || row.function_name !== functionName
        || row.function_schema !== "public" || Number(row.args_length) !== 0
        || row.trigger_attr !== "" || row.has_constraint !== false
        || row.has_parent !== false || row.has_qual !== false
        || row.prokind !== "f" || row.provolatile !== "v"
        || row.language_name !== "plpgsql" || row.owner_name !== "postgres"
        || row.result_type !== "trigger" || row.public_execute !== true) {
        throw new Error(`Limited startup permanent E1 trigger ${trigger} mismatch.`);
      }
    }
    for (const guard of GUARDS) {
      const row = guardsResult.rows.find((candidate) => candidate.trigger_name === guard.trigger);
      const expectedSource = guard.code === "E1C01"
        ? CASH_GUARD_SOURCE[approval.guardState]
        : OTHER_GUARD_SOURCE[guard.code];
      const expectedTriggerType = guard.code === "E1C01" ? 5 : 4;
      if (
        !row
        || row.table_name !== guard.table
        || row.function_name !== guard.function
        || row.tgenabled !== "O"
        || Number(row.tgtype) !== expectedTriggerType
        || row.function_source !== expectedSource
        || row.prokind !== "f"
        || row.provolatile !== "v"
        || row.proparallel !== "u"
        || row.prosecdef !== false
        || row.proleakproof !== false
        || row.proisstrict !== false
        || row.proretset !== false
        || row.proacl !== null
        || JSON.stringify(row.proconfig) !== JSON.stringify(["search_path=pg_catalog, public"])
        || row.result_type !== "trigger"
        || row.language_name !== "plpgsql"
        || row.owner_name !== "postgres"
        || row.public_execute !== true
      ) {
        throw new Error(`Limited startup guard ${guard.code} is missing, disabled, or mismatched.`);
      }
    }
    const auditGuard = guardsResult.rows.find(
      (candidate) => candidate.trigger_name === "auditoria_append_only",
    );
    if (
      auditGuard?.function_source !== AUDIT_APPEND_ONLY_SOURCE
      || auditGuard.language_name !== "plpgsql"
      || auditGuard.owner_name !== "postgres"
      || auditGuard.public_execute !== true
    ) {
      throw new Error("Limited startup audit append-only guard mismatch.");
    }

    await client.query("COMMIT");
    transactionOpen = false;
    return {
      identity: {
        databaseName: String(identity.database_name),
        databaseOid: String(identity.database_oid),
        schemaName: String(identity.schema_name),
      },
      revision: manifest.revision,
      checked: {
        columns: manifest.columns.length,
        constraints: manifest.constraints.length,
        indexes: manifest.indexes.length,
        guards: E1_TRIGGER_EXPECTATIONS.length,
      },
    };
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the fail-closed preflight error; release still always occurs.
      }
    }
    throw error;
  } finally {
    client.release();
  }
}