## Retest focalizado CASH V10 — PASS en copia (26 septiembre, 10:37 UTC)

Se conserva íntegro abajo el FAIL histórico; este resultado corresponde a una **tanda nueva e independiente**, no a replay del ticket16.

- Copia exacta `postreview_financial_20260926`, origen `http://127.0.0.1:18328`, reloj normal. API `dafb028d684e3de6f04232908c5fa5054c9bb1757d5dc4bb7f40eb2a29585df1`; UI `92f6123346e12d569a724840102d9fff57f915086a8f0e48d4c5b7ccf774bf72`, comprobadas en cada contexto.
- **Seis actores trabajando durante196.075s**, 10:34:00.833–10:37:16.908UTC. Dos CAJA235/236, tres BODEGA237/238/239 y ADMIN234, sesiones aisladas. Primeros cobros iniciados con1ms de diferencia, junto a scanners y reportes.
- Tickets nuevos28–39 para235 y40–51 para236: **24/24 cobros nativos confirmados**,$12,000 por cajero, con GET independiente de cada ticket. Ninguna escritura SQL directa; stock y tickets creados por HTTP autenticado.
- Corte final leído por ADMIN: caja235 **$24,000** (baseline$12,000 + nuevos$12,000), caja236 **$12,000** (baseline$0 + nuevos$12,000).
- Tres scanners: **25 escaneos nativos por actor,75 respuestas exitosas**, en la auditoría1 previamente abierta. Son reescaneos de18 series existentes; el total sigue18, no se afirma haber creado75 registros únicos ni una auditoría nueva.
- ADMIN:25 consultas/navegaciones reales entre Ventas, Utilidad, Clientes y Control operativo. **6/6 identidades finales PASS**.
-1,307 respuestasHTTP; **0 HTTP500,0 erroresHTTP autenticados,0 pérdidas de sesión**. Los únicos seis401 son pre-login de `/api/auth/me`.
- LatenciaHTTP autenticada: p50=915ms, p95=1,728ms, p99=2,051ms, máximo2,956ms;20 respuestas>2s. Sin SLA inventado.
- **96 eventos de red `net::ERR_ABORTED`** capturados, en dashboard/notificaciones (6), consultas de ticket (24) y consultas de auditoría/listado (66). No se ocultan ni se cuentan como HTTP500: corresponden a solicitudes canceladas en cliente; las mutaciones y lecturas independientes completaron. El arnés no demuestra por sí solo la causa de cada cancelación.
- Preparación anterior al overlap tuvo un timeout de selector (se evaluaba visibilidad de “Unirme” antes de cargar detalle). Evidencia conservada en `overlap-1790418774460`; no llegó a cobros/escaneos. Se corrigió únicamente la espera del arnés, sin repetir una intención financiera.
- Journal viejo conserva `task2-collect-16=UNCERTAIN`; tickets16–27 no se tocaron. Config/journal nuevos e independientes: `browser-retest-config.json`, `/tmp/postrelease-review-20260926/postreview_financial_20260926/browser-task2-cashv10/`.

**Prueba terminal:** ejecución de `concurrency-retest.mjs` devolvió `PASS`, `overlapDurationMs:196075`, `serverErrors:0`, `errors:[]`. Resultado y timeline: [result.json](overlap-1790418825995/result.json), [timeline.jsonl](overlap-1790418825995/timeline.jsonl). Preparación: [fixtures](cashv10-fixtures-1790418705696/result.json). Hay24 capturasPNG de los seis actores en ready/ciclos0/12/24; [cajero235 final](overlap-1790418825995/cashier-0-round-24.png), [cajero236 final](overlap-1790418825995/cashier-1-round-24.png), [scanner237](overlap-1790418825995/auditor-0-round-24.png), [scanner238](overlap-1790418825995/auditor-1-round-24.png), [scanner239](overlap-1790418825995/auditor-2-round-24.png), [ADMIN](overlap-1790418825995/admin-0-round-24.png).

Este PASS valida la concurrencia focalizada solicitada **en la copia**. No implica liberación, nuevo recorrido financiero completo ni matriz de permisos terminada. MAIN conserva control de runtimes, commits y destrucción posterior de copias.

# Tarea2 — concurrencia nativa: defecto HTTP500 reproducido

**Resultado: FAIL de la aceptación completa.** Se lanzaron seis usuarios reales a la vez y se mantuvo una ventana de195.779segundos. Un cajero recibió HTTP500 en su primera colección simultánea y se detuvieron únicamente sus nuevas escrituras, preservando la operación incierta. Los otros cinco continuaron. **No se afirma que ambos cajeros cobraron exitosamente durante180segundos.**

## Corrección posterior preparada: candidato V10, pendiente de nueva tanda

MAIN extrajo la causa anidada original: `E5: grafo ocupado; abortar transacción completa, sin espera global`, en UPDATE de ticket16. Es el rechazo explícito40001 del trigger `e5_serialize`, no una prueba de deadlock ni del aislamiento SERIALIZABLE. La definición instalada se preserva en `cash-regression/installed-e5-serialize.sql`; fuente canónica `reports/e5/01-preparado.sql:222-236,711-718`.

**Cadena exacta de fuente V9:** `routes/pos.ts:786-804` abre tx y llama `cobrarTicket`; `lib/pos.ts:1843-1848` bloquea ticket, `:1865-1870` bloquea sesión de caja, `:1945-1953` inserta pagos, `:1955-1974` actualiza ticket. El trigger intenta entonces el lock global E5 con NOWAIT y rechaza si otro productor lo tiene. El pago insertado forma parte del rollback, no un cobro confirmado.

**Fix estrecho:** `routes/pos.ts:786-807` adquiere `pg_advisory_xact_lock(650005,5)` como **primera sentencia de ese tx**, antes de entrar al productor y tomar cualquier lock de ticket/sesión/FK. Las lecturas preliminares de ubicación/sesión están fuera del tx y no retienen locks de fila. No se movió una espera al trigger ni al interior tardío de `cobrarTicket`; no se agrega retry, no se cambia autorización, dinero, inventario o DTO.

### Regresión real ejecutada por el propietario del fix

`cash-native-regression.mjs` compila el **router real frozen V9 y el candidato**, invoca el handler completo de cobro con contexto CAJA y usa los helpers productivos reales, incluyendo validaciones, pago, actualización, inventario, auditoría y parsing de respuesta. No es un test aislado del helper de lock ni SQL de cobro reimplementado.

- PostgreSQL desechable autorizado; schema privado con108 tablas copiadas y268 FKs nativas, checks/índices y triggers de serialización E5 efectivos. Toda secuencia SERIAL privada se independiza antes de escribir; cero DML/secuencias públicos. Schema eliminado al terminar.
- Barrera real sostiene el lock E5: **baseline devuelve40001 con mensaje exacto**, cero pagos parciales y ticket intacto.
- Candidato espera; mientras espera, otra conexión obtiene `FOR UPDATE NOWAIT` tanto del ticket como de su sesión de caja: demuestra que aún no tomó esos locks. Al liberar, confirma200 con exactamente un pago$1,000, un COBRAR, autor y sesión correctos.
- Dos cobros independientes concurrentes confirman una vez cada uno. Carrera sobre el **mismo ticket** produce200/409 y exactamente un pago/auditoría.
- Duplicado posterior sigue409; importe incorrecto sigue400 sin efecto monetario.
- Rechazo nativo23514 de auditoría al final del trabajo revierte ticket/pago; inventario y número de movimientos permanecen intactos.
- Typecheck API completo PASS; sintaxis de artefactos PASS.

**Límites:** handler invocado directamente, no nuevo servidor ni prueba del middleware HTTP/auth. Esta regresión copia los triggers de serialización E5, no los demás grafos diferidos de negocio. Usa tickets privados clonados distintos de16; no ejecuta ni limpia la intención pública incierta. La concurrencia del harness es sobre una sesión de caja del fixture; **no sustituye la tanda de dos cajeros en sitios distintos y seis actores≥180s**. Los tickets normales del fixture ya tenían su salida de stock registrada antes del cobro; la prueba de rollback comprueba que ese inventario permanece intacto, no inventa un consumo adicional.

Resultados: `cash-regression/results.json`. Candidato: `artifacts/api-server/dist-owner-cash-v10-20260926/index.mjs`, SHA256 `dafb028d684e3de6f04232908c5fa5054c9bb1757d5dc4bb7f40eb2a29585df1`; manifiesto `cash-v10/candidate.json`. Exactamente **una fuente diferente frente a V9 publicado**, `routes/pos.ts`, idéntica a la fuente actual. Se preserva el fix de login V9 y el resto de fuentes frozen; no se reconstruye HEAD entero. Sin cambios UI/SQL. MAIN controla commit, activación y healthz.

### Revisión de orden en productores vecinos, sin ampliar este fix

El gate E5 cubre también sesiones de caja, salidas, Fondo, movimientos de crédito y sus adapters. `autorizarNota` toma ticket/sesión antes de CUSTOMER_CREDIT (`lib/pos.ts:2016-2050`); cierre y salidas usan sus propias fronteras (`routes/pos.ts:1053,1096`). No es seguro introducir una espera global genérica dentro de esos helpers después de sus locks. Se mantienen sus triggers try-lock fail-closed; **este candidato no promete eliminar40001 de todos los productores financieros**. Cualquier extensión requiere coordinación en la primera sentencia de su transacción y pruebas de su orden/atomicidad; queda al alcance independiente de tarea4.

**Handoff:** preservar journal de ticket16 sin replay automático; MAIN activa candidato en copia y el propietario de navegador prepara ventas nuevas e independientes para repetir la aceptación de seis actores. El FAIL histórico de abajo se conserva hasta ese resultado.

## Aislamiento y preparación

- Autorización original: [propietario](../autorizacion.txt). Mismo servidor desechable18328, PostgreSQL `postreview_financial_20260926`; nunca appDB.
- API `3aa7706416313c4bf5bbb0cfce03ee7f2151d0c36d6008579346b022d9c5a9ea`; UI `a296de5707e38b9996293f48f968fca1e480810931b5769286bebe9b75f83f6f`; comprobados en cada navegador, reloj normal.
- MAIN autorizó inicio después del commit de tarea1 `c3f95813`; no se modificaron código aplicativo, permisos existentes, gates ni reloj.
- Fixtures nuevos por API autenticada autorizada: sitios837/838,12 rollos válidos y12 tickets reales de$1,000 por sitio, cinco usuarios distintos con roles CAJA/BODEGA. ADMIN abrió nativamente las dos cajas porque el rolCAJA existente no tiene permisos de apertura; no se ampliaron sus permisos. Auditoría nueva iniciada nativamente en sitio835;18 series no vendidas de ese sitio para tres scanners.
- Seis contextos independientes de Chromium, seis cookies/sesiones/usuarios; tres scanners con emulación móvil y teclado nativo. No se simula hardware físico ni se sustituyen respuestas.

## Actores y trabajo observado

| Usuario | Rol/función | Trabajo real |
|---|---|---|
|235|CAJA, sitio837|12 cobros nativos de$1,000, todos confirmados; lectura individual de cada ticket. Caja$12,000.|
|236|CAJA, sitio838|Primer cobro ticket16 → HTTP500; no reintento ni nuevo cobro de ese actor; sesión seguía válida al final.|
|237|BODEGA, scanner piso14|25 escaneos nativos,6 series únicas y19 duplicados válidos.|
|238|BODEGA, scanner piso15|25 escaneos nativos,6 series únicas y19 duplicados válidos.|
|239|BODEGA, scanner piso16|25 escaneos nativos,6 series únicas y19 duplicados válidos.|
|234|ADMIN, reportes|25 navegaciones nativas entre Ventas, Utilidad, Clientes/crédito y Control operativo.|

- Barrera de login: acciones iniciadas entre1790417251737 y1790417251740ms, **dispersión3ms**. Los seis loginsHTTP200; duración completa hasta identidad confirmada3.567–4.706s. No se repitió login después de error.
- Trabajo concurrente: **10:07:43.430–10:10:59.209UTC,26 septiembre2026**,195.779s.
- Ambas colecciones iniciales se lanzaron a10:07:43.432UTC, junto con tres escaneos y consultaADMIN en el mismo ciclo.
- Los tres scanners y ADMIN siguieron acciones hasta10:10:55.43UTC. Cajero235 cobró cada16s hasta10:10:39.430UTC. Al final, **6/6 identidades** seguían autenticadas, sin cierre de sesión.

## Defecto crítico para MAIN: colección simultánea devuelve500

**Paso exacto:** cajero236, sitio838 → Cobros → ticket folio16 → Cobrar → Efectivo → Confirmar Pago, mientras cajero235 hacía lo mismo con ticket4 y tres BODEGA escaneaban la auditoría y ADMIN consultaba reportes.

- `POST /api/tickets/16/cobrar`,HTTP500, **10:07:46.046UTC**, latenciaHTTP1,070ms.
- Correlación: **`overlap-1790417248674-236-31`**.
- Respuesta: `INTERNAL_ERROR`; UI comunica “No se pudo completar la operación. No se guardaron cambios; intenta nuevamente…”.
- Cuerpo original conservado: `pagos:[{formaPago:EFECTIVO,importe:1000}], facturado:false`. Este endpoint no envió UUID de cobro; no se inventó uno. Ticket16 conserva el UUID auténtico de su creación.
- [Pantalla del error y diálogo](overlap-1790417248674/cashier-1-blocked-0.png).
- [Resultado completo](overlap-1790417248674/result.json), campo`serverErrors`.
- [Timeline correlacionado por petición/acción](overlap-1790417248674/timeline.jsonl).
- Journal privado: `/tmp/postrelease-review-20260926/postreview_financial_20260926/browser-task2/task1-state.json`, clave`task2-collect-16`, **UNCERTAIN** con cuerpo/status/respuesta intactos. **No hubo reintento ciego** ni se limpió esa evidencia.
- Causa SQL/source aún **no determinada**: MAIN debe correlacionar la traza servidor con el request-id indicado. Este owner no inspeccionó logs ni cambió código aplicativo. No se atribuye a deadlock/serialización sin la traza.

### Lectura independiente posterior

[Prueba sólo lectura](post-concurrency-readonly-1790417519211/result.json): nueva sesiónADMIN, GETs canónicos y PostgreSQL con`BEGIN TRANSACTION READ ONLY`, identidadDB validada.

- Ticket16 **no cobrado**,`pagos:[]`; PostgreSQL confirma`cobrado=false` y0 filas de pago. Caja de236=$0. Esto concuerda con rollback, pero el journal sigue reteniendo la incertidumbre original para revisión; no autoriza por sí solo a borrar/repetir la intención.
- Cajero235:12 pagos reales, suma$12,000, autor235 en PostgreSQL; corte esperado$12,000.
- Auditoría:18 series únicas, tres participantes;75 POST de scan exitosos. **57 duplicados conservaron autor y timestamp originales**, cotejando cada respuesta duplicada contra la primera captura. Pisos14/15/16 y autoría separados.
- No se volvió a cerrar caja ni se resolvió/canceló la auditoría como parte de este test.

## Rendimiento y sesiones

-1,243 respuestasHTTP observadas; **1 HTTP500** y ningún otro errorHTTP autenticado.
- Cero401 post-login;6/6 comprobaciones finales de identidadPASS.
- HTTP autenticado: p50 **913ms**, p95 **1,628ms**, p99 **1,989ms**, máximo **2,755ms**;11 respuestas superaron2s. Se reportan como observaciones, no como incumplimiento de un SLA inexistente.
- Los12 flujos de cobro confirmados duraron aproximadamente3.8–4.4s cada uno, incluyendo interacción nativa/espera y readback; no se confunden con latencia sóloHTTP.
- El assert final que esperaba$12,000 en ambas cajas falló precisamente porque la segunda quedó$0. Es consecuencia de la operación fallida, no un segundo defecto financiero.

## Evidencia y entrega

-22 capturas PNG de los seis actores, preparación, ciclos0/12/24 y error; texto de cada pantalla.
- Scripts reproducibles: `reports/owner-night-20260926/task1/concurrency-setup.mjs` y`concurrency.mjs`. No ejecutar de nuevo a ciegas: hay cobrosACK y una intenciónUNCERTAIN.
- Config pública sin credenciales: [browser-config.json](browser-config.json). Passwords/cookies quedan sólo en archivos privados0600 bajo/tmp, nunca en los reportes.
- La preparación tuvo un timeout de selector porque auditoría rotula el sitio con iniciales; corregido sólo en arnés y reanudado usando ACK existentes. No fue error de producto.

**Entrega a MAIN:** conservar este intento FAIL y correlación; corregir la causa del500 y planear una nueva tanda segura de seis actores/ambos cajeros activos≥180s antes de declarar PASS. MAIN es dueño del commit independiente de tarea2 y de cualquier fix/liberación. No se inició matriz de permisos18338 ni se destruyó la copia.