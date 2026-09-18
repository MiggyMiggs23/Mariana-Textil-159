# E1 — guardas temporales instaladas en la operativa

## Dictamen

**PASS — COMMITTED_VERIFIED.** Se instalaron conjuntamente las **tres funciones y tres triggers** autorizados en `heliumdb`, se confirmó COMMIT y se verificó el resultado desde una conexión nueva de solo lectura. **15/15 controles posteriores PASS.**

La API permanece **PAUSADA**, sin puerto abierto. La variable temporal `NODE_OPTIONS` fue retirada; no quedó habilitado el inspector. No se autoriza ni se realizó una reanudación para operación normal. Este resultado acredita las tres barreras SQL y la conservación comprobada; **no declara por sí solo cerrado todo E1, ni completa E2–E12 o corte/reportes**.

## Identidad, bloqueo y código

- Ventana normal única, con escrituras de inicialización autorizadas y medidas por separado.
- La precarga instaló el bloqueo HTTP antes de cargar el código de la aplicación. Con la entrada todavía detenida, el controlador probó **8 casos del despachador real**, guardó la prueba y sólo después liberó módulos e inicializadores.
- Se permitió exclusivamente `GET /api/healthz`; los métodos/rutas restantes probados recibieron 503; Expect fue bloqueado y upgrade/CONNECT destruidos. Los ocho casos previos son eventos sintéticos sobre el despachador, no operaciones de aplicación.
- El pool **BoundPool real de la API**, PID 3276, confirmó `current_database() = heliumdb` mediante una transacción READ ONLY terminada con ROLLBACK. La identidad coincidió con ambas capturas de evidencia.
- Bundle cargado, bundle en disco y fuente embebida cotejados. Los **1,170 archivos** de API/DB/contratos y sus tres manifiestos de paquete coinciden con el código del ensayo: 1,167 fuentes más tres manifiestos.
- Ese conjunto incluye las rutas y adaptadores de los **siete productores**: `VENTA_CREDITO`, `CANCELACION_VENTA_CREDITO`, `ABONO_ORDINARIO`, `ABONO_DIRIGIDO`, `REVERSO_ABONO`, `AJUSTE_MANUAL`, `BAJA_INCOBRABLE`.
- Inicializadores completados sin errores; identidad guardada a las **16:08:13.657 UTC**; apagado normal de la aplicación registrado a las **16:08:13.666 UTC**, salida del proceso confirmada a las **16:08:13.782 UTC**. Se detuvo también el workflow. No hubo SIGKILL.

Evidencia: `http-gate-before-entry.json`, `api-pool-identity.json`, `window-result.json`, `startup-task-evidence.txt`. La revisión de fuentes y el mapeo exacto de productores se conservan en `.local/e1-startup-evidence-review.md`.

## Efectos del arranque, separados del DDL

Comparación de `snapshot-before-startup.json` y `snapshot-after-startup.json`:

| Conjunto | Inserciones | Eliminaciones | Modificaciones |
|---|---:|---:|---|
| Compras/ledger de proveedores | **0** | **0** | **0** |
| Permisos de rol | 0 | 0 | 70 filas: sólo `updated_at` |
| Permisos de ubicación | 0 | 0 | 54 filas: sólo `updated_at` |
| Permisos de usuario | 0 | 0 | 0 |
| Notificaciones | 0 | 0 | 0 |
| Episodios de stock mínimo | 0 | 0 | 0 |
| Configuración de stock y roles de usuarios | 0 | 0 | 0 |

**Backfill de compras a proveedores: 0 filas insertadas.** Había cero candidatos antes y después. `pagos_proveedor` conservó sus **2 filas**, sin altas, bajas ni cambios de huellas. El proceso informó completado con `inserted: 0`; como ese valor del código cuenta candidatos, se corroboró el resultado mediante la comparación real de filas, no sólo con el log.

Las secuencias de permisos avanzaron por los intentos de inserción de los inicializadores, aunque no se agregaron filas:

- `permisos_rol_id_seq`: **33308 → 33395**.
- `permisos_ubicacion_id_seq`: **9396 → 9450**.

Las otras secuencias, todas las demás tablas, los datos financieros, los tres históricos y el catálogo permanente se conservaron. No cambió ningún valor efectivo de permiso: las diferencias de filas fueron exclusivamente sus marcas `updated_at`.

El resultado de los inicializadores, la finalización del backfill, la parada del evaluador y el apagado se acreditaron con logs del mismo PID, no se dedujeron del chequeo de salud. La comparación exacta está en `startup-effects-measured.json` y `startup-diff-measured.json`; su revisión está vinculada por SHA-256 en `startup-approval.json`.

## Preflight e instalación

- El propietario aclaró y aprobó el inventario: **60 objetos**, sus definiciones y **siete columnas E1**, no 27 objetos. Los 27 eran las sentencias de la migración original.
- Antes del DDL: identidad vinculada al pool real, API y puerto ausentes, exclusión de otras conexiones cliente y transacciones preparadas, cero event triggers activos, inventario completo coincidente y guardas ausentes.
- Se conservaron las definiciones permanentes y se instalaron sólo las seis instrucciones de los tres archivos SQL aprobados; **no se repitió la migración original**.
- Supervisor en proceso independiente, conexión de control preparada y límite de **30 segundos** activo antes de BEGIN. No se agotó.
- COMMIT enviado y confirmado; backend DDL cerrado y ausente antes de desarmar el supervisor.
- Resultado confirmado desde una conexión nueva READ ONLY. No hubo respuesta perdida; la ruta de resolución de COMMIT ambiguo quedó preparada, pero no se afirma haber simulado ese incidente en la operativa.
- No se retiró ni reinstaló ninguna guarda como prueba.

### Tiempos reales

| Medición | Tiempo |
|---|---:|
| DDL de efectivo, dos instrucciones | 16.302 ms |
| DDL de pendientes, dos instrucciones | 0.673 ms |
| DDL de atribución, dos instrucciones | 0.950 ms |
| BEGIN → COMMIT confirmado, incluido preflight transaccional | **619.803 ms** |
| Transacción hasta finalizar su medición | 622.708 ms |
| Ejecución operativa registrada, incluidas sondas y comprobación final | **4.040 s** |

## Verificación posterior

**15/15 PASS**, con INSERT reales y transacciones revertidas:

- Presencia de las tres guardas habilitadas y validadores permanentes.
- Recepción y devolución física en efectivo rechazadas con **E1C01** y mensaje exacto.
- Cobro pendiente rechazado con **E1P01** y mensaje exacto.
- Atribución de cada uno de los tres históricos reales rechazada con **E1A01** y mensaje exacto.
- Los siete productores admitidos en sus combinaciones comprobadas: ventas/cancelaciones sin dinero, abonos ordinarios/dirigidos por transferencia y reverso/ajuste/baja contables sin sesión de caja.
- Cada inserción permitida verificó una fila efectiva y su contenido exacto; no se tomó la mera ausencia de error como éxito.
- ROLLBACK y comparación de conservación, seguida por otra captura completa desde conexión nueva.

**Conservación final respecto de la línea base posterior al arranque:** las **66 tablas**, los **tres históricos**, las **55 funciones y 23 triggers no internos permanentes**, el resto del catálogo y las **47 secuencias con su estado completo** se mantuvieron. Los únicos objetos nuevos persistentes son las tres funciones y tres triggers autorizados: **58 funciones y 26 triggers no internos en total**. Las siete columnas nuevas de los tres históricos siguen NULL; no hubo atribución.

No se crearon usuarios, contraseñas ni permisos de prueba. Los fixtures de las sondas usaron identificadores explícitos y se revirtieron.

## Incidencia documental previa, conservada

Una primera invocación fue rechazada en la validación **exclusivamente de archivos**, antes de crear la marca de ejecución, abrir conexiones DDL o enviar SQL: la hora de aprobación que generó el operador precedía por 12 ms a su constancia de proceso detenido.

Se conservó el archivo original como `startup-approval-rejected-timestamp.json`, se documentó en `file-gate-rejection.json` y se regeneró únicamente la hora de aprobación después de la observación ya guardada. No se modificaron mediciones, definiciones ni condiciones de seguridad. **La instalación SQL se ejecutó una sola vez.**

## Conservación y retiro futuro

- El clon persistente continúa en `.local/backups/prompt-h-block2-20260917165108-3655/restore-cluster`; no se arrancó, recreó ni modificó durante esta intervención.
- No se efectuó ninguna operación sobre el respaldo de Drive. Se conserva su referencia verificada previamente, SHA-256 `583ac96297ca40573aa96249e2b25de68812f98bd7b675214473932fe81f2925`; no se afirma una nueva descarga/verificación remota.
- Guardas temporales e independientes: efectivo espera **E2 + E3 coordinados**; pendientes espera **E3 + E5 y dependencias**; atribución histórica requiere **decisión explícita del propietario sobre evidencia y sitio**, nunca apertura automática.
- Mantener clon y respaldo hasta cerrar E1. No reanudar automáticamente API, inicializadores ni mantenimiento.

## Informe de ejecución autoritativo

`operational-run-1789747937364-3434.json`: **PASS / COMMITTED_VERIFIED**, 6/6 instrucciones DDL, 15/15 controles, conservación final PASS, API ausente.