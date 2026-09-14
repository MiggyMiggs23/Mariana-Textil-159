# Mapa de destino de Reportes — aprobado

Fecha: 14 de septiembre de 2026.

**Estado: mapa aprobado, incluida R01 y X04 íntegra en Ventas → Comparar. El
contrato fuente preserva 56 tablas y 18 gráficos; la verificación numérica real
de las 53 tablas genéricas y la comparación aislada de X04 global 2026 pasan.
Las comprobaciones parciales de contrato UI read-only pasaron con autenticación
y respuestas interceptadas, sin login ni escrituras de DB; no son una E2E
autenticada viva y no se declara publicación completa. Consultar
`reports/reorganizacion-reportes-verificacion.md`. La tasa de cancelación se
pospuso expresamente.**

Este mapa inventaría las once pestañas declaradas actualmente, sus tablas y gráficos, indicadores y detalles asociados. Los nombres entre comillas corresponden a encabezados actuales; cuando una tabla no tiene título se describe expresamente.

## 1. Las cinco pestañas de destino

| Pestaña | Pregunta | Contenido recibido |
|---|---|---|
| Ventas | Qué se vendió | Conserva lo actual. Recibe íntegro el Comparativo actual dentro del modo Comparar. La fuente raw de X04 coincide legacy/current para el global 2026. |
| Qué comprar | Qué pedir y cuánto | Conserva recomendación y evidencia. Recibe Inventario y Rotación, Mapas de Calor, Análisis de Color y Compras. |
| Utilidad y márgenes | Cuánto se gana | Conserva todo lo actual, sin rediseño. |
| Clientes y crédito | Cuánto me deben y quién | Conserva todo lo actual. Recibe Pagos Dirigidos resueltos. |
| Control operativo | Qué anda mal | Recibe Diferencias de Caja completo y reúne las siete señales solicitadas. |

Comparar será un modo dentro de las cinco, no una sexta pestaña. Las subsecciones indicadas abajo no son nuevas pestañas principales.

### Organización propuesta dentro de Qué comprar

- **Recomendación y evidencia:** contenido actual de Qué comprar.
- **Existencia y rotación:** stock, cobertura, pérdidas y mercancía sin movimiento.
- **Demanda por mes, tela y color:** mapas y análisis de color.
- **Compras y proveedores:** recibido, costos, concentración, aumentos y alternativas.

## 2. Inventario completo: tablas y gráficos

Todos los elementos de esta sección se conservan. **No propongo retirar ninguna tabla ni gráfico.** La única retirada propuesta es un indicador duplicado, identificado en la sección 4.

### 2.1 Origen: Ventas

Destino de todos: **Ventas**, sin rediseñar su contenido.

| ID | Tipo | Nombre actual | Destino / tratamiento |
|---|---|---|---|
| V01 | Gráfico | Ventas diarias | Ventas; conservar |
| V02 | Gráfico | Ventas por hora | Ventas; conservar |
| V03 | Gráfico | Ventas por día | Ventas; conservar |
| V04 | Tabla | Día | Ventas; conservar |
| V05 | Tabla | Día de semana | Ventas; conservar |
| V06 | Tabla | Hora | Ventas; conservar |
| V07 | Tabla | Sitio | Ventas; conservar |
| V08 | Tabla | Producto | Ventas; conservar |
| V09 | Tabla | Tela | Ventas; conservar |
| V10 | Tabla | Color | Ventas; conservar |
| V11 | Tabla | Vendedor | Ventas; conservar |
| V12 | Tabla | Cliente | Ventas; conservar |
| V13 | Tabla | Forma de pago | Ventas; conservar |
| V14 | Tabla | Estado de factura | Ventas; conservar |
| V15 | Tabla | Mejores productos | Ventas; conservar |
| V16 | Tabla | Peores productos | Ventas; conservar |
| V17 | Tabla | Clasificación ABC | Ventas; conservar |
| V18 | Tabla | Pares de productos en canasta | Ventas; conservar |
| V19 | Tabla | Resumen de cancelaciones | Permanece en Ventas; su información también alimentará el control de cancelaciones |
| V20 | Tabla | Cancelaciones | Permanece en Ventas; Control operativo añadirá acceso al documento |
| V21 | Tabla | Productos cancelados | Permanece en Ventas; no se elimina al crear Control operativo |

**Subtotal: 18 tablas y 3 gráficos.**

### 2.2 Origen: Utilidad y Márgenes

Destino de todos: **Utilidad y márgenes**, sin rediseñar su contenido.

| ID | Tipo | Nombre actual | Destino |
|---|---|---|---|
| U01 | Gráfico | Evolución de utilidad | Utilidad y márgenes |
| U02 | Tabla | Utilidad por modalidad | Utilidad y márgenes |
| U03 | Tabla | Tela | Utilidad y márgenes |
| U04 | Tabla | Producto | Utilidad y márgenes |
| U05 | Tabla | Color | Utilidad y márgenes |
| U06 | Tabla | Sitio | Utilidad y márgenes |
| U07 | Tabla | Vendedor | Utilidad y márgenes |
| U08 | Tabla | Divergencia cantidad vs utilidad | Utilidad y márgenes |
| U09 | Tabla | Productos en alza | Utilidad y márgenes |
| U10 | Tabla | Productos en baja | Utilidad y márgenes |
| U11 | Tabla | Dispersión de precios | Utilidad y márgenes |
| U12 | Tabla | Precios por sitio | Utilidad y márgenes; disponible también al comparar |
| U13 | Tabla | Calidad de costos | Utilidad y márgenes |
| U14 | Tabla | Descuentos >30% o margen bajo | Utilidad y márgenes |

**Subtotal: 13 tablas y 1 gráfico.**

### 2.3 Origen: Inventario y Rotación

| ID | Tipo | Nombre actual | Destino |
|---|---|---|---|
| I01 | Gráfico | Existencia por producto | Qué comprar → Existencia y rotación |
| I02 | Gráfico | Cierre diario de inventario | Qué comprar → Existencia y rotación; conservar su advertencia y condición de conciliación |
| I03 | Tabla | Existencia actual y rotación por modalidad | Qué comprar → Existencia y rotación |
| I04 | Tabla | Pérdidas extraordinarias | Qué comprar → Existencia y rotación |
| I05 | Tabla | Comprado vs vendido | Qué comprar → Existencia y rotación |
| I06 | Tabla | Sin movimiento | Qué comprar → Existencia y rotación |

I03 conserva todas sus columnas: stock, rollos, valor, salidas por modalidad, cobertura por modalidad, clasificación, días sin existencia y pérdida estimada. I05 conserva también el ajuste negativo; no se convierte por eso en un reporte completo de ajustes.

**Subtotal: 4 tablas y 2 gráficos.**

### 2.4 Origen: Mapas de Calor

| ID | Tipo | Nombre actual | Destino |
|---|---|---|---|
| M01 | Mapa de calor | Mes × SKU | Qué comprar → Demanda por mes, tela y color |
| M02 | Mapa de calor | Mes × tela | Qué comprar → Demanda por mes, tela y color |
| M03 | Mapa de calor | Mes × sitio | Qué comprar → Demanda por mes, tela y color; disponible también al comparar |

**Subtotal: 0 tablas y 3 gráficos.** El código actual ya no declara un cuarto mapa “Mes × color” en esta pestaña. La visualización mensual de color está en Qué comprar y se conserva como Q02.

### 2.5 Origen: Análisis de Color

| ID | Tipo | Nombre actual | Destino |
|---|---|---|---|
| A01 | Mapa de calor | Color × tela | Qué comprar → Demanda por mes, tela y color |
| A02 | Tabla | Ranking color por tela, modalidad y unidad | Qué comprar → Demanda por mes, tela y color |
| A03 | Tabla | Color por sitio | Qué comprar → Demanda por mes, tela y color; disponible también al comparar |
| A04 | Tabla | Sin movimiento ≥90 días | Qué comprar → Existencia y rotación |

**Subtotal: 3 tablas y 1 gráfico.**

### 2.6 Origen: Compras

| ID | Tipo | Nombre actual | Destino |
|---|---|---|---|
| C01 | Gráfico | Costo unitario por rollo | Qué comprar → Compras y proveedores |
| C02 | Tabla | Costo unitario por rollo y compra | Qué comprar → Compras y proveedores |
| C03 | Tabla | Compras por proveedor | Qué comprar → Compras y proveedores |
| C04 | Tabla | Compras por producto (siempre por rollo) | Qué comprar → Compras y proveedores |
| C05 | Tabla | Compras por tela y unidad | Qué comprar → Compras y proveedores |
| C06 | Tabla | Compras por color y unidad | Qué comprar → Compras y proveedores |
| C07 | Tabla | Aumentos mayores a 10% | Qué comprar → Compras y proveedores |
| C08 | Tabla | Alternativas de proveedor | Qué comprar → Compras y proveedores |

Se conservan folios, proveedores, rollos, cantidades, costos, concentraciones y referencias de costo con su estado. Los nombres se documentan aquí tal como existen: este trabajo no corrige ni sustituye sus fórmulas.

**Subtotal: 7 tablas y 1 gráfico.**

### 2.7 Origen: Qué comprar

| ID | Tipo | Nombre actual | Destino |
|---|---|---|---|
| Q01 | Tabla | Qué comprar | Qué comprar → Recomendación y evidencia; conservar íntegra |
| Q02 | Mapa de calor | Venta real al cliente por mes y color | Qué comprar → Recomendación y evidencia; conservar |
| Q03 | Detalle | Evidencia de la sugerencia | Mismo detalle asociado a Q01 |
| Q04 | Bloque dentro del detalle | Entradas de la ecuación | Dentro de Q03 |
| Q05 | Bloque condicional dentro del detalle | Conciliación de movimientos | Dentro de Q03 |
| Q06 | Tabla dentro del detalle | Movimientos | Dentro de Q03 |
| Q07 | Tabla dentro del detalle | Episodios bajo mínimo en el periodo | Dentro de Q03 |
| Q08 | Tabla dentro del detalle | Episodios anteriores al periodo (no incluidos en conteo) | Dentro de Q03, con esa distinción explícita |
| Q09 | Detalle de episodios | Eventos de episodios | Dentro de la evidencia de episodios; conservar su desglose |
| Q10 | Detalle de eventos | Eventos de entrada | Dentro de Q03 |

Q01 conserva SKU, producto/sitio, unidad, consumo mensual, existencia, mínimo, cobertura, déficit, venta real al cliente, historia disponible, estado, sugerencia y acceso a evidencia.

**Subtotal principal: 1 tabla y 1 gráfico**, además de los detalles Q03–Q10. No se eliminan estados “sin información suficiente”, avisos de conciliación ni episodios anteriores.

### 2.8 Origen: Clientes y Crédito

| ID | Tipo | Nombre actual | Destino |
|---|---|---|---|
| L01 | Gráfico | Ventas por cliente | Clientes y crédito |
| L02 | Tabla | Clientes | Clientes y crédito |
| L03 | Tabla | Público vs registrado | Clientes y crédito |
| L04 | Tabla | Métodos de pago por modalidad | Clientes y crédito |
| L05 | Tabla | Cuentas por cobrar FIFO | Clientes y crédito |
| L06 | Tabla | Pagos dirigidos | Clientes y crédito; conservar este reporte existente |
| L07 | Tabla | Castigos y reversos de crédito | Clientes y crédito |

**Subtotal: 6 tablas y 1 gráfico.**

### 2.9 Origen: Pagos Dirigidos

| ID | Tipo | Nombre actual | Destino |
|---|---|---|---|
| P01 | Tabla | Pagos dirigidos resueltos | Clientes y crédito → Solicitudes resueltas |

Conserva Fecha, Sitio, Tipo, Cliente/proveedor, Documento, Monto, Motivo, Solicitante, Autorizador, Estado y total de monto. Incluye resueltas aprobadas/rechazadas; conserva la advertencia de que no incluye pendientes.

**No sustituye L06.** “Pagos dirigidos” y “Pagos dirigidos resueltos” no son tablas intercambiables: una no debe desaparecer por compartir parte del nombre.

**Subtotal: 1 tabla y 0 gráficos.**

### 2.10 Origen: Comparativo entre Sitios

| ID | Tipo | Nombre actual | Destino |
|---|---|---|---|
| X01 | Gráfico de líneas | Ventas por Tienda | Ventas → modo Comparar |
| X02 | Gráfico circular | Participación Global | Ventas → modo Comparar |
| X03 | Gráfico de barras apiladas | Mezcla de Pago | Ventas → modo Comparar |
| X04 | Tabla sin título propio | Tabla comparativa por tienda, con Total General | Ventas → modo Comparar, íntegra |

**Subtotal: 1 tabla y 3 gráficos.**

#### Conservación columna por columna de X04

| Columna actual | Qué debe conservarse | Equivalencia / decisión |
|---|---|---|
| Tienda | Identidad y nombre del sitio | Se conserva |
| Part. % | Participación del sitio | No sustituir por otro porcentaje parecido |
| Ventas | Importe de la fuente actual del Comparativo | Hay ventas por sitio en Ventas, pero no se acredita equivalencia exacta de cálculo |
| Tendencia | Tendencia porcentual actual | Sin equivalente completo identificado; conservar |
| Utilidad | Importe monetario actual, no porcentaje de margen | Hay utilidad por sitio, pero no se sustituye su fuente |
| Tickets | Tickets y cancelaciones indicadas en la fila | Conservar ambos; no es una tasa de cancelación |
| Promedio | Ticket promedio y diferencia respecto al general | Sin equivalente completo identificado; conservar |
| Rollos / Metraje | Desgloses actuales de metros, kilos y bolsas por modalidad | Sin equivalente completo identificado; conservar las unidades separadas |
| Medios de Pago | Efectivo, transferencia y crédito | No sustituir por métodos de otra fuente sin equivalencia demostrada |
| Mejor / Peor Día | Fechas e importes de ambos días | Sin equivalente completo identificado; conservar |
| Facturado % | Porcentaje actual | No sustituir por la tabla “Estado de factura”, que no es la misma presentación |
| Dif. Caja | Diferencia de caja actual | Conservar; no reemplazar silenciosamente por otra agregación de Diferencias de Caja |
| Total General | Pie completo con sus totales y desgloses actuales | Conservar íntegro, sin sumar porcentajes ni recalcular valores |

La tabla no se desarma para repartir columnas y perder su contexto. Las otras cuatro pestañas tendrán su modo Comparar sobre sus propios datos; no recibirán artificialmente las métricas de caja de X04.

**Evidencia numérica actual de X04:** el modo aislado del verificador comparó
legacy/current `compareStores` sobre el mismo snapshot real
`READ ONLY REPEATABLE READ`, global, año 2026. El source raw y sus totales
coincidieron completos: ventas `103302.00`, costo `86822.00`, margen
`16480.00`, tickets `4`, ticket promedio `25825.50`, metros `4986.000`,
efectivo `103302.00`, transferencia/crédito `0.00`, cancelaciones `0` y
diferencia de caja `0.00` (participación `100.00`). La exportación compuesta
conservó las 12 columnas, 3 filas y Total General, tomando sus totales de la
fuente sin recomputarlos. Esto es un pase numérico de fuentes; la prueba de
navegador read-only con mock pasó las comprobaciones parciales de contrato UI
con autenticación y respuestas interceptadas. No hubo login, escrituras de DB,
click-through de filas (las capturas fueron cero), bytes reales de descarga ni
E2E autenticada viva; mobile 402 no tuvo overflow de documento. El preview real
del screenshot tool mostrando login es la sesión no autenticada, no evidencia
de reportes. La forma inicial del mock de caja se corrigió durante la captura;
no era un defecto de la aplicación.

### 2.11 Origen: Diferencias de Caja

| ID | Tipo | Nombre actual | Destino |
|---|---|---|---|
| D01 | Bloque de alertas por corte | Alertas de Descuadre Significativo | Control operativo → Diferencias de caja |
| D02 | Gráfico | Tendencia de Diferencia Neta | Control operativo → Diferencias de caja |
| D03 | Gráfico | Porcentaje de Exactitud | Control operativo → Diferencias de caja |
| D04 | Tabla | Diferencias por Cajero | Control operativo → Diferencias de caja |
| D05 | Tabla | Diferencias por Tienda | Control operativo → Diferencias de caja |

Se conservan los controles de periodo, agrupación semanal/mensual, Umbral Corte y Umbral Tienda. El sitio continúa viniendo del encabezado.

D01 hoy es condicional; en el destino su bloque permanecerá visible con cero cuando la consulta autorizada no tenga alertas.

**Subtotal: 2 tablas y 2 gráficos**, además del bloque de alertas.

### Comprobación de cobertura del mapa

| Origen | Tablas principales | Gráficos |
|---|---:|---:|
| Ventas | 18 | 3 |
| Utilidad y Márgenes | 13 | 1 |
| Inventario y Rotación | 4 | 2 |
| Mapas de Calor | 0 | 3 |
| Análisis de Color | 3 | 1 |
| Compras | 7 | 1 |
| Qué comprar | 1 | 1 |
| Clientes y Crédito | 6 | 1 |
| Pagos Dirigidos | 1 | 0 |
| Comparativo entre Sitios | 1 | 3 |
| Diferencias de Caja | 2 | 2 |
| **Total** | **56** | **18** |

Este total no mezcla las tablas principales con los detalles de evidencia Q03–Q10 ni con tarjetas, alertas, filas repetidas por sitio o series repetidas por unidad.

## 3. Indicadores, avisos y comportamientos que también se conservan

| Origen | Indicadores / elementos actuales | Destino |
|---|---|---|
| Ventas | Ventas totales; Tickets totales; cantidades por modalidad y unidad | Ventas |
| Utilidad y Márgenes | Costo, Utilidad y Margen por modalidad; METRAJE con último costo conocido; METRAJE con fuente histórica desconocida; costo congelado, utilidad exacta y margen exacto | Utilidad y márgenes |
| Inventario y Rotación | Existencia, Rollos, Valor y Pérdida estimada por unidad; cantidades y valores en tránsito y en tránsito entre sitios | Qué comprar → Existencia y rotación |
| Mapas de Calor | Meses analizados; aviso de modalidad | Qué comprar → Demanda por mes, tela y color |
| Análisis de Color | Avisos sobre modalidad y sobre la tabla sin movimiento | Qué comprar, junto al elemento correspondiente |
| Compras | Costo recibido; Cantidad recibida por unidad; Rollos recibidos; Concentración principal por unidad | Qué comprar → Compras y proveedores |
| Compras | “Compras”, con el mismo importe que “Costo recibido” | Retirada propuesta R01, explicada abajo |
| Compras | Avisos de que recepción no tiene modalidad y de vigencia/disponibilidad del costo de referencia | Qué comprar → Compras y proveedores |
| Qué comprar | Renglones producto-sitio; Sitios habilitados; Bajo mínimo; Sin información suficiente | Qué comprar → Recomendación y evidencia |
| Qué comprar | Cómo leer consumo y venta; rango válido; advertencias de cálculo/evidencia | Qué comprar → Recomendación y evidencia |
| Clientes y Crédito | Ventas; Utilidad exacta; Ticket promedio; Clientes nuevos | Clientes y crédito |
| Pagos Dirigidos | Solicitudes resueltas; advertencia de exclusión de pendientes | Clientes y crédito → Solicitudes resueltas |
| Comparativo entre Sitios | Desgloses y Total General incluidos en X04 | Ventas → Comparar |
| Diferencias de Caja | Cortes Exactos; Impacto Faltantes y número de cortes; Impacto Sobrantes y número de cortes; Diferencia Neta del periodo y diferencia absoluta | Control operativo → Diferencias de caja |

Además se mantienen filtros aplicables, ordenamiento, totales, unidades, variantes ROLLOS/METRAJE, exportaciones existentes, avisos y estados de carga/error. Mover un bloque no habilita un filtro que antes no le aplicaba.

## 4. Retirada propuesta y semejanzas que NO justifican borrar

### R01 — Único duplicado exacto confirmado

- **Origen:** Compras.
- **Retirar:** tarjeta “Compras”.
- **Conservar:** tarjeta “Costo recibido”, en Qué comprar → Compras y proveedores.
- **Evidencia:** ambas tarjetas reciben exactamente `totalCost`, con el mismo tipo monetario, filtro y restricción económica.
- **Alcance:** una tarjeta; ninguna tabla, gráfico, operación ni fórmula.
- **Estado:** retirada autorizada y aplicada al código; la evidencia numérica y
  las comprobaciones parciales UI están documentadas, pero no hay publicación
  completa ni E2E autenticada viva.

### No retirar estos pares

| Elementos parecidos | Por qué se conservan |
|---|---|
| Existencia actual y rotación / tabla Qué comprar | La primera conserva stock y rotación; la segunda agrega mínimos, recomendación y evidencia. No son reemplazos completos. |
| Sin movimiento / Sin movimiento ≥90 días | El primer reporte incluye bandas y otra selección; el segundo tiene el umbral y agrupación indicados en su título. |
| Mes × tela / Color × tela / Venta real al cliente por mes y color | Cambian dimensiones, periodización y/o fuente de cantidad. Una matriz no reemplaza a las otras. |
| Compras por producto / tabla Qué comprar | Costos y recepción no equivalen a recomendación de compra. |
| Pagos dirigidos / Pagos dirigidos resueltos | Conservan información y estados distintos. |
| Ventas por sitio / Comparativo por tienda | Los nombres parecidos no garantizan la misma base financiera. X04 conserva su fuente; la comparación raw legacy/current del global 2026 pasa y su exportación conserva los totales de `compareStores`. |
| Cancelaciones en Ventas / control de cancelaciones | Ventas está protegido; el control adicional facilita seguimiento sin quitar el detalle original. |

## 5. Control operativo: origen de cada bloque nuevo

Esta sección distingue contenido que se mueve de contenido que debe consolidarse desde otras pantallas. **No afirma que los bloques nuevos ya estén construidos.**

Orden propuesto: dinero faltante y movimientos que reducen existencias primero; después mercancía pendiente, incongruencias y controles de seguimiento.

| Orden | Bloque | Origen actual | Destino y contenido previsto |
|---|---|---|---|
| 1 | Diferencias de caja | Pestaña actual completa | D01–D05 y todas sus tarjetas, umbrales y agrupaciones. Conteos, faltantes, sobrantes e importes actuales; acceso al corte originador. |
| 2 | Ajustes de inventario | Movimientos/ajustes; “Comprado vs vendido” solo aporta un agregado negativo, no todo el detalle | Conteo y movimientos; cantidades por unidad, sin sumarlas entre unidades incompatibles. Importe solo si tiene una fuente válida. Los ajustes negativos deben ser fáciles de identificar. |
| 3 | Salidas autorizadas no entregadas después de 24 horas | Control existente en Alertas de administración | Reutilizar su condición y reloj actuales; no inventar otra fecha inicial ni otro umbral. Acceso a salida y documento vinculado. |
| 4 | Abonos con cuenta destino incongruente | Cuentas destino y su consulta de movimientos incongruentes | Conteo e importe de los abonos afectados; acceso al detalle del abono, no solo a la cuenta. |
| 5 | Tickets cancelados y tasa | Resumen de cancelaciones, Cancelaciones y Productos cancelados de Ventas; conteos del Comparativo | Conservar los conteos/importes originales y acceder al ticket. La tasa necesita definición explícita antes de implementarse: no encontré una tasa existente en esas fuentes. |
| 6 | Salidas canceladas | Historial y estado de Salidas | Conteo, detalle y acceso a cada salida; no tratar automáticamente toda cancelación como mercancía perdida. |
| 7 | Rollos con tres o más reimpresiones de etiqueta | Registros de reimpresión/auditoría | Conteo de rollos afectados, número de reimpresiones por rollo y acceso a rollo/historial. Sin importe monetario inventado. |

**Umbral de 24 horas localizado:** `admin-alertas.ts` conserva el valor 24 y una comparación estricta: exactamente 24 horas todavía no vence. La consulta contempla tránsito entre sitios desde envío y ventas a cliente pendientes según cobro/autorización y estado de salida. Se debe reutilizar esa condición completa, no reducirla a una resta arbitraria contra la fecha de creación.

**Enlaces:** existen rutas de ticket, salida y rollo. Los reportes genéricos actuales no resuelven todos los enlaces; algunos solo presentan folios o números de corte. La implementación deberá incorporar la identidad y apertura del documento concreto. Enviar al listado general de cortes, ajustes o cuentas no bastará para dar por cumplido el requisito.

**Ceros:** los siete bloques seguirán visibles cuando una consulta autorizada termine con cero resultados. Error, falta de permiso o carga pendiente no se presentarán falsamente como “cero problemas”.

## 6. Modo Comparar y permisos

| Destino | Comparación propuesta |
|---|---|
| Ventas | Recibe X01–X04 completos, conservando la fuente del Comparativo actual. |
| Qué comprar | Permite comparar sus datos actuales por sitio: recomendación, existencia, cobertura y demanda; conserva Mes × sitio y Color por sitio. |
| Utilidad y márgenes | Compara los datos del propio reporte por sitio, manteniendo utilidad y precios por sitio. No toma como sustituto la columna Utilidad de X04. |
| Clientes y crédito | Compara las vistas del propio reporte bajo su filtro de sitio actual. No reparte saldos globales por suposición ni suma como deudas distintas el mismo saldo compartido. |
| Control operativo | Compara las mismas señales por sitio, conservando Diferencias por Tienda. |

- El único selector de sitio será el del encabezado existente.
- Propuesta de uso: Vista Global habilita comparación de los sitios autorizados; un sitio concreto mantiene su consulta individual. El control de modo Comparar no será otro selector de ubicaciones.
- Alcance PROPIA no obtiene acceso a otros sitios por activar comparación.
- Los bloques recibidos conservan sus restricciones originales. Por ejemplo, mover Compras a Qué comprar no habilita sus costos a un usuario que hoy no los ve.
- El código actual distingue pestañas restringidas a ADMIN y redacción económica en los reportes genéricos. El Comparativo y Diferencias usan componentes y endpoints separados. Reunirlos no debe ampliar ni sustituir esas comprobaciones.
- Se mantienen Ventas, Utilidad y márgenes y Clientes y crédito sin rediseñar sus contenidos actuales.

## 7. Qué se está aprobando y qué queda pendiente

La aprobación recibida cubre los destinos de los elementos V01–D05, el detalle Q03–Q10, la conservación íntegra X01–X04 y la retirada R01.

La tasa no se implementa todavía. Su definición futura aprobada es cancelados del periodo / (contabilizados + cancelados del periodo) × 100, con fecha de cancelación y criterio canónico de contabilización como Caja en Tiempo Real. Si el criterio del tablero difiere al implementarla, detenerse y reportarlo. Ventas y Control deben compartir la fuente de cancelaciones; no duplicar su consulta. El mapa no autoriza recuperar datos, cambiar reglas financieras o ampliar permisos.

Las verificaciones posteriores a la aprobación, incluida la evidencia numérica y
las comprobaciones parciales UI con sus límites, están documentadas en
`reports/reorganizacion-reportes-verificacion.md`. No considerar este mapa como
publicación completa ni como evidencia de una E2E autenticada viva.

## 8. Fuentes consultadas

- `artifacts/mariana-textil/src/pages/reportes.tsx`: once pestañas, montaje de componentes, filtros y permisos visibles.
- `artifacts/api-server/src/lib/reportes-sales.ts`: Ventas y Utilidad.
- `artifacts/api-server/src/lib/reportes-inventory.ts`: Inventario, Mapas y Color.
- `artifacts/api-server/src/lib/reportes-commercial.ts`: Compras y Clientes.
- `artifacts/api-server/src/lib/reportes.ts`: Pagos Dirigidos y composición de reportes.
- `artifacts/api-server/src/lib/reportes-que-comprar.ts` y `artifacts/mariana-textil/src/components/reportes/que-comprar-report.tsx`: recomendación y evidencia.
- `artifacts/mariana-textil/src/pages/caja/comparativo.tsx` y `artifacts/api-server/src/lib/admin-analytics.ts`: Comparativo.
- `artifacts/mariana-textil/src/pages/caja/diferencias.tsx`: Diferencias de Caja.
- `artifacts/api-server/src/lib/admin-alertas.ts`: condición existente de salidas pendientes y umbral de 24 horas.

**Mapa aprobado. El contrato fuente y las comprobaciones parciales UI están
documentados; siguen pendientes la decisión explícita sobre la pantalla de historial
individual de etiquetas y cualquier publicación o E2E autenticada viva.**