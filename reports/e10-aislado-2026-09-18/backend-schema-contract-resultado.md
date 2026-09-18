# E10 backend/schema/contract — entrega para arnés aislado

## Estado y fronteras

Se prepararon contrato, esquema Drizzle, servicio transaccional, router, OpenAPI/codegen, SQL revisable y pruebas puras. No se abrió ninguna base, no se aplicó SQL, no se ejecutaron pruebas de integración, no se crearon usuarios/sesiones y no se inició/reinició ningún workflow. `FONDO_E10_ENABLED` permanece apagada salvo valor exacto `true`.

El Fondo es un libro de efectivo físico bajo custodia fija en Mariana y no modifica ni se agrega a ventas, caja, cobranza, deuda, inventario o un supuesto total global de empresa.

## Firmas para el arnés del propietario

- Router real: `createFondoRouter({ db, authorizeAdmin, enabled? })` en `artifacts/api-server/src/routes/fondo.ts`.
  - `db`: `FondoPool`, pool PostgreSQL inyectado con `query`/`connect`; no importa singleton DB.
  - `authorizeAdmin`: arreglo obligatorio de middleware. Producción pasa `[requireSession, requireRole("ADMIN")]`; el arnés puede inyectar actor ADMIN existente sin crear sesión. El router vuelve a comprobar internamente el rol exacto ADMIN, por lo que el seam no concede bypass.
  - `enabled`: sólo seam del arnés; producción omite y lee exactamente `FONDO_E10_ENABLED === "true"`. No sustituye autorización.
- Servicios: `obtenerResumenEHistorialFondo`, `listarArqueosFondo`, `obtenerMovimientoFondo`, `obtenerArqueoFondo`, `crearMovimientoFondo`, `invertirMovimientoFondo`, `crearArqueoFondo`.
- Actor: `{ id, nombre, rol, ip }`; usar ID ADMIN ya existente.

Todos los escritores toman advisory transaction lock `4600112`, resuelven replay antes de versión/saldo mutable y usan `READ COMMITTED` para observar al escritor anterior tras adquirir lock. Resumen+historial usa una transacción `REPEATABLE READ`. El orden/versionado es `ordinal` monótono; `versionSaldo` expone el UUID correspondiente.

## SQL

- Operativo revisable: `sql/operativo.sql`.
- Inventario completo: `sql/inventario-objetos.md`.
- Probes ternarios negativos: `sql/negative-probes.sql`.

Objetos: tres tablas, una secuencia de ordinal, siete índices explícitos, cuatro funciones y cinco triggers, además de PK/FK/checks. El SQL identifica exactamente una `TIENDA` activa Mariana, inserta sólo metadata singleton sin saldo y protege inmutabilidad, identidad, orden inicial, centavos, diferencia, versión, inverso exacto/único e idempotencia.

## Pruebas y verificación realizada

`artifacts/api-server/src/lib/fondo.test.ts` cubre dinero `bigint`, entradas monetarias inválidas/fuera de rango, payload canónico, evidencia inicial en detalle, neutralización CSV y guard ADMIN propio del factory. Se agregó al manifiesto revisado `scripts/src/e10-backend-safe.txt`.

Ejecución pura real con `offline-test-guard.cjs`, `tsx`, concurrencia 1 y child env reducido a `PATH`, `HOME`, `NODE_ENV=test` y URL inválida no operativa (sin credenciales fuente): **6/6 PASS**, duración Node `486.873237 ms`, pared `571 ms`. No abrió DB ni red.

### Mutaciones reales en árboles temporales aislados

Cada árbol copió sólo los tres fuentes Fondo necesarios, enlazó dependencias instaladas, usó el mismo preload offline/env sanitizado, se eliminó al terminar y produjo RED de aserción (ningún parse/import failure):

| Mutante de fuente | PASS | RED | pared |
|---|---:|---:|---:|
| escala de centavos `100n→10n` | 4 | 2 | 453 ms |
| regex acepta dinero negativo | 5 | 1 | 478 ms |
| elimina orden canónico de claves | 5 | 1 | 465 ms |
| oculta conciliación inicial del DTO | 5 | 1 | 449 ms |
| omite neutralización de prefijos CSV con whitespace/control | 5 | 1 | 451 ms |
| invierte guard ADMIN obligatorio del router | 5 | 1 | 426 ms |

Total: **6 mutantes ejecutados, 6 detectados**, 7 aserciones RED observadas; todos terminaron exit 1 por pruebas, no por infraestructura. Salidas terminales se conservaron durante la comprobación en `/tmp/e10-mutant-*.txt` y matriz `/tmp/e10-mutants-matrix.json`.

También se ejecutaron correctamente codegen OpenAPI y typecheck de libs/API. No se afirma verificación PostgreSQL ni integración HTTP.

## Archivos de implementación

- `.local/e10-api-contract.md`
- `lib/db/src/schema/fondo.ts` y export en `lib/db/src/schema/index.ts`
- `artifacts/api-server/src/lib/fondo.ts`
- `artifacts/api-server/src/routes/fondo.ts` y montaje en `routes/index.ts`
- `lib/api-spec/openapi.yaml`
- salidas generadas en `lib/api-zod` y `lib/api-client-react`
- los cuatro documentos/SQL bajo este directorio

## Coordinación/gaps

La exclusión de filas Fondo en lectores/exportaciones genéricas de auditoría y notificaciones pertenece al worker de privacidad indicado por el padre; no se duplicaron sus cambios. El arnés aislado aún debe verificar concurrencia, rollback, endpoints ADMIN/no-ADMIN, conservación de dominios ajenos y los probes SQL. Aplicar a la base operativa necesita autorización textual separada.

Para rehearsal de autorización hay dos objetivos de mutación distintos: (1) el `requireRole("ADMIN")` del montaje productivo y (2) el guard ADMIN obligatorio, no configurable, dentro de `createFondoRouter`. Incluso con `authorizeAdmin: []`, un contexto no-ADMIN debe recibir `403` antes de `enabled` y antes de cualquier `query/connect`.