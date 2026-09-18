# Guardas SQL temporales independientes: alcance del ensayo

**Actualización:** el ensayo aquí descrito ya terminó con **84/84 PASS**, sólo en el clon. Véase [resultado-y-propuesta.md](resultado-y-propuesta.md) para mediciones y estado final. Lo siguiente conserva el alcance presentado antes de ejecutar.

**PREPARADO, NO EJECUTADO por este agente.** No hay tiempos medidos nuevos todavía. La autorización actual permite preparar y probar en el clon existente; el padre presenta estos archivos antes de ejecutar. La base operativa y la reanudación de API requieren autorización distinta, que no se solicita aquí.

## Corrección propuesta

Inventario final: **84 controles** (24 de evidencia, siete fases de seis controles y dos fases de nueve controles de compatibilidad). Se prueba efectivo entrante **y devolución física en efectivo**. Las huellas de filas completas se agregan en PostgreSQL, sin traer todas las filas a memoria del proceso. El límite total intenta terminar únicamente los backends identificados del ensayo antes de registrar un fallo; un COMMIT ambiguo exige inspección, nunca una reinstalación adivinada.

El ensayo anterior dejó 100/103 resultados correctos: los tres INSERT SQL válidos de efectivo físico, recepción pendiente y atribución histórica seguían admitidos por la integridad permanente. Se añaden **tres funciones y tres triggers independientes y removibles**, sin modificar una línea de las funciones/triggers permanentes E1.

| Puerta | Función `public` | Trigger | Condición y resultado |
|---|---|---|---|
| Efectivo | `e1_guard_cash_capture_closed()` | `zz_e1_cash_capture_closed`, AFTER INSERT ROW, `movimientos_credito` | Rechaza sólo `forma_pago=EFECTIVO` y naturaleza `INGRESO_FISICO` o `DEVOLUCION_FISICA`. Valida la fila final, después de cualquier BEFORE INSERT. |
| Pendientes | `e1_guard_pending_receipts_closed()` | `zz_e1_pending_receipts_closed`, AFTER INSERT STATEMENT, `cobros_credito_pendientes_e1` | Rechaza todo INSERT, incluso uno de cero filas; las validaciones permanentes de las filas se ejecutan antes. |
| Históricos | `e1_guard_historical_attribution_closed()` | `zz_e1_historical_attribution_closed`, AFTER INSERT STATEMENT, `atribuciones_credito_e1` | Rechaza todo INSERT, sin crear ni corregir atribuciones. Mantiene validaciones previas de identidad, microsegundos y rol. |

Errores exactos:

- `E1C01`: `E1: la captura física de efectivo de crédito está deshabilitada.`
- `E1P01`: `E1: el cobro retenido de crédito está deshabilitado.`
- `E1A01`: `E1: la atribución histórica de crédito está deshabilitada.`

No se corrige, convierte, suprime silenciosamente ni reclasifica una entrada. Un error revierte el INSERT de la sentencia. Transferencias ordinarias, correcciones sin dinero físico y operaciones de crédito sin movimiento de dinero no son bloqueadas por estas guardas; siguen sujetas a la integridad E1 vigente.

Los nombres `zz_*` hacen que la nueva guarda de fila se ejecute después de `movimientos_validos_e1`; las guardas de sentencia se ejecutan después de las validaciones de fila. `atribuciones_validas_e1` conserva su condición BEFORE ROW original: no se transforma en AFTER ni se reemplaza.

## SQL exacto y retiro independiente

Los seis archivos son fragmentos sin BEGIN/COMMIT: **sólo deben ejecutarse mediante la envoltura revisada**, que verifica identidad, aplica límites y mide la transacción.

| Archivo bajo `sql/` | SHA-256 |
|---|---|
| `01-install-cash.sql` | `9e14649f95dbc889823a7c349a8e009ea1916699140914f03a453751f2d4c9b4` |
| `02-install-pending.sql` | `d3e61d6f1be32615653506bf52d1c98182d80dd1368fa4764c27da8fe5edd03c` |
| `03-install-attribution.sql` | `f03e3ae5cf038807ab8c35ab7beff95cc1f87e688a17c44ff8ccd800a31c492a` |
| `11-remove-cash.sql` | `c65e8ae5320cdd472d463468cb06427b78ce708a49a6a192923f8adbcec4de22` |
| `12-remove-pending.sql` | `75cff65b53229079c90930e3ad5dc30d6c4b71b867f69d263e2adf68a07fd5f9` |
| `13-remove-attribution.sql` | `74810f641e7e3ce294cf4e563608f94dcb23b526883ca4c2adc225d61ffb59d4` |

Cada retiro contiene únicamente `DROP TRIGGER ... ON su_tabla` seguido de `DROP FUNCTION ...()`. No usa CASCADE, IF EXISTS, edición de funciones permanentes ni bandera común. Cada reinstalación ejecuta su archivo original, sin CREATE OR REPLACE. Una colisión o dependencia inesperada provoca fallo.

### Condición futura de retiro, comprobada contra el plan U

Fuente: `reports/prompt-u-plan-de-implementacion.md`, E1 líneas 150–155, E2 157–167, E3 169–182, E5 195–210.

- **Efectivo:** retiro sólo con E2 (corte y devolución física) y E3 (captura/anticipos/recibo) coordinados, completos y autorizados. No basta habilitar un formulario.
- **Pendientes:** E3 y E5 completos, con sus dependencias E11 y coordinación de lectores/conciliación E7. No dejar una cola de dinero recibido invisible o inaplicable.
- **Atribución histórica:** flujo autorizado por separado, evidencia y decisión explícita del propietario sobre el sitio. Es soporte de E1 y lectura de E7; **no** se habilita automáticamente al liberar E2, E3 o E5.

El retiro temporal durante este ensayo no habilita esas funciones operativas: ocurre únicamente en el clon, las sondas revierten sus filas y al final se conservan **las tres guardas instaladas**.

## Destino y protección de lo existente

Único destino: base `restore_disposable_20260917165108-3655`, socket `/tmp/prompt-h-block2-20260917165108-3655-3655`, puerto 5432, rol postgres, OID 16384, PostgreSQL 16.10, arranque `2026-09-17 22:55:26.435568+00`, directorio del clúster retenido ya identificado.

El arnés `scripts/src/e1-removable-guards.mts`:

- Rechaza otro socket, base, rol, instancia, dirección TCP, SSL o cambio de arranque; valida cada conexión real antes de entregarla.
- Bloquea sockets distintos, listeners y fetch. No importa bootstrap/API ni el singleton global de base.
- Comprueba E1 ya instalado, siete columnas, 16 movimientos y 13 operaciones conservados del ensayo anterior, cero pendientes/atribuciones. No vuelve a ejecutar la migración E1 original.
- Compara el ledger y definiciones de integridad con las huellas del informe anterior. Rechaza guardas temporales ya presentes: no limpia ni reinicia un ensayo.
- Captura todas las filas existentes de todas las tablas públicas, incluidos los fixtures del ensayo previo. Después de cada fase exige igualdad exacta de hashes y conteos, no sólo ausencia de cambios en las tres filas históricas.
- También comprueba las tres identidades históricas con los siete campos E1 NULL y las definiciones de **todas** las funciones/triggers permanentes públicos. Ninguno se desactiva o sustituye.
- Lee el respaldo para verificar su hash; no lo restaura ni modifica y no accede a Drive.

## Secuencia ejecutable y escrituras permitidas

1. Preflight sólo de lectura y huellas.
2. **Un COMMIT atómico** instala las tres funciones/triggers.
3. Repite la batería real de evidencia, exige ahora el error exacto en las tres capturas cerradas; prueba las tres puertas instaladas y las siete combinaciones permitidas de productor/naturaleza.
4. Retira únicamente efectivo en una transacción; prueba admisión exacta de su INSERT válido con ROLLBACK y rechazo exacto en las otras puertas. Reinstala efectivo en otra transacción y prueba de nuevo las puertas.
5. Repite ese procedimiento con pendientes.
6. Repite con atribución histórica.
7. Repite compatibilidad permitida y preservación final; exige definiciones reinstaladas idénticas a la primera instalación y conserva las tres guardas.

Son **siete transacciones DDL planificadas**: instalación conjunta, tres retiros y tres reinstalaciones. La única diferencia persistente al final debe ser las seis definiciones nuevas. No hay DELETE/UPDATE de datos originales ni limpieza de fixtures.

Las sondas del módulo `scripts/src/e1-rehearsal-evidence-cases.mts` usan INSERTs reales y fixtures explícitos 187300*: sitio, dos actores con login deshabilitado, sesión y cliente; notas/orígenes de reverso cuando la combinación SQL los requiere. Cada transacción DML termina en ROLLBACK, incluso una admisión válida tras retiro. Las atribuciones de prueba nunca quedan confirmadas ni cambian el movimiento original. La compatibilidad SQL de los siete productores se reporta como tal, no como una segunda ejecución de sus handlers.

Los hashes de código y SQL quedan en el manifiesto de revisión y se vuelven a comprobar al finalizar. No se admiten ampliaciones dinámicas de casos ni creación de SQL durante el ensayo.

## Medición y parada

Cada transacción DDL usa una conexión propia y un supervisor separado, ambos fijados al clon:

- `lock_timeout=2s`, `statement_timeout=15s`, `idle_in_transaction_session_timeout=5s`.
- Locks explícitos SHARE ROW EXCLUSIVE de las tablas afectadas, en orden estable.
- Temporizador supervisor de **30s desde antes de BEGIN**. Sólo puede terminar el PID DDL cuyo nombre de aplicación y base coincidan con esa transacción.
- Se registran tiempo de adquisición del lock (incluye espera), tiempo por archivo, instante relativo de envío de COMMIT, acuse terminal y duración desde adquisición hasta acuse. Esta última incluye el pequeño tiempo de respuesta del cliente: no se presenta como una medición interna exacta del desbloqueo.
- Se verifica que el backend DDL haya desaparecido después de cerrarlo. Presupuesto total del proceso: 300s.
- Si COMMIT fue enviado pero no confirmado, el resultado es **ambiguo: detener e inspeccionar, cero reintentos automáticos**. No ejecutar el siguiente retiro/reinstalación tras un fallo de DDL.
- Un fallo de aserción de sondas se conserva, permite seguir con sondas independientes donde sea seguro y no omite la reinstalación planificada. Cualquier fallo produce salida distinta de cero; nunca «PASS con advertencias».

El informe atómico será `resultado-medido.json`, con tiempos reales, huellas, estado final, cada resultado y errores sanitizados. Un timeout o fallo puede impedir llegar al estado final planeado; el reporte lo indicará y no intentará repararlo automáticamente.

## Invocación para presentación

Revisión de archivos, sin conexión ni ejecución de SQL:

```sh
cd scripts
env -u NODE_OPTIONS node --import tsx src/e1-removable-guards.mts --review
```

La salida publica el digest y **la orden exacta** con ese digest. Sólo después de presentar SQL, alcance y orden:

```sh
cd scripts
env -u NODE_OPTIONS node --import tsx src/e1-removable-guards.mts --execute DIGEST_PRESENTADO REMOVABLE_GUARDS_EXISTING_CLONE_ONLY_API_PAUSED
```

No se acepta el texto literal `DIGEST_PRESENTADO`: debe coincidir con el manifiesto previamente presentado. Ningún comando pide o usa credenciales operativas. Después de medir el clon, **esperar autorización operativa separada**; este ensayo no autoriza aplicar las guardas a la base operativa ni reanudar la API.