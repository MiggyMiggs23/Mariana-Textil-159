# Informe único — Tanda G

**Corte de evidencia:** 24 de septiembre de 2026 (UTC)
**Alcance:** informe y evidencia documental; este cierre no modifica producto, datos ni esquema.

## Dictamen ejecutivo

| Frente | Resultado |
|---|---|
| Catálogo real, sólo lectura | **0** productos activos habilitados para venta parcial (`se_vende_por_metro=true`). Hay **1,047** productos activos cuya unidad es `METRO`; `unidad=METRO` **no** equivale al indicador de venta parcial. |
| Casos 3 y 10 | **No ejecutados / excluidos**, como exige el alcance. No se presenta un “3/10” como prueba aprobada. |
| UI de salidas | **Corregida para las cuatro unidades**: METRO, KILO, BOLSA y PIEZA, tanto en creación como en detalle guardado. |
| Reversión estricta | **8 casos bloqueados** en candidato (1, 2, 4, 5, 6, 7, 8 y 9) más un control legado de caso 1. Cada rechazo dejó **107/107 tablas de negocio sin cambios**. |
| Ruta positiva | Evidencia fresca soporta reversión cronológica: venta → ajuste → activación, restaurando exactamente 12/DISPONIBLE, 10/DISPONIBLE y 10/PROGRAMADO. |
| Activación con cantidad negativa | **REPRODUCIDO, NO CORREGIDO:** METRO y KILO aceptaron `-2`, HTTP 200, estado DISPONIBLE y movimiento RECEPCION `-2`. Es diagnóstico, no parte de la corrección de reversión. |
| Liberación local | MAIN reinició una vez cada workflow con TOMLs validados. API PID 3575 arrancó a las 04:51:17 UTC con inspection boot, inicializadores pausados y health HTTP 200. La UI sirvió el login anónimo; no hubo sesión de aplicación. |

## 1. Catálogo real: el metraje elegible es cero

La inspección fue una transacción PostgreSQL `REPEATABLE READ READ ONLY`, terminada con `ROLLBACK`, sobre la conexión verificada del API efectivo. Contó **1,234** productos: **1,222 activos**, **12 desactivados** y ninguno con `activo IS NULL`.

Desglose activo: **1,047 METRO**, **162 KILO**, **5 BOLSA** y **8 PIEZA**. Los **1,047 METRO** tienen `se_vende_por_metro=false`; por tanto, el número real de productos activos elegibles para venta parcial es **0**, no 1,047. También hay **0** desactivados con el indicador habilitado. Tanda F registró igualmente 0 en su copia aislada; esa comparación es puntual, no una afirmación histórica.

Esto explica la exclusión del caso 3: no había candidato real elegible. El caso 10 también quedó fuera. No se habilitaron flags ni productos para fabricar cobertura.

## 2. Línea base y aceptación del candidato

La línea base congelada corresponde a `8e5dc4a3d5ffe33ea30dbd9ff2f170d7214390a5`. Sus ocho escenarios ejecutados (1, 2, 4, 5, 6, 7, 8 y 9) demostraron que invertir sólo el asiento podía conservar el caché igual al libro firmado y, aun así, dejar el rollo físico, su sitio o su estado divergentes. Ejemplos: el caso 1 introdujo deltas físicos/libro de `-10/+10`; el caso 6 terminó con cantidad física `-2`; el caso 9 dejó delta `+2`.

El candidato `61d82169e414354f8e613f53d583581f3d7955fb` exige evidencia durable de antes/después producida por la operación y coincidencia exacta del estado posterior. Resultado de la matriz estricta:

- **Casos 1, 6 y 7:** bloqueados porque el rollo ya no conserva exactamente sitio, cantidad y estado.
- **Casos 2, 4, 5, 8 y 9:** bloqueados por ausencia de evidencia íntegra aplicable a la operación completa.
- **Caso 1 legado:** bloqueado por carecer de evidencia del productor.
- En cada rechazo: **107/107 tablas públicas de negocio sin cambios**; secuencias excluidas del hash.

Las cuatro pruebas de integración del candidato aprobaron (**4/4**): cadena cronológica soportada, caso 6 sin disponibilidad negativa por reversión, igualdad de cantidad sin falsa equivalencia histórica y CANCELACION sin multiplicar el libro. Las mismas cuatro aserciones fallaron en la línea base (**0/4**), demostrando sensibilidad.

Además, dos comprobaciones de aceptación pasaron (**2/2**): restauración exacta de la cadena cronológica y reversión de activación fresca sin sucesores.

### Límite conservador, deliberado

No se afirma que todo movimiento histórico sea reversible. Se bloquean, con orientación a ajuste motivado:

- traslados compuestos cuando sólo existe evidencia de una pierna;
- movimientos históricos o nuevos sin evidencia íntegra de productor;
- `CANCELACION` genérica (evita una inversión de la inversión);
- cualquier movimiento con sucesores sin cancelar, **incluso si la cantidad y el estado visibles vuelven a coincidir**.

La salida operativa es cancelar operaciones posteriores en orden inverso cuando estén soportadas o registrar un ajuste nuevo con motivo. El saldo posterior del sitio/producto no prueba por sí solo el estado físico del rollo.

## 3. Ruta positiva

La prueba fresca creó un rollo en `10 / PROGRAMADO`, lo activó a `10 / DISPONIBLE`, ajustó a `12 / DISPONIBLE` y lo vendió en `12 / VENDIDO`. La reversión en orden inverso restauró:

1. venta → `12 / DISPONIBLE`;
2. ajuste → `10 / DISPONIBLE`;
3. activación → `10 / PROGRAMADO`.

Esto acredita soporte cronológico positivo para productores frescos con evidencia; no amplía el dictamen a traslados compuestos ni a historia legada.

## 4. UI: cuatro unidades

El commit UI `347b179` muestra totales separados de METRO, KILO, BOLSA y PIEZA. En navegador autenticado sobre copia desechable, la salida sintética de cuatro rollos mostró en la vista previa y en el detalle guardado: **4 rollos**, **10.00 metros**, **10.00 kilos**, **10.00 bolsas** y **10.00 piezas**. Las pruebas DOM del módulo de producción aprobaron **5/5**; combinadas con contratos de error, **9/9**. La sensibilidad mutante hizo fallar las aserciones precisas de PIEZA y luego se restauró el código.

Las tres capturas incrustadas en el HTML acompañante son la **evidencia auténtica del navegador candidato** (`candidate/browser/01-mixed-unit-preview.png`, `02-mixed-unit-saved.png` y `03-reversal-block.png`). El flujo fotografiado usa exclusivamente actores, sitios, productos, series y cantidades sintéticos; las imágenes no son reconstrucciones ni reemplazos de UI.

## 5. Hallazgo separado: cantidad física negativa

La activación autorizada de rollos PROGRAMADO se probó con `cantidadReal="-2"`:

| Unidad | HTTP | Antes | Después | Movimiento |
|---|---:|---|---|---|
| METRO | 200 | 10 / PROGRAMADO | **-2 / DISPONIBLE** | RECEPCION **-2** |
| KILO | 200 | 10 / PROGRAMADO | **-2 / DISPONIBLE** | RECEPCION **-2** |

El defecto queda **REPRODUCIDO y NO CORREGIDO**. Diagnóstico: la frontera de activación permite una cadena numérica sin restricción de no negatividad para METRO/KILO; el helper discreto retorna sin validar esas unidades. `ajustarRollo` sí rechaza un objetivo negativo y el consumo de venta limita la sustracción.

Importante: una cantidad física negativa es inválida; un movimiento firmado negativo puede ser legítimo en el libro. No deben confundirse ni prohibirse globalmente los asientos negativos.

### Nota de reproducibilidad del probe

El primer intento devolvió **404** porque el probe omitía el segmento `/inventario`. Eso fue un error de ruta del probe, **no una regresión del producto**. La verificación exitosa se hizo con la corrección en memoria y no se volvió a ejecutar ahora. Para reproducibilidad futura, `reports/tanda-g/setup/negative-api-probe.mjs` ya conserva la URL corregida; este cambio documental no altera los resultados registrados.

## 6. Notas de liberación

Cambios de fuente separados:

- **API `61d8216`** (`fix(inventory)`): reversión ordinaria exige evidencia física durable exacta.
- **UI `347b179`** (`fix(ui)`): totales separados para METRO, KILO, BOLSA y PIEZA.
- **Decisión `93b84e3`** (`docs`): límite conservador aceptado para reversibilidad de inventario.

La liberación fue únicamente al runtime local del workspace; **no hubo publicación en nube**.

## 7. Entregables y operación

- Backend estricto: `61d8216` — evidencia física durable y guardas de reversión.
- UI: `347b179` — totales separados de cuatro unidades.
- Decisión documental: `93b84e3`.
- Handoff UI: `c94928e`.
- Build API liberado localmente: `artifacts/api-server/dist-tanda-g-strict-candidate`, SHA-256 `103e5dce97fc463eafb33e0ec9ac283c3e3b16bd9c1220e928694e2be90deeec`, igual al bundle privado aceptado.
- Build UI liberado localmente: `artifacts/mariana-textil/dist-tanda-g-units-final`, `index.html` SHA-256 `8ec97388fd328068233eb0f0c6fbb89a82e5d16f72be50f3345e1049ee52292f`, copia exacta del candidato.
- **Sin migraciones**: se reutilizó auditoría JSON transaccional existente.
- MAIN reinició una vez cada workflow con TOMLs validados. El API inició a las **04:51:17 UTC**, PID **3575**, mantuvo `API_INSPECTION_BOOT=1`, dejó inicializadores pausados y respondió health **HTTP 200**. `released-login.jpg` prueba únicamente la pantalla anónima; no se inició sesión contra la aplicación.

Durante la ejecución hubo interrupciones del runtime de trabajos y recuperación posterior. Se conservaron los resultados durables citados; no se oculta la discontinuidad ni se interpreta como prueba de un reinicio limpio.

El teardown terminó a las 04:55 UTC. `teardown-verification.json` registra la detención del API de navegador y el proxy y `removed: true`; `teardown-final-check.json` confirma que `.local/tanda-g` y `.local/tanda-g-ui-candidate` ya no existen, que los builds de aplicación se preservaron y que los puertos **55441, 43840, 43841, 43842 y 43843** están cerrados. Las tareas launcher finalizaron. No se afirma un `pg_ctl` graceful: al terminar el shell del API, el clúster pudo finalizar antes de esa comprobación.

## 8. Higiene y recibo de evidencia

Antes del teardown se reescanearon los **65 archivos textuales** de `reports/tanda-g` contra las **9 contraseñas sintéticas exactas**: **0 coincidencias en 0 archivos**; el escáner no imprimió valores. Los nombres de actor, roles, IDs y sitios sintéticos son evidencia intencional y no se clasificaron como contraseñas. No se publicaron cookies, secreto de sesión ni URL con credenciales. El archivo privado de credenciales y el handoff que lo referenciaba son ahora sólo antecedentes históricos: `.local/tanda-g` fue eliminado.

Recibo principal:

- `catalogo-solo-lectura.json`: consulta, identidad, grupos y conteos.
- `baseline/summary.json`: ocho casos de línea base y conciliaciones.
- `candidate/acceptance-summary.json`: ocho bloqueos frescos + control legado, 107 tablas intactas.
- `candidate/backend-integration.tap`: 4/4.
- `candidate/baseline-negative-tests.tap`: 0/4 en baseline.
- `candidate/extra-acceptance.json`: 2/2 positivos.
- `candidate/negative-api-results.json`: METRO/KILO, HTTP 200, `-2`.
- `candidate/browser/*`: UI sintética y rechazo visible.

**Conclusión:** quedan listos los dos builds solicitados y está corregida la reversión ordinaria estricta y la UI de cuatro unidades. El soporte positivo se limita a cadenas frescas, simples y cronológicas con evidencia. Los compuestos, CANCELACION genérica, legado sin evidencia y coincidencias aparentes con sucesores se bloquean conservadoramente. La activación física negativa continúa abierta y no debe presentarse como corregida.