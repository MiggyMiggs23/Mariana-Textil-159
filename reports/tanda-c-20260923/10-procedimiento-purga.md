# Tarea 10 — Procedimiento documental de purga, sin ejecución

## Dictamen y límites

**Estado: procedimiento de referencia preparado; NO-GO para ejecutar.** Se documenta el método efectivamente utilizado el **13 de septiembre de 2026**, no se prepara un ejecutable ni se autoriza una nueva purga. Solo se leyeron archivos locales. No hubo conexión de base de datos, SQL, red, ejecución de scripts, reinicios, cambios de código, modificación de `replit.md` ni commits.

El método recuperable es **respaldo privado íntegro → restauración comprobada → ensayo autorizado → preflight fresco → transacción única → lectura independiente postcommit → arranque autorizado y comparación separada**. No significa copiar el programa antiguo y cambiarle la fecha.

**No ejecutar `scripts/src/purge-operational-phase2.mts` contra el catálogo actual.** Está fijado a un respaldo concreto, 58 tablas y 11 triggers. El esquema evolucionó con trazabilidad, resoluciones de inventario, E1, Fondo, E2 y preparación E3/Tanda B. Clasificar una tabla desconocida como borrable por omisión sería especialmente peligroso para evidencia financiera, idempotencia y configuración.

### Fuentes primarias revisadas

| Fuente | Evidencia precisa |
|---|---|
| `scripts/src/purge-operational-phase2.mts:76–99,447–529` | Respaldo fijo, autorizaciones, hash del dump, comparación de restauración y catálogo hardcoded. El programa no crea un respaldo. |
| Mismo archivo, `101–241` | A33, B7, C18 y orden explícito de DELETE. |
| Mismo archivo, `929–1186` | Transacción, candados, triggers, contadores, secuencia y reconstrucción real del caché. |
| Mismo archivo, `1200–1256,1276–1314` | Identidad del destino, entorno, pausa declarada, prueba disposable y huella de fuente. |
| `reports/fase2-purga-2026-09-13.md:3–21,48–150,154–172` | Resultado ejecutado, comparación C, contadores, lectura independiente y límites de pruebas/UI. |
| `artifacts/api-server/src/lib/inventario.ts:3022–3032` | La reconstrucción acepta la transacción del llamador; sin ella abre una propia. |
| `reports/prompt-h/block4-purga-verificacion.md:13–17,25–35` | Episodio posterior distinto: TRUNCATE sin reset; fechas UTC del 16, equivalentes al 15 en CDMX. |

Los hashes y resultados históricos transcritos aquí proceden de esos reportes: **no se recalcularon ni se verificó hoy la existencia o integridad del respaldo privado**.

## 1. Separar los episodios: no mezclar A33 con A35

| Frontera | Método y resultado documentados | Lo que NO prueba |
|---|---|---|
| 13/09, fase 2 | A33/B7/C18; DELETE ordenado; cinco blockers deshabilitados de forma acotada; reinicio de `contenedores_folio_seq` a 1; series a 1,000,000. | Catálogo, objetivos o autorización válidos para septiembre 23. |
| Prompt H posterior | A35/B7/C18, 60 tablas; TRUNCATE con conservación de identidad, sin reset de secuencias. | Que el 13/09 no reinició la secuencia o utilizó TRUNCATE. |
| Prompt L/M | Generación de series de ocho dígitos y default físico 10,000,000. | Permiso para trasladar el reset antiguo de siete dígitos a una purga futura. |

La advertencia sobre una posible confusión con el 14/09 se resolvió leyendo el contexto: la evidencia de Prompt H fija su finalización en `2026-09-16T04:11:21.713753389Z`, no en el 13/09 ni en el 14/09. Es hora de persistencia del artefacto, **no un timestamp emitido por PostgreSQL para COMMIT**. Véase la auditoría T11 para las citas de `replit.md`.

## 2. Qué se eliminó y qué debe preservarse

### Lista A histórica: únicamente las 33 tablas autorizadas entonces

El conjunto se presenta en el **orden real de borrado**, no alfabéticamente. Fuente: `scripts/src/purge-operational-phase2.mts:205–241`. Ese orden fue verificado para las FK de aquel catálogo. **No se declara topológico para el catálogo posterior.**

| Paso | Tabla | Paso | Tabla | Paso | Tabla |
|---:|---|---:|---|---:|---|
| 1 | `aplicaciones_credito` | 12 | `salida_rollos` | 23 | `movimientos_credito` |
| 2 | `aplicaciones_pago_proveedor` | 13 | `salidas_dinero_caja` | 24 | `pagos_proveedor` |
| 3 | `auditoria_inventario_escaneos` | 14 | `sesiones_caja_dias` | 25 | `movimientos` |
| 4 | `auditoria_inventario_participantes` | 15 | `solicitudes_pago_dirigido` | 26 | `salida_lineas` |
| 5 | `auditoria_inventario_snapshot` | 16 | `stock_minimo_episodios` | 27 | `viajes` |
| 6 | `autorizaciones_nota` | 17 | `ticket_lineas` | 28 | `entradas` |
| 7 | `contenedor_lineas` | 18 | `ticket_pagos` | 29 | `rollos` |
| 8 | `cuadre_fiscal_registros` | 19 | `viaje_salidas` | 30 | `salidas` |
| 9 | `notificaciones_credito` | 20 | `viaje_tickets` | 31 | `tickets` |
| 10 | `notificaciones_sistema` | 21 | `auditorias_inventario` | 32 | `sesiones_caja` |
| 11 | `reimpresiones_etiqueta` | 22 | `contenedores` | 33 | `sesiones` |

Los pasos se leen 1–11, 12–22 y 23–33. No había CASCADE ni TRUNCATE en este método. La eliminación de sesiones autenticadas fue parte del alcance excepcional histórico; no se confunde con borrar usuarios.

### Lista C: conservación exacta, no solo “catálogos”

Fuente: script `150–169`; reporte real `90–111`.

| Grupo protegido | Tablas |
|---|---|
| Productos e historial comercial | `productos`, `precio_historial` |
| Directorios y documentos del cliente | `clientes`, `cliente_documentos`, `proveedores` |
| Identidades y acceso | `usuarios`, `permisos_rol`, `permisos_usuario`, `permisos_ubicacion` |
| Sitios | `ubicaciones`, `pisos` |
| Logística y equipos | `camionetas`, `choferes`, `equipos`, `equipos_checklist` |
| Configuración de mínimos | `stock_minimo_sitios`, `stock_minimos` |
| Bitácora permanente | **`auditoria`** |

Preservar significa mismos renglones, claves, valores, autores y fechas en la frontera del commit. No basta tener el mismo conteo. Se conservan precios, permisos personalizados, checklist, interruptores de sitio y mínimos; únicamente sus episodios operativos pertenecían a A. **`auditoria` no es `auditorias_inventario`: la primera se conserva; las segundas eran operaciones de prueba eliminadas.**

La excepción futura de producto individual sin movimientos y su historial no es una instrucción para borrar productos en la purga general. El catálogo y la bitácora quedan protegidos. Tampoco se autorizan alteraciones de usuarios, contraseñas o permisos para facilitar las verificaciones.

### Lista B: objetivos exactos del 13/09

Fuente: script `137–178,1035–1081,1109–1135`; reporte `113–126`.

| Objeto | Campo / acción histórica | Objetivo exacto | Alcance |
|---|---|---:|---|
| `ticket_folio` | `ultimo_folio` | 999 | Conservar su fila; siguiente folio 1000. |
| `entrada_folio` | `ultimo_folio` | 0 | Conservar todas las claves de sitio. |
| `salida_folio` | `ultimo_folio` | 0 | Conservar todas las claves de sitio. |
| `viaje_folio` | `ultimo_folio` | 0 | Conservar todas las claves de sitio. |
| `auditoria_inventario_folio` | `ultimo_folio` | 0 | Conservar todas las claves de sitio. |
| `series_consecutivo` | `ultimo_numero` | 1000000 | Objetivo histórico de siete dígitos; NO vigente para nueva ejecución. |
| `existencias` | Reconstrucción por función canónica dentro de la misma transacción | Cero saldo y cero rollos disponibles tras vaciar kardex/rollos | No borrar sus pares ni asignar manualmente todos sus campos. |
| `public.contenedores_folio_seq` | Reinicio transaccional de la secuencia derivada de `contenedores.folio` | `last_value=1`, `is_called=false` | Única secuencia objeto de reset; no es una octava tabla B. |

**No otros resets:** no reiniciar IDs seriales de tickets, rollos, usuarios, auditoría, pagos, permisos, notificaciones, E1/E2 ni tablas nuevas; no “normalizar” todas las secuencias. El método histórico usó un reinicio específico, no `RESTART IDENTITY` general ni `setval`. No modificó defaults de columna como parte de esos objetivos.

La fuente actual de series declara default 10,000,000 (`lib/db/src/schema/series.ts:10–20`; `artifacts/api-server/src/lib/inventario.ts:198–208`). La futura hoja de objetivos debe respetar la decisión vigente de ocho dígitos o detenerse para decisión expresa. La secuencia de contenedores requiere decisión específica nueva: Prompt H la conservó; eso tampoco autoriza resetearla ahora.

## 3. Catálogo ampliado: inventario estático, no inventario vivo

La lista siguiente procede de **declaraciones Drizzle y DDL preparado leídos como texto**. No se consultó el catálogo de la API. Una declaración en fuente no prueba instalación; una bandera OFF no prueba que la tabla no exista. Un inventario futuro debe comparar fuente, migraciones, DDL manual, catálogo efectivo, dependencias, triggers, funciones y secuencias.

### Tablas nuevas respecto de A33/B7/C18 visibles en Drizzle

| Familia | Tablas | Archivo y línea | Política futura |
|---|---|---|---|
| Trazabilidad física | `ticket_linea_consumos` | `lib/db/src/schema/ticket-linea-consumos.ts:25–26` | Pendiente: evidencia ligada a líneas/rollos; no borrar automáticamente. |
| Revisión de etiquetas | `revisiones_etiqueta` | `lib/db/src/schema/etiquetas.ts:55–56` | Pendiente: conservar relación entre revisión e historial hasta decisión. |
| Resoluciones de auditoría | `auditoria_sobrante_contextos`, `auditoria_sobrante_decisiones`, `auditoria_faltante_reactivaciones` | `lib/db/src/schema/auditoria-resoluciones.ts:9,16,31` | Pendiente: evidencia append-only; revisar cadenas y movimientos antes de clasificar. |
| E1 | `operaciones_credito_e1`, `cobros_credito_pendientes_e1`, `atribuciones_credito_e1` | `lib/db/src/schema/pos.ts:302,322,430` | Pendiente: claims, dinero retenido y atribuciones no son cachés descartables. |
| E10 | `fondo_mariana`, `fondo_movimientos`, `fondo_arqueos` | `lib/db/src/schema/fondo.ts:20–21,35–36,71–72` | Pendiente: distinguir configuración singleton y evidencia financiera. No inferir que OFF autoriza borrar. |
| E3 preparado | `vistas_abono_e3`, `recibo_folio_e3`, `recibos_abono_e3` | `lib/db/src/schema/e3-receipts.ts:9,17,22` | Pendiente: vista guardada, contador y evidencia documental requieren políticas distintas. |

Las exportaciones de estas familias están en `lib/db/src/schema/index.ts:3,13,16–17,21–22`. Su presencia en el manifiesto fuente no acredita instalación de E3.

### E2 y Tanda B fuera de esa lista Drizzle

| Familia | Tablas declaradas | Evidencia textual | Estado para una futura purga |
|---|---|---|---|
| E2 A+C | `finalizaciones_abono_e2`, `evidencia_no_aplicada_e2` | `reports/e2-paquete-liberacion-preparado-20260921/sql/01-install-evidence-prepared.sql:5,25`; instalación reportada en `reports/e2-liberacion-20260922/resultado.md:47–53` | Política pendiente; evidencia durable, no borrar como “temporal”. |
| E4 | `caja_salidas_e4`, `caja_salidas_e4_operaciones` | `reports/tanda-b-20260922/e4/01-preparado.sql:4,23` | Preparado; no se afirma instalado. |
| E12 | `proveedor_operaciones_e12`, `proveedor_solicitudes_e12`, `caja_retornos_proveedor_e12`, `proveedor_efectivo_e12`, `caja_desbloqueos_e12` | `reports/tanda-b-20260922/e12/01-preparado.sql:19,26,35,46,79` | Preparado; política pendiente por tabla. |
| E9 | `e9_entregas`, `e9_operaciones` | `reports/e9/01-preparado.sql:5,14` | Preparado; evidencia y claims pendientes de clasificación. |
| E5 | `e5_recepciones`, `e5_cobros`, `e5_aplicaciones`, `e5_vinculos_credito`, `e5_salidas_bancarias`, `e5_devoluciones`, `e5_documentos`, `e5_operaciones`, `e5_impresiones`, `e5_nacimientos`, `e5_ddl_originales` | `reports/e5/01-preparado.sql:44,59,67,83,88,99,120,131,142,152,722` | Preparado; incluye conservación de definiciones DDL, que no debe tratarse como dato operativo común. |
| E11 | `e11_perfiles`, `e11_perfil_eventos`, `e11_operaciones`, `e11_resoluciones`, `e11_conciliaciones`, `e11_conciliacion_ventas`, `e11_decisiones`, `e11_avisos`, `e11_notificacion_origen`, `e11_cambios_usuario`, `e11_e5_preparaciones`, `e11_e5_definiciones` | `reports/e11/01-preparado.sql:92,100,108,116,134,144,150,159,164,168,174,181` | Preparado; perfiles/configuración y evidencia no reciben una misma política automática. |
| E7 | No se identificó una tabla nueva en el DDL examinado de esa familia. | `artifacts/api-server/src/lib/e7-feature.ts:2` mantiene puerta OFF. | Es lector preparado; verificar sus dependencias, no inventar una tabla ni certificar ausencia en DB. |

También existe una deriva histórica declarada para `cuadre_fiscal_registros` (`replit.md:710`): figura en A antigua aunque no en el esquema Drizzle examinado. No se elimina del inventario por no tener declaración Drizzle.

**Regla propuesta de clasificación segura:** toda relación descubierta debe quedar explícitamente en borrar, reajustar/reconstruir, preservar o **pendiente**. Pendiente/desconocida significa **bloquear la ejecución**, no purgarla por omisión. La autorización debe enumerar objetos y campos; no basta “todo lo operativo”. Se reconstruye el grafo completo de dependencias, incluidos vínculos lógicos, y se vuelve a ensayar el orden.

## 4. Respaldo privado y ensayo: puertas previas

1. **Autorización textual nueva.** Debe fijar entorno, instante de vigencia, objetos, objetivos, tratamiento de tablas nuevas, alcance de la excepción a no borrar histórico financiero, ventana sin escritores y quién puede autorizar cada continuación. Una autorización pasada o la petición de documentar no habilita escrituras.
2. **Identidad efectiva.** Comparar la conexión del proceso que realmente sirve con la elegida para la operación, no solo variables del shell. Registrar identidad segura, versión, revisión exacta, huella del esquema y artefacto servido, sin URLs ni credenciales.
3. **Ventana consistente autorizada.** Pausar escritores únicamente cuando haya permiso, incluidos API, pollers y mantenimiento. La documentación presente no los detiene. Un login o GET autenticado puede escribir sesión; no utilizar tráfico normal como si fuera solo lectura.
4. **Respaldo íntegro nuevo.** Conservar datos, esquema, ownership, ACL, funciones, triggers, restricciones, índices, secuencias y sus estados. Dump y metadatos privados, directorios restringidos y archivos legibles solo por su custodio. Registrar SHA-256, tamaño, revisión/árbol, herramientas y manifiesto. La copia remota debe ser owner-only, con descarga verificada por tamaño/hash y prueba de restauración.
5. **Restauración de recuperación, no base de pruebas expuesta.** Un dump íntegro contiene usuarios, hashes de contraseña y sesiones; no publicarlo, no arrancar interfaz contra él, no autenticar actores restaurados ni incorporarlos al seed. La autorización para comprobar recuperación debe ser explícita y separada de población de pruebas.
6. **Ensayo funcional sin actores reales expuestos.** Usar base nueva y seed autorizado para actores sintéticos; no copiar identidades reales para satisfacer FK. Si hace falta ensayar la purga sobre una réplica completa de recuperación, resolver antes con el propietario la excepción de tratamiento privado y el método que impida exponer/autenticar esos actores. No anonimizar silenciosamente el único restore usado para demostrar igualdad: alteraría la prueba de recuperación.
7. **Falta de actor o referencia = detener.** No crear un ADMIN en development, tomar contraseñas del respaldo, inventar fixtures fuera del seed ni convertir una recuperación privada en entorno E2E. `replit.md:524–529` prohíbe usar la copia histórica de actores como precedente.
8. **Restaurar línea base prístina tras el ensayo.** La prueba de ticket folio 1000 se hizo solo en disposable. No crear ese ticket en la API para “verificar” el reset; tampoco usar la réplica ensayada como respaldo intacto.

El respaldo histórico tenía hash `b2e0ad1765da065cdd5d4f7dbd609eeb7c0fc31dd0b2e53c70d1360806cb22c6` y revisión acompañante `b36b9a4eac11b3e630a84f775f71c597618b4f60` (`reports/fase2-purga-2026-09-13.md:25–30`). Son identificadores de un episodio pasado, no expectativas válidas para la operación futura.

## 5. Mecánica transaccional histórica y adaptación pendiente

En el programa histórico:

- Se bloquearon las 58 tablas en modo exclusivo antes de la segunda fotografía (`944–975`). Se compararon conteos y hashes C contra el preflight, para impedir que cambios entre lectura y escritura pasaran inadvertidos.
- Los cinco blockers afectados fueron `aplicaciones_credito_inmutables`, `aplicaciones_pago_proveedor_append_only`, `movimientos_credito_inmutables`, `pagos_proveedor_inmutables` y `ticket_pagos_inmutables` (`180–189,1003–1019`). Se reactivaron antes del commit.
- La excepción de etiquetas fue local a la transacción; no se deshabilitó su trigger (`991–1001`). **Los triggers de `auditoria` nunca se deshabilitaron**. Se verificaron los once habilitados antes de terminar (`1020–1033,1136–1153`).
- DELETE, contadores, secuencia autorizada y `reconstruirCacheExistencias(tx)` pertenecieron a la misma transacción. La función no debe abrir otra transacción cuando recibe la del llamador.
- Se exigieron A=0, C exacta, valores B y filas B conservadas, secuencia en estado esperado, `badPairs=0` y caché reconstruido (`1083–1141`).

**No trasladar esas cinco excepciones al esquema actual.** E1/E2 y las familias nuevas añaden integridad y evidencia propia. Un fallo por trigger o FK es un bloqueo, no permiso para desactivar todos los triggers, quitar guardas E1 o usar un rol privilegiado para sortearlas. La propuesta futura necesita revisión de cada dependencia y autorización antes de producir un ejecutable adaptado.

## 6. Hashes y cuatro fronteras de comparación

La evidencia debe separar explícitamente:

| Frontera | Comparación exigida | Criterio de aceptación |
|---|---|---|
| Respaldo/restauración | Todas las tablas/campos, catálogo semántico, ownership/ACL, secuencias (`last_value` e `is_called`), funciones/triggers | Igualdad íntegra; no solo conteos. |
| Preflight y bajo candado, antes de borrar | Estado vivo frente a respaldo fresco; revisión, objetos, huellas C/configuración, valores B y dependencias | Sin drift no explicado; si cambia, detener y renovar evidencia, no rebajar expectativa. |
| Dentro de transacción y postcommit desde conexión nueva | A autorizada vacía, C íntegra, B exacta, únicas secuencias autorizadas cambiadas, integridad y triggers restaurados | Commit acreditado y comprobación independiente antes de reanudar tráfico. |
| Después de arranque autorizado | Comparar contra postcommit, no reemplazarlo; identificar cada delta y su productor | Registrar efectos reales sin reparar ni resetear por suposición. |

El hash histórico C usa SHA-256 sobre filas serializadas y ordenadas de manera determinista (`script:264–288,609–611,841–848`). No se publican las filas privadas ni contraseñas; se conservan conteos y huellas. Una adaptación debe capturar precisión completa de fechas y todos los campos, normalizar de la misma forma ambos lados y versionar el algoritmo. Hashes generados por algoritmos distintos no son comparables.

Ejemplos históricos verificables en el reporte real:

- Productos: 1,234 antes/después, SHA-256 `134d15726b0063cba05208a09c5217e9b9e1a8c0314bd9210ad2c5d5f3c918f6` (`94`).
- Historial de precios: 1,016 antes/después, `ad7d6f4c7c84fb34096cf482d8e416f05446ffbe83e5ce446eb6ab10634693c8` (`95`).
- Auditoría: 3,045 antes/después, `2726bb29daabb723dc0b54b8530bbda9a166031d3268f171916181ddde831196` (`111`).
- Lectura independiente a `2026-09-13T16:37:38.810Z`: PASS; secuencia 1/no llamada, mínimos y once triggers conservados (`162`).
- Postarranque a `2026-09-13T16:44:33.894Z`: 12 notificaciones y 3 episodios; timestamps cambiaron en 72 permisos de rol y 54 de ubicación; no se presentó ese estado como C18 exacta (`164`).

En un arranque normal los inicializadores y el monitor pueden escribir; la fuente distingue las ramas normal/inspection/limited (`artifacts/api-server/src/index.ts:158–194,205–235`). El E2 servido se documentó en inspección: no asumir que toda reanudación futura tendrá efectos normales ni prometer ausencia de escrituras sin verificar el modo efectivo. Tampoco una prueba HTTP de salud acredita comparación de datos.

## 7. Rollback, savepoints y recuperación después del commit

### Antes del commit

Un error debe abortar la transacción completa: eliminaciones, actualizaciones de contadores, reconstrucción y cambios transaccionales de definición quedan sin confirmar. No atrapar una violación y continuar con una purga parcial. Un savepoint permite revertir una parte de la transacción, **no demuestra rollback integral ni commit válido**. Los controles diferidos deben observarse hasta la frontera real del commit.

La limitación de secuencias se debe describir con precisión:

- El avance ordinario mediante `nextval` y las modificaciones mediante `setval` no se recuperan simplemente con rollback, tampoco con rollback a savepoint. Una prueba fallida puede consumir números.
- El reinicio utilizado por el script histórico fue **ALTER SEQUENCE RESTART**, transaccional; no se debe describir como si tuviera la misma semántica que `setval`.
- Esa diferencia no vuelve transaccionales los consumos independientes ni justifica resetear otras secuencias. Registrar antes/después **todas** las secuencias y distinguir avance legítimo, reset autorizado y drift inexplicado.
- Un ensayo con consumos de folio/serie debe restaurarse desde cero para recuperar una línea base exacta. “Hicimos rollback” no basta como comprobación de que el cluster quedó prístino.

El propio script advierte que el harness puede avanzar secuencias no transaccionales y exige re-restauración (`21–24,1240–1247`). E2 añadió otra cautela: los marcadores de procedencia deben sobrevivir correctamente al uso de subtransacciones; los cuatro fallos históricos SAVEPOINT no se corrigen suponiendo que `xmin` equivale siempre al xid superior (`reports/e2-validacion-postgresql-corregida-20260921.md:59–75`; evolución documentada en `reports/e2-validacion-savepoint-20260921.md:30`). No se propone modificar esa integridad para purgar.

### Después del commit

Ya no existe un rollback de aquella transacción. Recuperar implica **restauración autorizada del respaldo íntegro** en una ventana controlada, con nueva comprobación de identidad, datos, esquema y secuencias. Hay que preservar la evidencia del fallo y decidir qué hacer con cualquier escritura posterior al commit: restaurar ciegamente perdería esas operaciones. No recrear filas a mano ni ejecutar una purga inversa.

Si falla la comprobación postcommit, no reanudar tráfico por conveniencia. Si el fallo solo ocurre al escribir el archivo de evidencia después de confirmar, no interpretar `FAIL`/exit no cero como prueba de rollback: `executePurge` retorna después del commit y el programa escribe su evidencia después (`1177–1182,1405–1439`). **Resolver el estado durable desde evidencia independiente, sin reintentar automáticamente.**

## 8. Aceptación y pendientes que bloquean una ejecución futura

Para autorizar una operación nueva faltan, como mínimo:

1. Clasificación aprobada de todo el catálogo efectivo y cada tabla nueva; reconciliación de objetos fuera de Drizzle.
2. Excepción explícita a conservación financiera y alcance de movimientos históricos que se quieren eliminar. La mención de movimientos #51–53 no permite borrar ahora ni ampliar automáticamente al resto.
3. Objetivos vigentes de los contadores, tratamiento de la secuencia de contenedores y prohibición explícita de otros resets.
4. Método autorizado de recuperación privada y ensayo que no exponga actores reales ni infrinja la regla de población.
5. Adaptación revisada y ensayada del procedimiento a las nuevas FK, guardas, evidencia diferida, claims y dependencias; no se produjo en T10.
6. Respaldo fresco restaurado y verificado; autorización de ventana, ejecución, reanudación y eventual recuperación, cada una con su alcance.
7. Evidencias separadas de escenarios, limpieza, postcommit, arranque y UI.

**No existe un PASS total histórico que sustituya estas puertas.** El reporte real declara `PURGE_COMMITTED_WITH_VALIDATION_LIMITATIONS`: 75 escenarios pasaron, pero hubo dos fallos de limpieza de suites; UI LIVE quedó BLOCKED y la prueba de folio 1000 fue solo disposable (`reports/fase2-purga-2026-09-13.md:3–5,154–166`). Este documento no cambia esos resultados ni afirma una purga ejecutada en septiembre 23.