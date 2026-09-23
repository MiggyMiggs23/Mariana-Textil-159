# E9 corregido; E5 y atribución E7 — informe único

Fecha: 23 de septiembre de 2026. Procedimiento simple mientras los datos siguen
siendo de prueba. Autorización literal: `autorizacion.txt`.

## Resultado ejecutivo

| Tarea | Resultado | Commit |
|---|---|---|
| E9 documental | **LIBERADO**, SQL efectivo COMMIT y API/UI servidos. Ingreso al Fondo OFF. | `5037b42` |
| Integración E5 | **PASS del ciclo ensayado en PostgreSQL desechable; producción sigue OFF por decisión expresa.** | `f5e1e66` |
| Atribución E7 | **LIBERADA**, backend, PostgreSQL y UI enfocada verificados. Es lectura, no atribución histórica ni productor E5. | `664cda2` |
| Informe e integración | Este informe, reglas vigentes, configuración y candidato servido. | Commit de cierre que contiene este informe; el hash se comunica en la entrega. |

No se abrió recepción, aplicación, devolución ni preparación ContadorA de E5.
Retiro dirigido y retenido siguen cerrados. También permanecen apagados Fondo,
ingreso E9 al Fondo, atribución histórica E1 y E12.

## 1. E9: causa exacta y corrección

El `22P02` no provenía del importe, UUID ni conteo. La expresión de
`e9_validate_detail()` era:

```sql
d->'investigacion'-ARRAY['estado','cierre']
```

Por precedencia de operadores PostgreSQL interpretó el literal exacto
`investigacion` como operando **jsonb** de `jsonb - text[]` e intentó convertir
ese texto a JSON. El diagnóstico fue `Token "investigacion" is invalid`.
La operación requerida era extraer primero el objeto JSONB
`detail.investigacion` y después quitarle las claves `estado` y `cierre`.
Se corrigieron el valor nuevo y el anterior:

```sql
((d->'investigacion')-ARRAY['estado','cierre'])
((oldd->'investigacion')-ARRAY['estado','cierre'])
```

### Ensayo PostgreSQL desechable

`lib/db/src/run-e9-isolated-tests.mjs` preparó esquema y seed canónicos, aplicó
el SQL E9 y la corrección, y ejecutó el productor y repositorio reales. Cubrió:

- envío por SUPERVISOR del mismo sitio;
- conteo y autorización por ADMIN;
- faltante y sobrante con investigación y cierre documental;
- replay idempotente de envío y autorización;
- rechazo entre sitios y rechazo de ADMIN falsificado contra el rol de DB;
- rollback atómico al forzar fallo de auditoría;
- corte cerrado sin cambios;
- cero filas y cero enlaces de Fondo.

Resultado: `E9_DISPOSABLE_PG_PASS` y
`E9_DISPOSABLE_CLUSTER_DESTROYED_PASS`. Además, unitarias E9 **57/57 PASS**,
contrato combinado de gates **9/9 PASS** y typecheck API/UI PASS. La UI enfocada
aprobó **6/6 obligaciones seleccionadas**, cada una con verde, mutante rojo y
restauración.

### SQL efectivo

Con la autorización de esta tanda se aplicó **una sola vez y únicamente**
`reports/e9/03-desacoplar-fondo-preparado.sql` corregido a la base efectiva de
la API, identificada como `heliumdb`, PID observado 41386.

PostgreSQL registró `BEGIN / SET / DO / CREATE FUNCTION / COMMIT`. Antes:
`buggyExpression=true` y paréntesis ausentes; después:
`buggyExpression=false` y paréntesis presentes. Cambió el hash de la función.
`e9_entregas` y `fondo_movimientos` conservaron conteo 0 y la misma huella.
No se creó operación de negocio, no se repitieron los SQL Tanda B y no se hizo
purga.

E9 queda preparado ON para documentar envío, conteo, autorización e
investigación sin modificar el corte ni volver a descontar caja.
`E9_FONDO_INGRESS_ENABLED=false`: autorizar custodia **no ingresa efectivo al
Fondo**.

Evidencia: `e9/disposable-status.json`, `e9/disposable-producer.log`,
`e9/live-status.json` y `e9/live-sql.log`.

## 2. Atribución E7 de solo lectura

`E7_ATTRIBUTION_ENABLED=true` en API/UI. Esta atribución es una consulta
financiera por periodo y alcance; no escribe `atribuciones_credito_e1`, no
recibe dinero, no aplica retenidos y no habilita ningún comando E5.

La ruta:

- exige sesión vigente y permisos;
- resuelve el alcance de sitio en servidor y lo revalida antes de responder;
- proyecta FIFO global antes de filtrar el detalle;
- conserva las cuatro cifras globales autorizadas;
- ejecuta SQL real bajo `REPEATABLE READ READ ONLY`;
- no fabrica ceros si falta la fuente E5 instalada;
- conserva las leyendas de resumen global y detalle limitado por sitio.

Resultados: backend E5/E7 **65/65 PASS**, contrato UI **2/2 PASS**, contrato
conjunto de gates **9/9 PASS**, typecheck API/UI PASS y PostgreSQL desechable
PASS con tablas E5/crédito sin cambios y clúster destruido.

El candidato offline `dist-e9-e7-20260923` contiene lectores y atribución E7 ON.
El build API/UI terminó PASS, con 12 y 11 archivos y 23 hashes.

### Verificación UI enfocada

Ocho obligaciones E7 completaron verde, mutante rojo y restaurado: no duplicar
cobranza por aplicaciones, límite por sitio, rango, scope, montaje padre,
leyendas, veto independiente a CONTADOR y cierre por disponibilidad.

Los dos controles verdes inicialmente fallidos eran problemas del arnés:

- `E7-COUNTER-BOUNDARY` montaba la pestaña `datos`, donde el lector ya no
  existe, y además repetía una frontera superior ya acreditada. El arnés ahora
  monta el padre real en `?tab=estado`.
- `E7-AVAILABILITY` esperaba el mensaje antiguo; se alineó con el texto vigente
  que declara el cierre y la ausencia de una fuente alternativa.

La reconfirmación enfocada de ambos terminó
`PASS_SELECTED_ONLY_NOT_FULL_E7`, con verde, mutante semántico rojo y fuente
restaurada. No cambió código productivo y los 23 hashes del bundle permanecen
idénticos. Los seis casos individuales anteriores siguen vigentes; no se
presenta esta reconfirmación enfocada como una nueva corrida completa.

## 3. Integración E5: hasta dónde llegó y qué la detiene

Producción conserva `E5_ENABLED=false` y `E5_CONTADOR_A_ENABLED=false`.
En PostgreSQL desechable se retiró **solo allí** el cierre general `e5_closed`;
las guardas E1, dirigido, retenido, grafo, procedencia e inmutabilidad siguieron
activas.

Resultados del ciclo real:

- `RECIBIR -> PROPONER`: PASS, con documento e historial;
- `RECIBIR -> DEVOLVER` por cuenta bancaria evidenciada: PASS, sin Caja ni
  Fondo;
- `AUTORIZAR/APLICAR`: PASS, incluida la aplicación de crédito sin un segundo
  ingreso, vínculo E5 y un único marcador dirigido.

La incompatibilidad E1 observada inicialmente era un defecto exclusivo de la
instantánea de ensayo: allí `movimientos_credito.es_incobrable` carecía del
`DEFAULT false` canónico. Como el adaptador omite correctamente esa columna, el
fixture guardaba `NULL`; `m.es_incobrable=false` evaluaba `NULL` y el
`coalesce(...,false)` cerraba la fuente. Clave, importe, cliente, sitio, fecha,
snapshot, propuesta y marca de procedencia eran todos correctos.

El runner ahora restaura únicamente el default canónico. No se relajó
`e5_owned_credit_source`, no se usó `xmin`, no se rellenó evidencia histórica
y no se abrió ninguna guarda de retenido o dirigido.

También se corrigieron en las copias preparadas colisiones PL/pgSQL entre
variables `record` y aliases de `e5_graph_guard`; **ningún SQL E5 se aplicó a
la base de la aplicación**.

Resultado PostgreSQL: `E5_RECEIVE_PROPOSE_APPLY_REFUND_E7_DISPOSABLE_PASS` y
`E5_E7_DISPOSABLE_CLUSTER_DESTROYED_PASS`. Los contratos dirigidos enfocados
terminaron **6/6 PASS**, actualizados a la composición vigente del tab compuesto
`clientes` y a la exportación compartida.

La integración E5 ya no tiene un bloqueo técnico en este alcance. Producción
sigue OFF porque el propietario mantuvo cerrados retiro dirigido y retenido;
el PASS aislado no sustituye esa decisión ni autoriza activar los productores.
Antes de una futura apertura autorizada quedará aplicar y verificar la corrección
SQL preparada de E5; la función instalada no fue modificada en esta tanda.

Evidencia: `e5-e7/resultado.md`, `e5-e7/e5-lifecycle-disposable-pg.log` y los
logs enfocados del mismo directorio.

## 4. Puertas finales

| Capacidad | Estado de fuente/candidato |
|---|---|
| E9 envío, conteo, autorización e investigación documental | ON |
| Ingreso E9 al Fondo | **OFF** |
| Lectores financieros E7 | ON |
| Atribución E7 de solo lectura | ON; pruebas enfocadas PASS |
| Operaciones E5 | **OFF** |
| E5 para ContadorA / preparación E11 | **OFF** |
| Retiro dirigido y retenido | **OFF por decisión del propietario** |
| Atribución histórica E1 | **OFF** |
| Fondo/E10 y E12 | **OFF** |

## 5. Build, runtime y commits

Build offline: **PASS** en:

- `artifacts/api-server/dist-e9-e7-20260923/index.mjs`
- `artifacts/mariana-textil/dist-e9-e7-20260923/index.html`

Gates del bundle: E9 ON/Fondo OFF; E7 lectura+atribución ON; E5 OFF; E11
perfiles ON/preparación E5 OFF. Los bundles anteriores se conservaron.

**Cierre operativo realizado:** ambos TOML se validaron para servir
`dist-e9-e7-20260923` y cada workflow se reinició una vez. Ambos están RUNNING.
API PID observado 50695; `/api/healthz` respondió 200 con `{"status":"ok"}`.
Los inicializadores, backfill y monitor siguen pausados por INSPECTION.
`/api/e7/disponibilidad` devuelve `enabled:true`, `clienteFinanzas:true`,
`atribucion:true`. La captura de login es correcta; el 401 sin sesión es esperado.
Los gates restantes se acreditan por fuente, pruebas negativas y build, no por
interpretar un 401 como cierre de una operación.

Logs de servicio: `runtime-api.log` y `runtime-ui.log`. Los directorios originales
de ensayos UI quedaron archivados con sus rutas completas en
`ui-evidence-originals.tar.gz`; se retiraron solo sus copias de trabajo.

E5 operativo debe permanecer OFF: su integración pasó, pero retiro dirigido y
retenido conservan el cierre explícito del propietario.

No se declara aquí recorrido autenticado completo en navegador, apertura E5,
movimiento Fondo ni publicación cloud.