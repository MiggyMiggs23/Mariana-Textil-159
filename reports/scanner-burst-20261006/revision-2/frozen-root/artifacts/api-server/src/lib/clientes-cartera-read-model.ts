import type { AuthContext } from "../middlewares/auth";
import {
  loadCustomerCreditProjections,
  type CustomerCreditProjection,
  type CreditLedgerQuery,
} from "./credit-aging-read-model";
import { pool } from "@workspace/db";

export type CarteraScopeType = "GLOBAL" | "SITIOS";

export type CarteraScope = {
  tipo: CarteraScopeType;
  ubicaciones: Array<{ id: number; nombre: string }>;
  generadoEn: string;
  saldoAFavorDisponible: boolean;
};

export type CarteraResumen = {
  totalClientes: number;
  clientesConSaldo: number;
  totalCartera: string;
  totalVencido: string;
};

export type CarteraCliente = {
  id: number;
  nombre: string;
  saldo: string;
  saldoActual: string;
  saldoAFavor: string | null;
  porVencer: string;
  sinPlazo: string;
  "1_30": string;
  "31_60": string;
  "61_90": string;
  mas90: string;
  antiguedad: string;
  diasVencido: number;
  vencido: string;
  primerVencimiento: string | null;
};

export type CarteraReadModel = {
  resumen: CarteraResumen;
  clientes: CarteraCliente[];
  alcance: CarteraScope;
};

export type CarteraQuery = {
  ubicacionId?: unknown;
  ubicacionIds?: unknown;
};

export type CarteraReadDatabase = Pick<CreditLedgerQuery, "query">;
export type ReadScopeResolver = (
  auth: AuthContext,
  requestedUbicacionId?: number,
) => { ubicacionId: number | null | undefined; scopeError: string | null };

export type CarteraReadDependencies = {
  database?: CarteraReadDatabase;
  resolveReadScope: ReadScopeResolver;
  loadProjections?: (
    clientIds: number[],
    database: CarteraReadDatabase,
  ) => Promise<Map<number, CustomerCreditProjection>>;
  now?: () => Date;
};

/** Explicit context form used by read-only verifiers and service tests. */
export type ClientesCarteraReadContext = {
  auth: AuthContext;
  query?: CarteraQuery;
  database: CarteraReadDatabase;
  resolveReadScope: ReadScopeResolver;
  now?: () => Date;
};

export class CarteraScopeError extends Error {
  readonly status: 400 | 403;

  constructor(status: 400 | 403, message: string) {
    super(message);
    this.name = "CarteraScopeError";
    this.status = status;
  }
}

type NormalizedRequestScope = {
  type: CarteraScopeType;
  locationIds: number[];
};

function parsePositiveId(value: unknown): number | null {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function requestedLocationIds(query: CarteraQuery): number[] | null {
  const hasSingle = query.ubicacionId !== undefined;
  const hasMany = query.ubicacionIds !== undefined;
  if (hasSingle && hasMany) {
    throw new CarteraScopeError(
      400,
      "No puedes enviar ubicacionId y ubicacionIds al mismo tiempo.",
    );
  }
  if (!hasSingle && !hasMany) return null;

  if (hasSingle) {
    const id = parsePositiveId(query.ubicacionId);
    if (id == null) {
      throw new CarteraScopeError(400, "ubicacionId debe ser un entero positivo.");
    }
    return [id];
  }

  if (typeof query.ubicacionIds !== "string" || query.ubicacionIds.length === 0) {
    throw new CarteraScopeError(
      400,
      "ubicacionIds debe ser una lista separada por comas de enteros positivos.",
    );
  }
  const parts = query.ubicacionIds.split(",");
  if (parts.some((part) => part.length === 0)) {
    throw new CarteraScopeError(
      400,
      "ubicacionIds debe ser una lista separada por comas de enteros positivos.",
    );
  }
  const ids = parts.map(parsePositiveId);
  if (ids.some((id) => id == null)) {
    throw new CarteraScopeError(
      400,
      "ubicacionIds debe ser una lista separada por comas de enteros positivos.",
    );
  }
  return [...new Set(ids as number[])];
}

export function normalizeCarteraScope(
  auth: AuthContext,
  query: CarteraQuery,
  resolveScope: ReadScopeResolver,
): NormalizedRequestScope {
  const requested = requestedLocationIds(query);
  const unrestricted = resolveScope(auth);
  if (unrestricted.scopeError) {
    throw new CarteraScopeError(403, unrestricted.scopeError);
  }

  if (requested == null) {
    if (unrestricted.ubicacionId === null) {
      throw new CarteraScopeError(403, "No tienes una ubicación asignada.");
    }
    return unrestricted.ubicacionId === undefined
      ? { type: "GLOBAL", locationIds: [] }
      : { type: "SITIOS", locationIds: [unrestricted.ubicacionId] };
  }

  const resolved = requested.map((id) => resolveScope(auth, id));
  if (resolved.some((scope) => scope.scopeError)) {
    throw new CarteraScopeError(
      403,
      resolved.find((scope) => scope.scopeError)?.scopeError ??
        "No tienes permiso para consultar esa ubicación.",
    );
  }
  if (
    unrestricted.ubicacionId === undefined &&
    resolved.some((scope, index) => scope.ubicacionId !== requested[index])
  ) {
    throw new CarteraScopeError(
      403,
      "No tienes permiso para consultar una ubicación fuera de tu alcance.",
    );
  }

  // A restricted user may request its own site explicitly, but can never
  // broaden PROPIA or CAJA into a multi-site read.
  if (unrestricted.ubicacionId != null) {
    if (requested.length !== 1 || requested[0] !== unrestricted.ubicacionId) {
      throw new CarteraScopeError(
        403,
        "No tienes permiso para consultar una ubicación fuera de tu alcance.",
      );
    }
    return { type: "SITIOS", locationIds: requested };
  }
  return { type: "SITIOS", locationIds: requested };
}

export function buildAuthorizedChargeReadQuery(locationIds: number[]): {
  text: string;
  values: readonly unknown[];
} {
  return {
    text: `SELECT DISTINCT m.id,m.cliente_id
         FROM movimientos_credito m
         JOIN tickets t ON t.id=m.ticket_id AND t.cliente_id=m.cliente_id
         WHERE (m.tipo='VENTA_CREDITO' OR (m.tipo='AJUSTE' AND m.importe > 0))
           AND t.ubicacion_id=ANY($1::int[])`,
    values: [locationIds],
  };
}

function centsToMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}

function todayMexicoCity(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function projectClient(
  client: { id: number; nombre: string },
  projection: CustomerCreditProjection,
  allowedChargeIds: Set<number> | null,
  today: string,
  saldoAFavorDisponible: boolean,
): CarteraCliente {
  const charges = allowedChargeIds == null
    ? projection.charges
    : projection.charges.filter((charge) => allowedChargeIds.has(charge.movimientoId));
  const sum = (predicate: (due: string | null) => boolean) =>
    charges
      .filter((charge) => predicate(charge.dueAt))
      .reduce((total, charge) => total + charge.pendienteCents, 0);
  const dueDays = (due: string | null) => due == null
    ? 0
    : Math.max(
        0,
        Math.floor(
          (Date.parse(`${today}T00:00:00Z`) -
            Date.parse(`${due}T00:00:00Z`)) /
            86_400_000,
        ),
      );
  const overdue = charges
    .filter((charge) => charge.dueAt != null && dueDays(charge.dueAt) > 0)
    .map((charge) => charge.dueAt!)
    .sort();
  const oldestDays = overdue[0] == null ? 0 : dueDays(overdue[0]);
  const age = oldestDays === 0
    ? "POR_VENCER"
    : oldestDays <= 30
      ? "1_30"
      : oldestDays <= 60
        ? "31_60"
        : oldestDays <= 90
          ? "61_90"
          : "MAS_90";
  return {
    id: client.id,
    nombre: client.nombre,
    saldo: centsToMoney(sum(() => true)),
    saldoActual: centsToMoney(sum(() => true)),
    saldoAFavor: saldoAFavorDisponible
      ? centsToMoney(projection.overpaymentCents)
      : null,
    porVencer: centsToMoney(sum((due) => due != null && due >= today)),
    sinPlazo: centsToMoney(sum((due) => due == null)),
    "1_30": centsToMoney(sum((due) => dueDays(due) >= 1 && dueDays(due) <= 30)),
    "31_60": centsToMoney(sum((due) => dueDays(due) >= 31 && dueDays(due) <= 60)),
    "61_90": centsToMoney(sum((due) => dueDays(due) >= 61 && dueDays(due) <= 90)),
    mas90: centsToMoney(sum((due) => dueDays(due) > 90)),
    antiguedad: charges.length && charges.every((charge) => charge.dueAt == null)
      ? "SIN_PLAZO"
      : age,
    diasVencido: overdue[0] == null ? 0 : dueDays(overdue[0]),
    vencido: centsToMoney(sum((due) => due != null && due < today)),
    primerVencimiento: charges.map((charge) => charge.dueAt).filter(Boolean).sort()[0] ?? null,
  };
}

function sortRows(rows: CarteraCliente[]): CarteraCliente[] {
  return rows
    .filter((row) => row.saldoActual !== "0.00")
    .sort((a, b) => Number(b.saldoActual) - Number(a.saldoActual));
}

/**
 * Shared read model for JSON and all cartera exports.  The canonical loader
 * always receives the complete customer ledger; location filtering happens
 * only after FIFO projection, on authorized pending charge IDs.
 */
async function loadClientesCarteraFromDatabase(
  auth: AuthContext,
  query: CarteraQuery = {},
  dependencies: CarteraReadDependencies,
): Promise<CarteraReadModel> {
  const scope = normalizeCarteraScope(auth, query, dependencies.resolveReadScope);
  const database = dependencies.database ?? pool;
  const loadProjections = dependencies.loadProjections ?? loadCustomerCreditProjections;
  const generatedEn = (dependencies.now ?? (() => new Date()))().toISOString();
  const today = todayMexicoCity(new Date(generatedEn));
  const locationRows = scope.type === "GLOBAL"
    ? []
    : (await database.query<{ id: number; nombre: string }>(
        "SELECT id,nombre FROM ubicaciones WHERE id=ANY($1::int[]) ORDER BY id",
        [scope.locationIds],
      )).rows;
  if (scope.type === "SITIOS" && locationRows.length !== scope.locationIds.length) {
    throw new CarteraScopeError(400, "Una o más ubicaciones no existen.");
  }
  const locations = locationRows.map((row) => ({ id: Number(row.id), nombre: row.nombre }));
  const siteChargeRows = scope.type === "SITIOS"
    ? (await database.query<{ id: number; cliente_id: number }>(
        buildAuthorizedChargeReadQuery(scope.locationIds).text,
        buildAuthorizedChargeReadQuery(scope.locationIds).values,
      )).rows
    : [];
  const allowedChargeIds = scope.type === "SITIOS"
    ? new Set(siteChargeRows.map((row) => Number(row.id)))
    : null;
  const scopedClientIds = scope.type === "SITIOS"
    ? [...new Set(siteChargeRows.map((row) => Number(row.cliente_id)))]
    : null;
  const clients = (await database.query<{ id: number; nombre: string; es_sistema?: boolean }>(
    scope.type === "SITIOS"
      ? `SELECT id,nombre,es_sistema FROM clientes
         WHERE activo AND id=ANY($1::int[]) ORDER BY id`
      : "SELECT id,nombre,es_sistema FROM clientes WHERE activo ORDER BY id",
    scope.type === "SITIOS" ? [scopedClientIds] : [],
  )).rows.map((row) => ({ id: Number(row.id), nombre: row.nombre, esSistema: row.es_sistema === true }));
  const ids = clients.map((client) => client.id);
  const projections = await loadProjections(ids, database);
  const saldoAFavorDisponible = scope.type === "GLOBAL";
  const projected = clients.map((client) => {
    const projection = projections.get(client.id);
    if (projection == null) {
      throw new Error(`CREDIT_PROJECTION_MISSING:${client.id}`);
    }
    const charges = allowedChargeIds == null
      ? projection.charges
      : projection.charges.filter((charge) => allowedChargeIds.has(charge.movimientoId));
    return {
      client,
      balanceCents: charges.reduce((sum, charge) => sum + charge.pendienteCents, 0),
      overdueCents: charges
        .filter((charge) => charge.dueAt != null && charge.dueAt < today)
        .reduce((sum, charge) => sum + charge.pendienteCents, 0),
      row: projectClient(
        client,
        projection,
        allowedChargeIds,
        today,
        saldoAFavorDisponible,
      ),
    };
  });
  const resumen: CarteraResumen = {
    totalClientes: clients.length,
    clientesConSaldo: projected.filter(({ balanceCents }) => balanceCents > 0).length,
    totalCartera: centsToMoney(
      projected.reduce((sum, item) => sum + item.balanceCents, 0),
    ),
    totalVencido: centsToMoney(
      projected.reduce((sum, item) => sum + item.overdueCents, 0),
    ),
  };
  return {
    resumen,
    clientes: sortRows(
      projected
        .filter(({ client }) => !client.esSistema)
        .map(({ row }) => row),
    ),
    alcance: {
      tipo: scope.type,
      ubicaciones: locations,
      generadoEn: generatedEn,
      saldoAFavorDisponible,
    },
  };
}

export async function loadClientesCartera(
  auth: AuthContext,
  query: CarteraQuery = {},
  dependencies: CarteraReadDependencies,
): Promise<CarteraReadModel> {
  if (dependencies.database != null) {
    return loadClientesCarteraFromDatabase(auth, query, dependencies);
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const result = await loadClientesCarteraFromDatabase(auth, query, {
      ...dependencies,
      database: client,
    });
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function readClientesCartera(
  context: ClientesCarteraReadContext,
): Promise<CarteraReadModel> {
  return loadClientesCartera(
    context.auth,
    context.query ?? {},
    {
      database: context.database,
      resolveReadScope: context.resolveReadScope,
      now: context.now,
    },
  );
}