# Fase 2 — validaciones previas

**Fecha:** 2026-09-13  
**Resultado:** **DETENIDA; no hubo purga efectiva.** La última repetición de
rehearsal terminó con `exitCode=2`, hizo rollback y no creó respaldo:

```text
ticket verification helper failed; purge rolled back:
ticket verification is blocked: no existing active user/site/client/metered product is available
```

Evidencia: `.local/phase2-purge-evidence-20260913154720654.json` y
`.local/phase2-purge-state.json`. El preflight previo fue PASS
(`.local/phase2-purge-evidence-20260913154551055.json`). No se debe interpretar
la repetición como una purga parcial.

## Comandos y conteos existentes

No se ejecutaron pruebas nuevas para este reporte; los conteos provienen de los
logs existentes.

```sh
pnpm run typecheck
pnpm --filter @workspace/db run test:guard
pnpm --filter @workspace/db run test:runner
pnpm --filter @workspace/mariana-textil test
pnpm --filter @workspace/metered-pricing test
pnpm --filter @workspace/number-format test
pnpm --filter @workspace/scanned-code test
```

| Grupo | Archivos/suites | Tests | Pass | Fail | Skip/bloqueados |
|---|---:|---:|---:|---:|---:|
| Typecheck completo | 4 etapas | — | PASS | 0 | 0 |
| DB `test:guard` | 2 | 9 | 9 | 0 | 0 |
| DB `test:runner` | 1 | 11 | 6 | 0 | 5 skips de ciclo de vida PostgreSQL local |
| API estático, log `/tmp/static-api-tests-full.log` | 87 | 407 | 392 | 12 | 3 skips; 7 bloqueados dentro de los 12 |
| Frontend contracts, `/tmp/frontend-tests.log` | 65 | 187 | 183 | 4 | 0 |
| Paquetes compartidos | 3 | 24 | 24 | 0 | 0 |

El agregado de los tres grupos estáticos finales fue **155 archivos, 618
tests: 599 pass, 9 fallos conocidos, 7 bloqueados y 3 skips**. Los cinco
grupos estáticos de Fase 2 ya existentes en `/tmp/phase2-*.tap` sumaron 91
tests: analytics 5/6, caja 28/28, inventario 13/13, POS 16/16 y salidas
26/28; total **88 pass, 3 fallos**. No son pruebas de integración con datos
persistidos.

## Fallos reales reportados

### API — 5 fallos de contrato conocidos

1. `src/advisory-locks.contract.test.ts` — **advisory lock namespaces are complete, int32, and unique**.
2. `src/bloque6-reversos.contract.test.ts` — **Bloque 6: aplicaciones activas son la única fuente y comparten lock de cliente**.
3. `src/kardex-block2.contract.test.ts` — **outgoing preset retains read scope and supplies destination, documents, units and absolute totals**.
4. `src/salidas-api.test.ts` — **Frontend finalizes from Salida Nueva and detail has no second send action**.
5. `src/transferencias-block3-architecture.test.ts` — **Block 3 retains active transfer equivalents and Salidas callers**.

### Frontend — 4 fallos de contrato conocidos

1. `src/pages/detail-link-tables.contract.test.ts` — **detail-capable table identifiers have one primary link and declared routes**.
2. `src/pages/precios/precios-grouping-bulk.contract.test.ts` — **catálogo agrupado conserva unidad, especificaciones y totales separados**.
3. `src/pages/salidas-status.contract.test.ts` — **desktop and mobile salida rows render the same shared component from salida.estado**.
4. `src/pages/salidas-venta-errors.contract.test.ts` — **ENTREGADA is present in salida maps, generated state filter, and closed-detail behavior**.

Estos nueve son desajustes de contrato ya observados; no se corrigieron ni se
convirtieron en skips.

## Los 7 archivos bloqueados por falta de DB aislada

Estos son los siete fallos de carga/guard del barrido API, no fallos funcionales
de la purga:

1. `src/admin-bypass-empty-permissions.test.ts` — consulta un ADMIN activo y
   terminó en `ECONNREFUSED 127.0.0.1:1`.
2. `src/lib/pending-costs-schema.test.ts` — DDL destructivo temporal; exige
   `NODE_ENV=test` y `TEST_DATABASE_URL`.
3. `src/lib/permisos.test.ts` — consulta una ubicación `TIENDA`; terminó en
   `ECONNREFUSED 127.0.0.1:1`.
4. `src/lib/salidas-schema.test.ts` — DDL/migración temporal; exige
   `TEST_DATABASE_URL`.
5. `src/lib/ticket-credit-schema.test.ts` — muta y restaura el esquema; exige
   `REQUIRE_ISOLATED_TEST_DATABASE=1` y `TEST_DATABASE_URL`.
6. `src/lib/ticket-iva-schema.test.ts` — DDL de IVA; exige explícitamente
   `NODE_ENV=test` y `TEST_DATABASE_URL`.
7. `src/lib/ticket-line-types-schema.test.ts` — DDL temporal; exige
   `NODE_ENV=test` y `TEST_DATABASE_URL`.

## Cinco suites de integración solicitadas, todavía bloqueadas

Son las cinco áreas nombradas por la Fase 2; **no están aprobadas para poblar
una base** por la política `lib/db/src/isolated-test-policy.mjs`. Ejecutarlas
requiere autorización explícita de fixtures aislados y una base disposable
distinta de development.

| Área y comando | Por qué no se puede ejecutar ahora |
|---|---|
| Inventario — `pnpm --filter @workspace/api-server run test:inventario` (`src/lib/inventario.test.ts`) | Crea productos, ubicaciones, rollos y movimientos; muta DB y limpia al final. Requiere DB aislada explícita; no puede usar development ni asumirse seed-only. |
| POS — `pnpm --filter @workspace/api-server run test:pos` (`src/lib/pos.test.ts`) | Crea entradas, productos, rollos, clientes, tickets, pagos, crédito y sesiones; requiere usuario seed y URL aislada. |
| Caja — `pnpm --filter @workspace/api-server run test:cuadre-fiscal-integration` (`src/cuadre-fiscal.integration.test.ts`) | Inserta ADMIN/CONTADOR, sesiones, clientes, tickets y movimientos de crédito para probar el flujo fiscal; necesita actores y fixtures propios. |
| Salidas — `pnpm --filter @workspace/api-server run test:salidas` (`src/lib/salidas.test.ts`) | Crea catálogo, pisos, rollos, existencias y documentos de salida; es una suite mutante protegida por `TEST_DATABASE_URL`. |
| Analytics — `pnpm --filter @workspace/api-server run test:admin-analytics-integration` (`src/admin-analytics.integration.test.ts`) | Reutiliza el ADMIN canónico, pero crea tiendas, cliente, productos, rollos, sesiones de caja, tickets, crédito y salidas; el actor seed no autoriza las filas de negocio adicionales. |

La política solo permite actualmente `prepare-smoke`,
`test:ticket-iva-schema` y `test:admin-realtime-reconciliation`; estas cinco
no forman parte de esa allowlist. Además, el rehearsal probó que el seed
restaurado no ofrece la combinación activa requerida para un ticket válido
(usuario, tienda, cliente y producto metrado). No se debe fabricar un ticket,
sesión o actor en development para sortear el bloqueo.

## Estado operativo y decisión pendiente

- El rehearsal fue transaccional y revirtió; el respaldo verificado permanece
  intacto.
- El API de development/unpurged fue reiniciado durante el intento. Debe
  mantenerse detenido para cualquier verificación posterior de `A=0`: el
  arranque inicia el poller de stock mínimo y puede regenerar episodios y
  notificaciones.
- No cambiar la configuración mínima habilitada para forzar `Cmin`; reportar
  el API pausado.
- La siguiente acción requiere que el usuario autorice fixtures únicamente en
  una base disposable aislada (sin actores de backup), o acepte que estas cinco
  suites continúen pendientes. No ejecutar la purga real mientras el helper
  de ticket válido siga bloqueado.