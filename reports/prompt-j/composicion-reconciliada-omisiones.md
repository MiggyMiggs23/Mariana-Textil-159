# Composición reconciliada: inventario y límites de verificación

## Alcance

Propuesta visual, no implementación en la aplicación. Las imágenes de referencia aportan jerarquía, iconos, espaciado y agrupación; no sustituyen las reglas financieras ni los enlaces existentes.

Se conserva el orden canónico compartido: **Mariana → Coco → Cruces**. Los resultados de las consultas canónicas no se sustituyen por los importes de las referencias.

## Caja en Tiempo Real: elementos que la referencia omite o no permite verificar

| Elemento existente | Qué se conserva |
| --- | --- |
| Columnas adicionales del comparativo | Efectivo, Transferencia y Crédito; se conserva también el Total General existente, sin añadir cálculos. La referencia muestra únicamente las columnas iniciales. |
| Tasa de cancelación | Porcentaje de tickets cancelados, además del conteo y el importe. |
| Costos todavía no capturados | Estados “Pendiente” o “Costo pendiente” de utilidad/margen donde corresponda; no convertirlos en cero. |
| Identidad del cajero | Nombre del cajero cuando existe una sesión, además de apertura, sesión y terminal. La referencia solo ilustra parte de esta información. |
| Desgloses de las cifras | Contado cobrado, crédito y las cuatro señales conservan sus diálogos, conceptos, tablas, paginación y acceso a documentos. Un icono no sustituye estos enlaces. |
| Navegación de documentos | Se conserva la fila enlazada, folio, cliente, tienda, estado, hora e importe; también sus estados pendientes. |
| Modalidades y unidades devueltas por el sistema | Se conserva la colección real de cantidades y sus unidades; no se limita el sistema a los dos ejemplos de la referencia. |
| Estados de las cuatro señales | Colores, condiciones de encendido, alertas, orden y conteos permanecen iguales a la aplicación actual, incluidos ceros. |
| Cobranza como aclaración | Total enlazado y los tres enlaces por fuente, con fechas y ubicación conservadas. No se copia el bloque con encabezado propio que aparece en la referencia. |

Ventas (Total) y Utilidad de Caja siguen sin ser clicables: no se agregan acciones que hoy no existen.

## Cuentas Destino: elementos omitidos, reducidos o no representados en todos sus estados

| Elemento existente | Qué se conserva |
| --- | --- |
| Comparación completa | El interruptor sí aparece en la referencia. Se conservan también los importes anteriores, variaciones y enlaces de las tarjetas y las columnas Anterior/Var de la tabla de abonos, que esa imagen no despliega. La matriz no tiene columnas comparativas nuevas. |
| Periodos personalizados | Selector completo y fechas Desde/Hasta cuando corresponda; no solo “Hoy”. |
| Descuadre de la matriz | Aviso condicional cuando la matriz no cierra, con su declaración original. No se fuerza un estado de cierre. |
| Incongruencias | Bloque separado con conteo, importe, acceso al conjunto y filtros por cuenta. No es el mismo aviso que el descuadre de la matriz. |
| Columna Otras | Se conserva cuando tiene importe, con sus celdas y filtros. |
| Celdas y totales enlazados | Se mantienen destino, forma de pago, facturación, fuentes, periodo y ubicación. Los ceros siguen representándose como “—” sin enlaces, como ocurre hoy. |
| Porcentajes | La referencia sí muestra porcentajes de efectivo y cuentas. Se conservan los tres porcentajes reales y sus estados comparativos, separados del importe. |
| Declaración del efectivo facturado | El importe aparece en la referencia, pero se conserva además el enlace específico a caja física facturada y su alcance. No se sustituye por facturación de ventas ni por IVA. |
| Aclaración de cobranza | Cobros directos; Abonos a notas (neto de reversos); Saldo a favor (neto de reversos), pegados a la cifra que explican. Se preservan signos negativos y filtros. |
| Abonos y saldos a favor | Todas las filas, destinos, fuentes, comparaciones y enlaces; no solo las dos filas ilustrativas. Se conserva la aclaración de neto del periodo, incluidos reversos. |
| Base e IVA facturados | Se conservan los valores y su alcance original, sin reinterpretarlos como facturación del efectivo cobrado. |
| Gráfica diaria | Series, fechas, importes, leyenda, información al señalar y estados vacíos originales; no se fabrican barras. |
| Desglose por tienda | Todas las filas y métricas devueltas, con el orden canónico compartido. |
| Actualización y exportaciones | Actualizar, Excel y PDF permanecen previstos con su comportamiento original; las imágenes estáticas no prueban esas acciones. |
| Detalle financiero y documentos | Se conservan movimientos, filtros, paginación, detalle de movimiento y enlaces de documento/folio. La maqueta no constituye una prueba autenticada de ese recorrido. |

## Composición reconciliada

- Se adopta el lenguaje visual de las referencias: iconos de línea con fondos discretos, encabezados claros, más espacio entre rótulos e importes y agrupación legible.
- Caja conserva la franja delgada de cantidades y una aclaración de cobranza elevada, sin encabezado de sección propio.
- Las cuatro señales operativas no heredan los colores de las referencias.
- Los destinos conservan la agrupación acordada: tres de efectivo y después dos bancarios, al mismo nivel en escritorio. Los tamaños móviles aprobados no se homogeneizan.
- Cobrado con su desglose se conserva junto a la tabla de abonos, con alineación y altura común en escritorio.
- Ninguna cifra existente cambia de valor o cálculo por esta reorganización. Se mantiene únicamente la excepción previamente autorizada para efectivo sin factura.

## Evidencia real y límites

Se verificó que la conexión de lectura coincide con el pool de la API actualmente en ejecución. Las lecturas canónicas se hicieron con protección de solo lectura; no se crearon usuarios, sesiones de caja, tickets ni líneas de venta. **Esto no establece equivalencia con una publicación desplegada.**

| Caso solicitado | Resultado |
| --- | --- |
| Nombres y orden reales de tiendas | Disponibles: Mariana, Coco y Cruces. |
| Caja cerrada | Disponible: las tres tiendas carecen de sesión de caja en la base verificada. |
| Todo en cero | Disponible: la base verificada tiene cero tickets, líneas de venta y sesiones. Las pantallas usan esas respuestas canónicas, no cifras redondas inventadas. |
| Importes de siete dígitos | No verificable con esta base: no existen operaciones. No se certifica este caso. |
| Cliente/producto largos en una operación | Hay nombres reales en catálogos, pero no ventas a las que estén vinculados. No se inventan documentos para probarlos ni se agregan campos de producto a pantallas que no los muestran. |
| Recorrido cifra → detalle → folio con datos reales | Pendiente: no hay operaciones para recorrer y no se creó una sesión autenticada. Se inventarían pruebas si se afirmara lo contrario. |
| Comparación, incongruencias y costos pendientes con datos no vacíos | Conservados como ramas del código; no certificados con casos reales inexistentes en esta base. |

La propuesta se presenta para revisión de composición. Los casos pendientes no se consideran aprobados ni verificados por mostrar correctamente una pantalla en cero.