# Negativos A+C OFFLINE — 2026-09-19

## Resultado FINAL tras congelación de procedencia dirigida

**PASS: 428/428 tests; 24/24 mutantes rechazados; 24/24 restauraciones verdes.**
Runner exit 0. Son **49 procesos** (baseline + 24 rojos + 24 verdes), sin
contar la comprobación separada de selección faltante (exit 1 esperado).
Esta sección sustituye los conteos/hashes del checkpoint histórico de abajo.

Comando exacto:

```sh
node reports/e2-apertura-limitada/evidencia-a-c/negative-offline-runner.test.mjs
```

Snapshot definitivo: `/tmp/e2-negative-offline-axTitg`.
**Logs completos copiados al repositorio**, no solo referencias temporales:
`reports/e2-apertura-limitada/evidencia-a-c/negativos-offline-logs-20260919/`.
Contiene `baseline.log`, los 48 logs de mutación/restauración, `results.json`
(49 estados terminales), `inputs-sha256.json` (14 entradas allowlisted) y
`missing-selection.log`.

### Inventario y casos finales

- **19 columnas / 21 restricciones / 6 triggers / 7 funciones**.
- **421 drifts independientes**: 82 de columnas, 147 de restricciones, 192
  de triggers/funciones. Cada drift parte del catálogo válido y comprueba
  rechazo semántico, ausencia de COMMIT, ROLLBACK y release.
- Tres columnas nullable únicamente en `evidencia_no_aplicada_e2`, verificadas
  individualmente en ambas direcciones de nulabilidad.
- Las dos consultas de funciones void propagan sus `values`: finalizador ABONO
  y `e2_attest_new_retained`, esta última con `identity_arguments=p_clave uuid`.
- Nuevo trigger `e2_capture_application_order` sobre `aplicaciones_credito`,
  tipo 7 y no diferido: existencia, definición/metadatos, flags y hash del
  cuerpo de `e2_guard_finalized_capture_application` alterados individualmente.
- Baselines de preflight tanto con evidencia requerida como con opción
  apagada/evidencia conservada (descubrimiento incondicional).
- Se mantienen ambos handlers productivos **montados**, con clasificación
  UNUSED/PARTIAL/FULL y orden respecto de FIFO/persistencia.
- Procedencia del core productivo: ordinario `projectCreditLedger`, dirigido
  `directedApplication`. El core rechaza antes de persistir resultado dirigido
  UNUSED/PARTIAL, FULL con importe aplicado distinto de recepción y resultado
  PARTIAL aun cuando los importes coincidan. Cinco mutantes adicionales
  demuestran las dos procedencias y los controles de resultado/importe por
  separado, además de la omisión del guard completo.
- Servicio real de devolución: aceptación de **ambos orígenes** con su propia
  prueba, un egreso y reverso solo para ABONO. ABONO sin finalización o con
  PARTIAL/FULL se rechaza; retenido sin prueba propia se rechaza. Todos los
  almacenes/pools son mocks, sin driver ni conexión.
- R4: una prueba y un mutante **LEXICALES**, explícitamente rotulados como
  tales, comprueban declaración y rechazo del guard de aplicación posterior a
  finalización. **No confirman semántica PostgreSQL ni el escenario real
  SET CONSTRAINTS IMMEDIATE**, que sigue pendiente de autorización DB.

Siete tests superiores + 421 subtests = 428; baseline y cada restauración
reportaron 428 pass, 0 fail, 0 skipped, 0 cancelled.

### Los 24 mutantes finales

Para cada identificador siguiente existe `<identificador>.log` (exit 1) y
`<identificador>-restored.log` (exit 0) en el directorio de logs:

1. `ordinary-producer-omitted`
2. `directed-producer-omitted`
3. `classification-altered`
4. `directed-classification-altered`
5. `partial-classification-altered`
6. `directed-before-application`
7. `before-fifo`
8. `missing-positive-proof`
9. `retained-unconditional-abono-join`
10. `abono-finalization-join-omitted`
11. `r4-application-guard-omitted-LEXICAL-ONLY`
12. `preflight-bypass-e2_finalization_immutable`
13. `preflight-bypass-e2_validate_abono_finalization`
14. `preflight-bypass-e2_proof_immutable`
15. `preflight-bypass-e2_validate_unused_proof`
16. `preflight-bypass-e2_abono_finalization_complete`
17. `preflight-bypass-e2_capture_application_order`
18. `preflight-bypass-e2_finalize_new_abono`
19. `preflight-bypass-e2_attest_new_retained`
20. `directed-provenance-false-fifo`
21. `ordinary-provenance-false-directed`
22. `directed-core-guard-omitted`
23. `directed-core-amount-check-omitted`
24. `directed-core-result-check-omitted`

R6 negativos nuevos exigen respectivamente
`COBRO_RETENIDO: valid own proof must be accepted` y
`MISSING: ABONO must require UNUSED finalization`, además de exit 1 y
AssertionError. Los otros controles conservan los mensajes semánticos
descritos en el checkpoint. El mutante lexical R4 exige
`R4 lexical: finalized capture application must raise`; adicionalmente el
preflight detecta el hash cambiado, sin ejecutar SQL.

La clasificación dirigida alterada ahora alcanza el guard FULL real del core.
La prueba del handler exige éxito mediante `assert.doesNotReject` con mensaje
`directed valid canonical FULL must not hit classification guard`: el mutante
falla con **AssertionError semántico**, no se acredita simplemente el throw del
servicio. Las otras nuevas aserciones exigen procedencia correcta y rechazo
previo a persistencia para `UNUSED/0`, `FULL/2500` y `PARTIAL/10000`.

### Hashes finales y testdiff

- Preflight: `76f418bf3778a2e5be2414987e46c5f9e2116922ec5152682b7ca2fa8946a999`.
- SQL A+C: `dd99574f022b4d325a73238bf0d1e348e015003d2dad3ebc9de00ede8b094cbd`.
- Cuerpo validador ABONO: `73a3e2b84fb480448080addfd4af98fed85cbff459caddebce5c64d9ad1bb2cc`.
- Servicio devolución: `04f40603037fbd01e56491d320272798599f936a878515e02e0e881c5ee2ae8d`.
- Harness devolución compartido: `2cac1d3816de5e993541c36b4a3470d71454270c8996c3ea2347168d16145ef5`.
- Startup mode: `3b33915260210df6dca5ede230e0fe897fec7a727b1d1038f35649b3f86bc0b4`.
- Servicio A+C: `7ce0967733c4fd61b09db804cb4231ec080236bb26b7861e145f157fdb93893e`.

Los 14 hashes completos están en el manifiesto copiado. Comparación posterior
de las 14 fuentes activas con el snapshot: **0 diferencias**. Todas las copias
mutadas terminaron restauradas byte por byte.

`node --check` sobre los tres tests nuevos: exit 0.
`git diff --check` sobre los archivos propios: exit 0.
Selección faltante: ejecución explícita con preload y suite, sin
`--fixture-root`, exit 1 antes de cargar producción, mensaje de aserción
esperado. No se realizó descubrimiento implícito.

Testdiff final: solo los tres archivos nuevos de pruebas, este informe y logs
solicitados. No se tocó producción ni los tests del trabajador SQL o del
coordinador. R4/R6 se consumen en las versiones congeladas, sin estrechar la
compatibilidad ABONO/COBRO_RETENIDO. Ningún test DB, HTTP, browser, server,
entrypoint, build, dist, workflow, instalación, entorno o flags productivos.
La autorización operativa sigue fuera de alcance.

---

## Checkpoint histórico anterior (NO es la corrida final)

**Checkpoint, no cierre final:** después de esta corrida el coordinador anunció
otra corrección R4 (aplicaciones posteriores a `SET CONSTRAINTS IMMEDIATE`) y
restauración de compatibilidad de retenidos/R6. La evidencia siguiente describe
exclusivamente los hashes identificados al final. El nuevo SQL/preflight/
consumidor necesitará otra congelación y repetición; no se le atribuye este PASS.

**PASS offline: baseline 361/361; 14 mutantes rechazados por aserciones
semánticas reales; 14 restauraciones 361/361.** El runner completo terminó
con exit 0. No equivale a validación PostgreSQL ni autoriza abrir permisos.

Comando exacto, desde la raíz:

```sh
node reports/e2-apertura-limitada/evidencia-a-c/negative-offline-runner.test.mjs
```

Únicos archivos implementados: `negative-offline.test.mjs`,
`negative-offline-runner.test.mjs`, `negative-offline-guard.test.cjs` y este
informe solicitado. No se modificaron fuentes productivas ni
`offline-structural-tests.mjs`.

## Ejecución y aislamiento

- Manifiesto explícito de 14 entradas de fuente/fixtures; una suite explícita y
  un preload explícito. Ausencia de cualquier entrada aborta antes del proceso
  de pruebas. No hay descubrimiento de tests ni expansión de glob.
- Fuentes copiadas a `/tmp/e2-negative-offline-8gpm21`; todos los mutantes se
  escribieron allí, nunca en módulos activos. Los hashes de todas las copias
  restauradas se cotejan al terminar.
- Transpilación TypeScript puramente en memoria; imports productivos
  interceptados por allowlist. No enlace a `node_modules` de otro workspace.
  Se comparte solamente el compilador externo instalado.
- El preload bloquea sockets, HTTP/HTTPS, fetch, DNS, drivers PostgreSQL y
  procesos hijos dentro del proceso de pruebas. No cambia variables de entorno.
- No hubo PostgreSQL/SQL ejecutado, lectura de DB, HTTP, servidores,
  entrypoints de aplicación, build/dist, workflows, reinicios, instalación de
  paquetes, cambios de permisos/flags productivos o commits.
- Se leyó el SQL preparado únicamente como archivo local para obtener cuerpos
  de funciones; las consultas de preflight son cadenas entregadas a mocks.
- Simulación de permisos futuros por argumentos/mocks exclusivos de prueba:
  no se modifica ninguna constante de habilitación en fuente.

## Cobertura ejecutada

1. Handler **real montado** `POST /clientes/:id/pagos`: `UNUSED`, `PARTIAL`,
   `FULL`, una finalización, orden posterior a proyección FIFO y persistencia.
2. Handler **real montado** `POST /pagos-dirigidos/:id/aprobar`: finalización
   `FULL`, una sola vez, posterior a su aplicación dirigida.
3. Servicio real de devolución mediante harness existente: falta de prueba
   positiva rechazada con mensaje específico y sin escrituras en el mock.
4. Preflight real con pools completamente simulados:
   - baseline con opción A+C requerida y con opción apagada/evidencia
     conservada; esta última recorre descubrimiento incondicional;
   - **357 alteraciones independientes**, cada una partiendo de catálogo
     completo válido, sin COMMIT, con ROLLBACK y release exactamente una vez;
   - 17 columnas: ausencia, tipo, nulabilidad, default; precisión y escala en
     las tres columnas numéricas (**74 casos**);
   - 19 restricciones: ausencia, tabla, definición, validación,
     diferibilidad, diferimiento e índice válido/listo/único representado por
     `index_valid` (**133 casos**);
   - cinco triggers y las cinco funciones mantenidas (una función compartida
     por dos triggers): ausencia, hash/cuerpo, clase, volatilidad, paralelismo,
     security definer, leakproof, strict, set-returning, ACL, search path,
     lenguaje, propietario, retorno y argumentos; por trigger también
     habilitación, tipo, tabla, función, esquema, argumentos, columnas,
     padre, condición, constraint y ambos flags de diferimiento
     (**150 casos**, incluidos los 15 del finalizador independiente).

Los cuatro tests superiores y 357 subtests suman **361**. La clasificación usa
el evaluador productivo; no se reemplaza el handler por una réplica. El
proyector y la persistencia se simulan para observar orden e inputs; no se
pretende probar aquí el algoritmo FIFO completo, el motor SQL ni atomicidad
real.

## Evidencia rojo / restauración verde

Cada mutante exigió **exit 1 + AssertionError + mensaje semántico esperado**,
rechazando errores de importación, dependencias sin mock, sintaxis o IO
prohibido. Tras cada uno se restauraron los mismos bytes en el mismo árbol y
se exigió **exit 0**. No basta buscar la palabra “fail”.

| Log del mutante (exit 1) | Asunción violada | Log restaurado (exit 0) |
|---|---|---|
| ordinary-producer-omitted.log | productor ordinario finaliza una vez | ordinary-producer-omitted-restored.log |
| directed-producer-omitted.log | productor dirigido finaliza una vez | directed-producer-omitted-restored.log |
| classification-altered.log | UNUSED según asignaciones | classification-altered-restored.log |
| directed-classification-altered.log | dirigido debe ser FULL | directed-classification-altered-restored.log |
| partial-classification-altered.log | PARTIAL según asignaciones | partial-classification-altered-restored.log |
| directed-before-application.log | finalización posterior a aplicación | directed-before-application-restored.log |
| before-fifo.log | finalización posterior a FIFO | before-fifo-restored.log |
| missing-positive-proof.log | rechazo por falta de prueba positiva | missing-positive-proof-restored.log |
| preflight-bypass-e2_finalization_immutable.log | drift prosrc rechazado | preflight-bypass-e2_finalization_immutable-restored.log |
| preflight-bypass-e2_validate_abono_finalization.log | drift prosrc rechazado | preflight-bypass-e2_validate_abono_finalization-restored.log |
| preflight-bypass-e2_proof_immutable.log | drift prosrc rechazado | preflight-bypass-e2_proof_immutable-restored.log |
| preflight-bypass-e2_validate_unused_proof.log | drift prosrc rechazado | preflight-bypass-e2_validate_unused_proof-restored.log |
| preflight-bypass-e2_abono_finalization_complete.log | drift prosrc rechazado | preflight-bypass-e2_abono_finalization_complete-restored.log |
| preflight-bypass-e2_finalize_new_abono.log | drift prosrc rechazado | preflight-bypass-e2_finalize_new_abono-restored.log |

**Todos los logs completos** de la tabla están en
`/tmp/e2-negative-offline-8gpm21/`. También se conservaron:

- `baseline.log`: 361 tests, 361 pass, 0 fail, 0 skipped, 0 cancelled.
- `results.json`: los 29 procesos de baseline/mutante/restauración y sus
  estados terminales.
- `inputs-sha256.json`: manifiesto exacto de entradas y hashes del snapshot.
- `missing-selection.log`: ejecución de la suite sin raíz aislada explícita,
  exit 1 con `AssertionError: An explicit isolated /tmp fixture root is mandatory`.
  Esta falla ocurre antes de cargar fuentes o descubrir suites.

Verificaciones adicionales: `node --check` sobre los tres archivos nuevos,
exit 0; `git diff --check -- reports/e2-apertura-limitada/evidencia-a-c`,
exit 0. Comparación final de las 14 entradas activas contra los hashes del
snapshot: ninguna cambió durante la ejecución definitiva.

## Revisión congelada y testdiff

Se leyó `reconciliacion-offline-20260919.md` y se adaptaron los mocks al contrato
congelado: `ABONO_EVIDENCE_CONSTRAINTS` exportado por el dueño de producción,
17 columnas con metadatos, 19 restricciones, esquema de función,
diferibilidad y descubrimiento con evidencia conservada.

Hashes de la ejecución definitiva:

- Preflight: `7d191e3a886a76c846abd2a724111d1718dc4b115a73446028eae90829938e10`.
- SQL A+C: `1b9a439fc6d06085f01e76461ee94339440a727baca37a9e11034ef85a8e15ff`.
- Servicio A+C: `d5d551050574c5a17fc4dfe224bd346da72c8c5e091e8a7448e406eb850e7948`.
- Consumidor devolución: `8b5194789d9ff508eb34429c2b7a6d2fee5e0ad818bb597c7b2217bfca5309da`.
- Contrato devolución: `0e3506e9f402a6af1332a88c82b9fcd281b6537709a15edabd9af8f0de34d5f1`.

R4 (cotejo de aplicaciones persistidas y repetición diferida) pertenece al SQL
reconciliado: aquí se verifican sus hashes, no se ejecuta su lógica PostgreSQL.
R6 pertenece al coordinador: este testdiff no modifica consumidor, contrato o
harness compartido; solo consume sus bytes identificados arriba y prueba el
rechazo ABONO por prueba positiva faltante. No se atribuye cobertura adicional
de retenidos ni aceptación global de R6.

Intentos anteriores, **no confundidos con la ejecución definitiva**:
`XxQNHv` y `QSOrB7` expusieron errores de fixture/import del harness nuevo,
corregidos; `Oco8wc` pasó cuatro mutantes iniciales; `Q8FSmv` falló por hashes
SQL/preflight transitoriamente desalineados durante trabajo concurrente
(reportado al coordinador, sin editar producción); `JDifno` pasó ocho
mutantes tras congelar. La corrida definitiva `8gpm21` pasó los 14.