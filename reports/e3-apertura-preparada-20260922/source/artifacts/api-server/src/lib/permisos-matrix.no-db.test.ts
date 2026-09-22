import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

/**
 * No-DB regression coverage for the application's permission resolvers.
 *
 * The resolver and matrix-builder bodies are extracted from permisos.ts and
 * transpiled unchanged. Only Drizzle's table metadata/query helpers and the
 * database reader are mocked, so these assertions exercise the actual
 * resolution code without opening a connection or creating fixtures.
 */
const source = readFileSync(new URL("./permisos.ts", import.meta.url), "utf8");
const sourceStart = source.indexOf("export function mergePermissionValues");
const sourceEnd = source.indexOf(
  "/**\n * Express middleware factory.",
  sourceStart,
);
assert.ok(sourceStart >= 0, "could not locate permission resolver declarations");
assert.ok(sourceEnd > sourceStart, "could not locate permission resolver boundary");

type PermissionRow = {
  usuarioId?: number;
  rol?: string;
  modulo: string;
  puedeVer: boolean | null;
  puedeCrear: boolean | null;
  puedeEditar: boolean | null;
  puedeAutorizar: boolean | null;
  updatedPor?: number | null;
};

type Condition =
  | { kind: "eq"; column: string; value: unknown }
  | { kind: "and"; conditions: Condition[] };

type MockTable = Record<string, string>;

type ResolverExports = {
  resolvePermiso: (
    userId: number,
    rol: "SUPERVISOR" | "BODEGA",
    modulo: string,
    database?: PermissionDatabase,
  ) => Promise<{
    modulo: string;
    puedeVer: boolean;
    puedeCrear: boolean;
    puedeEditar: boolean;
    puedeAutorizar: boolean;
  } | null>;
  buildPermissionMatrix: (
    userId: number,
    rol: "SUPERVISOR" | "BODEGA",
    database?: PermissionDatabase,
  ) => Promise<
    Record<
      string,
      {
        modulo: string;
        puedeVer: boolean;
        puedeCrear: boolean;
        puedeEditar: boolean;
        puedeAutorizar: boolean;
      }
    >
  >;
};

type PermissionDatabase = {
  select: (selection?: Record<string, unknown>) => {
    from: (table: MockTable) => {
      innerJoin: (...args: unknown[]) => {
        where: (condition: Condition) => MockQuery;
      };
      where: (condition: Condition) => MockQuery;
    };
  };
};

type MockQuery = Promise<PermissionRow[]> & {
  limit: (count: number) => Promise<PermissionRow[]>;
};

const permisosUsuarioTable: MockTable = {
  usuarioId: "permisosUsuario.usuarioId",
  modulo: "permisosUsuario.modulo",
};
const permisosRolTable: MockTable = {
  rol: "permisosRol.rol",
  modulo: "permisosRol.modulo",
};
const permisosUbicacionTable: MockTable = {
  ubicacionId: "permisosUbicacion.ubicacionId",
  rol: "permisosUbicacion.rol",
  modulo: "permisosUbicacion.modulo",
  puedeVer: "permisosUbicacion.puedeVer",
  puedeCrear: "permisosUbicacion.puedeCrear",
  puedeEditar: "permisosUbicacion.puedeEditar",
  puedeAutorizar: "permisosUbicacion.puedeAutorizar",
};
const usuariosTable: MockTable = {
  id: "usuarios.id",
  ubicacionId: "usuarios.ubicacionId",
};

function eq(column: string, value: unknown): Condition {
  return { kind: "eq", column, value };
}

function and(...conditions: Condition[]): Condition {
  return { kind: "and", conditions };
}

function flatten(condition: Condition): Array<{ column: string; value: unknown }> {
  if (condition.kind === "eq") return [condition];
  return condition.conditions.flatMap(flatten);
}

function createPermissionDatabase(
  roleRows: PermissionRow[],
  userRows: PermissionRow[],
  locationRows: PermissionRow[],
): PermissionDatabase {
  function rowsFor(table: MockTable, condition: Condition): PermissionRow[] {
    const filters = new Map(
      flatten(condition).map(({ column, value }) => [column, value]),
    );
    if (table === permisosUsuarioTable) {
      const result = userRows.filter(
        (row) =>
          row.usuarioId === filters.get(permisosUsuarioTable.usuarioId) &&
          (filters.get(permisosUsuarioTable.modulo) === undefined ||
            row.modulo === filters.get(permisosUsuarioTable.modulo)),
      );
      return result;
    }
    if (table === permisosRolTable) {
      return roleRows.filter(
        (row) =>
          row.rol === filters.get(permisosRolTable.rol) &&
          (filters.get(permisosRolTable.modulo) === undefined ||
            row.modulo === filters.get(permisosRolTable.modulo)),
      );
    }
    return locationRows.filter(
      (row) =>
        row.usuarioId === filters.get(usuariosTable.id) &&
        row.rol === filters.get(permisosUbicacionTable.rol) &&
        (filters.get(permisosUbicacionTable.modulo) === undefined ||
          row.modulo === filters.get(permisosUbicacionTable.modulo)),
    );
  }

  return {
    select(selection) {
      void selection;
      return {
        from(table) {
          const builder = {
            innerJoin() {
              return builder;
            },
            where(condition: Condition) {
              const rows = rowsFor(table, condition);
              const query = Object.assign(Promise.resolve(rows), {
                limit: async (count: number) => rows.slice(0, count),
              });
              return query as MockQuery;
            },
          };
          return builder;
        },
      };
    },
  };
}

function compileResolvers(): ResolverExports {
  const javascript = ts.transpileModule(
    source
      .slice(sourceStart, sourceEnd)
      .replaceAll("export ", ""),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    },
  ).outputText;

  return new Function(
    "and",
    "eq",
    "permisosRolTable",
    "permisosUbicacionTable",
    "permisosUsuarioTable",
    "usuariosTable",
    "db",
    `${javascript}; return { resolvePermiso, buildPermissionMatrix };`,
  )(
    and,
    eq,
    permisosRolTable,
    permisosUbicacionTable,
    permisosUsuarioTable,
    usuariosTable,
    createPermissionDatabase([], [], []),
  ) as ResolverExports;
}

function row(
  modulo: string,
  values: Partial<Pick<PermissionRow, "puedeVer" | "puedeCrear" | "puedeEditar" | "puedeAutorizar">>,
  extra: Partial<Pick<PermissionRow, "usuarioId" | "rol" | "updatedPor">> = {},
): PermissionRow {
  return {
    modulo,
    puedeVer: values.puedeVer ?? false,
    puedeCrear: values.puedeCrear ?? false,
    puedeEditar: values.puedeEditar ?? false,
    puedeAutorizar: values.puedeAutorizar ?? false,
    ...extra,
  };
}

const resolvers = compileResolvers();

test("resolvePermiso honors site inheritance, customized role rows, and user overrides", async () => {
  const database = createPermissionDatabase(
    [
      row("productos", { puedeVer: false }, { rol: "SUPERVISOR", updatedPor: 42 }),
      row("clientes", { puedeVer: false }, { rol: "SUPERVISOR", updatedPor: null }),
      row("resumen_caja", { puedeVer: true }, { rol: "SUPERVISOR", updatedPor: 42 }),
      row("proveedores_finanzas", { puedeVer: false }, { rol: "SUPERVISOR", updatedPor: 42 }),
    ],
    [
      row("proveedores_finanzas", { puedeVer: true }, { usuarioId: 7 }),
      row("resumen_caja", { puedeVer: false }, { usuarioId: 7 }),
    ],
    [
      row("productos", { puedeVer: true }, { usuarioId: 7, rol: "SUPERVISOR" }),
      row("clientes", { puedeVer: true }, { usuarioId: 7, rol: "SUPERVISOR" }),
      row("resumen_caja", { puedeVer: false }, { usuarioId: 7, rol: "SUPERVISOR" }),
      row("proveedores_finanzas", { puedeVer: true }, { usuarioId: 7, rol: "SUPERVISOR" }),
    ],
  );

  assert.equal(
    (await resolvers.resolvePermiso(7, "SUPERVISOR", "productos", database))?.puedeVer,
    false,
    "a customized role row must outrank the inherited site grant",
  );
  assert.equal(
    (await resolvers.resolvePermiso(7, "SUPERVISOR", "clientes", database))?.puedeVer,
    true,
    "an uncustomized role row must inherit the site grant",
  );
  assert.equal(
    (await resolvers.resolvePermiso(7, "SUPERVISOR", "resumen_caja", database))?.puedeVer,
    false,
    "an explicit false user override must deny a previously capped module",
  );
  assert.equal(
    (await resolvers.resolvePermiso(7, "SUPERVISOR", "proveedores_finanzas", database))?.puedeVer,
    true,
    "an explicit true user override must grant a previously capped module",
  );
});

test("buildPermissionMatrix preserves true and false SUPERVISOR matrix actions", async () => {
  const database = createPermissionDatabase(
    [
      row("productos", { puedeVer: true }, { rol: "SUPERVISOR", updatedPor: 42 }),
      row("resumen_caja", { puedeVer: false }, { rol: "SUPERVISOR", updatedPor: 42 }),
      row("clientes", { puedeVer: false }, { rol: "SUPERVISOR", updatedPor: null }),
    ],
    [
      row("resumen_caja", { puedeVer: true }, { usuarioId: 7 }),
      row("proveedores_finanzas", { puedeVer: false }, { usuarioId: 7 }),
    ],
    [
      row("clientes", { puedeVer: true }, { usuarioId: 7, rol: "SUPERVISOR" }),
    ],
  );

  assert.equal(
    (await resolvers.resolvePermiso(7, "SUPERVISOR", "resumen_caja", database))?.puedeVer,
    true,
  );
  const matrix = await resolvers.buildPermissionMatrix(7, "SUPERVISOR", database);
  assert.equal(matrix.productos?.puedeVer, true);
  assert.equal(matrix.resumen_caja?.puedeVer, true);
  assert.equal(
    matrix.proveedores_finanzas?.puedeVer,
    false,
    "an explicit false user override must survive matrix construction",
  );
  assert.equal(
    matrix.clientes?.puedeVer,
    true,
    "an inherited site grant must survive matrix construction",
  );
});