# Tarea 5 — desconexión PostgreSQL real

## Resultado

**PASS acotado: tres cortes reales antes de COMMIT, tres controles exitosos y dos reintentos idempotentes.** No se afirma cobertura de COMMIT ambiguo ni del transporte HTTP.

Ejecución final: 24/09/2026 05:08:31–05:08:34 UTC; comprobación documental posterior 05:08:59 UTC. Ningún caso alcanzó el límite de 12 minutos.

| Caso | Frontera determinista | PID propio terminado | Resultado |
|---|---|---:|---|
| Venta | UPDATE de estado de rollo terminado, transacción abierta, antes de COMMIT | 7297 | rollback exacto de negocio; retry exitoso |
| Abono efectivo | INSERT real en movimientos_credito terminado, antes de recibo/COMMIT | 7301 | rollback exacto; retry genera recibo |
| Cierre | UPDATE de sesión a CERRADA terminado, antes de auditoría/snapshot/COMMIT | 7304 | rollback exacto; retry cierra con snapshot |

`evidence.json` conserva hashes/conteos por tabla antes/después, PID, txid, SQL parametrizado de frontera, estado observado desde otra conexión, resultado de pg_terminate_backend y error real de socket. Los reintentos de venta con el mismo UUID y abono con la misma clave no modificaron ninguna tabla de negocio. No se etiquetó como idempotente un segundo cierre: ese productor rechaza una sesión ya cerrada.

## Aislamiento y método

Única base mutada: **tanda_ga_failure**, login no superusuario **ga_failure**, puerto55442, postmaster6420. Antes de cada terminación se verificó PID devuelto por PostgreSQL = processID del cliente capturado, base, rol, puerto, application_name exclusivo, estado idle in transaction y xact_start existente. Se verificó además PPid nativo Linux contra postmaster.pid del directorio privado; dicho archivo identifica directorio y puerto. No se enumeraron ni terminaron conexiones de otros workers.

Guardas reales `createTestDatabaseGuard`, `assertIsolated` y `assertPreparedTestDatabase` ejecutadas al inicio y nuevamente en cada conexión objetivo. El testigo aislado sirve como identidad de comparación; ninguna conexión a la base de aplicación. La lectura SQL de data_directory no está permitida para este rol: se sustituyó por la comprobación independiente postmaster.pid/PPid, sin elevar privilegios.

Los productores completos se compilaron desde el árbol congelado **ee1bb641e0513b7df18027ad351a72ebbe99af74**, con dependencias congeladas: crearTicket, confirmE3/e3Repository y cerrarSesionCaja. Se llamaron sus transacciones Drizzle reales, sin API server ni middleware HTTP. Única costura: envolver query de la conexión PostgreSQL para detener la continuación inmediatamente después de la escritura elegida; otra conexión propia invoca pg_terminate_backend. No se simularon respuestas SQL, recibos ni errores. La siguiente consulta del productor falló por la conexión terminada. No hubo cambios de producto, gates, inicializadores, arranques ni teardown.

## Invariantes comprobadas

`invariants.json`:

- 2 rollos de esta fixture vendidos, **0 sin ticket VENDIDO**.
- 1 abono ordinario de esta fixture, **0 sin recibo E3**.
- Sesión46 cerrada con un snapshot que conserva FONDO_INICIAL5000 y ABONO100; efectivo esperado5100.
- En cada corte, igualdad exacta del hash de todas las tablas públicas de negocio, incluidos inventario, tickets, dinero, recibos, caja y auditoría; por tanto la escritura parcial no sobrevivió.

Sesiones de autenticación se digieren por separado y permanecieron iguales. Las sesiones de caja **sí** están dentro del digest de negocio. Secuencias se registran separadamente, no se exige rollback de nextval: venta avanzó tickets_id_seq y ticket_lineas_id_seq; abono avanzó movimientos_credito_id_seq; cierre no avanzó secuencias. Esto no es dinero perdido ni documento duplicado.

## Límites e intentos conservados

Los dos `attempt-*.json` son evidencia de instrumentación inicial, **no PASS**. La primera ejecución no interceptó conexiones ya existentes en el pool: creó una venta completa válida sin corte. La segunda detectó que ese rollo ya no estaba disponible y no alcanzó la frontera. Se corrigió únicamente la costura del harness para incluir clientes existentes y seleccionar otro rollo disponible. Por ello el control final cuenta dos ventas válidas. No se limpiaron ni ocultaron esos intentos.

No se probó pérdida de confirmación de COMMIT: matar después de que el harness ya recibió COMMIT no demostraría un commit ambiguo de red. Tampoco se afirma haber cortado el cobro de ticket por separado: la frontera de venta probada corresponde a creación/consumo de inventario; el dinero efectivo se probó con el productor de abono. El abono100 terminó como saldo a favor documentado, no asignado a deuda previa. No se verificó UI, permisos HTTP ni autenticación de ruta.

Reproducción: `node reports/tanda-g-ampliada/tarea-5/run.mjs`, luego `node reports/tanda-g-ampliada/tarea-5/verify.mjs`, **solo sobre copia nueva equivalente**: la ejecución actual dejó legítimamente cerrada la sesión46. MAIN conserva control exclusivo de ciclo de vida y limpieza.