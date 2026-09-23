# Tanda E · tarea 2 · ambigüedades de aliases PL/pgSQL

## Resultado

**Defectos DDL reales confirmados; no son un problema de fixture.** Se
aplicaron las correcciones estrechas autorizadas que sólo renombran aliases SQL
locales. No se cambió ningún predicado, regla, gate ni
`plpgsql.variable_conflict`.

La aplicación se hizo después de la autorización escrita expresa del
propietario para estos dos objetos y únicamente contra la conexión efectiva del
proceso API. No se ejecutaron seeds, purgas, logins ni escrituras de negocio.

## Hallazgo original, sin tocar la base efectiva

Durante la preparación de la copia restaurada de `heliumdb`, una transacción que tocó las tablas vigiladas por el trigger diferido `e11_graph` falló al confirmar con:

```text
ERROR: column reference "a.conciliacion_id" is ambiguous
DETAIL: It could refer to either a PL/pgSQL variable or a table column.
QUERY: EXISTS (
  SELECT 1
  FROM public.notificaciones_sistema n
  WHERE n.tipo='E11_NO_CUADRA'
    AND NOT EXISTS (
      SELECT 1
      FROM public.e11_avisos a
      WHERE a.conciliacion_id::text=n.entidad_id
    )
)
CONTEXT: PL/pgSQL function public.e11_graph() line 162 at IF
```

La definición se leyó después de forma read-only desde la base efectiva. Declara
`a record` en `DECLARE` y contiene dos subconsultas interiores que vuelven a
declarar `e11_avisos a`. La extracción original de la función instalada tiene
SHA-256
`9e35b48699dc95a4ee78926b3a85dda80738cff9e40cc9c5e61ba78acf3fb05f`
y, salvo el envoltorio normalizado de `pg_get_functiondef`, coincide con el DDL
propietario `reports/e11/01-preparado.sql`. Por ello no fue causado por datos de
fixture ni por una función fabricada durante el restore: es un **defecto real
del DDL instalado**. Que una sentencia concreta llegue al primer o segundo
fragmento depende de los datos recorridos, pero el conflicto pertenece a la
definición.

## Workaround de fixture frente a arreglo estrecho

La primera carga de fixtures se completó con `SET LOCAL session_replication_role=replica` exclusivamente dentro de la transacción desechable de fixtures. Eso fue un workaround de preparación para no ejecutar triggers de negocio al insertar el catálogo sintético; no es un arreglo aplicable al vivo ni a runtime.

Se descartó una relajación `plpgsql.variable_conflict=use_column`. No existe
una entrada `plpgsql.variable_conflict=%` en `pg_proc.proconfig`; en los objetos
efectivos `proconfig` conserva únicamente `search_path=pg_catalog`.

La corrección E11 preparada renombra los dos aliases SQL interiores, sin cambiar
variables, predicados ni datos:

```diff
- FROM public.e11_avisos a WHERE a.id=...
-   AND a.decision_id=... AND a.conciliacion_id=... AND a.birth_xid=...
+ FROM public.e11_avisos aviso WHERE aviso.id=...
+   AND aviso.decision_id=... AND aviso.conciliacion_id=... AND aviso.birth_xid=...

- NOT EXISTS (SELECT 1 FROM public.e11_avisos a
-             WHERE a.conciliacion_id::text=n.entidad_id)
+ NOT EXISTS (SELECT 1 FROM public.e11_avisos aviso
+             WHERE aviso.conciliacion_id::text=n.entidad_id)
```

SQL preparado:
`tarea-2/01-corregir-e11-graph-alias.sql`. Obtiene la definición instalada,
exige exactamente una aparición de cada uno de los dos fragmentos y falla
cerrado ante cualquier deriva antes de ejecutar `CREATE OR REPLACE`. También
rechaza una configuración por función de `plpgsql.variable_conflict`.

Prueba aislada:
`tarea-2/02-prueba-aislada-e11-graph-alias.sql`. En PostgreSQL 16.10 (`160010`)
se observó primero `42702` sobre `a.conciliacion_id`; después de ejecutar el SQL
preparado, las dos subconsultas se evaluaron y se insertaron las dos filas
positivas. El negativo semántico conservó el rechazo
`E11: notificación huérfana`; la fila negativa no se insertó. Resultado final:
`2` positivas y `0` negativas.

## Segundo defecto revelado por el navegador real: `e5_graph_guard()`

El login real no falló finalmente en E11. El `COMMIT` de autenticación activó
el constraint trigger diferido E5 y devolvió HTTP 500:

```text
column reference "a.id" is ambiguous
PL/pgSQL function public.e5_graph_guard() line 180 at IF
```

La consulta exacta era la comprobación de huérfanos de
`operaciones_credito_e1` contra `e5_aplicaciones a`. La función instalada
declara también `a record`. La copia restaurada conservaba además otros aliases
locales `a`, `d`, `m` y `v` que chocaban con variables `record`; arreglar sólo
el primero habría dejado fallos diferidos posteriores.

Esto tampoco fue un defecto del fixture: el DDL histórico instalado en
`reports/tanda-b-b0-b1-20260923/sql/4.sql` contiene esas colisiones. El DDL
propietario posterior `reports/e5/01-preparado.sql` ya muestra los nombres
estrechos (`app_source`, `credit_source`, `credit_link`,
`linked_application`, `bank_refund`, `document_application`,
`authorized_application` y `application_link`), pero esa edición de fuente no
reemplazó por sí sola el objeto instalado.

`tarea-2/03-corregir-e5-graph-aliases.sql` traslada exclusivamente esos seis
fragmentos de aliases a la función instalada. Cada fragmento debe aparecer una
sola vez; cualquier deriva aborta toda la transacción. No incorpora los cambios
de paréntesis `CASE` ni ninguna regla ajena.

La misma corrección E5 se probó además en un clúster PostgreSQL 16.10 propio,
restaurado desde el dump previo a fixtures. El negativo anterior reprodujo
`42702` sobre `a.id`; la misma escritura no-op, forzando exclusivamente
`e5_graph` a `IMMEDIATE`, pasó después de la corrección y terminó en `ROLLBACK`.
Una reaplicación del SQL se detuvo por la guarda del primer fragmento y no
modificó la función. El clúster se destruyó al terminar.

## Comprobación de la copia desechable del navegador

Con el navegador pausado se comprobó primero
`current_database()=tanda_e_e2e_copy`; nunca se escribió `heliumdb` ni la base
de la API. Se aplicó allí únicamente la corrección E5 preparada. La inspección
posterior encontró cero aliases restantes `e5_aplicaciones a` y `proconfig`
conservó sólo `search_path=pg_catalog`.

Una autenticación HTTP real con la credencial sintética CAJA, sin imprimirla,
pasó de **500** a **200** y el logout devolvió **204**. Por tanto la copia queda
lista para que el mismo tester continúe; esto prueba el desbloqueo del login en
la copia, no una liberación de producción.

## Error de presentación del login

`artifacts/mariana-textil/src/pages/login.tsx` trataba cualquier error sin
mensaje público como “Usuario o contraseña incorrectos”, incluso un HTTP 500.
Ahora usa el `status` tipado del `ApiError`: para `>=500` muestra “No se pudo
iniciar sesión por un error del servidor. Intenta de nuevo.”; mantiene el
mensaje de credenciales para 401 y no expone SQL ni detalles internos.

## Aplicación efectiva autorizada

El destino se obtuvo en memoria de `DATABASE_URL` del proceso API PID 174, cuyo
comando era `artifacts/api-server/dist-e9-e7-20260923/index.mjs`; no se tomó una
base Neon por su nombre ni se imprimió la URL. El preflight read-only confirmó
`current_database()=heliumdb`, PostgreSQL `160010` y
`transaction_read_only=on`.

Las definiciones efectivas anteriores coincidieron byte por byte con las
definiciones ya ensayadas:

- E11 antes:
  `9e35b48699dc95a4ee78926b3a85dda80738cff9e40cc9c5e61ba78acf3fb05f`.
- E5 antes:
  `dc55302b02ca06f9dcfb36af081cdc5eae22625b262d07e3b27020c87b287e86`.

Ambos operadores devolvieron exactamente:

```text
BEGIN
DO
COMMIT
```

Las definiciones exactas posteriores tienen SHA-256:

- E11:
  `16fbd751acc1859a08135b9d60846ec982f4e2b3f844635bed5a48ebe0af7df6`.
- E5:
  `96d2a48151d33634305b4491c337d6ad64205918a01b205bc97100b51d312f86`.

El diff completo antes/después contiene sólo los aliases descritos: dos
fragmentos E11 y seis fragmentos E5. La lectura posterior encontró cero
apariciones de los aliases conflictivos y ambas funciones conservaron
`search_path=pg_catalog`; no existe ajuste `plpgsql.variable_conflict`.

Los gates permanecieron iguales antes y después:

- bundle efectivo:
  `0ab4912e9eb9d83778b32d9fe6ea5394d55c82aeab2089f4ba052af266945b9e`;
- `e5-feature.ts`:
  `646fa375b6402e98994104e7c023854ef229c167388cd1a1ff3159afbe1d071d`;
- `e11-feature.ts`:
  `20c9c260e125453875f9eeeed1860fdd2a61d9011745d33d57d074a090274a68`.

E5 continúa OFF y la preparación E11/E5 continúa OFF; esta corrección DDL no
abrió puertas. No se reinició workflow, API, navegador ni preview. No se hizo
login contra la base efectiva.

## Prevención de recurrencia

`reports/e11/01-preparado.sql` quedó corregido con los mismos dos aliases E11.
`reports/e5/01-preparado.sql` ya contenía los aliases E5 estrechos y no requirió
edición. Los paquetes históricos instalados se conservaron como evidencia del
before-state; no se reescribieron.

## Bloqueador posterior del navegador: validación de precio POS

El siguiente HTTP 500 del copy no provenía de las funciones E11/E5. Los dos
intentos reales de `/api/pos/validar-precio` —precio de lista `150.00` y bajo
costo `90.00`— fallaron en `loadActiveRemateRollIds` con:

```text
malformed array literal: "6243"
WHERE rollo_id = ANY(($1)::int[])
params: 6243
```

La interpolación de Drizzle recibió `ids=[6243]`, pero serializó el único
elemento como parámetro escalar; PostgreSQL no puede convertir el escalar
`"6243"` a `int[]`. Se corrigieron las dos rutas que compartían el defecto
(prevalidación y creación del ticket) para expandir sólo los enteros ya
filtrados:

```sql
WHERE rollo_id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
```

No cambia la política: a precio no bajo costo la decisión sigue permitida; a
precio bajo costo cada rollo sigue necesitando una marca activa de remate. CAJA
continúa sin permiso POS; no se amplió ningún rol. El botón `Caja operativa`
sólo selecciona la vista operativa mediante estado local y, si esa vista ya
está seleccionada, un segundo clic no produce navegación ni diálogo.

Se añadió una regresión que exige las dos expansiones escalares y prohíbe el
patrón `ANY(${ids}::int[])`; pasó `6/6` tanto en fuente principal como en el
snapshot aislado. El typecheck API pasó. Una consulta read-only del mismo
predicado en `tanda_e_e2e_copy` aceptó el entero y devolvió cero marcas para el
rollo no-remate, como corresponde.

El snapshot API aislado fue reconstruido en:

`/.local/tanda-e-20260923/tarea-1/source-38dff5e8/artifacts/api-server/dist/index.mjs`

SHA-256:
`ce3bb215aa3f0e8857cf618f99d8b6687ede732f519d17bc0f3b4cf12cf4ecbe`.
La reconstrucción no reinició el proceso API aislado PID 8771. El operador de
setup/MAIN debe reiniciar únicamente ese launcher antes de pedir la
reconfirmación al mismo tester; no se tocó el workflow ni el bundle efectivo.

## Bloqueador posterior del navegador: E4 CAJA

El flujo E4 permitido para CAJA se detenía antes del POST porque el panel
revalidaba el saldo mediante `GET /sesiones-caja/{id}/corte`. Esa ruta es el
corte administrativo completo y conserva correctamente `cortes:ver`; CAJA
recibió HTTP 403. No se amplió el rol ni se relajó ese endpoint.

El panel E4 ahora consume el endpoint operacional ya existente
`GET /sesiones-caja/actual`, protegido por `cobros_pagos:ver`, que ya entrega el
saldo mínimo necesario en `resumen.efectivoEsperado`. Antes de crear la salida,
el cliente vuelve a consultar y exige que la sesión devuelta sea exactamente la
sesión abierta del panel. La API del POST continúa siendo la autoridad final
para saldo, ubicación, idempotencia y desbloqueo ADMIN.

La obligación `E4-CAPTURE-PERMISSION` ahora cubre que CAJA sin `cortes:ver`
puede preparar una salida dentro de saldo usando la lectura operacional y que
el panel no invoca `useObtenerCorteCaja`. El conjunto frontend E4 y sus mutantes
pasó. El typecheck de la fuente principal pasó; el typecheck directo del
snapshot histórico no es utilizable por declaraciones de librerías no
construidas preexistentes, pero su build Vite aislado terminó correctamente.

Se reconstruyó el UI aislado en
`.local/tanda-e-20260923/tarea-1/source-38dff5e8/artifacts/mariana-textil/dist/public`.
El mismo reinicio aislado pendiente para cargar el bundle API POS debe hacerse
una sola vez después de esta reconstrucción. No se alteraron permisos,
endpoints de corte, ledger, SQL ni datos del copy.

## Reconfirmación final del navegador real

El mismo tester reanudó sobre la misma copia y confirmó los dos arreglos:

- POS encontró el rollo y `POST /api/pos/validar-precio` respondió correctamente;
  el precio normal habilitó la confirmación.
- El rollo no marcado a `90.00` fue denegado explícitamente por bajo costo.
- El rollo marcado a `90.00` pasó la validación de remate.
- CAJA ya no quedó bloqueado por `cortes:ver`. Con saldo real `0.00`, su salida
  E4 de `25.00` alcanzó la API y fue denegada por insuficiencia, sin fila.
- ADMIN creó y aceptó el desbloqueo genuino `25.00 > 0.00`; el esperado quedó
  en `-25.00`.
- El cierre final conservó Fondo `500.00`, salidas físicas `525.00`, esperado
  `-25.00`, contado `0.00` y diferencia `25.00`; la sesión quedó `CERRADA`.

La creación de tickets reveló después `Falta evidencia de entrada/proveedor
para la línea 369.` en `supplier-trace.ts`. Es una carencia de procedencia de
los fixtures sintéticos. La guarda real se conserva intacta; el worker de setup
repara exclusivamente la procedencia del copy.

### Atribución del `REVISION_OBSOLETA` observado antes del cierre

No fue una respuesta del endpoint de cierre ni evidencia de un payload de corte
obsoleto. El log privado permite separar los requests:

- a las `22:50:05`, `GET /api/e11/identidad` devolvió HTTP 409 y produjo el
  mensaje global `REVISION_OBSOLETA`;
- no hubo `POST /api/sesiones-caja/46/cerrar` con 409;
- tras recargar, la identidad E11 volvió a 200;
- a las `22:50:55`, el único `POST /api/sesiones-caja/46/cerrar` devolvió 200.

Por tanto, la protección de revisión E11 actuó como guarda y la recarga fue la
recuperación prevista. El cierre no falló en servidor y no se hizo un arreglo
especulativo de Caja.

## Registro del SQL realmente aplicado

Las cargas ejecutadas contra la conexión efectiva fueron exactamente los
operadores guardados en:

- `reports/tanda-e-20260923/tarea-2/01-corregir-e11-graph-alias.sql`;
- `reports/tanda-e-20260923/tarea-2/03-corregir-e5-graph-aliases.sql`.

Cada operador abrió transacción, obtuvo `pg_get_functiondef`, exigió una sola
aparición de cada fragmento original, ejecutó `CREATE OR REPLACE` mediante la
definición corregida, rechazó cualquier `plpgsql.variable_conflict` y terminó
con `COMMIT`. La salida real de ambos fue `BEGIN`, `DO`, `COMMIT`. No se aplicó
la prueba aislada `02-prueba-aislada-e11-graph-alias.sql` a la base efectiva.
Los hashes antes/después y la verificación de diff sólo-aliases constan en
“Aplicación efectiva autorizada”.

## Fuentes cambiadas en esta entrega

- `reports/e11/01-preparado.sql`: los dos aliases propietarios E11.
- `reports/tanda-e-20260923/tarea-2/01-corregir-e11-graph-alias.sql`: operador
  E11 fail-closed aplicado.
- `reports/tanda-e-20260923/tarea-2/02-prueba-aislada-e11-graph-alias.sql`:
  reproducción positiva/negativa aislada.
- `reports/tanda-e-20260923/tarea-2/03-corregir-e5-graph-aliases.sql`: operador
  E5 fail-closed aplicado.
- `artifacts/mariana-textil/src/pages/login.tsx`: copy diferenciado para 5xx.
- `artifacts/api-server/src/lib/pos.ts`: expansión escalar segura en las dos
  lecturas de marcas de remate.
- `artifacts/api-server/src/tarea4-remate-sale.mock.test.mjs`: regresión del
  binding POS.
- `artifacts/mariana-textil/src/components/salidas-dinero-e4-panel.tsx`:
  lectura operacional de saldo sin abrir permisos de corte.
- `artifacts/mariana-textil/src/components/e4-node.dom.test.tsx`: regresión
  CAJA sin `cortes:ver`.
- `replit.md`: documentación de aislamiento de `TEST_DATABASE_URL` y de la
  autorización desechable acotada registrada por MAIN/setup.

Los bundles congelados bajo `.local/tanda-e-20260923/` fueron sólo artefactos
de reconfirmación y no forman parte de las fuentes finales. No se modificaron
`supplier-trace.ts`, permisos, gates ni endpoints de corte.