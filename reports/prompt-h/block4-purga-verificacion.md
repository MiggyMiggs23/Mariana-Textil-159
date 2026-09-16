# Prompt H — Bloque 4: verificación de purga autorizada

## Veredicto

**PASS — `COMMITTED_POSTCOMMIT_READ_PASS`**, según
`.local/prompt-h-authorized-purge-status.json` y
`reports/prompt-h/authorized-purge-execution.log`.

La cita exacta del propietario fue **`Autorizo la purga`**. La autorización y su
alcance se conservan en `reports/prompt-h/autorizacion-purga.md`; el SHA-256
registrado de ese archivo es
`9d27fc0029d37ba665dcaef49a6481213b7bd89952cc4fd5df10786d0cabbc04`.
La aplicación fue la operación estrecha autorizada: una transacción, `TRUNCATE`
solo de A con `CONTINUE IDENTITY RESTRICT`, seis objetivos B y reconstrucción de
`existencias` con `reconstruirCacheExistencias(tx)`. No se usó `DELETE`, no se
reiniciaron secuencias, no se deshabilitaron triggers y no se crearon usuarios,
semillas o sesiones.

La fuente/API permaneció pausada durante respaldo, preflight y apply;
`apiRestarted: false`, `sourceApiRestarted: false` y `readOnly: true` describen
la lectura directa del apply. Después del commit, MAIN reinició una vez la API
y el frontend para la comparación post-arranque; la API volvió a quedar
pausada después del drift y el workflow actual está `finished`.

### Instantes y límites de timestamp

El estado durable final y el log de ejecución fueron escritos en
`2026-09-16T04:11:21.713753389Z` (timestamp del archivo, UTC). El artefacto no
persiste un timestamp independiente emitido por PostgreSQL para la frontera
`COMMIT`; por eso el instante anterior es el timestamp exacto de finalización y
persistencia de la evidencia `--apply`, no una afirmación de un reloj interno de
PostgreSQL. Como referencias de la misma secuencia:

- respaldo verificado: `2026-09-16T03:42:48.408Z`;
- preflight de solo lectura: `2026-09-16T03:48:10.327Z`;
- bloqueo inicial por el estado de trigger: `2026-09-16T04:11:18.409753389Z`;
- lectura directa posterior: capturada después del commit, con
  `sourceApiRestarted: false` y `readOnly: true`.

No se exponen credenciales, host, IP, contraseñas ni filas sensibles.

## Identidad, respaldo y límites de evidencia

La transacción verificó `heliumdb.public`, PostgreSQL `16.10`, usando el mismo
pool de Drizzle de la aplicación. El respaldo vigente fue:

- directorio: `.local/backups/prompt-h-block2-20260915214248-7517`;
- dump: `440802` bytes;
- SHA-256:
  `da7d3f7f342756511c6a04d000f0f4f4fa3feea6b9caad21e6abec5213dffb22`;
- Drive y restauración: `reports/prompt-h/block2-drive-verification.json` y
  `reports/prompt-h/block2-restore-metadata.json`.

El preflight que precedió la aplicación fue la lectura de
`2026-09-15 21:48:10.327 America/Mexico_City` y coincidió con ese respaldo.
Ese preflight sigue siendo evidencia **pre-startup y pre-purga**; la evidencia
postcommit de este documento no implica que la API haya vuelto a arrancar.

El conjunto se descubrió dinámicamente y se mantuvo en **60 tablas: A=35,
B=7, C=18**. No se reutilizan listas históricas parciales.

## A — 35 tablas: antes y después

La columna «antes» es la captura bloqueada previa a escribir. Después del
commit, el conteo y el hash canónico de cada tabla A fueron cero y
`d41d8cd98f00b204e9800998ecf8427e`, respectivamente.

| Tabla A | Antes | Después |
| --- | ---: | ---: |
| `aplicaciones_credito` | 2 | 0 |
| `aplicaciones_pago_proveedor` | 4 | 0 |
| `auditoria_inventario_escaneos` | 0 | 0 |
| `auditoria_inventario_participantes` | 0 | 0 |
| `auditoria_inventario_snapshot` | 0 | 0 |
| `auditorias_inventario` | 0 | 0 |
| `autorizaciones_nota` | 2 | 0 |
| `contenedor_lineas` | 0 | 0 |
| `contenedores` | 0 | 0 |
| `cuadre_fiscal_registros` | 0 | 0 |
| `entradas` | 6 | 0 |
| `movimientos` | 307 | 0 |
| `movimientos_credito` | 8 | 0 |
| `notificaciones_credito` | 2 | 0 |
| `notificaciones_sistema` | 16 | 0 |
| `pagos_proveedor` | 9 | 0 |
| `reimpresiones_etiqueta` | 146 | 0 |
| `revisiones_etiqueta` | 31 | 0 |
| `rollos` | 226 | 0 |
| `salida_lineas` | 2 | 0 |
| `salida_rollos` | 12 | 0 |
| `salidas` | 2 | 0 |
| `salidas_dinero_caja` | 0 | 0 |
| `sesiones` | 11 | 0 |
| `sesiones_caja` | 2 | 0 |
| `sesiones_caja_dias` | 2 | 0 |
| `solicitudes_pago_dirigido` | 0 | 0 |
| `stock_minimo_episodios` | 4 | 0 |
| `ticket_linea_consumos` | 20 | 0 |
| `ticket_lineas` | 57 | 0 |
| `ticket_pagos` | 4 | 0 |
| `tickets` | 6 | 0 |
| `viaje_salidas` | 0 | 0 |
| `viaje_tickets` | 0 | 0 |
| `viajes` | 0 | 0 |

## C — 18 tablas preservadas

El conteo y el hash canónico completo son iguales antes y después. El método es
`md5(COALESCE(string_agg(md5(to_jsonb(t)::text), '' ORDER BY
to_jsonb(t)::text, md5(to_jsonb(t)::text)), ''))`; no se almacenaron filas
crudas.

| Tabla C | Antes: conteo / hash | Después: conteo / hash |
| --- | --- | --- |
| `auditoria` | 3286 / `ebfb27fc49b43dbf3eb4082729d84b0d` | 3286 / `ebfb27fc49b43dbf3eb4082729d84b0d` |
| `camionetas` | 0 / `d41d8cd98f00b204e9800998ecf8427e` | 0 / `d41d8cd98f00b204e9800998ecf8427e` |
| `choferes` | 0 / `d41d8cd98f00b204e9800998ecf8427e` | 0 / `d41d8cd98f00b204e9800998ecf8427e` |
| `cliente_documentos` | 0 / `d41d8cd98f00b204e9800998ecf8427e` | 0 / `d41d8cd98f00b204e9800998ecf8427e` |
| `clientes` | 7 / `57547451eec364bf428e41924ded0b49` | 7 / `57547451eec364bf428e41924ded0b49` |
| `equipos` | 0 / `d41d8cd98f00b204e9800998ecf8427e` | 0 / `d41d8cd98f00b204e9800998ecf8427e` |
| `equipos_checklist` | 0 / `d41d8cd98f00b204e9800998ecf8427e` | 0 / `d41d8cd98f00b204e9800998ecf8427e` |
| `permisos_rol` | 192 / `4d18bc7f2e1076313bc0ed9cddfffe88` | 192 / `4d18bc7f2e1076313bc0ed9cddfffe88` |
| `permisos_ubicacion` | 54 / `bc5e55897a9b7e834766d59550c35db1` | 54 / `bc5e55897a9b7e834766d59550c35db1` |
| `permisos_usuario` | 0 / `d41d8cd98f00b204e9800998ecf8427e` | 0 / `d41d8cd98f00b204e9800998ecf8427e` |
| `pisos` | 0 / `d41d8cd98f00b204e9800998ecf8427e` | 0 / `d41d8cd98f00b204e9800998ecf8427e` |
| `precio_historial` | 1016 / `64f5ec3242e70cdfe37e1a242c26b506` | 1016 / `64f5ec3242e70cdfe37e1a242c26b506` |
| `productos` | 1234 / `9b5a7bfb4133c1c700f9d242628c0c46` | 1234 / `9b5a7bfb4133c1c700f9d242628c0c46` |
| `proveedores` | 27 / `4a0020d06fb591411ff067f4140e5994` | 27 / `4a0020d06fb591411ff067f4140e5994` |
| `stock_minimo_sitios` | 1 / `17a13e555dc56c6b9871558bd51ba05c` | 1 / `17a13e555dc56c6b9871558bd51ba05c` |
| `stock_minimos` | 3 / `60b15edc65d0fa3cbaf651c9427fc0ae` | 3 / `60b15edc65d0fa3cbaf651c9427fc0ae` |
| `ubicaciones` | 11 / `024961124e5a29d6f6e1c4053687a948` | 11 / `024961124e5a29d6f6e1c4053687a948` |
| `usuarios` | 31 / `658b6ca14c31aa1a9eaf3fdeede703f1` | 31 / `658b6ca14c31aa1a9eaf3fdeede703f1` |

La igualdad C corresponde a la lectura bloqueada antes de la primera escritura
y a la lectura postcommit directa. No es una afirmación sobre un arranque
posterior de la API.

## B — seis grupos de contadores

Los cuatro contadores por sitio conservaron exactamente sus claves y quedaron
en cero. Se muestran todas las claves de fila para que «cero por sitio» no se
confunda con una sola fila global.

| Tabla B | Antes por clave | Después por clave |
| --- | --- | --- |
| `auditoria_inventario_folio` | `1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0, 458:0, 531:0` | `1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0, 458:0, 531:0` |
| `entrada_folio` | `1:0, 2:5, 3:0, 4:0, 5:1, 6:0, 7:0, 8:0, 9:0, 458:0, 531:0` | `1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0, 458:0, 531:0` |
| `salida_folio` | `1:0, 2:1, 3:0, 4:0, 5:1, 6:0, 7:0, 8:0, 9:0, 458:0, 531:0` | `1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0, 458:0, 531:0` |
| `viaje_folio` | `1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0, 458:0, 531:0` | `1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0, 458:0, 531:0` |
| `ticket_folio` | `1:1005` | `1:999` |
| `series_consecutivo` | `1:1000226` | `1:1000000` |

No se modificaron los defaults reportados `entrada_folio=99` y
`salida_folio=499`. `public.contenedores_folio_seq` quedó conservada sin reset
ni nuevo objetivo; cualquier decisión empresarial futura sobre su uso no
bloquea la purga ya completada.

## `existencias`, caché e invariantes

| Evidencia | Antes | Después | Resultado |
| --- | --- | --- | --- |
| `existencias` | 37 filas; hash `0e7a5bd69febababa25152bb222d57b8` | 37 filas; hash `cf4fec9ce687afbde4c378d846505625` | reconstrucción con `tx`; cantidad de filas preservada |
| Pares de inventario | — | `badPairs=0` | PASS |
| `movimientos` | 307 filas | 0 filas | PASS |
| `rollos` | 226 filas | 0 filas | PASS |

La captura postcommit solo persistió conteos, hashes e invariantes, no filas
crudas ni cantidades sensibles. Por tanto, el resultado «cero» acreditado aquí
es el de `movimientos`, `rollos` y `badPairs`; no se inventa que cada una de
las 37 filas de `existencias` tenga una cantidad individual cero.

## Catálogo, secuencias y triggers

### Catálogo

La puerta bloqueada y la transacción postcommit verificaron la misma identidad y
el mismo catálogo: **60 tablas, 604 columnas/defaults, 286 constraints,
218 índices, 49 funciones, 45 secuencias y 14 triggers no internos**. La
lectura directa posterior volvió a capturar las 60 tablas. No hubo DDL.

### Las 45 secuencias

Los valores `last_value` fueron iguales antes y después. `—` significa `null`,
no un valor inventado.

| Secuencia | Antes | Después |
| --- | ---: | ---: |
| `aplicaciones_credito_id_seq` | 6 | 6 |
| `aplicaciones_pago_proveedor_id_seq` | 18 | 18 |
| `auditoria_id_seq` | 3965 | 3965 |
| `auditorias_inventario_id_seq` | — | — |
| `autorizaciones_nota_id_seq` | 6 | 6 |
| `camionetas_id_seq` | — | — |
| `choferes_id_seq` | — | — |
| `cliente_documentos_id_seq` | 4 | 4 |
| `clientes_id_seq` | 7 | 7 |
| `contenedor_lineas_id_seq` | 2 | 2 |
| `contenedores_folio_seq` | — | — |
| `contenedores_id_seq` | 2 | 2 |
| `cuadre_fiscal_registros_id_seq` | — | — |
| `entradas_id_seq` | 432 | 432 |
| `equipos_id_seq` | — | — |
| `movimientos_credito_id_seq` | 50 | 50 |
| `movimientos_id_seq` | 6522 | 6522 |
| `notificaciones_credito_id_seq` | 8 | 8 |
| `notificaciones_sistema_id_seq` | 28 | 28 |
| `pagos_proveedor_id_seq` | 450 | 450 |
| `permisos_rol_id_seq` | 29041 | 29041 |
| `permisos_ubicacion_id_seq` | 6750 | 6750 |
| `permisos_usuario_id_seq` | 125 | 125 |
| `pisos_id_seq` | — | — |
| `precio_historial_id_seq` | 1016 | 1016 |
| `productos_id_seq` | 2077 | 2077 |
| `proveedores_id_seq` | 225 | 225 |
| `reimpresiones_etiqueta_id_seq` | 170 | 170 |
| `revisiones_etiqueta_id_seq` | 31 | 31 |
| `rollos_id_seq` | 5463 | 5463 |
| `salida_lineas_id_seq` | 26 | 26 |
| `salida_rollos_id_seq` | 113 | 113 |
| `salidas_dinero_caja_id_seq` | — | — |
| `salidas_id_seq` | 24 | 24 |
| `sesiones_caja_id_seq` | 42 | 42 |
| `solicitudes_pago_dirigido_id_seq` | 1 | 1 |
| `stock_minimo_episodios_id_seq` | 7 | 7 |
| `stock_minimos_id_seq` | 3 | 3 |
| `ticket_linea_consumos_id_seq` | 20 | 20 |
| `ticket_lineas_id_seq` | 353 | 353 |
| `ticket_pagos_id_seq` | 89 | 89 |
| `tickets_id_seq` | 105 | 105 |
| `ubicaciones_id_seq` | 834 | 834 |
| `usuarios_id_seq` | 233 | 233 |
| `viajes_id_seq` | — | — |

No hubo `RESTART IDENTITY`, `setval`, `ALTER SEQUENCE` ni llamadas que
consumieran `nextval`.

### Los 14 triggers: definición y estado final

Los 14 nombres, tablas, definiciones y estados finales coinciden exactamente
con la captura bloqueada. `O` es enabled y `A` es enabled `ALWAYS`; ambos son
estados habilitados. El trigger `A` se mantuvo sin modificar.

| Tabla | Trigger | Estado | Definición |
| --- | --- | --- | --- |
| `aplicaciones_credito` | `aplicaciones_credito_inmutables` | O | `CREATE TRIGGER aplicaciones_credito_inmutables BEFORE DELETE OR UPDATE ON aplicaciones_credito FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation()` |
| `aplicaciones_credito` | `aplicaciones_credito_validas` | O | `CREATE TRIGGER aplicaciones_credito_validas BEFORE INSERT ON aplicaciones_credito FOR EACH ROW EXECUTE FUNCTION validate_credit_application()` |
| `aplicaciones_pago_proveedor` | `aplicaciones_pago_proveedor_append_only` | O | `CREATE TRIGGER aplicaciones_pago_proveedor_append_only BEFORE DELETE OR UPDATE ON aplicaciones_pago_proveedor FOR EACH ROW EXECUTE FUNCTION proteger_aplicaciones_pago_proveedor()` |
| `aplicaciones_pago_proveedor` | `aplicaciones_pago_proveedor_validar_insert` | O | `CREATE TRIGGER aplicaciones_pago_proveedor_validar_insert BEFORE INSERT ON aplicaciones_pago_proveedor FOR EACH ROW EXECUTE FUNCTION validar_aplicacion_pago_proveedor()` |
| `auditoria` | `auditoria_append_only` | O | `CREATE TRIGGER auditoria_append_only BEFORE DELETE OR UPDATE ON auditoria FOR EACH ROW EXECUTE FUNCTION proteger_auditoria_append_only()` |
| `auditoria` | `auditoria_enriquecer_insert` | O | `CREATE TRIGGER auditoria_enriquecer_insert BEFORE INSERT ON auditoria FOR EACH ROW EXECUTE FUNCTION enriquecer_auditoria()` |
| `movimientos_credito` | `movimientos_credito_inmutables` | O | `CREATE TRIGGER movimientos_credito_inmutables BEFORE DELETE OR UPDATE ON movimientos_credito FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation()` |
| `movimientos_credito` | `movimientos_credito_reversos_validos` | O | `CREATE TRIGGER movimientos_credito_reversos_validos BEFORE INSERT ON movimientos_credito FOR EACH ROW EXECUTE FUNCTION validate_credit_reversal()` |
| `pagos_proveedor` | `pagos_proveedor_inmutables` | O | `CREATE TRIGGER pagos_proveedor_inmutables BEFORE DELETE OR UPDATE ON pagos_proveedor FOR EACH ROW EXECUTE FUNCTION prevent_pago_proveedor_mutation()` |
| `reimpresiones_etiqueta` | `reimpresiones_etiqueta_inmutable` | O | `CREATE TRIGGER reimpresiones_etiqueta_inmutable BEFORE DELETE OR UPDATE ON reimpresiones_etiqueta FOR EACH ROW EXECUTE FUNCTION bloquear_mutacion_reimpresion_etiqueta()` |
| `revisiones_etiqueta` | `revisiones_etiqueta_inmutable` | O | `CREATE TRIGGER revisiones_etiqueta_inmutable BEFORE DELETE OR UPDATE ON revisiones_etiqueta FOR EACH ROW EXECUTE FUNCTION bloquear_mutacion_revision_etiqueta()` |
| `revisiones_etiqueta` | `revisiones_etiqueta_reimpresion_fk_check` | O | `CREATE TRIGGER revisiones_etiqueta_reimpresion_fk_check BEFORE INSERT OR UPDATE ON revisiones_etiqueta FOR EACH ROW EXECUTE FUNCTION validar_revision_etiqueta_reimpresion()` |
| `ticket_linea_consumos` | `ticket_linea_consumos_append_only` | A | `CREATE TRIGGER ticket_linea_consumos_append_only BEFORE INSERT OR DELETE OR UPDATE ON ticket_linea_consumos FOR EACH ROW EXECUTE FUNCTION ticket_linea_consumos_guard()` |
| `ticket_pagos` | `ticket_pagos_inmutables` | O | `CREATE TRIGGER ticket_pagos_inmutables BEFORE DELETE OR UPDATE ON ticket_pagos FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation()` |

La primera tentativa de `--apply` quedó bloqueada y revertida por una puerta
que exigía erróneamente que todos los triggers fueran `O`:
`reports/prompt-h/authorized-purge-blocked-trigger-always.log`. El estado
`A` de `ticket_linea_consumos_append_only` ya existía y permaneció sin cambio.
La puerta final fue corregida de forma conservadora: acepta `O` o `A` como
enabled, pero exige las 14 definiciones y estados exactos. La aplicación final
pasó esa puerta y verificó igualdad postcommit.

Esto no contradice el hallazgo de seguridad: los guards append-only de
`auditoria` y `movimientos_credito` interceptan `DELETE`/`UPDATE` por fila, pero
no impiden un `TRUNCATE` ejecutado por un rol privilegiado. No se hizo una
prueba destructiva adicional.

## Puertas previas, errores y rollback

Antes de aplicar se ejecutaron las cinco pruebas puras de
`scripts/src/prompt-h-authorized-purge.test.mts`: **5/5 PASS**. Después, el
dry-run de solo lectura terminó **PASS**, sin escrituras:
`reports/prompt-h/authorized-purge-dry-run-rerun-20260916-6.log`.
La aplicación final terminó `PASS apply commit`:
`reports/prompt-h/authorized-purge-execution.log`.

Los bloqueos previos quedaron conservados y no representan reintentos
destructivos:

1. **Formato documental/CLI:** el documento de Bloque 2 no satisfizo la
   comprobación textual esperada de «no se reinició la API» y la ejecución se
   detuvo antes de escribir: `authorized-purge-blocked-document-format.log`.
2. **Transcripción SHA:** se detectó un SHA esperado mal transcrito; el valor
   real verificado era
   `da7d3f7f342756511c6a04d000f0f4f4fa3feea6b9caad21e6abec5213dffb22`.
   Evidencia: `authorized-purge-blocked-sha-transcription.log`.
3. **Forma/shape de esquema:** la primera comparación detectó una forma de
   secuencias que no coincidía; `authorized-purge-dry-run-rerun-20260916-5.log`.
   Se corrigió la comprobación de forma, no la base.
4. **Trigger `ALWAYS`:** la puerta inicial exigía todo `O`, se detuvo y revirtió
   la transacción de esa tentativa. El trigger `A` no se alteró; la guard final
   aceptó `O/A` y exigió igualdad exacta, como se documenta arriba.

Otros errores de CLI de las iteraciones de solo lectura (`PASS` indefinido,
`sql.raw` no disponible y puerto esperado distinto) también quedaron en los
logs `authorized-purge-dry-run*.log`; todos ocurrieron antes del apply
comprometido. No se hizo un segundo intento destructivo tras un commit
incierto.

## Alcance posterior

El estado durable de la operación es un **commit confirmado con lectura
postcommit PASS**. En esa frontera, A=35 quedó en cero y C=18 conservó
conteo/hash exactos. Esto describe la frontera del commit; **no** debe
interpretarse como afirmación de que el estado actual posterior al arranque
mantenga C=18 exactas o A=35 en cero.

`public.contenedores_folio_seq` quedó conservada sin reset ni nuevo objetivo.
La decisión empresarial sobre su uso futuro permanece abierta, pero no bloquea
ni invalida la purga ya completada. Se conservan sin modificación los
respaldos, restauraciones, Drive, preflight y el historial.

## Comparación post-arranque separada

La comparación de solo lectura posterior está en
`reports/prompt-h/post-arranque-comparacion.md` y
`reports/prompt-h/post-arranque-comparacion.json`. Después del commit, MAIN
reinició una vez la API y también el frontend; ambos tienen arranque limpio en
`reports/prompt-h/post-arranque-api-startup-20260916-041700.log` y
`reports/prompt-h/post-arranque-frontend-startup-20260916-041700.log`. MAIN
volvió a pausar la API después de observar el drift; el workflow actual quedó
`finished` y el frontend quedó ejecutándose. La comparación no ejecutó
escrituras, reparaciones ni resets. Los logs prueban `Schema startup complete`,
`Server listening` y `VITE ... ready`; el servicio limpio está PROVEN.

El resultado posterior debe mantenerse separado de la frontera de commit:

- **C:** las 18 fueron exactas en el commit. Después del arranque, las otras
  16 siguen exactas; `permisos_rol` conserva 192 filas y cambió solamente
  `updated_at` en 72, y `permisos_ubicacion` conserva 54 filas y cambió
  solamente `updated_at` en 54. `columnDeltaComparison` contra la base
  restaurada pristine prueba que no cambió ninguna columna de negocio. Por
  tanto, no se afirma C=18 exactas como estado actual.
- **A:** después del arranque normal/poller,
  `notificaciones_sistema=12` y `stock_minimo_episodios=3`; las otras 33
  tablas A siguen en cero. Por tanto, no se afirma A=35 completamente en cero
  como estado actual.
- **B y caché:** los seis objetivos B siguen correctos; `existencias` conserva
  37 filas, `badPairs=0`, `movimientos=0` y `rollos=0`.
- **Secuencias:** avanzaron normalmente solo
  `notificaciones_sistema_id_seq` (28→40), `permisos_rol_id_seq`
  (29041→29128), `permisos_ubicacion_id_seq` (6750→6804) y
  `stock_minimo_episodios_id_seq` (7→10). El reporte contiene la lista exacta;
  no hubo reinicio ni reparación de secuencias.
- **Triggers y esquema:** los 14 triggers, sus estados/definiciones y el
  catálogo permanecen exactos.

La comprobación UI vigente queda **`currentUIStatus: APPROVED_BY_OWNER`**. Hoy,
**2026-09-15, America/Mexico_City**, el propietario confirmó directamente en
su propia sesión autenticada que verificó visualmente el catálogo de productos
con sus colores, los precios de lista y el historial de precios, completo. La
fecha es la fecha de hoy obtenida del reloj del sistema; no se inventa una hora
ni un instante histórico. Esta constancia es **OWNER direct verification**, no
una prueba ni una afirmación del agente.

La observación anterior del agente sobre login `401`, conservada en
`reports/prompt-h/post-arranque-login-401.jpg` y sus logs asociados, queda
como **observación histórica previa**, no como bloqueo actual. La comparación
post-arranque y sus diferencias de hashes se conservan sin reescritura y
siguen separadas de este cierre. El detalle de la confirmación del propietario
está en `reports/prompt-h/cierre-propietario.md`.

El typecheck final actual pasó con 0 errores y `EXIT_CODE=0` en
`reports/prompt-h/typecheck-final.txt`. No se hicieron nuevas consultas,
reparaciones o escrituras ni se reinició de nuevo la API durante esta
finalización.