# Tanda F — informe consolidado de diagnóstico

**Estado general: PARCIAL.** Este documento consolida la solicitud original y los resultados terminados de las cinco tareas. La tarea 1 completó también el negativo autenticado de API para el límite global; la tarea 2 terminó PARCIAL por un bloqueo natural del catálogo. La campaña fue exclusivamente diagnóstica: **no hubo correcciones de producto, cambios de esquema, cambios de permisos ni apertura de compuertas**.

## Alcance solicitado y estado

| Tarea | Requisito del propietario | Estado consolidado |
|---|---|---|
| 1. Crédito | Venta a crédito, abono parcial, liquidación, anticipo, saldo a favor, FIFO entre tres tiendas y límite duro global | **PASS dentro del alcance ejecutado.** Flujo y FIFO global comprobados por navegador; límite global rechazado tanto por UI natural como por API autenticada con rollback íntegro. |
| 2. Inventario | Entrada con series, traslado, recepción, venta parcial con sobrante, cancelación/devolución y conciliación por unidad después de cada paso | **PARCIAL.** Entrada, traslado, recepción, cancelación de traslado y separación de unidades PASS; venta parcial/remanente, cancelación de venta y devolución BLOQUEADAS porque no existe producto activo habilitado para metraje. |
| 3. Concurrencia | Dos cobros, dos ventas del mismo rollo, dos abonos y dos E4 simultáneas | **PARCIAL.** Cobros, rollo y E4 protegidos. En abonos uno termina y el otro recibe `40001`; requiere reintento manual y no es “ambos pasan”. |
| 4. Permisos | Toda acción negada por la matriz debe estar bloqueada también en API; comparar con UI | **PARCIAL.** 289 de 722 celdas negadas cubiertas; las 433 residuales quedaron clasificadas. Comparación de UI únicamente estática. |
| 5. Reversos | Reproducir diez vías, sin corregir, y determinar si duplican inventario | **PARCIAL con defectos confirmados.** Ocho vías reproducidas y dos bloqueadas. La clasificación exacta distingue stock duplicado/inflado, corrupción de estado y casos bloqueados. |

## 1. Recorrido de crédito

Se ejecutó con datos sintéticos en la copia `tanda_f_browser`, por controles reales de Chromium y sin forzar la interfaz:

- Se autorizaron tres notas de $1,500, una por tienda. La deuda global llegó a $4,500.
- Una cuarta autorización proyectó $6,000 frente al límite global de $5,000 y quedó deshabilitada en la UI.
- Los abonos de $500, $1,000, $2,000 y $1,000 se repartieron por antigüedad global: liquidaron primero la nota de tienda 1, luego la de tienda 2 y finalmente la de tienda 3, sin priorizar la tienda donde se capturó el pago.
- Un anticipo de $300 sin deuda autorizada creó saldo a favor. Al autorizar después la cuarta nota, esos $300 se aplicaron automáticamente y quedó deuda de $1,200.
- Conciliación: crédito autorizado $6,000; ingresos/abonos $4,800; deuda final $1,200; saldo a favor restante $0. No se observó duplicación.
- Las aserciones archivadas de orden, importes, aplicaciones, recibos y exclusión de la nota todavía pendiente terminaron PASS.

El seguimiento autenticado de API confirmó el límite sin depender del botón de UI: se crearon cuatro notas válidas de $1,500 en `tanda_f_permissions`, se autorizaron las primeras tres y el `POST /api/tickets/112/autorizar` de la cuarta devolvió **HTTP 409 `CREDIT_LIMIT_EXCEEDED`**. La deuda global era $4,500 y la proyectada $6,000; la deuda local proyectada de la tienda 838 era solo $3,000, por lo que el rechazo demuestra alcance global. La cuarta nota siguió PENDIENTE, solo existieron tres movimientos por $4,500 y las huellas de 106 tablas de negocio permanecieron iguales antes/después del rechazo. Sesiones se excluyeron por actividad normal de autenticación y no se afirma invariancia de secuencias.

El activo combinado `GALERIA.html` resume el resultado y presenta capturas curadas exclusivamente sintéticas de tareas 1 y 2. No contiene capturas ni datos copiados del catálogo o de cuentas reales y no carga recursos de red.

## 2. Recorrido de inventario

**Resultado: PARCIAL, sin descuadre en los pasos ejecutados.**

- Contenedor sintético programado con dos rollos METRO de 10; la confirmación de entrada añadió ambos a tienda 1.
- Un rollo se trasladó por el sitio virtual de tránsito y se recibió en tienda 2.
- Un segundo traslado en tránsito se canceló con motivo; el rollo volvió DISPONIBLE a tienda 1 y quedaron movimientos compensatorios, no borrado.
- Se trasladaron y recibieron por separado 10 KILO, 10 PIEZA y 10 BOLSA hacia tienda 3. Nunca se interpretó su suma como una cantidad homogénea.
- Se conciliaron 12 combinaciones producto/unidad/tienda después de cada snapshot. `assert.mjs` verificó 132 combinaciones; el audit final incluyó el caché del sitio de tránsito y terminó en cero para las cuatro unidades.
- METRO pasó de 70/70/60 en el baseline a 90/70/60 tras entrada, 80/80/60 tras recepción, 70/80/60 durante el segundo tránsito y 80/80/60 tras cancelarlo. KILO, PIEZA y BOLSA pasaron individualmente de 80/80/80 a 70/80/90 después de su traslado y recepción.

**Bloqueo conservado:** los cuatro productos sintéticos tienen `se_vende_por_metro=false` y el catálogo completo devolvió cero productos activos habilitados. No se habilitó producto, permiso ni gate. Por ello quedaron **BLOQUEADAS** la venta parcial con sobrante, su remanente, la cancelación de esa venta y la devolución de mercancía. La cancelación de una salida EN_TRANSITO no se presenta como sustituto. Este mismo prerrequisito explica el bloqueo del caso 3 de reversos; no permite declarar PASS general para otras configuraciones o permutaciones.

La interfaz conservó correctamente las líneas por unidad, pero algunos resúmenes omitieron PIEZAS o BOLSAS. Se registra como omisión visual, no como mezcla de unidades ni descuadre de base demostrado.

## 3. Concurrencia

| Escenario | Resultado |
|---|---|
| Dos cajeros, tickets distintos, misma sesión | **PASS:** ambos cobros persistieron; delta de pagos $3,000 y sin pérdida de actualización. |
| Dos cajeros, mismo ticket | **PASS negativo:** un cobro persistió y el otro recibió `ALREADY_CHARGED`. |
| Dos usuarios, mismo rollo | **PASS:** una venta persistió y la otra recibió `ROLLO_NOT_AVAILABLE`; caché, rollos y ledger bajaron 10 METRO, no 20. |
| Dos abonos del mismo cliente | **PARCIAL:** se observó contención real; uno persistió y el otro abortó con SQLSTATE `40001`. El reintento manual de la misma intención/UUID fue aceptado y su replay fue idempotente. **No fue un resultado donde ambas solicitudes terminaran exitosamente por sí solas.** |
| Dos E4 contra efectivo conjunto insuficiente | **PASS:** una salida persistió y la otra recibió `E4_CAJA_INSUFICIENTE`; el saldo quedó conciliado. |

El saldo final se concilió como $5,000 de fondo + $4,500 de tickets + $300 de abonos − $6,720 de E4 = $3,080. Las cuatro unidades se revisaron por producto y por separado; no se sumaron METRO, KILO, PIEZA y BOLSA entre sí. No se observó duplicación de dinero ni inventario, pero la disponibilidad de abonos concurrentes queda limitada por el `40001` y el reintento manual.

## 4. Permisos

**Veredicto: PARCIAL.**

- Siete roles naturales autenticados; ADMIN tenía 0 celdas naturalmente negadas.
- 289 de 722 celdas rol/módulo/acción negadas tuvieron evidencia de denegación; 225 fueron denegaciones observadas y 64 fueron observaciones en el límite legado E11 de CONTADOR, no pruebas de guards internos.
- Se hicieron **483 solicitudes autenticadas y 136 intentos de mutación**, todos 403. Las huellas de 106 tablas de negocio no cambiaron.
- Las **433 celdas residuales** quedaron clasificadas exactamente: 357 `NO_OPERATION_FOUND_STATIC`, 65 `BLOCKED_SYNTHETIC_FIXTURE`, 6 `BLOCKED_LEGACY_CAPTURE_GATE` y 5 `UNTESTED_SCOPE_RESTRICTION` por la prohibición de editar permisos.
- No se modificaron filas de permisos, roles, overrides ni compuertas.
- El helper congelado `hasPermission` coincidió con la matriz efectiva en 980 combinaciones, pero esa fue una evaluación **estática**. No hubo navegador para certificar botones ocultos, rutas compuestas, wiring de controles o condiciones `allowedRoles`/`allowedAnyModules`.

`NO_OPERATION_FOUND_STATIC` es una conclusión de revisión estática, no prueba de que sea imposible un endpoint dinámico. Los bloqueos de fixture/gate y las cinco ediciones de permisos no ejecutadas tampoco son PASS. Por tanto, no existe una certificación exhaustiva de paridad UI/API; las 289 celdas cubiertas, las 433 residuales clasificadas y la UI no ejecutada conservan el resultado general en PARCIAL.

## 5. Diez vías de reverso: clasificación exacta

No se resume como “ocho duplicaciones”. Los ocho casos reproducidos se separan por efecto observado:

| Caso | Clasificación | Resultado observado |
|---:|---|---|
| 1 | **CORRUPCIÓN DE ESTADO/UBICACIÓN** | Tras revertir RECEPCION, el rollo quedó PROGRAMADO con 0 en destino y aparecieron discrepancias opuestas entre ledger y rollos en origen/destino. No se etiqueta como duplicación genérica. |
| 2 | **STOCK DUPLICADO/INFLADO** | Revertir la salida restituyó disponibilidad en destino y sumó stock en origen; revertir después la venta añadió además stock contable en destino sin otro rollo. |
| 3 | **BLOQUEADO / NO REPRODUCIDO** | `METREADO_NO_HABILITADO` impidió crear el ticket parcial. No prueba seguridad. |
| 4 | **STOCK DUPLICADO/INFLADO** | Revertir `TRANSFERENCIA_SALIDA` ya recibida agregó 10 en origen mientras el rollo permaneció en destino. |
| 5 | **CORRUPCIÓN DE ESTADO** | Revertir `TRANSFERENCIA_ENTRADA` dejó el rollo EN_TRANSITO en destino, el documento RECIBIDA y restó 10 del ledger de destino. |
| 6 | **CORRUPCIÓN DE CANTIDAD/ESTADO** | PostgreSQL confirmó una cantidad −2 DISPONIBLE después de ajuste positivo, BAJA y reverso. |
| 7 | **CORRUPCIÓN DE DEPENDENCIA SEMÁNTICA** | El rollo terminó con 2 DISPONIBLE mientras la BAJA de 8 seguía vigente. |
| 8 | **CORRUPCIÓN DE ESTADO/UBICACIÓN** | El rollo quedó 10 DISPONIBLE en la ubicación técnica de tránsito mientras la salida seguía EN_TRANSITO. |
| 9 | **STOCK INFLADO SIN RESPALDO DE ROLLO** | El reverso de CANCELACION elevó ledger/caché de KILO de 80 a 82 mientras los rollos siguieron en 80. |
| 10 | **BLOQUEADO / SIN FILAS** | No existían movimientos históricos `DEVOLUCION`; no se fabricó productor ni fila. No prueba seguridad. |

Resultado: **3 casos de stock duplicado/inflado (2, 4 y 9), 5 de corrupción de estado/cantidad/ubicación (1, 5, 6, 7 y 8), y 2 bloqueados/no reproducidos (3 y 10).**

## Identidad, aislamiento y referencias

- Fuente congelada usada para preparar la campaña: commit `e4da40416ae57d70df0fbd3a2ac6e256f91e23b0`.
- Build API congelado: SHA-256 `f707c42b04687cba24549e0fc5566324e45eb015ec2fa90325cba98a446ebf27`.
- Build UI congelado (`dist/index.html`): SHA-256 `6909b2638576c8735ccffa14959c6f0872fffbeaac5adce48e22520e9dabbea4`.
- HEAD observado al consolidar: `d29d591e3d485cac0ede6b0219c5271ace511eb4`.
- Commits de tarea ya existentes: tarea 1 navegador/FIFO `ccb8bef8a76dc87c9c2b07f7df9fbd2e34993245`; tarea 1 seguimiento API `ef14a7c9c937f438892ec47b62386ff5b0818392`; tarea 2 `391ac6f150cc625709c624faf212d892f1a0ff33`; tarea 3 `46402a0c8dbb2b96b25e1ca5c984137a69309ae6`; tarea 4 inicial `498fe536533689b99be00ef373cabb667f5a7430`; tarea 4 seguimiento final `d29d591e3d485cac0ede6b0219c5271ace511eb4`; tarea 5 `812d07e8848f87527962811be59d2626d81099da`.
- Las bases desechables comparten el cluster privado de PostgreSQL 16 en `127.0.0.1:55440`, con directorio `.local/tanda-f/cluster`, pero están separadas por tarea.
- El dataset original restaurado es sensible. Los identificadores sintéticos pueden aparecer en la evidencia; no deben confundirse con anonimización integral del restore.

Cada commit existente corresponde a una sola tarea. Este cierre **no crea commit**, no añade todo a staging y no modifica reglas de Replit.

## Seguridad de los artefactos y cierre operativo

Se revisaron las **167 salidas textuales** finales de `reports/tanda-f/` con patrones para claves privadas, URL con contraseña, bearer, JWT y asignaciones de secreto/contraseña/token. También se compararon de forma privada, antes del teardown, **10 secretos sintéticos conocidos** contra este informe, el activo HTML y los 10 textos visibles que acompañan las capturas curadas; no se imprimieron ni incorporaron valores al reporte. Resultado: **0 coincidencias de patrones de alto riesgo y 0 coincidencias de secretos privados**. Los secretos ya fueron destruidos y esa comparación privada no es repetible. Esto no vuelve público ni anonimizado el dataset original; la sensibilidad del restore se respetó durante toda la campaña.

**Teardown terminado y verificado por MAIN.** `teardown-verification.json` registra los puertos 43820, 43821, 43831 y 55440 cerrados, cero procesos privados restantes y eliminación de `.local/tanda-f`, incluidas las seis bases desechables, dumps, credenciales sintéticas y fuente privada. Los backups preexistentes quedaron intactos y no cambiaron workflows de aplicación.

El primer intento de `teardown-main.sh` se negó de forma segura ante un `postmaster.pid` obsoleto después de terminar los launchers. `pg_ctl status` confirmó que no había servidor ejecutándose; por ello **no se reclama parada grácil por `pg_ctl`**. MAIN verificó el estado y eliminó después exclusivamente el directorio privado.

## Límites del cierre

- No se hicieron fixes ni se abrieron gates.
- No se modificó fuente, esquema, permisos ni reglas de Replit.
- No se ejecutó contra la base de la aplicación.
- Tarea 2 permanece PARCIAL por el bloqueo natural de metraje; el negativo API del límite global terminó PASS.
- No se ensayaron las permutaciones bloqueadas de venta parcial, remanente, cancelación de venta y devolución, por lo que no existe PASS general de inventario ni reversos.
- La limpieza quedó demostrada por `teardown-verification.json`; no se reclama una parada grácil que no ocurrió.
