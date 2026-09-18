# E1: alcance técnico ejecutable sobre el clon existente

**Preparación; no se ejecutó el ensayo ni se escribió en PostgreSQL.** Sustituye la propuesta anterior de otra base y sus restricciones de fixtures. La autorización más reciente permite escrituras en el clon desechable existente, previa presentación de los scripts y este alcance. No se pide autorización adicional sobre la base operativa: **no se necesita ninguna conexión a ella**.

## Destino y observación de sólo lectura

Inspección realizada con `default_transaction_read_only=on`:

- Socket `/tmp/prompt-h-block2-20260917165108-3655-3655`, puerto 5432, sin listeners TCP.
- Base `restore_disposable_20260917165108-3655`; rol PostgreSQL `postgres`.
- Directorio `/home/runner/workspace/.local/backups/prompt-h-block2-20260917165108-3655/restore-cluster`.
- OID 16384; arranque `2026-09-17 22:55:26.435568+00`; PostgreSQL 16.10.
- No existen `operaciones_credito_e1`, `atribuciones_credito_e1` ni las siete columnas E1. El ledger tiene tres movimientos originales.

El ensayo no restaura, crea otra base, elimina el clon ni modifica el respaldo local o Drive. Sí agrega E1 y fixtures/operaciones sintéticos al clon autorizado. Mantiene la API pausada y no arranca servidores, bootstrap, backfills ni E2–E12.

## Archivos y punto de entrada

| Archivo | Función |
|---|---|
| `scripts/src/e1-rehearsal.mts` | Orquestación, digest de fuentes, socket/identidad, estados y preservación. |
| `scripts/src/e1-rehearsal-prepare.mts` | Preparación E1: comparación de archivo aprobado, sustitución exclusiva de S07, ejecución única. |
| `scripts/src/e1-rehearsal-loader.mts` | Carga código real: sólo sustituye `@workspace/db` por esquema real + Drizzle real + pool pg fijado. |
| `scripts/src/e1-rehearsal-pos-cases.mts` | Fixtures y handlers/core reales de VENTA_CREDITO y CANCELACION_VENTA_CREDITO. |
| `scripts/src/e1-rehearsal-customer-cases.mts` | Fixtures y handlers reales de AJUSTE_MANUAL, BAJA_INCOBRABLE, ABONO_ORDINARIO, ABONO_DIRIGIDO, REVERSO_ABONO. |
| `scripts/src/e1-rehearsal-evidence-cases.mts` | Límites de evidencia, compatibilidad/omisión E1 y capturas cerradas, por helper y por SQL. |
| `identidad-clon-e1.diff` | Cambio visible de guarda de identidad, no de reglas E1. |

Cada módulo contiene su SQL de fixtures y sus casos; no se genera SQL nuevo «según haga falta». IDs reservados: clientes 1871000000+, POS 1872000000+, evidencia 1873000000+. Sus actores/sitios/sesiones no dependen de cuentas, contraseñas o sesiones operativas. El maestro instala únicamente POS_FIXTURE_SQL, una vez; clientes instala su propia transacción y evidencia sus fixtures temporales. La colisión con un fixture existente causa fallo, no limpieza ni UPDATE de originales.

### DDL que se aplicará

Original sin modificar: `reports/e1-ensayo-2026-09-17/operativo-propuesto/01.sql`.

- SHA-256 original: `680f8f4d339d20775dabeb540c43d4945391652f1eabd6e0162f3a1ca48ce57f`.
- SHA-256 del texto completo adaptado en memoria: `88ba186be84bd5159066d5461337863532441217d2742e608a72973d8b0b1bfd`.
- Sólo cambia el bloque de identidad de S07, según el diff adjunto. S08–S27 permanecen **idénticos byte a byte**; se mantienen también dependencias, reserva de nombres y comprobación de triggers de S07.
- La inspección de ejecución debe volver a encontrar E1 ausente. Si está presente/parcial, se rechaza la ejecución para impedir repetir DDL. No se borra ni se «repara» automáticamente.
- Un watchdog de 30 segundos cierra la conexión DDL; presupuesto total del ensayo 300 segundos. Si un COMMIT tuvo respuesta ambigua, se informa fallo y se exige inspección, no reintento automático.

Respaldo sólo leído para comprobar tamaño 464990 y SHA-256 `583ac96297ca40573aa96249e2b25de68812f98bd7b675214473932fe81f2925` del dump ya verificado. Nunca se escribe sobre ese archivo.

## Invocación exacta y vínculo a fuentes

La inspección de scripts siguiente es **sólo de archivos**: no importa módulos de casos, no abre PostgreSQL y no ejecuta handlers.

```sh
cd scripts
env -u NODE_OPTIONS node --import tsx src/e1-rehearsal.mts --review
```

Su salida devuelve un digest SHA-256 del manifiesto completo y la orden ejecutable exacta para esa revisión:

```sh
cd scripts
env -u NODE_OPTIONS node --import tsx src/e1-rehearsal.mts --execute 0cbd53fc8c57bfc9fabda6caf911a9d9cb1c627fe997918b950abce0d3250e6a EXISTING_DISPOSABLE_CLONE_ONLY_API_PAUSED
```

El digest anterior se calculó por lectura offline de 1179 archivos, sin ejecutar el arnés. Debe coincidir con la revisión que se presente. Si cambia cualquier script, fuente API/DB/Zod o lockfile del manifiesto, el script se niega a empezar: publicar el nuevo digest antes de ejecutar, no sustituirlo silenciosamente. Vuelve a comprobar las fuentes al terminar.

El manifiesto no incluye secretos ni URLs operativas. Los pools usan campos explícitos, nunca una URL heredada. El guardia de prueba genérico que consulta producción no se usa: cada `pg.Client.connect` se intercepta, valida el destino fijo, abre exclusivamente el socket permitido y valida identidad viva antes de entregar la conexión. `net.Socket.connect`, `net.Server.listen` y `fetch` se restringen; no se levanta la API.

## Escrituras y límites de la ejecución

1. **DDL:** sólo el E1 aprobado con la guarda descrita, en el clon.
2. **Fixtures:** INSERTs explícitos definidos en los módulos, IDs reservados; credencial sintética efímera sólo cuando el handler real de baja la exige. No cambiar contraseñas/hashes de usuarios originales, no login ni renovación de sesiones originales.
3. **Productores:** transacciones PostgreSQL reales de las siete rutas descritas; algunos COMMIT son necesarios para probar replay y concurrencia. No mocks de productor ni sustitución de consultas/reglas.
4. **Pruebas de rechazo/rollback:** sólo lo enumerado en los módulos; los probes SQL de fronteras cerradas se revierten siempre.
5. **Secuencias:** el avance ordinario de seriales por INSERT, incluso revertido, queda dentro del clon. No reset ni `setval` durante el ensayo.
6. **Resultados:** escritura atómica de `reports/e1-ejecucion-2026-09-17/verificacion-aislada-resultados.json` mediante archivo temporal y rename. No filas originales completas ni credenciales en el reporte.

Tablas que las rutas financieras pueden escribir: `operaciones_credito_e1`, `movimientos_credito`, `aplicaciones_credito`, `auditoria`, `clientes`, `tickets`, `autorizaciones_nota`, `notificaciones_credito`, `solicitudes_pago_dirigido`, `notificaciones_sistema`, `salidas`. Las de fixtures incluyen `usuarios`, `ubicaciones`, `sesiones_caja` y las tablas de negocio declaradas en el SQL de cada módulo. Los probes cerrados intentan INSERT en `cobros_credito_pendientes_e1` y `atribuciones_credito_e1`, siempre con ROLLBACK. Los intentos de inmutabilidad apuntan exclusivamente a filas sintéticas.

### Inventario exacto de fixtures y modificaciones auxiliares

| Dominio | Escrituras de preparación |
|---|---|
| Clientes, COMMIT único de fixtures | 1 `ubicaciones`, 2 `usuarios`, 1 `permisos_usuario`, 1 `sesiones_caja`, 5 `clientes`, 5 `tickets`, 5 `operaciones_credito_e1`, 5 `movimientos_credito`. Los cinco cargos semilla son 1000.00 cada uno, fecha 2020-01-01 y vencimiento 2020-01-16; no son evidencia de ejecución del productor POS. |
| POS, COMMIT único de fixtures | 1 `ubicaciones`, 1 `usuarios`, 1 `clientes`, 1 `sesiones_caja`, 2 `tickets` (100.00 y 1001.00), 1 `salidas` VENTA_CLIENTE/RECIBIDA; IDs 1872000101 y segunda nota 1872000102. |
| Evidencia, 23 transacciones con ROLLBACK | Por transacción: 1 sitio 1873000201, 2 actores 1873000101/102, 1 sesión 1873000301 y 1 cliente 1873000001. El caso de sitio incompatible agrega temporalmente sitio 1873000020. Las inserciones financieras de prueba usan movimiento explícito 1873000010 y UUIDs literales del módulo. Ninguna fila de este dominio queda confirmada. |

Las acciones confirmadas de clientes son seis intenciones: ordinario 100.00, reverso 100.00, ajuste -10.00, dos dirigidos de 100.00 (ADMIN inmediato y CAJA pendiente/aprobación), baja 1000.00. POS confirma autorización y cancelación de su nota de 100.00. Por tanto son **ocho intenciones efectivas sobre siete productores**, además de los cinco cargos semilla SQL; no confundir fixtures con cobertura.

POS cierra **su sesión sintética** mediante UPDATE para probar replay tras cierre. También intenta cambiar total/subtotal de su nota dentro de una transacción que revierte por conflicto. La baja cambia únicamente el cliente sintético a inactivo. No se cambia ninguna sesión/usuario/nota original.

POS usa notas sintéticas sin líneas/movimientos físicos: prueba efectos financieros, autorización, cancelación y salida ligada, **no** venta/devolución de inventario. No afirmar cobertura de rollos, existencias o atribución de proveedores a partir de este ensayo.

No se hace UPDATE/DELETE de ninguno de los tres históricos. El probe de atribución puede referenciarlos dentro de una transacción que siempre revierte: no declara una atribución persistente ni infiere su procedencia real. Se comprueba que los siete campos E1 originales permanezcan NULL. Además, el maestro conserva un multiconjunto de huellas de **todas** las filas originales después del DDL y exige que sigan presentes sin cambios al finalizar, incluso si hay fallos.

## Cobertura requerida y significado de resultados

Cada productor debe aceptar su contrato completo válido y rechazar origen/naturaleza ausentes, naturaleza incompatible y llamadas de productor antiguo sin E1. Se comprueba UUID repetido con contenido idéntico (respuesta original, sin efectos duplicados) y contenido diferente (conflicto). Los módulos especifican sus casos adicionales de concurrencia, rollback y efectos laterales; una ausencia de cobertura debe aparecer como tal, nunca como PASS.

Presupuesto cerrado: **20 resultados POS + 59 clientes + 24 evidencia = 103 resultados**. Evidencia incluye 23 transacciones revertidas y una comprobación final de preservación. El maestro comprueba el conteo por módulo, elimina la duplicación entre callbacks y resultados devueltos, y conserva fallos individuales. **Esta versión es secuencial: no prueba carreras concurrentes entre conexiones.** Sí prueba replay tras COMMIT y rollback real de claim/ledger/efectos laterales. No debe venderse como prueba de concurrencia o inventario.

**Distinción importante:** flags/validaciones de la aplicación no equivalen a prohibiciones SQL. El E1 aprobado parece admitir INSERT SQL con contrato completo de efectivo, cobro pendiente y atribución histórica. El módulo de evidencia lo prueba con ROLLBACK:

- Rechazo de helpers/handlers y rechazo de SQL son resultados separados.
- Una inserción admitida en esa frontera cerrada se registra **FAIL / DATABASE_GATE_GAP**.
- No se modifica DDL, triggers, flags ni `session_replication_role` para ocultar una brecha.
- El orquestador continúa recogiendo los otros dominios, conserva los fallos y termina con código distinto de cero.

Resultado global PASS exige que todos los módulos y todos sus casos estén verdes, sin ERROR/SKIP/PENDING, con preservación verificada. Una excepción, error de conexión, timeout, diferencia de fuentes o alteración de un original produce FAIL. La ausencia de resultados en un módulo también falla. No se reinicia ni reanuda la API al terminar, sea cual sea el resultado.

## Estado antes de presentación

Scripts preparados para revisión estática; **sin resultados transaccionales todavía**. El padre debe presentar el digest emitido por `--review`, el diff, los SQL/casos de los módulos y este alcance antes de ejecutar la orden. Este documento no formula una pregunta de autorización ni ejecuta el ensayo.