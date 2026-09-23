import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  CobrarTicketResponse,
  GetAdminAlertasResponse,
  GetClienteCreditoResponse,
  GetClienteEstadoCuentaResponse,
  GetClienteNotaCreditoResponse,
  ListNotificacionesResponse,
} from "../api-zod/src/generated/api.ts";

type ZodSchema = {
  _def?: {
    typeName?: string;
    shape?: () => Record<string, ZodSchema>;
    innerType?: ZodSchema;
    schema?: ZodSchema;
    left?: ZodSchema;
    right?: ZodSchema;
    options?: ZodSchema[];
    values?: unknown[];
    value?: unknown;
    type?: ZodSchema;
    element?: ZodSchema;
    valueType?: ZodSchema;
    checks?: Array<{ kind?: string }>;
    coerce?: boolean;
  };
};

/**
 * Build a small JSON-shaped sample from the generated schema.  This keeps the
 * boundary test focused on generated runtime behavior without duplicating the
 * large ticket response fixture.
 */
function sampleFor(schema: ZodSchema, key = ""): unknown {
  const definition = schema._def;
  const typeName = definition?.typeName;

  switch (typeName) {
    case "ZodObject": {
      const result: Record<string, unknown> = {};
      for (const [childKey, childSchema] of Object.entries(
        definition.shape?.() ?? {},
      )) {
        const child = sampleFor(childSchema, childKey);
        if (child !== undefined) result[childKey] = child;
      }
      return result;
    }
    case "ZodIntersection":
      return {
        ...(sampleFor(definition.left!, key) as Record<string, unknown>),
        ...(sampleFor(definition.right!, key) as Record<string, unknown>),
      };
    case "ZodUnion":
      return sampleFor(definition.options?.[0]!, key);
    case "ZodNullable":
    case "ZodDefault":
      return sampleFor(definition.innerType!, key);
    case "ZodOptional":
      return undefined;
    case "ZodArray":
      return [];
    case "ZodRecord":
      return {};
    case "ZodEnum":
      return definition.values?.[0];
    case "ZodLiteral":
      return definition.value;
    case "ZodDate":
      return "2026-10-16T12:00:00.000Z";
    case "ZodString":
      return definition.checks?.some((check) => check.kind === "regex")
        ? "2026-10-16"
        : key.toLowerCase().includes("fecha")
          ? "2026-10-16"
          : "sample";
    case "ZodNumber":
      return 1;
    case "ZodBoolean":
      return true;
    case "ZodUnknown":
      return {};
    case "ZodAny":
      return {};
    case "ZodEffects":
      return sampleFor(definition.schema!, key);
    default:
      throw new Error(`Unhandled generated Zod node ${typeName ?? "unknown"}`);
  }
}

function collectValuesByKey(value: unknown, key: string): unknown[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectValuesByKey(item, key));
  }

  const record = value as Record<string, unknown>;
  return Object.entries(record).flatMap(([childKey, childValue]) => [
    ...(childKey === key ? [childValue] : []),
    ...collectValuesByKey(childValue, key),
  ]);
}

test("codegen keeps calendar dates as date-only strings across boundary schemas", () => {
  const schemas = [
    GetClienteNotaCreditoResponse,
    CobrarTicketResponse,
    GetClienteEstadoCuentaResponse,
    ListNotificacionesResponse,
    GetAdminAlertasResponse,
  ];

  for (const schema of schemas) {
    const result = schema.safeParse(sampleFor(schema));
    assert.equal(result.success, true);
    if (!result.success) continue;

    for (const value of collectValuesByKey(result.data, "fechaVencimiento")) {
      assert.match(String(value), /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(value, "2026-10-16");
    }
  }
});

test("calendar date JSON keeps month boundaries and today unchanged", () => {
  for (const date of ["2026-10-01", "2026-10-31", "2026-10-16"]) {
    const parsed = GetClienteCreditoResponse.parse({
      clienteId: 1,
      limiteCredito: "100.00",
      saldoActual: "10.00",
      saldoAFavor: "0.00",
      creditoDisponible: "90.00",
      puedeComprarCredito: true,
      diasCredito: 30,
      utilizacion: "0.10",
      totalVencido: "0.00",
      primerVencimiento: date,
      primeraCompra: "2026-10-16T12:00:00.000Z",
      ultimaActividad: "2026-10-16T12:00:00.000Z",
    });

    assert.equal(parsed.primerVencimiento, date);
    assert.equal(JSON.stringify(parsed.primerVencimiento), JSON.stringify(date));
  }
});

test("calendar date schema rejects malformed and impossible month/day values", () => {
  const base = {
    clienteId: 1,
    limiteCredito: "100.00",
    saldoActual: "10.00",
    saldoAFavor: "0.00",
    creditoDisponible: "90.00",
    puedeComprarCredito: true,
    diasCredito: 30,
    utilizacion: "0.10",
    totalVencido: "0.00",
  };

  for (const date of [
    "2026-00-01",
    "2026-04-31",
    "2026-02-30",
    "2025-02-29",
    "2026-10-00",
    "16-10-2026",
  ]) {
    assert.equal(
      GetClienteCreditoResponse.safeParse({
        ...base,
        primerVencimiento: date,
      }).success,
      false,
      date,
    );
  }
});

test("date-time instants remain Date values while date-only fields do not", () => {
  const parsed = GetClienteCreditoResponse.parse({
    clienteId: 1,
    limiteCredito: "100.00",
    saldoActual: "10.00",
    saldoAFavor: "0.00",
    creditoDisponible: "90.00",
    puedeComprarCredito: true,
    diasCredito: 30,
    utilizacion: "0.10",
    totalVencido: "0.00",
    primerVencimiento: "2026-10-16",
    primeraCompra: "2026-10-16T12:00:00.000Z",
    ultimaActividad: "2026-10-16T12:00:00.000Z",
  });

  assert.equal(typeof parsed.primerVencimiento, "string");
  assert.equal(parsed.primeraCompra instanceof Date, true);
  assert.equal(parsed.ultimaActividad instanceof Date, true);
});

test("generated contract references CalendarDate for nested date-only fields", () => {
  const source = readFileSync(
    new URL("../api-client-react/src/generated/api.schemas.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /interface ClienteNotaCreditoDetalle[\s\S]*fechaVencimiento: CalendarDate/);
  assert.match(source, /interface TicketCredito[\s\S]*fechaVencimiento: CalendarDate/);
  assert.match(source, /interface NotificacionCredito[\s\S]*fechaVencimiento: CalendarDate/);
  assert.match(source, /interface AlertaCredito[\s\S]*fechaVencimiento: CalendarDate/);
  assert.match(source, /interface ClienteCredito[\s\S]*primerVencimiento\?: CalendarDate/);
});