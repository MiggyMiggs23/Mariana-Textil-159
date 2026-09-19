# Tarea 5 — inventario exacto, adaptación parcial segura

Fuente del universo: lista de archivos de `reports/verificacion-suites-sin-poblacion.md`,
no el manifiesto de 28/29 pruebas de Prompt S. Sobre esos archivos se localizaron
`INSERT INTO usuarios` o `.insert(usuariosTable)` y se revisaron los setups:
**28 suites creadoras de usuarios**. Coincide con R2 del plan
`reports/prompt-u-plan-de-implementacion.md`. La tabla histórica
`reports/auditoria-suites-base-pruebas.html` corrobora el propósito de las inserciones.
El inventario reproducible con líneas y SHA-256 queda en `inventory.json`.

**a parcial** significa que la obligación separable se adaptó a observación de código
real sin base; **no** significa que toda la integración quedó reemplazada o verde.
Se conservan los originales íntegros: sus obligaciones de persistencia, seed, permisos
por endpoint y autenticación siguen en **b residual**. Esta separación evita fingir
cobertura quitando aserciones. Resultado: tres suites con extracción a; veinticinco b;
ninguna de las 28 integraciones originales ejecutada.

Las rutas de las 28 filas son relativas a `artifacts/api-server/src/`.
Todas las necesidades b son requisitos para un ensayo futuro autorizado, **no**
instrucciones ejecutadas. No se creó ninguna base, usuario, ADMIN ni sesión.

| # | Suite exacta | Grupo / resultado | Obligación y necesidad de b (incluido residual) |
|---|---|---|---|
| 1 | `admin-alertas.integration.test.ts` | b | Alertas desde tickets/crédito/salidas/notificaciones; PostgreSQL desechable con esquema, roles ADMIN/CAJA y permisos equivalentes, reloj y fixtures de dominio. Validar persistencia y cleanup fuera de desarrollo. |
| 2 | `admin-invariants.integration.test.ts` | b — no mutable, guardas E1 | Recuperación administrativa, cambio de roles/estado y rechazo atómico; requiere transacciones, cuentas de recuperación y permisos reales en copia desechable, más autorización de alcance protegido. No adaptar su SQL a predicciones. |
| 3 | `aplicaciones-pago-proveedor.integration.test.ts` | b | Reutiliza ADMIN o lo crea si falta; aplicaciones de pagos, entradas y reversos requieren FKs/triggers/transacciones en base aparte y actor autorizado. |
| 4 | `auditoria.integration.test.ts` | b | Cinco roles, alcance por sitio, escritura/lectura de auditoría y sesiones; base aparte con triggers append-only y actores permitidos. |
| 5 | `clientes-ajustes-api.test.ts` | b — frontera crédito protegida | Saldos, movimientos y ajustes reales de cliente, roles ADMIN/TERMINAL; necesita ledger, restricciones y reversión transaccional aislada. No tocar devoluciones/guardas E1. |
| 6 | `contenedores.integration.test.ts` | b | Contenedores, ubicación, roles y sesión; necesita FKs, asignaciones y restricciones persistidas en base independiente. |
| 7 | `cuadre-fiscal.integration.test.ts` | b — no mutable, frontera corte E2 | Cuadre/exportaciones y autorizaciones ADMIN/CONTADOR dependen de datos monetarios y corte persistidos; necesita base y permiso explícito de alcance protegido. |
| 8 | `equipos.integration.test.ts` | b | CRUD/catálogo, miembros y permisos individuales entre sitios; base desechable con actores y constraints de equipos. VM no acredita concurrencia ni persistencia. |
| 9 | `etiquetas-api.integration.test.ts` | b | Etiquetado, reimpresiones, permisos y sesiones, auditoría real; requiere inventario de prueba y tablas/actores autorizados en base aparte. |
| 10 | `inventory-six-view.integration.test.ts` | b | Seis vistas de inventario y alcance ADMIN/BODEGA sobre existencias reales; necesita datos, JOINs y agregaciones PostgreSQL. No interferir con la suite agrupada nueva de Tarea 1. |
| 11 | `kardex-api.test.ts` | b | Histórico de movimientos, stock, roles y permisos por ubicación; requiere movimientos ordenados/constraints y actores en base aparte; no confundir con filtro E8. |
| 12 | `lib/notificaciones-credito.test.ts` | b | Fechas calendario, permiso global y marca leída persistida entre peticiones; requiere clientes/tickets/notificaciones y actores aislados. |
| 13 | `lib/permisos.test.ts` | **a parcial adaptada**, b residual | Nuevo test T5 permisos: ADMIN sin lectura, deny-by-default, matriz completa, precedencia de override/rol personalizado/ubicación, cambios de rol observables y middleware 401/403/next. Sin creación de actor. Residual: seed específico de roles, escritura/relectura de permisos, JOIN real, invariantes y prevención de autoedición requieren base aparte. Se conserva P-01–P-26 original, sin retirarlos. |
| 14 | `metered-reference-cost.integration.test.ts` | b | Promedio por rollo y ventana de entradas.fecha, fallback de último costo; necesita ejecutar la consulta/agrupación real sobre entradas/rollos. Una respuesta SQL prefabricada no demostraría el promedio ni la ventana. |
| 15 | `pagos-dirigidos.integration.test.ts` | b — no mutable A+C/E1 | Autorización/aplicación dirigida, clientes/proveedor/tickets/ledger; requiere migraciones protegidas, transacciones, idempotencia y actor CAJA en base aparte. Ningún cambio ni prueba de esta integración aquí. |
| 16 | `pos-location-authorization.integration.test.ts` | b — no mutable E1/E2 | Alcance POS, permisos y caja, actores/sesiones; necesita sesiones de caja y restricciones/transacciones de venta en base desechable con autorización separada de guardas. |
| 17 | `postgres-unique-concurrency.integration.test.ts` | b | Colisiones concurrentes de usuario/cliente/producto y unicidad; exige múltiples conexiones PostgreSQL, transacciones y constraints reales. Inadaptable a dobles como prueba de concurrencia. |
| 18 | `precios.integration.test.ts` | b | Precio, historial, permisos, rollos y ventas reales; necesita DB y actores aislados. No ejecutar ni interferir con precio mínimo/remate de Tarea 4. |
| 19 | `productos-cache.integration.test.ts` | **a parcial adaptada**, b residual | Nuevo test T5 productos-cache ejecuta omisor real TERMINAL y observa precio/costo/margen/utilidad anidados ausentes, existencias/series conservadas, entrada intacta y modo no restringido. Residual: invalidación de caché, alcance y agregación de existencias por endpoint requieren DB, actores/sesiones y app; no quedan acreditados por el helper. |
| 20 | `productos-purge.integration.test.ts` | b | Borrado condicionado, permisos, confirmador e integridad de catálogo/existencias; necesita DB con FKs e historial real. No tocar borrado preparado por Tarea 4. |
| 21 | `proveedores-alcance-fechas.integration.test.ts` | b | Alcance PROPIA y fechas de entradas/pagos; necesita proveedores, entradas y pagos en sitios separados con actor BODEGA, schema real y transacciones. |
| 22 | `reportes.integration.test.ts` | b | Agregaciones/reportes de inventario, ventas/crédito/compras para ADMIN/CAJA por sitio; requiere dataset aislado y SQL real. Los totales no se sustituyen por fixtures de respuesta. |
| 23 | `role-access-matrix.integration.test.ts` | **a parcial adaptada**, b residual | Nuevo test T5 role-access-matrix: confidencialidad SUPERVISOR recursiva, campos financieros/documentos y retención operativa con omisor real. Residual: login y acceso HTTP de seis roles, seed, permisos y writes permitidos/prohibidos requieren base y sesiones aparte. No se acredita wiring de todas las rutas. |
| 24 | `security-api.test.ts` | b — cruza E1/E2, no mutable | Suite extensa de auth, roles, recuperación, ventas, salidas y datos sensibles; requiere esquema completo, actores/sesiones y transacciones en DB aislada. No reducirla a un helper ni mutar guardas protegidas. |
| 25 | `store-sales-global.integration.test.ts` | b | Ventas globales y por tienda, diferencia ADMIN/CAJA PROPIA; requiere tickets/lineas/pagos y consultas reales contra DB independiente. |
| 26 | `task57.integration.test.ts` | b — frontera caja E2 | Auditoría concurrente, purga fail-closed y apertura única de caja diaria con salidas descontadas una sola vez; requiere esquema/triggers, locks, conexiones concurrentes, ubicación Mariana sembrada y ledger real en base desechable. No acreditar serialización con mocks ni editar corte E2. |
| 27 | `task58.integration.test.ts` | b | Pisos de extremo a extremo sin contaminar kardex; requiere ubicaciones/pisos/rollos, permisos y efectos persistentes observados mediante API aislada futura, no API vigente. |
| 28 | `viajes.integration.test.ts` | b | Viajes, transportistas/movimientos y permisos por actor; necesita esquema, entidades/ubicaciones y transacciones reales en base aparte. |

## Evidencia de aceptación y límites

Manifiesto explícito de **un archivo, tres tests**; cada test contiene múltiples casos
y aserciones observables. Originales y política global intactos. No se importan entrypoints.
Comando reproducible desde raíz: `node reports/tanda-nocturna-20260919/tarea-5/run.mjs`.
Ver cierre de imports, inventario, identidad y logs en esta carpeta.

Tres defectos **reales en copias temporales del código de producción**:
ADMIN sin permiso de ver, TERMINAL devuelve payload sin filtrar, SUPERVISOR devuelve
payload sin filtrar. Cada uno debe producir exit 1 con ERR_ASSERTION en su test,
restauración exit 0 y verde final. No se altera el archivo activo ni el test
para fabricar el rojo; las copias se eliminan al acabar.

No se afirma E2E, equivalencia SQL, cobertura de concurrencia, ni todas las 28 suites
aprobadas. Tampoco se ejecutó typecheck raíz, que corresponde al cierre del agente
principal contra 80eaa93d. Commit: pendiente del principal; no se hicieron commits.