import type { Pool, PoolClient } from "pg";
import {
  CLEARED_TABLES, COUNTER_TABLES, MIXED_TABLES, PRESERVED_TABLES,
  PROTECT_CUSTOMERS, REQUIRED_TABLES, RESET_CONFIRMATION, RESET_MESSAGE,
} from "./manifest";

export class TestResetError extends Error {
  constructor(message: string, public readonly status = 409) { super(message); }
}
const quoted = (name: string) => `"${name.replaceAll('"', '""')}"`;
const table = (name: string) => `public.${quoted(name)}`;
const classified = new Set<string>([...CLEARED_TABLES, ...COUNTER_TABLES, ...MIXED_TABLES, ...PRESERVED_TABLES]);

export async function inspectResetSchema(client: Pick<PoolClient, "query">) {
  const { rows } = await client.query<{ name: string; kind: string }>(`
    SELECT c.relname AS name,c.relkind AS kind FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p','f') ORDER BY c.relname`);
  const names = rows.map(row => row.name);
  const unknown = rows.filter(row => !classified.has(row.name) || row.kind !== "r").map(row => row.name);
  const missing = REQUIRED_TABLES.filter(name => !names.includes(name));
  if (unknown.length || missing.length) throw new TestResetError(
    `Reinicio bloqueado: esquema sin clasificar (${unknown.join(", ") || "ninguno"}); tablas requeridas ausentes (${missing.join(", ") || "ninguna"}). No se borró nada.`,
  );
  return names;
}

/** Additive installation only. Not invoked on ordinary startup or GET. */
async function ensureHistory(client: PoolClient) {
  await client.query(`CREATE TABLE IF NOT EXISTS public.test_reset_history (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id integer NOT NULL REFERENCES public.usuarios(id),
    actor_usuario text NOT NULL,
    executed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    protected_customers boolean NOT NULL,
    cleared_tables jsonb NOT NULL
  )`);
  // This evidence outlives each reset. Its guard is NEVER disabled by this feature.
  await client.query(`CREATE OR REPLACE FUNCTION public.test_reset_history_immutable()
    RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'El historial de reinicios no admite borrado ni modificación';
    END $$`);
  await client.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.test_reset_history'::regclass AND tgname='test_reset_history_immutable') THEN
      CREATE TRIGGER test_reset_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
      ON public.test_reset_history FOR EACH STATEMENT EXECUTE FUNCTION public.test_reset_history_immutable();
    END IF;
  END $$`);
}

/**
 * No DATABASE_URL access here: caller supplies its explicitly selected pool.
 * ALL DDL, trigger state, truncation, counters and history commit atomically.
 * No CASCADE and no session_replication_role; unclassified/FK-linked tables abort.
 */
export async function resetTestData(
  pool: Pool,
  input: { actorId: number; sessionId: string; confirmation: unknown },
  options: { enabled: boolean; protectCustomers?: boolean },
) {
  if (!options.enabled) throw new TestResetError("Reinicio temporal de pruebas deshabilitado.", 404);
  if (input.confirmation !== RESET_CONFIRMATION) throw new TestResetError('Escribe exactamente BORRAR para confirmar.', 400);
  const protectCustomers = options.protectCustomers ?? PROTECT_CUSTOMERS;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='10s'");
    await client.query("SET LOCAL statement_timeout='60s'");
    await client.query("SELECT pg_advisory_xact_lock(19670925, 1)");
    const names = await inspectResetSchema(client);
    // Prevent concurrent auth, writers and schema changes on every classified table.
    await client.query(`LOCK TABLE ${names.map(table).join(", ")} IN ACCESS EXCLUSIVE MODE`);
    const actor = await client.query<{ usuario: string }>(`
      SELECT u.usuario FROM public.usuarios u JOIN public.sesiones s ON s.usuario_id=u.id
      WHERE u.id=$1 AND u.activo AND u.rol='ADMIN' AND s.id=$2 AND s.expira_at>now()`,
    [input.actorId, input.sessionId]);
    if (!actor.rows[0]) throw new TestResetError("La sesión ADMIN ya no está vigente. Vuelve a iniciar sesión.", 403);
    await ensureHistory(client);
    // INE/profile attachments are customer master data, not credit documents.
    // Keep their metadata and storage references whenever customers are protected.
    const cleared = CLEARED_TABLES.filter(name => names.includes(name)
      && !(protectCustomers && name === "cliente_documentos"));
    const changed = [...cleared, ...COUNTER_TABLES.filter(name => names.includes(name)),
      ...MIXED_TABLES.filter(name => names.includes(name))];
    const triggers = await client.query<{ relation: string; name: string; mode: string }>(`
      SELECT c.relname AS relation,t.tgname AS name,t.tgenabled AS mode
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND NOT t.tgisinternal AND c.relname=ANY($1::text[])`,
    [changed]);
    // Existing immutable business guards are bypassed ONLY on the named affected
    // tables under exclusive locks and restored before COMMIT, including D/R/A modes.
    for (const trigger of triggers.rows) {
      await client.query(`ALTER TABLE ${table(trigger.relation)} DISABLE TRIGGER ${quoted(trigger.name)}`);
    }
    await client.query(`TRUNCATE TABLE ${cleared.map(table).join(", ")} RESTART IDENTITY`);
    if (names.includes("e11_resoluciones")) await client.query("DELETE FROM public.e11_resoluciones WHERE accion <> 'PERFIL'");
    if (names.includes("e11_operaciones")) await client.query("DELETE FROM public.e11_operaciones WHERE operacion <> 'PERFIL'");
    if (!protectCustomers) await client.query("DELETE FROM public.clientes WHERE NOT es_sistema");
    // Legacy balance is a cache, never part of the protected customer profile.
    await client.query("UPDATE public.clientes SET saldo_credito=0 WHERE saldo_credito<>0");
    for (const name of COUNTER_TABLES.filter(name => names.includes(name))) {
      if (name === "series_consecutivo") {
        await client.query("UPDATE public.series_consecutivo SET ultimo_numero=10000000");
        await client.query("INSERT INTO public.series_consecutivo(id,ultimo_numero) VALUES(1,10000000) ON CONFLICT(id) DO NOTHING");
      } else {
        await client.query(`UPDATE ${table(name)} SET ultimo_folio=0`);
        const columns = await client.query<{ column_name: string }>(
          "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1", [name]);
        const key = name === "recibo_folio_e3" ? "sitio_id"
          : columns.rows.some(row => row.column_name === "ubicacion_id") ? "ubicacion_id" : "id";
        if (key !== "id") await client.query(`INSERT INTO ${table(name)}(${quoted(key)},ultimo_folio)
          SELECT id,0 FROM public.ubicaciones ON CONFLICT(${quoted(key)}) DO NOTHING`);
        else await client.query(`INSERT INTO ${table(name)}(id,ultimo_folio) VALUES(1,0) ON CONFLICT(id) DO NOTHING`);
      }
    }
    for (const trigger of triggers.rows) {
      const mode = { O: "ENABLE", D: "DISABLE", R: "ENABLE REPLICA", A: "ENABLE ALWAYS" }[trigger.mode];
      if (!mode) throw new TestResetError("Estado de protección de tabla desconocido.");
      await client.query(`ALTER TABLE ${table(trigger.relation)} ${mode} TRIGGER ${quoted(trigger.name)}`);
    }
    await client.query(`INSERT INTO public.test_reset_history(actor_id,actor_usuario,protected_customers,cleared_tables)
      VALUES($1,$2,$3,$4::jsonb)`, [input.actorId, actor.rows[0].usuario, protectCustomers, JSON.stringify(cleared)]);
    await client.query("COMMIT");
    return { success: true as const, requiresLogin: true as const, message: RESET_MESSAGE };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}