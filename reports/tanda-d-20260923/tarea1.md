# Tanda D — tarea 1

## Resultado y límites de liberación

**Cierre MAIN: liberado ON** para remate, precio mínimo y borrado individual de producto sin movimientos. Autorización: `autorizacion.txt`, punto 1. SQL real confirmado con COMMIT (`tarea1-live-sql.log`); API/UI sirven `dist-tanda-d-20260923`, conservando E3 ordinario abierto. UI validada en puerto alternativo antes del cambio y API healthz 200. Bundles anteriores conservados. Commit y estado consolidado en `INFORME.md`. Los apartados de preparación y límites de pruebas siguientes documentan qué se verificó y qué no.

### Implementación

- La marca se expone en la matriz `marcar_remate/autorizar`: ADMIN conserva acceso completo; sin filas el resto queda denegado. Se usa el resolver existente de usuario, rol personalizado y sitio; no se sobrescribe ninguna personalización.
- POST/DELETE/GET `/api/inventario/rollos/{id}/remate`. POST usa matriz; DELETE exige ADMIN. Ambas mutaciones exigen motivo no vacío, rechazan campos adicionales, bloquean el rollo, validan alcance y auditan dentro de la misma transacción. No se permite sobrescribir silenciosamente una marca. Retirar elimina exclusivamente la marca activa y conserva las auditorías de alta y retiro.
- Control montado en detalle del rollo, con hooks generados, refresco tras escritura y polling de 15 segundos para cambios de otros actores. Los errores son visibles.
- Se activa la conexión de venta previamente construida: marca por fuente física, nunca por producto ni declarada por el cliente; rechazo de rollos no autorizados; BOLSA/FIFO valida fuentes y costos físicos. Las cantidades/costos congelados y el cálculo de utilidad no se alteran: la venta bajo costo conserva su pérdida.
- El detalle de venta lee el snapshot `VENDER` y expone `remate/rollosRemate` en contrato y pantalla. Retirar una marca no borra la señal histórica de la venta.
- Precio mínimo en las mutaciones individual/masiva de Precios y UI. Igual al costo y subidas sin techo permitidos. **Costo ausente permite asignar precio**, según decisión documental del 21/09; costo inválido falla explícitamente. No se elimina ninguna guarda de costo en venta. La edición ordinaria de producto ya rechaza cambiar precio fuera de Precios; creación/importación de productos nuevos no tiene costo registrado.
- Se activa la excepción existente de purga individual: producto sin movimientos, existencia cero y credenciales ADMIN; elimina su historial de precios y conserva auditoría/reserva de SKU. No se construye ni ejecuta purga general.

## SQL

`tarea1-up.sql`: crea únicamente `tarea4_rollo_remate`, PK/FK a rollos, FK a usuario, motivo no vacío y fecha. Sin enums nuevos, backfill, inicializador o escrituras de permisos.

Ensayado exactamente con `psql -v ON_ERROR_STOP=1` en PostgreSQL 16 local desechable, puerto 56431, base `tarea1_test_remate`: BEGIN / CREATE TABLE / COMMIT, exit 0. No hubo fallo del SQL de migración. La instancia local quedó detenida y su directorio destruido, según `tarea1-build-cleanup.log`. Después MAIN lo aplicó a la base efectiva de la API: BEGIN / CREATE TABLE / COMMIT, exit 0.

`tarea1-fixture.sql` es exclusivamente infraestructura sintética de ensayo mínimo: **NO aplicar en la base real**. No sustituye la preparación de un esquema completo del candidato.

## Verificación

Evidencia durable: `tarea1-tests/`.

| Prueba | Resultado |
|---|---|
| Codegen Orval + typecheck libs | exit 0 |
| Typecheck API y UI | ambos exit 0 |
| `tarea4-inactive.mock.test.mjs` + `tarea4-remate-sale.mock.test.mjs` | 9/9 PASS |
| DOM real: control remate y dos regresiones de detalle de rollo | 4/4 PASS |
| PostgreSQL real: handler + adapter + resolver de permisos | 1/1 PASS |
| `git diff --check` | exit 0 |

La integración PostgreSQL verifica denegación inicial de seis roles, permiso personalizado CAJA, alcance de sitio, replay, motivo obligatorio, exclusividad ADMIN para retirar, atomicidad ante fallo deliberado de auditoría y espera del retiro ante un candado de rollo equivalente al que usa venta. También comprueba selección de fuentes contra marcas leídas de PostgreSQL y persistencia del motivo de retiro. No levanta Express ni workflows.

**Límites de cobertura:** la prueba PG usa esquema mínimo y ejecuta la política de venta, no `crearTicket` completo ni la purga/precios contra un esquema completo. La atomicidad de precios/purga continúa cubierta aquí por colaboradores de memoria; no se debe presentar esa parte como integración PG completa. La navegación autenticada, impresión de remate (no añadida), build candidato y smoke del proceso servido corresponden a MAIN. El detalle web sí muestra la señal persistida.

Mutaciones negativas: deshabilitar el piso causa exit 1 (aserción de rechazo ausente); conceder remate por producto causa exit 1 (3 fallos de autorización/fuentes físicas). En copia aislada del componente, quitar la condición de motivo del botón causa 2 fallos DOM semánticos / exit 1; restaurarla da 2/2 PASS. No se alteró fuente servida para estos ensayos.

Incidentes de preparación, resueltos y no presentados como PASS: primer ensayo PG falló en el preflight de esquema completo porque el fixture mínimo no tiene `usuarios.usuario`; el corredor final usa el modo existente `TEST_DATABASE_PREPARATION_PHASE=initializers` para ensayar el esquema mínimo sin arrancar inicializadores. Las guardas de URLs e identidad y el requisito local `tarea1_test_*` permanecen. Un intento posterior encontró el PG local detenido entre llamadas. La primera aserción del fallo deliberado de auditoría se corrigió para comprobar `error.cause`, porque Drizzle envuelve el error. Primer intento DOM sin PORT falló al cargar config; el definitivo no arrancó servidor.

### Comandos reproducibles

```sh
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/api-server exec tsc --noEmit
pnpm --filter @workspace/mariana-textil exec tsc --noEmit
node --test artifacts/api-server/src/tarea4-inactive.mock.test.mjs artifacts/api-server/src/tarea4-remate-sale.mock.test.mjs
PORT=52991 BASE_PATH=/ pnpm --filter @workspace/mariana-textil exec vitest run --environment jsdom src/components/tarea4-remate.dom.test.tsx src/pages/rollo-detail.test.tsx src/pages/rollo-detail-movement-navigation.dom.test.tsx
```

Para repetir PG: crear con `initdb -A trust -U runner` una instancia **nueva local desechable**, iniciarla con `pg_ctl ... -o "-h 127.0.0.1 -p 56431 -k DIRECTORIO_TEMPORAL"`, crear `tarea1_test_remate` y ejecutar:

```sh
psql -h 127.0.0.1 -p 56431 -U runner -d tarea1_test_remate -v ON_ERROR_STOP=1 \
  -f reports/tanda-d-20260923/tarea1-fixture.sql \
  -f reports/tanda-d-20260923/tarea1-up.sql
NODE_ENV=test TEST_DATABASE_PREPARATION_PHASE=initializers \
REQUIRE_ISOLATED_TEST_DATABASE=1 \
TEST_DATABASE_URL=postgresql://runner@127.0.0.1:56431/tarea1_test_remate \
APPLICATION_DATABASE_URL=postgresql://runner@127.0.0.1:56431/postgres \
pnpm --filter @workspace/api-server exec tsx --test src/tanda-d-remate.integration.test.ts
```

Detener el PG local al terminar. No se ejecutó build: MAIN conserva el build coordinado con sus superposiciones E3, y el comando de liberación vigente, no un build aislado de esta tarea.

## Archivos de esta tarea

- API: `src/lib/{permisos,pos,tarea4-gates,tarea4-price-floor,tarea4-remate,tarea4-remate-store}.ts`, `src/routes/inventario.ts`, `src/tarea4-inactive.mock.test.mjs`, `src/tanda-d-remate.integration.test.ts` bajo `artifacts/api-server/`.
- UI: `src/lib/tarea4-gates.ts`, `src/components/{tarea4-remate.tsx,rollo-remate-panel.tsx,tarea4-remate.dom.test.tsx}`, `src/pages/{rollo-detail,ticket-detail}.tsx`, `src/pages/precios/{detail,index}.tsx` bajo `artifacts/mariana-textil/`.
- Contrato: `lib/api-spec/openapi.yaml`.
- Generados: `lib/api-client-react/src/generated/{api.ts,api.schemas.ts}`; `lib/api-zod/src/generated/api.ts`, `lib/api-zod/src/generated/types/{index.ts,rolloRemate.ts,rolloRemateInput.ts,ticketDetalle.ts}`, `lib/api-zod/src/index.ts`.
- Informe, SQL y evidencias `reports/tanda-d-20260923/tarea1*`.

Cambios concurrentes de E11 u otras tareas no pertenecen a este listado.

## Recomendaciones para MAIN / memorias

Actualizar las declaraciones históricas de remate, precio mínimo y excepción individual todavía OFF en replit.md solo después de documentar la liberación efectiva. Registrar retiro ADMIN con motivo como sustitución del bloqueo documental anterior. No extrapolar esta apertura a devolución, Fondo ni otras puertas.

La matriz histórica de seed de Precios aún contiene VCE para SISTEMAS; esta tarea no reescribe permisos existentes ni semillas ajenas. Contrastar esa configuración heredada con la decisión documental de precios ADMIN-default antes de afirmar que todas las matrices históricas ya cumplen ese default. Remate sí cumple ADMIN-default/resto-DENY sin destruir personalizaciones.