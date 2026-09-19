# Reconciliación OFFLINE A+C / devolución / activación — 2026-09-19

## Alcance y límites

Preparación de fuentes exclusivamente. **Captura y devolución continúan apagadas.**
No se accedió a ninguna base (ni lectura), no se ejecutó SQL/PostgreSQL, no hubo
red, reinicios, builds, cambios de bundle/dist, flags, entorno, instalación de
dependencias ni commits. No se modificaron productores, servicio A+C, servicio
de devolución ni sus pruebas. Revisión independiente final pendiente del agente
coordinador; este informe no constituye aceptación operativa.

Se leyeron primero estado-offline.md y las memorias inactive-physical-refund-scope,
database-capture-gates y explicit-test-manifests. Se inventariaron los tres grupos:
SQL de devolución anterior, SQL A+C y contratos/preflight de apertura y cierre.
Después se leyó revision-independiente-offline-20260919.md.

## Decisiones y correcciones

- **Dueño único:** 01-install-evidence-prepared.sql crea evidencia_no_aplicada_e2
  con variantes disjuntas ABONO y COBRO_RETENIDO. El SQL de devolución ya no crea
  esa tabla. Se conserva el alcance preparado original: ABONO exige finalización
  UNUSED; retenido exige recibo físico nuevo de la misma transacción y FK
  compuesta. e2_attest_new_retained(uuid) permanece unattached/futuro/inactivo.
  La reducción ABONO-only de la primera entrega fue retirada por instrucción
  del coordinador; este informe actualizado sustituye aquella conclusión.
- La instalación de devolución depende de A+C y agrega únicamente disposición,
  devolución e inmutabilidad/cierre propios. Un cierre incondicional E2R01 bloquea
  INSERT de disposición y devolución, independiente del futuro guard de ingreso
  limitado. No se retira ninguna guarda E1.
- **R1:** preflight detecta evidencia conservada aun con opción apagada, la exige
  cuando guardState es LIMITED y valida el inventario combinado. Solo excluye de
  la cuenta E1 el trigger A+C exacto después de validarlo; extras fallan.
- **R2:** PLAN_V3 y e2-limited-readonly-v3 coordinan apertura, cierre operativo,
  A+C y devolución preparada. Siete fingerprints: tres históricos y cuatro
  artefactos actuales. El generador offline verifica bytes antes de producir el
  digest. Ambos planes aceptan/exigen los seis triggers A+C, los cuerpos y
  metadatos de sus siete funciones, y el esquema compartido antes de reemplazar
  la guarda. La reversión operativa conserva íntegra la evidencia.
- **R3:** reversión destructiva solo pre-captura toma locks exclusivos sobre
  movimientos y evidencia ANTES de validar el cierre E1 y el vacío. No usa
  CASCADE. Si existe dependencia de devolución instalada, DROP falla y revierte
  la transacción; no se ofrece desinstalación automática de esa dependencia.
- **R4:** finalización coteja los destinos e importes declarados contra
  aplicaciones_credito persistidas, con diferencia bidireccional. Rechaza
  reversos del origen. Repite el cotejo en el trigger diferido del movimiento,
  cubriendo aplicación insertada después de finalizar mientras el evento siga
  diferido. Tras reconfirmación independiente se agregó el trigger BEFORE INSERT
  e2_capture_application_order: si el ABONO nació en la transacción actual y ya
  tiene finalización, rechaza otra aplicación inmediatamente. Así no depende
  de que SET CONSTRAINTS IMMEDIATE haya drenado el evento del movimiento.
  Aplicaciones de transacciones futuras no son bloqueadas por este nuevo guard.
  UNUSED con aplicaciones anteriores tampoco satisface el cotejo. Esto NO
  implementa otro FIFO: orden/semántica canónica continúan siendo responsabilidad
  del productor/proyector. El guard usa la misma identificación xmin/txid del
  contrato existente; subtransacciones/semántica real requieren ensayo autorizado.
- **R5:** preflight coteja las 19 columnas con nulabilidad, precisión/escala y
  defaults; las 21 restricciones con identidad por tabla, definición,
  validación/diferibilidad e índices únicos válidos/listos; inventario completo
  de triggers A+C, schema de función y ambas propiedades de diferimiento.
  03-preflight-schema-prepared.sql replica ese contrato antes de apertura/cierre;
  prueba offline verifica paridad de definiciones TS/SQL.
- **R7:** todos los pg_catalog.coalesce de los planes fueron sustituidos por
  COALESCE no calificado.
- **R6:** se preserva ABONO + COBRO_RETENIDO. reverso_id vuelve a nullable:
  obligatorio para ABONO, nulo para retenido. El coordinador posee el consumidor/
  contrato HTTP; no se modificó en esta tarea. E1P01 y E2R01 siguen cerrando
  retención/devolución; restaurar el attester preparado no conecta un productor.

## Verificación ejecutada

Imports revisados: los scripts estructurales usan solo módulos Node locales;
las dos suites TS importan preflight/startup-mode puros, drizzle-orm sin cliente
de conexión y fixtures locales. Sus pools son simulados; no se importa el
entrypoint ni un cliente PostgreSQL.

Manifiesto exacto ejecutado:

1. node reports/e2-apertura-limitada/evidencia-a-c/offline-structural-tests.mjs
2. node reports/e2-apertura-limitada/sql/offline-structural-tests.mjs
3. node --import ./scripts/node_modules/tsx/dist/loader.mjs --test artifacts/api-server/src/lib/limited-startup-preflight.test.ts artifacts/api-server/src/lib/startup-mode.test.ts
4. git diff --check

Resultados: estructurales PASS; 10 copias negativas léxicas detectadas;
**14/14 tests TS PASS**, incluidos cerrado sin evidencia, cerrado conservado,
LIMITED con evidencia obligatoria y 44 mutaciones individuales de catálogo
(21 definiciones, 19 nulabilidades, dos propiedades diferidas, dos extras).
Los estructurales también detectan dos copias negativas del nuevo guard
(omisión de alcance de transacción y cambio del trigger BEFORE).
No descubrimiento implícito de tests ni CLI tsx con IPC.

Estas pruebas NO acreditan semántica PostgreSQL, instalación, representación
efectiva de pg_get_constraintdef, locks, commit diferido o concurrencia. El
contrato de definiciones es estricto y falla cerrado; confirmar su renderizado
real exige una prueba PostgreSQL aislada con autorización posterior, no relajar
checks silenciosamente. No se hizo typecheck completo en esta tarea.

## Hashes y coordinación

SHA-256 fijados por contracts.mjs y startup-mode.ts:

- A+C instalación: dd99574f022b4d325a73238bf0d1e348e015003d2dad3ebc9de00ede8b094cbd
- Reversión pre-captura: 522f8bac6d8b78e2eee158e47249aac8e8fac264cabd64546b00b6f3bf7ae4bc
- Devolución preparada: 1bb36ac4eddd07d54e28686b83a3ded3d98b115e4190fbce6e97a11c7576587d
- Esquema compartido: f5870c20276001bd2c8269e534b2ef696217e13087a27cd350127ce8dfa9b5d2

El hash del módulo de devolución no afirma que esté instalado ni habilitado.
Las aprobaciones V2 anteriores son inválidas para este candidato; no se cambió
ninguna aprobación o variable de entorno real.

Para el trabajador de negativos: ABONO_EVIDENCE_CONSTRAINTS está exportado;
el mock necesita is_nullable/numeric_precision/numeric_scale/column_default,
consulta de constraints con index_valid y flags convalidated/condeferrable/
condeferred, y function_schema/tgdeferrable/tginitdeferred. La consulta de columnas
A+C ahora es incondicional para detectar estado cerrado-conservado; la validación
completa depende de presencia, opción o guardState LIMITED.
ABONO_EVIDENCE_NULLABLE_COLUMNS exporta abono_id/cobro_productor/cobro_clave:
solo esas columnas de evidencia_no_aplicada_e2 son nullable; el abono_id de
finalizaciones_abono_e2 permanece NOT NULL. Hay un sexto trigger sobre
aplicaciones_credito. Las consultas de funciones void ahora usan p.proname=$1
con e2_finalize_new_abono o e2_attest_new_retained; el mock debe propagar values.
El attester retenido espera identity_arguments = p_clave uuid.

## Lista exacta de archivos propios

1. artifacts/api-server/src/lib/limited-startup-preflight.ts
2. artifacts/api-server/src/lib/limited-startup-preflight.test.ts
3. artifacts/api-server/src/lib/startup-mode.ts
4. reports/e2/sql/credit-refunds-prepared.sql
5. reports/e2-apertura-limitada/sql/00-plan-digests.mjs
6. reports/e2-apertura-limitada/sql/01-apply-limited-cash-abono.sql
7. reports/e2-apertura-limitada/sql/02-revert-closed.sql
8. reports/e2-apertura-limitada/sql/contracts.mjs
9. reports/e2-apertura-limitada/sql/offline-structural-tests.mjs
10. reports/e2-apertura-limitada/evidencia-a-c/01-install-evidence-prepared.sql
11. reports/e2-apertura-limitada/evidencia-a-c/02-revert-before-capture-only.sql
12. reports/e2-apertura-limitada/evidencia-a-c/03-preflight-schema-prepared.sql (nuevo)
13. reports/e2-apertura-limitada/evidencia-a-c/offline-structural-tests.mjs
14. reports/e2-apertura-limitada/evidencia-a-c/reconciliacion-offline-20260919.md (este informe)
15. reports/e2-apertura-limitada/evidencia-a-c/reconciliacion-offline-20260919-terminal.log (salida terminal conservada)
16. reports/e2-apertura-limitada/diseno-a-c-antes-de-implementar.md (aclaración de procedencia ordinaria/dirigida solicitada)

## Última aclaración de procedencia dirigida

El validador SQL elige el projector por source_producer leído del movimiento,
no por una declaración independiente del llamador: ABONO_ORDINARIO exige
projectCreditLedger; ABONO_DIRIGIDO exige directedApplication, FULL y aplicado
igual al importe íntegro leído de origen. Permanece el cotejo exacto de
aplicaciones persistidas y no hay otro FIFO ni cambio al reparto. Se conserva
v1 por tratarse de un contrato preparado/inactivo; los hashes V3 se refrescaron.
Se corrigieron las líneas de diseño que atribuían una proyección posterior al
dirigido. Cinco negativos estructurales adicionales detectan productor tomado
de NEW, etiqueta dirigida/ordinaria intercambiada, ausencia de FULL o ausencia
de importe íntegro. La prueba no ejecuta SQL ni acredita comportamiento PG.

La reconfirmación anterior descubrió el bypass IMMEDIATE y la reducción de
alcance; ambos motivaron esta segunda entrega. Falta aceptación independiente
de estas últimas correcciones y consolidación de
negativos/typecheck por el coordinador. Ningún PASS offline autoriza apertura.