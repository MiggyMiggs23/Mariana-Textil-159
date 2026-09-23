# Tanda D — tarea 2: inventario y recomendación a MAIN

## Cierre de suite completa y estado comunicado por MAIN

**Comprobación HTTP posterior comunicada por MAIN:** health **200**, E7 disponibilidad **200 con enabled=false**, E7 atribución **403**. `/api/e5/cobros` devolvió **401**, no el 403 de la evidencia anterior con E11 OFF; la comprobación se detuvo por esa expectativa antigua. No se modificó fuente para cambiar el resultado.

La lectura confirma el orden en `routes/index.ts`: E11 router → E7 router → `createE11LegacyBoundary(E11_ENABLED, requireSession)` → E9 router → E5 router. Con E11 ON, esa frontera autentica antes de llegar a E5; `requireSession` sin cookie responde 401 y retorna, sin invocar el gate E5. E7 está antes y conserva su frontera OFF previa a autenticación. Por tanto **401 acredita rechazo de autenticación, no acredita E5 OFF ni ON**. El estado cerrado E5 se fundamenta por separado en sus constantes false y en `routes/e5.ts`/`e5-http.ts`: el primer middleware E5 es `e5OffBoundary`, que rechaza 403 E5_DISABLED cuando se alcanza (salvo disponibilidad OFF). Con sesión no CONTADOR válida se espera alcanzar ese gate; CONTADOR puede ser rechazado antes con 403 PERFIL_DENEGADO por E11. No se ejecutó aquí prueba autenticada ni se afirma que un 401 demuestre la puerta financiera cerrada. La diferencia se explica por precedencia de middleware, sin evidencia de apertura E5.

**Estado de pruebas no cambia:** suite E11 completa más nueve propias finalizada, 69/69 PASS y cero skips en la corrida única documentada abajo; este diagnóstico HTTP fue solo lectura y no repitió las pruebas.

MAIN informa que **API/UI sirven `dist-tanda-d-20260923` con E11 limitado junto con remate**. Health estuvo pendiente al entregar la suite y MAIN posteriormente comunicó el 200 registrado arriba; este subagente no hizo comprobaciones de servicio, DB o pantalla ni reinició workflows.

Por instrucción posterior se adaptó únicamente `artifacts/api-server/src/lib/e11.test.ts` y este informe:

- La aserción de configuración productiva exige ahora exactamente `[E11_ENABLED, E11_PROFILE_ASSIGNMENT_ENABLED, E11_RECONCILIATION_ENABLED, E11_E5_PREPARATION_ENABLED] = [true, false, true, false]`.
- Las dos pruebas de ausencia de SQL cuando OFF se conservan, ejecutadas dentro de `createE11Runtime` aislado con todos sus gates false. No se debilitaron capacidades, negativos ni guardas; no se modificó código de ejecución ya servido.
- Se ejecutaron **una sola vez juntas y sin filtros/skips** la suite completa y las nueve pruebas propias, desde `artifacts/api-server`:
  `node --import tsx --test src/lib/e11.test.ts src/lib/e11-tanda-d.test.ts`.
- Resultado: **69 pruebas, 69 PASS, 0 FAIL, 0 SKIP, 0 canceladas, exit 0**. Las tres aserciones anteriormente incompatibles/excluidas ya están cubiertas en esta corrida completa. Incluye OFF aislado, contrato ON limitado, asignación denegada antes de SQL, preparación E5 cerrada, fiscal saneado y negativos de autorización/replay/revocación.

Sin commits, DB real, cambios de gates ni otras fuentes en esta actualización. Los apartados siguientes preservan la cronología del análisis/preparación y sus resultados previos; sus estados «pendiente construir/servir» o pruebas filtradas ya no son el estado más reciente.

## Actualización posterior — implementación E11 limitada solicitada por MAIN

Esta actualización prevalece sobre el estado de análisis inicial que se conserva debajo. **Fuente preparada ON; no bundle construido/servido por este subagente.** Por instrucción posterior se cambió exclusivamente:

- `artifacts/api-server/src/lib/e11-feature.ts`: E11_ENABLED y E11_RECONCILIATION_ENABLED true.
- `artifacts/mariana-textil/src/lib/e11-feature-flags.ts`: E11_ENABLED, E11_UI_ENABLED y E11_RECONCILIATION_ENABLED true.
- Prueba propia nueva `artifacts/api-server/src/lib/e11-tanda-d.test.ts`.

Asignación de perfiles y preparación E5 permanecen false en API/UI; E5/A, E4, E12, E9 y E7 permanecen false. No se tocaron permisos compartidos, lógica de producción, fuentes task1, DB, workflows o commits. E4 queda detenido por el defecto documentado, sin reparación en este alcance.

**Comprobación del subgate de asignación:** identidad ADMIN no recibe PERFILES_ADMINISTRAR con profiles=false; rutas GET/PUT de perfiles exigen esa capacidad; e11AssignProfile además comprueba flags.profiles antes de SQL. UI oculta asignación mediante flag y capacidad. La prueba propia llama el comando real con ADMIN y acredita E11_DISABLED y cero consultas; no se ejecutó ninguna ruta administrativa. E11 global no permite asignar A con el subgate OFF.

La revocación de A por cambio de rol/actividad sigue siendo defensa de seguridad: solo puede quitar A/reingresar como F, no conceder A. El subsistema de recuperación ADMIN queda accesible con el módulo, pero su resolución solo confirma resultado o registra cierre sin efecto/tombstone; no ejecuta el productor de asignación o E5 ni mueve dinero. No se amplió ese subsistema. La conciliación es documental, con avisos por «no cuadra», nunca pago ni aceptación automática.

**Pruebas offline ejecutadas, sin conexión DB:**

- Desde `artifacts/api-server`: `pnpm exec tsx --test src/lib/e11-tanda-d.test.ts`: **9/9 PASS**. Gates API/UI, F default y no escritura, A saneado sin E5, ADMIN sin asignación, otros roles sin capacidades, consultas fiscales SELECT filtradas, períodos, denegación legacy y runtime explícito OFF sin SQL.
- `node --import tsx --test --test-skip-pattern='E11-OFF-' src/lib/e11.test.ts`: **57/57 PASS**. Incluye contratos fiscales/DTO, reautorización, snapshots, notificación «no cuadra» con rollback/replay e idempotencia. Los escenarios con gates allFlags en esta suite usan infraestructura sintética y no abren producción.
- `pnpm exec tsc --noEmit -p tsconfig.json`: **exit 0**.
- Transparencia: un primer intento de filtrar con `tsx --test-name-pattern` no excluyó los tres tests históricos E11-OFF-* y dio 57 PASS/3 FAIL porque éstos suponen flags productivos OFF. No se alteró esa suite ajena ni se presentan sus tres aserciones obsoletas como verdes. Su semántica OFF está cubierta explícitamente con runtime aislado en la prueba nueva. Un error inicial de firma en la prueba propia y otro de rootDir por import UI se corrigieron; corrida final y typecheck anteriores son verdes.

MAIN debe construir y servir el candidato combinado conservando E3/task1 y verificar la interfaz autenticada. Esta entrega no acredita liberación operativa, no cambia el bundle actual, no prueba DB real ni sustituye aceptación desde pantalla.

Fecha: 2026-09-23. **Análisis estático; no liberación ejecutada.** Se leyó la autorización de esta tanda, `replit.md` y la evidencia de liberación simple. No se modificaron fuentes compartidas, permisos, DB, bundles, configuración ni workflows; no se hicieron commits ni operaciones financieras.

## Conclusión ejecutiva

- **Candidato sin nueva decisión de negocio: E11 de lectura fiscal/financiera saneada y conciliación documental**, con preparación E5 apagada. P9/P10 ya deciden los perfiles y el alcance; no hay que volver a preguntar si F puede ver no facturado: no puede. La selección nominal de futuros A corresponde al propietario, no al agente. Se puede habilitar lectura F sin asignar A.
- **E4 no debe abrirse mediante sus dos flags solamente:** el control de insuficiencia de caja está acoplado a E12 OFF. Es un bloqueo técnico concreto, no una razón para abrir E12/Fondo ni una pregunta de política ya resuelta por P12. MAIN puede separar el control y verificar E4 antes de liberarlo; si no, dejar E4 detenido y seguir las otras tareas.
- **E12, E9, E5 y E7: no recomendar apertura global en esta tanda.** Sus gates incluyen conexiones/operaciones expresamente cerradas (Fondo, dirigido, retenido, devolución, atribución). Que sus reglas estén decididas o sus SQL instalados no levanta el cierre. Una apertura parcial de nuevo diseño no es «lo construido y apagado sin pendientes».
- Este informe no cambia el estado operativo ni declara pruebas autenticadas. MAIN decide y ejecuta únicamente las liberaciones comprendidas por tarea 2; una apertura dudosa se reporta, no se presume.

## Fuente versus bundle y cronología

La evidencia vigente es `reports/liberacion-simple-20260923/continuacion-resultado.md`, no el primer `resultado.md`, que quedó históricamente detenido antes de la continuación. Los TOML de ambos artefactos apuntan a **dist-simple-e3-tanda-b-20260923**. La inspección del archivo API de ese directorio confirma E3 ordinario true y E4/E12/E9/E5/E11/E7 false. `combined-source-review.json` documenta cuatro flags E3 abiertos y otros 34 cerrados en el candidato combinado; `combined-http.json` contiene pruebas anteriores de algunas fronteras OFF, no aceptación financiera.

La fuente de trabajo no equivale al bundle servido: al revisar, `artifacts/mariana-textil/src/lib/e3-feature-flags.ts` contiene E3 false, aunque la revisión combinada y el bundle publicado conservan E3 ordinario ON. No reconstruir ingenuamente desde el árbol y apagar E3; conservar las correcciones del candidato combinado y los cuatro gates ordinarios API/matriz/UI. La tarea 1 trabaja simultáneamente sobre fuentes compartidas: coordinar el ensamblado con MAIN.

Los cinco SQL Tanda B **ya tienen COMMIT** según la continuación. No repetirlos ni convertir el cambio de flags en otra instalación. No se verificó DB en esta tarea. Los preflights antiguos B0/B1 y exigencias suspendidas de hashes/PID no son bloqueantes de este análisis. El procedimiento simple no elimina controles de autorización, sitio, dinero o idempotencia.

## Inventario de gates, decisiones y efectos

Prefijos: API = `artifacts/api-server/src`; UI = `artifacts/mariana-textil/src`. Todos los gates siguientes se encontraron OFF en la fuente revisada.

### E4 — salidas extraordinarias y proveedor

- API `lib/e4-cash-out.ts`: `E4_CASH_OUT_ENABLED`; UI `lib/e4-feature-flags.ts`: mismo nombre. Ubicación fija `E4_MARIANA_LOCATION_ID=1` (identificador, no flag). Integración: API `routes/pos.ts`, `lib/e4-cash-out-repository.ts`, `lib/e12-e4.ts`.
- Abre captura, clasificación explícita, listados y revisión. Cambia el permiso de captura/listado de `cortes` a `cobros_pagos`; revisión administrativa conserva permiso de cortes. No modificar matriz ni resolver los 69 vetos pendientes.
- Captura: ADMIN/SUPERVISOR/CAJA; no ADMIN opera únicamente su sitio; sesión abierta de tienda. Extraordinaria: caja física, sin proveedor/Fondo. Proveedor: activo, únicamente Mariana. Aceptar/reclamar: ADMIN; responder: SUPERVISOR. Revisión documental no debe crear otro egreso.
- **Hallazgo impeditivo de abrir flags solos:** `e12E4Hooks.beforeInsert` retorna sin validar saldo cuando `E12_SUPPLIER_CASH_ENABLED=false`. E4 no impone ese saldo en `createE4CashOut`. Por ello abrir E4 dejando E12 OFF no acredita P12 (bloquear insuficiencia salvo ADMIN motivado).
- Decisión ya tomada: P12 autoriza excepción motivada solo para caja, nunca Fondo. No pedir autorización para permitir caja negativa sin control. Cambio mínimo propuesto a MAIN: desacoplar la guarda canónica de caja E4 del gate de pagos mixtos E12, conservando evidencia transaccional de desbloqueo y rechazando override no ADMIN. Verificar la UI de motivo y los errores, además de ambos tipos y rutas de proveedor; no basta remover el `return`.
- **Resultado: candidato funcional condicionado a reparación/verificación técnica; no se declara listo para abrir ahora.** Si implica ampliar el diseño o faltan garantías, detener E4 sin abrir E12.

### E12 — pago a proveedor caja/Fondo e inversos

- API `lib/e12-supplier-cash.ts`: `E12_SUPPLIER_CASH_ENABLED`; UI `lib/e12-feature-flags.ts`: `E12_ENABLED`.
- Integraciones: `routes/proveedores.ts`, `routes/pagos-dirigidos.ts`, `lib/e12-e4.ts`, `lib/e12-supplier-cash-repository.ts`, `lib/e12-cash-ledger.ts`, `lib/caja-corte-reader.ts`.
- Gate compuesto: pago desde caja, Fondo puro, mezcla, reintegro/corrección y control de insuficiencia. Proveedor exclusivo Mariana; no ADMIN limitado a ubicación 1; acceso Fondo y desbloqueo de caja solo ADMIN real. Caja exige sesión abierta Mariana; Fondo puro no exige turno. Partes suman exactamente el pago.
- P12/P13/P14 ya deciden: Fondo no excede saldo; excepción solo caja con historial; reintegro a cada origen exacto, no redirigirlo. No equivaler inverso contable a devolución física.
- **Pendiente exacto de apertura:** habilitación explícita de Fondo/conexión E12 y reconocimiento de saldo inicial real si corresponde; `replit.md` exige autorización separada de Fondo. No abrir este gate entero con la tarea 2. No usar E12 como atajo para reparar E4. Una versión caja-only exigiría fronteras API/UI nuevas: no está autorizada por inferencia.

### E9 — entregas completas de tiendas a Mariana

- API `lib/e9-feature.ts`: `E9_ENABLED`; UI `lib/e9-feature-flags.ts`: `E9_ENABLED`. Implementación `routes/e9.ts`, `lib/e9.ts`, `lib/e9-repository.ts`, `lib/e9-fondo.ts`, frontera `lib/e9-http.ts`.
- P8 ya decide envío completo al cierre, ADMIN/SUPERVISOR documentan con permiso real; no ADMIN limitado al sitio. Contar, autorizar y cerrar investigación: ADMIN. Diferencia abre investigación; cierre documental no altera corte ni ajusta dinero automáticamente.
- Autorización de recepción crea ingreso Fondo; información Fondo se elimina del DTO no ADMIN.
- **Pendiente exacto:** autorización de conexión recepción→Fondo, con Fondo habilitado íntegramente (movimientos/historial/arqueo) y saldo inicial reconocido sin duplicar efectivo. No es una decisión pendiente sobre entregar completo o quién envía: eso ya está contestado.
- Listado/detalle documental es conceptualmente no monetario, pero el gate actual abre también los comandos. No recomendar encenderlo para «solo ver». Separar lectores sería trabajo adicional, no una apertura segura ya lista.

### E5 — dirigido retenido, propuesta, aplicación y devolución

- API `lib/e5-feature.ts`: `E5_ENABLED`, `E5_CONTADOR_A_ENABLED`; UI `lib/e5-feature-flags.ts`: `E5_ENABLED`. Rutas `routes/e5.ts`; lógica `lib/e5.ts`, repositorio y frontera `lib/e5-http.ts`.
- Recepción: ADMIN/SUPERVISOR/CAJA/TERMINAL con permisos correspondientes; escritura no ADMIN de su sitio. ADMIN autoriza/rechaza/devuelve. Preparación A exige perfil A E11 real/versionado y todos los gates conjuntos; no se deriva de CONTADOR legacy.
- P4–P7 ya fijan espera tras rechazo, posibilidad de aplicación parcial, pérdida de devolvibilidad del remanente parcialmente aplicado, exactitud sin exceso cuando no está ADMIN y aviso desde tres días. No reabrir esas preguntas ni introducir FIFO automático.
- **Pendiente exacto:** autorización operativa de dirigido/retención y devolución completa nunca aplicada; fuente y habilitación de Fondo si se usa en devolución. El cierre previo es explícito. `E5_ENABLED` abre más que un visor; no se debe activar por considerar resueltas las reglas.
- `E5_CONTADOR_A_ENABLED` decide permitir a A preparar propuestas, no autorizar dinero. Sigue OFF junto con `E11_E5_PREPARATION_ENABLED`; no elegir usuarios A ni conceder permisos.

### E11 — perfiles, lectores, conciliación y puente E5

- API `lib/e11-feature.ts`: `E11_ENABLED`, `E11_PROFILE_ASSIGNMENT_ENABLED`, `E11_RECONCILIATION_ENABLED`, `E11_E5_PREPARATION_ENABLED`.
- UI `lib/e11-feature-flags.ts`: mismos cuatro y `E11_UI_ENABLED`. Implementación `routes/e11.ts`, `lib/e11-repository.ts`, `lib/e11-runtime.ts`; afecta también autenticación (`middlewares/auth.ts`) y permisos (`lib/permisos.ts`).
- `E11_ENABLED` + UI: identidad vigente, lectores y frontera CONTADOR. No es solo mostrar un menú: restringe accesos legacy y requiere esquema E11. F solo facturas/clientes facturados/ventas facturadas, no pagos, Fondo ni ventas no facturadas. A usa lector financiero saneado, no acceso irrestricto. ADMIN puede leer ambas superficies; no inferir acceso de SISTEMAS ni de otros roles.
- P9/P10 ya resuelven la política: CONTADOR sin asignación A expresa es F. El código deriva F si no hay fila A; no requiere inventar una migración ni escribir perfiles por el agente.
- **Lectores candidatos:** `/e11/identidad`, `/e11/fiscal/clientes`, `/e11/fiscal/ventas`, factura fiscal; lectores `/e11/finanzas/...` para ADMIN/A según capacidades. Mantener alcance y DTO del servidor, reautorización/versiones y prohibición de retroceder al lector legacy ante error. No tocar grupos 2–4 de Prompt P.
- `E11_PROFILE_ASSIGNMENT_ENABLED`: permite a ADMIN asignar perfiles con historial. Política ya definida, pero **quién recibe A es elección manual del propietario**. MAIN puede dejarlo OFF en una primera liberación de lectura F sin bloquear esa lectura; no asignar A automáticamente.
- `E11_RECONCILIATION_ENABLED`: habilita snapshots/decisiones documentales de F. P9 ya decide día opcional, semana/mes obligatorios, «no cuadra» notifica ADMIN para investigación. No hay vencimiento inventado, aceptación automática ni movimiento monetario. Candidato habilitable tras pruebas; OFF no impide lectores.
- `E11_E5_PREPARATION_ENABLED`: puente hacia propuestas reales E5. **Retenido pendiente de autorización E5**, exige además `E5_ENABLED` y `E5_CONTADOR_A_ENABLED`. No abrir con lectura/conciliación.
- **Cambio mínimo MAIN:** API `E11_ENABLED=true`; UI `E11_ENABLED=true`, `E11_UI_ENABLED=true`; opcionalmente los dos `E11_RECONCILIATION_ENABLED=true` si se valida esa función. Mantener preparación E5 y E5/A OFF. Asignación puede permanecer OFF sin inventar usuarios. Validar que las rutas reales/menús coinciden con capacidades y que el cambio de perfil revoca respuestas/cachés. No necesita una nueva decisión financiera, sí pruebas técnicas antes de servir.

### E7 — atribución y exportación Grupo 1

- API `lib/e7-feature.ts`: `E7_ENABLED`; UI `lib/e7-feature-flags.ts`: `E7_ENABLED`, `E7_UI_ENABLED`. Implementación `lib/e7-read-model.ts`, rutas/exportadores E7; contrato `reports/e7/contrato.md`.
- Todos los endpoints nuevos son GET, pero sustituyen la atribución financiera y exportaciones existentes, no son lecturas inocuas intercambiables. Cuentas Destino ADMIN/SISTEMAS conforme permisos; no concede tablero Tiempo real a SISTEMAS. Exportaciones con permiso real `clientes_finanzas.ver` y alcance Cartera. CONTADOR no obtiene override: F/A permanecen en E11.
- Recepción física global una sola vez; aplicación no es nuevo ingreso; retenido no es favor ni reduce deuda. En sitios no se inventa cobranza: total físico es null y se muestran aplicaciones comprobables. No atribuir históricos 51/52/53.
- **Pendiente exacto:** autorización operativa de atribución/Grupo 1 dentro de su alcance y dependencia E5. El contrato establece E7 ON con E5 OFF → 503, sin cero ni lector alternativo. No activar E5 para hacer pasar E7. Prompt P no se declara cerrado y grupos 2–4 no se reanudan.
- Solo `/e7/disponibilidad` es lector seguro existente OFF, sin DB; no representa habilitación del módulo.

## Secuencia precisa recomendada a MAIN

1. Mantener el operativo E3 ordinario y ensamblar tarea 1 sin restaurar inadvertidamente E3 OFF desde fuente. Mantener dirigido, devoluciones, retenidos, atribución y Fondo cerrados.
2. Priorizar E11 lectores (y conciliación documental si las pruebas pasan), aislando preparación E5. Comprobar F default, ADMIN, A previamente explícito si existe, no CONTADOR, revocación de perfil y denegaciones legacy; no crear cuentas ni asignaciones para simular aceptación en la base real.
3. Revisar E4 con el hallazgo de insuficiencia. Si se implementa la guarda independiente, verificar límite de saldo, ADMIN con motivo/historial, no ADMIN denegado, sitio propio, proveedor Mariana, sesión cerrada, UUID/replay y revisión sin nuevo dinero. Si no queda seguro, consignar detenido.
4. Mantener E12/E9/E5/E7 OFF y verificar que activar E11/E4 no los abre por efecto lateral. Disponibilidad OFF de E5/E9/E11/E7 puede comprobarse sin confundirla con funcionalidad habilitada.
5. Construir candidato API/UI coordinado; ejecutar pruebas técnicas/visuales de lo realmente liberado y registrar gates efectivos. Este análisis no ejecutó builds ni pruebas autenticadas ni comprobó una captura, porque no cambió aplicación alguna.

**Estado entregado:** inventario terminado; ninguna puerta abierta por este subagente. Las dudas financieras no bloquean tarea 1 ni la preparación de purga ni el análisis de la suite dirigida. No repetir SQL, no purgar y no usar la tarea 2 para forzar las dependencias cerradas de tarea 3.