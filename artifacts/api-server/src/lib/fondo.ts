import { createHash } from "node:crypto";
import { E12_SUPPLIER_CASH_ENABLED } from "./e12-supplier-cash";

export type FondoQueryResult<T = Record<string, unknown>> = { rows: T[]; rowCount?: number | null };
export interface FondoExecutor {
  query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<FondoQueryResult<T>>;
}
export interface FondoPool extends FondoExecutor {
  connect(): Promise<FondoExecutor & { release(): void }>;
}
export type FondoActor = { id: number; nombre: string; rol: string; ip: string };

export class FondoError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const MONEY = /^(0|[1-9][0-9]*)\.[0-9]{2}$/;
const MAX_CENTS = 9_223_372_036_854_775_807n;
const PRODUCER_MOVIMIENTO = "FONDO_API_MOVIMIENTO_V1";
const PRODUCER_INVERSO = "FONDO_API_INVERSO_V1";
const PRODUCER_ARQUEO = "FONDO_API_ARQUEO_V1";
const LOCK_KEY = 0x463130;

export function parseMoney(value: string): bigint {
  if (!MONEY.test(value)) throw new FondoError(400, "VALIDATION_ERROR", "Importe monetario inválido.");
  const [units, cents] = value.split(".");
  const result = BigInt(units) * 100n + BigInt(cents);
  if (result > MAX_CENTS) throw new FondoError(400, "VALIDATION_ERROR", "Importe monetario fuera de rango.");
  return result;
}

export function formatMoney(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  return `${negative ? "-" : ""}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, "0")}`;
}

export function canonicalPayload(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalPayload).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalPayload(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function payloadHash(value: unknown): string {
  return createHash("sha256").update(canonicalPayload(value)).digest("hex");
}

function signed(row: { naturaleza: string; importe_centavos: string | bigint }): bigint {
  const amount = BigInt(row.importe_centavos);
  return row.naturaleza === "INGRESO" ? amount : -amount;
}

type IdentityRow = { id: string; ubicacion_id: number; ubicacion_nombre: string };
async function identity(db: FondoExecutor): Promise<IdentityRow> {
  const result = await db.query<IdentityRow>(`
    SELECT f.id, f.ubicacion_id, u.nombre AS ubicacion_nombre
      FROM fondo_mariana f
      JOIN ubicaciones u ON u.id = f.ubicacion_id
     WHERE u.activa IS TRUE AND u.tipo::text = 'TIENDA'
       AND upper(btrim(u.nombre)) = 'MARIANA'`);
  if (result.rows.length !== 1) {
    throw new FondoError(503, "FONDO_MARIANA_IDENTITY_INVALID", "La identidad fija del Fondo de Mariana no es válida.");
  }
  return result.rows[0];
}

type MovementRow = {
  id: string; ordinal: string | bigint; fondo_id: string; naturaleza: string; categoria: string;
  importe_centavos: string | bigint; motivo: string; autor_id: number; autor_nombre: string;
  original_id: string | null; inverso_id: string | null; created_at: Date | string;
  conciliacion_inicial: { efectivoFisicoContado: string; declaracionSinDuplicacion: true; evidencia: string } | null;
};
type ArqueoRow = {
  id: string; fondo_id: string; saldo_sistema_centavos: string | bigint;
  efectivo_contado_centavos: string | bigint; diferencia_centavos: string | bigint;
  version_saldo: string | null; motivo: string; autor_id: number; autor_nombre: string;
  created_at: Date | string;
};

export function movementDto(row: MovementRow) {
  const amount = BigInt(row.importe_centavos);
  return {
    id: row.id, ordinal: String(row.ordinal), fondoId: row.fondo_id, naturaleza: row.naturaleza, categoria: row.categoria,
    importe: formatMoney(amount), importeFirmado: formatMoney(signed(row)), motivo: row.motivo,
    fecha: new Date(row.created_at).toISOString(), autor: { id: row.autor_id, nombre: row.autor_nombre },
    esInverso: row.original_id !== null,
    advertencia: row.original_id === null ? null : "Corrección contable; no representa un movimiento físico nuevo." as const,
    conciliacionInicial: row.conciliacion_inicial,
    originalId: row.original_id, inversoId: row.inverso_id,
  };
}
function arqueoDto(row: ArqueoRow) {
  return {
    id: row.id, fondoId: row.fondo_id, saldoSistema: formatMoney(BigInt(row.saldo_sistema_centavos)),
    efectivoContado: formatMoney(BigInt(row.efectivo_contado_centavos)),
    diferencia: formatMoney(BigInt(row.diferencia_centavos)), versionSaldo: row.version_saldo,
    fecha: new Date(row.created_at).toISOString(), autor: { id: row.autor_id, nombre: row.autor_nombre },
    motivo: row.motivo,
  };
}

const MOVEMENT_SELECT = `
  SELECT m.id,m.ordinal,m.fondo_id,m.naturaleza,m.categoria,m.importe_centavos,m.motivo,m.conciliacion_inicial,
         m.autor_id,u.nombre AS autor_nombre,m.original_id,
         inv.id AS inverso_id,m.created_at
    FROM fondo_movimientos m JOIN usuarios u ON u.id=m.autor_id
    LEFT JOIN fondo_movimientos inv ON inv.original_id=m.id`;
const ARQUEO_SELECT = `
  SELECT a.id,a.fondo_id,a.saldo_sistema_centavos,a.efectivo_contado_centavos,
         a.diferencia_centavos,a.version_saldo,a.motivo,a.autor_id,
         u.nombre AS autor_nombre,a.created_at
    FROM fondo_arqueos a JOIN usuarios u ON u.id=a.autor_id`;

async function transaction<T>(pool: FondoPool, isolation: "READ COMMITTED" | "REPEATABLE READ", work: (tx: FondoExecutor) => Promise<T>): Promise<T> {
  const tx = await pool.connect();
  try {
    await tx.query(`BEGIN ISOLATION LEVEL ${isolation}`);
    const result = await work(tx);
    await tx.query("COMMIT");
    return result;
  } catch (error) {
    await tx.query("ROLLBACK");
    throw error;
  } finally {
    tx.release();
  }
}

export async function lockFondoTransaction(tx: FondoExecutor): Promise<void> {
  await tx.query("SELECT pg_advisory_xact_lock($1)", [LOCK_KEY]);
}
const lock = lockFondoTransaction;
export async function saldoFondoEnTransaccion(tx: FondoExecutor) {
  await lock(tx);
  const fondo = await identity(tx);
  const state = await ledgerState(tx, fondo.id);
  return { saldo: formatMoney(state.saldo), versionSaldo: state.version };
}
async function ledgerState(tx: FondoExecutor, fondoId: string) {
  const state = await tx.query<{ saldo: string; version: string | null; total: string; ultima_fecha: Date | null }>(`
    SELECT COALESCE(SUM(CASE WHEN naturaleza='INGRESO' THEN importe_centavos ELSE -importe_centavos END),0)::text saldo,
           (array_agg(id ORDER BY ordinal DESC))[1]::text version,
           count(*)::text total,max(created_at) ultima_fecha
      FROM fondo_movimientos WHERE fondo_id=$1`, [fondoId]);
  return { saldo: BigInt(state.rows[0].saldo), version: state.rows[0].version, total: Number(state.rows[0].total), ultimaFecha: state.rows[0].ultima_fecha };
}

async function existingReplay(tx: FondoExecutor, producer: string, key: string, hash: string, table: "fondo_movimientos" | "fondo_arqueos") {
  const found = await tx.query<{ id: string; payload_hash: string }>(
    `SELECT id,payload_hash FROM ${table} WHERE idempotency_producer=$1 AND idempotency_key=$2`, [producer, key]);
  if (!found.rows[0]) return null;
  if (found.rows[0].payload_hash !== hash) throw new FondoError(409, "IDEMPOTENCY_CONFLICT", "La llave de reintento ya fue usada con otros datos.");
  return found.rows[0].id;
}

async function audit(tx: FondoExecutor, actor: FondoActor, siteId: number, action: string, entity: string, entityId: string, after: Record<string, unknown>) {
  await tx.query(`INSERT INTO auditoria
    (usuario_id,usuario_snapshot,rol_snapshot,sitio_id,sitio_snapshot,modulo,accion,entidad,entidad_id,datos_despues,ip)
    VALUES ($1,$2,$3,$4,'Mariana','FONDO',$5,$6,$7,$8::jsonb,$9)`,
  [actor.id, actor.nombre, actor.rol, siteId, action, entity, entityId, JSON.stringify(after), actor.ip]);
}

async function getMovement(tx: FondoExecutor, id: string) {
  const row = await tx.query<MovementRow>(`${MOVEMENT_SELECT} WHERE m.id=$1`, [id]);
  if (!row.rows[0]) throw new FondoError(404, "FONDO_MOVIMIENTO_NOT_FOUND", "Movimiento no encontrado.");
  return movementDto(row.rows[0]);
}
async function getArqueo(tx: FondoExecutor, id: string) {
  const row = await tx.query<ArqueoRow>(`${ARQUEO_SELECT} WHERE a.id=$1`, [id]);
  if (!row.rows[0]) throw new FondoError(404, "FONDO_ARQUEO_NOT_FOUND", "Arqueo no encontrado.");
  return arqueoDto(row.rows[0]);
}

export async function obtenerResumenEHistorialFondo(pool: FondoPool, filters: { desde?: string; hasta?: string; naturaleza?: string; categoria?: string } = {}) {
  return transaction(pool, "REPEATABLE READ", async (tx) => {
    const fondo = await identity(tx);
    const values: unknown[] = [fondo.id];
    const clauses = ["m.fondo_id=$1"];
    if (filters.desde) { values.push(filters.desde); clauses.push(`m.created_at >= $${values.length}::date`); }
    if (filters.hasta) { values.push(filters.hasta); clauses.push(`m.created_at < ($${values.length}::date + interval '1 day')`); }
    if (filters.naturaleza) { values.push(filters.naturaleza); clauses.push(`m.naturaleza=$${values.length}`); }
    if (filters.categoria) { values.push(filters.categoria); clauses.push(`m.categoria=$${values.length}`); }
    const [state, movements, lastAudit] = await Promise.all([
      ledgerState(tx, fondo.id),
      tx.query<MovementRow>(`${MOVEMENT_SELECT} WHERE ${clauses.join(" AND ")} ORDER BY m.ordinal DESC`, values),
      tx.query<ArqueoRow>(`${ARQUEO_SELECT} WHERE a.fondo_id=$1 ORDER BY a.created_at DESC,a.id DESC LIMIT 1`, [fondo.id]),
    ]);
    return {
      summary: {
        fondo: { id: fondo.id, nombre: "Fondo de Mariana" as const, ubicacion: { id: fondo.ubicacion_id, nombre: fondo.ubicacion_nombre } },
        saldo: formatMoney(state.saldo), versionSaldo: state.version, totalMovimientos: state.total,
        ultimoMovimientoFecha: state.ultimaFecha ? new Date(state.ultimaFecha).toISOString() : null,
        ultimoArqueo: lastAudit.rows[0] ? arqueoDto(lastAudit.rows[0]) : null,
      },
      movimientos: { items: movements.rows.map(movementDto), saldo: formatMoney(state.saldo), versionSaldo: state.version, total: movements.rows.length },
    };
  });
}

export async function listarArqueosFondo(pool: FondoPool, filters: { desde?: string; hasta?: string } = {}) {
  const fondo = await identity(pool);
  const values: unknown[] = [fondo.id]; const clauses = ["a.fondo_id=$1"];
  if (filters.desde) { values.push(filters.desde); clauses.push(`a.created_at >= $${values.length}::date`); }
  if (filters.hasta) { values.push(filters.hasta); clauses.push(`a.created_at < ($${values.length}::date + interval '1 day')`); }
  const rows = await pool.query<ArqueoRow>(`${ARQUEO_SELECT} WHERE ${clauses.join(" AND ")} ORDER BY a.created_at DESC,a.id DESC`, values);
  return { items: rows.rows.map(arqueoDto), total: rows.rows.length };
}

export async function obtenerMovimientoFondo(pool: FondoPool, id: string) { await identity(pool); return getMovement(pool, id); }
export async function obtenerArqueoFondo(pool: FondoPool, id: string) { await identity(pool); return getArqueo(pool, id); }

type FondoMovementInput = {
  idempotencyKey: string; categoria: string; importe: string; motivo: string;
  conciliacionInicial?: { efectivoFisicoContado: string; declaracionSinDuplicacion: true; evidencia: string };
};
export async function crearMovimientoFondo(pool: FondoPool, actor: FondoActor, input: FondoMovementInput) {
  return transaction(pool, "READ COMMITTED", tx => crearMovimientoFondoEnTransaccion(tx, actor, input));
}
/** E12 only composes this in its existing payment transaction. */
export async function movimientoProveedorFondoEnTransaccion(tx: FondoExecutor, actor: FondoActor, input: {
  importe: string; clave: string; motivo: string; original?: string;
  naturalezaRetorno?: "CORRECCION_CAPTURA" | "RECUPERACION_EFECTIVO";
}) {
  const request = { idempotencyKey: input.clave, motivo: input.motivo.slice(0, 500) };
  return input.original && input.naturalezaRetorno === "CORRECCION_CAPTURA"
    ? invertirMovimientoFondoEnTransaccion(tx, actor, input.original, request, true)
    : crearMovimientoFondoEnTransaccion(tx, actor, { ...request, categoria: input.original ? "OTRO_INGRESO" : "RETIRO", importe: input.importe });
}
/** Integration receives the caller transaction; never connects/commits independently. */
export async function crearMovimientoFondoEnTransaccion(tx: FondoExecutor, actor: FondoActor, input: FondoMovementInput) {
  const hash = payloadHash(input);
    const fondo = await identity(tx); await lock(tx);
    const replay = await existingReplay(tx, PRODUCER_MOVIMIENTO, input.idempotencyKey, hash, "fondo_movimientos");
    if (replay) return { value: await getMovement(tx, replay), replay: true };
    const amount = parseMoney(input.importe); const state = await ledgerState(tx, fondo.id);
    const initial = input.categoria === "SALDO_INICIAL";
    if (state.total === 0 && !initial) {
      throw new FondoError(409, "FONDO_SALDO_INICIAL_INVALIDO", "El primer movimiento debe ser el saldo inicial conciliado.");
    }
    if (initial) {
      if (state.total !== 0 || input.motivo !== "saldo inicial" || !input.conciliacionInicial ||
          input.conciliacionInicial.declaracionSinDuplicacion !== true ||
          parseMoney(input.conciliacionInicial.efectivoFisicoContado) !== amount) {
        throw new FondoError(409, "FONDO_SALDO_INICIAL_INVALIDO", "El saldo inicial debe ser el primer movimiento conciliado.");
      }
    } else if (amount <= 0n) throw new FondoError(400, "VALIDATION_ERROR", "El importe debe ser mayor que cero.");
    const naturaleza = input.categoria === "RETIRO" ? "RETIRO" : "INGRESO";
    if (naturaleza === "RETIRO" && state.saldo < amount) throw new FondoError(409, "FONDO_SALDO_INSUFICIENTE", "Saldo insuficiente.");
    const inserted = await tx.query<{ id: string }>(`INSERT INTO fondo_movimientos
      (fondo_id,naturaleza,categoria,importe_centavos,motivo,autor_id,idempotency_key,idempotency_producer,payload_hash,conciliacion_inicial)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) RETURNING id`,
    [fondo.id, naturaleza, input.categoria, amount.toString(), input.motivo, actor.id, input.idempotencyKey, PRODUCER_MOVIMIENTO, hash, input.conciliacionInicial ? JSON.stringify(input.conciliacionInicial) : null]);
    await audit(tx, actor, fondo.ubicacion_id, "CREAR", "FONDO_MOVIMIENTO", inserted.rows[0].id, { categoria: input.categoria, importe: input.importe, motivo: input.motivo });
    return { value: await getMovement(tx, inserted.rows[0].id), replay: false };
}

export async function invertirMovimientoFondo(pool: FondoPool, actor: FondoActor, originalId: string, input: { idempotencyKey: string; motivo: string }) {
  return transaction(pool, "READ COMMITTED", tx => invertirMovimientoFondoEnTransaccion(tx, actor, originalId, input));
}
export async function invertirMovimientoFondoEnTransaccion(tx: FondoExecutor, actor: FondoActor, originalId: string, input: { idempotencyKey: string; motivo: string }, supplierIntegration = false) {
  const hash = payloadHash({ originalId, ...input });
    const fondo = await identity(tx); await lock(tx);
    if (E12_SUPPLIER_CASH_ENABLED && !supplierIntegration) {
      const linked = await tx.query(`SELECT 1 FROM proveedor_efectivo_e12
        WHERE movimiento_fondo_id=$1::uuid OR retorno->>'movimientoFondoId'=$1::text LIMIT 1`, [originalId]);
      if (linked.rows.length) throw new FondoError(409, "E12_USE_SUPPLIER_REVERSAL", "Usa el retorno completo del pago a proveedor.");
    }
    const replay = await existingReplay(tx, PRODUCER_INVERSO, input.idempotencyKey, hash, "fondo_movimientos");
    if (replay) return { value: await getMovement(tx, replay), replay: true };
    const found = await tx.query<MovementRow>(`${MOVEMENT_SELECT} WHERE m.id=$1 AND m.fondo_id=$2 FOR UPDATE OF m`, [originalId, fondo.id]);
    const original = found.rows[0];
    if (!original) throw new FondoError(404, "FONDO_MOVIMIENTO_NOT_FOUND", "Movimiento no encontrado.");
    if (original.original_id) throw new FondoError(409, "FONDO_NO_SE_PUEDE_INVERTIR_INVERSO", "Un inverso no puede invertirse.");
    if (original.inverso_id) throw new FondoError(409, "FONDO_MOVIMIENTO_YA_INVERTIDO", "El movimiento ya tiene inverso.");
    const state = await ledgerState(tx, fondo.id);
    const opposite = original.naturaleza === "INGRESO" ? "RETIRO" : "INGRESO";
    const amount = BigInt(original.importe_centavos);
    const inserted = await tx.query<{ id: string }>(`INSERT INTO fondo_movimientos
      (fondo_id,naturaleza,categoria,importe_centavos,motivo,autor_id,original_id,idempotency_key,idempotency_producer,payload_hash)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [fondo.id, opposite, original.categoria, amount.toString(), input.motivo, actor.id, original.id, input.idempotencyKey, PRODUCER_INVERSO, hash]);
    await audit(tx, actor, fondo.ubicacion_id, "INVERTIR", "FONDO_MOVIMIENTO", inserted.rows[0].id, { originalId, motivo: input.motivo });
    return { value: await getMovement(tx, inserted.rows[0].id), replay: false };
}

export async function crearArqueoFondo(pool: FondoPool, actor: FondoActor, input: { idempotencyKey: string; efectivoContado: string; expectedVersionSaldo: string | null; motivo: string }) {
  const hash = payloadHash(input);
  return transaction(pool, "READ COMMITTED", async (tx) => {
    const fondo = await identity(tx); await lock(tx);
    const replay = await existingReplay(tx, PRODUCER_ARQUEO, input.idempotencyKey, hash, "fondo_arqueos");
    if (replay) return { value: await getArqueo(tx, replay), replay: true };
    const state = await ledgerState(tx, fondo.id);
    if (state.version !== input.expectedVersionSaldo) throw new FondoError(409, "FONDO_VERSION_SALDO_OBSOLETA", "El saldo cambió durante el conteo.");
    const counted = parseMoney(input.efectivoContado); const difference = counted - state.saldo;
    const inserted = await tx.query<{ id: string }>(`INSERT INTO fondo_arqueos
      (fondo_id,saldo_sistema_centavos,efectivo_contado_centavos,diferencia_centavos,version_saldo,motivo,autor_id,idempotency_key,idempotency_producer,payload_hash)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [fondo.id, state.saldo.toString(), counted.toString(), difference.toString(), state.version, input.motivo, actor.id, input.idempotencyKey, PRODUCER_ARQUEO, hash]);
    await audit(tx, actor, fondo.ubicacion_id, "ARQUEO", "FONDO_ARQUEO", inserted.rows[0].id, { saldoSistema: formatMoney(state.saldo), efectivoContado: input.efectivoContado, diferencia: formatMoney(difference), versionSaldo: state.version });
    return { value: await getArqueo(tx, inserted.rows[0].id), replay: false };
  });
}