# Prompt H — Bloque 1: listas vivas y propuesta ABC

- **Estado:** COMPLETE_READ_ONLY_REFINED_NO_DB_CAPTURE (captura de configuración histórica; no es un bloqueo vigente de identidad).
- **Identidad directa de inventario:** heliumdb/public; transacción repeatable read READ ONLY.
- **Escrituras:** ninguna; no se hizo respaldo todavía, no se ejecutó purga, no se cambió trigger/secuencia/default, y no se hizo prueba de escritura.
- **Regla de aprobación:** la aprobación del propietario de estas listas es necesaria antes del preflight y de la purga; no equivale por sí sola a autorización textual de purga. El respaldo completo verificado fue solicitado como trabajo separado y aún no se hizo.

## Identidad de la API

- Proceso detectado: PID 254, `/nix/store/9cyx2v23dip6p9q98384k9v06c96qskb-nodejs-24.13.0/bin/node --enable-source-maps ./dist/index.mjs`, cwd `/home/runner/workspace/artifacts/api-server`.
- Comparación no secreta de destino DATABASE_URL contra la fuente del inventario: true.
- Presencia de overrides de prueba coincide con la fuente del inventario: true; overrides presentes: ninguno.
- No se expusieron valores de entorno, credenciales ni URLs; solo presencia, coincidencia booleana y destino no secreto.
- La identidad efectiva queda **CONFIRMADA** desde el pool en proceso de la API: `heliumdb/public`; evidencia de solo lectura: `reports/prompt-h/api-pool-identity-2026-09-15.md`.
- La confirmación no abrió endpoint público, no reinició la API, no cambió autenticación ni entorno y dejó cerrado el inspector de loopback.
- Inspección de arranque: source importa @workspace/db=true; dotenv/loadEnv en source=false; asignación DATABASE_URL en source=false; dotenv/loadEnv en dist=false.

## Totales y diferencias

- Tablas vivas ordinarias/particionadas: **60**; Drizzle runtime: **59**. Diferencia viva/no declarada: `cuadre_fiscal_registros`.
- ABC: A=35, B=7, C=18; suma=60 y coincide=true.
- Deriva de esquema: `cuadre_fiscal_registros` está viva y ausente de Drizzle; se reporta solamente, sin crearla ni borrarla del esquema.
- Las secuencias se listan aparte y no suman al total de tablas; hay 45. Triggers no internos vivos: **14** (el conteo 11 es histórico).
- Mismatches: columnas/tablas=1; conteos FK=4.

## Lista A (35)

| Tabla | Filas | Razón |
|---|---:|---|
| `aplicaciones_credito` | 2 | A — Aplicación de crédito transaccional que representa una operación ocurrida. |
| `aplicaciones_pago_proveedor` | 4 | A — Aplicación de pago a proveedor transaccional que representa una operación ocurrida. |
| `auditoria_inventario_escaneos` | 0 | A — Escaneos de una auditoría de inventario ocurrida; el prompt reinicia las auditorías de inventario. |
| `auditoria_inventario_participantes` | 0 | A — Participantes de una auditoría de inventario ocurrida; el prompt reinicia las auditorías de inventario. |
| `auditoria_inventario_snapshot` | 0 | A — Snapshot de una auditoría de inventario ocurrida; el prompt reinicia las auditorías de inventario. |
| `auditorias_inventario` | 0 | A — Cabecera de auditoría de inventario ocurrida que el prompt reinicia. |
| `autorizaciones_nota` | 2 | A — Autorización de nota ligada a una operación de crédito ocurrida. |
| `contenedor_lineas` | 0 | A — Líneas de un contenedor de una operación de recepción ocurrida. |
| `contenedores` | 0 | A — Recepción/contenedor de mercancía de una operación ocurrida. |
| `cuadre_fiscal_registros` | 0 | A — Registros de cuadre fiscal de operaciones ocurridas; no son catálogo/configuración y no tienen base para conservarse como C. |
| `entradas` | 6 | A — Entrada de inventario de una operación ocurrida. |
| `movimientos` | 307 | A — Movimiento de inventario ocurrido que se purgaría junto con sus rollos. |
| `movimientos_credito` | 8 | A — Movimiento de crédito transaccional ocurrido. |
| `notificaciones_credito` | 2 | A — Notificación derivada de una operación de crédito ocurrida. |
| `notificaciones_sistema` | 16 | A — Notificación operativa derivada de una operación ocurrida. |
| `pagos_proveedor` | 9 | A — Pago a proveedor de una operación financiera ocurrida. |
| `reimpresiones_etiqueta` | 146 | A — Historial operativo de reimpresiones de etiquetas ocurridas. |
| `revisiones_etiqueta` | 31 | A — Control operativo de revisión de rollos; no es catálogo/configuración y se incluye explícitamente en A. |
| `rollos` | 226 | A — Rollo físico recibido/movido en una operación ocurrida. |
| `salida_lineas` | 2 | A — Líneas de una salida operativa ocurrida. |
| `salida_rollos` | 12 | A — Asociación de rollos con una salida operativa ocurrida. |
| `salidas` | 2 | A — Salida de inventario/venta de una operación ocurrida. |
| `salidas_dinero_caja` | 0 | A — Salida de dinero de caja de una operación financiera ocurrida. |
| `sesiones` | 11 | A — Sesión de aplicación operativa, no identidad/configuración persistente. |
| `sesiones_caja` | 2 | A — Sesión operativa de caja ocurrida. |
| `sesiones_caja_dias` | 2 | A — Detalle operativo de una sesión de caja ocurrida. |
| `solicitudes_pago_dirigido` | 0 | A — Solicitud operativa de pago dirigido ocurrida. |
| `stock_minimo_episodios` | 4 | A — Episodio/notificación de mínimo de stock ocurrido, distinto de la configuración conservada. |
| `ticket_linea_consumos` | 20 | A — Ledger operativo de consumos físicos de líneas de ticket; se incluye explícitamente en A. |
| `ticket_lineas` | 57 | A — Líneas de un ticket de una venta ocurrida. |
| `ticket_pagos` | 4 | A — Pago asociado a un ticket de una operación ocurrida. |
| `tickets` | 6 | A — Ticket de venta de una operación ocurrida. |
| `viaje_salidas` | 0 | A — Asociación operativa de una salida con un viaje ocurrido. |
| `viaje_tickets` | 0 | A — Asociación operativa de un ticket con un viaje ocurrido. |
| `viajes` | 0 | A — Viaje/logística de una operación ocurrida. |

## Lista B (7)

| Tabla | Filas | Razón |
|---|---:|---|
| `auditoria_inventario_folio` | 11 | B — Contador operativo de folios de auditorías de inventario que se reiniciaría a su objetivo aprobado. |
| `entrada_folio` | 11 | B — Contador operativo de folios de entradas por ubicación que se reiniciaría a su objetivo aprobado. |
| `existencias` | 37 | B — Caché derivada de existencias que debe reconstruirse, no vaciarse manualmente. |
| `salida_folio` | 11 | B — Contador operativo de folios de salidas por ubicación que se reiniciaría a su objetivo aprobado. |
| `series_consecutivo` | 1 | B — Consecutivo operativo de series que se reiniciaría a su objetivo aprobado. |
| `ticket_folio` | 1 | B — Contador operativo de folios de tickets que se reiniciaría a su objetivo aprobado. |
| `viaje_folio` | 11 | B — Contador operativo de folios de viajes por ubicación que se reiniciaría a su objetivo aprobado. |

## Lista C (18)

| Tabla | Filas | Razón |
|---|---:|---|
| `auditoria` | 3285 | C — Bitácora de auditoría expresamente conservada y tratada como historial append-only. |
| `camionetas` | 0 | C — Catálogo/configuración de camionetas expresamente conservado. |
| `choferes` | 0 | C — Catálogo/configuración de choferes expresamente conservado. |
| `cliente_documentos` | 0 | C — Documentos de identificación/configuración de clientes, dependientes de un catálogo conservado. |
| `clientes` | 7 | C — Catálogo/configuración de clientes expresamente conservado. |
| `equipos` | 0 | C — Catálogo/configuración de equipos expresamente conservado. |
| `equipos_checklist` | 0 | C — Checklist/configuración asociada a equipos expresamente conservada. |
| `permisos_rol` | 192 | C — Configuración de permisos por rol expresamente conservada. |
| `permisos_ubicacion` | 54 | C — Configuración de permisos por ubicación expresamente conservada. |
| `permisos_usuario` | 0 | C — Configuración de permisos por usuario expresamente conservada. |
| `pisos` | 0 | C — Catálogo/configuración de pisos expresamente conservado. |
| `precio_historial` | 1016 | C — Historial de precios solicitado expresamente como conservación inmutable del catálogo. |
| `productos` | 1234 | C — Catálogo operativo de productos que conserva explícitamente sus colores y atributos. |
| `proveedores` | 27 | C — Catálogo/configuración de proveedores expresamente conservado. |
| `stock_minimo_sitios` | 1 | C — Configuración de mínimos de stock por sitio expresamente conservada. |
| `stock_minimos` | 3 | C — Configuración de mínimos de stock expresamente conservada. |
| `ubicaciones` | 11 | C — Catálogo de ubicaciones expresamente conservado. |
| `usuarios` | 31 | C — Identidades de usuarios expresamente conservadas; no se crean ni modifican identidades en este bloque. |

## Hallazgos explícitos

- `revisiones_etiqueta` está viva y queda en A; `ticket_linea_consumos` está viva y queda en A.
- `productos` queda en C y conserva el catálogo, incluidos sus colores; `precio_historial` queda en C.
- Defaults B (solo reporte, sin corrección): [{"table":"auditoria_inventario_folio","column":"ultimo_folio","liveDefaultExpression":"0","notNull":true,"reportOnlyNoCorrection":true},{"table":"entrada_folio","column":"ultimo_folio","liveDefaultExpression":"99","notNull":true,"reportOnlyNoCorrection":true},{"table":"salida_folio","column":"ultimo_folio","liveDefaultExpression":"499","notNull":true,"reportOnlyNoCorrection":true},{"table":"series_consecutivo","column":"ultimo_numero","liveDefaultExpression":"1000000","notNull":true,"reportOnlyNoCorrection":true},{"table":"ticket_folio","column":"ultimo_folio","liveDefaultExpression":"999","notNull":true,"reportOnlyNoCorrection":true},{"table":"viaje_folio","column":"ultimo_folio","liveDefaultExpression":"0","notNull":true,"reportOnlyNoCorrection":true}].
- DELETE bloqueado por triggers append-only/inmutables activos: 8; triggers activos de TRUNCATE sobre A: 0.
- Hallazgo de seguridad (remediación separada; triggers intactos): los guards append-only bloquean DELETE por filas, pero no impiden TRUNCATE a roles privilegiados. Es un hallazgo de seguridad de privilegios de base de datos, no una afirmación de explotación HTTP.
- FK entrantes desde B/C hacia A: 0; FK entrantes específicamente desde C: 0.
- Cierre de FK entrante para A: solo A (sin tablas fuera de A).

## Estrategia propuesta, sin ejecutar

- Permitida por metadata para revisión: true. Solo **TRUNCATE A CONTINUE IDENTITY RESTRICT**; B nunca es objetivo de TRUNCATE.
- B contadores (propuesta report-only): `entrada_folio`, `salida_folio`, `viaje_folio` y `auditoria_inventario_folio` → 0; `ticket_folio` → 999; `series_consecutivo` → 1000000. `existencias` no se trunca.
- Luego, dentro de la misma transacción propietaria: `await reconstruirCacheExistencias(tx)`. La función acepta la transacción, bloquea pares, lee `existencias`/`movimientos`/`rollos`, actualiza por `ON CONFLICT`, y no escribe configuración C.
- Inspección estática de caché: artifacts/api-server/src/lib/inventario.ts:2832-2871; acepta tx=true, usa tx recibida=true, contiene DELETE/TRUNCATE=false.
- Secuencias de folio detectadas: `contenedores_folio_seq`; no se reinicia ninguna secuencia. Pregunta pendiente: **¿debe `public.contenedores_folio_seq` reiniciarse como folio de negocio de `contenedores`, o conservarse sin reset para evitar reutilizar folios históricos?**
- Hash exacto de C/auditoria: pendiente del preflight aprobado; este bloque solo tiene metadata/conteos y no expone filas.
- Toda mutación futura queda **PENDIENTE de nueva autorización textual del propietario después de respaldo verificado y preflight**; esta aprobación de listas no autoriza ejecutar.

## Evidencia y puerta de aprobación

- Evidencia SQL exacta y outputs completos: `reports/prompt-h/block1-live-inventory.json` y su Markdown técnico. Esta lista compacta es el documento user-facing separado.
**PENDIENTE DE APROBACIÓN EXPLÍCITA DEL PROPIETARIO.** No iniciar preflight/purga ni ningún Bloque 2+ desde este reporte.
