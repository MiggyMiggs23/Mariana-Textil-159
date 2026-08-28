/**
 * BLOQUE 7 cleanup. This is intentionally an operator-only script: it never
 * runs as part of seed/migrations, defaults to inventory mode, and refuses any
 * database other than the explicitly named heliumdb.
 *
 * Inventory: node ./src/scripts/cleanup-bloque-7.mjs --dry-run
 * Apply: HELIUM_CLEANUP_CONFIRM=DELETE_OPERATIONAL_DATA \
 *   node ./src/scripts/cleanup-bloque-7.mjs --apply \
 *   --approved-product-ids=12,34
 *
 * An approved product id is still deleted only when it is unmistakably an
 * automated-test record. The allowlist is deliberately required so that a
 * catalog product can never be removed by a name pattern alone.
 */
import pg from "pg";

const { Pool } = pg;
const CONFIRMATION = "DELETE_OPERATIONAL_DATA";
const TEST_RECORD_PATTERN =
  "^(?:ubsat(?:\\s+sa)?[0-9]{10,}(?:_[0-9]+)?|(?:test|e2e|playwright|cypress|vitest|automated)[ _:-])";
const PRODUCT_TEST_PATTERN =
  "(?:^e2e(?:[ _:-]|container)|satsa[0-9]{10,}_[0-9]+|ubsat(?:\\s+sa)?[0-9]{10,}(?:_[0-9]+)?)";
// Independently verified E2E-container product records. Keeping these IDs in
// inventory detection makes their review visible even if an old SKU format did
// not include the E2E prefix.
const KNOWN_E2E_PRODUCT_IDS = [
  ...Array.from({ length: 20 }, (_, index) => 574 + index),
  953,
  954,
];
const ADVISORY_LOCK = 5_407_054;
// This narrow, reviewed exception exists only for the one-time pilot reset.
// Never broaden it beyond these named financial triggers or include audit.
const IMMUTABLE_DELETE_TRIGGERS = [
  {
    table: "aplicaciones_credito",
    trigger: "aplicaciones_credito_inmutables",
    function: "prevent_financial_record_mutation",
  },
  {
    table: "aplicaciones_pago_proveedor",
    trigger: "aplicaciones_pago_proveedor_append_only",
    function: "proteger_aplicaciones_pago_proveedor",
  },
  {
    table: "movimientos_credito",
    trigger: "movimientos_credito_inmutables",
    function: "prevent_financial_record_mutation",
  },
  {
    table: "pagos_proveedor",
    trigger: "pagos_proveedor_inmutables",
    function: "prevent_pago_proveedor_mutation",
  },
  {
    table: "reimpresiones_etiqueta",
    trigger: "reimpresiones_etiqueta_inmutable",
    function: "bloquear_mutacion_reimpresion_etiqueta",
  },
  {
    table: "ticket_pagos",
    trigger: "ticket_pagos_inmutables",
    function: "prevent_financial_record_mutation",
  },
];
const SAFE_CANDIDATE_COLUMNS = {
  usuarios: ["nombre", "usuario"],
  clientes: ["nombre", "contacto_nombre"],
  proveedores: ["nombre", "contacto_nombre"],
  productos: ["sku", "tela", "color"],
  ubicaciones: ["nombre", "iniciales"],
};

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const dryRun = args.has("--dry-run") || !apply;
if (args.has("--apply") && args.has("--dry-run")) {
  throw new Error("Use sólo uno de --apply o --dry-run.");
}
const allowlistArgument = process.argv.find((value) =>
  value.startsWith("--approved-product-ids="),
);
const approvedProductIds = new Set(
  (allowlistArgument?.split("=")[1] ?? "")
    .split(",")
    .filter(Boolean)
    .map((value) => {
      if (!/^[1-9][0-9]*$/.test(value)) {
        throw new Error(`ID de producto inválido en allowlist: ${value}`);
      }
      return Number(value);
    }),
);

if (apply && process.env.HELIUM_CLEANUP_CONFIRM !== CONFIRMATION) {
  throw new Error(
    `Se rechazó la limpieza: --apply requiere HELIUM_CLEANUP_CONFIRM=${CONFIRMATION}.`,
  );
}
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL es obligatoria.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Ordered children before parents. Every name is verified against pg_catalog
// before it is used; this avoids guessing which optional schema revisions exist.
const operationalTables = [
  "viaje_tickets",
  "viaje_salidas",
  "aplicaciones_credito",
  "aplicaciones_pago_proveedor",
  "notificaciones_credito",
  "ticket_pagos",
  "ticket_lineas",
  "movimientos_credito",
  "pagos_proveedor",
  "contenedor_lineas",
  "reimpresiones_etiqueta",
  "salida_rollos",
  "salida_lineas",
  "viajes",
  "tickets",
  "sesiones_caja",
  "salidas",
  "contenedores",
  "precio_historial",
  "solicitudes_pago_dirigido",
  "notificaciones_sistema",
  "movimientos",
  "existencias",
  "rollos",
  "entradas",
];
const requiredTables = [
  ...operationalTables,
  "clientes",
  "proveedores",
  "productos",
  "ubicaciones",
  "usuarios",
  "permisos_usuario",
  "series_consecutivo",
  "entrada_folio",
  "salida_folio",
  "viaje_folio",
  "ticket_folio",
];

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function tableExists(client, table) {
  const { rows } = await client.query(
    "SELECT to_regclass($1) IS NOT NULL AS present",
    [`public.${table}`],
  );
  return rows[0].present;
}

async function count(client, table, where = "", values = []) {
  const { rows } = await client.query(
    `SELECT count(*)::int AS count FROM public.${quoteIdentifier(table)} ${where}`,
    values,
  );
  return rows[0].count;
}

async function assertSchema(client) {
  const missing = [];
  for (const table of requiredTables) {
    if (!(await tableExists(client, table))) missing.push(table);
  }
  if (missing.length) {
    throw new Error(
      `Esquema incompleto; no se borra nada. Faltan tablas requeridas: ${missing.join(", ")}.`,
    );
  }
}

async function assertSafeCandidateColumns(client, table) {
  const allowed = SAFE_CANDIDATE_COLUMNS[table];
  if (!allowed) throw new Error(`No hay allowlist segura para ${table}.`);
  const { rows } = await client.query(
    `SELECT a.attname
     FROM pg_attribute a
     JOIN pg_class c ON c.oid = a.attrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN pg_type t ON t.oid = a.atttypid
     WHERE n.nspname = 'public' AND c.relname = $1
       AND a.attnum > 0 AND NOT a.attisdropped
       AND a.attname = ANY($2::text[])
     ORDER BY a.attnum`,
    [table, allowed],
  );
  if (rows.length !== allowed.length) {
    throw new Error(
      `Esquema incompatible: falta una columna segura de detección en ${table}; no se borra nada.`,
    );
  }
  return allowed;
}

async function testCandidates(client, table) {
  const columns = await assertSafeCandidateColumns(client, table);
  const searchable = columns.map(quoteIdentifier).join(", ");
  const pattern = table === "productos" ? PRODUCT_TEST_PATTERN : TEST_RECORD_PATTERN;
  const knownIds = table === "productos" ? KNOWN_E2E_PRODUCT_IDS : [];
  const { rows } = await client.query(
    `SELECT id, concat_ws(' ', ${searchable}) AS matched_text
     FROM public.${quoteIdentifier(table)}
     WHERE concat_ws(' ', ${searchable}) ~* $1
        OR id = ANY($2::int[])
     ORDER BY id`,
    [pattern, knownIds],
  );
  return rows;
}

async function inboundReferences(client, parentTable, parentIds) {
  if (!parentIds.length) return [];
  const { rows: constraints } = await client.query(
    `SELECT con.conname, child.relname AS child_table, att.attname AS child_column
     FROM pg_constraint con
     JOIN pg_class parent ON parent.oid = con.confrelid
     JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
     JOIN pg_class child ON child.oid = con.conrelid
     JOIN pg_attribute att ON att.attrelid = child.oid
       AND att.attnum = con.conkey[1]
     WHERE con.contype = 'f' AND parent_ns.nspname = 'public'
       AND parent.relname = $1 AND cardinality(con.conkey) = 1
     ORDER BY child.relname, con.conname`,
    [parentTable],
  );
  const references = [];
  for (const constraint of constraints) {
    const { rows } = await client.query(
      `SELECT count(*)::int AS count FROM public.${quoteIdentifier(constraint.child_table)}
       WHERE ${quoteIdentifier(constraint.child_column)} = ANY($1::int[])`,
      [parentIds],
    );
    if (rows[0].count) references.push({ ...constraint, count: rows[0].count });
  }
  return references;
}

function printCounts(label, counts) {
  console.log(`\n${label}`);
  for (const [table, value] of Object.entries(counts)) console.log(`  ${table}: ${value}`);
}

async function operationalCounts(client) {
  const counts = {};
  for (const table of operationalTables) counts[table] = await count(client, table);
  return counts;
}

async function verifyImmutableDeleteTriggers(client, requireEnabled) {
  const { rows } = await client.query(
    `SELECT table_name, trigger_name, function_name, enabled
     FROM (
       SELECT c.relname AS table_name, t.tgname AS trigger_name,
              p.proname AS function_name, t.tgenabled AS enabled
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_proc p ON p.oid = t.tgfoid
       WHERE n.nspname = 'public' AND NOT t.tgisinternal
     ) trigger_catalog
     WHERE (table_name, trigger_name) IN (
       ('aplicaciones_credito', 'aplicaciones_credito_inmutables'),
       ('aplicaciones_pago_proveedor', 'aplicaciones_pago_proveedor_append_only'),
       ('movimientos_credito', 'movimientos_credito_inmutables'),
       ('pagos_proveedor', 'pagos_proveedor_inmutables'),
       ('reimpresiones_etiqueta', 'reimpresiones_etiqueta_inmutable'),
       ('ticket_pagos', 'ticket_pagos_inmutables')
     )`,
  );
  if (rows.length !== IMMUTABLE_DELETE_TRIGGERS.length) {
    throw new Error("No se encontraron exactamente los seis triggers inmutables autorizados; rollback completo.");
  }
  for (const expected of IMMUTABLE_DELETE_TRIGGERS) {
    const actual = rows.find(
      (row) =>
        row.table_name === expected.table && row.trigger_name === expected.trigger,
    );
    if (
      !actual ||
      actual.function_name !== expected.function ||
      (requireEnabled && actual.enabled !== "O")
    ) {
      throw new Error(
        `Trigger no autorizado o no habilitado: ${expected.table}.${expected.trigger}; rollback completo.`,
      );
    }
  }
}

async function disableAuthorizedImmutableDeleteTriggers(client) {
  await verifyImmutableDeleteTriggers(client, true);
  for (const item of IMMUTABLE_DELETE_TRIGGERS) {
    await client.query(
      `ALTER TABLE public.${quoteIdentifier(item.table)}
       DISABLE TRIGGER ${quoteIdentifier(item.trigger)}`,
    );
  }
}

async function enableAuthorizedImmutableDeleteTriggers(client) {
  for (const item of IMMUTABLE_DELETE_TRIGGERS) {
    await client.query(
      `ALTER TABLE public.${quoteIdentifier(item.table)}
       ENABLE TRIGGER ${quoteIdentifier(item.trigger)}`,
    );
  }
  await verifyImmutableDeleteTriggers(client, true);
}

async function resetCounters(client) {
  await client.query(
    `INSERT INTO series_consecutivo (id, ultimo_numero) VALUES (1, 1000000)
     ON CONFLICT (id) DO UPDATE SET ultimo_numero = EXCLUDED.ultimo_numero`,
  );
  await client.query(
    `INSERT INTO entrada_folio (ubicacion_id, ultimo_folio)
     SELECT id, 99 FROM ubicaciones
     ON CONFLICT (ubicacion_id) DO UPDATE SET ultimo_folio = EXCLUDED.ultimo_folio`,
  );
  await client.query(
    `INSERT INTO salida_folio (ubicacion_id, ultimo_folio)
     SELECT id, 0 FROM ubicaciones
     ON CONFLICT (ubicacion_id) DO UPDATE SET ultimo_folio = EXCLUDED.ultimo_folio`,
  );
  await client.query(
    `INSERT INTO ticket_folio (id, ultimo_folio) VALUES (1, 999)
     ON CONFLICT (id) DO UPDATE SET ultimo_folio = EXCLUDED.ultimo_folio`,
  );
}

async function deleteCandidates(client, table, ids) {
  if (!ids.length) return 0;
  const result = await client.query(
    `DELETE FROM public.${quoteIdentifier(table)} WHERE id = ANY($1::int[])`,
    [ids],
  );
  return result.rowCount;
}

async function idsExceptCandidates(client, table, candidateIds) {
  const { rows } = await client.query(
    `SELECT id FROM public.${quoteIdentifier(table)}
     WHERE NOT (id = ANY($1::int[])) ORDER BY id`,
    [candidateIds],
  );
  return rows.map((row) => row.id);
}

async function assertIdsPreserved(client, table, ids) {
  const remaining = ids.length
    ? await count(client, table, "WHERE id = ANY($1::int[])", [ids])
    : 0;
  if (remaining !== ids.length) {
    throw new Error(
      `Validación de preservación falló para ${table}: se esperaban ${ids.length} registros reales y quedaron ${remaining}.`,
    );
  }
}

try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [ADVISORY_LOCK]);
    const { rows: identity } = await client.query(
      "SELECT current_database() AS database",
    );
    if (identity[0]?.database !== "heliumdb") {
      throw new Error(
        `Se rechazó la limpieza: current_database() es "${identity[0]?.database ?? "desconocida"}", no heliumdb.`,
      );
    }
    await assertSchema(client);

    const before = await operationalCounts(client);
    const preservedBefore = {
      clientes: await count(client, "clientes"),
      proveedores: await count(client, "proveedores"),
      ubicaciones: await count(client, "ubicaciones"),
      usuarios: await count(client, "usuarios"),
      productos: await count(client, "productos"),
      permisos_usuario: await count(client, "permisos_usuario"),
    };
    const candidates = {};
    for (const table of ["usuarios", "clientes", "proveedores", "productos", "ubicaciones"]) {
      candidates[table] = await testCandidates(client, table);
    }
    const preservedIds = {};
    for (const table of ["usuarios", "clientes", "proveedores", "productos", "ubicaciones"]) {
      preservedIds[table] = await idsExceptCandidates(
        client,
        table,
        candidates[table].map((row) => row.id),
      );
    }
    const realUserPermissionCount = await count(
      client,
      "permisos_usuario",
      "WHERE NOT (usuario_id = ANY($1::int[]))",
      [candidates.usuarios.map((row) => row.id)],
    );

    printCounts("Inventario operacional antes de limpiar", before);
    printCounts("Registros preservados antes de limpiar", preservedBefore);
    console.log("\nProductos: total =", preservedBefore.productos);
    console.log(
      "Muestra de productos claramente automatizados:",
      candidates.productos.slice(0, 20),
    );
    for (const table of Object.keys(candidates)) {
      console.log(`Candidatos automatizados ${table}:`, candidates[table]);
    }

    if (dryRun) {
      console.log("\nDRY RUN: no se ejecutó DELETE, UPDATE ni INSERT; transacción revertida.");
      await client.query("ROLLBACK");
    } else {
      // Verified immediately before the deletion phase. ALTER TABLE is
      // transactional: any error below rolls these six changes back too.
      await disableAuthorizedImmutableDeleteTriggers(client);
      for (const table of operationalTables) {
        await client.query(`DELETE FROM public.${quoteIdentifier(table)}`);
      }
      // Restore the precise six triggers before any subsequent cleanup work.
      await enableAuthorizedImmutableDeleteTriggers(client);

    // Decide retention before touching a candidate or any of its children.
    // A blocking reference (especially immutable audit evidence) retains the
    // entire candidate subtree unchanged rather than partially cleaning it.
    const deletionReport = {};
    const candidateDeletionPlans = [];
    for (const table of ["usuarios", "clientes", "proveedores", "ubicaciones"]) {
      const ids = candidates[table].map((row) => row.id);
      const blockers = await inboundReferences(client, table, ids);
      if (blockers.length) {
        deletionReport[table] = { deleted: 0, retained: ids, blockers };
      } else {
        candidateDeletionPlans.push({ table, ids });
        deletionReport[table] = { deleted: 0, retained: [], blockers: [] };
      }
    }
    for (const plan of candidateDeletionPlans) {
      deletionReport[plan.table].deleted = await deleteCandidates(
        client,
        plan.table,
        plan.ids,
      );
    }

    const allowedProductIds = candidates.productos
      .map((row) => row.id)
      .filter((id) => approvedProductIds.has(id));
    const productBlockers = await inboundReferences(client, "productos", allowedProductIds);
    deletionReport.productos = productBlockers.length
      ? { deleted: 0, retained: allowedProductIds, blockers: productBlockers }
      : { deleted: await deleteCandidates(client, "productos", allowedProductIds), retained: [], blockers: [] };

    await resetCounters(client);
    const after = await operationalCounts(client);
    const preservedAfter = {
      clientes: await count(client, "clientes"),
      proveedores: await count(client, "proveedores"),
      ubicaciones: await count(client, "ubicaciones"),
      usuarios: await count(client, "usuarios"),
      productos: await count(client, "productos"),
      permisos_usuario: await count(client, "permisos_usuario"),
    };
    if (Object.values(after).some((value) => value !== 0)) {
      throw new Error("Validación falló: quedó información operacional; rollback completo.");
    }
    for (const table of Object.keys(preservedIds)) {
      await assertIdsPreserved(client, table, preservedIds[table]);
    }
    const realUserPermissionsAfter = await count(
      client,
      "permisos_usuario",
      "WHERE NOT (usuario_id = ANY($1::int[]))",
      [candidates.usuarios.map((row) => row.id)],
    );
    if (realUserPermissionsAfter !== realUserPermissionCount) {
      throw new Error(
        "Validación de preservación falló: se alteraron permisos de usuarios no identificados como pruebas.",
      );
    }
    const { rows: counterCheck } = await client.query(`
      SELECT
        (SELECT ultimo_numero = 1000000 FROM series_consecutivo WHERE id = 1) AS series_ok,
        (SELECT count(*) = count(*) FILTER (WHERE ultimo_folio = 99) FROM entrada_folio) AS entradas_ok,
        (SELECT count(*) = count(*) FILTER (WHERE ultimo_folio = 0) FROM salida_folio) AS salidas_ok,
        (SELECT ultimo_folio = 999 FROM ticket_folio WHERE id = 1) AS tickets_ok
    `);
    if (!Object.values(counterCheck[0]).every(Boolean)) {
      throw new Error("Validación de contadores falló; rollback completo.");
    }
    console.log("\nEliminación de candidatos automatizados:", JSON.stringify(deletionReport, null, 2));
    printCounts("Inventario operacional después de limpiar", after);
    printCounts("Registros preservados después de limpiar", preservedAfter);
    // Final fail-closed post-condition immediately before commit.
    await verifyImmutableDeleteTriggers(client, true);
    await client.query("COMMIT");
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}