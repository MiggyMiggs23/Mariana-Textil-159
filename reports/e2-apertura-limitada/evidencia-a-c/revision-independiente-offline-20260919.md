# Revisión independiente offline A+C — 2026-09-19

## Dictamen y alcance

**NO APTO PARA ACTIVACIÓN.** Hay defectos concretos de integración del preflight/activación, integridad de la evidencia y reversión. La devolución sigue cerrada; esta revisión no demuestra una extracción de efectivo explotable desde HTTP.

Base solicitada y HEAD verificado al inicio: `a0a713e245fed21d0fc6e85edf869159a3c743e9`. Se comenzó por `estado-offline.md`. Las referencias siguientes corresponden a los archivos leídos de ese candidato, no a eventuales correcciones paralelas posteriores. Durante la revisión apareció una eliminación ajena de `reports/e2/sql/credit-refunds-prepared.sql` en el working tree; se había leído previamente y sus referencias describen el contrato del HEAD solicitado.

Método: lectura estática de fuente, SQL preparado, contratos y pruebas. **No se ejecutaron SQL, consultas, PostgreSQL, pruebas, HTTP, entrypoints, builds, workflows ni cambios de entorno.** Única escritura del revisor: este informe. Los PASS del checkpoint son declaraciones del checkpoint, no resultados reproducidos por esta revisión.

Abreviaturas de rutas:

- `lib/`: `artifacts/api-server/src/lib/`.
- `routes/`: `artifacts/api-server/src/routes/`.
- `AC/`: `reports/e2-apertura-limitada/evidencia-a-c/`.
- `plan/`: `reports/e2-apertura-limitada/sql/`.
- `refund.sql`: `reports/e2/sql/credit-refunds-prepared.sql`.

## Hallazgos

### R1 — Alta: el preflight rechaza precisamente la instalación A+C requerida

**Referencias:** `lib/limited-startup-preflight.ts:135-147,225-231,421-447`; `AC/01-install-evidence-prepared.sql:220-223`.

El catálogo E1 consulta **todos** los triggers no internos de sus cuatro tablas, entre ellas `movimientos_credito`, y exige exactamente los once de `E1_TRIGGER_EXPECTATIONS`. La instalación añade el trigger de usuario `e2_abono_finalization_complete` a esa misma tabla. Es un constraint trigger creado por el usuario, no un trigger interno de FK que desaparezca por `NOT t.tgisinternal`.

Con catálogo correcto A+C, la validación A+C puede terminar bien y la validación E1 posterior recibe doce filas y falla. También falla el arranque limitado con permisos cerrados si se conservan las tablas/triggers A+C, que es precisamente el rollback operativo prometido.

**Corrección:** validar el inventario combinado exacto, separando claramente objetos E1 y A+C sin permitir triggers extra arbitrarios. Modelar tanto “cerrado sin instalar” como “cerrado con evidencia conservada” y “limitado con evidencia obligatoria”.

**Prueba faltante:** catálogo realista con once triggers E1 y el nuevo trigger de movimiento, más cuatro triggers en las tablas A+C; éxito habilitado y cerrado-conservado, rechazo de objetos inesperados.

### R2 — Alta: los planes de apertura y cierre no admiten el nuevo catálogo; aprobación/digests siguen siendo pre-A+C

**Referencias:** `plan/01-apply-limited-cash-abono.sql:66-109,190`; `plan/02-revert-closed.sql:167,196`; `plan/contracts.mjs:5-10`; `plan/00-plan-digests.mjs:15-17`; `lib/startup-mode.ts:1-15`; `AC/estado-offline.md`, apartado pendiente 2.

El plan de apertura hace diferencia bidireccional contra el inventario antiguo de once triggers. Instalar A+C antes de abrir lo hace fallar. El plan de cierre también usa `trigger_diff`: conservar el trigger de completitud A+C impide el cierre preparado. No es solamente actualizar un comentario o SHA: es una incompatibilidad de la condición de autorización.

Además, los tres fingerprints y la revisión de aprobación siguen describiendo funciones/guards anteriores; no comprometen el SQL A+C, sus restricciones, ni el nuevo inventario. El hash de cuerpos de función dentro del preflight ayuda, pero no reemplaza un contrato de aprobación coordinado.

**Corrección:** versionar conjuntamente apertura, cierre operativo, inventario, SQL A+C y aprobación. La apertura debe exigir A+C ya instalado y verificado; el cierre debe aceptar y preservar A+C incluso cuando existan recibos. No solventarlo aplicando primero apertura y después evidencia, pues dejaría un intervalo de permiso DB sin completitud A+C.

**Prueba faltante:** contratos offline de los tres estados, y posteriormente ensayo PostgreSQL autorizado de cierre con evidencia no vacía. El checkpoint reconoce esta reconciliación pendiente; aquí se identifica el bloqueo concreto.

### R3 — Alta: la reversión “antes de captura” tiene una carrera que puede borrar evidencia confirmada

**Referencias:** `AC/02-revert-before-capture-only.sql:3-12,22-24`.

El `IF EXISTS` se ejecuta antes de tomar un lock que excluya a productores. Secuencia posible: una transacción de captura está insertando evidencia aún no visible; el revert ve ambas tablas vacías; `DROP TRIGGER` espera los locks de la captura; la captura confirma con su finalización/prueba; el revert continúa y elimina las tablas ahora no vacías. Los locks obtenidos por DDL después de la comprobación no revalidan aquella observación.

La etiqueta “solo antes de captura” no es una guarda verificable. No afirmo que haya ocurrido: es una carrera deducida del orden de sentencias, pendiente de ensayo aislado.

**Corrección:** exigir cierre operativo y tomar locks adecuados sobre movimientos y tablas de evidencia **antes** de comprobar vacío, con orden compatible con productores. Tras adquirirlos, comprobar el estado cerrado y vacío; mantenerlos hasta fin de transacción. El rollback normal con evidencia nunca debe ejecutar drops.

**Prueba faltante:** productor pausado antes de commit frente a revert; el revert debe rechazar después de esperar, sin pérdida de evidencia.

### R4 — Alta para integridad de atestación: SQL valida coherencia del JSON, no que el abono esté realmente UNUSED

**Referencias:** `lib/credit-abono-evidence.ts:78-101`; `AC/01-install-evidence-prepared.sql:69-112,161-184,197-214`; comparación `refund.sql:61-64`; defensas consumidor `lib/credit-refund.ts:75-88`.

El productor suministra resultado, aplicado y JSON. SQL compara la fuente física/transacción y comprueba que el JSON sea internamente coherente, pero nunca contrasta las asignaciones con `aplicaciones_credito`. Una finalización de un abono nuevo con `UNUSED`, aplicado cero y array vacío satisface todas esas comprobaciones **aunque ya haya una aplicación persistida**. La misma transacción puede también insertar una aplicación después de la finalización: el trigger diferido solo revisa existencia de finalización/prueba.

Esto permite que un productor defectuoso/alterado, o un escritor con permisos de captura, fabrique prueba positiva falsa. No requiere deshabilitar triggers ni ser superusuario para eludir esas comprobaciones, aunque sí acceso de escritura suficiente. El hook TS antiguo rechazado no elimina esta vía en el finalizador nuevo. El consumidor actual conserva comprobación de aplicaciones e historia, por lo que este hallazgo **no equivale por sí solo a una devolución indebida demostrada**.

**Corrección:** cotejar las aplicaciones persistidas del origen y su importe/destinos con la finalización, especialmente rechazo inequívoco de UNUSED con aplicaciones, y repetir invariantes relevantes al commit para cubrir orden invertido. Conservar al proyector canónico como único FIFO; no inventar otro FIFO SQL. Documentar explícitamente qué semántica depende del productor y qué garantiza la base. En el core TS, revalidar la evaluación recibida reduce el riesgo de futuros llamadores que omitan `evaluateAbonoEvidence`.

**Pruebas faltantes:** JSON coherente pero falso frente a aplicaciones reales, finalización antes de aplicación, clasificación alterada, y omisión del productor. Una prueba regex de presencia de `UNUSED` no acredita estas propiedades.

### R5 — Alta: preflight A+C no verifica restricciones esenciales ni diferibilidad

**Referencias:** `lib/limited-startup-preflight.ts:209-239,305-319,336-418`; `AC/01-install-evidence-prepared.sql:5-35,220-223`.

El manifiesto de constraints solo contiene objetos E1. La rama A+C verifica algunos nombres/tipos de columna y cuerpos/metadatos de funciones/triggers; no valida PK, UNIQUE, FK, NOT NULL ni CHECK de las nuevas tablas, tampoco `tgdeferrable`/`tginitdeferred`.

Ejemplo concreto: quitar el CHECK de `resultado/aplicado` de `finalizaciones_abono_e2`, sin tocar sus columnas ni funciones, no cambia ninguna entrada comprobada por A+C. El validador de inserción no valida el resultado contra el aplicado: un resultado `UNUSED` con aplicado positivo y JSON consistente puede pasar y generar prueba. Quitar unicidades/FK tampoco altera los hashes de funciones. Cambiar el constraint trigger a no diferido conserva su tipo y `has_constraint`, pero haría fallar la inserción del movimiento antes de que la aplicación pueda finalizarlo.

Este defecto queda actualmente oculto por R1: corregir el inventario sin completar el manifiesto dejaría una aceptación de catálogos debilitados.

**Corrección:** manifiesto exacto por tabla/OID y definición normalizada de constraints, validación/deferrabilidad, columnas con nullability/precisión/defaults críticos e índices únicos válidos. Verificar ambas propiedades de diferibilidad del trigger y el conjunto completo de triggers en tablas A+C.

**Prueba faltante:** mutar individualmente cada constraint, nulabilidad y propiedad de diferimiento; mantener cuerpos de función intactos y exigir rechazo.

### R6 — Media, integración futura: el consumidor elimina de hecho COBRO_RETENIDO sin retirarlo del contrato

**Referencias:** `lib/credit-refund.ts:13-19,61-66,90-99`; `lib/credit-refund-contract.ts:35-51`; `AC/01-install-evidence-prepared.sql:25-35`; `refund.sql:5-18,81-95`.

El join obligatorio a `finalizaciones_abono_e2` ocurre antes de distinguir origen. Una prueba de cobro retenido del contrato anterior tiene `abono_id NULL` y jamás satisface ese join. La tabla A+C nueva exige abono no nulo y fuente `ABONO:...`, por lo que tampoco puede almacenar retenidos. Quedan expuestos en el código un contrato y una rama que nunca alcanzarían éxito aun con gates abiertos.

Además, ambos SQL crean `evidencia_no_aplicada_e2`: no son instalables juntos. El SQL A+C no crea tablas de disposiciones/devoluciones del consumidor; no constituye por sí solo una instalación de devolución.

**Corrección:** decidir explícitamente alcance ABONO-only (rechazar retenidos desde contrato y retirar hooks no utilizables) o separar/versionar pruebas por tipo de fuente y usar el join A+C solo en ABONO. Consolidar un único plan futuro de devolución sin reintroducir la atestación indiscriminada antigua. No abrir devolución ni retenidos para resolver esta incompatibilidad.

**Impacto actual:** latente, no regresión de un endpoint activo, porque devolución/retención siguen cerradas. El conflicto SQL ya estaba advertido en el checkpoint.

### R7 — Alta operativa, heredada: `pg_catalog.coalesce(...)` no es la expresión SQL `COALESCE`

**Referencias:** `plan/01-apply-limited-cash-abono.sql:54-55,129,231`; `plan/02-revert-closed.sql:53-54,72,91,227`.

Los planes usan una invocación de función calificada `pg_catalog.coalesce`. PostgreSQL implementa `COALESCE` como expresión especial no calificable, no como una función ordinaria de ese nombre en `pg_catalog`. En un catálogo PostgreSQL estándar esas invocaciones no resuelven. Esto afecta tanto la apertura como el cierre, independientemente del nuevo trigger.

**Corrección:** usar `COALESCE(...)` sin calificar, dejando calificadas sus funciones/argumentos cuando corresponda; regenerar contrato revisado. Hallazgo por semántica SQL estática, no error observado contra una base. No se ha comprobado el catálogo real ni se presupone la presencia de una función no estándar creada allí.

## Productores: comprobado y límites

1. **Ordinario:** `routes/clientes.ts:2184-2205,2218-2276` inserta movimiento, carga proyección canónica, filtra por ID exacto, persiste aplicaciones y después finaliza dentro de la misma transacción. `lib/credit-abono-evidence.ts:52-75` clasifica sumas enteras seguras sin otro FIFO. No hallé inversión del orden ordinario.
2. **Dirigido:** `routes/pagos-dirigidos.ts:128-170,174-198` consulta saldo canónico **antes** de insertar y luego persiste la aplicación dirigida antes de finalizar. Evita el falso UNUSED: suministra importe completo y un destino. Sin embargo **no clasifica a partir de una proyección canónica posterior**; construye la asignación con la solicitud y etiqueta el JSON como `projectCreditLedger` (`lib/credit-abono-evidence.ts:93-98`). Esto es una diferencia de contrato/procedencia, no prueba de un importe incorrecto en el flujo normal.
3. La relación dirigida se publica como aprobada después de `apply` (`routes/pagos-dirigidos.ts:355-359,413-422`); el lector canónico descubre dirección mediante esa relación aprobada (`lib/credit-aging-read-model.ts:58-63`). Mover ciegamente una proyección a `apply` antes de aprobar no resolvería la procedencia. Además, el núcleo reserva importes dirigidos separadamente y no los devuelve como asignaciones FIFO (`lib/credit-allocation.ts:281-292,327-332,418`). Si el requisito estricto es “ambos después de proyección canónica”, hay que exponer un resultado canónico dirigido explícito y finalizar después de publicar la relación, no filtrar sin más `projection.allocations`.
4. Transferencias/medios no cubiertos evitan la escritura A+C (`lib/credit-abono-evidence.ts:83-87`). La evaluación se construye antes de llamar al helper en ambos productores, pero no hallé un caso válido ordinario de esos medios que demuestre fallo nuevo por ello.
5. Replays ordinarios devuelven la respuesta auditada antes de crear otra finalización (`routes/clientes.ts:2191-2199`); no se propone backfill de recibos antiguos.

## Defensas conservadas y límites de seguridad

- Gate A+C constante cerrado (`lib/credit-abono-evidence.ts:9`); devolución constante cerrada (`lib/credit-refund-contract.ts:4`). Modo de arranque exige paridad ingreso/evidencia y EXPLICIT_LIMITED para ingreso. `artifacts/api-server/src/index.ts:159-176` conecta el flag a preflight.
- La devolución exige ADMIN activo, acceso vigente, sesión actual, locks de cliente, prueba positiva y verificaciones adicionales de origen/historia (`lib/credit-refund.ts:31-100`). Mantiene rechazo E1 antes de salida, reserva exclusiva de fuente y escritura transaccional (`:100-124`). No encontré en esta lectura un bypass directo nuevo que habilite dinero físico con gates cerrados.
- Las tablas A+C son append-only frente a UPDATE/DELETE/TRUNCATE y SQL enlaza cliente, importe, productor y operación con la fuente nueva; no hay backfill en el script. Estas defensas no sustituyen la comparación de aplicaciones de R4.
- Los permisos efectivos del rol DB, aislamiento/concurrencia de todos los demás escritores y comportamiento de `xmin` con subtransacciones no se han verificado. El finalizador es invoker, no SECURITY DEFINER: EXECUTE público por defecto no concede por sí solo acceso de tabla. No se afirma una escalada de privilegios por ese dato.
- Las verificaciones históricas del consumidor reutilizan el proyector canónico, pero esta lectura no demuestra completitud temporal para todas las combinaciones de movimientos retrofechados, reversos y otros escritores. Requiere pruebas de historia y concurrencia separadas.

## Qué acreditan y qué no acreditan las pruebas actuales

`lib/credit-abono-evidence.test.ts:75-103` comprueba orden por búsqueda de texto y presencia de joins/flags. No ejecuta productores reales ni demuestra semántica canónica dirigida. `lib/limited-startup-preflight.test.ts:183-193` prueba A+C habilitado con columnas ausentes; el happy path mostrado sigue siendo catálogo antiguo (`:195-202`). `AC/offline-structural-tests.mjs` usa regex sobre SQL, no valida semántica de triggers, constraints o locks.

Prioridad recomendada: R1/R2 y contrato de rollback; R3/R4/R5 con negativos; reconciliación R6 y R7; después revisión del candidato congelado. Solo con autorización separada: instalación y cierre PostgreSQL aislados, commit diferido, fallo/rollback, replay, concurrencia y catálogo drifted. Ningún resultado de esta revisión autoriza activación, ejecución SQL ni reapertura de captura/devolución.

## Reconfirmación independiente del working tree reconciliado — 2026-09-19

Segunda lectura solicitada tras `reconciliacion-offline-20260919.md`. Se examinaron los cambios reales, no solo el informe del trabajador. No se ejecutaron pruebas ni SQL, ni se importaron entrypoints. Se calcularon únicamente SHA-256 de archivos con `sha256sum`. Esta sección actualiza estados sin borrar el diagnóstico histórico anterior. El árbol sigue en edición paralela: la aceptación solo corresponde a los bytes identificados abajo.

### Estados

| Hallazgo | Estado independiente de fuente | Evidencia actual |
|---|---|---|
| R1 | **Corregido estáticamente** | `lib/limited-startup-preflight.ts:364-374` detecta tablas conservadas aun con flag cerrado; `:419-465` valida A+C; `:517-525` excluye únicamente el trigger de movimiento ya validado antes de exigir once E1. |
| R2 | **Corregido para el conflicto identificado, sin aceptación operativa** | Ambos planes incluyen los cinco triggers A+C, validan cuerpos/metadatos de funciones y requieren esquema compartido. Apertura `plan/01-apply-limited-cash-abono.sql:78-82,112-145,239`; cierre `plan/02-revert-closed.sql:176-197,242`. V3 incorpora cuatro hashes de artefactos además de los tres históricos; el generador comprueba los bytes de esos cuatro archivos. |
| R3 | **Corregido estáticamente para la carrera descrita** | `AC/02-revert-before-capture-only.sql:3-25` bloquea movimientos y ambas tablas antes de comprobar guard cerrado y vacío. La comprobación ahora ocurre después de esperar capturas en curso; no hay CASCADE. No se ha ensayado concurrencia real. |
| R4 | **Corrección sustancial; cierre condicionado al modelo de escritor** | `AC/01-install-evidence-prepared.sql:112-132` compara asignaciones declaradas/persistidas en ambas direcciones; `:230-250` repite comparación y rechazo de reverso en evento diferido. Corrige exactamente el falso UNUSED con aplicaciones anteriores y las inserciones posteriores cuando el evento queda diferido hasta commit. Véase límite adicional debajo. |
| R5 | **Corregido estáticamente en el alcance solicitado** | Manifiesto de 19 constraints y 17 columnas; `lib/limited-startup-preflight.ts:384-417` valida nulabilidad, defaults, precisión, definición/validación de constraints e índices; `:453-455` comprueba diferibilidad inicial; inventario A+C incluye extras de sus tablas. SQL compartido `AC/03-preflight-schema-prepared.sql:3-74` verifica el mismo contrato de tablas. Renderizado PostgreSQL exacto aún no demostrado. |
| R7 | **Corregido estáticamente** | Búsqueda en ambos planes no encuentra `pg_catalog.coalesce`; las expresiones ahora usan `COALESCE` sin calificar. No se ha validado el resto de la sintaxis ejecutando PostgreSQL. |
| R6 | **Abierto en fuente de consumidor observada** | El SQL reconciliado es ABONO-only, pero `lib/credit-refund.ts` aún contiene el join incondicional y el attester retenido que llama una función SQL eliminada. El contrato TS continúa admitiendo retenidos. Corrección del coordinador pendiente. |

### Límite residual de R4: adelantar un constraint trigger no equivale a garantizar estado al commit

El comentario actual “Recheck at commit” en `AC/01-install-evidence-prepared.sql:230` presupone que nadie ejecuta `SET CONSTRAINTS ... IMMEDIATE`. Un escritor con los permisos normales necesarios para capturar y aplicar puede:

1. Insertar abono y finalizarlo UNUSED sin aplicaciones.
2. Forzar la ejecución del constraint trigger pendiente mediante `SET CONSTRAINTS ... IMMEDIATE`; la comprobación pasa.
3. Insertar después una aplicación para ese abono y confirmar.

No se genera un segundo evento en `movimientos_credito` por insertar en `aplicaciones_credito`; por tanto la nueva comparación no se vuelve a ejecutar. No hace falta deshabilitar triggers. Es una deducción estática del diseño, **no una prueba ejecutada**, y no se ha encontrado ese `SET CONSTRAINTS` en los productores revisados.

Para el flujo actual de aplicación que mantiene los constraints diferidos, R4 está corregido. Para afirmar una garantía DB contra productores alterados/escritores directos, **R4 sigue parcial**. Solución: control de escritura de aplicaciones que valide o programe de nuevo la comprobación cuando el abono/finalización pertenecen a la transacción de captura; no bloquear aplicaciones legítimas de transacciones futuras ni recalcular FIFO en SQL. Debe diseñarse explícitamente cómo distinguir captura actual e historia inmutable. Otra opción es declarar y asegurar técnicamente un único escritor confiable sin acceso SQL arbitrario; no presentar entonces el trigger como garantía universal frente a cualquier orden de escritura.

### R6: coherencia de alcance y solución mínima

El SQL actual (`refund.sql:1-9,17-30`) define explícitamente:

- Una única prueba A+C de ABONO, con `abono_id NOT NULL` y fuente `ABONO:...`.
- Devolución con `reverso_id NOT NULL` y fuente ABONO.
- Ninguna tabla de prueba retenida ni `e2_attest_new_retained`.
- Cierre E2R01 independiente; no es un permiso nuevo para devolver.

Es internamente coherente **como módulo futuro ABONO-only**, pero no preserva el contrato previamente preparado ABONO + COBRO_RETENIDO. Eliminar duplicidad del dueño de la tabla A+C no requería necesariamente retirar todo el contrato retenido: esa reducción es una decisión de alcance que debe aprobar el coordinador, no declararse corrección transparente de R6. Con captura/retención/devolución cerradas no rompe una devolución activa; sí rompe compatibilidad de interfaces preparadas.

**Solución mínima coherente con el SQL actual (si se acepta ABONO-only):**

1. Mantener el gate de devolución como primera defensa. Antes de abrir transacción o buscar prueba, rechazar explícitamente `COBRO_RETENIDO` como “fuera del contrato preparado A+C; requiere preparación/autorización separada”. El contrato/parser puede restringirse a ABONO o preservar el valor legado únicamente para emitir ese error explícito; no debe prometer ejecución retenida.
2. La consulta con join a finalización debe ser una consulta **del caso ABONO**, no un requisito genérico aplicado a ambas fuentes. Retirar la rama retenida de ejecución o dejar rechazo explícito; no sustituir el join por LEFT JOIN que parezca permitir una prueba retenida inexistente.
3. Retirar el attester retenido sin llamadores, o convertirlo en rechazo explícito similar al antiguo attester ABONO. No conservar una llamada a `e2_attest_new_retained` que ya no será instalada.
4. Alinear contrato/OpenAPI/documentación de opciones y pruebas de fuentes para explicar la restricción. Las opciones documentales pueden seguir mostrando referencias retenidas si aclaran que no son elegibilidad para ejecución A+C.

**Si se exige preservar la preparación retenida original**, no basta con condicionar el join: hace falta conservar/preparar una prueba positiva retenida distinta o una extensión tipada, su productor nuevo en la misma transacción, y un contrato de disposición/devolución que admita esa fuente sin reverso ABONO. El consumidor debe elegir prueba según origen: ABONO requiere finalización UNUSED; retenido requiere su propia prueba positiva. Mantener todas las guardas cerradas. Es un cambio SQL/contrato mayor, requiere rehacer fingerprints, y no debe improvisarse como parte del parche mínimo A+C.

### Huellas de los bytes revisados en esta segunda lectura

| Archivo | SHA-256 |
|---|---|
| `lib/limited-startup-preflight.ts` | `7d191e3a886a76c846abd2a724111d1718dc4b115a73446028eae90829938e10` |
| `lib/startup-mode.ts` | `ecf9ced39bcc4efe9970813779ad74534e347f536959d3c5c327f69482ab37ce` |
| `lib/credit-refund.ts` (antes de corrección del coordinador) | `8b5194789d9ff508eb34429c2b7a6d2fee5e0ad818bb597c7b2217bfca5309da` |
| `lib/credit-refund-contract.ts` | `0e3506e9f402a6af1332a88c82b9fcd281b6537709a15edabd9af8f0de34d5f1` |
| `AC/01-install-evidence-prepared.sql` | `1b9a439fc6d06085f01e76461ee94339440a727baca37a9e11034ef85a8e15ff` |
| `AC/02-revert-before-capture-only.sql` | `5dcc699fd60ca810d36976932c794a109fc195fb6d8b6b2d36217ab3e3b171e7` |
| `AC/03-preflight-schema-prepared.sql` | `0c6045ff96d25996ba626b760f679503d01f4d8a4e3354972adf99aa5a7b90c7` |
| `plan/01-apply-limited-cash-abono.sql` | `fd3b07dbd99835690c9543bbb6df4a28ed19bae69a2b4db01f352cb2f58e0380` |
| `plan/02-revert-closed.sql` | `4e196a75301c9abc7d1382374610be408cbe2c447081f456c84e9124707cb5d4` |
| `plan/contracts.mjs` | `5b370a16ab57d5787d2a8ceb2e10556c46268e4f5862ae464e423f28e8fd9957` |
| `plan/00-plan-digests.mjs` | `38bbb142b9071a7fe22f56f3604d6a7862695485a0d92be7739dd6f1cddccf41` |
| `refund.sql` | `2a764414a558485a3f35b2e2647fe6803dfb40911316dab826c739ff98969c86` |

Los cuatro hashes de artefactos coinciden visualmente con los fijados en V3. No se ejecutó el generador ni ninguna suite. Las observaciones sobre productor dirigido de la primera revisión no fueron corregidas por estos cambios SQL y siguen como límite de procedencia/contrato. **Resultado global: preparación mejorada, R6 pendiente y garantía fuerte R4 aún limitada; no autorización de apertura ni acreditación PostgreSQL.**

## Reconfirmación final focalizada — SQL congelado comunicado por coordinador

**Dictamen terminal de esta revisión focalizada: R4 y R6 corregidos en fuente para los casos identificados; no se identifica un nuevo bypass de clasificación/prueba por la restauración retenida. R1/R2/R3/R5/R7 conservan sus correcciones estáticas y los nuevos hashes están coordinados. Apto para cerrar estos hallazgos de revisión offline, NO para activar ni afirmar validación PostgreSQL.**

Esta conclusión sustituye los estados “R4 parcial” y “R6 abierto” de la segunda lectura, exclusivamente para los bytes de esta sección. No borra los límites de procedencia del productor dirigido ni convierte las pruebas previas ajenas en pruebas ejecutadas por este revisor.

### R4 — orden de aplicaciones de la captura

- `AC/01-install-evidence-prepared.sql:122-142` conserva comparación bidireccional de destinos/importes persistidos frente al JSON; `:279-298` conserva revalidación diferida y rechazo de reverso encontrado.
- El nuevo trigger `e2_capture_application_order` (`:317-340`) se ejecuta BEFORE INSERT sobre aplicaciones. Si el movimiento origen pertenece a la transacción actual y ya tiene finalización, rechaza la nueva aplicación. Cierra el contraejemplo específico `finalizar → SET CONSTRAINTS IMMEDIATE → insertar aplicación`: el rechazo ya no depende de que quede un evento diferido pendiente.
- Una aplicación previa a la finalización sigue permitida; una posterior en otra transacción no se bloquea por este guard. No se añade otro FIFO ni una reclasificación de la historia.
- Se conserva el CHECK no nullable que enlaza UNUSED/PARTIAL/FULL con aplicado (`:10-22`) y la prueba ABONO sigue necesitando finalización UNUSED (`:180-189`). No hay ruta nueva para convertir PARTIAL/FULL en prueba positiva.
- Alcance: integridad de aplicaciones persistidas durante la captura, con invariantes E1/append-only existentes. No equivale a una prueba general contra un administrador que altera triggers, TRUNCATE, otros cambios de esquema o todas las posibles escrituras contables. Tampoco la existencia histórica de prueba certifica elegibilidad actual: el consumidor debe seguir rechazando aplicaciones/reversos posteriores.

### R6 — contrato retenido restaurado sin debilitar ABONO

- `AC/01-install-evidence-prepared.sql:25-45`: prueba tipada disjunta. ABONO exige `abono_id IS NOT NULL` y ambos campos retenidos NULL. Retenido exige `abono_id IS NULL`, productor **IS NOT NULL**, UUID **IS NOT NULL**, productor exacto y prefijo/fuente exactos.
- **Revisión de CHECK/NULL:** `fuente` es PK no nula. En el brazo retenido no se depende de una comparación `cobro_productor = ...` nullable para rechazar: hay comprobaciones explícitas IS NOT NULL. Un UUID sin productor, productor sin UUID, origen todo NULL u origen mixto no satisface el CHECK. La FK compuesta queda respaldada por esa exclusividad; no hay una combinación parcial nula aceptada como retenido.
- `:162-178` exige fuente retenida física, efectivo, caja, sesión, mismo cliente/importe y transacción nueva. `:198-214` restaura `e2_attest_new_retained`, con error si falta el origen; no crea ABONO ni backfill. La rama ABONO continúa exigiendo la finalización UNUSED, no usa el validador retenido como alternativa.
- `lib/credit-refund.ts:61-76` selecciona explícitamente por origen: ABONO usa INNER JOIN obligatorio UNUSED e ID exacto; retenido usa prueba positiva con abono nulo, productor/UUID exactos. `:85-98` conserva aplicaciones, reversos y proyección histórica ABONO; `:100-108` conserva validación del cobro original. Por tanto se restaura el contrato retenido original sin LEFT JOIN permisivo para ABONO.
- `refund.sql:17-31`: `reverso_id` vuelve a ser nullable **solo para fuente retenida**, según CHECK disjunto. `fuente NOT NULL` impide aceptación por UNKNOWN; ABONO exige reverso no nulo y retenido exige nulo. Las FK a movimientos y disposición permanecen.
- **Reverso:** el diff no elimina `validate_credit_reversal` ni las guardas E1. El consumidor continúa creando el reverso ABONO con el origen, cliente e importe exactos (`lib/credit-refund.ts:115-123`); retenido no inventa reverso. No se afirma que la nueva tabla de devolución por sí sola valide toda la semántica de ese reverso: conserva la dependencia del productor y validadores financieros existentes.
- Las guardas E1P01 y devolución permanecen cerradas; SQL de devolución añade cierre E2R01 independiente. Restaurar una función preparada no la conecta a un endpoint de captura ni abre permisos.

### Consistencia de instalación, preflight, reversión y hashes

Se leyó el nuevo contrato de 19 columnas, 21 constraints, seis triggers y siete funciones. El manifiesto permite NULL únicamente en los tres campos alternativos de origen de prueba; no relaja nulabilidad de las finalizaciones. El nuevo trigger y el attester están incluidos en preflight y en ambos planes. La reversión pre-captura toma además locks de aplicaciones/retenciones y elimina los nuevos objetos en orden, conservando el chequeo vacío previo a DROP y sin CASCADE.

Además de `sha256sum`, se hizo un cálculo puramente local de SHA-256 de los siete cuerpos `$function$` del SQL y búsqueda de cada digest en el preflight TS y en ambos planes: los siete coinciden en los tres consumidores. No se importó código de la aplicación ni se ejecutaron suites, SQL o generadores.

| Archivo final leído | SHA-256 |
|---|---|
| `AC/01-install-evidence-prepared.sql` | `f2143b5945d03eb33be444fcf58a3efd481afecc7fe9275e927469964689b457` |
| `AC/02-revert-before-capture-only.sql` | `522f8bac6d8b78e2eee158e47249aac8e8fac264cabd64546b00b6f3bf7ae4bc` |
| `AC/03-preflight-schema-prepared.sql` | `f5870c20276001bd2c8269e534b2ef696217e13087a27cd350127ce8dfa9b5d2` |
| `refund.sql` | `1bb36ac4eddd07d54e28686b83a3ded3d98b115e4190fbce6e97a11c7576587d` |
| `lib/credit-refund.ts` | `04f40603037fbd01e56491d320272798599f936a878515e02e0e881c5ee2ae8d` |
| `lib/limited-startup-preflight.ts` | `261b36fb870b4b01459dc39d898f556ed58cf777c2228367990d7bd8e23b3680` |
| `lib/startup-mode.ts` | `3965797015a00f191ef90892ef7a10b935aa799eee08b21fcc27933682c0ee52` |
| `plan/01-apply-limited-cash-abono.sql` | `added872e66f600c0cc70894146d98258bbb43dfdb51e1d03ad1b2bef81580f8` |
| `plan/02-revert-closed.sql` | `fa7449f49bcc5434247e590bff274e7c0e57dbf873c3a88d8bd3783a8b299b5b` |
| `plan/contracts.mjs` | `e305eaed7f1137a38763b2d90f70b912e82be84c8c8c3c37d050a6c72c05feee` |
| `plan/00-plan-digests.mjs` | `38bbb142b9071a7fe22f56f3604d6a7862695485a0d92be7739dd6f1cddccf41` |

Los cuatro hashes de artefactos coinciden exactamente con `startup-mode.ts`, `contracts.mjs` y los materiales de digest de ambos planes.

### Pendiente exclusivamente fuera de esta acreditación offline

Con autorización posterior, PostgreSQL aislado debe confirmar: sintaxis/instalación/desinstalación, nombres y renderizado exacto de `pg_get_constraintdef`, funciones/triggers efectivos y permisos; commit diferido y `SET CONSTRAINTS IMMEDIATE`; rollback atómico de fallos; orden de locks/concurrencia; comportamiento de `xmin`/transaction ID y subtransacciones; rechazo de mixtos/NULL y pruebas retenidas viejas; aplicaciones legítimas de transacciones futuras; replay y exclusión mutua de disposición. No se ha medido ni observado nada de ello aquí. **No hubo DB, red, HTTP, runtime, build, ejecución de pruebas ni modificación de implementación por el revisor.**

## Cierre final de observación de procedencia dirigida

**Corregida en fuente y aclarada en diseño.** Esta sección sustituye la reserva anterior sobre procedencia del productor dirigido; no reabre ni amplía la revisión financiera.

- `lib/credit-abono-evidence.ts:88-105` exige FULL/importe aplicado íntegro para dirigido y registra `directedApplication`; el ordinario conserva `projectCreditLedger`. No introduce reparto ni proyección adicional.
- `AC/01-install-evidence-prepared.sql:93-110` deriva el discriminador esperado de `source_producer`, leído del movimiento validado, y exige al dirigido FULL/aplicado igual al importe de origen. No confía únicamente en el productor declarado por el llamador. La comparación exacta con aplicaciones persistidas permanece (`:127-146`).
- `reports/e2-apertura-limitada/diseno-a-c-antes-de-implementar.md:16,27,58` aclara expresamente ambas procedencias y conserva el reparto existente, sin atribuir al dirigido una proyección posterior inexistente.
- La prueba nueva (`lib/credit-abono-evidence.test.ts:59-81`) cubre UNUSED, PARTIAL y FULL incoherente rechazados, además de la etiqueta dirigida correcta. Se leyó; **no se ejecutó**.

Huellas finales calculadas localmente:

| Artefacto | SHA-256 |
|---|---|
| Servicio A+C | `7ce0967733c4fd61b09db804cb4231ec080236bb26b7861e145f157fdb93893e` |
| Prueba del servicio | `c147a6cf5f1a91ad5ee56927d206ce9c15e77283816a37b6cc555693fed6013a` |
| Diseño aclarado | `5d5c904108129d8617a7fcf371f7246f31abbea287f332011bac28839f30daca` |
| SQL instalación A+C | `dd99574f022b4d325a73238bf0d1e348e015003d2dad3ebc9de00ede8b094cbd` |
| Cuerpo de `e2_validate_abono_finalization` | `73a3e2b84fb480448080addfd4af98fed85cbff459caddebce5c64d9ad1bb2cc` |

El hash nuevo de instalación está coordinado en startup, contrato y ambos planes. El cuerpo nuevo se recalculó desde el SQL y coincide con preflight y ambos planes. Reversión, esquema compartido y SQL de devolución conservan exactamente los tres hashes de la sección final previa (`522f8bac…ae4bc`, `f5870c20…9b5d2`, `1bb36ac4…6587d`).

**Veredicto final: observación de procedencia cerrada offline; no queda esta reserva de diseño/etiquetado pendiente.** Sin cambio de la conclusión de no autorización de apertura y de las limitaciones PostgreSQL ya enumeradas. Ninguna implementación fue modificada por el revisor; únicamente se añadió esta constancia al informe permitido.