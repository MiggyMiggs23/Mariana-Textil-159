# 07 — Tanda B r5 preparada OFF; fase B NO EJECUTADA

**Resultado terminal MAIN: `PASS_PREPARED_OFF`, exit 0. No liberada.**

Entrega vigente: `reports/tanda-b-b0-b1-20260923/r5/final-manifest.json`.
Índice documental: `reports/tanda-b-b0-b1-20260923/README.md`.
El manifiesto inicial de la raíz y todos los fallos anteriores permanecen
históricos e intactos; no se reinterpretan como éxitos.

## Autorizaciones y alcance exacto

Se conservan íntegros los textos:

- `autorizacion-propietario-tanda-b-b0-b1.txt`: B0 real READ ONLY, expectativas
  derivadas sin reconstruir catálogo completo y comparación ordenada de enums.
- `autorizacion-cuatro-reemplazos-e5.txt`: respuesta del propietario
  **«Sí, incluir exactamente esos cuatro reemplazos»**, exclusivamente para
  preparación/ensayo en PostgreSQL desechable.

Los cuatro objetos E1 son:

1. `public.validar_movimiento_credito_e1()`.
2. CHECK `operaciones_productor_naturaleza_ck_e1` de
   `public.operaciones_credito_e1`.
3. `public.e1_guard_pending_receipts_closed()`.
4. Trigger `zz_e1_pending_receipts_closed` de
   `public.cobros_credito_pendientes_e1`.

El último ya era AFTER INSERT STATEMENT: se añade la transition relation;
no se cambia BEFORE a AFTER. El cambio de configuración `search_path` de la
función del punto 3 aparece explícito como el único atributo viejo sustituido.
No se amplió la allowlist a otros objetos B0, ni se recortó SQL para simular
aditividad. La extensión E11 de `e5_insert_authority()` pertenece al delta
nuevo E5, no a una modificación adicional de B0.

SQL ensayado: E4/E12 preparados, E9, E5 y E11; E7 no tiene instalación SQL
propia identificada. Se incluyen objetos nuevos sobre tablas antiguas,
índices, constraints, FKs y triggers nuevos: no se filtró el delta por prefijo.
Sin aplicación SQL a la base de la API, permisos nuevos ni activación.

## Fuentes diferenciadas

| Componente | Identidad |
|---|---|
| API/UI compiladas y reutilizadas | `cc628aed315a4bbfd3e6cb8766d28200ce400842` |
| Comparación enum, commit independiente | `817830d3f8d4ce2d00434c0d2e9433b47dd38a9a` |
| Primer par de paréntesis SQL/pin E11 | `a5ffecfac5450a666d9c800eb73bd06193d3ade2` |
| Tres pares restantes y auditoría amplia | `91dfbd26e544d1fc4d0a1e57d95ec61ecad3af6f` |
| SQL externo definitivo | `91dfbd26e544d1fc4d0a1e57d95ec61ecad3af6f` |

Las correcciones SQL solo parentetizaron cuatro expresiones CASE en
condiciones IF de `e5_graph_guard`; E11 actualizó únicamente el hash exacto
de ese cuerpo. No modificaron lógica de negocio ni objetos autorizados.
No se recompiló ni atribuyó ese SQL externo a una nueva fuente del bundle.

El comparador enum compara etiquetas por orden relativo, conservando captura
cruda. Evidencia MAIN anterior: 5/5 pruebas puras y PostgreSQL16.10 PASS,
renumeración aceptada y cambio de orden/conjunto rechazado
(`07-enum-unit.log`, `07-enum-postgres.log`).

## Evidencia terminal r5

Rutas siguientes bajo `reports/tanda-b-b0-b1-20260923/r5/`:

| Control | Resultado y evidencia |
|---|---|
| B0 READ ONLY | Captura original conservada en `evidencia/live/`; sin actores/credenciales copiados ni pg_dump |
| Preflight real actual | `evidencia/preflight-cli.json`: PASS, token positivo; CLI exit 0 |
| Identidad fijada | PID195, startTicks27444, cmdline SHA `054b0b26e12077a917aff52bb87b25e57ac4d1f4c5e33ff46737352cc157b5d7` |
| Catálogo/delta SQL | `evidencia/rehearsal-r5/exact-delta.json`: 817 filas nuevas de esquema, 615 atributos nuevos, exactamente 4 definiciones viejas reemplazadas y 1 atributo viejo reemplazado |
| Auxiliares RI/dependencias | PASS_RI_AND_DEPENDENCIES; RI776→1040; pg_depend2950→4489, conservando las seis repeticiones legítimas de B0 |
| Sensibilidad real local | PASS_REAL_DISPOSABLE_MUTATIONS: mutación de fila sentinela y nextval detectados, restituidos antes del arranque |
| Arranque candidato | PASS_INSPECTION_START, wrapper127.0.0.1, bundle sin modificar |
| Invariancia | PASS_CATALOG_ROWS_SEQUENCES, incluye hash auxiliar multiset |
| Cleanup | candidateStopped=true, candidateProcessGroupGone=true, postgresStopExit=0, disposableDestroyed=true |
| Runtime/archivos protegidos | `evidencia/main-protected-after.json`: PASS_UNCHANGED |
| Orquestación/finalización | PASS_EXECUTION_AND_PROTECTED; finalizador CLIexit0/token positivo; `run-main-terminal.json`: PASS_PREPARED_OFF |

El B0 conservado identifica `heliumdb`, OID16384, esquema public, rol postgres,
PostgreSQL160010. El preflight nuevo comprueba identidad y huellas antes del
ensayo. PID191/204 de documentos anteriores no se heredaron como identidad r5.
La asociación de comando y hash de disco del E2 activo no demuestra los bytes
ya cargados en su memoria.

### HTTP observado, no inferido de fuente

En r5 se guardó cada status y cuerpo **antes** de su aserción en
`evidencia/rehearsal-r5/http-candidate-N.json`:

- `/api/healthz`: 200, exactamente `{"status":"ok"}` observado.
- `/api/e7/disponibilidad`: 200, exactamente `{"enabled":false}`.
- `/api/e7/atribucion`: 403, código E7_DISABLED y mensaje exacto.
- `/api/e5/cobros`: 403, objeto `error` con código E5_DISABLED y mensaje exacto.
- `/api/e11/identidad`: 403, exactamente code/message/requestId, código
  E11_DISABLED, mensaje exacto y requestId UUID.

Los contratos OFF rechazan campos extra, enabled=true, datos E7 HTTP200 y
404 del candidato. El contrato de ausencia404 del control E2 es separado.
Pruebas puras archivadas: 20 contratos HTTP, 11 multiset y 12 SQL textuales/
léxicas; además controles negativos de identidad/gates/hashes/catálogo. Estos
tests puros no se atribuyen a consultas reales o integración autenticada.

## Fallos conservados y causa

| Intento | Resultado conservado |
|---|---|
| r1 | FAIL sintaxis del SQL E5 original: CASE estado sin paréntesis dentro de IF; no fallo de fixture |
| r2 | FAIL sintaxis E5: otros tres CASE aritméticos de historia sin paréntesis; corregidos conjuntamente tras revisar los cinco SQL |
| r3 | SQL pasó; FAIL del arnés al tratar pg_depend semántico como conjunto único; dependencia repetida legítima de fondo_movimientos_original_uidx |
| r4 | Proyección/auxiliares/sensibilidad pasaron; candidato FAIL por expectativa errónea de rechazo de E7disponibilidad200; no se guardó su cuerpo, por lo que no se afirma qué cuerpo tuvo entonces |
| r5 | PASS con contrato exacto200/false de disponibilidad y403 de datos/funcionalidad OFF |

Todos los intentos registraron PGstopExit0 y clúster destruido. r1–r3 no
llegaron a arrancar candidato. En r4 **el control E2 pasó sobre el mismo
fixture**, salud200 y ausencia404 de las tres rutas entonces consultadas;
ese PASS no convirtió el fallo del candidato en éxito. r5 no repitió control
E2 al pasar candidato. La evidencia histórica de reconstrucción FAIL del
paquete `tanda-b-off-preparada-20260923` también se conserva sin modificación.

El arnés multiset no inventa OID/objsubid que no estén capturados: conserva
campos semánticos completos, columna en identity y origen FK+constraint,
incluida multiplicidad. No afirma preservación física de direcciones pg_depend.

## Huellas finales

| Elemento | SHA-256 |
|---|---|
| Manifiesto final r5 | `b8550e72e090cfbebde64f09375737868b94260409180f0d325c6a144cfe6716` |
| Sello de preparación r5 | `a17ee88d4e686754a84354721ac4935086d469caf1dad0d80e58a64b9dac7d09` |
| API candidata | `deaa31522316a38baff0bebfbcf2a418565e9b031775abe0249a51f520bfc670` |
| UI index.html | `118cfee92b28955f81685aeb0bc6d5c4d99f7233e5e5c681403aad5feaa64af6` |
| B0 esquema | `89c445d53c3db7d8cb3a45bdab49f82acb12943d62084eced21ab3af5cf5a358` |
| B0 atributos comparables | `a8389a4be6f0765a58849a425e742fc941821fbdf9c6fab0fa9c1eeb428d5ec6` |
| B1 esquema proyectado | `82fb728b58ee70d04b5fc6b20a359e0f01697aab2917eb626bf763e32f522f95` |
| B1 atributos comparables | `a545824d9e3eceaa9138ac0e2854bf0763175e05bb97c4788900c0dc2997b323` |
| B0 auxiliar multiset | `1dcf2b7af43a30c5912940d138e17fcccd76bc98a3b29c9dcb292b1c30dd0b24` |
| B1 auxiliar multiset | `28e9f236af2c29c838c7bead1df5b879b84a2eeded3e4f8668c71b851219d112` |

Las huellas comparables de atributos aplican semántica enum ordenada; no
reemplazan los archivos de captura cruda, conservados y hashados por separado.
`delivery-inventory.json` y su `.sha256` cubren la entrega documental y los
terminales tardíos que no alcanzó a inventariar el finalizador. Sus exclusiones
de autocálculo y tratamiento de enlaces son explícitos; no se modifica el
manifiesto r5 ya sellado para añadirlos.

## Límites y requisitos no acreditados

- Arranque **real en modo inspección**, no arranque normal/producción; los
  inicializadores, backfill y monitor están pausados.
- Fixture de dependencias mínimo y vacío salvo sentinela local/metadatos DDL,
  no reconstrucción integral ni clon de datos/actores reales.
- La instalación SQL correcta no prueba todas las ramas PL/pgSQL ni INSERT
  operativos válidos en cada guarda SQL. No hay prueba funcional exhaustiva
  de E4/E12/E9/E5/E11/E7 o de todos sus endpoints.
- HTTP OFF observado sin sesión; no integración autenticada por rol/actor,
  concurrencia funcional completa ni pruebas visuales/end-to-end de UI.
- Sensibilidad/invariancia de filas/secuencias demostrada en desechable, no
  equivalencia de todos los datos reales ni preservación de efectos de un
  arranque de producción.
- No autorización de despliegue, apertura de gates, instalación real ni fase B.

El texto de fase B original r5 permanece sellado y **NO EJECUTADO**. Su
redacción preparatoria y el límite genérico «denegaciones sin sesión» no se
reescribieron: este resultado aclara que disponibilidad E7 es pública200/false.
Se añade, sin modificar ese archivo sellado, el
[texto operativo de fase B para revisión](../tanda-b-b0-b1-20260923/fase-b-texto-para-revision.txt):
**BORRADOR NO EJECUTADO** con identidades, orden exacto de los cinco SQL,
cuatro reemplazos, transacciones independientes (sin atomicidad global),
revalidación inmediata B0, respaldo/quiescencia/autorización nueva pendientes,
cotejo B1/datos/secuencias/metadatos DDL y reglas de aborto sin autorreintento
ni rollback compensatorio inventado. Su entrega no autoriza ejecutarlo.
Esta finalización solo lee/escribe archivos; MAIN conserva verificación final
y commit. Sin nuevas consultas DB, red, tests, builds o arranques en este cierre.