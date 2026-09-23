# Liberación E9, E7 y E11 — informe único

Fecha: 23 de septiembre de 2026. Procedimiento simple, con datos todavía de
prueba y sin purga. Autorización literal: `autorization.txt`.

> **Estado de este informe:** **E9 quedó BLOQUEADO y volvió a OFF en API/UI**.
> Su prueba con productor PostgreSQL real falló al autorizar; no se aplicó SQL
> en la base de la aplicación y el clúster desechable fue destruido. Conforme a
> la instrucción del propietario, no se repara ahora y se continúa con E7/E11.
> **E7 y E11 liberados y servidos** desde `dist-e7-e11-20260923`, con E9 OFF.
> Ambos workflows RUNNING; API salud HTTP 200. No se hizo publicación cloud.

## Resultado por tarea y commits

| Tarea | Resultado actual | Commit |
|---|---|---|
| 1. E9 entrega de corte a Mariana | **BLOQUEADA — OFF restaurado.** Implementación preservada, no liberada. Fondo permanece OFF. | `43946e3` |
| 2. E7 endpoints financieros | **LIBERADA.** Lectura financiera ON; atribución y operaciones E5 OFF. | `940e5d1` |
| 3. E11 asignación de perfiles | **LIBERADA.** Selector ADMIN ON; ningún usuario asignado. | `d98381a` |
| 4. Inventario E1–E12 e informe | **DOCUMENTADO**, con E9 detenido y E7/E11 servidos. | `4b1b598` |

Las cuatro tareas tienen commits separados. Un commit adicional de integración
conserva los bundles y TOML servidos y completa las referencias de este informe;
no abre ninguna puerta adicional.

## 1. E9 sin ingreso al Fondo

### Hasta dónde llega

La implementación preparada de E9 pretendía separar una **cadena documental
de custodia**:

1. ADMIN o SUPERVISOR de la tienda documenta el envío del efectivo físico
   canónico de un corte cerrado.
2. ADMIN cuenta lo recibido en Mariana.
3. ADMIN autoriza documentalmente la recepción.
4. Si lo recibido no coincide con lo enviado, se abre investigación, la
   autorización exige motivo y ADMIN puede cerrar después la investigación
   con su conclusión y evidencia.

El importe enviado proviene del corte congelado; no se captura libremente.
Reintentos, versión y concurrencia permanecen protegidos. El flujo no modifica
el corte cerrado, no descuenta caja por segunda vez, no ajusta automáticamente
una diferencia y no convierte la investigación en un movimiento financiero.

### Qué no hace sin Fondo

- No crea, consulta ni enlaza un movimiento del Fondo.
- No incrementa el saldo del Fondo ni lo presenta como efectivo conciliado de
  la empresa.
- No habilita E10, arqueo del Fondo, E12, pagos mixtos ni inversos por origen.
- No resuelve todavía la incorporación monetaria de la remesa. Esa conexión
  futura depende de E10 operativo y de conciliar el saldo inicial para no
  contar dos veces el mismo efectivo.

La llamada productiva que antes creaba un movimiento Fondo fue retirada y la
auditoría se separó como E9. Sin embargo, después del fallo de integración se
restauraron `E9_ENABLED=false` en API y UI; el ingreso Fondo también sigue
`false`. La implementación queda preservada, **no liberada ni incluida en el
candidato final E7/E11**.

El SQL preparado `reports/e9/03-desacoplar-fondo-preparado.sql` reemplazó en el
clúster desechable la validación E9 que exigía Fondo. No se aplicó a la base de
la aplicación.

Estado de evidencia:

- Backend aislado sin PostgreSQL real: **57/57 PASS**; no fue suficiente para
  acreditar el trigger.
- PostgreSQL desechable con productor real: ENVIAR y CONTAR con diferencia
  avanzaron correctamente; **AUTORIZAR falló** en `e9_validate_detail()` con
  PostgreSQL **22P02**, `invalid input syntax for type json`.
- Resultado terminal: `producerPass=false`, `failedOperation=AUTORIZAR`,
  `sqlAppliedInDisposable=true`, `realDatabaseSqlApplied=false`.
- Limpieza: `clusterDestroyed=true`; no quedó directorio
  `workspace-isolated-pg-*` bajo `/tmp`.
- Evidencia: `e9-sql/disposable-status.json` y
  `e9-sql/disposable-producer.log`.
- UI enfocada de la implementación preparada: **3 casos PASS** con verde,
  mutante rojo y fuente restaurada. Esto no supera el fallo PostgreSQL ni abre
  E9.

**Bloqueo exacto:** defecto técnico de `e9_validate_detail`, no una decisión
del propietario ni una dependencia del Fondo. No se corrigió el SQL, no se
aplicó a la base efectiva y no se sirve E9.

## 2. E7 financiero de clientes

E7 abre la lectura financiera autorizada de clientes:

- resumen global con exactamente **deuda actual, saldo a favor, límite de
  crédito y crédito disponible**;
- detalle de movimientos limitado a los sitios autorizados en servidor;
- proyección FIFO global antes de filtrar el detalle, para no presentar una
  deuda parcial como total;
- leyendas explícitas en pantalla y en XLSX/PDF/impresión: el resumen considera
  todos los sitios y el detalle no representa la deuda total;
- sesión vigente, permiso `clientes_finanzas.ver`, alcance resuelto por
  servidor y segunda autorización antes de entregar la respuesta.

E7 puede leer la evidencia ya instalada de recepciones retenidas para no
fabricar ceros ni esconder hechos existentes. **Leer esa evidencia no abre
E5**: dirigido, recepción/aplicación/devolución retenida, preparación por
ContadorA y todas las escrituras E5 permanecen OFF. También permanecen OFF la
atribución E7, Fondo y E12. La fuente falla explícitamente si falta la evidencia
requerida, en vez de inventar un saldo.

Fuente preparada con lectura E7 API/UI ON y
`E7_ATTRIBUTION_ENABLED=false`.

Estado de evidencia:

- Backend E7: **16/16 PASS**, incluidos cuatro importes globales, detalle por
  sitio, FIFO, reautorización, fuente E5, exports y atribución separada OFF.
- Contrato UI enfocado: **2/2 PASS**.
- Codegen y typecheck de librerías/API/UI: PASS informado por la tarea.
- SQL nuevo: **ninguno**; no se repiten los cinco SQL Tanda B instalados.
- UI enfocada y contrato: **PASS**. El candidato final E7/E11 quedó construido;
  servicio: **RUNNING, salud 200**.

## 3. E11: qué faltaba y qué decide el propietario

Los lectores fiscal/financiero saneado, la identidad y la conciliación
documental ya estaban ON. Faltaba separar la **herramienta de asignación** de
la operación E5.

La fuente ahora habilita el selector A/F para ADMIN:

- destino activo y con rol CONTADOR;
- motivo obligatorio, revisión esperada, CAS, historial e idempotencia;
- no ADMIN, destino inactivo/no CONTADOR y versión obsoleta no escriben;
- el cambio de rol o la desactivación revoca A de forma defensiva;
- habilitar el selector no concede `E5_PREPARAR`.

No se asignó ningún usuario. Habilitar la herramienta no decide nombres:
todo CONTADOR sin A expresa funciona como **ContadorF**; el propietario decide
manualmente qué personas concretas, si alguna, serán **ContadorA**. Esta es la
única actuación nominal pendiente del propietario, no una pregunta de diseño
ni un bloqueo para liberar el selector.

ContadorF continúa limitado a lo fiscal/facturado y la conciliación
documental. ContadorA obtiene lectura financiera saneada; no puede cobrar,
pagar, usar Fondo ni preparar E5 mientras
`E11_E5_PREPARATION_ENABLED`, `E5_ENABLED` y
`E5_CONTADOR_A_ENABLED` sigan OFF.

Estado de evidencia:

- E11 backend e integración: **71/71 PASS**, cero fallos y cero skips.
- Typecheck API/UI y `git diff --check`: PASS informado por la tarea.
- No fue necesario repetir SQL; el sidecar E11 está entre los cinco SQL Tanda B
  instalados.
- Asignaciones reales: **cero**.
- Integración indicada: **PASS**. El caso enfocado posterior a restaurar E9 OFF
  también pasó. Servicio: **RUNNING, salud 200**.

## 4. Qué queda del plan de doce entregas

“Aceptación” significa comprobación operativa o en pantalla; no se clasifica
como decisión de negocio del propietario.

| Entrega | Estado vigente | Qué queda | Qué la detiene |
|---|---|---|---|
| **E1** | Base y guardas de origen/naturaleza/evidencia instaladas | Cobertura real de notas con líneas/rollos, cancelación, concurrencia, reintentos y atomicidad. Históricos solo se atribuyen con evidencia real. | **Trabajo técnico**; el propietario solo reconoce hechos históricos concretos, no una política nueva. |
| **E2** | Lector de corte CLOSED liberado | Captura física general/devolución íntegra nunca aplicada y su evidencia. | **Trabajo técnico** y aceptación posterior. |
| **E3** | Abono ordinario desde Caja ON; dirigido OFF | Aceptación autenticada de cobro, saldo y recibo. Dirigido continúa con E5. | **Trabajo técnico**; rama dirigida depende de **E5**. |
| **E4** | Extraordinarias y proveedor desde caja ON, separado de E12 | Aceptación autenticada en las tres tiendas. | **Aceptación técnica**, no decisión. |
| **E5** | OFF | Integrar/activar dirigido retenido, propuesta, aplicación y devolución; cerrar fixture/suite. Puente ContadorA después. | **Trabajo técnico**; devolución desde Fondo depende de **E10**. P4–P7 ya están decididas. |
| **E6** | **Completa** | Nada. | Cerrada. |
| **E7** | Lectores financieros liberados ON; atribución OFF | La atribución integral posterior requiere la semántica E5. | **Trabajo técnico dependiente de E5**. |
| **E8** | **Completa** | Nada. | Cerrada. |
| **E9** | **OFF; liberación bloqueada.** Implementación documental preservada; ingreso Fondo OFF. | Corregir y volver a ensayar `e9_validate_detail`: AUTORIZAR falla 22P02 después de ENVIAR/CONTAR reales. Solo después podría retomarse la liberación documental. La incorporación monetaria seguiría dependiendo de E10. | **Defecto técnico pendiente**, no decisión del propietario. La conexión monetaria posterior depende de **E10**. P8 ya está decidida. |
| **E10** | Fondo construido y DDL instalado, pero OFF por cierre expreso vigente | Cuando se autorice, abrir movimientos, historial y arqueo juntos; conciliar saldo inicial sin duplicar Caja/remesas. | **Cierre del propietario**: no se autoriza abrir Fondo en esta tanda. Después habrá trabajo técnico y reconocimiento del importe físico real. |
| **E11** | Lectores/conciliación y selector A/F liberados ON; E5 preparación OFF | Aceptación por perfil. Elegir usuarios A reales. Puente A→E5 después. | Nombres A son **actuación del propietario**; puente depende de **E5**; aceptación es trabajo técnico. |
| **E12** | OFF; E4 ya cubre caja de forma independiente | Pago desde Fondo/caja/mixto e inversos atómicos por origen. | **Trabajo técnico dependiente de E10** y de su saldo físico conciliado. P12–P14 ya están decididas. |

No quedan pendientes de E6 ni E8. No deben reabrirse como dudas del
propietario las reglas P4–P14 ya contestadas. Tampoco se usa la falta de una
pasada autenticada como si fuera una decisión de negocio.

## Puertas que permanecen cerradas

Al terminar esta liberación deben seguir apagadas:

- E9 completo, incluida su cadena documental, por el fallo 22P02;
- Fondo/E10 y cualquier ingreso monetario E9;
- E5, dirigido, retenido, aplicación y devolución;
- atribución E7;
- preparación E11 de propuestas E5;
- E12, pagos con Fondo, mezclas e inversos por origen;
- purga general.

## Verificación UI consolidada

Resultado enfocado: **6 casos PASS** en componentes reales montados, cada uno
con verde, mutante semántico rojo y fuente restaurada, en una copia física
aislada sin cambios durante las corridas.

Tres casos E9 acreditan únicamente la implementación preparada:

- ningún actor ve identificador o enlace Fondo conservado en caché;
- autorizar documentalmente invalida E9/cortes, no Fondo;
- la respuesta autorizada conserva investigación y no reabre acciones.

Estos tres casos no constituyen una suite E9 completa y no superan el fallo del
productor PostgreSQL. E9 continúa OFF.

Tres casos E7 acreditan:

- exactamente cuatro cifras globales y ninguna consulta paralela al lector
  legado;
- enlaces PDF, XLSX e impresión con el sitio autorizado;
- bloqueo de una respuesta perteneciente a otro cliente y ausencia de acciones.

El contrato estático E7 pasó **2/2** y el typecheck UI pasó. La modalidad
enfocada no vuelve a acreditar los bytes históricos PDF/XLSX; acredita el
consumo del JSON, la UI y el contexto de enlaces. Un intento previo rechazado
por una huella histórica no se presenta como PASS.

Evidencias de soporte: `ui-release-contract.log`, `ui-typecheck.log`,
`ui-command-status.txt` y los manifiestos aislados conservados por MAIN. No se
ejecutaron workflows, navegador autenticado, usuarios, sesiones ni escrituras
en base de datos. `ui-verification.md` conserva la cronología técnica; este
apartado es la narrativa única para el propietario.

## Build y runtime

El build anterior `dist-e9-e7-e11-20260923` se generó offline antes del ensayo
PostgreSQL, con E9 ON. **Queda descartado y no debe servirse**: el resultado de
build no acredita el trigger que después falló. Sus comandos terminaron con
API exit 0 y UI exit 0; se preservaron sus logs y hashes bajo nombres
`build/discarded-e9-on-*`, y `build/discarded-attempt-status.log` registra que
su uso está prohibido.

Tras restaurar y verificar E9 OFF se construyó el candidato final
`dist-e7-e11-20260923`, que conserva:

- E9 API/UI OFF e ingreso Fondo OFF;
- E7 lectores API/UI ON y atribución OFF;
- E11 lectores, selector de perfiles y conciliación ON; preparación E5 OFF;
- E5 operativo, Fondo/E10 y E12 OFF;
- E4, E3 ordinario/matriz y remate/precio mínimo/borrado individual ON;
  dirigido OFF.

El typecheck combinado se ejecutó una sola vez, antes del resultado terminal
del productor E9, y terminó con 0 diagnósticos TypeScript. No se repitió tras
restaurar los dos booleanos E9 a `false`. Los comandos finales, ejecutados desde
`/home/runner/workspace`, fueron:

```sh
API_BUILD_OUTPUT_DIR="$PWD/artifacts/api-server/dist-e7-e11-20260923" NODE_ENV=production node artifacts/api-server/build.mjs
(cd artifacts/mariana-textil && BASE_PATH=/ NODE_ENV=production PORT=20329 pnpm exec vite build --outDir dist-e7-e11-20260923)
```

Estado final del build offline: **PASS**. Entradas:

- API: `/home/runner/workspace/artifacts/api-server/dist-e7-e11-20260923/index.mjs`
- UI: `/home/runner/workspace/artifacts/mariana-textil/dist-e7-e11-20260923/index.html`

El bundle API contiene 12 archivos y el UI 11; los 23 hashes están en
`build/build-bundles.sha256`. Los bundles anteriores, incluido el intento
descartado, fueron preservados. Evidencia final:

- `build/typecheck-combined.log`: typecheck combinado PASS, exit 0.
- `build/build-gates.log`: puertas finales E7/E11 ON y E9 OFF, PASS.
- `build/build-api.log`: build API final PASS, exit 0.
- `build/build-ui.log`: build UI final PASS, exit 0.
- `build/build-output.log`: entradas, conteos e inventario de bundles.
- `build/build-bundles.sha256`: SHA-256 del candidato final.

Advertencias no fatales: Vite informó sourcemaps sin ubicación original en
cinco componentes UI y un chunk superior a 500 kB. La salida API marcó el
bundle principal de 9.0 MB con advertencia de tamaño. Ambos builds finales
terminaron correctamente.

Durante el build no se inició ni reinició ningún workflow, no se accedió a una
base y no se aplicó ni reparó SQL. Posteriormente MAIN validó ambos TOML para
servir únicamente `dist-e7-e11-20260923` y reinició una vez cada workflow.

## Cierre operativo realizado

- API PID observado 41386; inicializadores, backfill y monitor permanecen
  pausados por INSPECTION. `/api/healthz`: HTTP 200, `{"status":"ok"}`.
- Ambos workflows RUNNING con el candidato final E7/E11 y E9 OFF.
- `/api/e7/disponibilidad`: `{"enabled":true,"clienteFinanzas":true,"atribucion":false}`.
- La consulta sin sesión a atribución responde 401. Eso acredita autenticación,
  no el gate; atribución OFF se acredita por fuente, pruebas y build.
- Captura visual de login correcta; no hubo login del agente, asignaciones
  reales ni operaciones financieras de prueba en la base de la aplicación.
- Evidencia de arranque: `runtime-api.log` y `runtime-ui.log`.
- E9 permanece detenido; no se aplicó SQL a la base de la app ni se reparó
  el fallo durante esta tanda.

No se declara aquí un recorrido financiero autenticado completo ni una
publicación cloud.