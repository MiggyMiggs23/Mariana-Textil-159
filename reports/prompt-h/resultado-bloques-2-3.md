# Prompt H — Bloques 2–4 renovados; purga autorizada verificada

Fecha de la captura vigente: **15 de septiembre de 2026, America/Mexico_City**.

## Resultado vigente

| Comprobación | Resultado |
| --- | --- |
| API/workflow durante respaldo, Drive y preflight | Workflow `finished`; API pausada durante esas fases; **sin reinicio en ellas** |
| Respaldo completo y restauración desechable | **PASS** |
| Drive privado, descarga y SHA-256 | **PASS**; hash fuente/descarga coincidente |
| Preflight de solo lectura | **COMPLETE_READ_ONLY**; `MATCHES_VERIFIED_BACKUP_AT_CAPTURE` |
| Preflight: tablas, conteos y huellas | **60/60 coincidentes**, incluidos `auditoria`, `sesiones` y `ubicaciones` |
| Metadatos de esquema/base/ownership/ACL | **PASS**: 604 columnas/defaults, 286 constraints, 218 índices y 49 funciones |
| Preflight: secuencias | **45/45 coincidentes** |
| Preflight: triggers no internos habilitados | **14/14 coincidentes y enabled** |
| Purga | **COMMITTED_POSTCOMMIT_READ_PASS**; evidencia completa en `reports/prompt-h/block4-purga-verificacion.md` |
| Post-arranque | MAIN reinició API y frontend una vez; API pausada de nuevo después del drift; frontend ejecutándose |
| UI/catálogo | **APPROVED_BY_OWNER**; verificación visual directa del propietario en su propia sesión autenticada: productos con colores, precios de lista e historial de precios completos |
| Typecheck final actual | **PASS**, 0 errores, `EXIT_CODE=0`; `reports/prompt-h/typecheck-final.txt` |

Durante el respaldo y el preflight la API permaneció pausada. Después del
commit, MAIN reinició una vez la API y también el frontend para el arranque
limpio; la API volvió a quedar pausada después de la comparación post-arranque
y el frontend permanece ejecutándose. No se instalaron paquetes ni hubo cambios
de código; las cinco pruebas puras del plan y el dry-run de solo lectura pasaron
antes del apply. La única escritura de la transacción de purga fue la operación
estrecha autorizada y comprometida:
`TRUNCATE` de A, los seis objetivos B y la reconstrucción de `existencias`
dentro de una sola transacción. No se ejecutaron `DELETE`, `INSERT`, `setval`,
`ALTER SEQUENCE`, `RESTART IDENTITY`, seed, DDL ni reset de IDs en esa
transacción. El workflow actual está `finished`; los cambios normales
observados tras el arranque (poller y timestamps) se documentan por separado
en `reports/prompt-h/post-arranque-comparacion.md`, no se mezclan con la
frontera del commit.

## Respaldo vigente

- Base fuente: `heliumdb`, PostgreSQL `16.10`.
- Captura del respaldo: **`2026-09-15 21:42:48 America/Mexico_City`**
  (**`2026-09-16T03:42:48.408Z` UTC**).
- Dump custom privado:
  `.local/backups/prompt-h-block2-20260915214248-7517/prompt-h-block2-20260915214248-7517.dump`.
- Tamaño: **440802 bytes**.
- SHA-256: `da7d3f7f342756511c6a04d000f0f4f4fa3feea6b9caad21e6abec5213dffb22`.
- Restauración: `pg_restore` exit code `0`; cluster desechable persistente en
  `.local/backups/prompt-h-block2-20260915214248-7517/restore-cluster`, con
  socket Unix-only verificado.
- Evidencia: `reports/prompt-h/block2-restore.md` y
  `reports/prompt-h/block2-restore-metadata.json`.

La verificación de Drive está en `reports/prompt-h/block2-drive-verification.json`:
archivo privado y owner-only, [enlace de Drive](https://drive.google.com/file/d/10PvcuYFcbmmCuGbLRkIEULiz0zlb05FC/view?usp=drivesdk),
ID `10PvcuYFcbmmCuGbLRkIEULiz0zlb05FC`, descarga de `440802` bytes y
`sourceSha256 = downloadedSha256 =
da7d3f7f342756511c6a04d000f0f4f4fa3feea6b9caad21e6abec5213dffb22`. La evidencia
registra `apiPaused: true`, permisos privados owner-only y verificación a las
`2026-09-15 21:45:26 America/Mexico_City`.

## Preflight vigente

- Captura del preflight: **`2026-09-15 21:48:10,327 America/Mexico_City`**
  (**`2026-09-16T03:48:10.327Z` UTC**).
- Snapshot comparado: respaldo de `2026-09-15 21:42:48`
  (`2026-09-16T03:42:48.408Z` UTC).
- Resultado: **`MATCHES_VERIFIED_BACKUP_AT_CAPTURE`**.
- Evidencia completa por tabla, objeto y estado: `reports/prompt-h/block3-preflight.md`;
  metadatos estructurados: `reports/prompt-h/block3-preflight-metadata.json`.

El conjunto se descubrió dinámicamente como **60 tablas, A=35, B=7, C=18**.
Las 60/60 tablas coincidieron en conteo y hash canónico, incluyendo:
`auditoria` (3286, `ebfb27fc49b43dbf3eb4082729d84b0d`), `sesiones` (11,
`ea64f311a46b7247f621b2f5c9bddd1c`) y `ubicaciones` (11,
`024961124e5a29d6f6e1c4053687a948`). Los metadatos no volátiles también
coincidieron; las 45 secuencias coincidieron y los 14 triggers no internos
quedaron enabled.

La captura pre-startup conserva C y sus conteos/huellas dentro de una
transacción `REPEATABLE READ READ ONLY`. El preflight documenta **8 movimientos
de crédito, 6 tickets (2 notas), 226 rollos, 6 entradas y 2 salidas**. La
verificación exacta en la frontera de commit está en
`reports/prompt-h/block4-purga-verificacion.md`. La comparación posterior al
arranque es evidencia separada en
`reports/prompt-h/post-arranque-comparacion.md` y no debe reinterpretarse como
C=18 exactas o A=35 en cero actualmente.

### Preservación C — los 18 hashes canónicos exactos

| Tabla C | Conteo | Hash exacto `to_jsonb(row)::text` ordenado |
| --- | ---: | --- |
| `auditoria` | 3286 | `ebfb27fc49b43dbf3eb4082729d84b0d` |
| `camionetas` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `choferes` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `cliente_documentos` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `clientes` | 7 | `57547451eec364bf428e41924ded0b49` |
| `equipos` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `equipos_checklist` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `permisos_rol` | 192 | `4d18bc7f2e1076313bc0ed9cddfffe88` |
| `permisos_ubicacion` | 54 | `bc5e55897a9b7e834766d59550c35db1` |
| `permisos_usuario` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `pisos` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `precio_historial` | 1016 | `64f5ec3242e70cdfe37e1a242c26b506` |
| `productos` | 1234 | `9b5a7bfb4133c1c700f9d242628c0c46` |
| `proveedores` | 27 | `4a0020d06fb591411ff067f4140e5994` |
| `stock_minimo_sitios` | 1 | `17a13e555dc56c6b9871558bd51ba05c` |
| `stock_minimos` | 3 | `60b15edc65d0fa3cbaf651c9427fc0ae` |
| `ubicaciones` | 11 | `024961124e5a29d6f6e1c4053687a948` |
| `usuarios` | 31 | `658b6ca14c31aa1a9eaf3fdeede703f1` |

### Folios, objetivos aplicados y rango de series

Los valores B siguientes son la captura exacta por clave de fila; la columna
final es el resultado postcommit de los objetivos autorizados:

| Tabla B | Valores antes por clave | Valores después por clave |
| --- | --- | --- |
| `auditoria_inventario_folio` | `1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0, 458:0, 531:0` | `1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0, 458:0, 531:0` |
| `entrada_folio` | `1:0, 2:5, 3:0, 4:0, 5:1, 6:0, 7:0, 8:0, 9:0, 458:0, 531:0` | `1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0, 458:0, 531:0` |
| `salida_folio` | `1:0, 2:1, 3:0, 4:0, 5:1, 6:0, 7:0, 8:0, 9:0, 458:0, 531:0` | `1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0, 458:0, 531:0` |
| `viaje_folio` | `1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0, 458:0, 531:0` | `1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0, 458:0, 531:0` |
| `ticket_folio` | `1:1005` | `1:999` |
| `series_consecutivo` | `1:1000226` | `1:1000000` |

El rango exacto de `rollos.serie` capturado antes de la purga fue
**`1000001–1000226`**, en **226** rollos. `existencias` conservó sus 37 filas y
fue reconstruida dentro de la misma transacción; el hash postcommit es
`cf4fec9ce687afbde4c378d846505625`. Los defaults report-only
`entrada_folio=99` y `salida_folio=499` permanecen sin corregir.

No se ejecutó ningún reset de identidad ni de secuencias en la purga: no hubo
`RESTART IDENTITY`, `setval` ni `ALTER SEQUENCE`. `public.contenedores_folio_seq`
quedó conservada sin reset ni nuevo objetivo. Su decisión empresarial futura
permanece abierta, pero no bloquea la purga ya completada ni requiere una
operación adicional en este procedimiento.

## Historia, límites y seguridad

La comparación histórica de Lista A permanece en
`reports/prompt-h/comparacion-lista-a-anterior.md`; no sustituye el preflight
vigente ni la lectura postcommit. El primer intento NO-GO por freshness se
conserva únicamente como puntero en
`reports/prompt-h/previous-live-api/resultado-bloques-2-3.md`. Los outputs
completos del snapshot anterior quedaron copiados en
`reports/prompt-h/history-paused-213056/`; se conservan también todos los
directorios, clusters y archivos de respaldo de base de datos.

## Estado UI vigente — verificación directa del propietario

**`currentUIStatus: APPROVED_BY_OWNER`**. Hoy, **2026-09-15,
America/Mexico_City**, el propietario confirmó directamente en su propia sesión
autenticada que la verificación visual del catálogo está completa: productos
con sus colores, precios de lista e historial de precios. La fecha es la fecha
de hoy obtenida del reloj del sistema; no se inventa una hora ni un instante
histórico. Esta constancia es **OWNER direct verification**, no una prueba ni
una afirmación del agente.

La observación anterior del agente sobre login `401`, conservada en
`reports/prompt-h/post-arranque-login-401.jpg` y su evidencia asociada, queda
como **observación histórica previa**, no como bloqueo actual. La comparación
post-arranque y sus diferencias de hashes permanecen sin reescritura y
separadas de este cierre. El detalle de la confirmación del propietario está en
`reports/prompt-h/cierre-propietario.md`.

- Los guards append-only de `auditoria` y `movimientos_credito` impiden
  `DELETE` por filas, pero un rol privilegiado podría eludirlos mediante
  `TRUNCATE`; se comprobó por inspección, sin prueba destructiva y sin afirmar
  explotación HTTP.
- `cuadre_fiscal_registros` continúa como deriva viva ausente de Drizzle; no se
  creó, borró ni modificó.
- En la lectura post-arranque los seis objetivos B siguieron correctos y el
  caché conservó 37 filas con `badPairs=0`, `movimientos=0` y `rollos=0`.
  Permanecieron exactos los 14 triggers; avanzaron normalmente solo las cuatro
  secuencias enumeradas en `reports/prompt-h/post-arranque-comparacion.md`, sin
  reset ni reparación.
- El typecheck final actual terminó **PASS**, con 0 errores y `EXIT_CODE=0`, en
  `reports/prompt-h/typecheck-final.txt`.
- La comprobación postcommit es una lectura directa de base y no una validación
  autenticada de API. La comparación posterior al arranque está separada en
  `reports/prompt-h/post-arranque-comparacion.md`: prueba que las 18 C fueron
  exactas al commit, pero después del arranque solo 16 continúan exactas; dos
  tablas cambiaron exclusivamente en `updated_at` según la prueba contra
  restore pristine. Tras el poller, 33 de las 35 A siguen en cero y dos tienen
  los conteos normales documentados (`notificaciones_sistema=12`,
  `stock_minimo_episodios=3`); no se afirma A=35 en cero como estado actual.
- La observación UI histórica del agente queda documentada como login `401` sin
  sesión autenticada creada en `reports/prompt-h/post-arranque-login-401.jpg`;
  no es un bloqueo actual frente a la verificación directa del propietario.
  La evidencia conjunta acredita respaldo, restauración desechable, Drive,
  preflight, el commit autorizado y el arranque posterior limpio con sus
  límites; no se hicieron reparaciones ni resets.