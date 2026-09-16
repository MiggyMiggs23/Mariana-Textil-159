import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  addExactDecimal,
  buildKardexGroupedQueries,
  groupKardexRows,
} from "./kardex-grouped";

type FixtureRow = Parameters<typeof groupKardexRows>[0][number];
export type KardexGroupingFixtureRow = FixtureRow;
const groupedSource = readFileSync(
  new URL("./kardex-grouped.ts", import.meta.url),
  "utf8",
);

function movement(overrides: Partial<FixtureRow> = {}): FixtureRow {
  return {
    id: 1,
    createdAt: "2025-01-15T12:00:00.000Z",
    tipo: "VENTA",
    cantidad: "1",
    saldoPosterior: "10",
    productoId: 10,
    skuProducto: "SKU-10",
    telaProducto: "Tela",
    colorProducto: "Rojo",
    unidadProducto: "METRO",
    rolloId: 100,
    serie: "SERIE-100",
    ubicacionId: 7,
    nombreUbicacion: "Bodega",
    ubicacionActiva: true,
    usuarioId: 4,
    nombreUsuario: "Operador",
    username: "operador",
    documentoTipo: "TICKET",
    documentoId: "900",
    documentoEtiqueta: "Ticket 900",
    documentoRuta: "/tickets/900",
    documentoClienteId: null,
    referenciaRolloRuta: "/inventario/rollos/100",
    recepcionId: null,
    originRolloId: null,
    originDocumentoTipo: null,
    originDocumentoId: null,
    ticketId: 900,
    destinoEtiqueta: "Cliente",
    movimientoOrigenId: null,
    justificacion: null,
    revisado: true,
    revisadoPor: null,
    revisadoAt: null,
    ...overrides,
  };
}

/** Canonical read-only fixtures for the Prompt-K verification harness. */
export function buildKardexGroupingFixture(): FixtureRow[] {
  return [
    movement({
      id: 101,
      documentoTipo: "ENTRADA",
      documentoId: "7",
      documentoEtiqueta: "Entrada MT-000007",
      documentoRuta: "/entradas/7/documento",
      ticketId: null,
      recepcionId: 7,
      tipo: "RECEPCION",
      cantidad: "0.1",
    }),
    movement({
      id: 102,
      rolloId: 101,
      serie: "SERIE-101",
      documentoTipo: "ENTRADA",
      documentoId: "7",
      documentoEtiqueta: "Entrada MT-000007",
      documentoRuta: "/entradas/7/documento",
      ticketId: null,
      recepcionId: 7,
      tipo: "RECEPCION",
      cantidad: "0.2",
      createdAt: "2025-01-15T12:00:01.000Z",
    }),
    movement({
      id: 103,
      documentoTipo: "ENTRADA",
      documentoId: "7",
      documentoEtiqueta: "Entrada MT-000007",
      documentoRuta: "/entradas/7/documento",
      ticketId: null,
      recepcionId: 7,
      tipo: "RECEPCION",
      cantidad: "2",
      unidadProducto: "KILO",
      productoId: 11,
      skuProducto: "SKU-11",
      createdAt: "2025-01-15T12:00:02.000Z",
    }),
    movement({
      id: 104,
      documentoTipo: "TICKET",
      documentoId: "404",
      documentoEtiqueta: null,
      documentoRuta: null,
      ticketId: null,
      justificacion: "Documento legado no localizado",
    }),
    movement({
      id: 105,
      tipo: "CANCELACION",
      rolloId: 100,
      documentoTipo: "ENTRADA",
      documentoId: "7",
      documentoEtiqueta: "Entrada MT-000007",
      documentoRuta: "/entradas/7/documento",
      ticketId: null,
      recepcionId: 7,
      originRolloId: 100,
      originDocumentoTipo: "ENTRADA",
      originDocumentoId: "42",
      movimientoOrigenId: 101,
      cantidad: "-0.1",
      createdAt: "2025-01-15T12:00:03.000Z",
    }),
    movement({
      id: 106,
      documentoId: "901",
      documentoEtiqueta: "Ticket 901",
      documentoRuta: "/tickets/901",
      ticketId: 901,
      createdAt: "2025-01-15T12:00:04.000Z",
    }),
    movement({
      id: 107,
      documentoId: "902",
      documentoEtiqueta: "Ticket 902",
      documentoRuta: "/tickets/902",
      ticketId: 902,
      createdAt: "2025-01-15T12:00:04.000Z",
    }),
  ];
}

test("grouped presentation merges partialities but keeps exact totals per unit", () => {
  const groups = groupKardexRows(buildKardexGroupingFixture().slice(0, 3));

  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.partialitiesMerged, 3);
  assert.equal(groups[0]?.distinctRolloCount, 2);
  assert.deepEqual(groups[0]?.totalesPorUnidad, [
    { unidad: "METRO", cantidad: "0.3" },
    { unidad: "KILO", cantidad: "2" },
  ]);
  assert.equal(groups[0]?.fechaMin, "2025-01-15T12:00:00.000Z");
  assert.equal(groups[0]?.fechaMax, "2025-01-15T12:00:02.000Z");
  assert.equal(groups[0]?.latestMovementId, 103);
  assert.equal(groups[0]?.rollos.length, 3);
});

test("grouped SQL paginates selected groups, not filtered movement rows", () => {
  assert.match(groupedSource, /filteredMovementQuery\(filters\)/);
  assert.match(groupedSource, /originRolloId[\s\S]*originDocumentoTipo/);
  assert.match(groupedSource, /canonicalDocumentType[\s\S]*canonicalDocumentId/);
  assert.match(groupedSource, /array_agg\([\s\S]*createdAt[\s\S]*DESC[\s\S]*id[\s\S]*DESC/);
  assert.match(groupedSource, /\.groupBy\([\s\S]*identity\.verifiedDocument/);
  assert.match(groupedSource, /\.limit\(pagination\.pageSize\)/);
  assert.doesNotMatch(groupedSource, /const result = await getKardex\(filters\)/);
});

test("grouped query builders resolve every nested SQL alias at runtime", () => {
  const queries = buildKardexGroupedQueries(
    { incluirUbicacionesInactivas: false },
    { page: 1, pageSize: 2 },
  );
  assert.doesNotThrow(() => queries.groupCount.toSQL());
  assert.doesNotThrow(() => queries.totals.toSQL());
  assert.doesNotThrow(() => queries.selectedRows.toSQL());
});

test("unverified documents stay individual by movement ID with justification and no link", () => {
  const groups = groupKardexRows([
    movement({
      id: 21,
      documentoTipo: "TICKET",
      documentoId: "404",
      documentoEtiqueta: null,
      documentoRuta: null,
      ticketId: null,
      justificacion: "Documento legado no localizado",
    }),
    movement({
      id: 22,
      documentoTipo: null,
      documentoId: null,
      documentoEtiqueta: null,
      documentoRuta: null,
      ticketId: null,
      justificacion: "Ajuste manual trazable",
    }),
  ]);

  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map((group) => group.groupId).sort(),
    ["movement:21", "movement:22"],
  );
  assert.ok(groups.every((group) => group.documentoRuta === null));
  assert.equal(
    groups.find((group) => group.groupId === "movement:21")?.justificacion,
    "Documento legado no localizado",
  );
  assert.equal(
    groups.find((group) => group.groupId === "movement:22")?.justificacion,
    "Ajuste manual trazable",
  );
});

test("verified grouping key includes internal document, movement type, and site", () => {
  const groups = groupKardexRows([
    movement({ id: 30, documentoId: "900", ubicacionId: 7 }),
    movement({ id: 31, documentoId: "900", ubicacionId: 8 }),
    movement({ id: 32, documentoId: "901", ubicacionId: 7 }),
    movement({ id: 33, documentoId: "900", ubicacionId: 7, tipo: "DEVOLUCION" }),
  ]);

  assert.equal(groups.length, 4);
  assert.deepEqual(
    groups.map((group) => group.latestMovementId),
    [33, 32, 31, 30],
  );
});

test("fixture covers legacy entry FK, cancellation inheritance, and latest-date ties", () => {
  const groups = groupKardexRows(buildKardexGroupingFixture());
  const entry = groups.find(
    (group) => group.documentoRuta === "/entradas/7/documento" && group.tipo === "RECEPCION",
  );
  assert.equal(entry?.partialitiesMerged, 3);
  assert.ok(groups.some((group) => group.latestMovementId === 105));
  assert.deepEqual(
    groups
      .filter((group) => group.latestDate === "2025-01-15T12:00:04.000Z")
      .map((group) => group.latestMovementId),
    [107, 106],
  );
});

test("exact decimal helper never uses floating-point arithmetic", () => {
  assert.equal(addExactDecimal("0.1", "0.2"), "0.3");
  assert.equal(addExactDecimal("100000000000000000000.99", "0.01"), "100000000000000000001");
  assert.equal(addExactDecimal("1.25", "-0.25"), "1");
  assert.equal(addExactDecimal("-1.25", "0.25"), "-1");
});