import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CHECKLIST_KEYS_EQUIPO,
  DEFINICIONES_EQUIPO,
  TIPOS_EQUIPO,
  checklistEquipo,
} from "@workspace/db";
import { MODULOS } from "./lib/permisos";
import {
  checkEquiposOperationalScope,
  resolveEquiposReadScope,
  StrictToggleEquipoChecklistBody,
} from "./routes/equipos";

const route = readFileSync(
  new URL("./routes/equipos.ts", import.meta.url),
  "utf8",
);
const initializer = readFileSync(
  new URL("../../../lib/db/src/lib/equipos-schema.ts", import.meta.url),
  "utf8",
);
const spec = readFileSync(
  new URL("../../../lib/api-spec/openapi.yaml", import.meta.url),
  "utf8",
);
const catalogMigration = readFileSync(
  new URL(
    "../../../lib/db/migrations/20260915_equipos_catalog_constraints.sql",
    import.meta.url,
  ),
  "utf8",
);

test("equipos has one canonical closed type/checklist catalog", () => {
  assert.deepEqual(TIPOS_EQUIPO, [
    "COMPUTADORA_POS",
    "IMPRESORA_ENTRADAS",
    "IMPRESORA_SALIDAS_NOTAS",
    "IMPRESORA_ETIQUETAS",
    "IMPRESORA_TICKETS",
    "PISTOLA_ESCANER",
    "SMARTPHONE_ESCANER",
  ]);
  assert.deepEqual(
    TIPOS_EQUIPO.map((tipo) => DEFINICIONES_EQUIPO[tipo].label),
    [
      "Computadora POS",
      "Impresora de entradas",
      "Impresora de salidas/notas",
      "Impresora de etiquetas",
      "Impresora térmica de tickets",
      "Pistola Escáner",
      "Smartphone Escáner",
    ],
  );
  assert.equal(checklistEquipo("COMPUTADORA_POS").length, 4);
  assert.deepEqual(checklistEquipo("IMPRESORA_ENTRADAS"), [
    { key: "ENTRADA_REAL", label: "Instalada y probada con una entrada real" },
    {
      key: "PAPEL_NAVEGADOR_CARTA",
      label: "Tamaño de papel del navegador en Carta",
    },
    { key: "MARGENES_NINGUNO", label: "Márgenes del navegador en Ninguno" },
    { key: "ESCALA_REAL", label: "Escala en Tamaño real" },
  ]);
  assert.deepEqual(checklistEquipo("IMPRESORA_SALIDAS_NOTAS"), [
    { key: "SALIDA_REAL", label: "Instalada y probada con una salida real" },
    { key: "NOTA_REAL", label: "Instalada y probada con una nota real" },
    {
      key: "PAPEL_NAVEGADOR_A5",
      label: "Tamaño de papel del navegador en A5",
    },
    { key: "MARGENES_NINGUNO", label: "Márgenes del navegador en Ninguno" },
    { key: "ESCALA_REAL", label: "Escala en Tamaño real" },
    {
      key: "PAPEL_COLOR_SITIO_BANDEJA",
      label: "Papel de color del sitio en la bandeja correcta para salidas",
    },
  ]);
  assert.equal(checklistEquipo("IMPRESORA_TICKETS").length, 2);
  assert.equal(checklistEquipo("IMPRESORA_ETIQUETAS").length, 2);
  assert.equal(checklistEquipo("PISTOLA_ESCANER").length, 2);
  assert.equal(checklistEquipo("SMARTPHONE_ESCANER").length, 2);
  assert.equal(
    DEFINICIONES_EQUIPO.IMPRESORA_ETIQUETAS.checklist[1]?.label,
    "Medida de etiqueta 100 × 70 mm configurada",
  );
});

test("equipos is module 32 and mutations use create/edit permissions", () => {
  assert.equal(MODULOS.length, 32);
  assert.equal(MODULOS[31], "equipos");
  assert.match(route, /requierePermiso\("equipos", "ver"\)/);
  assert.equal(
    route.match(/requierePermiso\("equipos", "crear"\)/g)?.length,
    1,
  );
  assert.equal(
    route.match(/requierePermiso\("equipos", "editar"\)/g)?.length,
    2,
  );
  assert.doesNotMatch(route, /req\.body\.(actor|checkedAt|activo)/);
});

test("equipment reads and writes enforce site scope", () => {
  assert.match(route, /resolveEquiposReadScope\(req\.auth!, requested\)/);
  assert.match(route, /requested !== scope\.ubicacionId/);
  assert.ok(
    route.match(/checkEquiposOperationalScope\(req\.auth!/g)?.length! >= 3,
  );
  const ownScope = resolveEquiposReadScope(
    {
      sessionId: "test",
      location: null,
      user: {
        id: 1,
        nombre: "Prueba",
        usuario: "prueba",
        passwordHash: "",
        rol: "BODEGA",
        ubicacionId: 7,
        activo: true,
        alcanceConsulta: "PROPIA",
        ultimoAcceso: null,
        createdAt: new Date(0),
      },
    },
    9,
  );
  assert.equal(ownScope.ubicacionId, 7);
  assert.notEqual(9, ownScope.ubicacionId);
  const ownSupervisor = {
    sessionId: "test",
    location: null,
    user: {
      id: 2,
      nombre: "Supervisor",
      usuario: "supervisor",
      passwordHash: "",
      rol: "SUPERVISOR" as const,
      ubicacionId: 7,
      activo: true,
      alcanceConsulta: "PROPIA" as const,
      ultimoAcceso: null,
      createdAt: new Date(0),
    },
  };
  assert.equal(resolveEquiposReadScope(ownSupervisor, 9).ubicacionId, 7);
  assert.match(
    checkEquiposOperationalScope(ownSupervisor, [9]) ?? "",
    /ubicación/,
  );
  assert.match(
    route,
    /requested !== scope\.ubicacionId[\s\S]*?status\(403\)/,
    "an explicit other-site request must remain a 403, not a silent override",
  );
});

test("equipment locations and mutation targets require active physical sites", () => {
  assert.match(
    route,
    /const EQUIPOS_SITE_TYPES = \["TIENDA", "BODEGA"\] as const/,
  );
  assert.ok(
    route.match(/inArray\(ubicacionesTable\.tipo, EQUIPOS_SITE_TYPES\)/g)
      ?.length! >= 3,
  );
  assert.match(
    route,
    /eq\(ubicacionesTable\.activa, true\)[\s\S]*?inArray\(ubicacionesTable\.tipo, EQUIPOS_SITE_TYPES\)/,
  );
  assert.match(
    route,
    /WHEN 'COMPUTADORA_POS' THEN 1[\s\S]*WHEN 'IMPRESORA_ENTRADAS' THEN 2[\s\S]*WHEN 'IMPRESORA_SALIDAS_NOTAS' THEN 3[\s\S]*WHEN 'IMPRESORA_ETIQUETAS' THEN 4[\s\S]*WHEN 'IMPRESORA_TICKETS' THEN 5[\s\S]*WHEN 'PISTOLA_ESCANER' THEN 6[\s\S]*WHEN 'SMARTPHONE_ESCANER' THEN 7/,
  );
  assert.match(route, /if \(!location\) throw new Error\("INVALID_LOCATION"\)/);
  assert.match(route, /La ubicación debe ser una tienda o bodega activa/);
});

test("active state is derived and checklist changes are audited both ways", () => {
  assert.match(route, /activo: faltantes\.length === 0/);
  assert.match(route, /accion: body\.data\.checked \? "PALOMEAR" : "DESPALOMEAR"/);
  assert.match(route, /datosAntes:/);
  assert.match(route, /datosDespues:/);
  assert.doesNotMatch(initializer, /activo boolean/);
  assert.match(route, /checkedAt: body\.data\.checked \? effectiveAt : null/);
  assert.match(route, /effectiveActor/);
  assert.match(route, /clock_timestamp\(\)/);
});

test("checklist input rejects client-controlled attribution", () => {
  assert.equal(
    StrictToggleEquipoChecklistBody.safeParse({ checked: true }).success,
    true,
  );
  assert.equal(
    StrictToggleEquipoChecklistBody.safeParse({
      checked: true,
      actorId: 999,
    }).success,
    false,
  );
  assert.equal(
    StrictToggleEquipoChecklistBody.safeParse({
      checked: true,
      checkedAt: new Date(0).toISOString(),
    }).success,
    false,
  );
});

test("initializer reconciles and validates structure from canonical values", () => {
  assert.ok(CHECKLIST_KEYS_EQUIPO.length > 0);
  assert.match(initializer, /ALTER TABLE equipos/);
  assert.match(initializer, /ADD COLUMN IF NOT EXISTS marca text/);
  assert.match(initializer, /FOREIGN KEY \(equipo_id\).*ON DELETE CASCADE/s);
  assert.match(initializer, /column validation failed/);
  assert.match(initializer, /index validation failed/);
  assert.match(initializer, /WHERE permisos_rol\.updated_por IS NULL/);
  assert.match(initializer, /sqlLiteralList\(TIPOS_EQUIPO\)/);
  assert.match(initializer, /sqlLiteralList\(CHECKLIST_KEYS_EQUIPO\)/);
  assert.doesNotMatch(initializer, /'IMPRESORA_TICKETS',/);
  assert.doesNotMatch(initializer, /'TICKET_REAL',/);
});

test("catalog constraint migration is explicit, additive and limited to catalog checks", () => {
  assert.match(catalogMigration, /BEGIN;\s+/);
  assert.match(catalogMigration, /DROP CONSTRAINT IF EXISTS equipos_tipo_check/);
  assert.match(catalogMigration, /ADD CONSTRAINT equipos_tipo_check/);
  assert.match(
    catalogMigration,
    /DROP CONSTRAINT IF EXISTS equipos_checklist_item_key_check/,
  );
  assert.match(
    catalogMigration,
    /ADD CONSTRAINT equipos_checklist_item_key_check/,
  );
  assert.match(catalogMigration, /'IMPRESORA_ENTRADAS'/);
  assert.match(catalogMigration, /'IMPRESORA_SALIDAS_NOTAS'/);
  assert.match(catalogMigration, /'ENTRADA_REAL'/);
  assert.match(catalogMigration, /'PAPEL_COLOR_SITIO_BANDEJA'/);
  assert.match(catalogMigration, /COMMIT;\s*$/);
  assert.doesNotMatch(catalogMigration, /INSERT\s|UPDATE\s|DELETE\s/i);
});

test("OpenAPI exposes registration, editing and checklist without deletion", () => {
  assert.match(spec, /\/equipos:\n/);
  assert.match(spec, /operationId: listEquipos/);
  assert.match(spec, /operationId: listEquiposLocations/);
  assert.match(spec, /operationId: createEquipo/);
  assert.match(spec, /operationId: updateEquipo/);
  assert.match(spec, /operationId: toggleEquipoChecklist/);
  assert.doesNotMatch(spec, /operationId: deleteEquipo/);
});