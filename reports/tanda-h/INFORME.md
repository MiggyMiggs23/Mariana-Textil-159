# Tanda H — informe único final

**Corte de evidencia:** 24 de septiembre de 2026, después de la reanudación documentada en `PAUSA.md`.

## Dictamen

La Tanda H deja tres cambios efectivamente aplicados y verificados:

1. `crearEntrada` rechaza cantidades físicas negativas, no finitas, vacías o mal formadas en METRO, KILO, PIEZA y BOLSA; conserva la aceptación previa de cero y cero con signo.
2. La base de la aplicación conserva el `CHECK` validado `rollos_physical_quantity_nonnegative_check`.
3. La base de la aplicación contiene los dos índices autorizados para corte y crédito.

La protección de cantidad quedó liberada en la API activa. Los objetivos de interfaz de **crédito <3 s** y **corte <2 s** no quedaron acreditados. No se cambió el significado financiero, no se implementó la propuesta de virtualización/paginación y no se abrió ningún bypass de permisos.

`PAUSA.md` es un registro histórico auténtico: la ejecución sí se pausó y se cerraron sus recursos privados. **Para el estado vigente, este `INFORME.md` reemplaza expresamente los pendientes de liberación e índices anotados durante aquella pausa:** ambos índices ya están aplicados y la protección de `crearEntrada` ya está liberada. No se reescribe la pausa como si nunca hubiera ocurrido.

## Resultado por frente

| Frente | Resultado comprobado | Estado |
|---|---|---|
| Cantidad física en `crearEntrada` | RED 16/44; GREEN 44/44; `CHECK` en copia 56/56 | Implementado y liberado |
| `CHECK` en base de aplicación | Aplicado por COMMIT; 107/107 tablas con filas y hashes iguales | Aplicado y validado |
| Índices de corte y crédito | Dos `CREATE INDEX CONCURRENTLY`; 107/107 tablas iguales; ambos índices válidos/listos; `CHECK` aún validado | Aplicados y verificados |
| Crédito navegador | Dos muestras listas: 11,005 y 9,804 ms; una muestra se bloqueó antes del login | **No cumple <3 s** |
| Corte navegador | Una muestra lista: ruta 4,653 ms y clic→cifras 945 ms; dos muestras bloqueadas | **No acredita <2 s** |
| Estado de cuenta | Cliente sintético pequeño listo: ruta 3,789 ms, clic→estado listo 866 ms; cliente anual bloqueado antes de `e7-client-export` | Sin serie final de 3 |
| Cobro navegador | Tres cobros sintéticos persistidos; clic→confirmación 1,167 / 319 / 396 ms | 3 muestras reales, sin SLA contractual declarado |
| Permisos | 24 intentos: 19 bloqueos exteriores y 5 respuestas legacy 409; cero guardas interiores nuevas alcanzadas | Bloqueado sin bypass |

## 1. Cantidades físicas: defensa en productor y base

El cambio de `c5ad7db` se limita al productor `crearEntrada`. Antes del cambio, 28 de 44 expectativas fallaban y valores negativos podían persistirse dentro de transacciones de ensayo luego revertidas. Después, las mismas 44 expectativas pasaron sin que existiera todavía el `CHECK`. La validación separada del operador en copia produjo 56/56 aserciones.

Se preservó deliberadamente:

- cero y cero con signo;
- reglas fraccionarias existentes de unidades discretas;
- cantidades con signo de otros libros y productores;
- puertas E3/E4 y demás comportamiento de negocio.

El `CHECK` exacto fue aplicado a la base de la aplicación y confirmado en `111c347`. La evidencia registra COMMIT, ausencia previa de negativos/NULL/NaN/infinito en las columnas revisadas y catálogo final validado. Las 107 tablas públicas conservaron conteos y digests; no hubo reparación de datos, login ni prueba operativa sobre la base real.

## 2. Índices autorizados en la base de la aplicación

`d6faa70` registra la aplicación efectiva y verificada de únicamente:

- `tickets_pendientes_corte_ga_candidate`;
- `tickets_contabilizados_sitio_fecha_ga_candidate`.

Ambos se crearon concurrentemente. Antes de aplicar se revisaron claves, orden, expresión, predicados, unicidad y estado de los índices existentes; el índice general `(ubicacion_id, created_at)` no sustituía al candidato parcial de corte y no existía el prefijo de la expresión de fecha contabilizada.

Después de aplicar:

- ambos candidatos figuran válidos y listos;
- las 107 tablas conservaron exactamente conteos y digests;
- no hubo sentencias de escritura de filas, login ni prueba operativa;
- el `CHECK` físico siguió presente, validado y con la misma definición;
- no se ejecutó `schema push` ni se tocaron otros candidatos.

La prueba previa en copia anual conservó igualdad ordenada de 78 resultados de consulta y 6 resultados de operación. Todas las tablas comerciales fueron iguales; `sesiones` cambió por autenticación de las mediciones y por eso la evidencia original mantiene honestamente `datasetEqual:false`. No se confunde `sesiones` con `sesiones_caja`.

## 3. Rendimiento en navegador: medición actual

Cada muestra actual usó un proceso de navegador fresco. Login y selección inicial de sitio se reportan aparte; readiness de ruta no se presenta como tiempo SQL.

### Crédito — objetivo <3 s no alcanzado

| Muestra | Readiness de ruta | Petición `/api/reportes/clientes` | DOM / tarea |
|---|---:|---:|---:|
| 0 | Bloqueada antes de completar login | No emitida | Sin medición válida |
| 1 | 11,005 ms | respuesta ~826 ms | 261,716 nodos; tarea ~9,994 ms |
| 2 | 9,804 ms | respuesta ~760 ms | 261,710 nodos; tarea ~8,910 ms |

El objetivo no se cumple y tampoco existe una serie de tres éxitos. La diferencia entre ~0.76–0.83 s de respuesta y ~9.8–11.0 s de readiness, junto con ~261 mil nodos y el tiempo de tarea/layout/estilos, ubica el coste dominante observado en construcción y renderizado del DOM, no en esperar exclusivamente la consulta.

**Propuesta, no implementada:** instrumentar y virtualizar/paginar filas de reportes y evitar montar tablas masivas ocultas, preservando agregados, filtros, exportación, cifras y significado financiero. No se cambió ninguna consulta ni componente de producto en este cierre.

### Corte — objetivo <2 s no acreditado

Una muestra llegó a cifras listas: ruta completa 4,653 ms y clic en “Realizar Corte” hasta cifras 945 ms. La segunda no alcanzó “Caja Operativa” en 20 s y la tercera no completó el formulario de login en 20 s. El clic interno observado es inferior a 2 s, pero la navegación completa no lo es y no hay tres muestras comparables; por tanto no se declara PASS.

### Estado de cuenta

La reanudación sí obtuvo una pantalla auténtica lista para el cliente sintético pequeño: 3,789 ms de ruta y 866 ms desde la pestaña hasta exportación y movimientos visibles. Esto supera el bloqueo histórico anotado en `PAUSA.md` para ese caso y no debe describirse como aún bloqueado.

El cliente sintético anual grande sí permaneció bloqueado: tras 20 s no apareció `e7-client-export`. Con una muestra pequeña lista y una grande bloqueada no existe serie final de tres ni base para atribuir el bloqueo anual a una consulta de movimientos.

Captura auténtica seleccionada: `continuacion/mediciones/small-0.png`. Corresponde al cliente sintético de reanudación; no es una recreación de UI ni información de una persona real.

### Cobro

Tres tickets sintéticos trazados a rollos de la recepción preparada se cobraron por la UI nativa en efectivo:

| Folio | Diálogo listo | Clic confirmar→éxito | Ruta lista |
|---:|---:|---:|---:|
| 1006 | 1,432 ms | 1,167 ms | 2,917 ms |
| 1007 | 1,959 ms | 319 ms | 2,492 ms |
| 1008 | 1,489 ms | 396 ms | 2,211 ms |

La verificación posterior encontró los tres tickets `cobrado=true`, tres pagos de $1,000.00 y la sesión 46 aún abierta en la copia `tanda_hr_browser`. Son tres resultados reales de navegador y persistencia en copia, no SQL directo y no operaciones sobre la base de la aplicación.

Captura auténtica seleccionada: `continuacion/mediciones/cash-0-native.png`; muestra el mensaje de cobro exitoso sobre datos sintéticos. Las capturas de readiness y las otras dos confirmaciones permanecen como evidencia, pero no se duplican aquí.

## 4. Permisos: alcance real, sin forzar puertas

Se autenticaron siete roles naturales. De 24 solicitudes únicas seleccionadas:

- 19 quedaron detenidas por guardas exteriores;
- 5 devolvieron 409 en la vía histórica;
- 0 alcanzaron una guarda interior nueva;
- 0 celdas directas/duales nuevas quedaron acreditadas.

El saldo directo es 381: 357 campos sin consumidor identificado, 18 guardas exteriores y 6 históricas. `permissions/owner-357.csv` contiene las 357 filas para decisión del propietario y `owner-questions.txt` las preguntas correspondientes. Hubo 11 controles positivos ADMIN y 23 observaciones UI, pero no se presentan como cobertura de las guardas seleccionadas.

No se modificaron matriz, roles, gates ni fuente para fabricar cobertura. No se desactivaron E3/E11 y no se demostró bypass.

## 5. Liberación efectiva

El candidato preservado por `2d8d522` se construyó desde fuente de productor idéntica a `c5ad7db`; typecheck de API y `node --check` pasaron una vez. El SHA-256 del entrypoint liberado es:

`7d5e47f61c1c9b9d78430e0f109d6e8fd4ad33f8ad0fc74c36ed100d601db366`

En `c637d33`, MAIN cambió únicamente la ruta del bundle en el artifact de API, validó el TOML y reinició una vez el workflow administrado. A las 16:36 UTC el log registró PID 2520; `/api/healthz` respondió HTTP 200 `{"status":"ok"}`. Se conservaron `API_INSPECTION_BOOT=1`, inicializadores/backfill/monitor pausados y las puertas existentes. No fue una publicación en nube.

## 6. Commits y trabajo exacto

| Commit | Trabajo |
|---|---|
| `c4365e9` | Inventario residual de permisos y CSV de 357 decisiones del propietario |
| `a369cc4` | Declaración exclusiva de los dos candidatos autorizados |
| `de4f31c` | Preparación aislada de carga anual y prueba semántica pareada |
| `c5ad7db` | Validación de cantidades físicas en `crearEntrada` |
| `f5ac3f6` | Ejecución de 24 intentos de permisos y documentación de bloqueos |
| `111c347` | Aplicación verificada del `CHECK` físico |
| `4186279` | Medición en copia, navegador y cobros nativos iniciales |
| `b77bd7d` | Registro histórico de pausa y teardown privado verificado |
| `2d8d522` | Build preservado de la API con la protección de `crearEntrada` |
| `eb93cad` | Copia aislada fresca para mediciones de reanudación |
| `d6faa70` | Aplicación verificada de los dos índices autorizados |
| `c637d33` | Liberación del bundle probado en el runtime activo |
| `b710555` | Mediciones acotadas finales de navegador: E7, cobro, crédito y corte |

## 7. Límites y cierre operativo

- No se inventa un PASS para crédito, corte, estado de cuenta anual ni permisos.
- No se implementaron optimizaciones de UI, cambios de consultas ni cambios adicionales de producto en el tramo final.
- Las capturas citadas son pantallas reales con fixtures sintéticos; no se recreó interfaz.
- `PAUSA.md` permanece como evidencia histórica; este informe es el estado vigente y supera sus pendientes de release/índices.
- MAIN completó el teardown a las 16:53 UTC. Se eliminó la raíz privada de reanudación; los puertos 55445 (PostgreSQL), 43874 (API) y 43884 (UI) quedaron cerrados; wrapper y ciclo de vida se detuvieron. La aplicación permaneció saludable: `/api/healthz` devolvió HTTP 200 después de la limpieza.
- Los handoffs, PID y rutas privadas de `continuacion/setup` describen recursos históricos ya destruidos; no son instrucciones reutilizables ni procesos vigentes. Los builds de aplicación se preservaron.

## Evidencia principal

- `application/physical-check-result.json`
- `tarea-1/producer-red.json`, `producer-green.json`, `check-copy.json`
- `tarea-2/paired-proof.json`, `business-paired-proof.json`, `pre.json`, `post.json`
- `continuacion/application/application-result.json`
- `continuacion/release/runtime-verification.md`
- `continuacion/mediciones/*.json`
- `continuacion/setup/teardown-final.json`, `teardown-verification.json`
- `permissions/RESULTADO.txt`, `runtime-summary.json`, `owner-357.csv`
