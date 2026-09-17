# Crédito: dónde se recibió el dinero y a qué caja pertenece

## Documento para decidir — Prompt Q

**Estado: propuesta, no implementación.** Fecha de consulta: 16 de septiembre de 2026, 23:22:37, hora de Ciudad de México. Propietario y socio deben decidir las preguntas del final antes de construir.

El Grupo 1 del Prompt P sigue **sin cerrar ni aprobar**. Los grupos 2, 3 y 4 siguen detenidos. Este documento no autoriza reanudarlos.

## 1. Resumen para los socios

Hoy el sistema sabe que un cliente abonó, pero no guarda directamente **en qué tienda ocurrió ni a qué sesión de caja pertenece**. Para algunos informes usa la tienda de la nota pagada; para otros, el movimiento queda sin tienda.

Esto afecta tres cosas:

| Problema | Evidencia y cifra | Qué podemos afirmar |
|---|---|---|
| El corte no incorpora los abonos en efectivo | La fórmula actual suma fondo inicial y pagos de tickets, y resta salidas; no suma abonos del registro de crédito. | Un abono que realmente entra al cajón puede quedar fuera del efectivo esperado. No se ejecutó un corte para medir una diferencia física. |
| Cobranza global y por tienda no concilian | Medición histórica del **15/09/2026**: Cruces, **2 movimientos / $25,000**; global, **4 movimientos / $0 neto**. Los reversos sin sitio entran solo en global; las recapturas se asignan a las notas. | Hay una asimetría de atribución, no una demostración de $25,000 adicionales recibidos físicamente. |
| Estado de cuenta por tienda pierde pagos | El filtro parcial del Prompt P exige ticket. Los abonos ordinarios se guardan sin ticket. | El archivo puede mostrar las compras del sitio y omitir los pagos. Por eso no se aprobó. |

**Precisión importante respecto del planteamiento:** el Prompt Q describe $25,000 que entraron al cajón. Los informes anteriores verifican $25,000 de recapturas y advierten expresamente que eso **no acredita un ingreso físico adicional ni un sobrante real**. No presento esa entrada física como una medición comprobada. Debe corroborarse con evidencia de caja si se quiere afirmar. Fuentes: `reports/prompt-c-resultado.md`, apartados “Comprobación de cifras” y “Corte de caja”; `reports/prompt-a-finanzas-auditoria.md`, discusión de recapturas y corte.

**Recomendación general:** registrar un sitio de origen explícito, vincular los movimientos físicos a su caja y separar una corrección contable de un ingreso o devolución real. Usar una sola resolución compartida por los tres consumidores. Mantener intactos el FIFO, la deuda global, el saldo a favor y la validación del límite.

Hay dos precauciones:

1. La tienda donde se recibió dinero y la tienda de la nota a la que se aplicó son hechos distintos. La regla de negocio puede exigir que coincidan, pero el código actual no lo garantiza para todos los abonos.
2. El histórico es pequeño: **3 movimientos actuales**, no los 8 de informes anteriores. Eso abarata la revisión manual, pero no elimina las restricciones de inmutabilidad ni permite inventar una caja histórica.

## 2. Lo que existe hoy

### 2.1 Datos actuales y tamaño real

Se consultó `heliumdb/public` con la conexión configurada para el proyecto, dentro de una transacción `REPEATABLE READ READ ONLY`; PostgreSQL devolvió `transaction_read_only = on`. No se usó el conector Neon para suponer que era la misma base. Se abrió una conexión de diagnóstico usando la misma variable de conexión que utiliza el módulo de base de la aplicación. **No se inspeccionó el pool de un proceso API activo ni una base publicada independiente.**

| Tipo | Total actual | Con ticket | Sin ticket |
|---|---:|---:|---:|
| Venta a crédito | 1 | 1 | 0 |
| Abono | 2 | 0 | 2 |
| Reverso | 0 | 0 | 0 |
| Ajuste | 0 | 0 | 0 |
| **Total** | **3** | **1** | **2** |

Las cuatro categorías existen en el enum de la base; las dos últimas no devolvieron filas en el conteo agrupado, por eso se muestran en cero.

La venta tiene fecha registrada `2026-09-17T01:27:17.181Z`; los dos abonos, `2026-09-16T18:00:00.000Z`. Son instantes registrados, no prueba de cuándo entró físicamente el dinero.

Una segunda consulta de estructura de relaciones encontró:

- La venta tiene sitio mediante su ticket.
- Los dos abonos están marcados como efectivo.
- Cada abono tiene aplicaciones guardadas hacia un único sitio.
- Eso acredita el sitio de las **notas relacionadas**, no la tienda de recepción ni una sesión de caja histórica.

**Conclusión:** el volumen actual es mínimo. No está vacía la tabla hoy. Esta lectura no prueba por sí sola el estado exacto inmediatamente posterior a la purga del día 15, ni vuelve a medir el episodio histórico de $25,000. Los conteos de documentos anteriores no deben reutilizarse como actuales.

### 2.2 Qué guarda un movimiento

La base actual tiene 18 columnas:

| Finalidad | Columnas actuales |
|---|---|
| Identificación y relación | `id`, `cliente_id`, `ticket_id`, `movimiento_origen_id` |
| Tipo e importe | `tipo`, `importe` |
| Registro y autorización | `usuario_id`, `autorizado_por`, `created_at` |
| Medio y destino | `forma_pago`, `cuenta_destino`, `referencia` |
| Información complementaria | `notas`, `metadata` |
| Plazo | `dias_plazo`, `fecha_vencimiento` |
| Incobrable | `es_incobrable`, `motivo_incobrable` |

**No tiene ubicación ni sesión de caja.** El usuario que capturó no demuestra dónde estaba: puede cambiar de asignación o tener alcance global. La cuenta bancaria destino tampoco identifica necesariamente una tienda.

`ticket_id` permite nulos para todos los tipos a nivel de columna. En las rutas revisadas:

- **Venta a crédito:** normalmente nace de una nota y tiene ticket.
- **Abono ordinario:** se crea con ticket nulo; el reparto se calcula después sobre el crédito global. Un abono dirigido utiliza la nota seleccionada.
- **Reverso:** referencia su movimiento de origen. El reverso de una venta debe conservar el ticket de origen; el de un abono ordinario puede no tenerlo.
- **Ajuste:** puede no tener ticket; no equivale necesariamente a un ingreso o egreso de dinero.

### 2.3 Cuántos criterios de sitio hay

Para no inflar el conteo contando cada pantalla, agrupo los caminos por **cómo obtienen el sitio**, no por el número de ramas SQL:

**Cuatro reglas de atribución de movimientos de crédito en los consumidores revisados:**

1. **Documento directo:** movimiento → ticket → sitio.
2. **Aplicación:** abono → aplicación guardada → venta → ticket → sitio; puede producir porciones.
3. **Origen del reverso:** reverso → abono original → aplicaciones → notas → sitios.
4. **Sin atribución:** remanente a favor y su reverso reciben sitio nulo; solo aparecen en consultas globales. Un ajuste sin documento tampoco adquiere sitio por existir en el registro.

No son cuatro funciones centrales coherentes: los criterios están repartidos y combinados. Contado POS usa también el sitio del ticket, por lo que no se cuenta como una quinta regla de crédito. Caja tiene además un **vínculo a sesión**, explicado abajo, pero actualmente no lo aplica a abonos. La proyección global tampoco es un criterio adicional de sitio: calcula deuda, no recepción.

| Consumidor | Criterio actual |
|---|---|
| Cuentas Destino y Tiempo real | Comparten `destinationReadModel`: documento directo, aplicaciones de abonos, origen/aplicaciones de reversos y remanentes con sitio nulo. No incluye cualquier ajuste como si fuera cobranza. |
| Cartera | Proyecta crédito completo globalmente; selecciona cargos permitidos por el sitio de su ticket y suma sus pendientes. No reconstruye FIFO local. |
| Estado de cuenta | La ruta JSON aún no tiene el cierre de alcance del Prompt P. Los exports parciales calculan sobre el registro global y filtran filas por el ticket directo: ahí desaparecen abonos ordinarios. |
| Alertas | Selecciona notas por sitio cuando corresponde y consulta su pendiente en la proyección global. No obtiene un sitio propio del abono. |
| Corte | Usa ticket → sesión de caja para los pagos de tickets. No hay un camino equivalente para abonos de crédito. |

Este conteo cubre los consumidores solicitados; no afirma que toda consulta de cualquier módulo del repositorio haya sido auditada.

### 2.4 Patrón de caja ya existente

Una sesión guarda sitio, apertura, cierre, fecha operativa, fondo inicial, conteo y estado. El esquema fuente mantiene una sola sesión abierta por ubicación.

Los tickets tienen `sesion_caja_id`. Los pagos están en **`ticket_pagos`**, no en una tabla genérica “pagos”; no tienen sesión propia y llegan a ella mediante su ticket.

La fórmula de corte/historial es:

**Efectivo esperado = fondo inicial + pagos en efectivo de tickets vendidos de la sesión − salidas de esa sesión desde caja física.**

No se selecciona una sesión de un abono a partir de su fecha: hoy no existe esa relación. Fecha efectiva del movimiento, fecha de registro y fecha operativa de caja no son intercambiables, especialmente en recapturas.

## 3. Decisiones de diseño: opciones y consecuencias

### Cómo leer los costos

No hay tarifa ni presupuesto acordados. No invento un precio en pesos. “Bajo, medio y alto” comparan **gasto de desarrollo, revisión y operación** entre opciones; el dinero final será trabajo acordado × tarifa, más la revisión de evidencia histórica. Pocas filas reducen el trabajo histórico, no las pruebas de caja, concurrencia, permisos y crédito.

### 3.1 ¿Guardar el sitio o solo deducirlo?

Regla confirmada por el propietario: **cada tienda cobra las notas que ella hizo, no las de otra.**

| Opción | Dinero y trabajo | Riesgo / consecuencia |
|---|---|---|
| A. Guardar sitio explícito y validar coincidencia con las notas | Costo inicial medio: almacenamiento, validaciones en todas las capturas, lectores y pruebas. Menor trabajo recurrente de aclaración. | Permite atribuir abonos sin nota. El dato no es confiable si se acepta libremente desde el navegador o se omiten rutas de captura. |
| B. Solo validar notas y seguir deduciendo | Costo inicial menor si todo abono tiene nota; aumenta si se intenta reconstruirlo cada vez. | No resuelve por sí sola anticipos, favor sin aplicar, ajustes ni caja histórica. Para esos casos habría que prohibirlos o aceptar “indeterminado”. |
| C. Guardar la atribución en un registro relacionado, sin añadirla al movimiento original | Costo inicial medio/alto: relación adicional y obligación de consultarla siempre. | Conserva el registro financiero inmutable y admite evidencia posterior; requiere evitar versiones contradictorias y lectores que omitan la relación. |

**Recomendación:** A para operaciones nuevas, con validación del servidor y protección de base de datos; contemplar C para evidencia histórica si se elige enriquecerla sin modificar movimientos inmutables. Es una propuesta, no una columna añadida ni una migración autorizada.

#### La coincidencia no se garantiza agregando una columna

Ejemplo hipotético: un cliente debe $100 en A y $200 en B. Captura un abono de $50 en B. Si el FIFO global aplica primero a la deuda de A, guardar “B” no vuelve ese reparto compatible con la regla de negocio.

Alternativas:

- **Bloquear la captura incompatible**, informar la razón y usar, cuando proceda, el flujo dirigido ya existente y autorizado. Menor riesgo de alterar cálculos; mayor fricción operativa.
- Cambiar la política para permitir que una tienda reciba dinero que termine pagando otra. Reduce bloqueos, pero contradice la regla confirmada: **no se recomienda ni se presume autorizada**.
- Cambiar FIFO por sitio. Resolvería otra política de reparto, pero está **fuera de alcance y prohibido en esta entrega**.

**Recomendación:** preservar FIFO global y validar el resultado completo de la operación antes de confirmarla. Si incumple la regla, rechazarla sin guardar. El mismo conflicto puede ocurrir cuando un saldo a favor anterior se aplica automáticamente a una nueva nota de otra tienda. No basta validar un único ticket al recibir el dinero. La política de anticipos debe decidirse antes de prometer que todo abono se puede aceptar.

### 3.2 Movimientos sin nota: la decisión central

| Opción | Dinero y trabajo | Riesgo / consecuencia |
|---|---|---|
| A. Guardar el sitio operativo confirmado al capturar; si hay efectivo, usar el de la caja abierta | Costo medio de validación; bajo costo posterior de investigación. | Funciona sin nota, pero deben controlarse permisos, cambio de sitio y el conflicto de aplicación global. |
| B. Usar la tienda asignada al usuario | Costo inicial bajo. | Puede ser falso para administradores, cambios de asignación o capturas históricas. No prueba recepción. |
| C. Dejar sin sitio y mostrar solo en global | Costo inicial bajo; costo recurrente de conciliación manual alto. | Transparente si se etiqueta, pero deja incompleto el detalle local y no resuelve caja. |
| D. Prohibir nuevos abonos sin nota | Costo técnico relativamente bajo/medio; costo operativo alto si se necesitan anticipos. | Evita el caso nuevo, pero no resuelve el histórico ni ajustes/reversos sin nota. |

**Recomendación:** A para nuevos movimientos admitidos; C únicamente cuando la evidencia histórica no permita afirmar un sitio. No usar B como reconstrucción histórica.

Propuesta por tipo:

- **Abono a cuenta / saldo a favor sin aplicar:** guardar el sitio de recepción autorizado, independientemente de si ya existe nota. No trasladarlo de tienda porque cambie después su aplicación. Antes de permitirlo, decidir cómo se bloquea o tramita una futura aplicación a otra tienda sin cambiar FIFO.
- **Ajuste:** sitio del documento afectado, si existe; si no, sitio de responsabilidad elegido por un actor autorizado y motivo verificable. No convertirlo automáticamente en dinero de caja. Ajustes realmente globales quedarían explícitamente indeterminados/globales, con permiso administrativo y sin fingir un sitio.
- **Reverso:** conservar la referencia y la atribución contable del origen, incluso si el origen es indeterminado. No asignarlo a la tienda actual del operador. Si además hay una devolución física, esa devolución debe registrar la sesión actual donde sale el efectivo.
- **Recaptura o corrección histórica:** enlazar la operación corregida y declarar si hubo movimiento físico nuevo. No sumar efectivo por el solo hecho de que la forma de pago diga “EFECTIVO”.

Un importe indeterminado no desaparece del total global. En vistas globales debe existir una categoría explícita **“Sin sitio determinado”**. En una vista restringida no se expone su importe completo ni se inventa un sitio; se advierte que el detalle no es toda la deuda.

Cuando la proyección global acredita una aplicación a una nota autorizada, el detalle de esa nota puede mostrar la **porción aplicada**, identificada como aplicación y no como cobro recibido en esa tienda. No debe revelar notas ajenas, el importe total de un abono repartido ni convertir esa porción en otro ingreso. Esa distinción evita perder información del pago sin fingir un lugar de recepción.

### 3.3 Caja abierta y transferencias

Ya está decidido: **un nuevo abono con ingreso físico de efectivo exige caja abierta; una transferencia no.**

Propuesta:

1. El servidor determina y autoriza el sitio operativo.
2. Para efectivo físico exige una sesión abierta de ese mismo sitio y guarda la relación. Si no existe, rechaza la operación antes de crear el abono o sus aplicaciones. La interfaz explica que debe abrirse caja; no se crea una sesión automáticamente.
3. La captura y el cierre deben coordinarse para que un cierre concurrente no deje un abono ligado a una caja ya cerrada. Reintentos no deben duplicar el dinero.
4. La transferencia conserva sitio y cuenta destino, pero no exige sesión ni afecta el efectivo esperado.
5. Un reverso meramente contable no implica devolución. Si se devuelve efectivo, se exige caja abierta en el sitio autorizado para esa devolución. Nunca se “reabre” una caja histórica copiando su identificador al reverso.

Opciones de almacenamiento de la sesión:

| Opción | Costo | Consecuencia |
|---|---|---|
| Relación de sesión directamente en el abono nuevo | Medio | Sencilla para un ingreso único. Debe representar solo el hecho físico correspondiente, no cualquier corrección contable. |
| Registro de movimiento físico relacionado con el abono | Mayor | Distingue ingreso, devolución y recaptura sin efectivo; más componentes, pero mejor trazabilidad para hechos separados en el tiempo. |

**Recomendación:** relación explícita de sesión para el ingreso original y evidencia explícita de su efecto físico; una devolución posterior necesita su propio hecho físico, no modificar el ingreso original. La elección entre columnas y registro relacionado debe cerrarse en el diseño técnico posterior, manteniendo estas invariantes.

Fórmula propuesta:

**Efectivo esperado = fórmula actual + ingresos físicos de abonos de la sesión − devoluciones físicas de esos abonos de la sesión que no estén ya incluidas en salidas.**

No crear un `ticket_pagos` artificial para representar un abono. No restar dos veces una devolución que ya tenga salida de caja. No sumar dos veces un cobro recapturado. El sitio por sí solo no resuelve estas tres duplicaciones.

### 3.4 Qué hacer con los tres movimientos actuales

| Opción | Dinero y trabajo | Riesgo / consecuencia |
|---|---|---|
| Dejar todo el histórico indeterminado salvo el sitio documental comprobable | Menor costo inicial; más aclaraciones futuras. | No inventa información; conserva límites visibles. |
| Revisar las tres filas y adjuntar evidencia por movimiento | Bajo trabajo manual por volumen, más desarrollo de trazabilidad. | Permite recuperar lo comprobable sin adivinar; puede no recuperar ninguna sesión. |
| Rellenar con tienda actual del usuario, nota aplicada o caja de fecha similar | Barata de ejecutar. | **No recomendada:** confunde aplicación con recepción y proximidad de fecha con evidencia de caja. |

**Recomendación:** revisión individual y conservación explícita de indeterminados. Para la venta, el ticket prueba sitio documental. Para los dos abonos, las aplicaciones prueban notas relacionadas, no recepción física ni sesión. Una confirmación documentada del propietario puede constituir nueva evidencia administrativa, claramente identificada como tal; no como dato original registrado por el sistema.

La tabla impide `UPDATE` y `DELETE` mediante un trigger. Por eso una migración no es “un UPDATE sencillo” aunque solo existan tres filas. Preferir evidencia relacionada e inmutable para históricos; si se propusiera otra estrategia, requeriría revisión y autorización separadas. **No se propone desactivar la protección como atajo.**

Nunca usar un valor por defecto que asigne todos los históricos a una tienda. La futura migración debe preservar importes, tipos, fechas, clientes, relaciones y el resultado de la proyección global, con comprobación antes/después.

## 4. Una sola resolución compartida

**Propuesta conceptual, no contrato implementado:** un único servicio interno resuelve la atribución de un movimiento y devuelve:

- Sitio de origen confirmado, indeterminado o en conflicto.
- Evidencia y motivo de esa atribución.
- Relación de caja y naturaleza del hecho físico, si existe evidencia.
- Relaciones documentales y porciones aplicadas obtenidas de la **proyección global canónica**, separadas del origen del dinero.

Reglas comunes:

1. Para nuevos registros, validar el sitio explícito contra permisos, documento y caja, según corresponda.
2. Para históricos, aceptar solo evidencia comprobable; no deducir recepción de una aplicación. Un conflicto entre evidencias se declara y bloquea la presentación como dato confirmado.
3. El reverso conserva la relación de origen. El efectivo devuelto se liga al hecho físico de devolución.
4. Los importes y el reparto salen de las funciones financieras existentes; la atribución no recalcula deuda.
5. El servidor restringe lo entregado. El lector local no recibe filas, IDs ni importes de otros sitios. El resolver puede trabajar con evidencia global internamente; no se serializa esa evidencia completa al navegador.
6. Cuentas Destino, Tiempo real, corte y estado de cuenta no implementan nuevas cadenas de deducción propias.

No se debe confundir **una función compartida** con **una cifra idéntica para todo**: caja mide efectivo físico de una sesión; cobranza mide movimientos contables del periodo; el estado de cuenta muestra deuda y aplicaciones. Comparten la atribución y la evidencia, no cambian su significado para forzar una igualdad.

### Qué cambiaría en los tres consumidores

| Consumidor | Cambio propuesto | Qué corrige y qué no |
|---|---|---|
| Corte, historial y resumen de caja | Sumar ingresos físicos de abonos y restar devoluciones físicas una sola vez, por sesión explícita. | Corrige `efectivoEsperado` y por consecuencia `diferencia`. No prueba cuánto efectivo histórico hubo ni reescribe cierres anteriores. |
| Cuentas Destino y Tiempo real | Consumir sitio confirmado del dinero y origen del reverso, manteniendo periodo, signo y destino actuales. Mostrar indeterminados en global. | Evita que solo un lado de una corrección aparezca en un sitio. No convierte el neto histórico global de $0 en +$25,000. |
| Estado de cuenta y archivos | No exigir ticket al abono; mostrar movimientos autorizados y aplicaciones a notas locales con su naturaleza clara. Mantener el pendiente de cada nota de la proyección global. | Evita perder abonos y pendientes locales. Solo deuda actual, favor, límite y disponible conservan la excepción global aprobada. |

Para el episodio del día 15: si evidencia suficiente atribuyera los reversos al mismo sitio de las recapturas, **el neto de ese conjunto en Cruces sería $0 en lugar de $25,000**, igual que global. Si no existe esa evidencia, el documento no autoriza inventarla: global conserva $0 y la parte indeterminada debe permanecer explícita. El diseño nuevo previene la asimetría para movimientos nuevos correctamente capturados; no garantiza reparar retrospectivamente todos los casos.

## 5. Qué podría romperse y qué cifras cambiarían

### 5.1 Cifras globales

| Cifra | Efecto esperado del diseño recomendado |
|---|---|
| `efectivoEsperado` de caja e historial, y cualquier total que lo sume | **Sí cambia** por los abonos físicos antes omitidos y las devoluciones procedentes. El incremento depende de evidencia real, no automáticamente de los $25,000 históricos. |
| `diferencia` / diferencia de cuadre | **Sí cambia** al conservar efectivo contado y corregir el esperado. |
| Cobrado canónico global y totales globales por cuenta destino del mismo periodo | **No deben cambiar** por atribuir sitio. El conjunto histórico citado conserva $0 neto. |
| Contado cobrado de tickets, ventas a crédito, ventas, costos y utilidad global | **No deben cambiar**. No reclasificar abonos como ventas ni pagos POS. |
| Deuda global, saldo a favor, crédito disponible, límite, cartera y vencido globales | **No deben cambiar**. Preservar proyección, plazos, fechas y FIFO. |
| Importes locales y categoría global “Sin sitio determinado” | **Pueden cambiar** al acreditar atribuciones. La suma de sitios más indeterminado debe reconciliar con global, sin duplicar aplicaciones. |
| Campos de atribución y metadatos en respuestas/archivos globales | Podrían ampliarse en una implementación aprobada; no implica cambiar cifras. Ningún contrato cambió en esta entrega. |

Si al implementar cambia una cifra global fuera de las de caja aquí nombradas, debe detenerse la entrega y explicar la causa; no aprobarla como “solo alcance”.

### 5.2 Lugares afectados

Inventario de impacto, **no cambios realizados**:

- Capturas de abono ordinario, dirigido, reverso y ajuste; autorización/cancelación de notas; recapturas y utilidades administrativas que insertan movimientos.
- Selección de sitio y errores de caja abierta en captura. Los permisos siguen determinando quién puede hacer qué; el alcance determina dónde.
- `destinationReadModel` y sus consumidores de resumen, desglose, conciliación, Cuentas Destino y Tiempo real. La atribución no permite cambiar el predicado contabilizado ni los límites temporales.
- `listarSesionesCajaHistorial`, `buildCorteCaja`, `cuadrarCaja`, detalle de sesión y sus impresiones.
- Estado de cuenta JSON, HTML/imprimir, XLSX y PDF; detalles de pagos, notas y reimpresión. Analítica/directorio del Prompt P permanecen pendientes, no se corrigen con una nueva columna por sí solos.
- Cartera, crédito y alertas: principalmente pruebas de conservación y uso correcto de la proyección; no reemplazar pendientes de notas por sumas de caja.
- Esquema, inicializadores, índices, contratos generados y pruebas, cuando exista autorización de implementación.

Pruebas existentes a inventariar en la implementación: `clientes-pagos.contract.test.ts`, `pagos-dirigidos.integration.test.ts`, `bloque6-reversos.integration.test.ts`, `credit-allocation.test.ts`, pruebas de `clientes-cartera-read-model`, `admin-alertas.integration.test.ts`, `admin-realtime-reconciliation.integration.test.ts`, `pos-caja-final.contract.test.ts`, `clientes-estado-cuenta.contract.test.ts` y `clientes-financial-exports-scope.test.ts`, más contratos de Cuentas Destino y caja en frontend. Son referencias de impacto, no una afirmación de que se ejecutaron ahora.

### 5.3 Protecciones de base que deben conservarse

El catálogo actual confirma:

- Clave primaria e índices de cliente/fecha y ticket; índice único parcial que impide dos reversos del mismo origen.
- Checks de signos por tipo, plazos válidos y destinos permitidos.
- Relaciones hacia cliente, ticket, usuario, autorizador y movimiento de origen.
- Relaciones entrantes desde `aplicaciones_credito` y `autorizaciones_nota`.
- Trigger **`movimientos_credito_inmutables`**, que rechaza actualización y borrado.
- Trigger **`movimientos_credito_reversos_validos`**, que exige origen compatible, mismo cliente e importe exacto; para reverso de venta exige conservar el ticket. Su función lee la fila de origen completa.

Añadir atribución requeriría relaciones nuevas a ubicación/sesión, validación de consistencia entre ellas y reglas para efectivo físico. Una relación por ID por sí sola no garantiza que caja, tienda y nota coincidan. Índices candidatos: sitio/fecha efectiva y sesión para corte; deben evaluarse con consultas reales, no reemplazar los existentes.

Ninguno de los índices actuales referencia una columna de sitio inexistente: no hay motivo para eliminarlos solo por añadir atribución. Revisar el trigger de reversos para preservar o validar la atribución sin romper sus reglas actuales, y las funciones con filas completas para compatibilidad con el esquema ampliado. Mantener inmutabilidad; no habilitar un bypass general.

## 6. Orden propuesto de construcción posterior

**Nada de esto se ha construido ni queda autorizado por entregar el documento.**

1. **Decidir origen, anticipos y conflicto con FIFO.** Desbloquea una política que pueda validarse sin perder pagos ni cambiar crédito.
2. **Especificar el registro de atribución y efecto físico, y la única resolución compartida.** Incluir indeterminados, evidencia, reversos, recapturas y permisos.
3. **Preparar preservación e histórico.** Revisar las tres filas actuales, documentar lo demostrable y diseñar migración sin alterar el registro financiero. No adivinar cajas.
4. **Captura transaccional de nuevas operaciones.** Sitio autorizado, caja abierta para efectivo físico, transferencia sin caja, cierre concurrente e idempotencia. Validar la regla de notas propias contra la proyección global.
5. **Integrar corte y cobranza con la misma atribución.** Corregir efectivo esperado sin doble conteo; conservar totales contables globales y mostrar indeterminados.
6. **Retomar únicamente Grupo 1 del Prompt P con autorización expresa.** Abrir los archivos reales y verificar abonos sin ticket, aplicaciones locales y multi-sitio, reversos, favor, pendientes y ausencia de datos ajenos.
7. **Solo tras aprobar Grupo 1, decidir la reanudación secuencial de grupos 2–4.** No cerrar el inventario por haber añadido sitio.

Pruebas de aceptación futuras: comparación global campo por campo; caja con y sin abonos físicos; transferencia sin sesión; cierre simultáneo; recaptura sin efectivo nuevo; devolución en sesión posterior; históricos indeterminados; reverso con origen; anticipo usado posteriormente; aplicación incompatible entre tiendas; permisos y archivos de una y varias ubicaciones. Estas pruebas deben planearse fuera de datos de operación, sin crear usuarios ni sesiones de prueba en development.

## 7. Qué NO resuelve este diseño

- No implementa ni activa ninguna solución.
- No demuestra efectivo físico histórico a partir de movimientos contables.
- No rellena sesiones desconocidas ni sanea automáticamente datos antiguos.
- No cambia FIFO, saldo a favor, deuda, límite duro, fechas efectivas, predicados contabilizados ni criterios de utilidad.
- No sustituye permisos financieros ni autoriza lectura global de documentos.
- No construye el tablero de Clientes ni cierra el Prompt P.
- No corrige transferencias físicas entre tiendas ni diseña una tesorería intertiendas.
- No ofrece todavía un presupuesto en pesos, fecha de entrega o migración “trivial” garantizada.

## 8. Evidencia y límites de esta entrega

### Consultas ejecutadas

Dos transacciones de solo lectura, finalizadas con `ROLLBACK` y conexiones cerradas. Se consultaron exclusivamente identidad, conteos agregados, relaciones agregadas y catálogos de estructura. No se extrajeron ni mostraron credenciales o cadenas de conexión. No se ejecutaron escrituras, migraciones, inicializadores, endpoints, creación de usuarios/sesiones o reinicios.

Consulta principal de volumen:

```sql
SELECT tipo, count(*)::int AS total,
       count(ticket_id)::int AS con_ticket,
       count(*) FILTER (WHERE ticket_id IS NULL)::int AS sin_ticket,
       min(created_at) AS primera_fecha, max(created_at) AS ultima_fecha
FROM movimientos_credito
GROUP BY tipo ORDER BY tipo;
```

Estructura consultada en `information_schema.columns`, `pg_constraint`, `pg_indexes`, `pg_trigger`, `pg_enum`; definiciones leídas con `pg_get_constraintdef`, `pg_get_triggerdef` y `pg_get_functiondef`. Se incluyeron las relaciones entrantes a la tabla, no solo sus claves salientes.

La segunda consulta agrupó movimientos con sus tickets y las aplicaciones hacia tickets de venta; contó sitios distintos sin extraer nombres de clientes ni operadores. **No ejecutó la proyección global**: sus resultados sirven para clasificar evidencia documental, no para sustituir FIFO ni afirmar saldos.

El primer intento de consulta falló al resolver una dependencia local, antes de conectarse; se corrigió la ruta de importación y las dos transacciones descritas terminaron correctamente. No se modificaron paquetes.

### Fuentes de código revisadas

- `lib/db/src/schema/pos.ts:40–76,112–182,274–357`: sesiones, ticket, pagos y movimientos.
- `lib/db/src/index.ts`: configuración del pool y separación de inicializadores.
- `artifacts/api-server/src/lib/admin-analytics.ts:130–220`: las ramas de Cuentas Destino.
- `artifacts/api-server/src/lib/clientes-cartera-read-model.ts:194–205,288–379`: cargos autorizados y proyección global.
- `artifacts/api-server/src/lib/admin-alertas.ts:107–145`: notas y proyección para alertas.
- `artifacts/api-server/src/lib/credit-aging-read-model.ts`: carga canónica del registro global.
- `artifacts/api-server/src/routes/clientes.ts:2078–2221,2285–2321`: abono ordinario y reverso.
- `artifacts/api-server/src/routes/pagos-dirigidos.ts:93–134,230–236`: cobro dirigido y controles del documento.
- `artifacts/api-server/src/lib/pos.ts:2100–2204`: sesiones y corte; rutas de escritura referenciadas en el inventario.
- `reports/financial-read-scope/group-1.md`: bloqueos de los exports parciales.
- `reports/prompt-c-resultado.md` y `reports/prompt-a-finanzas-auditoria.md`: mediciones históricas y límites de su interpretación.

Las líneas son referencias de la revisión, no interfaces estables. El catálogo consultado, no un informe histórico, es la evidencia de la estructura y volumen actuales.

**No se ejecutaron pruebas funcionales, codegen, typecheck, cortes, exportaciones ni navegación autenticada en esta entrega de diseño.** Tampoco se afirma que los workflows estén funcionando. Los resultados del Prompt P pertenecen a su informe anterior y no son verificación del diseño propuesto.

## 9. Decisiones que deben tomar el propietario y su socio

1. **¿Quieren guardar explícitamente la tienda de cada movimiento nuevo, o seguir deduciéndola y aceptar las limitaciones de movimientos sin nota?**
2. **¿Permitirán anticipos y saldo a favor sin nota, registrando dónde se recibieron, o exigirán una nota para todo cobro nuevo?**
3. **Si el reparto global de un abono o un saldo a favor pagaría una nota de otra tienda, ¿debe bloquearse y tramitarse por el flujo dirigido autorizado?**
4. **Para un ajuste sin nota, ¿debe elegirse una tienda responsable con justificación, o permitir ajustes globales explícitos reservados a administración?**
5. **¿Aprueban distinguir obligatoriamente ingreso/devolución física de una corrección o recaptura sin movimiento de efectivo?** La exigencia de caja abierta para efectivo nuevo y su exención para transferencias ya están decididas.
6. **¿Aprueban que una devolución física se registre en una caja abierta actual, sin modificar el corte donde se recibió originalmente?**
7. **¿Prefieren revisar los tres movimientos actuales y adjuntar evidencia conservando los originales, o dejarlos indeterminados donde falte información?**
8. **¿Aceptan mostrar “Sin sitio determinado” en global y, en detalle local, solo las aplicaciones comprobables a sus notas, sin presentarlas como cobros recibidos allí?**
9. **Una vez decididas estas reglas, ¿autorizan preparar el alcance y presupuesto de implementación antes de reanudar el Grupo 1 del Prompt P?**