# Abonos, saldo a favor y Estado — resultado

Fecha: **2026-09-15**, Ciudad de México.

## Dictamen

**Entrega parcial, sin aprobación integral financiera ni de navegador.**
Se implementaron los cambios de los bloques 1–3 y pasaron 26 pruebas acotadas.
Persisten cuatro errores de tipos preexistentes, limitaciones de almacenamiento
de aplicaciones y comprobaciones reales pendientes. No se ejecutó el Bloque 4
ni se implementó el Bloque 5.

### Documentos de esta entrega

- [Bloque 0: consultas y salidas textuales](abonos-fifo-2026-09-15-diagnostico.md).
- [Bloque 4: IDs, importes, fechas y autorización pendiente](abonos-fifo-2026-09-15-plan-bloque-4.md).
- [Bloque 5: propuesta escrita, no implementada](abonos-fifo-2026-09-15-propuesta-bloque-5.md).

## 1. Diagnóstico y conservación histórica

D1 y D2 se confirmaron antes de editar código. Los abonos 46 y 45 tienen
fecha efectiva `2026-09-15 00:00 UTC`, equivalente al **14 de septiembre a
las 18:00 en México**. Su captura real fue el día 15, después de los cargos
43 y 44 de las notas 1004 y 1005, marcados con `preventImplicitFavor=true`.
No había aplicaciones.

D3 no se confirmó: los dos vencimientos coinciden en **2026-10-15** para
cada documento y movimiento. No se corrigieron vencimientos.

La simulación sin veto reduciría **dos** notas históricas y liquidaría
**cero**. No se aplicó esa simulación.

La consulta de conservación, después de los cambios y del arranque de la API,
devolvió:

| Cliente | Cargo / nota | Deuda actual | Favor actual | Aplicaciones de los movimientos investigados |
|---|---|---:|---:|---:|
| 6 | 43 / 1004 | $15,750.00 | $10,000.00 | 0 |
| 7 | 44 / 1005 | $22,022.00 | $15,000.00 | 0 |

Siguen los cuatro movimientos originales con sus importes e instantes
originales; no existen reversos con origen 45 o 46. Por exigencia de
preservación histórica, estos dos clientes todavía son excepciones a la
invariancia nueva. No se oculta esa coexistencia mediante una cifra neta.

## 2. Cambios implementados

### Fecha efectiva

- Una función compartida construye el instante de Ciudad de México para
  abono normal, dirigido y vista previa. El día elegido se envía a las
  12:00 con el desplazamiento correspondiente, independiente de la zona
  del navegador.
- Fecha vacía conserva la ruta de instante del servidor: null para pago
  normal y campo omitido para el contrato opcional de pago dirigido.
- Los dos handlers de cliente validan el valor crudo antes de la conversión
  de Zod y rechazan fecha sola, hora sin desplazamiento y fecha inválida
  con 400 y un mensaje que identifica `fechaEfectiva`.
- No se editaron fechas de movimientos existentes.

### Favor automático y proyección

- Las notas nuevas ya no reciben el veto histórico.
- La autorización calcula la aplicación automática bajo los candados del
  cliente, considera el favor realmente aplicado en el límite duro y conserva
  la evidencia exacta del ABONO.
- La interfaz no ofrece casilla ni importe manual. El campo legado de la API
  se conserva por compatibilidad, pero no controla la decisión del servidor.
- Las aplicaciones de las notas nuevas son evidencia, no una prioridad FIFO
  permanente. La lectura especial de aplicaciones explícitas se restringe
  a las notas históricas marcadas.
- Las tarjetas y los saldos por movimiento provienen del proyector canónico.
  El campo neto histórico se conserva por compatibilidad, pero la tabla
  nueva no lo utiliza para reemplazar deuda y favor.

**Limitaciones que siguen abiertas:**

1. La restricción existente de la base cuenta aplicaciones históricas que
   pueden ocupar capacidad aunque el libro haya liberado favor por reversos.
2. Los orígenes AJUSTE no disponen de la misma vía de evidencia que ABONO.
3. No se modificaron esas restricciones ni se ocultó dinero para adaptarlo
   a ellas. Si una aplicación propuesta no puede documentarse, la proyección
   queda no autorizable con `motivoBloqueo`, y el POST devuelve 409 con motivo.
   Es una protección explícita, **no la resolución completa de esos casos**.
4. La reconstrucción de saldos por prefijo conserva un camino exacto para
   libros con reversos, pagos dirigidos o evidencia histórica explícita.
   Ese camino puede ser O(n³). No se ejecutó prueba de carga ni se presenta
   como optimizado. El camino ordinario es incremental.

### Columna Estado

- Orden de escritorio: Fecha, Tipo, Folio, Pago, Referencia/notas, Usuario,
  Importe, Saldo, **Estado**.
- Tipo solo muestra el movimiento. Estado muestra la insignia y el pendiente
  recibidos del servidor; para abono, ajuste o reverso muestra guion.
- A 402 px hay un renderizado de tarjetas con todos los campos, en lugar
  de una tabla de nueve columnas desplazable.
- El componente compartido de insignia no cambió. No se movieron las
  insignias de las otras vistas.
- **La comprobación visual solicitada no quedó aprobada**, como se detalla
  abajo. El código implementado no sustituye esa verificación.

## 3. Verificación ejecutada

### Tipos: cuatro errores únicos preexistentes; cero errores nuevos restantes

Se ejecutó el comando solicitado:

```sh
pnpm run typecheck
```

La compilación de bibliotecas terminó. La ejecución recursiva se detuvo al
fallar la API y no entregó el resultado completo de los demás paquetes.
Se completaron por separado los proyectos pendientes.

Errores finales únicos:

```text
artifacts/api-server/src/lib/pos.ts(445,41):
TS2339: Property 'toISOString' does not exist on type 'never'.

artifacts/api-server/src/routes/clientes.ts(1380,10):
TS1117: An object literal cannot have multiple properties with the same name.

artifacts/mariana-textil/src/pages/alertas.tsx(206,55):
TS2339: Property 'pendiente' does not exist on type 'AdminAlertaCredito'.

artifacts/mariana-textil/src/pages/alertas.tsx(224,51):
TS2339: Property 'pendiente' does not exist on type 'AdminAlertaCredito'.
```

Los dos primeros son los conocidos, con líneas desplazadas por los cambios.
Los otros dos se confirmaron por comparación del código anterior: Alertas ya
accedía a `credito.pendiente`, mientras su contrato anterior declaraba
`importe`, no `pendiente`. No se modificaron Alertas ni ese contrato.
No se presenta esta comparación como una ejecución de una línea base.

Scripts vuelve a informar los mismos dos errores de API porque importa
esos módulos; no son dos errores adicionales.

Durante esta verificación se corrigió una incompatibilidad **introducida
en esta entrega** entre null y el campo opcional de fecha del pago dirigido.
El chequeo final de frontend ya no informa ese error.

Salidas:

- [Comando raíz](abonos-fifo-typecheck-2026-09-15.log).
- [Paquetes pendientes y diagnóstico de Scripts](abonos-fifo-typecheck-restante-2026-09-15.log).
- [Frontend final](abonos-fifo-typecheck-ui-final-2026-09-15.log).

### Codegen

Se regeneraron cliente y Zod después de modificar el contrato. Las diferencias
son justificadas, no se afirma que el diff sea vacío:

- `saldoDeudorProyectado` y `saldoAFavorProyectado` por movimiento.
- Aplicación automática, remanente, deuda resultante y `motivoBloqueo`
  en la proyección de autorización.
- Documentación del campo manual legado ignorado y del saldo neto histórico.
- Documentación del requisito de fecha efectiva con hora y desplazamiento.

El `typecheck:libs` ejecutado por el comando raíz no informó errores.

### Pruebas API/proyector: 21/21

```sh
pnpm --filter @workspace/api-server exec tsx --test \
  src/lib/credit-allocation.test.ts \
  src/lib/fecha-efectiva.test.ts \
  src/lib/fecha-efectiva-routes.test.ts
```

[Salida completa](abonos-fifo-pruebas-api-2026-09-15.log).

Los seis escenarios exigidos están afirmados dentro de una prueba matricial:

| Escenario | Entrada | Pendiente por nota | Favor |
|---|---|---|---:|
| Abono anterior | $40 antes de nota $100 | $60 | $0 |
| Abono posterior | $40 después de nota $100 | $60 | $0 |
| Mismo instante | $150; dos notas de $100, ordenadas por ID | $0 y $50 | $0 |
| Mayor que deuda | $150; nota $100 | $0 | $50 |
| Menor que deuda | $40; nota $100 | $60 | $0 |
| Sin deuda | Abono $75 | Sin notas | $75 |

Se afirma la invariancia de no coexistencia en esos escenarios prospectivos
y la coincidencia del saldo final con su proyección por movimiento.
Otra prueba conserva expresamente la excepción histórica marcada.
También se probaron los bloqueos de evidencia de AJUSTE y de capacidad
histórica consumida sin cambiar el resultado financiero.

La prueba HTTP ejerció los **handlers reales aislados** en seis solicitudes:
dos endpoints por tres entradas inválidas. Todas devolvieron 400 con el
mensaje específico. Se prohibieron tanto `pool.query` como `pool.connect`;
hubo **cero intentos de acceso a la base**. No incluyó autenticación y no
equivale a un recorrido autenticado.

### Fechas de frontend: 5/5

```sh
TZ=Pacific/Auckland pnpm --filter @workspace/mariana-textil exec tsx --test \
  src/lib/fecha-efectiva.test.ts
```

[Salida completa](abonos-fifo-pruebas-fecha-ui-2026-09-15.log).

Se comprobó día 15 en Ciudad de México, desplazamiento explícito, campo
vacío, rechazo de calendario inválido e independencia de la zona local.
**No se probó persistencia mediante una escritura financiera real.**
Esa parte del requisito de fecha continúa pendiente.

### Navegador: no aprobado

No había cookies ni sesión autenticada real. La ruta `/clientes/6` redirigió
al login. No se inició sesión ni se creó un usuario de prueba.

Se hicieron dos intentos acotados con respuestas simuladas sobre el componente
real montado, bloqueando POST/PUT/PATCH/DELETE. Ambos quedaron en el límite
de error antes de montar Estado de cuenta:

```text
Cannot read properties of undefined (reading 'ultimaCompra')
ClientAnalyticsBlocks — cliente-detail.tsx
```

Es un fallo observado **bajo fixtures simulados**, no una regresión demostrada
con datos reales. No se alteró la aplicación para ocultarlo.

No quedaron verificados los cuatro colores, los guiones, los anchos a 402 px
ni la ventana de autorización. Se proporcionaron los textos más largos
existentes obtenidos por SELECT —17 caracteres de nombre, 15 de notas—,
pero no se alcanzó la tabla: no se acredita esa comprobación.
No hubo solicitudes de mutación.

### Arranque y exclusiones

- Los dos workflows arrancaron. La API conserva la advertencia conocida
  de `saldoPendiente` duplicado; no se corrigió.
- El preview sin autenticación mostró el login, no una pantalla en blanco.
- `git diff --check` pasó.
- No se ejecutaron las suites que crean usuarios, ni se modificaron.
- No se repitió la matriz PDF/XLSX cerrada ni las cinco pruebas contractuales
  anteriores fuera de este manifiesto.
- No hubo publicación, migración nueva ni correcciones financieras reales.

## 4. Decisión pendiente

El plan del Bloque 4 propone reversar totalmente el **46 por $10,000** y el
**45 por $15,000**, y recapturar con sus instantes reales de captura.
Requiere autorización expresa y revalidación antes de ejecutar.

Advertencia: los reversos del flujo actual llevan fecha de ejecución;
este plan no reclasifica por sí solo el corte histórico del día 14.
Los detalles y consecuencias están en su documento separado.