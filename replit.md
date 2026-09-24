### Tanda E continuación — estado 24/09/2026

Recorrido aislado conciliado: efectivo765, transferencia150, deuda100; sesión46 abierta antes de destruir la copia privada autorizada. E3 PDF real servido: dos A5 horizontales Cliente/Tienda en Chromium140/153, botón auditado y screenshot antes del PDF; impresión física no probada. Signo CANCELACION+1 corregido. Informe y descarga autocontenida en `reports/tanda-e-continuacion/`; evidencia de candidatos fallidos conservada. UI `dist-tanda-e-print-resize-final-20260924` liberada en el runtime del workspace con TOML validado y un reinicio web; API sin cambios ni reinicio por esta continuación. No reusar los scripts de mutación ni credenciales desechadas.

Los documentos impresos requieren `print-color-adjust: exact` para que el logo y los fondos lleguen al papel; sin esa regla el navegador los descarta.

**El ticket, la nota, la nota de productos y la hoja de Salida NO imprimen números de serie** y agrupan los rollos por producto. Las series de Salida permanecen completas en el sistema y se consultan desde su detalle en pantalla. **La hoja de viaje y la hoja de auditoría SÍ imprimen las series**, porque son documentos de control interno.

Todo documento imprimible debe poder abrirse en cualquier momento desde el folio de su lista, no solo al crearse.

Los documentos impresos llevan el logo centrado arriba. Los documentos con QR lo muestran en la esquina superior derecha y lo dirigen al mismo destino que el folio en azul de su lista, con la dirección construida desde el origen en que corre la aplicación, nunca escrita a mano. El ticket de venta es la excepción: no lleva QR.

**Documentos impresos, agregación:** Entrada y Salida imprimen **un renglón por producto** con el total de rollos y la cantidad total, no un renglón por rollo. Como el producto ya incluye el color y la unidad es atributo del producto, agrupar por producto agrupa por tela y color y nunca mezcla metros con kilos, bolsas ni piezas. Agrupar por tela sí los mezclaría y está prohibido.

El alta y la baja de rollos **siguen siendo rollo por rollo con su número de serie**, y el sistema conserva el detalle completo. Lo que cambia es solo qué se imprime.

**Salida** no imprime números de serie: quedan en el sistema y se consultan en el detalle en pantalla. **Entrada** sí los imprime, pero después de las hojas de globales, en un listado compacto agrupado por producto, con numeración continua y sin repetir el pie de firmas —ese va solo en la última hoja de globales, que es la que se firma.

**Escala del encabezado:** Entrada y Salida usan el encabezado documental a la misma escala, con la rejilla de tres columnas, título a la izquierda, logo centrado y QR a la derecha. Salida es A5 horizontal —no A6— y conserva logo y QR de 112 px; nunca se reduce el encabezado para forzar más renglones.

**Hojas de series:** el listado de series de una Entrada no repite el encabezado completo. Lleva una franja de una línea con folio, la leyenda "Listado de series" y la paginación —suficiente para volver a asociar una hoja suelta a su entrada—. El título grande, el logo y el QR van solo en las hojas de globales.

**Pie de firmas indivisible:** el bloque de observaciones y las tres firmas con su leyenda nunca se parte entre hojas. Si no cabe, la hoja lleva menos renglones de producto; nunca se empuja el pie a una hoja propia ni se dejan las líneas sin su leyenda. Va en la última hoja de globales, que es la que se firma.

**Desbordamiento acumulado:** cada hoja es un contenedor de altura fija que no puede desbordar. Un bloque más alto que la hoja empuja su sobrante arriba del encabezado de la siguiente y el error se suma hoja tras hoja, hasta que el navegador imprime más hojas de las que el documento numera. La señal de que existe es un renglón huérfano arriba de un encabezado, o que el conteo del navegador no coincida con la paginación. Se corrige midiendo, nunca bajando el número de renglones a ojo hasta que deje de verse.

Decisión conservadora para Entradas pequeñas: si el listado completo de series cabe en el espacio libre de la última hoja global, se imprime allí después de los productos y antes del pie; se incrusta completo o no se incrusta. Así una Entrada de una línea y una serie ocupa una sola hoja sin perder la serie ni separar las firmas.

Las líneas por página de cada documento son un valor medido, comentado junto a la constante. Cambiar el pie —agregar firmas, por ejemplo— invalida ese número y obliga a recalcularlo.

Decisión conservadora: el contrato vigente de `GET /inventario/entradas/{id}` ya contiene tanto las líneas agregadas como cada rollo con serie, producto y cantidad. El documento reutiliza esa única respuesta; no se crea ni duplica un endpoint de series mientras el contrato siga completo.
# Decisiones de la Parte 9

**Formas de pago de clientes y proveedores:** EFECTIVO, TRANSFERENCIA y FACTURADO son las únicas opciones ofrecidas para movimientos de cuenta. CHEQUE, OTRO y CREDITO son valores **históricos no seleccionables** de `formaPagoCuentaEnum`: siguen en la base para que los registros viejos se lean y no se ofrecen en formularios. CREDITO lo escribe la autorización de Nota mediante `autorizarNota` en `artifacts/api-server/src/lib/pos.ts`; no es una opción que el operador capture.

**FACTURADO e IVA:** mueve el saldo por el **monto capturado, que ya incluye el IVA**. El sistema **nunca** le suma 16% a un monto capturado; solo desglosa cuánto fue subtotal y cuánto IVA donde el desglose aporte. La tasa vive en una sola constante compartida y no se escribe a mano en ningún lugar nuevo.

El contador confirma **contra lo facturado**, no contra lo cobrado. La diferencia entre facturado y cobrado es cartera de ventas fiscales a crédito, no un descuadre, y la pantalla debe decirlo. Al confirmar se congela la cifra contra la que se confirmó.

En toda tabla documental, el identificador principal del renglón enlaza a su origen cuando existe un destino identificable. **Un renglón puede tener varios identificadores navegables de entidades distintas**: por ejemplo, serie → rollo y folio → documento. La regla prohíbe columnas decorativas de «Ver detalle» y enlaces redundantes al mismo destino, no los caminos necesarios a cada origen.

**Identidad de navegación:** las rutas se construyen exclusivamente con IDs internos o relaciones estables verificadas; el folio y la serie sirven como texto visible, nunca como sustitutos del ID. Si solo existe un folio o una referencia ambigua, el caso requiere contrato/resolución y queda sin enlace hasta identificarlo; no se prueba una ruta por coincidencia numérica. La falta de pantalla o ruta destino es categoría C: se reporta y no se construye sin una decisión separada del propietario.

Las capturas en borrador, los catálogos editados en diálogo y los documentos imprimibles no requieren convertir cada celda en un enlace. Los agregados conservan su regla propia de desglose hacia los documentos que los componen; no se les inventa un ID documental.

**Facturación con líneas metreadas — confirmado por el propietario (2026-09-18):** no se permite facturar ventas con líneas por metro. Sustituye el texto anterior «Pendiente de confirmar con el usuario: hoy no se puede marcar como facturada una venta con líneas metreadas»; se mantiene la restricción.

**Formas de cobro de un ticket:** Efectivo y Transferencia. El enum compartido `formaPagoTicketEnum` de `lib/db/src/schema/enums.ts` conserva EFECTIVO, TRANSFERENCIA, CREDITO y FACTURADO; CREDITO corresponde a Nota, no a un cobro de Ticket, y FACTURADO permanece como valor histórico no seleccionable para leer cobros anteriores. La factura se decide en el POS mediante el campo `facturado`, y la cuenta destino se deriva de ese campo, nunca de la forma de pago. **El crédito es exclusivo de las notas**, se decide en el POS y nunca se ofrece como forma de cobro; Caja únicamente autoriza la Nota.

**Cobro de METREADO:** si cualquier línea es METREADO, Caja ofrece únicamente Efectivo, también en pago dividido. Esta restricción conserva coherencia con el servidor (`METREADO_CASH_ONLY`) y con la regla existente que rechaza facturar ventas metreadas; no se permite construir en la interfaz una combinación que el servidor rechazará.

La revisión del flujo encontró además un panel de validación y un bloqueo del botón final condicionados a `esCredito`; ambos pertenecían a la antigua opción Crédito y se retiraron junto con ella.

**La pantalla se llama Precios** y debe mostrar los productos sin precio, marcados como "Sin precio" y nunca como $0.00. Es la única vía para capturar el precio de un producto que se importó sin él, así que filtrarlos la vuelve inservible justo cuando más se necesita.

**Agrupación de Precios:** el listado muestra un renglón por producto y sus colores plegados. Como no existe un catálogo de telas, la agrupación usa la cadena `tela` recortada y sin distinguir mayúsculas, conserva la primera escritura encontrada y ordena producto/color en español. Variantes, acentos o errores que la normalización no iguale todavía pueden partir un producto; crear un catálogo de telas es la solución de fondo pendiente. El renglón de grupo nunca suma ni promedia costo, precio o margen: esas cifras pertenecen a cada color y un agregado se leería falsamente como precio operativo.

**Selección y cambio masivo de Precios:** la casilla del producto selecciona únicamente sus colores visibles y nunca otro producto; cambiar entre Rollo, Mayoreo y Menudeo vacía la selección. En Mayoreo y Menudeo no son seleccionables los colores sin venta fraccionada ni los productos por kilo o pieza, exactamente igual que en el servidor. Todo cambio masivo exige precio positivo y motivo, admite como máximo 200 productos y escribe historial y auditoría por producto, nunca por tanda. La tanda corre en una sola transacción, valida todo antes de escribir, toma candados en orden ascendente de identificador y reutiliza el mismo cálculo que el cambio individual; el límite evita mantener una transacción y sus candados abiertos durante tandas excesivas. El umbral de Mayoreo es 10 unidades y su única fuente es `MAYOREO_THRESHOLD_UNITS` en `lib/metered-pricing/src/index.ts`; no se duplica.

**Cambio del 7 de septiembre de 2026:** se renombró la pantalla a Precios, se agrupó el catálogo por producto/color y se agregó captura masiva transaccional con selección visible, confirmación bajo costo, historial y auditoría individuales.

**Precio mínimo — vigente ON por Tanda D (2026-09-23):** el precio de lista no tiene techo para subir; el piso es el costo cuando el producto tenga costo registrado. A un producto sin costo registrado se le puede asignar precio de lista; esto no elimina el bloqueo de venta por costo del rollo. El bloqueo está activo en fuente en las mutaciones individual/masiva de Precios y su interfaz; sustituye la confirmación bajo costo. La edición ordinaria del producto remite cambios de precio a Precios; crear/importar productos nuevos sin costo permite asignar precio. El cambio de precios se configura mediante matriz, no como guard fijo por rol; la discrepancia del default histórico SISTEMAS y los límites de verificación constan en `reports/tanda-d-20260923/tarea1.md`. La integración/build de MAIN no equivale por sí misma a haber servido el candidato.

**Movimientos → ticket:** el único enlace de ticket de cada representación del renglón se construye exclusivamente con `ticketId`, el ID primario real validado contra un ticket existente; nunca con el índice visual ni con el folio. Los movimientos sin ticket real no muestran enlace. Búsqueda, filtros y página usan el estado de la entrada del historial SPA, por lo que Atrás restaura la vista y una entrada directa o recargada conserva el estado de `history.state` cuando existe, con valores seguros por omisión cuando no existe.

# Mariana Textil

## Estándar de composición del sistema

### Reglas comunes y referencias canónicas

- **Color.** El color codifica información, nunca decora; cada uso tiene un significado explicable en una frase y escrito junto al código. Si no puede explicarse así, no se usa.
- **Navegación de cifras.** Ninguna cifra es un callejón sin salida: abre el detalle de los documentos que la componen y desde ese detalle se llega al documento por su folio. Se conservan los filtros y la conciliación aplicables; la identidad de la ruta se rige por «Decisiones de la Parte 9 — Identidad de navegación», sin inventar destinos.
- **Identificadores del renglón.** Aplicar la regla de «Decisiones de la Parte 9» sobre destinos propios de cada identificador, columnas decorativas y excepciones documentales; esa es su única definición.
- **Estado de nota y pendiente.** Aplicar «Abonos, estados y saldo a favor — Estados canónicos de nota» para el contenido de la insignia y el campo independiente del pendiente; no redefinirlos por pantalla.
- **Encendido de Tiempo real.** Aplicar la decisión cerrada del propietario en «Tablero: venta y cobranza»; este estándar no autoriza reinterpretar sus colores.
- **Unidades.** Aplicar la resolución y las etiquetas de «Parte 10 — Catálogo por tela y unidad BOLSA», sin otra definición local.

### Composición

- **Jerarquía.** Cada pantalla declara qué cifra manda: lo principal se lee primero y lo subordinado como subordinado. Una cifra en cero no ocupa el espacio de una importante; se compone por importancia, no por simetría, sin eliminar información.
- **Agrupación.** Las tarjetas se agrupan por la pregunta que contestan, no por cuántas caben en un renglón, y las cifras del mismo nivel se presentan del mismo tamaño. Un dato que aclara otra cifra va pegado a ella como desglose, nunca como sección con título propio.
- **Iconos.** Un icono ubica, no adorna ni clasifica: se usan los del sistema, sin introducir una librería nueva, y un conjunto de tarjetas del mismo nivel los lleva todos o ninguno. El color del icono no codifica información.
- **Respiración.** Nada se encima: ni rótulos sobre cifras, ni porcentajes sobre importes, ni bloques colgando con espacio vacío al lado. Los títulos y sus valores llevan separación real.
- **Componentes compartidos.** Se reutilizan las tarjetas, tablas e insignias existentes. No se escriben por separado componentes equivalentes que terminarían divergiendo.
- **Enlaces visibles.** Lo que se puede abrir se distingue de lo que no. Un identificador enlazado se ve enlazado.
- **Teléfono.** Toda pantalla se comprueba a 402 px y al apilar conserva el orden y la agrupación de escritorio. Las tablas anchas conservan su desplazamiento horizontal y la página nunca se desplaza de lado.
- **Datos incómodos.** La composición se comprueba con los nombres más largos del catálogo, los importes de más dígitos, un sitio con caja cerrada y todo en cero. Una maqueta con cifras redondas no basta para aprobarla.

### Lo que la composición no autoriza

1. **Rediseñar no es quitar.** Ninguna cifra, desglose, tabla, gráfica ni enlace existente desaparece por composición; cada entrega incluye la tabla del antes y después de cada cifra y el inventario de qué había y dónde quedó.
2. **Referencia externa, no especificación.** Una referencia visual o maqueta no conoce todas las reglas del sistema; lo que no representa se conserva.
3. **No cambia cálculos.** Si un cambio visual exige tocar una consulta o un predicado, deja de ser composición: se detiene y se reporta.
4. **No sustituye alcance del servidor.** Tapar una cifra en pantalla no es una restricción ni sustituye un filtro del servidor.

### Entrega y aprobación

- **Propuesta antes de implementar.** Cuando un cambio reorganiza una pantalla, se presenta la composición al propietario antes de implementarla, aunque el encargo no lo pida expresamente.
- **Vocabulario del negocio.** Los rótulos de estados, encabezados de sección y nombres de documentos los decide el propietario. El agente propone, no los renombra unilateralmente.

## POS y Caja — regla contable vigente

**Nada cuenta hasta que caja lo procesa.** Un Ticket entra a Ventas, Contado cobrado y Utilidad únicamente al cobrarse; una Nota entra a Ventas, Ventas a crédito y Utilidad únicamente al autorizarse. La identidad canónica es **Ventas = Contado + Ventas a crédito**. Contado cobrado es la etiqueta de presentación de Contado, antes llamada Cobrado (Caja), sin cambiar su cálculo. La nomenclatura E6 distingue Contado cobrado de Cobranza del periodo, otra medición descrita en «Cuentas Destino» y «Tablero: venta y cobranza». E6 por sí sola no resolvió la atribución por sitio; la extensión E7 posterior habilita una consulta financiera de atribución por periodo/alcance, sin escrituras E5 ni atribución histórica E1. Pendiente de cobro queda fuera de Ventas y es solo un indicador operativo. La autorización de Nota tiene estado y evento durable propios; nunca se infiere de `estado='VENDIDO'`.

**Pendientes operativos (Bloque 4):** `documentosPendientes` cuenta los tickets sin cobrar y las notas sin autorizar. El nombre anterior mentía porque decía solo tickets aunque el predicado incluye ambos tipos de documento.

**Comportamiento de pago:** cada Nota pesa igual. Liquidar el día del vencimiento cuenta a tiempo, sin gracia; una vencida impaga cuenta tarde y una abierta no vencida se excluye y se reporta aparte. Los colores son verde ≥90%, amarillo 70–89% y rojo <70%, pero se requieren **5 Notas liquidadas** para asignar color: es un mínimo conservador que evita llamar verde a dos operaciones aisladas. La sugerencia de revisar el límite exige verde, historial suficiente, cero vencidas y utilización sustancial de al menos **75%**; solo explica evidencia, nunca cambia el límite ni propone un monto. La fecha efectiva del movimiento de pago determina puntualidad y `aplicaciones_credito` queda como evidencia, no como fuente de saldo.

Fuente de esos umbrales: `artifacts/api-server/src/lib/payment-behavior.ts`, función `projectPaymentBehavior` y constantes `PAYMENT_BEHAVIOR_GREEN_MIN_PERCENT`, `PAYMENT_BEHAVIOR_YELLOW_MIN_PERCENT`, `PAYMENT_BEHAVIOR_MIN_SETTLED_NOTES` y `CREDIT_INCREASE_SUBSTANTIAL_UTILIZATION_PERCENT`. Los plazos se validan con `isCreditTerm` en `artifacts/api-server/src/lib/clientes-aging.ts`; no se infieren del texto de una pantalla.

**Ticket es contado, Nota es crédito.** No existe ticket a crédito ni nota de contado. **El plazo se elige en el POS**, no en caja: la nota se imprime en el POS con su pagaré, y el pagaré remite a la fecha de pago señalada en la nota; decidir el plazo después dejaría esa referencia vacía.

**Caja distingue las dos operaciones:** un ticket se **cobra**, una nota se **autoriza**. **El límite de crédito es duro y se valida al autorizar la Nota** contra el saldo contable autorizado del libro de movimientos de crédito, bajo un candado transaccional por cliente que serializa autorizaciones concurrentes. Las Notas pendientes no reservan crédito. Si el saldo vigente más la Nota excede el límite, la autorización se rechaza sin excepción: no hay override con contraseña ni aprobación remota. La única vía es que un ADMIN suba antes el límite de crédito del cliente, como una decisión separada sobre su perfil y con su propia auditoría.

**Caja no imprime documentos de venta.** El corte de caja es la única excepción.

En la lista de Caja, una venta con `facturado=true` se identifica como **VENTA FACTURADA** en rojo y con su folio, sin llamarla Ticket ni Nota. El rojo significa exclusivamente que la venta lleva factura; no representa un error.

## Salidas para venta a cliente

**Caso de negocio:** un cliente compra en Mariana, pero los rollos están en otra tienda o bodega. La modalidad `VENTA_CLIENTE` permite apartarlos por serie, cobrar o autorizar la venta en Mariana y entregarlos directamente en el sitio que ya los tiene, sin hacer un traslado físico.

El flujo completo tiene seis pasos:

1. El sitio de origen arma una salida para un cliente existente con rollos identificados. Al pasar a `EN_TRANSITO`, las series quedan bloqueadas.
2. El documento impreso de la salida llega a Mariana, pero **la mercancía no viaja**: permanece apartada en el origen para que el cliente la recoja ahí.
3. Mariana abre **Salidas pendientes a cobro** en POS, revisa las salidas agrupadas por cliente, puede excluir alguna y genera un Ticket de contado o una Nota de crédito. POS imprime la nota al generarla, sin esperar autorización: ese papel es el que el cliente lleva a caja.
4. Caja cobra el Ticket o autoriza la Nota en el sistema y pone el sello físico con tinta sobre el papel. El sistema no imprime ningún sello de autorización.
5. El cliente lleva el papel sellado al sitio de origen. Se conserva el formato existente —80 mm para Ticket o A5 vertical para Nota— y el resto de sus datos.
6. Antes de entregar, el operador comprueba ambas cosas juntas: el sello físico en el papel y el estado autorizado en el sistema. Cualquiera puede imprimir una nota; solo caja tiene el sello y solo caja cambia la autorización. Verifica el folio, escanea las series, entrega y marca `ENTREGADA`.

En el historial, el botón naranja con el icono `+` **Nueva salida para venta a cliente** representa únicamente la acción de crear una salida de esta modalidad. El naranja no significa autorizado, pagado ni entregado; esos estados se muestran por separado en la etiqueta derivada de la salida y su documento.

**La mercancía no viaja y el sitio que vende no es el sitio que la tiene.** Por eso todo candado consultivo de inventario se toma sobre el par producto–ubicación de **origen**, y cuando hay varios orígenes se ordena determinísticamente por ubicación. Tomar el candado sobre Mariana, que emite el documento, dejaría sin serializar el saldo real de la bodega y permitiría vender el mismo rollo dos veces.

Esta modalidad admite exclusivamente rollos identificados. Sin una serie física no existe una identidad concreta que reservar, bloquear, verificar al entregar ni rastrear en caso de conflicto; nunca se aparta solo una cantidad.

**AUTORIZADA no es un estado de la salida.** Se deriva del documento ligado: Ticket cobrado o Nota autorizada. No se guarda una segunda bandera en `salidas`, porque dos verdades persistidas sobre el mismo hecho pueden divergir. El ciclo propio de la salida es `ARMANDO → EN_TRANSITO → RECIBIDA → ENTREGADA`, más `CANCELADA` antes de la entrega.

Etiquetas del historial de venta a cliente, derivadas de los cinco estados existentes más el documento ligado, mediante una sola función compartida por todas las vistas (escritorio, teléfono y cualquier reporte que presente ese estado); no se agregan valores al enum:

| Momento | Etiqueta |
|---|---|
| Se creó la salida para venta | En curso |
| POS recibió y generó el documento | Por autorizar |
| Caja cobró el Ticket o autorizó la Nota | Autorizada |
| El origen entregó | Entregada |
| Se canceló | Cancelada |

Los traslados normales conservan sus etiquetas actuales. Todo movimiento generado por un documento debe llevar ese documento y permitir enlazarlo: un movimiento sin documento de origen rompe la trazabilidad del inventario. En POS, `TICKET_BOLSA_NORMAL`, `TICKET_PIEZA_NORMAL` y `TICKET_BOLSA_METREADO` conservan el `id` del ticket que los originó; Movimientos los trata como referencias de ticket para buscar el folio, mostrar el nombre y abrir `/tickets/{id}`, sin convertir ni reescribir el tipo histórico. Las referencias `NOTA` y `TICKET` siguen resolviéndose hacia el detalle del documento.

**Bloque 3 — trazabilidad de movimientos:** quedaron cubiertos los consumos POS de bolsas normales, piezas normales y bolsas metreadas, además de las ventas diferidas desde una salida para cliente: cuando existe el documento se propagan su tipo estable y su ID. Una salida a mostrador creada como documento conserva `SALIDA` y su ID. La venta directa administrativa mediante `venderRollo` y las llamadas independientes de la primitiva `salidaMostrador` no tienen ticket de inventario originador; permanecen legítimamente sin documento en vez de inventar un enlace, y se identifican por su justificación/operación. Los movimientos históricos que ya eran documentless no se reparan ni se reescriben en este cambio; cualquier reparación futura requiere una decisión y evidencia del documento real.

2026-09-11: retirados el bloqueo de impresión por autorización y el sello impreso; unificadas las etiquetas de venta a cliente y agregada resolución de notas en Movimientos, sin cambios al enum ni a las reglas de reserva, cobro o entrega. Corregida también la apertura con impresión automática desde Salidas pendientes a cobro y la búsqueda por folio de cancelaciones heredadas de NOTA. Los contratos comprueban el componente real de generación, el enum de unidades y la función compartida de etiquetas, no cadenas duplicadas. Las comprobaciones de código no sustituyen la validación del ciclo real, las reservas y las cifras; estos puntos solo se aprueban tras ejecutarlos.

Qué toca números durante el ciclo:

- `EN_TRANSITO` reserva las series; no mueve inventario, dinero, Ventas ni tablero.
- `RECIBIDA` liga las salidas seleccionadas a un único documento; todavía no mueve inventario ni cuenta como venta.
- El cobro del Ticket o la autorización de la Nota cuenta la venta y consume cada rollo en su ubicación de origen mediante movimientos trazables.
- `ENTREGADA` solo cierra el ciclo y apaga la alerta; no mueve dinero ni inventario.
- La cancelación nunca borra: cancela el documento agrupado y sus salidas de forma atómica y, si ya hubo consumo, usa movimientos inversos. Si cualquier salida ya fue entregada, exige un flujo físico de devolución en vez de restaurar inventario automáticamente.

La alerta de venta autorizada no entregada reutiliza `SALIDA_EN_TRANSITO_ALERT_THRESHOLD_HOURS`, el umbral existente de **24 horas**; no existe un segundo umbral para esta modalidad.

El módulo propio `salidas_venta` está negado por omisión y hoy se habilita mediante permiso de ubicación únicamente para Terminal en Mariana. No hay una condición de Mariana en las rutas ni en la interfaz: abrirlo en otro sitio es cambiar ese permiso, no desarrollar otra variante. `salidas_venta` ocupó el módulo 31; con Equipos, el catálogo configurable vigente contiene **32 módulos**.

Regla de trazabilidad de este flujo:

- Dentro del alcance operativo autorizado, del error `ROLLO BLOQUEADO` se abre la salida que reservó la serie.
- De la salida se abre el Ticket o la Nota que generó, y del documento se regresa a cada salida que lo compone.
- De la alerta de no entregado se abren tanto la venta como sus salidas.
- Del cliente se abren sus salidas pendientes.
- Dentro del alcance autorizado, todo error operativo nombra la causa, el cliente o documento relacionado cuando aplica y ofrece un enlace a la raíz; fuera de alcance, un rollo es indistinguible de uno inexistente y no revela serie, estado, reserva, salida ni cliente.

**Cambio del 8 de septiembre de 2026:** se agregó el flujo completo de salidas para venta a cliente, reserva global por serie, agrupación multi-origen en POS, consumo diferido en caja, autorización derivada, entrega escaneada, reversos, alertas y trazabilidad.

## Registro de Equipos por sitio

**Equipos es un directorio operativo, no un inventario general de activos.** Admite exclusivamente siete tipos: Computadora POS, Impresora de entradas, Impresora de salidas/notas, Impresora de etiquetas, Impresora térmica de tickets, Pistola Escáner y Smartphone Escáner. Equipos, Camionetas y Choferes viven juntos bajo DIRECTORIO.

La pantalla usa únicamente el selector global de sitio del encabezado. Vista Global representa los sitios físicos activos (tiendas y bodegas), incluso los que todavía no tienen equipos; elegir un sitio filtra la misma pantalla. No existe ni debe agregarse un segundo filtro local. El catálogo de origen es el compartido de ubicaciones, pero Equipos filtra su propia consulta: En tránsito y Externo siguen existiendo para Inventario y no son destinos de equipos. En global, el conteo de activos de cada sitio abre un detalle que contiene exclusivamente equipos activos.

Cada registro guarda sitio, tipo cerrado, identificador, marca, modelo, serie opcional y notas. No existe endpoint de eliminación. `activo` nunca se captura ni se persiste: se deriva como verdadero solo cuando todas las casillas canónicas del tipo están marcadas. Cada palomeo y despalomeo toma actor y fecha efectiva del servidor, se audita en ambos sentidos y rechaza campos de atribución enviados por el cliente.

Las casillas se definen únicamente en el catálogo canónico de Equipos; la interfaz consume esas definiciones, sin copiarlas. La impresora de entradas exige instalación/prueba con entrada real, papel Carta en el navegador, márgenes Ninguno y escala Tamaño real. La impresora de salidas/notas exige pruebas con salida y nota, papel A5, márgenes Ninguno, escala Tamaño real y, para salidas, papel de color del sitio en la bandeja correcta.

El módulo `equipos` es el **32**. Leer exige `equipos/ver`, crear exige `equipos/crear` y editar datos o checklist exige `equipos/editar`. Su catálogo mínimo de sitios está protegido por `equipos/ver` y no depende de permisos de Inventario o Ubicaciones. Para cualquier usuario no ADMIN con alcance PROPIA —incluido SUPERVISOR— pedir explícitamente otro sitio devuelve 403; el recurso fuera de alcance no se revela.

**Verificación del 9 de septiembre de 2026:** una base Neon vacía y desechable aprobó schema push, comprobación estructural, seed, todos los inicializadores y la integración real de Equipos. La integración ejercitó tres sitios, permisos separados, PROPIA, rechazo cross-site, catálogo independiente, checklist, atribución del servidor, activo derivado y despalomeado. Development terminó con ambas tablas, dos constraints de catálogo validados, seis permisos por rol y cero equipos/checklists de prueba. Typecheck y contratos quedaron limpios. Las capturas sin sesión confirmaron el guard de acceso en escritorio y móvil; la revisión responsive de los componentes realmente montados aprobó breakpoints y desbordamientos, sin crear una cuenta o datos de prueba en development.

**DDL canónico sin parámetros:** interpolar un valor con `` sql`${value}` `` dentro de un `CHECK` de Drizzle genera `$1`, pero `drizzle-kit push` ejecuta el DDL sin enlazar parámetros. Las listas del catálogo usadas en DDL se convierten a literales SQL escapados y una regresión exige que ambos `CHECK` compilen con cero parámetros.

### Aplicación de inicializadores en development — 8 de septiembre de 2026

Antes de modificar development se creó un respaldo privado de código y base, se restauró en una base desechable y se verificaron tablas, conteos, columnas, restricciones e índices. Con esa recuperación comprobada, se ejecutaron los inicializadores sobre development.

El primer intento de `ensureSalidasSchema` sobre development abortó al reemplazar `estado_salida`: el índice parcial `salidas_borrador_usuario_origen_uidx` conservaba una constante tipada al enum anterior. La transacción propia del inicializador hizo rollback y no dejó cambios parciales. Se corrigió el orden para retirar ese índice antes del cambio de tipo y recrearlo después; la corrección se probó primero sobre una réplica desechable de development y luego se aplicó correctamente.

El catálogo real de development confirmó:

- La columna nullable `movimientos.salida_id integer`, sin default ni backfill.
- La llave foránea `movimientos_salida_id_salidas_id_fk`, de `movimientos.salida_id` a `salidas.id`.
- El índice `movimientos_salida_idx` sobre `movimientos(salida_id)`.
- El valor `ENTREGADA` en `estado_salida`, cuyo orden quedó `ARMANDO`, `EN_TRANSITO`, `RECIBIDA`, `ENTREGADA`, `CANCELADA`.

**Registro histórico del 8 de septiembre de 2026:** como cierre de la comprobación pendiente desde la purga se consultaron todos los triggers no internos: salieron exactamente **11 renglones** y los once quedaron con `tgenabled = 'O'`. Quedaron activas las garantías de inmutabilidad y validación de `aplicaciones_credito`, `aplicaciones_pago_proveedor`, `auditoria`, `movimientos_credito`, `pagos_proveedor`, `reimpresiones_etiqueta` y `ticket_pagos`. Ese conteo no es el inventario actual.

**Inventario histórico de Prompt H:** aquella captura documentó **14 triggers no internos vivos**, sin modificarlos. No es el conteo actual; la conservación y el inventario posteriores al DDL autorizado están en «E1 — origen y evidencia de crédito».

**Identidad efectiva confirmada en la captura preflight:** `current_database()` confirmó `heliumdb` y `current_schema()` confirmó `public` desde el pool existente en proceso. La evidencia de solo lectura es `reports/prompt-h/api-pool-identity-2026-09-15.md`; en esa captura no se abrió endpoint público ni se reinició la API, no se cambió autenticación/entorno y el inspector de loopback quedó cerrado. La captura config-only anterior de Bloque 1 queda como evidencia histórica, no como bloqueo vigente de identidad.

## Corrección — Bloque 4: Tabulares

**Tabulares:** casilla opcional al cobrar, sin marcar por omisión. Genera **una tira por color** en 80 mm, con los metrajes de los rollos de ese color, su total y el folio del ticket. Son adicionales al ticket, nunca lo sustituyen, y no tocan el registro de la venta.

- Se excluye **METREADO** porque no tiene un rollo fuente identificado del cual obtener una etiqueta física.
- Se imprime incluso cuando hay un solo color porque el usuario lo solicitó expresamente al activar la opción.
- Las tiras muestran metrajes con **2 decimales** porque son documento de venta; únicamente las etiquetas físicas de rollo conservan 3 decimales.

Sistema interno de inventarios, ventas y salidas entre ubicaciones para las tiendas y
bodegas de Mariana Textil. No es un sistema contable ni fiscal.

## Ticket y etiquetas

**Corrección — Bloque 1 (continuidad del ticket térmico):** cada copia CLIENTE, CAJA y ADMINISTRACIÓN constituye una sola página lógica cuya altura física se calcula después de cargar fuentes, imágenes y completar el layout. Nunca se usa una altura fija para estas tiras. Los bloques de producto y TOTAL GENERAL son indivisibles; los cortes ocurren únicamente entre copias, luego se imprimen los tabulares una sola vez y el corte final queda después del último tabular.

**Corrección — Bloque 2 (resumen del ticket térmico):** al terminar los productos, las tres copias muestran el mismo recuadro indivisible con exactamente **Total de rollos** y **Total a pagar**. Total de rollos cuenta cada renglón persistido de tipo NORMAL una vez, sin importar si su unidad es metro, kilo, bolsa o pieza; no incluye venta METREADA, no desglosa por producto y no suma cantidades de unidades incompatibles.

**Ticket:** sin QR, logo de **2.5 cm** centrado arriba. Cada producto va en **bloque vertical** —nombre, modalidad de venta destacada, y renglones Rollos, Metros, Precio e Importe con rótulo a la izquierda y valor a la derecha—. **La venta metreada no lleva renglón de Rollos**: no hay rollos identificados. La abreviatura de cantidad depende de la unidad del producto y las cantidades **nunca se totalizan entre unidades distintas**.

El bloque se llama **TABULAR**; el nombre anterior era un error de captura.

**Cada venta imprime tres copias** —CLIENTE, CAJA y ADMINISTRACIÓN— con contenido idéntico y una leyenda que las distingue, en una sola operación y separadas por el corte automático. Los tabulares son adicionales y **no se triplican**.

**Ajuste de texto en etiquetas:** medir `scrollWidth` contra `clientWidth` en un contenedor flex **no detecta desbordamiento**, porque el flex no recorta a su hijo y ambos valores coinciden siempre. El recorte ocurre en el ancestro con `overflow-hidden`, y por eso el texto se corta de ambos lados al estar centrado. La medición compara el **ancho real del texto** contra el **ancho disponible**. Cualquier cambio a esta lógica se valida generando las etiquetas de todo el catálogo, no con dos ejemplos.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API en `/api`
- `pnpm --filter @workspace/mariana-textil run dev` — aplicación web
- `pnpm run typecheck` — verificación completa de TypeScript
- `pnpm --filter @workspace/api-spec run codegen` — regenera cliente y Zod desde OpenAPI
- `pnpm run db:verify` — muestra la identidad segura de la base canónica y valida el esquema mínimo
- `pnpm --filter @workspace/db run push` — aplica el esquema Drizzle en desarrollo
- `NODE_ENV=development pnpm --filter @workspace/db run seed` — precarga ubicaciones y el ADMIN inicial en desarrollo
- **ANTES DE PRODUCCIÓN:** define `ADMIN_SEED_PASSWORD` con una contraseña inicial segura y cámbiala inmediatamente después del primer acceso. Es obligatoria fuera de desarrollo.
- La aplicación normal —API, Drizzle, migraciones y seed— usa el `DATABASE_URL` administrado por Replit. Las pruebas aisladas expresamente autorizadas usan `TEST_DATABASE_URL`; deben comprobar antes de cualquier escritura que existe, que es distinta de `DATABASE_URL` y que `current_database()` corresponde al destino desechable esperado. Ninguna prueba sustituye la conexión normal de la aplicación ni usa development como base de fixtures.
- El proyecto externo visible en el MCP de Neon no es la base de la aplicación. Solo puede usarse para ramas/base desechables de pruebas; nunca como conexión de la app ni para datos reales.

### Estado servido de Tanda E — 23 de septiembre de 2026

- Los TOML de los dos artefactos apuntan al candidato final `dist-tanda-e-20260923`. API y UI se reiniciaron una vez cada una con esos comandos válidos. La API observada fue PID 21218, con inicializadores, backfill y monitor pausados por `API_INSPECTION_BOOT=1`; `/api/healthz` respondió HTTP 200. La captura confirmó la pantalla de login; el mensaje seguro para HTTP 500 se verificó en fuente y bundle, no provocando un fallo en la aplicación.
- Los artefactos servidos son `artifacts/api-server/dist-tanda-e-20260923/index.mjs` (SHA-256 `1d22663f0cda69c2907d4171f902f51532cf45c013a8ccbd042a83c421bac80d`) y `artifacts/mariana-textil/dist-tanda-e-20260923/index.html` (SHA-256 `5e90c451021013e5e1da297168a3213d044d1163d2e68c23b2ed40d8968d8b27`). Typecheck y build de ambos artefactos terminaron en cero; el inventario completo está en `reports/tanda-e-20260923/build/build-bundles.sha256`.
- En la base efectiva `heliumdb` se aplicaron con autorización y `COMMIT` únicamente las correcciones estrechas de aliases E11/E5; E5 monetario permanece OFF. La fuente servida incluye además el mensaje de login 500, la expansión escalar POS y la lectura de saldo operacional E4, sin ampliar roles ni puertas.
- La E2E de Tarea 1 fue **PARCIAL**, no un PASS general: acreditó E4 sin motivo, insuficiencia y desbloqueo ADMIN, las negativas bajo costo, la autorización de precio de remate y el cierre real `500 - 525 = -25`, contado `0`, diferencia `25`; no completó cobros efectivo/transferencia, Nota/abono E3, recibo/reimpresión, venta real de remate ni la salida CAJA con saldo suficiente. La procedencia inicial del fixture se corrigió, pero la regla válida de una sesión por sitio/día y después un tester sin entregar evidencia durante más de 30 minutos impidieron terminar. La lectura final encontró un Ticket de 150.00 creado en el segundo sitio, sin cobrar: no es PASS del cobro. El teardown confirmó la destrucción de copia, dump, credenciales, servidores y árbol privado; se conservaron capturas y estado final redactado, sin tocar respaldos preexistentes.
- Este estado no abre Fondo/E10, E12, E5 monetario, retiro dirigido/retenido, atribución histórica E1 ni purga. El informe consolidado, commits y límites están en `reports/tanda-e-20260923/INFORME.md`.

### Liberación simple temporal — vigente desde el 23 de septiembre de 2026

Fuente inicial y autorización escrita del propietario: `reports/autorizacion-procedimiento-simple-y-liberacion-e3-tanda-b-20260923.txt`. Esta regla rige **solo mientras nadie opere el sistema y todos sus datos sean de prueba**. Antes de cualquier escritura en la base de la API sigue siendo obligatoria una autorización escrita del propietario. Esa fuente autorizó aplicar E3 y los cinco SQL de Tanda B, ya instalados y no repetibles. La autorización posterior `reports/tanda-d-20260923/autorizacion.txt` abrió remate, precio mínimo, borrado individual de producto sin movimientos y E11 limitado; `reports/e4-liberacion-20260923/autorizacion.txt` abrió E4 separado de E12; `reports/liberacion-e9-e7-e11-20260923/autorization.txt` abrió lectores financieros E7 y el selector ADMIN de perfiles E11. La autorización vigente `reports/e9-e5-e7-continuacion-20260923/autorizacion.txt` abre E9 documental sin ingreso al Fondo y permite terminar E5 y la atribución E7, pero mantiene cerrados retiro dirigido y retenido. El 22P02 de E9 quedó corregido y ensayado con productor PostgreSQL real; el SQL mínimo fue COMMIT en la base efectiva sin filas E9/Fondo y E9 API/UI quedó ON, con ingreso Fondo OFF. La atribución financiera E7 de solo lectura quedó ON; no es atribución histórica E1 ni habilita operaciones E5. La integración E5 completó recepción, propuesta, aplicación y devolución en PostgreSQL desechable con todas sus guardas específicas; producción continúa OFF por el cierre expreso de retiro dirigido/retenido, no por un defecto técnico. Fondo/E10, E12, purga general, E5 monetario, retiro dirigido/retenido y atribución histórica E1 continúan cerrados; toda puerta no abierta expresamente permanece apagada.

Cada SQL se prueba primero en una base PostgreSQL desechable y esa base se destruye al terminar. Mientras esté vigente esta regla quedan **suspendidos, no eliminados**, los manifiestos y hashes cruzados de paquete, wrapper e inventarios; B0/B1 y el preflight de catálogo; el respaldo con restauración de ensayo; y la ventana formal de liberación. Los requisitos y resultados anteriores sobre esos controles se conservan como antecedentes históricos, no como puertas vigentes de esta liberación. Si falla cualquier paso —incluido un fallo a mitad del SQL de Tanda B— se detiene, se documenta y se reporta el estado exacto: no se repara ni se recorta SQL por cuenta propia. La recuperación es volver al bundle anterior conservado; **no** hacer rollback de DDL.

Esta regla termina cuando el propietario decida comenzar a operar con datos reales. Entonces se purgan los datos de prueba y se restablece íntegramente el procedimiento completo. Esta autorización **no autoriza esa purga ahora**.

## Stack

- pnpm workspaces, Node.js, TypeScript
- React + Vite + Tailwind CSS
- Express 5
- PostgreSQL + Drizzle ORM
- Contrato OpenAPI con cliente React Query y validadores Zod generados
- Sesiones propias mediante cookies httpOnly
- Zona horaria funcional: `America/Mexico_City`

## Where things live

- `lib/api-spec/openapi.yaml` — contrato de la API
- `lib/db/src/schema/` — esquema Drizzle (incluye permisos, clientes e historial inmutable de precios)
- `lib/db/src/seed.mjs` — datos iniciales con matriz de permisos por rol
- `artifacts/api-server/src/routes/` — endpoints
- `artifacts/api-server/src/middlewares/auth.ts` — sesión e inactividad
- `artifacts/api-server/src/lib/permisos.ts` — servicio central de permisos (resolvePermiso, requierePermiso, buildPermissionMatrix)
- `artifacts/api-server/src/routes/permisos.ts` — API de administración de permisos
- `artifacts/api-server/src/routes/clientes.ts` — catálogo operativo de clientes
- `docs/endpoint-permissions.md` — matriz completa de endpoints con módulo/acción
- `artifacts/mariana-textil/src/` — interfaz web (permisos.ts como caché del servidor)

## Architecture decisions

- **Casing de texto capturado:** los campos de texto humano (por ejemplo nombres, países, telas, colores, marcas y modelos) conservan exactamente mayúsculas/minúsculas y acentos capturados por la persona; al persistir solo se recortan los extremos. Nunca se aplica `toUpperCase()` por tecla ni Title Case irreversible. La normalización sigue siendo obligatoria para identificadores (SKU, placas, iniciales de sitio, RFC/IDs fiscales, folios), enums/estados/unidades, color hexadecimal y claves canónicas usadas únicamente para comparar o validar unicidad sin distinguir mayúsculas.
- El kardex es la fuente de verdad del inventario: toda alteración inserta movimientos con cantidades firmadas.
- El QR de la etiqueta contiene `SKU-SERIE`. La serie son los últimos 7 u 8 dígitos válidos; el intérprete prefiere 8 cuando ambas longitudes son posibles. Las tres rutas que consumen rollos —Salida normal, POS y Salida para venta— pasan por una sola función compartida, `normalizarSerieEscaneada`, apoyada en `interpretarCodigoEscaneado`. La serie manda; el SKU solo verifica y genera advertencia si no coincide. Duplicar esta normalización en cada pantalla hizo que Salida para venta enviara el payload compuesto sin extraer la serie y fue la causa del fallo.
- Una Salida conserva cinco estados reales: `ARMANDO`, `EN_TRANSITO`, `RECIBIDA`, `ENTREGADA` y `CANCELADA`. La etiqueta visible de venta a cliente se deriva de ese estado y del documento ligado mediante una sola función compartida; los traslados normales conservan sus etiquetas. Escritorio y teléfono usan la misma consulta con refresco. Nunca se deduce el estado de movimientos de inventario.
- Las tablas operativas no usan DELETE; las correcciones son movimientos inversos que referencian el original.
- Toda operación que modifica datos registra usuario, entidad y valores antes/después en `auditoria`.
- Cantidades usan `DECIMAL(10,3)` y dinero `DECIMAL(12,2)`; nunca float.
- Toda operación de inventario usa una transacción SQL con bloqueo de fila.
- Las operaciones reciben un UUID del cliente para garantizar idempotencia.
- El filtrado por ubicación siempre se aplica en el servidor, no solo en la interfaz.
- **Permisos:** ADMIN tiene acceso total a los 32 módulos sin consultar tablas. Para TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS y CONTADOR la resolución es: override de usuario (non-null) > permiso de rol personalizado > permiso heredado del sitio > permiso de rol heredado > denegar. La base de CAJA es estricta: únicamente `cobros_pagos` (`ver` y `crear`) y en la interfaz solo Caja > Cobros; dentro de esa pantalla CAJA únicamente ejecuta Cobrar. Toda escritura de gestión de caja (abrir/cerrar sesión y salidas) requiere conjuntamente `cortes.ver` y `cortes.crear`; las consultas de corte permanecen disponibles con solo `cortes.ver`.
- **BODEGA y Contenedores — decisión del propietario (2026-09-23):** BODEGA no recibe acceso predeterminado al módulo `contenedores` y, por tanto, no ve contenedores con costo pendiente. La revocación de defaults sin personalización que aplica `ensurePendingCostsSchema` es la regla vigente; el seed debe coincidir y no volver a conceder `contenedores.ver`. Como en los demás defaults, una fila marcada con `updated_por` conserva una personalización administrativa explícita.
- **Matriz y alcance son responsabilidades separadas:** la matriz decide **qué acción** puede realizar el usuario; el alcance decide **dónde** puede ejecutarla. No debe existir una tercera capa de constantes o listas por rol que vete permisos concedidos por ADMIN. Las restricciones de acciones por rol se configuran en la matriz, no como techos inmutables en código. Los permisos iniciales son valores configurables, no límites permanentes. Las comprobaciones heredadas por rol en endpoints e interfaz se documentan en un inventario para revisión del dueño; no se eliminan ni se consideran autorizadas por esta regla automáticamente. Se conservan las validaciones de integridad de datos, estado del documento y alcance territorial.
- **Conteo de módulos:** el catálogo configurable contiene 32 módulos y debe mantenerse alineado con la lista canónica del servidor y el seed de permisos.
- **Separación financiera:** clientes y proveedores tienen módulos separados para operativo vs. financiero. Los campos financieros no se envían al cliente cuando falta el permiso.
- **Alcance de Salidas:** SUPERVISOR no tiene una excepción operativa entre sitios: las acciones deben validar su sitio asignado además del permiso. El listado de pendientes de venta debe filtrar por origen para alcance PROPIA y para CAJA, incluso si CAJA conserva un alcance TODAS histórico; sin asignación, denegar. Las consultas globales autorizadas se conservan.
- **Invariantes ADMIN:** ADMIN no participa en la matriz ni acepta overrides; siempre tiene acceso total. Un usuario no puede modificar sus propios permisos.
- **Precios — decisión documental del propietario (2026-09-21):** cambiar precios corresponde solo a ADMIN mediante la configuración de un permiso de la matriz, no mediante una restricción fija por rol en código. No se redefine aquí el permiso de consulta ni se acredita un cambio de implementación o de permisos efectivos. El costo actual es ponderado por cantidad disponible y unidad; sin costos válidos permanece pendiente (`null`), nunca cero. Un producto sin costo registrado puede tener precio de lista; el piso aplica cuando tenga costo y la venta conserva el bloqueo por costo del rollo.
- **Historial comercial:** todo cambio de precio bloquea el producto, captura costo/margen del momento y escribe historial más auditoría en la misma transacción. Nunca recalcula tickets existentes.
- **Alta de producto sin precio:** un producto se puede registrar con tela, color y unidad aunque todavía no tenga precio sugerido; el precio se captura después desde el módulo de Precios.
- **Bloqueo POS sin precio:** un producto sin precio sugerido no se puede agregar al carrito. POS indica que debe capturarse en el módulo de Precios y no ofrece captura de precio dentro de la venta.
- **Recepción sin precio:** para recibir mercancía solo se requiere producto y unidad; la ausencia de precio sugerido no bloquea la recepción.
- **Unidad PIEZA:** se muestra como **Pzas.**, solo admite cantidades enteras positivas, nunca habilita venta fraccionada/METREADO y conserva `se_vende_por_metro=false`. Sus totales se presentan separados de metros, kilos y bolsas.
- **Catálogo Popelina:** `Popelina` es el nombre canónico; los productos antes capturados como `Popelina China` conservan ID, SKU, inventario e historial y no deben volver a separarse bajo ese nombre.
- **Borrar un producto:** se hace desde su pantalla de edición, solo ADMIN, y exige **existencia en cero en todos los sitios** y **cero movimientos históricos**, las dos a la vez. Existencia en cero y nunca haberse movido no son lo mismo: un producto vendido por completo queda en cero pero vive en tickets firmados, en el kardex y en reportes del periodo, y borrarlo dejaría documentos apuntando a un producto inexistente.
- **Solo se borra lo que nunca existió operativamente** —típicamente renglones cargados por error en una importación—. Todo lo demás se **desactiva**.
- Cuando no procede, el botón se muestra **deshabilitado con la razón**, no escondido: escondido hace creer que la función no existe; deshabilitado enseña la regla. El mensaje dice cuál condición falló y, si es por existencia, en qué sitios.
- **El SKU borrado no se reusa** y el borrado queda en auditoría. La auditoría permanente de la purga reserva ese SKU para altas, importaciones y cambios posteriores.
- **Borrar un producto se confirma con credenciales de ADMIN**, no con texto exacto. La contraseña **confirma quién está en el teclado**; no autoriza saltarse la regla de borrado, que sigue exigiendo existencia en cero y cero movimientos históricos. La sesión ejecutora debe seguir siendo ADMIN y la auditoría identifica por separado al ejecutor de la sesión y al ADMIN confirmador, sin guardar la contraseña.
- **Los intentos fallidos en un diálogo de confirmación no alimentan el bloqueo de acceso.** Cinco errores tecleando en un diálogo no pueden cerrarle la sesión al ADMIN ni dejarlo fuera del sistema 15 minutos; el bloqueo por intentos fallidos existe para el inicio de sesión, no para confirmar acciones. Por eso la purga usa la misma comprobación directa `crypt` de ADMIN activo que las autorizaciones de tickets, etiquetas y salidas: no llama a `/auth/login`, no inserta `LOGIN_FALLIDO`, no crea ni termina sesiones y no agrega un bloqueo propio.
- **Revisión de diálogos con credenciales:** cancelación de ticket, cancelación de salida, reimpresión de etiquetas y declaración de saldo incobrable piden credenciales ADMIN y las verifican directamente contra un ADMIN activo; ninguno alimenta `LOGIN_FALLIDO` ni el contador de acceso. Ticket, salida e incobrable usan `PasswordInput`; la pantalla existente de etiquetas todavía usa un `Input type="password"` sin control de visibilidad y queda reportada, no modificada por este cambio de Productos. El diálogo de login sí alimenta el contador porque es el acceso a sesión. Los formularios de alta/edición de usuarios capturan una contraseña nueva, no verifican credenciales ni participan en el contador.
- **Advertencia irreversible de producto:** la duplicación era local. `ConfirmacionTextoExacto` agrega una sola vez la advertencia compartida y la antigua llamada de producto volvía a incluirla en su descripción. El nuevo diálogo de credenciales no usa ese componente y muestra la frase una sola vez; los demás consumidores no fueron alterados.
- **Confirmación de borrado — decisión del propietario (2026-09-18):** se piden usuario y contraseña de un ADMIN, como está hoy. Sustituye la recomendación pendiente de decidir entre esas credenciales y solo la contraseña del ADMIN en sesión; esa alternativa ya no queda pendiente. Se conserva la sesión ejecutora ADMIN y la identificación separada del ADMIN confirmador en auditoría.
- **Contrato móvil del borrado:** el diálogo limita su ancho al viewport, permite partir tela/color/SKU largos y apila botones y campos en teléfono. La apertura está condicionada al preflight exitoso; el servidor vuelve a contar bajo candados antes de comprobar credenciales y borrar, de modo que ni una llamada directa con credenciales válidas omite las reglas.
- **Historial de precios sin movimientos — excepción individual vigente ON por Tanda D (2026-09-23):** si el producto nunca tuvo movimientos, se borra junto con sus renglones de `precio_historial`; si tuvo cualquier movimiento, no se borra. Se conserva la bitácora `CAMBIAR_PRECIO`, existencia cero en todos los sitios, credenciales ADMIN, auditoría y no reutilización del SKU. Solo producto e historial: **no autoriza purga general**. El gate API/UI está ON en fuente; la cobertura de esta excepción con colaboradores de memoria no acredita atomicidad/concurrencia PostgreSQL completas ni que el candidato ya esté servido. Decisión original en `reports/prompt-u-respuestas-2026-09-18.md`; autorización y límites actuales en `reports/tanda-d-20260923/tarea1.md`.
- **Costo y precio de venta metreada:** El costo de la venta metreada es el **promedio simple del costo por metro de cada rollo recibido en los últimos 12 meses corridos**. Cada rollo cuenta una vez, sin ponderar por cantidad. Promedio simple, nunca ponderado: es una regla del negocio y no debe "corregirse". Sin compras en 12 meses, cae al último costo conocido y se marca la advertencia. El costo se congela en la línea del ticket al momento de la venta. Cada producto tiene el interruptor `se_vende_por_metro`, que el POS hace cumplir en el servidor; los productos en kilos nunca lo tienen encendido. Mayoreo es 10 metros o más, contado por línea —producto y color—, nunca por ticket.
- **Definición de existencia:** Existencia de un producto en un sitio = lo que se puede tocar y vender ahí hoy. Solo rollos en estado `DISPONIBLE` en esa ubicación. Nada más se suma a ese número: ni `MOSTRADOR`, ni `EN_TRANSITO`, ni rollos que vienen en contenedor.
- **Totales en Vista Global:** el renglón de totales presenta un total **por unidad** —Mts., Kg., Bolsas, Pzas.— y nunca un solo número al pie de la columna de cantidad. El total de rollos sí es único. Los totales reflejan el filtro activo, se leen de `existencias` y se calculan sobre los valores guardados.
- **Histórico financiero permanente:** un cliente o proveedor con cualquier movimiento en su estado de cuenta **no se puede purgar**. La vía es desactivarlo, lo que impide operar con él pero conserva su historia consultable. La regla de que las tablas operativas no usan DELETE aplica también a la purga de catálogos, que era la puerta de atrás.
- **Modalidad en reportes:** Los reportes separan siempre ROLLOS de METRAJE. Un margen agregado que revuelva las dos modalidades sin distinguirlas no es aceptable. La venta por rollo se costea con el costo exacto del rollo; la metreada, con el promedio simple de 12 meses congelado al emitir el ticket. Si cualquier línea de un grupo carece de costo congelado, el costo, la utilidad y el margen del grupo quedan pendientes, nunca en cero.
- **Proveniencia histórica de costo metreado:** Desde la Parte 4 Bloque 2, las líneas metreadas nuevas congelan también si usaron promedio simple de 12 meses, último costo conocido vencido o ausencia total de costo. Las líneas emitidas antes de existir ese campo conservan proveniencia desconocida (`null`): no se infiere ni se rellena desde compras posteriores, aunque ya tengan importes de costo congelados.
- **Conceptos por ticket y modalidad:** un ticket mixto cuenta una vez en cada componente de modalidad que contiene, por lo que esos conteos no son aditivos. Pagos y cancelaciones se atribuyen a ROLLOS/METRAJE en proporción al subtotal sin IVA de las líneas de cada modalidad; así se muestran componentes explícitos sin duplicar el importe del ticket.
- **Rotación y compras por modalidad:** la existencia y las recepciones no tienen modalidad; toda compra se recibe por rollo. Rotación expone la salida ROLLOS y la salida METRAJE por separado y calcula coberturas independientes, sin sumarlas ni inventar una equivalencia. El insumo de coste metreado por producto reutiliza el promedio simple exacto de 12 meses de `entradas.fecha`: ignora costos nulos, usa el último conocido solo si no hay recepción válida en el periodo y permanece pendiente si no existe costo.

## Parte 1, Bloque 1 — Unificación de existencia

- `existencias.cantidad_total` conserva exactamente la suma firmada del kardex; `rollos_count` cuenta solo rollos `DISPONIBLE`.
- Se agregó `reconstruirCacheExistencias`, que recompone en una sola transacción todos los pares de la unión de `existencias`, `movimientos` y `rollos`.
- Inventario agrupado, conciliación, reportes y Vista Global usan solo `DISPONIBLE` para existencia física. Reportes presenta aparte cantidad y valor de rollos `EN_TRANSITO` ligados a contenedor; esos KPI nunca se agregan a existencia, rollos o valor disponible.
- Decisión conservadora: `contenedores.entrada_id` solo se asigna al recibir y `crearEntrada` crea rollos `DISPONIBLE`, por lo que no existe un vínculo de contenedor que pueda identificar inventario en tránsito. El KPI separado muestra todos los rollos `EN_TRANSITO` por su ubicación; los creadores de transferencias de dos fases están muertos y se eliminarán en el Bloque 3.

### Archivos revisados para existencia física (Bloque 1.4)

- Los cambios de esta lista pertenecen al Bloque 1.4 histórico; esta auditoría solo corrigió sus citas.
- Cambiados entonces: `artifacts/api-server/src/lib/inventario.ts` (`refreshCache`, `conciliarTodo`, `reconstruirCacheExistencias`, `getInventarioPorUbicacion`); `artifacts/api-server/src/routes/inventario.ts` (handler de `GET /inventario/existencias/agrupadas`); `artifacts/api-server/src/lib/reportes-inventory.ts` (`buildInventoryReport`).
- Sin cambio entonces: `artifacts/api-server/src/routes/dashboard.ts` (handler de `GET /dashboard`, consume `getInventarioPorUbicacion`); `artifacts/api-server/src/routes/precios.ts` (`currentCost`, delega en `weightedCurrentUnitCost`); `artifacts/api-server/src/lib/precios.ts` (`weightedCurrentUnitCost`, filtro `DISPONIBLE`).
- Listados, diagnósticos o historial: `artifacts/api-server/src/routes/inventario.ts` (`getRolloDetail`, handler de `GET /inventario/rollos` y handlers de entradas pendientes de costo); `artifacts/api-server/src/routes/etiquetas.ts` (handlers `router.get("/etiquetas/rollos", ...)`, `router.get("/etiquetas/rollos/:id", ...)` y `router.get("/etiquetas/historial", ...)`; son fragmentos del router, no sintaxis de parámetros OpenAPI); `artifacts/api-server/src/routes/productos.ts` (handler de `GET /productos/{id}`, compras por entrada); `artifacts/api-server/src/lib/compras-proveedor.ts` (`analiticaGlobalProveedores`, costos históricos).
- Sin cambio por ser puertas operativas: el flujo de captura de Salidas; validaciones de estado para venta en POS; transiciones y ajustes de Inventario.
- Sin cambio por pertenecer al dominio separado de contenedores: `artifacts/api-server/src/lib/contenedores.ts` (`getContenedorDetail`, `getContenedoresSummary`) y `artifacts/api-server/src/lib/contenedores-helpers.ts` (`canEditContenedor`).

## Parte 1, Bloque 2 — Catálogo de Productos

- `GET /productos` sigue devolviendo el arreglo completo del catálogo y acepta `ubicacionId` y `existencia` (`TODOS`, `CON_EXISTENCIA`, `AGOTADOS`).
- Sus totales, los sitios con existencia y el desglose del detalle se leen exclusivamente de `existencias`; los productos sin fila de cache permanecen visibles con cero.
- El alcance de lectura reutiliza `resolveReadScope` de Inventario. El detalle lista solo ubicaciones TIENDA/BODEGA activas permitidas y expone enlaces de rollos únicamente `DISPONIBLE`, sin derivar los totales de esos enlaces.
- Decisión conservadora: una ubicación inactiva o que no sea TIENDA/BODEGA no participa en el catálogo aunque tenga una fila histórica de cache.

## Parte 1, Bloque 3 — Auditoría de transferencias

- Se eliminaron exclusivamente las dos rutas tombstone históricas para mover y recibir rollos, que solo respondían `410`, junto con sus paths OpenAPI, schemas y hooks/tipos generados.
- No existen los nombres solicitados `iniciarTransferencia`, `confirmarTransferencia` ni `cancelarTransferencia`. La transferencia directa activa equivalente es `transferirRolloInmediato`; el ajuste activo equivalente es `ajustarRollo`, que admite rollos `EN_TRANSITO`.
- Se retienen las funciones de núcleo `moverRollo` y `recibirTransferencia`, porque el ciclo activo de Salidas las invoca. También se retienen las rutas e interfaz de Salidas, los enums del kardex y todo el ciclo de vida e interfaz de Contenedores.
- El único alcance retirado fue el HTTP tombstone y su contrato generado; no se modificaron las superficies de Contenedores.

## Bloque 3 — Regla de no solapamiento en Ticket de Venta

- Cada renglón del carrito POS debe conservar celdas explícitas y separadas
  para identidad (nombre/SKU/badges), precio unitario con su etiqueta,
  cantidad/unidad, importe y borrar. Los datos largos pueden partirse o
  truncarse dentro de su propia celda, pero nunca desplazar, cubrir ni invadir
  el importe, control de cantidad, badge o acción de otro renglón.
- La regla aplica a NORMAL y METREADO, incluida la expansión de series y los
  estados de validación/error. Se debe comprobar en navegador autenticado a
  1366×768 con varias líneas y los nombres/SKU más largos del catálogo.

## Parte 2, Bloque 2 — Salida a mostrador

- `salidaMostrador` cambia `DISPONIBLE → MOSTRADOR`, deja `cantidad_actual = 0` e inserta el movimiento histórico `SALIDA_MOSTRADOR` por la cantidad completa negativa dentro de la misma transacción.
- `MOSTRADOR` es terminal y `SALIDA_MOSTRADOR` no se puede revertir. La actualización repetible migra las filas del estado legado sin borrar rollos ni movimientos.
- El retiro a mostrador es total: el rollo deja de pertenecer al inventario controlado y no se conserva retazo, existencia abierta ni saldo parcial. La modalidad comercial vive en cada `ticket_linea`, por lo que un mismo ticket puede mezclar rollos `NORMAL` con producto `METREADO`; las líneas metreadas no se ligan a rollo ni existencia y conservan costo pendiente (`null`) hasta la Parte 3, nunca costo cero.

## Parte 1, Bloque 5 — Verificación integral de seis vistas

- Se añadió un arnés HTTP opt-in que confronta inventario agrupado, las dos entradas visuales de Dashboard/Vista Global, catálogo, los diez detalles de producto y reporte con una única matriz de diez productos etiquetados.
- El arnés cubre ADMIN/TODAS y BODEGA/PROPIA, intentos de forzar otra ubicación, filtros de disponibilidad, ceros de catálogo, unidades separadas y el KPI aislado de EN_TRANSITO.
- La prueba exige `NODE_ENV=test` y `TEST_DATABASE_URL`, rechaza la base de la aplicación por URL y por `current_database()`, reconstruye el caché dos veces y limpia únicamente sus IDs en `finally`.
- Resultado aislado: 1 prueba aprobada, 0 fallidas; 36 respuestas HTTP y diez productos coincidieron bajo ADMIN/TODAS y BODEGA/PROPIA. Matriz y resultados: `reports/inventory-truth-part1-validation-2026-08-26.md`.

## Parte 1.5, Bloque 1 — Campo de escaneo unificado

- `CampoEscaneo` conserva la captura por teclado/escáner físico (foco, Enter, limpieza y recuperación de foco) y ofrece cámara trasera para QR y códigos lineales. Usa `BarcodeDetector` cuando existe y `@zxing/browser` como respaldo JavaScript.
- Pantallas migradas: `salida-nueva.tsx`, `pos.tsx`, `ajustes.tsx`, `etiquetas.tsx` y el campo de captura de rollos de `entradas.tsx`.
- La cámara se detiene al detectar, cerrar o desmontar. El botón se oculta cuando el navegador no expone cámara o no enumera ningún dispositivo de video.
- **Despliegue:** el acceso a cámara del navegador requiere un contexto seguro. Si la aplicación se mueve fuera de Replit, se debe conservar HTTPS o el escaneo por cámara dejará de funcionar.
- Decisión conservadora: POS, Ajustes y Etiquetas conservan el texto después de Enter porque sus campos son búsquedas y ya dependían de ese valor para mostrar resultados; Salida Nueva y la captura de Entrada sí limpian cada lectura. En todos los casos cámara y teclado llaman al mismo callback de la pantalla.

## Parte 1.5, Bloque 2 — Estados de Salidas

- Estados vigentes: `ARMANDO`, `EN_TRANSITO`, `RECIBIDA`, `ENTREGADA`, `CANCELADA`.
- En traslado normal: `ARMANDO → EN_TRANSITO`, `ARMANDO → CANCELADA`, `EN_TRANSITO → CANCELADA` y `EN_TRANSITO → RECIBIDA`. Un usuario autorizado puede cancelar un traslado en `ARMANDO` o `EN_TRANSITO` conservando las comprobaciones de permiso, origen/destino y la restricción vigente de `CAJA`; la cancelación en tránsito devuelve atómicamente **todos los rollos al origen original** mediante movimientos compensatorios trazables y nunca borra el historial. Si el origen tiene pisos activos, el operador debe elegir explícitamente el piso de retorno en el diálogo; no existe un piso original autoritativo que pueda restaurarse automáticamente. Si no hay pisos activos, el campo se omite. `RECIBIDA` y `ENTREGADA` no se cancelan: cualquier corrección posterior usa el flujo de movimientos inversos correspondiente. En venta a cliente se aplican el ciclo, cancelación y comprobaciones de entrega descritos en «Salidas para venta a cliente».
- En `Salidas → Historial`, una fila elegible ofrece **Cancelar Salida** directamente tanto en escritorio como en teléfono, sin abrir primero el folio. La visibilidad conserva exactamente la regla del detalle (estado, permiso de autorización y sitio); el historial además oculta la acción a `CAJA`, conforme a la prohibición del servidor. `RECIBIDA` sigue siendo cancelable para `VENTA_CLIENTE` porque aún es pre-entrega, pero `RECIBIDA` de un traslado no lo es. Al pulsar se vuelve a consultar el detalle antes de mostrar la confirmación.
- La confirmación exige un motivo de al menos 10 caracteres recortados y eleva a ADMIN a quien no sea `ADMIN`. Si existe documento de venta, advierte que la operación es atómica: cancela el documento completo y todas sus salidas agrupadas, no solo la fila elegida.
- Conteo previo en development (consulta con encabezado y cero filas): `REGISTRADA=0`, `SOLICITADA=0`, `ACEPTADA=0`, `RECHAZADA=0`, `PREPARADA=0`, `ENVIADA=0`, `RECIBIDA=0`, `CERRADA=0`, `CANCELADA=0`.
- Mapeo aplicado sin borrar filas: `REGISTRADA|SOLICITADA|ACEPTADA|PREPARADA → ARMANDO`; `ENVIADA → EN_TRANSITO`; `RECIBIDA|CERRADA → RECIBIDA`; `RECHAZADA|CANCELADA → CANCELADA`.
- Crear una salida solo reserva sus rollos en el documento y no altera inventario. En traslado normal, enviar ejecuta origen → ubicación `TRANSITO` mediante `moverRollo`; la recepción conserva `recibirTransferencia`. En venta a cliente la mercancía permanece en el origen, aunque el estado almacenado sea `EN_TRANSITO`.
- Se conservaron `transportista` y `notaEnvio`. Las columnas históricas del esquema físico se mantienen para no destruir metadatos de instalaciones con filas migradas, pero se retiraron del contrato y del flujo activo.
- La recepción por QR y sus reglas de sitio se describen en el Bloque 3 siguiente.

## Parte 1.5, Bloque 3 — Recepción por QR

- La hoja foliada imprime un QR grande con una URL del origen relativo desplegado hacia `Salidas → Recepción`, incluyendo el folio. El login conserva esa ruta de retorno.
- Recepción es una pestaña interna de Salidas. Usa `CampoEscaneo` para teclado, pistola o cámara por el mismo callback y acepta tanto la URL del QR como un folio numérico.
- El servidor lista y permite recibir únicamente salidas `EN_TRANSITO` destinadas al sitio asignado. La única excepción es ADMIN con alcance `TODAS`; cualquier rol con sitio asignado puede ejecutar la recepción.
- Una confirmación aterriza todos los rollos mediante `recibirTransferencia`. Una segunda confirmación se rechaza por estado. La casilla “¿Llegó completo?” inicia marcada; si se desmarca, la nota sigue siendo opcional y se crea una notificación operativa persistente para ADMIN.
- Cada recepción registra en auditoría usuario, instante, IP, origen, destino, indicador de recepción completa y nota.
- Decisión conservadora: “incompleta” describe la condición reportada de la entrega, pero no deja rollos varados ni abre recepción rollo por rollo; todos aterrizan con la cantidad enviada y la incidencia queda en auditoría/notificación.

## Parte 1.5, Bloque 4 — Alertas y tránsito separado

- Alertas ADMIN incluye salidas `EN_TRANSITO` sin recibir que superan `SALIDA_EN_TRANSITO_ALERT_THRESHOLD_HOURS` (24 horas), declarada en `artifacts/api-server/src/lib/admin-alertas.ts` y usada por `isSalidaEnTransitoOverdue`. El límite es estricto, por lo que exactamente 24 horas aún no alerta.
- Reportes separa la visibilidad de rollos `EN_TRANSITO`: **En contenedor** excluye todo rollo ligado a una salida activa `EN_TRANSITO`; **En tránsito entre sitios** incluye exclusivamente esos rollos de `salida_rollos`. `EXISTS`/`NOT EXISTS` contra la salida activa es el criterio autoritativo y evita doble conteo.
- Ambos indicadores son solo visibilidad y no se agregan a existencia física, rollos disponibles ni valor disponible. Las exportaciones XLSX/PDF ahora incluyen los KPI del reporte, incluidos estos indicadores.

## Parte 1.5, Bloque 5 — Verificación

- Conteo previo a la migración de los nueve estados: `REGISTRADA=0`, `SOLICITADA=0`, `ACEPTADA=0`, `RECHAZADA=0`, `PREPARADA=0`, `ENVIADA=0`, `RECIBIDA=0`, `CERRADA=0`, `CANCELADA=0`. El mapeo documentado y aplicado sin borrar filas fue `REGISTRADA|SOLICITADA|ACEPTADA|PREPARADA → ARMANDO`; `ENVIADA → EN_TRANSITO`; `RECIBIDA|CERRADA → RECIBIDA`; `RECHAZADA|CANCELADA → CANCELADA`.
- La lista completa migrada a `CampoEscaneo` es: `salida-nueva`, `pos`, `ajustes`, `etiquetas`, captura de rollos de `entradas` y recepción de Salidas. La prueba estática de contrato cubre que teclado y cámara entregan por `deliver`/el mismo `onScan`, `BarcodeDetector` con respaldo ZXing, cámara trasera, QR y formatos lineales, mensaje de permiso, ocultamiento del botón sin cámara y liberación al cerrar, detectar o desmontar.
- Las verificaciones con datos usaron únicamente bases Neon aisladas de esquema y seed; nunca usuarios ni sesiones de development. Resultados: esquema Salidas **1/1**, servicio Salidas **5/5**, contrato API Salidas **4/4**, alertas ADMIN **1/1**, unidades de reportes **40/40**, integración de reportes **4/4**, seis vistas de inventario **1/1** (36 respuestas HTTP / 10 productos) y tránsito de reportes enfocado **5/5**. `pnpm run typecheck` completo aprobó. La revisión de arquitectura fue **PASS**, sin bloqueador de corrección ni seguridad.
- Correcciones verificadas en este bloque: una salida enviada con cada rollo transferido escribe **dos** movimientos de kardex (salida y entrada en tránsito); las fechas de vencimiento `Date` de reportes se serializan como `YYYY-MM-DD`.
- **Aceptación pendiente en dispositivo:** las rutas fuente/contrato y el ciclo de vida seguro para navegador están verificados automáticamente, pero este entorno no puede ejercer físicamente el permiso/detección de cámara de un teléfono ni diez lecturas consecutivas de una pistola real. Es una comprobación obligatoria en dispositivo, no un resultado aprobado.

## Corrección — Intérprete de códigos escaneados

- El intérprete compartido se conecta en el camino único de entrega de `CampoEscaneo`; teclado, pistola y cámara entregan la serie extraída por el mismo callback.
- Puntos de rollo conectados en cliente y servidor: POS (`/pos/buscar`), Salida Nueva (`POST /salidas/borrador/rollos`), Etiquetas (`/etiquetas/rollos`) y Ajustes mediante el listado de Inventario (`/inventario/rollos`; `/rollos` es solo el segmento interno del router).
- Cuando hay serie, las consultas de rollos son exactas; cuando no la hay, POS, Etiquetas e Inventario conservan la búsqueda parcial de texto.
- Decisión conservadora: la captura de Entradas recibe cantidades y la recepción de Salidas recibe URL/folio, no etiquetas de rollo. Ambos pasan por `CampoEscaneo` pero desactivan la sustitución por serie; sus endpoints reciben datos estructurados y no tienen un valor de etiqueta que interpretar.
- La discrepancia de SKU se muestra sin bloquear en POS, Salida Nueva, Etiquetas y Ajustes. La serie siempre identifica el rollo.

## Corrección — Orden y evidencia de candados del kardex

- **Orden de candados en bucles:** `lockInventoryPairs` ordena los pares que recibe en una llamada, pero no puede ordenar lo que no ve. Toda operación que recorra varias líneas o varios rollos —crear un ticket, enviar una salida, recibirla— toma **todos** sus pares en una sola llamada antes de entrar al bucle. En POS esto ocurre antes de reservar el folio e insertar la cabecera del ticket. Llamar al motor par por par dentro de un ciclo deja el orden en manos del capturista o de Postgres, y dos operaciones con los mismos productos en sentido inverso se traban con `40P01`. Las consultas de rollos que preceden a un bucle con candados llevan `ORDER BY` explícito.
- **Evidencia de correcciones de concurrencia:** una prueba basada en `Promise.all` demuestra que una carrera se reprodujo una vez, no que se reproduzca siempre; puede pasar por casualidad contra el código defectuoso. La regresión fuerte usa una barrera con tiempo límite en el punto crítico, y contra el código corregido **afirma que la segunda transacción nunca alcanza la barrera**, porque se queda esperando el candado. Una barrera que espera a las dos transacciones se cuelga para siempre. El tiempo límite se mantiene por debajo del `statement_timeout` del pool, porque la espera por un candado consultivo cuenta contra él. El resultado de ambas ejecuciones queda en `reports/`, no solo en la conversación.
- **Pares implícitos:** el conjunto que se bloquea antes de un bucle debe incluir los pares que la función interna del motor agrega por su cuenta, no solo los que se ven en la línea del documento. `moverRollo` necesita origen **y** tránsito; `recibirTransferencia` necesita tránsito **y** destino; `transferirRolloInmediato` necesita origen **y** destino. Bloquear solo el par visible deja el otro para que se tome dentro del ciclo, en orden de fila, y la traba `40P01` reaparece con otro disparador.
- La lista de bucles del motor de inventario y su estado de bloqueo vive en `docs/inventory-engine-lock-loops.md` y se verifica mediante una prueba de contrato. Todo bucle nuevo sobre el motor se agrega a esa lista con su justificación.

## Corrección — Salida en una sola acción

- Salida Nueva retoma el borrador `ARMANDO` del usuario para su origen. El primer escaneo crea cabecera, línea y asociación; cada escaneo posterior valida y guarda el rollo en la misma transacción.
- Quitar un rollo elimina inmediatamente su asociación y recalcula o elimina la línea vacía. Repetir el mismo escaneo es idempotente; un rollo reservado por otra salida activa sigue rechazándose.
- `Guardar y enviar` exige transportista y ejecuta todos los movimientos de origen a `TRANSITO` junto con el cambio a `EN_TRANSITO` en una sola transacción. Si cualquier rollo falla, no queda movimiento parcial y el borrador persiste; si concluye, abre directamente el detalle listo para imprimir.
- Los borradores con más de 24 horas sin actividad se ocultan del historial por defecto, pero no se borran y su propietario puede retomarlos.
- El detalle no ofrece una segunda acción de envío. La impresión usa un endpoint dedicado y solo se habilita para `EN_TRANSITO` o `RECIBIDA`; en `ARMANDO` el control permanece visible y deshabilitado con explicación, y el servidor rechaza también `ARMANDO` y `CANCELADA`.
- Pantallas revisadas para teléfono: detalle de salida, documento de entrada, detalle de ticket, detalle de cliente y detalle de rollo. Las barras de acciones envuelven/apilan y las tablas extensas conservan desplazamiento horizontal.
- Limpieza operativa en development (26 de agosto de 2026): folio `00501` cancelado con sus 12 rollos `DISPONIBLE` en origen, 0 movimientos `SALIDA` y existencia `2500.000` conservada. El folio `00502`, generado durante la verificación UI, también se canceló con su rollo disponible y 0 movimientos. La consulta final confirmó 0 documentos `ARMANDO`.

## Corrección — Logo monocromático de impresión

- El logo monocromático de la etiqueta es un archivo de escala de grises derivado del logo original. Nunca debe redibujarse ni regenerarse. El texto "MARIANA TEXTIL" se dibuja aparte, como texto, no como parte de la imagen.

## Corrección — Iniciales por sitio

- Cada sitio tiene `iniciales` obligatorias y únicas de 2 o 3 letras mayúsculas, asignadas manualmente por ADMIN; nunca se derivan del nombre.
- Valores iniciales operativos: Mariana `MA`, Cruces `CR`, Coco `CO`, Tomás `TO`, Don Nacho `DN`, Lucas Alamán `LA` y Bodega Cruces `BC`.
- Decisión conservadora para cumplir el esquema obligatorio: las ubicaciones técnicas En tránsito y Externo usan `TR` y `EX`. No emiten documentos y no aparecen en Configuración → Sitios.
- Las instalaciones que ya contengan sitios personalizados sin iniciales reciben durante la actualización un código provisional alfabético disponible. ADMIN debe revisarlo y asignar el código comercial correcto desde Configuración → Sitios; no se infiere del nombre.

## Corrección — Folios e impresión por sitio

- El folio de entradas y salidas es por sitio, no global. La identidad de un documento es ubicación + folio, y se presenta como `INICIALES-FOLIO` con 6 dígitos y sin comas. Cada sitio tiene un campo `iniciales` único que asigna ADMIN a mano.
- Entradas: carta vertical 216 × 279 mm. Salidas: A5 horizontal 210 × 148 mm. Etiquetas: 100 × 70 mm. El diseño y la regla `@page` deben declarar siempre la misma medida. El tamaño de la Salida está fijado en la sección Formatos de impresión; media carta se descartó por bandeja.
- **Reimpresión múltiple desde Inventario:** Detalle de Rollos reutiliza las casillas y los helpers de selección de Etiquetas. Seleccionar todos opera solo sobre los resultados visibles, nunca sobre el total del catálogo, con máximo 50 etiquetas por tanda y aviso si los visibles superan ese límite. Los cambios de filtros limpian la selección. Individual y múltiple comparten motivo obligatorio de al menos 10 caracteres, autorización y el mismo formato de 100 × 70 mm. Antes de imprimir se consultan los contadores actuales y se exige confirmación explícita de cada serie con tres o más reimpresiones. El servidor conserva un registro en `reimpresiones_etiqueta` y su auditoría por rollo, con el mismo solicitante y motivo; nunca se sustituye por un registro de tanda. El umbral de alerta sigue siendo tres por rollo.


## Controles pendientes: Etiquetas y costos de Entradas

- **No uniformar estos contadores como notificaciones leídas.** Abrir una pantalla o consultar un historial nunca atiende ninguno de los dos controles.
- **Etiquetas:** control de merma por rollo con al menos tres reimpresiones. La atención es explícita, inicialmente por ADMIN, y registra quién, cuándo y hasta qué reimpresión concreta se revisó. Los históricos sin revisión comienzan pendientes. Una reimpresión posterior vuelve a señalar el rollo; varias reimpresiones aún pendientes del mismo rollo cuentan como un solo caso. Conservar íntegros los historiales de reimpresión, revisión y auditoría. Lista y contador deben compartir el mismo criterio y las revisiones concurrentes no pueden ocultar reimpresiones nuevas.
- **Entradas pendientes de costo:** estado operativo, no revisión administrativa. Una entrada sigue pendiente mientras tenga algún rollo sin costo capturado; sale del contador al capturar los costos faltantes. No agregar un botón «revisado», ni permitir descartarla por verla o reconocerla. La revisión de Etiquetas no debe modificar este flujo.

## Permission modules (32 total)

`dashboard`, `pos`, `entradas`, `salidas`, `movimientos`, `etiquetas`, `inventario`, `auditoria_inventario`, `productos`, `precios`, `ajustes`, `clientes`, `clientes_credito`, `clientes_precios`, `clientes_finanzas`, `proveedores`, `proveedores_finanzas`, `contenedores`, `ubicaciones`, `usuarios`, `permisos`, `resumen_caja`, `cortes`, `cobros_pagos`, `reportes`, `conciliacion`, `auditoria`, `camionetas`, `choferes`, `viajes`, `salidas_venta`, `equipos`

## Salidas extraordinarias

**Salidas extraordinarias:** merma, robo y muestra sacan del inventario un rollo que no se vendió ni se transfirió. Son **siempre el rollo completo** —no existe la salida extraordinaria parcial— y **solo las registra ADMIN**, con guardia de rol en el servidor además de la matriz de permisos. La muestra no regresa por esta vía: los tres motivos se comportan igual frente al inventario y el motivo es información para reportar y auditar, nunca una rama de lógica.

Mecánicamente reusan lo que ya existe: estado `BAJA`, movimiento `AJUSTE_NEGATIVO` por la cantidad completa en negativo, y `revertirMovimiento` para corregir un error. No hay tabla ni ciclo de vida propio.

Viven en una **pestaña dentro de Salidas**, no en la barra lateral. La barra lateral no crece por cada operación nueva; las operaciones que sacan inventario entre ubicaciones o fuera de él viven en Salidas.

El costo de las salidas extraordinarias es **pérdida de inventario, no costo de lo vendido**. Se reporta aparte y nunca se suma a la utilidad ni al margen de ventas.

- Decisión conservadora: el módulo es `salidas` porque se trata de una salida de inventario; la guardia directa de rol ADMIN en el servidor es la autoridad.

## Propuesta pendiente — base de pruebas permanente

**No está creada.** Antes de aprovisionarla, el propietario debe decidir si su plan de Neon y el costo operativo justifican mantener una rama, compute, almacenamiento y datos de prueba de larga duración.

### Qué se necesita

- Una rama y una base dedicadas exclusivamente a pruebas, separadas de development y producción.
- Un rol de base exclusivo para el arnés, con su conexión guardada como `TEST_DATABASE_URL` en Secrets; nunca escrita en archivos ni reutilizada como `DATABASE_URL`.
- Un nombre de base inequívoco permitido por las guardias de las suites, usuarios ficticios y una contraseña ADMIN exclusiva de pruebas.
- Una política acordada de responsables, presupuesto, caducidad de datos, refresco y eliminación.

### Preparación propuesta

1. Crear la rama permanente solo después de aprobar el plan y costo de Neon.
2. Crear dentro de ella una base vacía; no clonar datos reales ni asumir que `neondb` representa development.
3. Aplicar el esquema vigente generado desde el código y ejecutar el seed con credenciales exclusivas de prueba.
4. Confirmar con `current_database()` el nombre esperado y verificar que la URL sea distinta de `DATABASE_URL` antes de cualquier escritura.
5. Registrar `TEST_DATABASE_URL` mediante Secrets y ejecutar una suite de humo que confirme esquema, seed, permisos y aislamiento.

### Refresco y conexión

- Refrescar desde cero después de cambios incompatibles de esquema o cuando los fixtures acumulados impidan resultados repetibles: crear una base vacía en la misma rama, aplicar esquema y seed, cambiar el Secret y retirar la base anterior después de verificar.
- Para cambios compatibles, aplicar el flujo normal de esquema y volver a ejecutar el seed, que conserva personalizaciones explícitas.
- Los datos y las identidades de prueba deben proceder exclusivamente del seed autorizado. No crear fixtures adicionales por cuenta propia: si faltan datos o referencias, detenerse y comunicarlo al propietario para resolverlo antes de continuar. Una suite fallida nunca autoriza limpieza amplia.
- Toda prueba debe abortar si falta `TEST_DATABASE_URL`, si coincide con `DATABASE_URL` o si `current_database()` no coincide con el nombre seguro esperado.

### Ventajas y costos

- Ventajas: elimina la preparación repetida de ramas, acelera E2E, facilita reproducir fallos y permite ejecutar validaciones frecuentes.
- Costos: consume recursos del plan Neon, requiere Secret y credenciales adicionales, mantenimiento de esquema/seed, limpieza de fixtures, monitoreo de datos envejecidos y disciplina para que nunca reciba información real.
- Riesgo operativo: al ser persistente, una prueba puede depender accidentalmente de residuos anteriores; por eso no sustituye fixtures aislados ni las guardias de identidad.

Mientras esta decisión siga pendiente, continúa vigente el procedimiento de rama Neon desechable: base vacía con esquema y seed actuales, `current_database()` confirmado, `TEST_DATABASE_URL` distinta de `DATABASE_URL`, prohibición de crear ADMIN o sesiones de prueba en development y eliminación completa de la rama al terminar.

**Autorización desechable acotada de Tarea 6 (2026-09-23):** el propietario autoriza usar una **copia desechable de la base de la aplicación** para comprobaciones aisladas y crear allí usuarios sintéticos. La copia debe tener identidad y conexión propias mediante `TEST_DATABASE_URL`, distinta de `DATABASE_URL`; los usuarios, sesiones y demás escrituras de prueba existen únicamente en esa copia y nunca en development. Al terminar se elimina la copia completa. Esta autorización no crea una base permanente, no permite copiar actores de la aplicación a development, no amplía la política de datos duraderos y no autoriza purga, restauración operativa ni escrituras en la base de la API.

**Automatización de `TEST_DATABASE_URL` — integración local desechable:** ejecutar `pnpm test:isolated` para preparar esquema, seed autorizado, inicializadores y comprobaciones de identidad. El arnés crea PostgreSQL local nuevo por corrida, accesible solo mediante un socket privado, sin clonar Neon ni cambiar la base de la aplicación. Deriva `TEST_DATABASE_URL` y la inyecta únicamente a los procesos hijos; no se solicita, guarda ni copia manualmente esa conexión. Conserva la conexión real de la aplicación exclusivamente para comprobar su identidad mediante lectura. No aceptar una URL de pruebas externa ni sustituir la identidad de la aplicación por otra ficticia.

- `pnpm test:isolated --suite api-script:test:ticket-iva-schema` prepara la base y ejecuta la suite de esquema IVA revisada, sin usuarios ni fixtures adicionales.
- `pnpm test:isolated --suite api-script:test:admin-realtime-reconciliation` usa el mismo aprovisionamiento automático y ejecuta consultas de solo lectura con filas virtuales limitadas a cada consulta; no agrega datos persistidos ni usuarios al seed. Ambas suites reciben `TEST_DATABASE_URL` del arnés, sin pasos manuales.
- `pnpm test:isolated --list` presenta entradas permitidas, bloqueadas y pendientes de revisión, distinguiendo aliases de archivos. El resultado de preparación no equivale a que pasaron todas las integraciones. Los scripts de bajo nivel conservan sus guardias y reciben la conexión desde el arnés.
- La lista permitida es cerrada: no ejecutar suites que creen usuarios, sesiones o fixtures fuera del seed autorizado. El informe `reports/auditoria-suites-base-pruebas.html` identifica sus escrituras, referencias y comandos. No ampliar el seed ni modificar esas suites por cuenta propia.
- Al terminar, fallar o recibir una señal, detener los procesos hijos y PostgreSQL antes de eliminar exclusivamente el directorio temporal de esa corrida. Si no puede demostrarse el cierre, conservar el directorio privado y reportar el error, nunca borrarlo bajo un servidor vivo.
- Este arnés usa PostgreSQL local para integración; no cambia las reglas de ramas Neon aplicables a E2E ni aprueba una base de pruebas permanente.

**2026-09-12 — deuda pendiente acumulada:** renombre a `documentosPendientes` y resolución de documentos de bolsas/piezas en Movimientos; codegen reproducible. Corregidos con autorización TS6059/TS5097 y el extractor frágil de trazabilidad: typecheck completo aprobado y prueba del resolver real 2/2. Implementado y ejecutado el aprovisionamiento automático local: ciclo de vida 11/11, esquema IVA real 1/1, interrupción SIGTERM y fallo de preparación comprobados con limpieza. Las suites incompatibles con el seed permanecen bloqueadas, no aprobadas. La inspección visual autenticada de Movimientos y la comparación del número real del tablero siguen sin verificarse.

### Regla obligatoria — población de bases desechables

- Las bases desechables, tanto locales como en Neon, se pueblan **solo con lo que genera el seed autorizado**.
- **Está prohibido copiar, clonar, importar o restaurar usuarios o identidades reales del sistema a una base de pruebas**, incluso desde respaldos locales, aunque sea para satisfacer llaves foráneas y aunque la base se elimine después. Tampoco se usan otros datos reales para completar el seed.
- Si el seed no genera los actores, datos o referencias necesarios para una prueba, **detenerse, informar exactamente qué falta y esperar la decisión del propietario**. No copiar identidades, insertar fixtures alternativos ni ampliar el seed por cuenta propia para eludir ese bloqueo.
- La copia de un actor desde un respaldo realizada durante la verificación histórica del caché **no es una práctica autorizada ni un precedente reutilizable**. Su evidencia se conserva como registro de lo ejecutado, no como procedimiento permitido.

## Cierre del plan de cinco partes

La bitácora de auditoría es de solo lectura, sin excepciones ni siquiera para ADMIN. Cada acción destructiva conserva su confirmación específica: la purga de productos exige usuario y contraseña de ADMIN; las demás entidades de la ruta de purga conservan el texto exacto. No se generaliza una confirmación a todos los flujos ni se permite saltar sus reglas de integridad. El sistema impide dejar la instalación sin ningún ADMIN activo con acceso completo, validado en el servidor dentro de la transacción. Las acciones de SUPERVISOR sobre clientes, proveedores y productos se resuelven desde la matriz configurada; una descripción general del rol no justifica un techo adicional.

## Parte 10 — Catálogo por tela y unidad BOLSA

Un producto sigue siendo **tela más color**; la pantalla los agrupa por tela pero el modelo no cambia. Una tela de un solo color también se agrupa.

La unidad **BOLSA** mapea al modelo existente sin estructuras nuevas: una **caja** es un rollo, con su serie y su etiqueta, y su cantidad de **bolsas** es editable como los metros. Vender una caja equivale a vender un rollo; vender una bolsa suelta equivale a la venta metreada. Cada bolsa trae 100 piezas, pero el sistema cuenta bolsas, no piezas.

**Metros, kilos y bolsas nunca se suman entre sí.**

Las unidades se muestran siempre como **Mts.**, **Kg.**, **Bolsas** y **Pzas.**, traducidas por una función compartida. Ninguna se escribe a mano.

## Fuente de verdad del crédito

El libro de movimientos de crédito es la fuente de verdad. El estado de una nota —Pendiente, Abono parcial, Pagada o Con retraso— se deriva del saldo y de la fecha de pago mediante la función canónica, y nunca se marca a mano. Ninguna pantalla, endpoint o tarea puede guardar ese estado como una marca independiente.

## E1 — origen y evidencia de crédito

**Estado al 18 de septiembre de 2026: el propietario cerró la parte de base de E1 y autorizó la reanudación normal de la API con control inicial y recorrido de navegación/formularios sin confirmar movimientos. API REANUDADA para ese control.** Las tres guardas están instaladas en `heliumdb`: PASS / COMMITTED_VERIFIED y 15/15 controles SQL. El primer arranque posterior a las guardas terminó correctamente, insertó **0 compras** y conservó sus definiciones; sólo cambió `updated_at` en 70 permisos de rol y 54 de ubicación, sin cambios financieros. El estado del recorrido y los límites de liberación se registran en [control-inicial.md](reports/e1-reanudacion-2026-09-18/control-inicial.md). Las escrituras de negocio las hará el propietario mediante operaciones genuinas después de revisar ese recorrido. **Si una operación permitida produce E1C01, E1P01 o E1A01, detener el recorrido y reportar; nunca sortearlo cambiando naturaleza, flags o guardas.** No repetir la migración ni el instalador. Los informes anteriores que dejaron la API pausada son antecedentes de la autorización posterior, no una orden vigente de mantenerla apagada. Evidencia de instalación: [resultado-operativo.md](reports/e1-guardas-operativa-2026-09-18/resultado-operativo.md).

**Abono: default temporal Transferencia.** El formulario debe abrir y reabrir con Transferencia y cuenta bancaria elegida explícitamente mientras el efectivo físico de crédito siga cerrado. **Revisar expresamente este default al liberar E2 y E3 coordinados**: ni dejarlo en Transferencia por olvido ni restaurar Efectivo automáticamente sin revisar la captura habilitada. **Cobertura abierta:** autorización/cancelación de notas con líneas y rollos, consumo/restitución y trazabilidad, concurrencia, fallos de red y reintentos, atomicidad con inventario/auditoría/notificaciones. Las notas del ensayo anterior eran sin líneas; no extrapolar su resultado. Alcance detallado en el control inicial; pruebas con escrituras sólo en entorno aislado autorizado, no en la operativa ni en el clon conservado.

La fuente autorizada del resultado DDL es [migracion-aplicada.md](reports/e1-ejecucion-2026-09-17/migracion-aplicada.md): **27/27 sentencias, COMMITTED_VERIFIED**. Las **63 tablas anteriores** conservaron conteos y huellas de todos sus campos; los **17 triggers no internos anteriores** conservaron definición y estado. El inventario pasó a **66 tablas y 23 triggers no internos**, con tres tablas E1 nuevas vacías. Los tres movimientos históricos conservaron importe, fecha y contenido, y sus siete columnas E1 permanecieron NULL. No se recapturaron ni atribuyeron históricos. Este resultado acredita la migración, no los flujos de aplicación.

**Origen obligatorio en todo movimiento nuevo.** Cada productor declara `sitioOrigenId` explícito de una TIENDA activa y autorizada, junto con naturaleza y operación. **No se deduce el sitio desde la nota:** FIFO puede aplicar un abono recibido en una tienda a notas de otra. El sitio de recepción y el de aplicación no son el mismo hecho. La autorización de una venta a crédito y su cancelación sin dinero también declaran su sitio operativo, sin inventar una recepción.

**Exactamente una de cuatro naturalezas, sin inferencias desde el signo o la forma de pago:** cada productor declara su naturaleza. En E3 el servidor la determina por el flujo autorizado, sin preguntarla al cajero: Caja es `INGRESO_FISICO`; recaptura desde cliente es `CORRECCION_CONTABLE`. No se permite escoger o cambiar la naturaleza en esas peticiones.

| Valor SQL/API | Hecho y productores |
|---|---|
| `INGRESO_FISICO` | Dinero realmente recibido: abono ordinario o dirigido. |
| `DEVOLUCION_FISICA` | Dinero realmente devuelto: reverso de abono declarado expresamente como devolución. |
| `CORRECCION_CONTABLE` | Recaptura o reverso sin dinero nuevo/devuelto, ajuste manual y baja incobrable; exige justificación. |
| `OPERACION_CREDITO_SIN_DINERO` | Autorización de venta a crédito y reverso automático de esa venta al cancelarla sin movimiento de dinero. **No son correcciones contables.** |

Una recaptura contable **no es efectivo que entró al cajón**. El signo, `ABONO`/`REVERSO`, la forma de pago histórica o una nota libre no prueban movimiento físico. El reverso no hereda la naturaleza ni la sesión del abono: declara devolución real o corrección sin dinero. Las cuatro categorías son obligatorias y excluyentes, con compatibilidad por productor.

**Decisión E3 del propietario (2026-09-21; actores actualizados por Parte 2 del 2026-09-22; estado de preparación histórico anterior a la autorización del 2026-09-23):** el cajero nunca ve una pregunta de naturaleza. Todo abono capturado desde Caja es dinero real recibido en ese momento y requiere caja abierta. Las recapturas de pagos recibidos antes, sin dinero nuevo, solo se capturan desde la pantalla del cliente, con motivo obligatorio; nunca entran a caja. **Recaptura es un permiso configurable de la matriz, por defecto solo ADMIN, sin veto ADMIN fijo en código**, igual que remate y precios. Se conserva la guarda E1: CONTADOR, SISTEMAS y BODEGA no pueden capturar recapturas, aunque tengan otro permiso de matriz. Se conserva el registro contable de crédito de la recaptura; no se simula una recepción física ni una sesión de caja.

**Caja operativa frente a efectivo físico:** la sesión abierta exigida por el flujo E3 no convierte una transferencia en efectivo. Se conserva la regla E1 de que la evidencia de una transferencia lleva cuenta bancaria y no `sesionCajaId` de efectivo; la asociación operativa de recepción/recibo se mantiene separada. Una recaptura no tiene ninguna asociación a caja. No se retiran guardas permanentes para acomodar estos flujos.

**Recibo E3 y acceso desde otro equipo:** el recibo con folio propio y evidencia inmutable se genera al cobrar, no al imprimir. Tiene dos copias A5 horizontal; no hay impresora en Caja ni impresión automática desde el cobro. ADMIN accede posteriormente desde el abono, el estado de cuenta y el corte. Reimprimir no vuelve a cobrar ni recalcula el reparto o los saldos; los históricos sin evidencia suficiente explican los faltantes y no se reconstruyen con saldos actuales. La comprobación física de firmas, márgenes, capacidad y legibilidad sigue correspondiendo al propietario en su impresora.

**Límites históricos de construcción E3, sustituidos para la liberación por la autorización del 2026-09-23:** código, interfaz y permisos nuevos permanecían apagados hasta autorización separada de liberación. El flujo dirigido sin ADMIN exige exactamente el saldo pendiente de las notas indicadas (P6) y no se habilita sin E5/E7; recibido pendiente no reduce deuda ni crea favor disponible. El esquema o retiro de guardas que se necesite se prepara con reversión, sin ejecución. Esta construcción no autorizaba acceso a la base de la API, reinicios, cambios al bundle activo ni modificaciones del paquete o dist candidato de E2. La liberación vigente se rige exclusivamente por «Liberación simple temporal» y no abre el flujo dirigido.

**Actores de recaptura E3 frente a E1 — decisión vigente Parte 2 (2026-09-22):** recaptura se concede mediante permiso de matriz, por defecto solo ADMIN y personalizable para los otros actores permitidos por E1; no se fija ADMIN en código. Se conserva la exclusión de CONTADOR, SISTEMAS y BODEGA, que ningún permiso supera. SUPERVISOR, CAJA y TERMINAL necesitan el permiso específico: su pertenencia general a actores de crédito no basta. Se descarta el antiguo pendiente técnico de exigir exclusividad ADMIN frente a permisos personalizados; fue sustituido por el propietario, no implementado. Los informes y el paquete CLOSED anteriores son evidencia histórica, no la norma vigente.

**Alcance de apertura E3 decidido en Parte 2 (2026-09-22), antecedente histórico:** la liberación E3 prevista incluía captura ordinaria de efectivo. Retiro dirigido/retenido, devolución, atribución y Fondo permanecían cerrados. La preparación autorizada usaba expectativas READ ONLY de la conexión efectiva de la API y bases PostgreSQL nuevas desechables; SQL 01 y el retiro acotado de la guarda ordinaria SQL 03 solo se ensayaban allí. La fuente que servía desarrollo conservaba sus gates OFF; el candidato operativo se preparaba mediante activación explícita en copia física aislada. La prohibición de ejecutar fase B, escribir en la base de la API, reiniciar su proceso o alterar el candidato era vigente para esa autorización y fue sustituida, solo para el alcance expresamente liberado, por «Liberación simple temporal» del 2026-09-23. Autorización histórica íntegra: `reports/e2-liberacion-20260922/autorizacion-tres-partes-20260922.txt`.

**Sesión solo cuando corresponde a dinero físico en efectivo.** Su soporte exige `sesionCajaId` explícita, abierta y del mismo sitio de origen, con `CAJA_FISICA`; nunca se fabrica ni se deduce una sesión. Una transferencia exige cuenta bancaria válida y ninguna sesión de caja. Una corrección o una operación de crédito sin dinero tampoco imputa sesión de caja. **La captura nueva de efectivo de crédito permanece DESHABILITADA en la aplicación y cerrada por SQL**, incluidas devoluciones físicas en efectivo. Las guardas independientes de efectivo, cobros retenidos y atribuciones están instaladas en clon y operativa, con rechazos E1C01/E1P01/E1A01 comprobados. La migración original no las incluía: se agregaron en una intervención posterior autorizada, sin alterar la integridad permanente. Tener estas guardas no activa capturas ni corrige el corte pendiente. SQL y retiro ensayado en clon: [resultado-y-propuesta.md](reports/e1-guardas-temporales-2026-09-18/resultado-y-propuesta.md); ejecución operativa y conservación: [resultado-operativo.md](reports/e1-guardas-operativa-2026-09-18/resultado-operativo.md).

**Ajuste manual:** si se identifica la nota originadora, `notaOrigenId` debe pertenecer al cliente y su tienda autorizada debe coincidir con el origen declarado. Si no puede identificarse, se exige tienda elegida y `origenJustificacion` no vacía que explique esa elección; no se inventa una nota. Esta evidencia no cambia el destino financiero del ajuste ni el reparto FIFO. La baja incobrable también es un productor cubierto, con origen, naturaleza de corrección y sus autorizaciones existentes.

**Cobro recibido pero aún sin aplicar:** `cobros_credito_pendientes_e1` es una tabla separada, **NO un ABONO ni una aplicación del ledger**. Su soporte conserva cliente, importe aún sin aplicar, instante real, sitio, medio/cuenta, sesión cuando corresponda y motivo/referencia. Así FIFO no puede consumirlo antes de la autorización ADMIN. La solicitud de pago dirigido pendiente de autorización no equivale a haber recibido dinero. **El modo de cobro retenido permanece DESHABILITADO**; no se registró ninguno ni se implementa aquí su aplicación posterior. Esa activación requiere E5 y los lectores de E7, fuera de E1.

**Históricos:** por decisión del propietario del 2026-09-18, los **tres movimientos #51, #52 y #53** se quedan como **«Sin sitio determinado»**. Esto sustituye para esos tres movimientos el pendiente de determinar su sitio real; no se autoriza atribuirlos. La vía general futura en `atribuciones_credito_e1` es append-only, solo para ADMIN/SUPERVISOR con permiso y sitio autorizado, evidencia y motivo obligatorios. Referencia el movimiento por ID **más su timestamp original exacto** y el snapshot de **cinco campos**: `cliente_id`, `tipo`, `importe`, `ticket_id`, `movimiento_origen_id`. La cadena de rectificación conserva esa identidad y enlaza mediante `anterior_id`, sin editar el original ni sobrescribir atribuciones previas. Para otras atribuciones futuras, el propietario determina qué evidencia basta y cuál fue el sitio real. **La puerta de atribución está cerrada y no se ejecutó ninguna atribución.**

**Productores viejos e idempotencia:** una petición sin metadatos E1 obligatorios se rechaza con **HTTP 400 y mensaje claro de actualizar la aplicación**, sin transición permisiva. La identidad de reintento es **productor estable del servidor + UUID**; actor y productor nunca proceden del cuerpo libre del cliente. El contenido inmutable se construye con lista blanca de metadatos, intención monetaria normalizada y destinos seguros, sin contraseñas, credenciales ADMIN ni tokens de sesión. Misma identidad y contenido devuelve el movimiento guardado; cambiar contenido o naturaleza devuelve **409**, sin abrir otro espacio de deduplicación por naturaleza. Los permisos y la autorización operativa actual del actor/sitio se revalidan **antes del replay**; sesión abierta y estado financiero mutable se comprueban solo para una operación nueva. La reclamación y las escrituras correspondientes son transaccionales. En pagos dirigidos, la aprobación conserva la identidad y evidencia de la solicitud original; no aprueba otra UUID.

**Límites:** E1 no modifica FIFO, deuda global, saldo a favor, límite de crédito, históricos ni candados producto–ubicación. No abarca E2–E12, no resuelve por sí solo corte/reportes y no reanuda Prompt P ni cierra su Grupo 1.

**Verificación ejecutada, sin declaración de API lista para operar:** typecheck completo en cero y frontend posterior en cero; 59 pruebas backend/contratos aprobadas; los 361 casos frontend ejecutados todos en una pasada global 360/361, seguidos por confirmación enfocada 2/2 tras corregir la prueba del único fallo; 66 pruebas nuevas vistas fallar con defectos reales en copias aisladas y pasar al restaurarlas. No hubo segunda pasada global frontend. Verificación offline en [validacion-codigo.md](reports/e1-ejecucion-2026-09-17/validacion-codigo.md). **Ensayo PostgreSQL anterior a las guardas:** 20/20 POS, 59/59 clientes y 21/24 evidencia, con los siete productores ejercitados y tres INSERT de capturas cerradas admitidos por SQL y revertidos. Detalle en [resultado-ensayo-clon.md](reports/e1-ejecucion-2026-09-17/resultado-ensayo-clon.md). Los fixtures de ese ensayo se ejecutaron exclusivamente en el clon; sus filas originales se conservaron y no hubo conexiones operativas durante ese ensayo. La instalación operativa posterior de guardas contó con autorización separada para sondas SQL revertidas: 15/15 PASS, sin usuarios ni permisos de prueba. No se afirma una nueva suite completa del repositorio, prueba concurrente ni consumo/reverso de inventario.

**Corrección de las tres brechas:** el clon aprobó 84/84 controles, incluida retirada independiente y reinstalación exacta; sus guardas permanecen instaladas. La instalación posterior en la operativa aprobó 15/15 controles, COMMIT confirmado y comprobación desde conexión nueva. Tiempo operativo BEGIN → COMMIT: **619.803 ms**, con preflight transaccional; ejecución registrada completa: **4.040 s**. Se conservaron las 66 tablas, 55 funciones y 23 triggers no internos permanentes; el total operativo es ahora 58 funciones y 26 triggers no internos. No se retiró/reinstaló ninguna guarda operativa para probar. **Estas guardas son temporales y removibles**, independientes de la integridad permanente: efectivo espera a **E2 y E3 coordinados**; pendientes, a **E3 y E5 con sus dependencias**; atribución histórica **no se libera automáticamente con ninguna entrega: requiere decisión explícita del propietario sobre la evidencia y el sitio**. Conservar el clon y el respaldo de Drive hasta cerrar E1. El reinicio previo del workspace terminó el proceso del clon, pero su directorio persistente se conserva; no fue arrancado, recreado ni modificado durante la intervención operativa.

## Parte 7 — Tickets, notas y viajes

El documento de venta se elige antes de vender: **TICKET** para contado y **NOTA** para crédito. Nota implica crédito siempre y el servidor lo hace cumplir en `artifacts/api-server/src/lib/pos.ts`; el crédito y su plazo se deciden en el POS y Caja únicamente autoriza. La Nota se imprime con precios o como Nota de Productos sin ningún importe, a elección del operador; el filtrado de importes se hace en el servidor. La copia interna siempre lleva precios y QR. En el ticket, las dos variantes de nota y la hoja de Salida, las líneas de rollo se agrupan por producto y **no se imprimen series**. El detalle por rollo permanece en pantalla y en la hoja de viaje, no en la hoja impresa de Salida; el layout productivo de `artifacts/mariana-textil/src/pages/salida-documento.tsx` renderiza producto, color, rollos, cantidad y SKU. Los viajes registran camioneta, chofer, origen y los documentos que se llevaron; no se cierran, no confirman entrega y no rastrean ubicación. Cuando una salida pertenece a un viaje, el chofer viene del viaje y no del campo de transportista.

El libro de movimientos de crédito es la fuente de verdad. Salvo la excepción autorizada de pago dirigido, un abono se reparte por antigüedad entre las deudas elegibles existentes y solo el sobrante queda como saldo a favor. **Al autorizar una nota nueva se aplica automáticamente el favor disponible hasta el menor de ambos importes**, con límite de crédito duro y evidencia exacta. Esta regla sustituye expresamente la aplicación manual anterior; no modifica pagos a proveedores ni autoriza redistribuir movimientos históricos. Las notas históricas ya marcadas conservan sus saldos hasta una corrección autorizada. La cobertura y los bloqueos pendientes se documentan en «Abonos, estados y saldo a favor». Una venta a crédito imprime nota, no ticket: dos copias, la interna con QR y la del cliente sin él.

Los reversos de abonos de cliente son siempre totales: el movimiento `REVERSO` debe referenciar el `ABONO` original y tener exactamente el mismo importe con signo contrario. La base lo hace cumplir mediante un trigger y rechaza reversos parciales. Para corregir un abono equivocado se registra su reverso completo y después se captura el abono correcto; nunca se edita el original ni se inventa un ajuste parcial. La naturaleza de cada nuevo movimiento se declara según «E1 — origen y evidencia de crédito»: corregir un registro no acredita una devolución ni otra recepción de dinero.

Para abonos de clientes, “cuenta destino” usa las categorías operativas existentes, no un catálogo bancario inventado: `CAJA_FISICA` identifica efectivo y una transferencia debe indicar `CUENTA_FISCAL` o `CUENTA_NO_FISCAL`. Los movimientos históricos pueden conservar `null`, pero todo abono nuevo debe registrar una categoría coherente con su forma de pago. La categoría de cuenta no prueba recepción física ni habilita su captura: naturaleza, sesión y puerta cerrada de efectivo se rigen por «E1 — origen y evidencia de crédito».

El pago dirigido se solicita desde el cobro del cliente o el pago al proveedor, se autoriza desde la notificación sin entrar a otra pantalla, y su histórico vive en Reportes como registro de cuántas excepciones a la regla FIFO ha habido. No es una pantalla de trabajo diario. Solo `PENDIENTE` permanece como evento derivado activo. Al aprobar o rechazar, la solicitud desaparece inmediatamente del feed y, en la misma transacción, se guarda una notificación no leída dirigida exclusivamente al solicitante; al leerla sale del feed pero permanece en su historial y enlaza a Pagos dirigidos.

## Cuentas Destino

El encabezado **Cobranza del periodo** también alimenta la banda del mismo nombre del tablero; véase «Tablero: venta y cobranza». No equivale a Contado cobrado de «POS y Caja — regla contable vigente». La decisión de nombres está fijada en E6; la implementación en fuente conserva los importes y las claves técnicas. Las exportaciones XLSX/PDF de Cuentas Destino se completaron en fuente en la Tanda A del 2026-09-22: distinguen Ventas totales, Contado cobrado, Ventas a crédito y Cobranza del periodo, conservando la hoja previa, sus cifras y la fuente canónica; no se instaló el candidato en la API. Los rótulos de cortes de caja no se sustituyen indiscriminadamente. La atribución financiera por periodo/sitio se entrega mediante el lector E7 dedicado y no cambia estas tarjetas ni autoriza escrituras. El orden visual aprobado es Cobranza, Matriz de Operaciones y Ventas; las secciones posteriores conservan su orden. Cobranza agrupa seis tarjetas iguales: primero Total en efectivo, Efectivo facturado y Efectivo sin factura; después Cuentas No Fiscales, Cuentas Fiscales y Por cobrar. Por cobrar conserva su naturaleza de cartera, subtítulo, borde punteado y detalle canónico; no se suma a Cobranza del periodo. Ventas contiene Ventas totales, Contado cobrado y Ventas a crédito, en tres tarjetas iguales a todo el ancho. El encabezado, filtros y exportaciones se mantienen arriba.

Facturación y forma de cobro son preguntas independientes. Efectivo siempre cae en `CAJA_FISICA`; una transferencia cae en `CUENTA_FISCAL` si la venta está facturada y en `CUENTA_NO_FISCAL` si no; el crédito puede combinarse con cualquiera de los dos estados fiscales y representa una promesa, no una cuenta con dinero. Esta derivación vive exclusivamente en `destinationReadModel()` y `accountDestination()` y no debe duplicarse.

La caja física mezcla ventas facturadas y sin factura porque el cajón es uno solo. Es la única cuenta cuyo estatus fiscal no se deduce de la cuenta destino, por eso su tarjeta declara por separado cuánto efectivo corresponde a ventas facturadas.

Venta y cobranza son dos preguntas distintas y no se suman en una sola identidad. **Ventas = Contado + Ventas a crédito** solo usa las fuentes de venta `POS` y `CREDITO`; la presentación puede llamar Vendido al total de ventas. **Cobranza del periodo = Contado + Abonos + Saldos a favor**, netos de reversos, usa `POS`, `ABONO` y `ABONO_SALDO_FAVOR`. El contado aparece en ambas porque una venta de contado es venta y entrada de dinero al mismo tiempo; en cambio, `Cobranza del periodo + Por cobrar` no equivale a Ventas. Las claves técnicas existentes, incluido `cobrado`, no se renombran.

La columna `fuente` de `destinationReadModel()` separa las cuatro categorías operativas: `POS` es venta cobrada al momento, `CREDITO` es venta prometida, `ABONO` es dinero aplicado a notas y `ABONO_SALDO_FAVOR` es dinero recibido aún sin aplicar. Los reversos internos se netean dentro de la categoría de abono correspondiente. **Un abono se registra en el periodo en que entra el dinero, sin importar cuándo se emitió la nota**, incluso si ambos ocurren el mismo día. La categoría se llama **Abonos a notas**. No es una venta nueva: sumarlo de nuevo en Vendido duplicaría la venta.

La pantalla contiene **Vendido**, **Por cobrar (notas de crédito al día)** y **Cobranza del periodo**. Cuentas por cobrar nunca se suma con las tres cuentas reales bajo una etiqueta de ingreso. Los porcentajes de Caja física, Cuenta fiscal y Cuenta no fiscal se calculan sobre Cobranza del periodo. También los de Efectivo facturado y Efectivo sin factura usan ese total como denominador; estos dos porcentajes de presentación están autorizados en frontend, sin alterar importes ni predicados.

La matriz cruza facturación con forma de cobro, contiene solo ventas (`POS` y `CREDITO`) y cuadra con Vendido por renglón y por columna. Abonos y saldos a favor van en un renglón separado de cobranza, sin exigir que la nota sea de un periodo anterior. El servidor verifica el cierre y la interfaz muestra cualquier descuadre en vez de ajustarlo u ocultarlo. Toda forma de pago sin columna propia cae en **Otras**, para que ninguna desaparezca en silencio. Los importes vienen del servidor salvo **Efectivo sin factura = Efectivo cobrado − Efectivo facturado**, usando los dos valores de la misma respuesta. Esta excepción exige igualdad exacta en centavos y una prueba de regresión que falle ante un descuadre; los tres importes deben tener el mismo peso visual, sin relegar facturado o sin factura a etiquetas pequeñas. Autorización textual: `reports/prompt-j/autorizacion-efectivo-sin-factura.md`. También están autorizados los dos porcentajes visuales de efectivo facturado y sin factura sobre Cobrado, sin recalcular otras cifras ni variaciones. La composición fue aprobada e integrada; la diferencia usa centavos enteros y su prueba rechaza una alteración de un centavo. Esto no acredita recorridos autenticados ni casos de operaciones reales ausentes en la base verificada.

Cuentas Destino aplica «Estándar de composición del sistema — Navegación de cifras» mediante el mismo detalle canónico de movimientos, conservando sus filtros. La suma del detalle debe cuadrar al centavo con la cifra que lo abrió. El nombre visible de «Caja en Tiempo Real» es ahora «Tiempo real»; este renombre no modifica su funcionamiento ni la barra lateral.

La comparación con el periodo anterior es opcional, usa un solo interruptor y arranca apagada; el rango inicial es Hoy. Cuando está apagada, el resumen no consulta el periodo anterior. Dentro del detalle se compara siempre. Un periodo en curso se compara contra el mismo tramo transcurrido —medio día contra medio día, no contra un día completo— y un periodo cerrado contra el periodo anterior completo. Si no existe base anterior, la variación es un guion con “sin periodo anterior”, nunca 100%.

Para contar cobros se excluye explícitamente `CREDITO` en vez de enumerar las formas conocidas que sí cobran. Así, una forma nueva entra por omisión y no desaparece del importe o del conteo.

**Pendiente de decisión:** `isValidPaymentDestination` permite cobrar el abono de una venta facturada a una cuenta no fiscal y `cliente-pago-dialog.tsx` todavía ofrece “Facturado” como forma de pago del abono. La pantalla lo señala, pero no lo impide. `allocateCreditFifo` puede repartir un solo depósito entre notas facturadas y sin factura; cualquier regla futura debe resolver esa combinación.

**Reglas compartidas y duplicaciones pendientes:**
- `artifacts/api-server/src/lib/pos.ts`, función `buildCorteCaja`, deriva las cuentas del corte con condicionales propios en la construcción de `cuentas`; es una duplicación separada del predicado contabilizado.
- El Prompt S sustituyó las **seis copias manuales completas** de `accountedDocumentPredicate` en `artifacts/api-server/src/lib/admin-analytics.ts`: **cinco** en `getSalesSummary` (CTE `lines`, ventas, subtotal, IVA y conteo) y **una** en `getSessionMargin`. La condición canónica en `artifacts/api-server/src/lib/accounted-document.ts` no cambió; las llamadas pasaron de 16 a 22.
- El conteo correcto es seis, no el antiguo dos ni los ocho presupuestos por el Prompt S. `replit.md` ya decía seis al comenzar esa entrega; no confundir llamadas al helper con copias. Inventario previo, alias, ubicaciones y variantes: `reports/prompt-s/inventario.md`; ver «Prompt S — unificación mecánica y límites de verificación» para el resultado.

El feed de Caja en `artifacts/api-server/src/routes/notificaciones.ts`, handler `router.get("/notificaciones/feed", ...)`, usa `pendingTicketPredicate` en `cajaTicketsPromise`: muestra tickets sin cobrar y notas sin autorizar, y retira una nota en cuanto queda autorizada. Las ubicaciones numéricas corregidas de las cuatro referencias antiguas están en `reports/prompt-a-finanzas-auditoria.md`; no se mantienen como referencias estables de esta sección.

**Cambio del 7 de septiembre de 2026:** se reconstruyó Cuentas Destino con encabezado Cobrado/Por cobrar/Vendido, cuentas reales, matriz conciliada, IVA facturado, detalles filtrados, incongruencias y desglose por tienda; además se corrigieron el conteo abierto de formas de cobro y el feed pendiente de Caja. Se retiraron los borradores sueltos de la raíz: ningún cálculo de variación se replica fuera del servidor, ni siquiera como archivo de prueba manual. Las tarjetas de cuenta muestran el importe del periodo anterior junto a su porcentaje, por la misma razón que el encabezado.

**Cambio del 7 de septiembre de 2026:** se separaron venta y cobranza mediante `fuente`, la comparación pasó a ser bajo demanda en el resumen y permanente en el detalle, los periodos en curso usan tramos equivalentes y las cifras navegan al detalle canónico.

## Roles SISTEMAS y CONTADOR

**P9/P10 — conflicto RESUELTO para E11 (estado vigente 2026-09-23):** toda cuenta CONTADOR sin asignación A expresa funciona como ContadorF y pierde acceso fuera de lo facturado, así como la capacidad de registrar pagos a proveedor o pagos de cliente. Sustituye «CONTADOR ve todo lo financiero» y la conservación de sus permisos de pagos; no se conservan permisos u overrides que contradigan ese alcance. El selector ADMIN A/F está habilitado con motivo, revisión e historial, pero no se asignó ninguna cuenta: el propietario elige manualmente las personas ContadorA. La preparación E5 permanece separada y apagada.

**TERMINAL** abre `/pos` al iniciar sesión, según `artifacts/mariana-textil/src/lib/home-route.ts`. El servidor le omite recursivamente de las respuestas toda clave cuyo nombre contenga costo, precio, margen o utilidad; esa defensa vive en `artifacts/api-server/src/lib/sensitive-data.ts`.

**SISTEMAS** es el rol del técnico responsable de la aplicación. Opera todo y sí ve el dinero, porque diagnostica problemas de cartera y de precios. No vende ni cobra: sin POS, sin cortes, sin cobros. Lee la bitácora y no puede alterarla. No puede crear administradores ni tocar a un usuario que ya es ADMIN: esa llave se queda con el dueño.

**CONTADOR — perfiles E11 vigentes:** ContadorF ve solo facturas, clientes facturados y ventas facturadas, con la conciliación definida en P9. No ve lo financiero no facturado, Fondo ni pagos a proveedor, ni registra pagos de cliente o proveedor. ContadorA obtiene únicamente la lectura financiera saneada definida por E11; seleccionar A no concede preparación E5. No toca mercancía ni administra el sistema. Sin asignación A expresa se resuelve F. Los movimientos nuevos del ledger de crédito E1 exigen rol operativo autorizado: CONTADOR, SISTEMAS y BODEGA no los producen; E1 no crea un nuevo rol contable ni amplía esos permisos.

Los dos existen separados de ADMIN para poder distinguir en la bitácora qué hizo cada quien.

`rolUsuarioEnum`, en `lib/db/src/schema/enums.ts`, contiene **siete roles**: ADMIN, TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS y CONTADOR. La matriz configurable del seed enumera **seis roles no ADMIN**; su validación compara cada fila con esa lista, no con los siete valores del enum. Una fila corta puede negar permisos en silencio. No confundir cantidad de roles con cantidad de permisos por rol.

La matriz histórica de CONTADOR contiene `crear` en `cobros_pagos` y en `proveedores_finanzas`; describe el estado anterior a E11, no permisos que deban preservarse en ContadorF. La decisión de retirarlos al migrar ya está resuelta. Esas celdas no eluden el control de actor operativo del ledger E1. No se modificó la matriz en esta actualización documental.

### Limpieza para el piloto

**Prompt M — defaults físicos alineados (2026-09-15 23:30:42 America/Mexico_City / 2026-09-16 05:30:42 UTC):** la autorización textual preexistente del propietario permitió alinear `entrada_folio.ultimo_folio` y `salida_folio.ultimo_folio` a `0`, y `series_consecutivo.ultimo_numero` a `10000000`. La única transacción ejecutó exactamente:

```sql
ALTER TABLE public.entrada_folio ALTER COLUMN ultimo_folio SET DEFAULT 0;
ALTER TABLE public.salida_folio ALTER COLUMN ultimo_folio SET DEFAULT 0;
ALTER TABLE public.series_consecutivo ALTER COLUMN ultimo_numero SET DEFAULT 10000000;
```

La evidencia está en `reports/prompt-m/resultado.md` y `reports/prompt-m/resultado.json`: `COMMITTED`, lectura `pg_attrdef` posterior PASS para los seis contadores, 46 filas de control idénticas antes/después, catálogos protegidos sin cambio y 45 secuencias sin cambio. El operador no usó `drizzle-kit push`, no modificó filas, no creó usuarios o sesiones y no detuvo ni reinició servicios. Los reportes históricos de Prompt H y Prompt L se conservan sin reescritura.

**Cierre post-reinicio de Prompt M (2026-09-15 23:41:29 America/Mexico_City / 2026-09-16 05:41:29 UTC):** con la autorización separada `reports/prompt-m/autorizacion-reinicio.md`, MAIN confirmó startup limpio y ambos servicios `RUNNING`: API `Schema startup complete`/`Server listening` en 8080 con backfill `inserted=0`, Vite `ready` en 313 ms para 20329 y sin errores. La evidencia es `/tmp/logs/artifactsapi-server_API_Server_20260916_054036_802_977fa598.log`, `/tmp/logs/artifactsmariana-textil_web_20260916_054036_802_c5d8b9a8.log` y `reports/prompt-m/restart-health.txt` (API 200 `status=ok`, web 200 a las 05:40:37 UTC). La lectura fresca, solo `REPEATABLE READ READ ONLY` con `ROLLBACK`, está en `reports/prompt-m/post-reinicio.json` y `.md`: los seis defaults actuales son `0/0/0/0/999/10000000`, las 46 filas coinciden explícitamente con la evidencia comprometida y los hashes de `productos` y `precio_historial` permanecen exactos. Prompt M queda **CLOSED_DB_AND_POST_RESTART_READONLY** con puerta de servicios **PASS**; no se solicita otro reinicio. Las escrituras normales de startup en otras tablas tienen autorización separada: este cierre no afirma que la base completa sea idéntica desde el commit DDL.

**Registro histórico — reconstrucción atómica (2026-09-13):** `reconstruirCacheExistencias(tx)` usa la transacción recibida, incluidos los bloqueos y la reconstrucción. La purga autorizada abrió una sola transacción, pasó esa transacción a borrado y reconstrucción y propagó cualquier error para revertir todo. Sin parámetro conserva su uso independiente con una transacción propia. La evidencia de esa ejecución está en `.local/phase2-purge-evidence-20260913163631333.json`.

**Registro histórico — purga operativa autorizada del 13 de septiembre de 2026 (no es una instrucción vigente):** el respaldo completo verificado de `heliumdb` es `scripts/.local/backups/respaldo-antes-de-purga-2026-09-13-101833`, acompañado por el commit `b36b9a4eac11b3e630a84f775f71c597618b4f60` y el dump SHA-256 `b2e0ad1765da065cdd5d4f7dbd609eeb7c0fc31dd0b2e53c70d1360806cb22c6`. La descarga desde Drive quedó PASS, owner-only, en [el archivo de respaldo](https://drive.google.com/file/d/1Wxa6y332PLPfWNZ3sEkUlYVEZZ7XW3kb/view?usp=drivesdk), con el mismo hash `b2e0ad1765da065cdd5d4f7dbd609eeb7c0fc31dd0b2e53c70d1360806cb22c6`; los conteos y la restauración del catálogo y del esquema también quedaron verificados. El preflight de la restauración prístina quedó PASS en `.local/phase2-purge-evidence-20260913163342450.json`. El apply LIVE quedó comprometido PASS, `mode=apply`, `exitCode=0`, en `.local/phase2-purge-evidence-20260913163631333.json`; el API de source permaneció pausado durante esa línea base. Cualquier evidencia posterior de ese episodio es histórica y no se usa como verificación de un respaldo futuro ni del estado actual.

**Bloques 2–3 renovados — respaldo, Drive y preflight (PASS de lectura):** `reports/prompt-h/renovacion-api-pausado.md` y `reports/prompt-h/api-pausado-cierre.json` documentan el workflow `finished` y la API detenida durante esas fases; las puertas vigentes de Drive y preflight están en `reports/prompt-h/block2-drive-verification.json` y `reports/prompt-h/block3-preflight.md`. La purga posterior quedó verificada por separado en el Bloque 4. El arranque posterior de MAIN y la pausa posterior de la API están documentados separadamente en `reports/prompt-h/post-arranque-comparacion.md`.

El snapshot histórico de Prompt H sobre `heliumdb` fue capturado el **2026-09-15 21:42:48 America/Mexico_City** (`2026-09-16T03:42:48.408Z` UTC). El dump custom privado es `.local/backups/prompt-h-block2-20260915214248-7517/prompt-h-block2-20260915214248-7517.dump`, de `440802` bytes, SHA-256 `da7d3f7f342756511c6a04d000f0f4f4fa3feea6b9caad21e6abec5213dffb22`; `pg_restore` terminó con código `0` y el cluster desechable queda preservado junto al dump en el mismo directorio, con socket Unix-only.

La verificación de Drive quedó **PASS**, privada y owner-only, en `reports/prompt-h/block2-drive-verification.json`: [snapshot en Drive](https://drive.google.com/file/d/10PvcuYFcbmmCuGbLRkIEULiz0zlb05FC/view?usp=drivesdk), ID `10PvcuYFcbmmCuGbLRkIEULiz0zlb05FC`, verificada a las **2026-09-15 21:45:26 America/Mexico_City**. La descarga mide `440802` bytes y su SHA-256 coincide exactamente con el archivo fuente: `sourceSha256 = downloadedSha256 = da7d3f7f342756511c6a04d000f0f4f4fa3feea6b9caad21e6abec5213dffb22`.

El preflight más reciente (`reports/prompt-h/block3-preflight.md`) fue capturado el **2026-09-15 21:48:10,327 America/Mexico_City** (`2026-09-16T03:48:10.327Z` UTC) y reportó `MATCHES_VERIFIED_BACKUP_AT_CAPTURE`: las **60/60 tablas** mantuvieron conteos y hashes, incluidos `auditoria` (3286, `ebfb27fc49b43dbf3eb4082729d84b0d`), `sesiones` (11, `ea64f311a46b7247f621b2f5c9bddd1c`) y `ubicaciones` (11, `024961124e5a29d6f6e1c4053687a948`); los metadatos de esquema/base/ownership/ACL coincidieron, las **45/45 secuencias** coincidieron y los **14/14 triggers no internos** quedaron enabled. El reporte contiene la captura completa por tabla. Los 18 hashes C exactos y los valores B/folios están inline en `reports/prompt-h/resultado-bloques-2-3.md`; la comparación histórica de Lista A permanece en `reports/prompt-h/comparacion-lista-a-anterior.md`.

El preflight de solo lectura conserva C sin mutación y evidencia **8 movimientos de crédito, 6 tickets (2 notas), 226 rollos, 6 entradas y 2 salidas**, con los 18 hashes C exactos, los folios por clave y el rango de series `1000001–1000226` inline en `reports/prompt-h/resultado-bloques-2-3.md`. La verificación postcommit del Bloque 4 confirmó, en la frontera del commit, A=35 en cero, los seis objetivos B, C=18 exactas, 37 filas de `existencias`, `badPairs=0`, `movimientos=0`, `rollos=0`, 45 secuencias sin cambios y 14 triggers exactos; véase `reports/prompt-h/block4-purga-verificacion.md`. No se ejecutó `RESTART IDENTITY`, `setval`, `ALTER SEQUENCE` ni otro reset de IDs en la purga.

El primer intento de preflight **NO-GO por freshness** es únicamente histórico y se conserva como puntero en `reports/prompt-h/previous-live-api/resultado-bloques-2-3.md`; la renovación inmediatamente anterior quedó preservada en `reports/prompt-h/history-paused-213056/`. Ninguno es un bloqueo actual. El resultado de aquel commit es `COMMITTED_POSTCOMMIT_READ_PASS` según `.local/prompt-h-authorized-purge-status.json`. Después del commit, MAIN reinició la API y el frontend y pausó la API tras el drift post-arranque. Al solicitar el propietario recuperar su acceso, la API se reanudó el 15 de septiembre de 2026 a las 22:27, Ciudad de México; en esa captura ambos servicios estaban ejecutándose y `/api/healthz` respondió HTTP 200. Es evidencia histórica, no el estado actual de la API. No se cambiaron credenciales. `public.contenedores_folio_seq` quedó conservada sin reset ni nuevo objetivo; su decisión empresarial futura permanece abierta, pero no bloquea la purga completada.

**Comparación post-arranque separada:** `reports/prompt-h/post-arranque-comparacion.md` y `.json` documentan la lectura posterior, sin reparaciones ni resets. Las 18 C fueron exactas en el commit; después del arranque, 16 siguen exactas. `permisos_rol` (192 filas) cambió exclusivamente `updated_at` en 72 filas y `permisos_ubicacion` (54 filas) exclusivamente `updated_at` en 54; la comparación de columnas contra el restore pristine prueba que ninguna columna de negocio cambió. Tras el poller, `notificaciones_sistema=12` y `stock_minimo_episodios=3`; las otras 33 tablas A siguen en cero. No se afirma C=18 exactas ni A=35 en cero como estado actual.

Los seis objetivos B siguen correctos; `existencias` conserva 37 filas, `badPairs=0`, `movimientos=0` y `rollos=0`. Avanzaron normalmente cuatro secuencias —`notificaciones_sistema_id_seq` 28→40, `permisos_rol_id_seq` 29041→29128, `permisos_ubicacion_id_seq` 6750→6804 y `stock_minimo_episodios_id_seq` 7→10— sin reset; la lista exacta está en el reporte post-arranque. Los 14 triggers y el catálogo permanecen exactos. El typecheck final actual terminó **PASS**, con 0 errores y `EXIT_CODE=0`, en `reports/prompt-h/typecheck-final.txt`.

**Inventario histórico de Prompt H:** la captura preflight y la verificación
postcommit documentan **60 tablas, A=35, B=7, C=18**. La evidencia completa de
la clasificación y del resultado aplicado está en
`reports/prompt-h/block4-purga-verificacion.md`; las listas parciales históricas
no son instrucciones operativas.

- **A (35):** `aplicaciones_credito`, `aplicaciones_pago_proveedor`, `auditoria_inventario_escaneos`, `auditoria_inventario_participantes`, `auditoria_inventario_snapshot`, `auditorias_inventario`, `autorizaciones_nota`, `contenedor_lineas`, `contenedores`, `cuadre_fiscal_registros`, `entradas`, `movimientos`, `movimientos_credito`, `notificaciones_credito`, `notificaciones_sistema`, `pagos_proveedor`, `reimpresiones_etiqueta`, `revisiones_etiqueta`, `rollos`, `salida_lineas`, `salida_rollos`, `salidas`, `salidas_dinero_caja`, `sesiones`, `sesiones_caja`, `sesiones_caja_dias`, `solicitudes_pago_dirigido`, `stock_minimo_episodios`, `ticket_linea_consumos`, `ticket_lineas`, `ticket_pagos`, `tickets`, `viaje_salidas`, `viaje_tickets`, `viajes`.
- **B (7):** `auditoria_inventario_folio`, `entrada_folio`, `existencias`, `salida_folio`, `series_consecutivo`, `ticket_folio`, `viaje_folio`.
- **C (18):** `auditoria`, `camionetas`, `choferes`, `cliente_documentos`, `clientes`, `equipos`, `equipos_checklist`, `permisos_rol`, `permisos_ubicacion`, `permisos_usuario`, `pisos`, `precio_historial`, `productos`, `proveedores`, `stock_minimo_sitios`, `stock_minimos`, `ubicaciones`, `usuarios`.

**Regla de reconstrucción de listas:** en cada ejecución se debe redescubrir y
listar el catálogo efectivo completo, sin fijar su tamaño a las 58 o 60 tablas
históricas. Cada tabla y sus dependencias requieren una clasificación explícita
y autorizada: borrar, reajustar/reconstruir o preservar. Una tabla nueva,
omitida o desconocida queda pendiente y bloquea la ejecución; nunca se clasifica
como A por omisión. No se heredan listas ni autorizaciones entre ejecuciones.
El ejecutable del 13 de septiembre está fijado a su respaldo y catálogo
históricos y no debe reutilizarse contra el esquema ampliado. El procedimiento
documental y los pendientes de adaptación están en
`reports/tanda-c-20260923/10-procedimiento-purga.md`; no autorizan una purga.

**Deriva vigente de esquema:** `cuadre_fiscal_registros` está viva en la base y ausente de Drizzle. Se reporta como deriva entre esquema y base; no se crea ni se borra del esquema en este bloque.

**Hallazgo de seguridad vigente:** los guards de inmutabilidad append-only de `auditoria` y `movimientos_credito` bloquean `DELETE` por filas, pero ambos son bypassables mediante `TRUNCATE` por roles privilegiados. Es un hallazgo de seguridad de privilegios de base de datos, no una afirmación de explotación HTTP; no se hizo una prueba destructiva y los triggers permanecen intactos.

**Estado de secuencias y alcance:** la aplicación autorizada de esta renovación
usó `TRUNCATE` sin `RESTART IDENTITY`, sin `ALTER SEQUENCE` ni `setval`, y quedó
comprometida con lectura postcommit PASS. `public.contenedores_folio_seq` fue
conservada sin reset ni nuevo objetivo. Su uso empresarial futuro queda fuera
de este cierre, pero no bloquea ni invalida la purga ya completada. No se harán
más escrituras en este procedimiento; cualquier mutación posterior requeriría
su propia autorización, respaldo y preflight.

**Registro histórico separado — comparación C de la purga del 13 de septiembre de 2026 (no es evidencia actual de Prompt H):** la comparación C de esa ejecución mostró los mismos conteos y hashes antes/después en las 18 tablas; `auditoria` conservó sus 3045 renglones. Los mínimos de stock conservados en Cruces (`ubicacion_id=2`, sitio activo) son producto 1374: 2500, `2026-09-13T15:21:35.374621+00:00`, autor `1`; producto 1389: 5000, `2026-09-13T15:21:40.979699+00:00`, autor `1`; y producto 1390: 5000, `2026-09-13T15:21:56.751931+00:00`, autor `1`. Stock mínimo, equipos y permisos por ubicación son configuración y se conservaron; solo se borraron los episodios de faltantes (`stock_minimo_episodios`).

**Evidencia histórica de esa purga:** la consulta exacta posterior dejó habilitados los 11 triggers no internos (`tgenabled='O'`): `aplicaciones_credito_inmutables`, `aplicaciones_credito_validas`, `aplicaciones_pago_proveedor_append_only`, `aplicaciones_pago_proveedor_validar_insert`, `auditoria_append_only`, `auditoria_enriquecer_insert`, `movimientos_credito_inmutables`, `movimientos_credito_reversos_validos`, `pagos_proveedor_inmutables`, `reimpresiones_etiqueta_inmutable` y `ticket_pagos_inmutables`. La captura histórica posterior de Prompt H registró 14; ninguno de estos conteos representa el inventario actual. Ningún trigger se modificó para corregir aquella descripción del conteo.

La comprobación disposable autenticada creó el ticket técnico con folio 1000 y luego la restauración prístina lo eliminó; el contador quedó nuevamente en 999. En las ocho pantallas comprobadas con navegador disposable, Cruces apareció Activo con sus tres mínimos; la explicación stale de Mariana/Apagado quedó corregida; el SKU restaurado `ALA-BEI` conservó precio de lista `$85.00`, costo y márgenes como `—`, y estado `Sin costo`. La evidencia está en `.local/phase2-ui-rehearsal/phase2-disposable-postpurge-proof.json` (SHA-256 `cf41530d9b3b6923c80247cccd2f9947819c61194b4e9acd4d06a8cf7dfed88c`) y `.local/phase2-ui-rehearsal/ui-clarification.json`. El intento de UI LIVE histórico quedó **BLOCKED**, no PASS, en `.local/phase2-live-ui-evidence.json`.

**Catálogo UI actual — estado vigente:** **`APPROVED_BY_OWNER`**. Hoy, **2026-09-15, America/Mexico_City**, el propietario confirmó directamente, en su propia sesión autenticada, que verificó visualmente el catálogo de productos con sus colores, los precios de lista y el historial de precios; está completo. La fecha es la fecha de hoy obtenida del reloj del sistema; no se inventa una hora ni un instante histórico. Esta es **OWNER direct verification**, no una prueba ni una verificación del agente. La observación anterior del agente sobre login `401`, conservada en `reports/prompt-h/post-arranque-login-401.jpg` y sus logs asociados, queda como observación histórica previa, no como bloqueo actual. El arranque limpio **PROVEN** de API y frontend está en `reports/prompt-h/post-arranque-api-startup-20260916-041700.log` y `reports/prompt-h/post-arranque-frontend-startup-20260916-041700.log`; registran `Schema startup complete`, `Server listening` y Vite `ready`. El cierre directo está en `reports/prompt-h/cierre-propietario.md`.

El typecheck raíz final actual terminó **PASS**, con 0 errores y `EXIT_CODE=0`, en `reports/prompt-h/typecheck-final.txt`. No se instalaron paquetes ni hubo cambios de código en esta finalización; las cinco pruebas puras del plan y el dry-run de solo lectura pasaron antes del apply.

La evidencia postcommit histórica del 13 de septiembre en `.local/phase2-live-postcommit.json` y la observación de su reinicio en `.local/phase2-live-postrestart.json` siguen siendo archivos históricos separados; no se usan para clasificar el inventario vigente ni para acreditar el estado actual de la API. La evidencia separa la frontera del commit (`COMMITTED_POSTCOMMIT_READ_PASS`, C=18 exactas y A=35 en cero entonces) de la comparación posterior al arranque en `reports/prompt-h/post-arranque-comparacion.md`: en esa captura 16 C seguían exactas y 33 A seguían en cero. La API se reanudó posteriormente a petición del propietario para recuperar el acceso; esas capturas no representan indefinidamente la aplicación viva ni se mezclan efectos del arranque con la evidencia de commit.

### Pendientes antes del piloto

El piloto se realizará en Cruces. La carga inicial de inventario es el bloqueo operativo para arrancarlo.

- **Alta prioridad: asimetría de cobranza Cruces/global**, descrita con causa y evidencia histórica en «Ventas y cobranza: nombres distintos, atribución pendiente».
- **Alta prioridad: corte de caja sin abonos**, descrito en «Corte de caja: pendiente de alta prioridad antes del piloto». No confundir la omisión del código con un sobrante físico demostrado.
- Mantener el snapshot vigente de Bloques 2–3 (`.local/backups/prompt-h-block2-20260915214248-7517/`) y su comprobación de restauración como artefactos operativos. La API está reanudada para el acceso normal; no detenerla de nuevo por las diferencias históricas de inicialización ya documentadas.
- Preparar y ejecutar la toma y carga inicial de inventario físico.
- Tomar la decisión final de impresora y validar el flujo físico.
- Cambiar la contraseña inicial antes de producción.

## Product

- Login sin registro público ni recuperación de contraseña
- Sesiones con vencimiento por 8 horas de inactividad y tope absoluto de 16 horas
- Bloqueo temporal después de cinco intentos fallidos
- Dashboard con conteos iniciales e inventario por ubicación
- Administración sin borrado de ubicaciones y usuarios
- Sistema de permisos configurable: matriz por rol + excepciones por usuario
- Matriz efectiva de permisos incluida en login y /auth/me
- Catálogo operativo de clientes (sin datos financieros en el listado)
- Módulos de clientes y proveedores divididos: operativo vs. financiero
- Módulo ADMIN de Precios con filtros, semáforo, margen, vista previa obligatoria, gráfica e historial por producto

## Gotchas

- **Mensajes de validación:** un formulario muestra los requisitos de sus campos antes de que el usuario escriba, y los toma de las constantes del contrato para que no se desincronicen. Un error de validación nombra el campo y la regla incumplida; "los datos son inválidos" no le sirve a nadie que esté dando de alta gente en el piso. La validación del cliente es comodidad y nunca sustituye a la del servidor.
- **Decimales:** las cantidades se **guardan** en `DECIMAL(10,3)` y se **muestran** con dos decimales. La precisión de la base y la aritmética del motor —que convierte cantidad × precio a milésimas enteras— no dependen de cuántos decimales vea el usuario y nunca se modifican por un cambio de presentación. Los totales se calculan sobre los valores guardados y se redondean al final; sumar lo que se muestra hace que el documento se contradiga a sí mismo.
- **La etiqueta es la excepción:** conserva tres decimales, porque va pegada al rollo físico y es donde se verifica el metraje exacto.
- **Ajuste de fuente en la etiqueta:** el nombre del producto y el metraje usan el tamaño más grande con el que quepan completos, en escalones discretos, con un mínimo legible por debajo del cual no bajan. Nunca se cortan. Una fuente fija que haga caber al nombre más largo del catálogo —36 caracteres— dejaría ilegible al más corto —11—, y la etiqueta se lee de lejos entre los rollos. Cualquier cambio a esta lógica se valida generando las etiquetas de todo el catálogo vigente, no contra dos ejemplos ni contra un conteo fijo.
- **`drizzle-kit push --force` puede dar un verde falso:** en ejecución no interactiva puede imprimir un error y aun así devolver código 0. Nunca se declara preparada una base solo por el exit code; se capturan y revisan stdout/stderr y después se verifica en el catálogo que existan las tablas, columnas y restricciones esperadas antes de ejecutar seed o pruebas.
- **Una columna existente no completa su `REFERENCES`:** `ADD COLUMN IF NOT EXISTS ... REFERENCES ...` omite toda la definición cuando la columna ya existe, por lo que no crea después la llave foránea faltante. Columna, restricción e índice se reconcilian y validan por separado, cada uno de forma idempotente.
- **Alcance antes que estado:** antes de consultar producto, estado, costo, reservas o cualquier detalle de un rollo se confirma que su ubicación está dentro del alcance operativo del usuario. Fuera de alcance responde como inexistente. Los mensajes informativos —incluido `ROLLO_BLOQUEADO` con salida, cliente, serie o enlace— solo se construyen para inventario ya autorizado.
- Ejecuta `codegen` después de cada cambio en OpenAPI.
- Ejecuta `push` y luego `NODE_ENV=development pnpm --filter @workspace/db run seed` al preparar la base de desarrollo.
- Ejecuta `pnpm run db:verify` antes y después de cualquier cambio de esquema; debe identificar la misma base que el proceso de la API.
- Toda E2E que necesite crear usuarios, sesiones o datos debe usar una rama Neon desechable con una base vacía, esquema y seed actuales. `TEST_DATABASE_URL` debe existir y ser distinta de `DATABASE_URL`.
- Las suites mutantes exigen `NODE_ENV=test`, `REQUIRE_ISOLATED_TEST_DATABASE=1` y `TEST_DATABASE_URL`; además comparan `current_database()` con development antes de crear el pool. Las suites unitarias sin base usan una conexión local inutilizable para que una consulta accidental falle sin tocar development.
- Está prohibido crear ADMIN temporales o limpiar usuarios/sesiones mediante `executeSql({ environment: "development" })`. La limpieza E2E consiste en eliminar únicamente la rama Neon desechable.
- Los precios existentes solo se modifican por `/precios`; `PATCH /productos/{id}` rechaza cualquier intento de evadir el historial. El precio inicial al crear producto sí está permitido.
- Cambia la contraseña del usuario `admin` inmediatamente después del primer acceso.

## Parte 4 — Regla definitiva de reportes por tipo de venta

Los reportes separan siempre ROLLOS de METRAJE. Un margen agregado que revuelva las dos modalidades sin distinguirlas no es aceptable. La venta por rollo se costea con el costo exacto del rollo; la metreada, con el promedio simple de 12 meses congelado al emitir el ticket. Si cualquier línea de un grupo carece de costo congelado, el costo, la utilidad y el margen del grupo quedan pendientes, nunca en cero.

Todas las notificaciones suenan, para todos los usuarios, sin interruptor dentro de la aplicación. Tres familias de sonido: aviso, solicitud y alerta, para que el personal las distinga sin mirar la pantalla. Los navegadores bloquean el audio hasta la primera interacción, por lo que existe un paso de “Activar sonido” al iniciar sesión y un indicador permanente cuando está bloqueado. Un usuario puede silenciar su aparato desde el sistema operativo y la aplicación no puede impedirlo. El pago dirigido a una nota específica es una excepción a la regla FIFO: exige motivo escrito y autorización previa de ADMIN, y queda registrado en un reporte propio.

El algoritmo compartido de reparto es `allocateCreditFifo`, en `artifacts/api-server/src/lib/credit-allocation.ts`, usado para abonos y proyección de antigüedad de clientes/proveedores. La regla de mantenimiento es no crear otra implementación. Las pruebas de integración leen su base de `TEST_DATABASE_URL` y verifican con `current_database()` que no sea la de desarrollo; ningún nombre de base va escrito a mano en el código.

Reportes aplica «Estándar de composición del sistema — Color» a modalidad, signo, rango, categoría o estado.

Los destinos de dinero conservan sus códigos internos y se presentan siempre en este orden: **Efectivo**, **Cuentas No Fiscales**, **Cuentas Fiscales**, **Ventas a Crédito**. Las etiquetas se resuelven desde `@workspace/number-format`; no deben duplicarse en frontend, API, PDF o XLSX.

## Parte 8 — Auditoría de inventario, purga y corte diario

**Bitácora** es el registro de quién hizo qué en el sistema; es inmutable y vive en Configuración. **Conciliación de Kardex** compara el caché de existencias contra el kardex: el sistema contra sí mismo. **Auditoría de Inventario** compara el sistema contra la mercancía física y vive en Inventario. Los tres nombres deben decir qué compara cada uno. Al abrirse toma una fotografía de la existencia del sitio, contra la cual compara; varias personas escanean sobre la misma auditoría al mismo tiempo y un rollo repetido no se duplica. **Cerrar** termina el conteo y conserva su resultado; **Confirmar y aplicar**, reservado a ADMIN, aplica los faltantes y las correcciones de piso. No transfiere ni recibe sobrantes automáticamente. Solo cuenta rollos por QR; no verifica metros ni kilos.

### Auditoría de inventario: resolución y reaparición de rollos

- **Cuadre:** conserva el resultado del conteo, sin fabricar movimientos.
- **Faltante:** mantiene el ajuste de baja existente, su cantidad cero, justificación, marca de revisado y vínculo a la auditoría.
- **Mal acomodado:** corrige solamente el piso, sin kardex ni cambio de existencias.
- **Sobrante:** conserva contexto y queda pendiente de decisión individual ADMIN; no impide cerrar ni confirmar la auditoría. No cambia el conteo, el escaneo, los participantes ni el orden de candados por producto y sitio.

Los cinco casos de sobrante son:

1. **Disponible en otro sitio:** desplazamiento físico no registrado; muestra el sitio registrado.
2. **En tránsito hacia este sitio:** llegada pendiente de recepción en el sistema; enlaza el traslado y exige su recepción por el flujo normal.
3. **Apartado en salida abierta:** mercancía comprometida; muestra el documento y no permite moverla antes de resolver ese compromiso.
4. **Vendido y físicamente aquí:** incidencia financiera grave, presentada separadamente; se cobró mercancía que no salió. Muestra el documento de venta y no lo cancela ni regulariza automáticamente.
5. **Sin registro previo:** solo serie escaneada y aviso de falta de datos verificables. No inventa producto, cantidad ni origen y no genera un alta.

Los estados fuera de esos cinco casos se identifican expresamente como **Requiere investigación**, sin convertirlos en una clasificación falsa.

ADMIN decide con motivo de 10 a 1000 caracteres:

- **Dejar donde apareció:** regulariza expresamente el rollo no comprometido, dejando movimientos, autor, motivo y enlace a la auditoría.
- **Regresar al sitio original:** requiere transportista y crea/envía un traslado normal desde el sitio donde apareció. Si antes debe regularizarse la ubicación, queda documentado como parte de la decisión. El rollo permanece EN_TRANSITO hasta que el destino lo reciba; elegir la opción no significa que ya llegó. Mientras esa devolución siga en tránsito no se acepta otra decisión que oculte su estado.
- **Investigar:** agrega una decisión trazable y conserva el pendiente. No significa que el caso esté resuelto.

Las decisiones, el contexto conservado y la evidencia de reactivación se agregan sin editar ni borrar hechos históricos; sus tablas rechazan UPDATE y DELETE.

**Reactivación de faltantes:** es una vía adicional, exclusiva de ADMIN, desde la auditoría que originó la baja o el detalle del rollo, con motivo obligatorio de 10 a 1000 caracteres. Restaura el mismo rollo a DISPONIBLE con la cantidad exacta anterior acreditada por su baja, conservando serie, producto, costo y entrada. Permite el sitio donde apareció y su piso activo, incluso si son distintos al sitio de baja. **No se vuelve a medir ni se captura metraje: son rollos cerrados; se discute presencia, no cantidad.** Si no hay evidencia íntegra, se bloquea sin estimar. Se validan de nuevo evidencia, estado y compromisos bajo candados y se evita duplicar la operación.

El kardex distingue **REACTIVACION_FALTANTE — Reactivación de faltante** de **CANCELACION — Reverso**. La baja permanece íntegra. Las auditorías posteriores cerradas en el sitio de aparición quedan vinculadas como hechos posteriores; no se reescribe el resultado anterior ni se presenta la reaparición como una cancelación.

**Decisión aprobada sobre BAJA:** se conservan las vías anteriores de reverso, incluidas las generales y las de salidas extraordinarias, con una excepción específica: **la misma baja de auditoría y el mismo rollo solo pueden restituirse por una vía**. Si esa baja ya originó una reactivación, su reverso se rechaza con explicación y enlace al movimiento de reactivación; si ya fue revertida, la reactivación se rechaza con explicación y enlace al reverso. Las consultas de exclusión se realizan bajo el candado del rollo, antes de modificar cantidad o registrar otro movimiento. Una reactivación de otra baja o de otro rollo no bloquea un reverso ordinario. No se declara BAJA terminal ni se cierra su transición existente. Un reverso corrige un movimiento que no debió existir; una reactivación registra que el faltante apareció después. El nuevo tipo de reactivación sigue sin admitirse en el reverso genérico. Otros riesgos se reportan sin corregirlos; véase `reports/single-roll-return/verificacion.md`.

**Avisos:** cada nuevo cierre genera una notificación guardada para ADMIN, NORMAL si no hay diferencias y URGENTE si hay faltantes, sobrantes o mal acomodados. Enlaza el resultado de la auditoría. El sobrante pendiente es otra condición, derivada de su resolución y recepción: permanece visible durante investigación o tránsito y desaparece al resolverse realmente. Marcar leído el aviso del cierre no resuelve esa condición.

**Impresión:** se conserva Letter vertical, margen de 10 mm, diseño y densidad; el encabezado no se repite. La protección contra cortes se aplica a renglones y firmas, sin cuotas artificiales de renglones por hoja.

**Verificación ejecutada el 2026-09-17:** referencia aislada y entrega con 354/354 en la suite original, sin omisiones; `pnpm run typecheck` completo con cero errores. Pruebas nuevas: 15 de motor con dobles transaccionales, 6 de componentes montados y 1 contrato de impresión, todas vistas fallar ante defectos semánticos en copias aisladas y pasar al restaurarlas. Se comprobaron seis PDFs reales de 2/3/5 páginas, incluyendo descripciones envueltas; encabezado único, filas y firmas íntegras. API y frontend arrancaron; las consultas reales adicionales fueron exclusivamente de lectura. **No se afirma haber realizado una devolución/recepción ni una reactivación autenticada sobre mercancía real.** Evidencia, comandos y límites: `reports/prompt-t/verificacion.md`.

**Verificación posterior de exclusión reverso/reactivación, 2026-09-17:** 354 originales + 22 del T + 8 de esta corrección = **384/384**, cero omisiones, y typecheck completo en cero. Se verificaron ambos órdenes, cantidades intactas tras rechazo, reversos ordinarios permitidos, procedencia exacta, rechazo explicativo tras cambio de estado durante la espera del candado, enlace seguro y selección del renglón exacto del kardex. Las ocho pruebas nuevas tienen negativos semánticos aislados. Las comprobaciones del motor son con dobles transaccionales, no concurrencia contra una base real. Evidencia: `reports/single-roll-return/`.

**Activación de recepción — alcance autorizado:** `/inventario/rollos/:id/activar` solo permite una activación nueva **PROGRAMADO → DISPONIBLE**. No es una devolución de venta, un reverso de baja, una recepción de traslado ni una reactivación de faltante. Todo otro estado se rechaza con explicación y la vía correspondiente: reverso permitido del movimiento/documento mal registrado; Reactivación de faltante para una ausencia de auditoría que reapareció; recepción o cancelación del documento para un traslado. MOSTRADOR conserva su terminalidad. Se mantiene el reintento idempotente de una activación ya realizada con el mismo UUID: devuelve el resultado anterior sin una segunda recepción. La revisión previa no encontró un consumidor operativo legítimo que dependiera de activar desde otros estados: el único llamador operativo es el endpoint; el cliente generado no tiene consumidor escrito a mano, y las pruebas existentes parten de PROGRAMADO. No se cambia la tabla general de transiciones, los reversos, FIFO, crédito ni los candados por par producto/ubicación.

**Verificación de esta restricción:** línea base actual 384/384, después 384/384 más seis nuevas = **390/390**, sin omisiones ni fallos nuevos; typecheck completo en cero. Las seis nuevas tienen negativos semánticos aislados y restauración verde. Al admitir BAJA en el negativo, activar y después revertir devuelve 100; con la protección, cantidad y caché quedan en 50. Son dobles transaccionales, no concurrencia PostgreSQL ni operaciones autenticadas sobre datos reales. Evidencia y comandos: `reports/activation-programado/verificacion.md`.

**Diez vías de reverso pendientes abiertas — no corregidas por la restricción de activación:** esta lista procede de revisión estática, no acredita incidentes observados en la base. A y B son sitios operativos; T es la ubicación técnica de tránsito. Las cifras describen registros del sistema, no mercancía física creada. El reverso genérico impide repetir el mismo ID, pero no dispone de una comprobación general de dependencias posteriores: escribe la inversa en el sitio original sin restaurar ubicación ni piso del rollo.

| Pendiente abierto | Efecto y comprobación actual | Ejemplo concreto |
|---|---|---|
| 1. Reverso de ALTA/RECEPCIÓN después de traslado | Resta cantidad y pone PROGRAMADO; no comprueba consumo posterior ni restaura ubicación. | Recepción de 50 en A → traslado y recepción en B → reverso de la recepción original. El rollo queda en B, PROGRAMADO y cantidad 0; el kardex queda A=−50 y B=50. |
| 2. Reverso de VENTA administrativa después de otra restitución | Suma la inversa al kardex y pone DISPONIBLE. En la venta tradicional METRO/KILO conserva la cantidad del rollo. No comprueba dependencias posteriores. | Trasladar 50 de A a B → venta administrativa de 50 en B → revertir la salida histórica del traslado, que pone DISPONIBLE en B y suma 50 en A → revertir la venta. Queda kardex A=50/B=50 con un solo rollo registrado de 50 en B. El ejemplo anterior VENTA → activar → reverso queda bloqueado por la restricción de activación; esta combinación restante no usa activar. |
| 3. Cancelación de ticket parcial con remanente trasladado | Cancela ventas documentales y bloquea documento ya cancelado/salida ligada entregada; no comprueba en general la reubicación del remanente. | Rollo de 100 en A → ticket parcial sin salida ligada consume 50 → remanente de 50 trasladado a B → cancelar ticket. La fila del rollo suma 50 en B y queda en 100, mientras el kardex queda A=50/B=50. |
| 4. Reverso de TRANSFERENCIA_SALIDA | Suma en el origen, pone DISPONIBLE y deja la entrada pareada intacta; no verifica recepción posterior. | Traslado de 50 A→B recibido → reverso de su salida. Kardex A=50/B=50 y un rollo de 50 en B. Antes de recibirlo también puede dejar DISPONIBLE en T. |
| 5. Reverso de TRANSFERENCIA_ENTRADA | Resta la entrada y pone EN_TRANSITO sin mover el rollo ni deshacer el documento. No necesita un movimiento posterior para fallar. | Recibir 50 en B → revertir inmediatamente la entrada. Quedan 50 en un rollo EN_TRANSITO ubicado en B, documento recibido y kardex B=0. Revertir la entrada a T antes de recibir permite también terminar con T=−50/B=50 tras la recepción normal. |
| 6. Reverso de AJUSTE_POSITIVO consumido por baja posterior | Resta el aumento original a la cantidad actual; desde BAJA cambia a DISPONIBLE. No valida localmente cantidad resultante no negativa ni dependencia. | 50 → ajuste +10=60 → baja completa −60=0 → revertir el +10. El motor calcula cantidad −10 y estado DISPONIBLE; no se afirma una prueba de persistencia contra la base. |
| 7. Reverso de AJUSTE_NEGATIVO anterior a otra baja | Suma el descuento original y desde BAJA pone DISPONIBLE. El control específico de reactivación de esa baja no es una validación de toda baja posterior. | 50 → ajuste −10=40 → baja completa de 40 → revertir el primer −10. Aparecen 10 DISPONIBLES aunque la baja posterior del rollo completo sigue vigente. |
| 8. Reverso inmediato de baja manual en tránsito | Ajustar permite dar de baja desde EN_TRANSITO, pero el reverso de AJUSTE_NEGATIVO desde BAJA infiere DISPONIBLE, no el estado previo EN_TRANSITO. | 50 en T/EN_TRANSITO → baja → reverso inmediato. Quedan 50 DISPONIBLES en T, mientras la salida espera un rollo EN_TRANSITO. No hay movimiento posterior que explique o evite este defecto. |
| 9. Reverso de CANCELACION | Invierte otra vez el kardex, pero no reconstruye la modificación de cantidad/estado del movimiento que aquella cancelación deshizo. Seleccionar una CANCELACION como origen no está prohibido. | 50 → ajuste +10=60 → reverso del ajuste=50 → reverso de esa cancelación. Kardex=60, cantidad del rollo=50. La cancelación elegida era el último movimiento. |
| 10. Reverso de DEVOLUCION histórica | El enum existe; no se encontró productor operativo actual. El reverso invierte kardex pero conserva cantidad/estado. No se consultó si hay filas históricas reales. | Si existe una devolución histórica +50 con el rollo disponible en 50, su reverso resta 50 del kardex y deja el rollo disponible en 50: disponibilidad sin respaldo contable. |

**Conclusión del Bloque 2 — propuesta, no implementada:** una regla por cronología (“hay un ID posterior”) no sirve como comprobación compartida. Puede omitir defectos del último movimiento —entrada de traslado, reverso de CANCELACION y baja en tránsito— y bloquear correcciones legítimas: cancelar una venta parcial anterior sin reubicación; cancelar un traslado completo cuyas dos contrapartidas se generaron en orden; o corregir un movimiento después de que los posteriores ya fueron revertidos. Ejemplos: 50 → venta parcial A de 10 → venta parcial B de 20 → cancelar A deja legítimamente 30 conservando B; 50 → ajuste +5 → ajuste −2 → reverso del −2 devuelve 55 y permite después corregir el +5 hasta 50. Una corrección −5/+5 en tránsito que restablece las condiciones pendientes tampoco implica por sí sola que se deba impedir cancelar el traslado.

Antes de construir una comprobación compartida de **reversibilidad del efecto completo**, faltan dos decisiones explícitas:

- **Qué es una operación completa:** qué movimientos pareados y documentos deben tratarse juntos; qué dependencias siguen activas y cuáles ya fueron anuladas; qué correcciones independientes pueden coexistir. No basta con ignorar la pareja de una transferencia: solo deja de ser un impedimento si también queda resuelta dentro de la operación completa. Deben comprobarse cantidad, estado y sitio resultantes sin reconstruir ni reasignar FIFO o crédito.
- **Cómo se trata la evidencia insuficiente:** definir el tratamiento de históricos sin procedencia reconstruible y la vía de revisión/corrección legítima. “No puedo demostrar que sea segura” no significa “la corrección es ilegítima”. No convertir automáticamente esa incertidumbre en un veto universal ni inventar procedencia. Los ejemplos válidos anteriores deben quedar protegidos antes de activar una regla general.

Estas diez vías siguen pendientes y no autorizan su corrección automática. Tampoco se reanuda el Prompt P.

Un registro inactivo solo puede eliminarse si no tiene ninguna referencia en el sistema. Un usuario que aparece en la bitácora o en el kardex nunca se borra: perder su rastro rompe la trazabilidad.

**Una sola sesión de caja por sitio y por día:** se registra el fondo de caja chica en la mañana, se opera, y se corta al terminar. Únicamente Tienda Mariana registra salidas de dinero a proveedores, y el sitio autorizado es una constante nombrada. Al cerrar se imprime la hoja de ventas del día, agrupada por producto y sin series.

**E4 — liberado por autorización del propietario del 2026-09-23:**
`reports/e4-liberacion-20260923/autorizacion.txt`; `E4_CASH_OUT_ENABLED=true` en API/UI.
SUPERVISOR/CAJA capturan extraordinarias en su propia tienda y ADMIN puede
capturar en tiendas autorizadas, con motivo, sesión abierta y caja física;
Coco/Cruces no usan Fondo. La clasificación EXTRAORDINARIA/PROVEEDOR es explícita:
proveedor exige proveedor activo y exclusivamente Mariana, nunca se deduce por
proveedor vacío. La salida registrada descuenta inmediatamente el corte usando
el egreso existente; no espera revisión. ADMIN acepta/reclama; SUPERVISOR de la
tienda responde al reclamo con explicación obligatoria y comprobante opcional
(enlace HTTPS a documento disponible). Responder no autoacepta. Revisión,
aceptación y reclamo no alteran importes, incluso con sesión cerrada. UUID por
intención, candados transaccionales, versión de revisión y auditoría atómica
evitan duplicados/reintentos divergentes. ON, la captura/listado y catálogo
mínimo usan `cobros_pagos` (ver/crear según acción), para no exigir permisos
administrativos de cortes a CAJA; OFF conserva sus permisos anteriores.
La revisión mantiene `cortes/ver` más autoridad/alcance del dominio.
No se conceden filas ni permisos nuevos. Los históricos no se reclasifican.
El SQL E4 de `reports/tanda-b-20260922/e4/` ya fue instalado en la liberación
simple anterior; esta apertura no agrega ni repite SQL en la base API.
La comprobación canónica de saldo es obligatoria en E4 e independiente de E12,
bajo candado de sesión. Insuficiencia bloquea; únicamente ADMIN puede desbloquear
una extraordinaria con motivo obligatorio y evidencia durable de actor, fecha,
saldo anterior y egreso. La revisión posterior conserva esa evidencia.
Proveedor es exclusivamente Mariana y caja física, sin desbloqueo, limitado
por efectivo y deuda; registra pago real y salida en una sola transacción.
No habilita E12, pagos partidos, Fondo, inventario, ni amplía los 69 vetos.

**Historial de compras:** vive en una **pestaña dentro de Proveedores**, no en la barra lateral. Muestra **un renglón por línea de entrada** —por producto, no por rollo—: una entrada de 750 rollos en dos productos son dos renglones. Solo existe para proveedores; a los clientes se les vende, no se les compra.

Ordena por fecha de más reciente a más antigua por omisión, y cada columna alterna entre ascendente y descendente **sin un tercer estado**, porque "sin orden" no se distingue visualmente del predeterminado.

Cada cantidad se muestra **con su unidad** y la tabla **no lleva renglón de totales**: sumar esa columna mezclaría metros con kilos. Al ordenar por cantidad se usa el valor numérico y se conserva la unidad visible; no existe ninguna equivalencia entre unidades y no se inventa una para ordenar.

**Dos clases de evento en el feed:** los **guardados** —`notificaciones_sistema`, `notificaciones_credito`— tienen `leidaAt` y se marcan como leídos. Los **derivados** —alertas de administración, solicitudes de pago dirigido, tickets sin cobrar— se calculan en vivo y **no tienen estado de lectura**: desaparecen cuando la condición que los genera deja de cumplirse. No se les agrega estado de lectura ni tabla de descartes; si un derivado no se va, la condición está mal definida.

**Toda alerta necesita una condición de riesgo.** La alerta de crédito no la tenía: filtraba por tipo de movimiento y convertía **cada venta a crédito en un aviso permanente**. Una alerta sin condición es un listado disfrazado, y en operación real llena el panel hasta que nadie lo mira.

**El globo y el panel cuentan lo mismo.** Contar solo las guardadas en el globo mientras el panel muestra guardadas y derivadas produce dos números que no miden lo mismo, y el usuario no sabe a cuál creerle.

**Marcar como leídas nunca borra.** Las notificaciones guardadas siguen consultables, conforme a la regla de que las tablas operativas no usan DELETE. El botón se rotula por lo que hace y no como "limpiar", que promete que desaparecen. Las dos tablas tienen **ids independientes que pueden colisionar**: cualquier ruta que marque una notificación por id debe distinguir de qué tabla es, o marcará la equivocada.

## Utilidad y explicaciones estadísticas

**Utilidad contra margen:** todo **importe** que represente ganancia se llama **Utilidad**. Los **porcentajes** siguen siendo margen. La utilidad es una cantidad de dinero y el margen una razón; llamarle utilidad a un porcentaje deja al usuario sin saber si lee pesos o por ciento.

**La tarjeta de utilidad por cliente arranca oculta en cada carga.** El ojo existe porque el cliente puede estar viendo la pantalla, y recordar el estado entre sesiones la dejaría destapada justo en ese momento. El ojo es **solo visual**: la cifra viaja al navegador. Restringir quién conoce la utilidad se hace en el servidor, no con el ojo.

**La utilidad excluye las líneas sin costo asignado**, así que queda por debajo de la real. Toda pantalla que muestre utilidad declara cuántas líneas quedaron fuera, incluso cuando son cero: saber que la cifra está completa vale tanto como la cifra.

**Las oraciones que explican una gráfica se escriben leyendo la consulta que la alimenta, nunca el título.** Una oración deducida del rótulo le da al usuario una confianza que el dato no respalda. Si el título y la consulta no coinciden, la oración describe la consulta y la discrepancia se reporta.

## Duración de sesiones

**Duración de sesión:** inactividad de **8 horas**, tope absoluto de **16 horas**. Ocho horas cubren un turno completo sin obligar a volver a entrar por una hora tranquila, y la sesión muere sola durante la noche. Dieciséis horas evitan que un turno se corte a la mitad. El **tope absoluto no se renueva con actividad**: es el límite duro y no debe volverse deslizante.

El `maxAge` de la galleta se mantiene igual al tope absoluto; si se separan, la galleta sobrevive a la sesión del servidor y el usuario ve errores en vez de una petición limpia de volver a entrar.

**Duraciones por rol y bloqueo con PIN quedan fuera a propósito.** El PIN es la solución correcta a la fricción de teclear una contraseña larga en una pantalla táctil, pero es desarrollo; alargar la sesión es el arreglo intermedio.

## Semántica de compras y alcance

**Fecha de compra** significa la fecha inmutable de recepción guardada en `entradas.fecha`. Las filas `COMPRA` se filtran y presentan con esa fecha; pagos, ajustes y reversos conservan su propia fecha contable en el ledger.

**Alcance de lectura de compras y reportes:** siempre se deriva del actor con `resolveReadScope`, antes de aplicar cualquier filtro. Un usuario `PROPIA` no puede ampliar el sitio desde la dirección ni entrando directamente a un detalle; el sitio solicitado por el cliente nunca sustituye al alcance autorizado.

**Filtros de producto:** se filtra por **Tela y Color por separado**, nunca por "Producto" y "Color" como filtros independientes. El producto **es** la pareja tela-color, con restricción de unicidad sobre ella; ofrecerlos como filtros distintos hace que Producto "Tafetán Blanco" con Color "Azul" devuelva siempre cero renglones. Tela y Color separados permiten "todos los colores de Tafetán" y "todo lo blanco, de cualquier tela".

**Cómo combinan:** los valores **dentro** de un filtro se suman, los filtros **entre sí** se cruzan, y un filtro vacío no restringe. **No existe un armador de consultas genérico** —sin condiciones anidadas, operadores elegibles ni paréntesis— y no debe construirse: nadie en el mostrador lo usa y es caro de mantener.

**Un solo componente de filtros y un solo criterio de consulta** para Historial de compras y Reportes. Construirlos por separado produce dos filtros que se comportan distinto ante el mismo caso.

**Los filtros viven en la dirección web**, para poder compartir una vista filtrada, guardarla como favorito y no perderla al volver de un detalle. Una dirección con un filtro inexistente lo ignora y avisa; nunca rompe la pantalla. El alcance de lectura por sitio se aplica siempre por encima de cualquier filtro, incluso escrito a mano en la dirección.

**Encabezado de la Nota:** los campos opcionales vacíos —destinatario, dirección, contacto— **no se imprimen** y la rejilla se reacomoda. Cliente, folio y fecha de venta siempre aparecen. **Ninguna dirección de Mariana Textil se imprime en la Nota**, ni de matriz ni de sucursales.

**Toda Nota lleva pagaré porque Nota implica crédito siempre.** El texto se reproduce **carácter por carácter** y **no menciona lugar de pago**, en coherencia con la decisión de no imprimir domicilios.

**La fecha de pago se imprime en la nota a crédito**, junto con los días de plazo, tomada de `fechaVencimiento` sin recalcular. El pagaré remite a esa fecha: si no está impresa, la referencia queda vacía.

**Días de plazo:** viven en el perfil del cliente con los valores 7, 15, 30 y 60. Al generar una nota se precargan y se pueden cambiar para esa venta; cambiarlos ahí **no** modifica el perfil. Un cliente sin plazo obliga a elegirlo, sin valor por omisión.

**El renglón de IVA solo aparece en ventas facturadas.** Un impuesto en cero junto a un subtotal igual al total se contradice a sí mismo en un documento que el cliente firma.

## Caja en Tiempo Real

El orden vigente de los bloques de Tiempo real, también en pantallas estrechas, es **Ventas → Señales operativas → Cobranza → Estado por Tienda**. Las filas de ventas y señales permanecen juntas porque son las dos que se consultan de un vistazo durante el día; intercalar cobranza las separaría. La cobranza es una banda independiente y no forma parte de la identidad de ventas. Las cuatro tarjetas de ventas conservan el orden **Ventas (Total) → Contado cobrado → Ventas a crédito → Utilidad**. La fila de señales conserva **Ventas pendientes de cobro o autorización → Salidas en tránsito → Tickets cancelados → Salidas canceladas**. El criterio es **en curso antes que cancelado**: primero las dos tarjetas de reloj (ámbar cuando tienen contenido), después las dos de cancelación (rojo cuando tienen contenido). Las señales mantienen menor jerarquía visual que las cifras financieras. En pantallas estrechas se conserva también el orden interno de cada fila.

La tarjeta de pendientes cuenta tanto tickets vendidos sin cobrar como notas vendidas sin autorizar. Permanece fuera de Ventas hasta que Caja procese el documento. La alerta de 30 minutos se calcula solo para tickets: un ticket sin cobrar media hora después es un problema de mostrador, mientras una Nota sin autorizar no comparte esa urgencia y su vencimiento se vigila en Cartera. El texto secundario distingue cuántos tickets y cuántas notas están esperando.

**Contado cobrado**, **Ventas a crédito** y las cuatro tarjetas operativas son clicables y conservan sus desgloses de documentos. Toda cifra del tablero con detalle debe conciliar con él: con igual periodo y sitio, el conteo debe coincidir a través de todas las páginas y el importe debe coincidir para las tarjetas que lo muestran. Los identificadores internos COBRADO, CREDITO, PENDIENTE y CANCELADAS no cambian; SALIDAS_EN_TRANSITO y SALIDAS_CANCELADAS concilian solo conteo. La nueva cobranza abre el detalle canónico de Cuentas Destino, no el desglose interno COBRADO. Deben compartir selección, fecha, sitio y fuente monetaria; copiar un predicado no basta. Los detalles de Salidas conservan sus filas y enlaces propios. La respuesta del servidor no envía costo, utilidad ni margen al cliente.

**Ventas (Total)** no es clicable porque ya es exactamente la suma de Contado cobrado y Ventas a crédito, no de la cobranza del periodo y crédito. **Utilidad** tampoco es clicable porque tiene reglas propias de ocultamiento y líneas sin costo que requieren un desglose independiente. Estas excepciones existentes no se amplían ni se cambian.

**Exclusión explícita de conciliación:** Ventas (Total) y Utilidad no tienen detalle propio. No inventarles una prueba de conciliación tarjeta/detalle ni un desglose para llenar una supuesta falta de cobertura. Sus pruebas financieras independientes no sustituyen ni crean ese detalle.

**Un ticket cancelado es una venta que no ocurrió.** No suma ni resta de Ventas, Cobrado, Ventas a crédito o Utilidad, y queda fuera de todas las identidades financieras del tablero. Su tarjeta muestra primero el conteo y después el importe; abre un desglose que cuadra al centavo y expone folio, importe, quién canceló, cuándo y motivo.

**Una cancelación se fecha por cuándo se canceló, nunca por la fecha financiera del documento, porque un documento cancelado puede no tener fecha financiera.** El criterio compartido de cancelaciones usa estado CANCELADO, fecha de cancelación, sitio e importe en los cuatro lugares: tarjeta, detalle, numerador de la tasa y resumen por tienda. No ampliar el predicado financiero de ventas para incluir cancelados. La tasa conserva la fórmula cancelaciones / (documentos contabilizados + cancelaciones): con cancelaciones y cero ventas es 100%, con ambos conteos en cero es 0%. Siempre se muestra, incluso cuando no hay documentos contabilizados.

**Las Salidas en tránsito y canceladas son señales operativas, no identidades financieras.** Sus tarjetas muestran únicamente el conteo singularizado (por ejemplo, “3 salidas” o “1 salida”), nunca un importe monetario. Un traslado es mercancía propia cambiando de lugar, no una venta: valuarlo a precio de lista produce un importe que no existe en la contabilidad y, junto a Ventas y Cobrado, invita a una comparación financiera incorrecta. Estas tarjetas responden cuántos documentos están en esa condición, no cuánto valen; no agregarles importe como si faltara información. Ninguna suma ni resta de Ventas, Cobrado, Ventas a crédito o Utilidad. Los detalles de ambas conservan los importes por renglón para investigar documentos concretos. Tickets cancelados conserva conteo e importe tanto en tarjeta como en detalle: el tamaño de una cancelación sí es una señal de control, aunque no sea una venta.

El ámbar de **Ventas pendientes de cobro o autorización** y **Salidas en tránsito** significa **“sigue en curso y requiere atención”**. El rojo de **Tickets cancelados** y **Salidas canceladas** significa **“revisa esto”**, no error: cancelar es una operación legítima, pero merece visibilidad porque puede señalar una merma o una cancelación extraordinaria. Ambas tarjetas usan el mismo tono rojo suave. Superar el umbral estricto del 10% mantiene la alerta `CANCELACIONES_ALTAS`, pero no intensifica el color de Tickets cancelados.

**Decisión cerrada del propietario — encendido de las tarjetas operativas de Tiempo real.** En este tablero el color indica que hay algo que atender, no una categoría. Las cuatro tarjetas operativas se muestran con fondo neutro y borde suave, como las principales, cuando su conteo e importe son cero. Si alguno es distinto de cero, se encienden con pastel suave: ámbar para pendientes y tránsito, rojo para cancelaciones. Así un documento con importe cero también recibe atención. Tickets cancelados usa exactamente la misma paleta que Salidas canceladas, sin fondo reforzado, anillo oscuro ni franja adicional por la tasa. Su jerarquía secundaria se establece por menor altura y tamaño de cifra. Mantener títulos y cifras legibles en teléfono y favorecer contraste alto para las pantallas de tienda con mucha luz; una simulación visual no sustituye una comprobación física bajo la iluminación de Cruces.

Un ticket cancelado se marca de forma inequívoca en sus tres representaciones: la pantalla abre con una banda roja que muestra quién canceló, cuándo y el motivo; cada copia térmica repite una marca grande al principio y al final con usuario y fecha; la Nota A5 conserva su sello diagonal rojo, rotado y enmarcado.

**Cambio del 2026-09-08:** se separaron las tarjetas financieras y operativas, se añadió la tarjeta y el desglose de tickets cancelados, y se reforzó el marcado en pantalla y en las tres copias térmicas sin modificar el sello A5.

**Cambio del 2026-09-09:** se unificó la normalización de QR en las tres rutas de escaneo, se centralizó la presentación y frescura de los cinco estados reales de Salidas, y se añadieron Salidas en tránsito y Salidas canceladas a la segunda fila compacta de Tiempo Real con desgloses propios y sin alterar identidades financieras.

**El plazo de crédito se elige en POS**, al crear la venta, no en el diálogo de cobro: la caja no tiene impresora y la nota con el pagaré se imprime desde el POS. Se precarga de `clientes.diasCredito` y se puede cambiar para esa venta sin modificar el perfil. Un cliente sin plazo obliga a elegirlo.

**El límite de crédito es duro.** Debajo procede, arriba se rechaza, **sin excepción**: no existe autorización de ADMIN, ni aprobación remota, ni override posterior. Un límite que se puede saltar no es un límite. El cajero ve el crédito disponible al seleccionar al cliente, y el rechazo dice cuánto hay y cuánto falta, en vez de un "no se puede" genérico.

**La notificación de venta a crédito es guardada**, no derivada: una venta es un hecho ocurrido, no una condición vigente, y como alerta derivada se quedaría para siempre.

**Escaneo en POS:** un rollo escaneado que se identifica sin ambigüedad **se agrega al carrito directamente**, con el mismo criterio de Salidas: la serie manda y la discrepancia de SKU avisa sin bloquear. No se agrega nada cuando el escaneo devuelve varios resultados, ni cuando el rollo no está disponible, es de otro sitio o ya está en el carrito; esos casos se rechazan con aviso, porque un rechazo silencioso produce un ticket con menos rollos de los que se lleva el cliente. El tecleo manual sigue mostrando resultados para elegir.

**Renglones agrupados:** los rollos del mismo producto forman **un solo renglón** con su conteo y cantidad total, y el precio se captura una vez para todos. Agrupar por tela mezclaría colores y unidades y está prohibido.

La agrupación es **presentación y captura de precio**: el renglón conserva por debajo las series de sus rollos, y el ticket sigue registrando línea por rollo, con descuento de inventario y costo congelado individuales. Si un cambio de presentación toca cómo se registra la venta, está mal planteado.

**Procesamiento contable de Ticket y Nota:** un Ticket pendiente no genera Ventas, Contado cobrado ni Utilidad; cuando Caja lo cobra, entra simultáneamente en los tres, también cuando la venta está facturada. Una Nota pendiente tampoco genera Ventas, Ventas a crédito ni Utilidad; al autorizarse entra en esos tres conceptos, no en Contado cobrado. Los abonos posteriores reducen cartera y participan en la cobranza según la fuente de Cuentas Destino, pero no vuelven a contar la venta ni disminuyen la venta a crédito histórica del periodo. La identidad permanece **Ventas = Contado + Ventas a crédito**; Contado cobrado es su etiqueta de presentación.

**El orden de las tiendas es Mariana, Coco, Cruces**, y vive en un solo lugar compartido por todas las vistas. Repetirlo por componente hace que una vista quede desincronizada de las demás. Una tienda nueva nunca desaparece de una lista por no estar en el orden.

**La vista de ventas por tienda** aplica `resolveReadScope` siempre: un usuario con alcance PROPIA no ve otra tienda ni manipulando la dirección. La utilidad no se envía al cliente cuando el rol no debe verla; taparla solo en pantalla no es una restricción.

**Ventas por tienda** tiene dos pestañas: **Global** —agrupada por tela, desplegable por color— y **Detalle**, el listado de tickets. Global es la pestaña por omisión. Los filtros de fecha son compartidos: dos pestañas que muestren periodos distintos hacen que el usuario deje de confiar en los dos números.

El filtro de forma de pago pertenece solo a **Detalle**. Al entrar a Global se limpia junto con la página de Detalle, conservando las fechas; así Global siempre representa todas las ventas del periodo y al volver a Detalle no queda un subconjunto oculto que contradiga el total.

Agrupar "por producto y por color" sería una sola agrupación, porque **el producto es la pareja tela-color**. La jerarquía tela → color contesta cuánto se movió de cada tela y qué colores dentro de ella.

**Rollos y metraje nunca comparten un mismo margen**, aquí como en el resto de los reportes: se costean distinto —costo exacto del rollo contra promedio de 12 meses congelado— y sumarlos produce un número que no significa nada. En Ventas por tienda se presentan en columnas de utilidad separadas y las cantidades se distinguen por modalidad y unidad.

**El total de Global debe cuadrar siempre con la suma de Detalle** en el mismo periodo. Es la prueba objetiva de que las dos pestañas leen lo mismo. El total bruto de cada ticket se distribuye a centavos entre sus líneas para conservar también el IVA.

Las **ventas a crédito cuentan** como ventas y los **cancelados no**. La utilidad excluye las líneas sin costo, así que toda vista que la muestre declara cuántas quedaron fuera, incluso cuando son cero. Si ninguna línea de una modalidad tiene costo conocido, la utilidad se presenta como **Pendiente**, nunca como cero.

**Devoluciones y notas de crédito de producto:** el modelo actual no tiene líneas de devolución ni una nota de crédito que reste cantidades e importes por producto; `NOTA` es un tipo documental de venta. Ventas por tienda no inventa una resta sin un movimiento trazable.

`DEVOLUCION` existe en `tipoMovimientoEnum` de `lib/db/src/schema/enums.ts` y como etiqueta/color en `artifacts/mariana-textil/src/pages/movimientos.tsx`. **No quedó comprobado un flujo productivo que lo genere** en este barrido; la presencia en el enum no acredita una ruta operativa ni una prueba de devolución ejecutada.

**SUPERVISOR y Ventas por tienda:** `resumen_caja` se resuelve desde los permisos configurados, sin un techo adicional por rol. La omisión recursiva existente de campos de utilidad/costo y los controles explícitos del endpoint son comprobaciones independientes, reportadas para revisión; no se modifican al retirar el techo ni se reescriben los permisos guardados.

## Formatos de impresión

**Formatos de impresión.** Los cuatro formatos vigentes son: Entrada carta vertical 216 × 279 mm, Salida A5 horizontal 210 × 148 mm, Nota A5 vertical 148 × 210 mm y Ticket térmico de 80 mm. Entrada y Nota usan papel blanco a color; Salida usa papel **de color distinto por sitio** y diseño a color. No existe Nota de contado.

Se eligió **A5 y no media carta** porque las bandejas de las impresoras láser admiten A5 en cajón; media carta solo entra por alimentación manual, hoja por hoja, lo que es inviable en un mostrador, y quedó eliminada del software. No son el mismo tamaño: A5 es 148 × 210 mm y media carta 140 × 216 mm.

El respaldo cuando falla la impresora térmica consiste en mandar el mismo Ticket de 80 mm a otra impresora desde el diálogo del navegador. No existe ni debe crearse un segundo diseño en papel para ese respaldo.

### Diagnóstico de impresoras de tienda: Epson y Wasp

**Si una tienda reporta una hoja de más o una etiqueta partida, comprobar el controlador y el tamaño de papel sin descartar el código.** Verificar el tamaño configurado tanto en el controlador como en el diálogo de impresión, los márgenes y la escala. Comparar el mismo documento con Microsoft Print to PDF usando el mismo tamaño y márgenes. Si el desplazamiento también aparece en PDF, investigar la composición imprimible, los contenedores montados y los saltos de página; no atribuirlo al controlador sin evidencia.

**Diagnóstico corregido el 2026-09-13 — etiquetas de Entradas:** el usuario confirmó espacio en blanco sobre la primera etiqueta tanto con Microsoft Print to PDF como con Wasp WPL308; las siguientes empiezan alineadas arriba. Queda retirada la atribución anterior exclusiva al controlador. Investigar espacio previo a la primera etiqueta y la activación de contenedores imprimibles ajenos, no asumir que el contenido excede los 70 mm.

**Conservar la prueba automatizada de etiquetas:** debe exigir tantas páginas como etiquetas y comprobar los campos completos de cada etiqueta en su página, sin páginas adicionales iniciales o finales. También debe comparar la coordenada vertical inicial del contenido de la primera página con las demás: el conteo puede pasar aunque la primera etiqueta esté desplazada. Probar el flujo de etiquetas de Entradas y el aislamiento del contenedor activo cuando existen otros contenedores montados. Que pase en Chromium/PDF no certifica el comportamiento de un controlador físico.

**Reproducción del 2026-09-15 — detenida sin corrección:** los casos mínimos y paginados de Entrada, Salida y Etiquetas no reprodujeron la hoja inicial blanca ni el desplazamiento en Chromium/PDF al 100 %, sin márgenes adicionales. Evidencia por página: `reports/prompt-e/block-0-report.md` y `measurements.json`. Esto no invalida el reporte de tienda ni demuestra una causa de controlador, papel o CSS. Se conservó el código sin cambios; la hipótesis de cajas ocultas con altura sigue sin demostrarse. No hay aprobación global: las etiquetas alcanzan los bordes con tinta, incumpliendo el criterio solicitado de 5 mm, y un caso adicional de Entrada encontró 5 páginas DOM frente a 4 esperadas por el fixture, antes de generar PDF. La prueba existente de Etiquetas sí compara coordenadas verticales; las de Entrada/Salida no tienen esa aserción equivalente. No se extendieron al detenerse en el Bloque 0. La comprobación física en Wasp WPL308 y láser sigue pendiente.

**Los documentos no se diseñan para monocromático.** El color lo aporta el papel de la bandeja y la impresora convierte a grises por su cuenta. Un logo azul impreso en negro se ve bien; un logo dibujado en gris plano se ve mal en color y en negro. La Salida conserva su diseño a color aunque se imprima en monocromático sobre papel de color.

**El QR de la Salida lleva recuadro blanco detrás.** Sobre papel de color el contraste puede caer y el código deja de leerse; si el QR no escanea, se rompe el flujo de recepción. Es una regla operativa, no estética, y aplica a cualquier color de papel presente o futuro.

**Margen físico incorporado al diseño:** Entrada carta, Salida A5 horizontal y Nota A5 vertical reservan 5.25 mm dentro de las dimensiones de la hoja, para garantizar al menos 5 mm sin tinta incluso con bordes de tabla colapsados y redondeo de rasterización. La hoja de viaje conserva su separación interior de 14 mm. No resolver el margen aumentando el tamaño de papel, recortando contenido ni trasladando totales o firmas a una hoja adicional. Las pruebas PDF usan escala 100%, sin márgenes adicionales del diálogo, y comprueban las cuatro bandas de seguridad incluyendo líneas, fondos, logo y QR.

**Los renglones por hoja son independientes por documento:** cada constante debe llevar comentada la medida real en impresión, incluyendo encabezado, tabla, totales y pie. La declaración productiva `SALIDA_PRODUCT_ROWS_PER_PAGE = 10` en `artifacts/mariana-textil/src/pages/salida-documento.tsx` pagina once productos como diez más uno. Esto comprueba la división en código, no vuelve a acreditar margen, legibilidad o número final de hojas de un PDF. La Nota debe conservar su pagaré legible. Revalidar Entrada y Nota al cambiar dimensiones o reservas. El Ticket de contado usa tira térmica de 80 mm, no capacidad A5.

**Capacidades comprobadas estáticamente:** `NOTE_PRODUCT_ROWS_PER_PAGE = 8` en `artifacts/mariana-textil/src/pages/ticket-detail.tsx`; `rowsPerPage = 10` en `artifacts/mariana-textil/src/pages/entrada-documento.tsx`. **Las veintidós filas de series de Entrada quedan no comprobadas en esta auditoría**: no se localizó su declaración productiva y no se ejecutó PDF. La cifra 23 de un fixture no la sustituye. Las observaciones históricas de márgenes, filas de 54 px y reserva del pie no equivalen a una verificación nueva.

**Captura de importes:** los campos de monto usan `type="text"` con `inputMode="decimal"`, no `type="number"`, porque este último **no admite comas** y deja al usuario capturando cifras largas sin separador. El separador de miles aparece **mientras se escribe**, en formato mexicano —coma para miles, punto para decimales—, y **el cursor no salta** al insertarlo. El separador es presentación y se retira antes de enviar: el servidor recibe el mismo valor de siempre. El comportamiento vive en un solo componente compartido.

Todo documento dibuja su capacidad completa con renglones cerrados y perímetro negro. Las hojas adicionales repiten encabezado y pie, conservan numeración continua y nunca desbordan. El pagaré usa 10 px (7.5 pt) con interlineado de 12 px (9 pt), conserva su texto literal y aparece solo en la última hoja de cada copia de crédito.

**Un renglón de producto es indivisible**: o cabe entero en la hoja o pasa completo a la siguiente, nunca se parte a la mitad. En los documentos impresos por hoja, los renglones se miden contando el renglón completo más todo lo que va debajo de la tabla —totales, leyenda y firma—; cada formato tiene su propia capacidad.

## Stock mínimo y reporte «Qué comprar»

**Ubicación en el menú:** Stock mínimo vive al final de INVENTARIO, después de Precios, porque es configuración y no operación diaria. Orden: Productos → Inventario → Vista Global → Ajustes → Auditorías → Etiquetas → Precios → Stock mínimo. El orden no cambia permisos ni rutas.

**2026-09-12:** Stock mínimo movido al final de INVENTARIO; comprobados el typecheck completo incluido `scripts`, codegen sin diferencias y las dos suites revisadas con aprovisionamiento automático de `TEST_DATABASE_URL`. Sin cambios de reglas de negocio ni cálculos de tableros.

**Estado al 2026-09-11:** corregidos con autorización los hallazgos de historia, periodo, evidencia, enlaces y notificaciones; verificados con pruebas sin DB y navegador con API simulada. La reconstrucción real del caché se ejecutó en PostgreSQL local desechable: los 2 mínimos y las 2 configuraciones de sitio conservaron conteos y valores mientras se corrigieron las 4 existencias de prueba. La entrega real de alertas y la concurrencia siguen pendientes; no presentarlas como realizadas. Evidencia: `reports/reconstruir-cache-existencias-disposable-evidence.md`.

- El mínimo es configuración **por producto y ubicación**, en `stock_minimos`, con cantidad, autor y fecha. Nunca se guarda en `existencias`: ese caché se reconstruye desde los movimientos y no puede ser propietario de configuración.
- La función se activa **por sitio**, apagada por omisión. Regla obligatoria: apagada no calcula faltantes, no alerta, no muestra análisis ni modifica productos de ese sitio. La captura usa el selector del encabezado, sin un selector de sitio paralelo. El servidor rechaza capturas directas de mínimos con el sitio apagado antes de consultar productos o escribir configuración/auditoría.
- El mínimo es **opcional por producto**. Vacío significa sin mínimo; no genera alerta. Una existencia estrictamente menor al mínimo abre un episodio; no se repite la notificación mientras siga el mismo episodio. La entrega y concurrencia reales todavía requieren verificación.
- Los destinatarios solicitados son **todos los usuarios activos asignados al sitio, además de ADMIN y SUPERVISOR**, sin duplicar destinatarios. «Encargado» no es un campo ni un rol especial. **Pendiente de decisión futura:** si se requiere designar un responsable por sitio, deberá autorizarse como un campo nuevo; no se implementa en este trabajo.
- El consumo por sitio es **ventas más salidas**, incluidos los traslados en el origen. **No se suma entre sitios**, porque un traslado y su venta posterior contarían dos veces la misma cantidad. Para compras se usa la **venta real al cliente**, distinta del consumo: movimientos VENTA con documento de venta acreditado; SALIDA_MOSTRADOR por sí sola acredita salida física, no una venta al cliente.
- Las sugerencias dependen de **una sola constante**, `HISTORY_MIN_MONTHS`, hoy **3 meses**: con menos historia una semana atípica puede distorsionar la interpretación. El umbral es por renglón. Consumo, venta, existencia, mínimo y cobertura son mediciones y no esperan al umbral. La historia comienza en la primera observación del par, incluidas recepciones, aunque nunca haya salido mercancía; los meses se evalúan en el calendario de Ciudad de México.
- Reporte y evidencia usan el mismo historial hasta la fecha final. El conteo de caídas bajo mínimo incluye **aperturas en el periodo**, no episodios antiguos que siguen abiertos; estos se presentan aparte, sin sumarlos. La conciliación contrasta las cifras de la fila con los movimientos, no dos sumas idénticas de un mismo resultado.
- La causa de un episodio distingue configuración, cruce demostrado por un movimiento y observación sin causa demostrable. Un cambio de mínimo solo se atribuye al producto editado; habilitar el sitio puede atribuirse a su configuración general. No inventar un movimiento desencadenante para episodios históricos sin evidencia.
- Las sugerencias deben ser **hechos observados**, con acceso a sus movimientos y cálculo verificable. No se suponen plazos de reposición: no existen de forma general en el sistema; los contenedores tienen fecha de pedido, pero muchas compras entran sin ella. No convertir un faltante medido en una orden o proyección inventada.
- **Traslado anterior de Mes × color:** ese cambio retiró únicamente el mapa desde Mapas de Calor para mostrarlo en Qué comprar, sin retirar tablas ni pestañas. La reorganización posterior aprobada se documenta en «Reportes por decisión»; su implementación aún no supera la verificación.
- **2026-09-11:** se implementaron configuración separada, migración aditiva, evaluación periódica y avisos en el sistema existente, pantalla de mínimos, reporte mensual y consulta de evidencia; se corrigieron los hallazgos con autorización. Las pruebas reales no ejecutadas se detallan en `docs/stock-minimos-verificacion.md`.

## Higiene de la documentación

- Este archivo se deriva del código en rutas, conteos y roles. Toda **ruta API** citada debe existir textualmente en `lib/api-spec/openapi.yaml`, sin confundir el prefijo de transporte `/api` con una clave de `paths`. Las rutas de navegación de la interfaz se comprueban en su router; no son endpoints OpenAPI. Una ruta ausente del contrato se marca como no comprobada o divergente, nunca se inventa para hacer coincidir la documentación.
- Al citar código, usar **archivo y nombre de función**, no número de línea. Si el fragmento no pertenece a una función nombrada, identificar el handler o declaración; solo si hace falta citar líneas, acompañarlas del fragmento exacto. Las ubicaciones numéricas del barrido quedan en el reporte de esa revisión, no como referencias estables de este documento.
- Ninguna regla de validación se escribe contra un conteo fijo de productos: los conteos caducan en la siguiente importación y dejan la validación falsamente aprobada.
- Toda lista de roles escrita aquí debe cotejarse contra `rolUsuarioEnum` antes de darse por completa.
- **Limpieza del 2026-09-06:** se corrigieron rutas de Entradas y Productos, el formato A5 de Salida, la documentación de TERMINAL, los conteos caducos, CREDITO y DEVOLUCION, y las reglas vigentes de impresión, POS/Caja y Caja en Tiempo Real.

**Auditoría documental del 2026-09-15:** alcance y correcciones en `reports/prompt-a-resultado.md`; tabla del documento inicial en `reports/prompt-a-verificabilidad.md`, ampliada con comprobaciones complementarias y conservación de archivos. Los resultados antiguos de pruebas, migraciones, purgas, datos, dispositivos y procesos de este documento son **históricos, no reejecutados**. La existencia de un archivo acredita solo su existencia; las afirmaciones que requieren ejecución o cuya fuente no se localizó quedan expresamente no comprobadas. No se usó la auditoría para modificar la aplicación ni la base.

### Verificaciones parciales y verdes falsos

- Un comando de verificación que se detiene en el primer fallo produce un resultado **parcial que puede leerse como total**. Todo verificador del proyecto debe recorrer todos los paquetes de su alcance y reportar el total aunque alguno falle; un fallo de librerías tampoco debe impedir comprobar artefactos y scripts. Conservar código de salida no cero, distinguir fallos de ejecución de diagnósticos y deduplicar errores repetidos sin ocultar en qué paquetes se emitieron. No marcar PASS un paquete cuya ejecución no quedó acreditada. Esto no autoriza operaciones fuera del alcance: la barrera de `build` sigue impidiendo compilar si falla `typecheck`; una vez pasada, las compilaciones recursivas tampoco abortan al primer fallo.
- Un `exitCode=0` no convierte en PASS una preparación, restauración o limpieza cuyo error fue absorbido. Registrar el fallo y el alcance que sí se comprobó, sin alterar protecciones de la base para obtener un verde.
- Una prueba con respuestas interceptadas, un render SSR o una captura de login no acreditan el recorrido real autenticado. Un resultado histórico citado conserva su fecha, fuente y límites; leer su reporte no equivale a ejecutar nuevamente la verificación.

**Prompt B — 2026-09-15: deuda de tipos en cero.** El conteo histórico de «dos errores conocidos» era incompleto: la ejecución íntegra confirmó **cuatro errores únicos** (seis emisiones porque scripts repite los dos de API). Después de corregirlos, `pnpm run typecheck` completo registra **cero**:

- POS: eliminada la rama `Date/toISOString` inalcanzable sobre un vencimiento ya normalizado como `string | null`; no cambió fecha, estado ni respuesta.
- Excel de Estado de cuenta: eliminada la primera propiedad `saldoPendiente`, sobrescrita por la segunda. Se conservó la definición final numérica mediante `toExcelNumber`; el contenido efectivo del objeto exportado es idéntico.
- Alertas: los dos accesos al campo inexistente `pendiente` usan ahora `importe`, que el productor ya entrega como saldo vigente. El importe visible deja de ser «—»; el badge conserva su estado y presentación porque no utiliza esa propiedad para renderizar.

Evidencia, diagnóstico escrito antes de editar y salidas completas en `reports/prompt-b-resultado.md` y `reports/prompt-b-diagnostico-previo.md`. No se alteraron saldos, vetos históricos, contratos generados ni el Bloque 5 financiero. El manifiesto focal conservó **88 aprobadas y los mismos 5 fallos previos de 93 casos**, sin repararlos ni extender ese resultado a toda la suite.

**Prevención pendiente de decisión:** el build raíz ya impone el typecheck corregido y hay pruebas del orquestador, pero no se encontró CI ni hook que obligue a ejecutarlo antes de integrar cambios. Se recomienda un chequeo obligatorio de CI que ejecute `pnpm run typecheck` y las pruebas del orquestador y bloquee la integración si falla. No se creó CI/hook sin autorización; `scripts/post-merge.sh` no ejecuta typecheck y no se ejecutó ni modificó.

### Autorización de escrituras financieras

**Antes de la primera escritura financiera debe guardarse en `reports/` la autorización textual original del propietario y el alcance preciso que ampara.** No bastan un resumen de conversación, contexto heredado, un plan o un reporte redactado por el agente que diga «autorizado». La existencia de credenciales tampoco acredita autorización. Si falta esa evidencia, no se ejecuta la escritura.

La narración de las operaciones 47–50 del 15 de septiembre en `reports/abonos-fifo-2026-09-15-plan-bloque-4.md` no contiene por sí sola la cita textual original: se conserva como relato de lo ejecutado, **no como prueba de autorización**. La existencia y procedencia del mensaje original quedan por acreditar; esta revisión no reconstruye una autorización ni autoriza repetir, revertir o modificar esas operaciones.

## Ventas y cobranza: nombres distintos, atribución pendiente

**Nomenclatura decidida en E6.** Ventas y cobranza son mediciones distintas; no se unifican sus cálculos. La identidad canónica es **Ventas = Contado + Ventas a crédito**:

- **Contado cobrado** presenta los tickets cobrados por caja. En `artifacts/api-server/src/lib/admin-analytics.ts`, `getSalesSummary` usa `collectedTicketPredicate` para contado y no suma los abonos del libro de crédito a esa tarjeta.
- **Cobranza del periodo** presenta contado más abonos a notas y saldos a favor recibidos, netos de reversos. `destinationReadModel` incluye las ramas del libro y `getDestinationAccounts` construye el encabezado. `useSharedCuentasDestino`, en `artifacts/mariana-textil/src/hooks/use-shared-cuentas-destino.ts`, conserva la fuente compartida de esa pantalla y la banda del tablero. Los cobros nuevos pendientes de aplicación pertenecen a E7; E6 no los añade.

Ambas mediciones siguen implementadas. Un abono no constituye una venta nueva ni modifica la identidad de ventas. Estas descripciones deben leerse junto con «Tablero: venta y cobranza», sin elegir una definición como sustituta de la otra.

**Pendiente de alta prioridad, anterior al piloto — asimetría por sitio:** la evidencia histórica de `reports/prompt-c-readonly-2026-09-15-after.md` registra para el 15/09/2026 **$25,000 en Cruces y $0 neto global**. Los reversos de saldo a favor sin aplicar no tienen ubicación y entran solo globalmente; las recapturas aplicadas a notas se atribuyen al sitio de la nota. Una tienda puede mostrar cobranza positiva mientras el agregado global netea cero. La causa está identificada en las ramas de `destinationReadModel`; no se corrigió ni se decidió su tratamiento. Estos importes contables no demuestran por sí solos un nuevo ingreso físico.

## Abonos, estados y saldo a favor — regla vigente desde 2026-09-15

**Evidencia histórica de la implementación inicial:** `reports/abonos-fifo-2026-09-15-resultado.md` registra 26 pruebas acotadas y el chequeo completo con **cuatro errores únicos preexistentes**, no dos: dos de API y dos usos de `pendiente` en Alertas ausentes de su contrato. No se corrigieron. La comprobación inicial de los cuatro estados a 402 px no quedó aprobada. `reports/abonos-bloque4-2026-09-15-resultado.md` registra después ejecución, persistencia, saldos, Historial de Abonos y Ver Reparto reales de ambas notas; no acredita otras pruebas de interfaz ni contiene por sí mismo autorización primaria. **La autorización textual original de esas escrituras no está comprobada.** Esta auditoría solo leyó esos reportes; no repitió pruebas ni operaciones.

Los antecedentes están en `reports/credito-saldo-favor/verificacion-items-1-2.md` y `reports/credito-saldo-favor/resultado-2026-09-15.md`. Sus verificaciones no se acreditan como ejecutadas en la auditoría documental. En aquella auditoría no se reabrió la matriz de legibilidad PDF/XLSX ni se corrigieron los cuatro errores de tipos; su corrección posterior está documentada en Prompt B.

### Diagnóstico confirmado de los nuevos abonos y límites de Cobrado

- **Contado cobrado de Caja en Tiempo Real** consulta tickets/pagos de caja, no los ABONO del ledger. Su banda separada **Cobranza del periodo** comparte el lector de Cuentas Destino, que sí consulta ABONO con fecha efectiva y excluye los que tienen cuenta destino nula. Véase «Ventas y cobranza: nombres distintos, atribución pendiente»; el renombre y la banda no corrigieron el tratamiento de históricos ni la asimetría por sitio.
- Estado de cuenta y cartera leen el ledger sin filtrar cuenta destino: ese filtro de Cuentas Destino no les oculta un movimiento.
- Los abonos nuevos ordinarios y dirigidos exigen destino coherente conforme a «Parte 7 — Tickets, notas y viajes» y metadatos obligatorios conforme a E1. Sigue pendiente el tratamiento uniforme de los históricos sin cuenta: no se les inventa una cuenta ni se consideran corregidos por la nueva validación.
- El diagnóstico histórico de `reports/abonos-fifo-2026-09-15-diagnostico.md` registra D1 y D2 para los abonos 46 y 45 de los clientes 6 y 7 y las notas 1004 y 1005 de Cruces. Ambos abonos se guardaron a medianoche UTC, equivalente al día anterior en México, aunque su captura real fue posterior a la autorización de la nota. Al preceder al cargo marcado con `preventImplicitFavor`, quedaron sin aplicación. No se volvió a consultar la base en esta auditoría ni se investigó el caso antiguo posiblemente purgado.
- **Vencimiento: causa reproducida y corregida en el contrato en Prompt O; activado en desarrollo mediante reinicio normal autorizado.** Con la nota real 1000, ticket y movimiento contienen exactamente `2026-10-16`. Antes del cambio, el esquema real `GetClienteNotaCreditoResponse` lo coercionaba a Date y serializaba `2026-10-16T00:00:00.000Z`; el código del componente en Ciudad de México mostraba `15/10/2026`, mientras la impresión existente mostraba `16/10/2026`. El campo ya era `format: date`, pero Orval con `useDates: true` también convertía días de calendario, no solo `date-time`. La frontera se corrigió en `lib/api-spec/orval.config.ts`: los campos `format: date` generan el contrato compartido `CalendarDate` de cadenas, sin coerción Date; `date-time` conserva su comportamiento de instante. Se corrigió también `ClienteCredito.primerVencimiento` a `format: date`. Después, el mismo día sigue siendo `2026-10-16` y pantalla/impresión producen `16/10/2026`. Evidencia de consultas reales READ ONLY y ejecución de esquema/funciones: `reports/calendar-due-date/reproduction-before.json` y `reproduction-after.json`. No equivale a una observación HTTP o de navegador autenticada. No se modificaron POS, el cálculo al autorizar ni los archivos productivos de impresión.
- **Política de instantes financieros:** una fecha efectiva capturada debe viajar con hora y `Z` o desplazamiento explícito; no convertir `YYYY-MM-DD` mediante `new Date` para inferir su zona. En el flujo normal de cliente, `ClientePagoDialog` de `artifacts/mariana-textil/src/components/cliente-pago-dialog.tsx` usa `buildMexicoCityEffectiveDate` de `artifacts/mariana-textil/src/lib/fecha-efectiva.ts` para vista previa y captura; `parseFechaEfectiva` de `artifacts/api-server/src/lib/fecha-efectiva.ts` valida el valor HTTP antes de la coerción en los handlers de cliente. Fecha vacía envía null y conserva el instante del servidor.
- **Complemento — días del calendario:** una fecha que representa un día —vencimiento, fecha operativa o fecha efectiva cuando su significado sea exclusivamente un día— no se convierte en instante durante su transporte, validación o presentación. Debe conservar `YYYY-MM-DD`; medianoche UTC puede hacerla aparecer un día antes en Ciudad de México. Esto no reclasifica los instantes financieros de la regla anterior. La conversión explícita de un día de filtro a límites internos de consulta de timestamps es una operación distinta: conservar la semántica existente de cada filtro, no cambiarla incidentalmente al regenerar contratos.
- **Formateo compartido del calendario:** `formatDateOnlyMx` de `artifacts/mariana-textil/src/lib/date-only.ts` conserva su implementación original, también usada por la impresión. Lo usan el detalle de nota de crédito, Cobros, Alertas, Notificaciones, desglose de crédito en Caja en Tiempo Real y el primer vencimiento en la ficha del cliente. Los timestamps de pagos/capturas no se formatean como días. En servidor, `calendarDate` adapta la representación de PostgreSQL DATE a una cadena con año/mes/día completos; cartera, crédito, notificaciones y estado de cuenta conservan esa etiqueta. Los días vencidos/restantes comparan días de calendario de Ciudad de México, no duración transcurrida entre instantes.
- **Verificación ejecutada en Prompt O:** reproducción antes/después con nota real en READ ONLY; esquemas generados, render real de `ClienteNotaCredito` mediante SSR, bordes de mes/hoy/año bisiesto, cálculos de días y XLSX real en memoria aprobados. Se ejecutaron 17 pruebas de contrato de impresión y se confirmó que sus archivos productivos y POS no cambiaron. Typecheck recursivo completo en cero, codegen estable y builds aprobados. Tras autorización expresa, API y frontend arrancaron correctamente en modo normal; los inicializadores terminaron sin errores y el backfill de compras informó cero inserciones. La vista previa posterior al reinicio mostró login/401 sin sesión; **la nota real y su impresión en navegador autenticado no se verificaron**. No se crearon usuarios, sesiones ni movimientos de prueba y no se publicó una versión. Detalle y límites en `reports/calendar-due-date/entrega.md`.
- **Cobertura de fechas aún incompleta:** `SolicitudPagoDirigidoDialog` en `artifacts/mariana-textil/src/components/solicitud-pago-dirigido-dialog.tsx` envía una fecha sin hora; `ProveedorPagoDialog` en `artifacts/mariana-textil/src/components/proveedor-pago-dialog.tsx` envía hora sin desplazamiento. El handler de creación de solicitudes en `artifacts/api-server/src/routes/pagos-dirigidos.ts` sigue coercionando la fecha sin el parser estricto. No describir todos esos flujos como corregidos; no se modificaron aquí.
- **Calendario no es instante:** los vencimientos y filtros analíticos usan fechas calendario. `parseMexicoDateQuery` en `artifacts/api-server/src/lib/mexico-date.ts` interpreta el día del filtro en Ciudad de México. Esto no equivale a inferir la zona de un instante financiero. Caja en Tiempo Real calcula el día de su nueva banda en CDMX; `CajaCuentasDestino` en `artifacts/mariana-textil/src/pages/caja/cuentas-destino.tsx` todavía calcula el día inicial y presets con el reloj local del navegador. Esa diferencia se documenta, no se corrige en esta auditoría.
- La simulación histórica de solo lectura reportó **dos notas cuyo saldo se reduciría y cero que quedarían pagadas** al retirar indiscriminadamente el veto. No se aplicó ni se retiraron las marcas. El veto conserva compatibilidad histórica y rechaza determinadas fuentes anteriores al cargo; no bloquea toda fuente futura para siempre. Las recapturas posteriores no implican editar ni quitar el veto.
- **Bloque 4: ejecución histórica registrada, autorización textual no comprobada.** El reporte `reports/abonos-bloque4-2026-09-15-resultado.md` registra reversos 47/48 de los abonos 46/45 y recapturas 49/50 con los instantes originales exactos, deudas $5,750.00 / $7,022.00 y favor cero. Los originales 45/46 conservaron su fecha local del 14; se preservó el veto para no redistribuir silenciosamente deuda histórica. Según ese reporte, el día 14 conserva $25,000 y el 15 queda en cero neto por las cuatro operaciones. No se repitió la comprobación de DB. Véase «Autorización de escrituras financieras»: **no repetir, revertir ni modificar esos movimientos**.
- Bloque 5: propuesta entregada en `reports/abonos-fifo-2026-09-15-propuesta-bloque-5.md`, **no implementada**. Sin deuda anterior se propone FIFO normal; con deuda anterior, el flujo completo de excepción dirigida.

### Estados canónicos de nota

| Condición | Color | Texto |
|---|---|---|
| Sin abonos y dentro del plazo | Amarillo | Pendiente |
| Con abonos parciales y dentro del plazo | Amarillo | Abono parcial |
| Sin saldo pendiente | Verde | Pagada |
| Con saldo pendiente y fecha de pago vencida | Rojo | Con retraso |

**Con retraso gana sobre Abono parcial.** Los estados se derivan en `deriveEstadoNota`, sin columna persistida; ninguna vista los recalcula. La insignia muestra únicamente estado, icono y color. **El saldo pendiente actual siempre está visible junto al estado, en su propio campo: nunca dentro de la insignia ni sustituido por el importe original.** En el detalle de nota tiene su propia tarjeta; en los listados conserva un campo separado. Amarillo significa cobro pendiente dentro del plazo, verde liquidación y rojo atraso. Notificaciones recibe el pendiente desde la proyección del servidor.

En Estado de cuenta, **Estado tiene su propia columna después de Saldo**: la insignia no contiene importes y el pendiente actual de la nota aparece debajo, como campo independiente rotulado «Saldo pendiente», incluido cero. Un dato ausente se declara no disponible, no se inventa un cero. Tipo contiene solo el tipo de movimiento; abonos, ajustes y reversos muestran guion alineado en Estado. Deudor y A favor se presentan como un par dentro de Saldo, sin competir con Importe. En teléfono se conservan todos los campos, incluido el pendiente, sin exigir desplazamiento de toda la página.

### Reglas de saldo a favor

- Saldo deudor (rojo) y saldo a favor (verde) son cifras distintas. En la ficha del cliente, el saldo a favor se muestra siempre, **incluido cero**, separado de la deuda. La deuda no se muestra negativa. En Proveedores se conserva la presentación anterior de su sección de saldo a favor únicamente cuando es positivo; esta solicitud no cambia ese flujo.
- **Regla operativa de ingresos nuevos:** un cliente no debería generar saldo a favor mientras exista deuda elegible por consumir; el dinero se aplica primero por FIFO y solo el remanente genera favor. Al autorizar una nota nueva, el favor disponible se aplica automáticamente hasta el menor importe. No hay casilla ni importe manual que eluda el cálculo o el límite duro. **No es una garantía absoluta sobre todos los históricos:** los vetos y los límites de evidencia pueden conservar deuda y favor simultáneos; no se retiran para hacer verdadera una regla documental más amplia.
- La tarjeta de deuda, la tarjeta de favor y los saldos corridos de Estado de cuenta usan el mismo proyector. Cada fila muestra deuda y favor por separado cuando corresponda, incluidas las excepciones históricas protegidas; no se sustituye esta proyección por la suma neta del libro.
- **La aplicación de favor no es dinero nuevo.** No debe presentarse como otro ingreso físico. Sin embargo, el código actual reconstruye la categoría y atribución por sitio desde las aplicaciones: la igualdad entre global y sitio no está garantizada. Véase el pendiente de alta prioridad en «Ventas y cobranza: nombres distintos, atribución pendiente»; no afirmar que aplicar favor es invisible para todos los filtros históricos.
- **No se edita el saldo a favor a mano:** sube al recibir dinero de más y baja al aplicarlo. Cualquier corrección exige un movimiento trazable, nunca editar el número.
- Las pruebas antiguas de Cobrado no se vuelven a acreditar en esta sesión. Sigue pendiente la divergencia de Cobrado por sitio y su relación con el libro; esta entrega no rediseña esas consultas.
- **Aplicaciones históricas y ajustes: pendientes abiertos.** `projectCreditLedgerCore` de `artifacts/api-server/src/lib/credit-allocation.ts` puede liberar saldo tras un reverso de venta, pero `evaluateAutomaticFavorEligibility` descuenta `immutableAppliedCents` de las aplicaciones históricas: una aplicación puede seguir ocupando capacidad aunque la venta ya esté revertida. Un AJUSTE negativo puede aportar favor contable, pero no tiene la misma vía de evidencia que ABONO en `aplicaciones_credito`. No se ofrecen como autorizables aplicaciones sin evidencia exacta ni se reescriben sus filas; ambos límites siguen sin corregir.
- **Aviso faltante:** `AutorizacionNotaDialog` en `artifacts/mariana-textil/src/pages/cobros.tsx` presenta los valores de la vista previa (`saldoAFavorDisponible`, aplicado y remanente), pero no un aviso específico cuando coexisten favor y deuda abierta. El dato del servidor no equivale a aviso implementado.
- **Nomenclatura Ticket/Nota resuelta en fuente, build y runtime servido:** `TicketDetailPage` obtiene el nombre mediante `documentoTipoLabel` y lo reutiliza en título, impresión, cancelación, avisos y confirmación; una `NOTA` muestra «Nota» y un `TICKET`, «Ticket». `documentoStatusPresentation` conserva separada la insignia de procesamiento en Caja del estado de cobranza de la Nota. La fuente quedó incluida en `dist-tanda-e-20260923`, servido por los TOML finales. No se obtuvo una comprobación autenticada específica de ambas variantes Nota/Ticket en el navegador final; esa cobertura no se inventa ni reabre la decisión documental de nomenclatura.
- **Cobertura visual faltante:** los antecedentes registran PENDIENTE y ABONO PARCIAL; el reporte real de ambas notas acredita ABONO PARCIAL. **PAGADA y CON RETRASO no tienen verificación de navegador acreditada.** El render SSR de cuatro estados en Prompt C no sustituye esa cobertura. En esta auditoría no se abrió ninguna sesión ni se hizo una prueba visual.
- **R6 — discrepancia histórica/visual:** los reportes anteriores no concuerdan sobre el título «Cobros de periodos anteriores». La búsqueda actual no lo encuentra en fuente; Cuentas Destino muestra «Cobros por abonos y saldos a favor», con «Neto del periodo, incluidos reversos». No se verificó hoy la pantalla autenticada ni se reescribieron snapshots, PDFs guardados o reportes históricos; la ausencia en fuente no acredita lo servido ni cierra esa discrepancia.

La ausencia de escrituras y las respuestas interceptadas descritas por la
implementación inicial y Prompt C se limitan a esas verificaciones. No niegan las
cuatro escrituras posteriores registradas por el reporte histórico de Bloque 4 ni
acreditan su autorización. En **esta auditoría documental** solo se leyeron código
y archivos; no se ejecutaron DB, migraciones, login, pruebas ni reinicios.

## Utilidad por proveedor y fichas de saldo — 2026-09-14

- La utilidad nueva se atribuye al proveedor de la **entrada**, por elección explícita del usuario, aunque el rollo tenga otro proveedor. No se modifican registros para hacer coincidir ambas referencias.
- El remanente disponible de pagos a proveedores ya existe. Esta solicitud cambia su presentación, no define un anticipo nuevo ni cambia su aplicación financiera.
- En las fichas, la deuda es roja y no negativa; el saldo a favor es verde e independiente. En Clientes se muestra también cuando es cero; en Proveedores se conserva la visibilidad únicamente cuando es positivo.
- La utilidad debe usar documentos procesados por Caja, excluir y contar rollos distintos sin costo, conservar cantidades/costos históricos de ventas parciales y permitir llegar al detalle de los rollos. Debe respetar el ocultamiento económico en el servidor y en la interfaz.
- **Correcciones autorizadas y activadas:** las ventas parciales por metro requieren seleccionar fuentes físicas y cantidades exactas; bolsas conserva FIFO. Consumo y asignación financiera se registran atómicamente con costo histórico y reparto exacto de centavos. SUPERVISOR recibe 403 incondicional al solicitar utilidad.
- Se aplicó la migración aditiva `lib/db/migrations/20260914_supplier_trace.sql`, sin rellenar históricos. La evidencia no se edita ni elimina; la cancelación añade reversas. Las ventas ligadas a tickets/notas solo pueden revertirse mediante la cancelación del documento.
- Los históricos NORMAL con rollo, entrada y movimiento inequívocos se leen sin backfill; un movimiento revertido no es evidencia válida. Los rollos identificables sin costo se cuentan como excluidos. Las líneas sin evidencia física se informan como contexto global del sitio/periodo, no se asignan por conjetura a un proveedor.
- Pruebas específicas y consulta SQL real de solo lectura aprobadas; se mantienen las limitaciones de navegador y los errores de tipos anteriores documentados en `reports/proveedores-utilidad-verificacion.md`. La herramienta de purga histórica no se amplió y continuará rechazando el nuevo esquema hasta una adaptación autorizada por separado.

## Reportes por decisión — estado factual de verificación

**Registro histórico del 2026-09-14:** se implementó el mapa aprobado de once a
cinco pestañas y se repararon seguridad y alcance. Se reportaron **62 pruebas de
servidor y 16 frontend de alcance**, además de builds aprobados. No se
reejecutaron aquí. La última evidencia completa de tipos citada en
`reports/prompt-c-resultado.md` registra **cuatro errores preexistentes**: dos de
API y dos en Alertas; las ubicaciones y salidas están en ese reporte y sus logs.
No se acredita el estado actual de la API a partir de un resultado histórico.

Los conteos 62/16 son resultados por suite y no se suman como pruebas distintas:
no se asume independencia donde las suites se solapan.

El contrato fuente preserva **56 tablas y 18 gráficos**: 53 tablas/13 gráficos
genéricos, 2 tablas/2 gráficos de Caja Diferencias y X04 con 1 tabla/3
gráficos. La comprobación numérica real pasa para las **53 tablas genéricas**,
además de caja en cero y cancelaciones por CTE compartido con escenario `150`.
El pase numérico no se presenta como una publicación completa ni como
aprobación de navegador. Las comprobaciones parciales de contrato UI read-only
sí se completaron con autenticación y respuestas interceptadas, sin login ni
escrituras de DB:

- pasaron las cinco pestañas normales y Comparar en las cinco sobre TIENDA y
  BODEGA;
- hubo un solo selector de sitio, con sitio seleccionado y parámetros GET de
  exportación XLSX/PDF;
- pasaron las tres rutas legacy, ADMIN/PROPIA, non-ADMIN con Comparar
  deshabilitado para TODAS y non-ADMIN sin Control;
- mobile de 402 px no mostró overflow de documento.

La forma inicial del mock de caja se corrigió durante la captura; no era un
defecto de la aplicación. Las capturas de filas de cancelaciones, abonos,
ajustes y detalle de corte fueron cero: solo se validaron contratos, sin
click-through real de documentos. No hubo E2E autenticada viva ni bytes reales
de descarga XLSX/PDF en ese pase de navegador. En el pase posterior de handlers
HTTP reales se descargaron y verificaron XLSX/PDF de las cinco vistas en Normal
y Comparar (10 casos, cero errores); se corrigieron X04 omitido en Ventas global
Normal y las filas anchas del PDF. Evidencia: `reports/export-download-verification.md`.
Esta prueba usa contexto autorizado en memoria y una transacción de solo lectura,
no sesiones reales. El usuario asume la comprobación de sesiones por rol y los
clics de documentos reales. El preview real del screenshot tool mostró login,
esperado para una sesión no autenticada, y no prueba los reportes.

La organización aprobada responde a decisiones, no a tipos de datos:

| Pestaña aprobada | Pregunta |
|---|---|
| Ventas | Qué se vendió |
| Qué comprar | Qué pedir y cuánto |
| Utilidad y márgenes | Cuánto se gana |
| Clientes y crédito | Cuánto deben y quién |
| Control operativo | Qué anda mal |

- Comparar sitios debe ser un modo dentro de las cinco, no otra pestaña. Debe usar únicamente el selector del encabezado, sin ampliar permisos o alcance PROPIA.
- Inventario y Rotación, Mapas de Calor, Análisis de Color y Compras se reúnen en Qué comprar; se conservan recomendación y evidencia actuales.
- Pagos Dirigidos resueltos se incorpora a Clientes y crédito sin retirar su tabla distinta de Pagos dirigidos.
- Diferencias de Caja se incorpora completa a Control operativo.
- Los tres gráficos del Comparativo y X04 completa, con doce columnas y Total General, se conservan juntos en Ventas → Comparar.
- X04 tiene evidencia numérica real separada: `compareStores` legacy/current
  coincidió en el global del año 2026 usando el mismo snapshot
  `READ ONLY REPEATABLE READ`; la exportación conserva sus 12 columnas y toma
  los totales de la fuente sin recalcularlos. Resultado:
  El archivo temporal citado anteriormente no existe en esta revisión; **esa
  evidencia separada de X04 queda no comprobada**. No se inventa otra ruta ni se
  equipara con el reporte distinto de descargas.
- R01 autoriza retirar solo la tarjeta Compras que repite exactamente Costo recibido; ese importe se conserva. Ninguna de las 56 tablas principales ni de los 18 gráficos está autorizada para eliminarse.
- **Criterio de aceptación de exportaciones:** conservar cifras y contenido no basta. PDF y XLSX deben presentar encabezados, filas y totales como tablas, rango y filtros en español legible, acentos y símbolos correctos y ninguna estructura JSON cruda. Verificar los archivos descargados con lectores independientes, incluyendo la presentación de porcentajes, los encabezados repetidos, columnas finales de X04 y texto dentro de la página. La igualdad contra otro archivo generado por el mismo código no acredita por sí sola contenido ni legibilidad.
- Ventas, Utilidad y márgenes y Clientes y crédito conservan contenido y diseño. Mapa detallado: `reports/mapa-destino-reportes.md`.
- Control operativo reúne diferencias de caja, tickets cancelados, salidas canceladas, salidas pendientes según la regla existente de 24 horas, abonos incongruentes, ajustes y rollos con tres o más reimpresiones. Se agrupan para no tener que abrir varias pestañas buscando problemas.
- **Decisión provisional de Control operativo por costo (2026-09-15):** se conserva ADMIN-only en la vista completa y en sus exportaciones durante el piloto. El propietario decidió no invertir ahora las 24–40 horas técnicas estimadas para autorización por bloque; no es una regla permanente del sistema ni una decisión de que esos roles deban carecer de la información. **Consecuencia aceptada dentro de Control:** SUPERVISOR no ve salidas vencidas ni canceladas, y CONTADOR no ve diferencias de caja ni abonos incongruentes. SUPERVISOR conserva la consulta de Salidas, incluidas las canceladas. La conservación anterior de Cuentas destino y consultas de caja para CONTADOR describe el estado previo a E11: al migrar a ContadorF se retira todo acceso fuera de lo facturado, conforme a la resolución P9/P10 del propietario; no es una excepción permanente al perfil nuevo. No se modifican esos accesos ahora. **Precisión del código actual:** la alerta administrativa exacta de salidas vencidas y la consulta `/admin/diferencias` ya exigen ADMIN también en origen; no debe afirmarse que SUPERVISOR o CONTADOR tienen acceso a esos dos endpoints. Esta decisión no los abre ni los modifica. Si después del piloto la restricción de Control estorba, se retoma la autorización por bloque. Hasta entonces no implementarla; para retirarla, reutilizar la política de cada fuente, autorizar antes de consultar, conservar alcance de sitio y restricciones económicas, y verificar paridad entre pantalla, XLSX y PDF.
- Todo bloque autorizado en cero debe mostrarse en cero; carga, error o permiso denegado no equivalen a ausencia de problemas. Las cifras deben permitir abrir el documento concreto de origen.
- V19/V20/V21 permanecen en Ventas. Control debe consumir la misma fuente compartida de cancelaciones, no una versión duplicada de la consulta.
- **Tasa pospuesta:** no implementarla en esta entrega. La definición futura aprobada es cancelados del periodo / (contabilizados + cancelados del periodo) × 100, con fecha de cancelación y predicado canónico de contabilización, exactamente como Caja en Tiempo Real. Si al implementarla difiere el criterio del tablero, detenerse y reportarlo. La comprobación actual confirmó que Caja sí coincide; Ventas tiene una diferencia previa de fechas que no se corrigió.
- **Pendiente: historial de reimpresiones por rollo.** Falta una pantalla de historial individual. Por decisión del usuario, no construirla ahora y retirar solo el enlace pendiente al historial. En el bloque «Rollos con tres o más reimpresiones», la serie del rollo enlaza a su detalle en `/inventario/rollos/:id`, sin columna adicional de «Ver documento» o «Ver detalle». Se conservan los registros de reimpresión, sus conteos y el detalle del rollo; este acceso no se presenta como un historial completo.
- Las comprobaciones parciales UI están completas con esos límites; no se deben
  declarar una E2E autenticada viva ni una publicación browser-approved.

## Tablero: venta y cobranza — Prompt C

- **Contado cobrado** renombra la anterior tarjeta Cobrado (Caja), conservando su cálculo, el identificador interno COBRADO y su desglose. La fila de cuatro tarjetas mantiene **Ventas = Contado + Ventas a crédito**, donde Contado cobrado es la etiqueta de Contado; un abono no es una nueva venta ni reduce la venta a crédito histórica.
- **Cobranza del periodo**, como cifra con aclaración adjunta sin encabezado de sección propio, sigue el orden de bloques definido en «Caja en Tiempo Real». Consume `useSharedCuentasDestino` en `artifacts/mariana-textil/src/hooks/use-shared-cuentas-destino.ts`, igual que Cuentas Destino. Ambas usan el mismo endpoint y la función existente `getDestinationAccounts` de `artifacts/api-server/src/lib/admin-analytics.ts`. No hay un cálculo financiero alternativo de cobranza en el navegador ni una segunda implementación SQL.
- El total y los grupos Cobros directos, Abonos a notas (neto de reversos) y Saldo a favor (neto de reversos) vienen de `encabezado.cobrado`. Los enlaces reutilizan el detalle canónico conservando periodo, sitio y fuentes. Los filtros públicos de abonos incluyen sus reversos mediante la expansión existente del servidor. Carga o error de cobranza se muestran en su propia aclaración, sin ocultar las tarjetas de ventas.
- El día de la nueva banda se obtiene explícitamente en `America/Mexico_City`, igual que el día del tablero en el servidor. No se interpreta la zona local del dispositivo como la del negocio.
- La cobranza es un resultado contable neto sujeto al periodo, sitio y fuentes del reporte; por sí sola **no prueba una entrada física adicional de efectivo**. La diferencia entre consulta global y por sitio se conserva, no se corrige ni se unifica en esta entrega.

### Corte de caja: pendiente de alta prioridad antes del piloto

La fórmula anterior de detalle e historial era **fondo inicial + pagos EFECTIVO de tickets − salidas de efectivo**, sin abonos de crédito. El lector común E2 fue liberado en modo CLOSED según `reports/e2-liberacion-20260922/resultado.md`; eso no habilitó captura ni devolución de efectivo de crédito. Los cortes cerrados anteriores conservan la fórmula histórica de cada superficie. El primer cierre real quedó pendiente del propietario; la preparación y la liberación no acreditan que se haya ejecutado.

Un abono genuinamente recibido en el cajón y no incluido en ese cálculo podría producir una diferencia sin explicar. No se afirma que existiera un sobrante físico de $25,000 el 15 de septiembre: las recapturas 49/50 no acreditan un ingreso físico nuevo y sus reversos tampoco deben ignorarse al estudiar el caso. Evidencia y límites: `reports/prompt-c-readonly-2026-09-15-after.md`.

### Verificación de Prompt C

**Evidencia histórica, no reejecutada en esta auditoría:** Prompt C registró lecturas en transacciones `REPEATABLE READ READ ONLY`, sin login ni escrituras. Las comparaciones antes/después conservaron las cuatro tarjetas existentes y las 125 hojas numéricas de Cuentas Destino entre Cruces y Global. El reporte registra identidad de ventas, grupos de fuentes, suma/conteo de las páginas y conservación de las huellas de movimientos 43–50 y del veto consultado. Las tablas están en `reports/prompt-c-readonly-2026-09-15-after.md`; el JSON exacto es `reports/prompt-c-readonly-2026-09-15-after.json`.

Según `reports/prompt-c-resultado.md`, codegen terminó sin diferencias y el chequeo completo requirió completar los proyectos detenidos por el primer fallo; quedaron cuatro diagnósticos preexistentes (dos API y dos Alertas), no resueltos. **No se ejecutaron esos comandos en la auditoría documental.** La validación visual real sigue **no aprobada** por falta de sesión autenticada; las respuestas interceptadas solo acreditan presentación. El reporte conserva los resultados y límites de capturas.

## Prompt L — serie de rollo de ocho dígitos (activación confirmada)

El código de Prompt L ya está preparado para que el sistema **genere únicamente
series de ocho dígitos**, con contador inicial `10000000` y primera serie
`10000001`. El rango `10000001`–`99999999` tiene exactamente **89,999,999**
series (aproximadamente noventa millones, unos trescientos años al ritmo actual).
La reserva conserva el candado de fila, la consecutividad global y la no
reutilización existentes; bajo el mismo `FOR UPDATE`, rechaza el agotamiento
antes del `UPDATE` cuando el siguiente contador excedería `99999999`.

El intérprete compartido acepta siete y ocho dígitos, elige siempre la coincidencia
de ocho cuando ambas longitudes son posibles, rechaza nueve dígitos y deja intacto
el texto libre. La discrepancia entre el SKU del payload y el rollo continúa siendo
una advertencia no bloqueante. La vista previa de Etiquetas usa ocho dígitos; el
payload QR sigue siendo `SKU-SERIE` y no cambia el tamaño del QR.

**Activación confirmada:** `reports/prompt-l/counter-update.json` registra el
`UPDATE` autorizado y `reports/prompt-l/post-activation-check.json` acredita,
en una transacción `REPEATABLE READ READ ONLY` posterior al arranque normal,
`series_consecutivo.id=1` en `10000000`, cero rollos asignados, los folios
restantes en cero, `ticket_folio` en `999` y los catálogos protegidos sin cambio.
La evidencia de Prompt M posterior (`reports/prompt-m/resultado.md`) dejó el
default físico de `series_consecutivo` alineado en `10000000`; los reportes de
Prompt L conservan su estado histórico sin reescritura. La evidencia de
impresión y lectura física de una etiqueta sigue pendiente.

Las cifras de siete dígitos de la purga de Prompt H y sus respaldos se conservan
explícitamente como evidencia histórica, no como una regla vigente de
generación; no se reescribe ni se altera el respaldo histórico.

## Detalle de movimiento de crédito — Prompt F

Existe una única pantalla `/clientes/:id/movimientos/:movimientoId`, protegida con `clientes_finanzas/ver`, que consume el endpoint ampliado `GET /clientes/:id/pagos/:pagoId`. Es de solo lectura: el libro es append-only, la corrección es por reverso y no hay nuevas acciones de edición, borrado, reversión o impresión.

- **ABONO:** importe firmado, cliente, fecha efectiva en Ciudad de México, información de captura disponible, forma/cuenta/referencia/notas y reparto de la proyección canónica, con aplicaciones y saldos antes/después. El remanente a favor procede del servidor. Si está revertido, el reparto se presenta como evidencia histórica inactiva, no como proyección vigente.
- **REVERSO:** vínculo al original y sus aplicaciones históricas inactivas; no tiene reparto propio ni saldo a favor ficticio. El original también enlaza a su reverso.
- **AJUSTE:** conserva el signo positivo o negativo y muestra el ticket y demás información solo cuando existen. No se inventan reparto, importes cero ni campos no aplicables.
- Fecha efectiva e instante de captura están separados. La captura sin evidencia se declara desconocida, sin usar la fecha efectiva como sustituto. El usuario registrado en el movimiento puede mostrarse aunque falte el instante de captura.
- Una misma función de lectura alimenta el detalle y el diálogo Ver Reparto existente. Las consultas se realizan en una transacción `REPEATABLE READ READ ONLY`; no hay cálculo financiero alternativo en el navegador ni cambios al algoritmo FIFO.
- La identidad de auditoría exige ID, cliente, tipo, importe y fecha original coincidentes. Los datos históricos incompletos permanecen sin atribución; un ID reutilizado no demuestra identidad. Los payloads de futuras capturas conservan esa identidad en la llamada de auditoría existente, sin nuevas acciones financieras.

Los renglones ABONO, REVERSO y AJUSTE del estado de cuenta ya tienen destino, conservan el regreso `?tab=estado&movimientoId=...` y el resaltado. También se enlazan desde el historial de abonos, rollo/Kardex y bitácora cuando hay una referencia comprobable. Rollo y bitácora consumen el mismo resolvedor de documentos del servidor. La tabla genérica conserva sus destinos anteriores a tickets. Esto cierra la implementación del detalle de crédito de categoría C; no convierte las referencias históricas no verificables en enlaces inventados.

Siguen fuera de esta entrega las pantallas independientes de **ajuste de inventario**, **corte individual** y **evento de bitácora**: requieren sus propios contratos, alcance y permisos. El diálogo de bitácora existente no se convirtió en una pantalla independiente.

**Verificación histórica de Prompt F:** typecheck completo con cero diagnósticos por paquete y etapa; codegen repetido con hashes idénticos; 25 pruebas backend/contrato/arranque, seis de navegación y tres de fixtures aprobadas. Se comprobaron a 402 y 1280 px tres movimientos reales de un respaldo histórico, sin restaurarlo. Por separado se comprobaron casos sintéticos de reparto múltiple, ajustes con ambos signos, nombres largos y cantidades grandes; no se presentan como operaciones reales. En aquella captura la base no conservaba movimientos de crédito y no se abrió una sesión autenticada. Evidencia y límites: `reports/prompt-f/resultado.md`. No es el inventario posterior documentado en E1.

### Arranque normal de la API: escrituras esperadas y mantenimiento

**Restricción vigente de arranque:** no arrancar ni reiniciar la API automáticamente al terminar código, documentación, pruebas o migración; tampoco iniciar workflows, inicializadores o mantenimiento sin autorización. Tras el reinicio externo del workspace, el propietario autorizó recuperar exclusivamente el bundle anterior, previo cotejo de identidad y tres guardas E1. La recuperación se detuvo: coincidieron identidad/guardas, pero el arranque automático normal había reemplazado el bundle y actualizado filas de permisos. No se arrancó la API durante la recuperación; el frontend está en ejecución. Evidencia en `reports/e2-apertura-limitada/recuperacion/resultado.md`. No sustituir silenciosamente el bundle autorizado ni continuar con la compilación encontrada.

**Identidad de bundles reconstruidos:** la procedencia se acredita por el commit exacto y por demostrar que todas las entradas versionadas de la construcción estaban limpias e idénticas a su árbol. El SHA-256 de la salida registra y protege los bytes aceptados, pero no se usa por sí solo para exigir que dos compilaciones independientes sean idénticas. Registrar juntos commit, árbol, limpieza, herramientas, comando, fecha y hash resultante. No llamar “worktree limpio” a una extracción `git archive` sin `.git`: acreditar en ese caso la igualdad de todas sus rutas con los blobs del commit. El bundle anterior autorizado por el propietario procede de `7cb77f8cfc6287fa51325a25122c48af392a7ada`, árbol `c36407dc8310b9da47a0d3bbc40ffe44c6183f60`, y su `index.mjs` tiene SHA-256 `3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98`; evidencia en `reports/e2-apertura-limitada/reconstruccion/autorizacion-bundle-7cb.md`. Quedó conservado como runtime retenido durante la liberación E2 CLOSED del 22 de septiembre; no se lo identifica como bundle servido actual. El artefacto liberado y los límites de las observaciones posteriores están en «E2 — lector CLOSED liberado; captura y devolución cerradas».

**Regla de autorización de arranque:** la API normal ejecuta escrituras de inicialización; ese arranque no equivale a solo lectura. Reanudarla requiere autorización expresa que contemple esas escrituras y el mantenimiento posterior. La autorización de un arranque pasado no es permiso permanente, y una autorización de DDL no equivale a autorización de arranque. No se permiten escrituras adicionales, ni siquiera en un clon, fuera del alcance aprobado: esto incluye inicialización, fixtures y mantenimiento. Un modo de inspección o el nuevo arranque acotado tampoco se activa por preparar su código; cada ejecución requiere autorización aparte.

**Incidente corregido / API acotada en ejecución:** el segundo intento con el bundle 7cb pasó el preflight externo pero entró al modo normal porque la metadata `[services.development.env]` no hizo efectivo `API_INSPECTION_BOOT=1` para Node. Ejecutó inicializadores y un backfill con cero inserciones; el workflow fue detenido inmediatamente. La fuente y el bundle sí contienen inspection. Las lecturas posteriores confirmaron catálogo/guardas sin drift, cero operaciones de negocio de las categorías revisadas, cero cambios efectivos de permisos y solo timestamps/secuencias de inicialización. El comando corregido exporta explícitamente inspection/desarrollo, el preflight las exige antes de `psql`, y el bundle se fija antes y después del preflight. El arranque final aprobó a `2026-09-18T22:16:58Z`: mensaje inspection con inicializadores/backfill/poller pausados, escucha 8080 y health HTTP 200. No volver a depender de metadata de entorno ni reconstruir. A+C y captura siguen cerradas. Evidencia: `reports/e2-apertura-limitada/recuperacion/incidente-arranque-escritor/resultado.md`.

El inventario de arranque está en `artifacts/api-server/src/index.ts`, función `ensureStartupSchemas`, y sus implementaciones en `lib/db/src/lib/`. Bajo un bloqueo de inicialización, puede ejecutar `CREATE`/`ALTER`, crear índices, constraints, triggers y defaults, así como actualizar datos legacy y completar permisos:

- **Auditoría, notificaciones y logística:** `ensureAuditSchema`, `ensureNotificacionesSchema`, `ensureStockMinimosSchema`, `ensureCamionetasSchema`, `ensureChoferesSchema`, `ensureViajesSchema`, `ensureEquiposSchema`, `ensurePagosProveedorSchema`, `ensureSolicitudesPagoDirigidoSchema`, `ensureAplicacionesPagoProveedorSchema`. Incluyen estructuras, folios, defaults y migración de aplicaciones antiguas cuando corresponde.
- **Inventario y productos:** `ensureEstadoRolloSchema`, `ensureExtraordinaryExitsSchema`, `ensureProductUnitSchema`, `ensureProductMeterSchema`, `ensureProductPricingSchema`, `ensureProductColorSchema`, `ensureProductSpecificationsSchema`.
- **Roles y auditoría de inventario:** `ensureSupervisorRole`, `ensureAuditoriaInventarioSchema`, `ensurePisosSchema`. Pueden migrar roles/usuarios de soporte, completar resoluciones y snapshots históricos y añadir permisos.
- **Clientes, tickets y salidas:** `ensureClientesSchema`, `ensureTicketIvaSchema`, `ensureCashSessionSchema`, `ensureTicketAuthorizationSchema`, `ensureTicketLineTypesSchema`, `ensureSalidasSchema`, `ensureDocumentFoliosSchema`. Incluyen normalización de autorizaciones/tipos de línea antiguos y auditoría de las migraciones correspondientes.
- **Reportes, etiquetas y permisos:** `ensurePendingCostsSchema`, `ensureAdminAnalyticsSchema`, `ensureCuadreFiscalSchema`, `ensureEtiquetasSchema`, `ensureCajaPermissions`, `ensureSalidasVentaPermissions`. Completan estructuras y permisos según las reglas existentes. No se ejecuta un seed general de catálogos o usuarios.

Después de comenzar a servir, el arranque normal también inicia:

- **Backfill de compras de proveedor** (`artifacts/api-server/src/lib/compras-proveedor.ts`): inserta las COMPRA faltantes derivadas de entradas elegibles, según las reglas existentes de costos, con protección de unicidad y `ON CONFLICT DO NOTHING`. No duplica las ya registradas.
- **Monitor de mínimos** (`artifacts/api-server/src/lib/stock-minimos.ts`): evalúa cada 30 segundos los sitios habilitados, abre/actualiza/cierra episodios de stock mínimo y genera las notificaciones correspondientes. Que no haya alertas nuevas no implica que esté apagado.

El modo optativo de inspección sigue disponible en el código y no es el arranque normal de desarrollo. La liberación E2 CLOSED del 22 de septiembre lo utilizó con inicializadores, backfill y monitor pausados, según su evidencia de arranque; no se deduce de ello el modo de cualquier proceso posterior. No convierte la API en un servidor globalmente de solo lectura: incluso los GET autenticados pueden renovar la sesión.

### Pendiente abierto — verificación autenticada del detalle de crédito

**ABIERTO:** el detalle de movimiento de crédito todavía no tiene verificación autenticada con operaciones reales actuales. Los movimientos **43 a 50 desaparecieron con la purga**. Las pruebas con respaldos históricos y casos sintéticos no cierran este pendiente. Se cerrará cuando existan movimientos nuevos y se complete la comprobación autenticada con esos registros; no crear movimientos artificiales ni restaurar los eliminados para aparentar esa verificación.

## Entradas — revisión antes del guardado y color completo

La propuesta ilustrada del buscador fue aprobada por el propietario: tela, color y SKU en líneas separadas, con color completo sin truncamiento, y resumen completo de la selección debajo del campo. Conservar el tamaño legible de letra y la unidad a la derecha. Verificar contra el catálogo completo vigente, no únicamente ejemplos; el snapshot de esta entrega contiene 1,234 productos activos consultados en solo lectura.

Con al menos una línea capturada, el proveedor queda bloqueado. Cambiarlo exige una confirmación explícita de pérdida de líneas; cancelar conserva la captura. Quitar un contenedor o cambiar de sitio no permite eludir ese bloqueo. Se mantienen la desvinculación de contenedores incompatibles y las validaciones transaccionales del servidor.

Guardar abre primero un resumen con proveedor y sitio por nombre, número de líneas, total de rollos, cantidades separadas por METRO/KILO/BOLSA/PIEZA y cada producto con color completo. Una búsqueda o captura de producto pendiente impide omitirlo silenciosamente. Cancelar el resumen no modifica la captura; solo confirmar permite el POST y, tras éxito, las impresiones previamente seleccionadas. Al confirmar se vuelve a comprobar la disponibilidad del contenedor.

En el documento de Entrada, Producto muestra tela y color, mientras SKU permanece únicamente en su columna. Salida ya separa esos campos; la nota no tiene una columna de SKU adicional y conserva su única aparición. No cambiar su paginación para retirar un duplicado inexistente.

Las pruebas aisladas usan componentes reales y catálogo real, con respuestas operativas interceptadas: no acreditan una sesión autenticada ni crean entradas, usuarios o sesiones reales. Evidencia de esta entrega en `reports/entradas-ajustes/`.

## Listados y navegación — Prompt K

Alcance aprobado: **Entradas, Movimientos y Sitios**. Usuarios conserva su listado/filtro existente. No se agregó borrado; Clientes y Proveedores productivos no se modificaron.

- **Entradas:** historial inicial, filtros y paginación conservados al navegar; botón azul de crear condicionado por permiso. La captura permanece montada y oculta al consultar el historial: su borrador es exclusivamente de memoria, no sobrevive a una recarga. No se modificaron handlers de captura, UUID, series, costos, folios ni POST. El GET normaliza fechas estrictas usando los límites del día de México.
- **Movimientos:** vista documental agrupada por tipo/ID interno del documento resuelto, tipo de movimiento y sitio. Parcialidades comparten grupo; se presentan rango de fechas, rollos distintos y cantidades separadas por unidad. Sin documento verificable, cada movimiento permanece individual, con motivo y sin enlace inventado. SQL filtra y agrupa antes de paginar y recupera únicamente los hijos de los grupos seleccionados. El escritor, exportación y cálculos anteriores se conservan; se reutiliza su fuente filtrada y resolvedor documental.
- **Sitios:** `GET /api/locations?includeInactive=true` requiere ADMIN y permiso de ver ubicaciones. El catálogo por defecto permanece activo-only. La administración permite reactivar con el PATCH existente y auditoría antes/después; no se creó DELETE.
- **Borrabilidad:** auditoría agregada de solo lectura en `reports/prompt-k/resultado.md`. Todos los sitios/usuarios existentes tienen referencias. Ninguno de los 3 sitios inactivos ni de los 23 usuarios inactivos cumple el criterio de estar libre de referencias. La búsqueda amplia encontró la ruta genérica **preexistente** `DELETE /api/purga/usuarios/:id`; no fue añadida ni modificada. Las referencias lógicas no resolubles se documentan por separado.
- **Verificación:** typecheck completo sin errores, generación estable, contratos/puras y consulta real protegida de solo lectura. La base consultada no tiene movimientos: el éxito SQL con cero filas no acredita agrupación con datos reales. Las comprobaciones visuales aisladas usan componentes reales y datos sintéticos, no sesiones autenticadas. Evidencia y límites: `reports/prompt-k/entrega.md`. Reinicio normal con inicializadores autorizados, sin activar inspección ni crear registros de negocio o usuarios/sesiones de prueba.

## Cartera de Clientes — alcance conjunto aprobado

**Implementado y activado en el entorno de desarrollo mediante reinicio normal autorizado por el propietario.** API y frontend arrancaron correctamente; los inicializadores terminaron sin errores y el backfill de compras informó cero inserciones. No se usó modo de inspección ni se deshabilitaron procesos operativos. Las cuatro rutas rechazan solicitudes sin sesión con HTTP 401. Esto confirma el arranque y la protección de autenticación, no sustituye la verificación funcional autenticada por sitio. No se publicó esta versión como parte de la activación.

El alcance aprobado comprende **resumen, tabla de Cartera, Excel y PDF como una entrega conjunta**. Los cuatro endpoints (`/api/clientes/resumen`, `/api/clientes/cartera`, `/api/clientes/cartera.xlsx`, `/api/clientes/cartera.pdf`) usan un único servicio de lectura, `clientes-cartera-read-model.ts`, con el `resolveReadScope` existente. La pantalla usa una sola respuesta de Cartera para tarjetas y filas; los exportadores solo formatean el mismo modelo. No entregar una superficie protegida y las otras expuestas.

**Atribución:** el sitio del cargo se determina con `movimientos_credito.ticket_id → tickets.ubicacion_id`, comprobando también la relación de cliente. La consulta SQL selecciona los cargos autorizados por sitio; la proyección canónica recibe siempre el ledger completo de cada cliente candidato. Solo después se toman los `pendienteCents` de los cargos autorizados. No cambiar FIFO, aplicaciones, proyección ni vencido: este último conserva fecha anterior a hoy en Ciudad de México.

**Global y conteos:** conservar las cifras y universos anteriores: el resumen incluye todos los clientes activos; tabla/exportaciones excluyen al cliente sistema y filas sin deuda positiva. En alcance acotado, `totalClientes` cuenta clientes activos con notas del alcance, incluidas pagadas; `clientesConSaldo` cuenta los que tienen deuda pendiente allí. Cada cliente se cuenta una vez dentro de una selección múltiple. La pantalla distingue “Clientes activos” global de “Clientes con notas en este alcance”. Los conteos de distintos sitios no son aditivos si un cliente tiene notas en varios; los cargos positivos sin sitio atribuible permanecen solo en el global y también pueden impedir conciliar la suma monetaria de sitios con ese global.

**Saldo a favor:** el global conserva su importe; en respuestas por sitio es `null` y en exportaciones se declara “No atribuible por sitio”. Nunca enviar el saldo a favor global y esconderlo en la pantalla, ni sustituir la falta de atribución por cero. No se corrigió la asimetría de reversos sin ubicación de cobranza ni el corte de caja.

**Presentación:** respuesta y archivos declaran Global o los nombres de sitios efectivos. La selección múltiple no amplía permisos: Caja conserva su sitio incluso con un registro histórico TODAS; ADMIN/SUPERVISOR conservan su lectura autorizada. La pantalla no presenta ni exporta una respuesta cuyo contexto de sesión o alcance ya no corresponda.

**Verificación ejecutada:** typecheck recursivo completo con cero errores; codegen estable al repetirlo; builds de API/frontend aprobados sin arrancar la API; 4 pruebas enfocadas de servidor/exportadores y 8 de contrato/interfaz aprobadas; revisión de alcance sin bloqueantes. Comparación real de solo lectura bajo REPEATABLE READ contra el código anterior aprobada, pero con cero filas de cartera con saldo: no acredita casos positivos por sí sola. La comparación adicional con casos positivos aislados ejecutó la proyección canónica y el código anterior fijado a una revisión inmutable; coinciden resumen, filas y orden. SQL autorizado probado con CTEs VALUES sin inserciones. Navegador aislado aprobado para selección de alcance, exportación y cambios de identidad con caché compartida; todas sus llamadas API fueron interceptadas. La vista previa real mostró login, sin sesión disponible; no se inició sesión. Evidencia y límites en `reports/portfolio-scope/entrega.md`. No se crearon usuarios, sesiones ni movimientos; no afirmar verificación autenticada.

### Bloque 3 — otros endpoints financieros pendientes, sin corregir

Todos son GET bajo `/api/clientes`; conservan sus problemas de alcance. Proteger Cartera no protege automáticamente el directorio ni la ficha del cliente.

- Raíz `/api/clientes` y `/:id`: saldo, favor y límite global cuando hay permiso financiero; consumidores: directorio y ficha.
- `/analitica` y `/analitica.xlsx`: ventas, costos, margen y riesgo; consumidores: pestaña Análisis de Clientes y exportación.
- `/comportamiento-pago` y `/:id/comportamiento-pago`: indicadores de pago/riesgo; consumidores: listado y ficha.
- `/:id/credito`: deuda, favor, disponible y vencido; consumidor: pestaña Crédito de la ficha.
- `/:id/estado-cuenta`, `/:id/estado-cuenta/imprimir`, `/:id/estado-cuenta.xlsx`, `/:id/estado-cuenta.pdf`: movimientos y saldos; consumidores: estado de cuenta y exportaciones.
- `/:id/compras`, `/:id/analitica`, `/:id/estadisticas`: compras, ventas, costos/utilidad e indicadores; consumidores: respectivas pestañas de la ficha.
- `/:id/pagos` y `/:id/pagos/:pagoId`: abonos y detalle financiero; consumidores: historial y detalle de movimientos.
- `/:id/notas/:ticketId` y `/:id/notas/:ticketId/reimprimir`: importes, pendientes y pagos de nota; consumidores: detalle y reimpresión.

Inventario ampliado: `reports/portfolio-scope/pendientes.md`. Estas rutas no se corrigieron ni se conectaron a un nuevo tablero.

La propuesta visual `reports/prompt-k/visual/propuesta-clientes.html` reutiliza el estilo de Proveedores, muestra valores sin conectar y no está integrada en la aplicación.

## Prompt G — contrato mínimo y presentación de documentos

El contrato mínimo autorizado expone `autorizacionEstado` opcional en `TicketDetalle`, con el enum persistido `NO_APLICA | PENDIENTE | AUTORIZADA`. El lector existente ya seleccionaba este valor; no se añadieron consultas, reglas de negocio, códigos de error, sesiones, autenticación ni escrituras de datos. `ObtenerTicketResponse` y `TicketDetalle` generados lo conservan, y la insignia usa ese campo sin inferir autorización desde `cobrado`.

Los nombres visibles siguen centralizados en `documentoTipoLabel` (incluido el fallback “Documento” para un tipo vacío) y la captura usa `formatUnit` (“Pzas.”). Los errores canónicos conocidos se presentan con el nombre del documento; cualquier mensaje de servidor no reconocido permanece intacto para conservar su causa. `/tickets/:id`, el marcado de impresión, enlaces y el módulo de Caja no cambian.

La insignia de documento describe procesamiento en Caja: **Nota autorizada / Nota por autorizar**, o **Ticket cobrado / Ticket por cobrar**. Verde significa procesamiento completado, no deuda pagada; ámbar significa acción de Caja pendiente; azul significa falta de confirmación del procesamiento. Las respuestas incompletas muestran esa falta de confirmación, sin inferir una autorización. Estos significados están comentados junto a las clases de color. La insignia independiente de **Estado de Nota** sigue describiendo cobranza, con sus cuatro estados, colores y precedencia intactos.

La comprobación corregida pasó el fixture por `ObtenerTicketResponse.parse` antes de enviarlo al componente real. En escritorio y 402 px mostró **Nota autorizada** junto a **ABONO PARCIAL** con `cobrado=false`. Son datos sintéticos, no una nota real autenticada. La captura de cantidades ya separaba unidad y valor: no se reprodujo solapamiento con 309 dígitos finitos, por lo que no se alteró su composición ni validación.

Registro histórico de activación de Prompt G: **activado en desarrollo mediante reinicio normal autorizado expresamente por el propietario**. Se detuvo únicamente el proceso anterior identificado de la API que ocupaba 8080 y se reinició el workflow administrado. Los inicializadores terminaron sin errores y el backfill de compras informó cero inserciones. En aquella captura ambos workflows funcionaban y la vista previa mostró login/401; no acredita servicios activos durante E1. No se crearon usuarios, sesiones ni movimientos de prueba. No se aprobó navegación autenticada ni se publicó una versión. Typecheck completo en cero, codegen estable y builds aprobados; los últimos textos se comprobaron además con seis pruebas enfocadas y typecheck frontend. Resultado por paquete, capturas y límites en `reports/prompt-g-after/entrega.md`; evidencia de arranque en `reports/prompt-g-after/activation-api.log`.

## Prompt P — antecedente del criterio; sustituido parcialmente por E7

Familia A: directorio `/clientes`, `/clientes/analitica`, su XLSX y `/clientes/comportamiento-pago`; sus operaciones económicas se restringen al alcance resuelto con el criterio de Cartera. El límite es un parámetro global, nunca un límite prorrateado por tienda.

Familia B: ficha `/:id`, crédito, estado de cuenta y sus archivos, comportamiento individual, compras, analítica, estadísticas, pagos y sus detalles, notas y POST de reimpresión. Con permisos financieros, la excepción global aprobada incluye **solo deuda actual, saldo a favor, límite y crédito disponible**. Compras, movimientos, pagos, documentos y desgloses quedan restringidos al alcance. Ver al cliente o conocer un ID no autoriza operaciones de otro sitio. El POST de reimpresión debe aplicar el mismo control y conservar la auditoría, sin ejecutarlo contra la base para probarlo.

Leyendas obligatorias, también dentro de exportaciones: **“El resumen global de crédito considera todos los sitios.”** y **“El detalle corresponde solo a los sitios autorizados y no representa la deuda total del cliente.”** El límite debe identificarse como global donde aparezca. Nunca calcular disponible restando solo deuda local. FIFO permanece global: se restringe la entrega después de proyectar, no se reconstruye una deuda independiente por tienda.

Regla derivada: filtrar de menos expone información y filtrar de más induce decisiones de crédito equivocadas. La deuda mostrada para autorizar debe coincidir con la proyección que valida el servidor, o la diferencia debe declararse. Las exclusiones administrativas globales y el catálogo de precios negociados se conservan.

**Estado histórico sustituido parcialmente el 2026-09-23:** Grupo 1 no estaba aprobado y grupos 2–4 no se iniciaron. Las liberaciones E7 posteriores abren el resumen global de cuatro cifras, el detalle financiero por sitios autorizados y la atribución financiera de solo lectura por periodo/alcance, proyectando FIFO global antes de filtrar y conservando las leyendas en exportaciones. No abren atribución histórica E1, operaciones E5, grupos 2–4 ni POST de reimpresión. Resultados y límites: `reports/liberacion-e9-e7-e11-20260923/INFORME.md` y `reports/e9-e5-e7-continuacion-20260923/INFORME.md`.

La comparación aislada ejecutó handlers anteriores y actuales con el mismo fixture global y encontró coincidencia en las hojas principales de los dos XLSX y el contenido monetario extraíble de HTML/PDF; no acredita todos los casos reales ni el alcance restringido. Regresiones existentes: 51/51 antes y después; con tres pruebas nuevas, 54/54, sin que estas pruebas insuficientes cierren los bloqueos. PDF genérico: mismo fallo preexistente de URL larga, 4/5 antes y después, sin corregir. Typecheck de API aprobado; no se afirma typecheck completo ni navegador autenticado para esta entrega. Detalle en `reports/financial-read-scope/group-1.md`. El inventario `reports/portfolio-scope/pendientes.md` sigue abierto.

## Prompt Q — antecedente de diseño de atribución

Esta sección conserva el estado del diseño de Prompt Q, anterior a la liberación E2 CLOSED documentada más adelante; no describe por sí sola el runtime posterior.

Documento histórico de decisión para el propietario y su socio: `reports/prompt-q-diseno-atribucion-sitio.md`. Identificó la ausencia de sitio y sesión explícitos en `movimientos_credito` como una causa común de tres defectos: abonos omitidos del corte, asimetría de cobranza por sitio y pérdida de abonos sin ticket en el estado de cuenta restringido. E1 ya incorpora el esquema de origen, naturaleza y evidencia con DDL verificado; agregar esas columnas no activó los lectores. La preparación posterior del lector de caja corresponde a E2, sin declarar activación ni aceptación operativa.

## Apertura limitada y arranque acotado — antecedente de preparación

Los resultados de esta sección corresponden a las revisiones y fases históricas citadas. En particular, el fallo de instalación de `f8818255` no es el estado final de E2: las validaciones posteriores y la liberación CLOSED se documentan en la sección siguiente. Se conserva el fallo original sin reescribirlo como aprobado. La apertura de captura y devolución sigue siendo una decisión separada.

El propietario autorizó preparar únicamente ABONO/INGRESO_FISICO/EFECTIVO con sitio y sesión correctos. Ingreso y devolución tienen permisos separados, ambos apagados por defecto; retenidos y atribución histórica siguen cerrados. El SQL de apertura/reversión y los parches de activación no se aplicaron. La interfaz candidata se probó en copias temporales y permanece en archivos de parche, sin alterar el frontend servido durante el primer corte real.

**Decisión del propietario y bloqueo de apertura:** eligió A + C: generar evidencia desde el primer abono y decidir aparte cuándo abrir la captura. Acepta que la devolución no sea inmediata, pero no que falte la evidencia necesaria para una futura devolución elegible. Presentar la integración antes de implementarla: no conectar indiscriminadamente el hook que rechaza abonos aplicados ni cambiar FIFO. La captura queda bloqueada hasta construir y verificar la evidencia, y requiere autorización de apertura separada. La regla sigue siendo importe íntegro nunca aplicado; devoluciones de abonos aplicados o parcialmente utilizados quedan fuera. Recuperar la API y hacer el primer corte de tickets no levanta este bloqueo.

Diseño aprobado y construcción offline autorizada: `reports/e2-apertura-limitada/diseno-a-c-antes-de-implementar.md`. Preparación offline A+C completada en fuentes inactivas: revisión independiente corregida y reconfirmada, SQL de devolución reconciliado con propietario único de evidencia, contrato/digests V3, 428/428 pruebas ampliadas, 24/24 mutantes rechazados con restauraciones verdes, 29/29 enfocadas y typecheck raíz exit 0/cero diagnósticos tanto del candidato congelado como de `80eaa93d`. Ordinario conserva proyección canónica; dirigido documenta su aplicación explícita íntegra, sin atribuirle un FIFO posterior. **Validación PostgreSQL posterior autorizada: FAIL de instalación de la revisión exacta `f8818255` en PostgreSQL 16.10**, por error sintáctico en `e2_validate_abono_finalization`. No se parcheó el candidato; reversión/commit/rollback/reintentos/concurrencia quedaron bloqueados. Se usó una sola base nueva aislada y se destruyó; no se conectó la base de API ni clones E1/E10, no se reinició API ni cambió bundle o permisos. La corrección y validación de una revisión nueva quedan pendientes; apertura no autorizada. Autorización textual y resultado en `reports/e2-apertura-limitada/evidencia-a-c/postgresql-validacion/resultado.md` y `estado-offline.md`.

La comparación de permisos contra respaldo E10 confirmó cero diferencias efectivas (3,968 decisiones de acceso), solo timestamps conocidos: `reports/e2-apertura-limitada/permisos-respaldo/resultado.md`. La reconstrucción única desde `7cb77f8cfc6287fa51325a25122c48af392a7ada` produjo SHA `3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98`. Tras la detención inicial, el propietario corrigió el criterio, verificó la revisión E10 y aceptó expresamente ese resultado como autorizado. Evidencia y reglas de identidad en `reports/e2-apertura-limitada/reconstruccion/autorizacion-bundle-7cb.md`.

El arranque `EXPLICIT_LIMITED` comprueba esquema, identidad y guardas en transacción READ ONLY antes de importar HTTP/escuchar; no ejecuta inicializadores, backfills ni poller. Prepararlo no autoriza usarlo. El paquete, condiciones de ejecución, dependencia de evidencia de origen, reversión y lista de mostrador están en `reports/e2-apertura-limitada/paquete-revision.md`.

Verificación de la preparación anterior a los cambios A+C: 67/67 en aplicación, 17/17 en arranque; candidato frontend 2/2 cerrado, 4/4 activo y 7/7 de contrato; SQL estructural y 10 negativos. Typecheck canónico final exit 0/cero diagnósticos. Los mismos manifiestos de baseline contienen 154 pruebas (una prueba de guarda global fue sustituida por seis): 149 PASS y exactamente los cinco fallos previos, sin nuevos. Reconfirmación acotada y hashes en `reports/e2-apertura-limitada/verificacion/final-reconfirm-summary.txt`. No se ejecutó PostgreSQL para esas comprobaciones ni se activó el flujo. Estos resultados no sustituyen la validación pendiente del candidato A+C posterior.

## E2 — lector CLOSED liberado; captura y devolución cerradas

**Estado documentado al 22 de septiembre de 2026:** `reports/e2-liberacion-20260922/resultado.md` registra la liberación técnica E2 CLOSED, la instalación autorizada de las dos tablas A+C y el arranque en inspección del bundle SHA-256 `008dfd54d93f6a1606370d44cb2086673669c51278c92ebb6a5a63f4d503e7f5`. El artefacto 7cb anterior quedó retenido. La comparación posterior a esa liberación conservó datos, catálogo y secuencias; no hubo login ni cierre creado por el agente. El primer cierre real quedó pendiente exclusivamente del propietario. Captura, devolución, retenidos, atribución, Fondo, remate, precio mínimo y borrado preparado de producto continuaron cerrados.

**Límite de actualidad y cronología anterior a la autorización del 2026-09-23:** la reanudación observada está en `reports/e2-liberacion-20260922/verificacion-reanudacion-workflow-api.md`; ese episodio no incluyó una comparación de filas y secuencias antes/después de su arranque. El intento posterior de fase B E3 se detuvo ante un PID distinto, aunque el hash del bundle coincidía (`reports/e3-fase-b-detenida-20260923.md`); en ese intento no se comprobó la conexión efectiva ni el modo del proceso nuevo y no se abrió E3. Posteriormente, la tarea 4 de Tanda C sí comprobó la conexión efectiva del PID 191 mediante una transacción READ ONLY, sin escrituras (`reports/tanda-c-20260923/04-creditos.md`). La tarea 7 registró captura READONLY y preflight CLI reales PASS, pero la reconstrucción del fixture quedó bloqueada por diferencias de `enumsortorder` de `rol_usuario`: no se arrancó el candidato ni se liberó Tanda B (`reports/tanda-c-20260923/07-paquete-tanda-b.md`). El READ ONLY de esas consultas no prueba el modo de arranque actual de la API. Estos reportes conservan el estado histórico previo; la autorización posterior para arrancar y liberar se limita a «Liberación simple temporal».

Los párrafos de preparación y sus pruebas que siguen conservan sus revisiones y límites históricos. La liberación del lector no equivale a ejecutar el SQL de devolución ni a activar sus productores; tampoco instala las fuentes nuevas de E3 o Tanda B por el hecho de existir en el repositorio.

**Alcance autorizado:** `reports/e2-alcance-autorizado-2026-09-18.md`. El propietario confirmó construir la devolución **inactiva**, sin eliminar ni eludir ninguna guarda de E1. El SQL de soporte de devolución está preparado, no aplicado; no lo ejecuta ningún inicializador. Esta preparación no autoriza escrituras en la base ni la activación posterior. Tampoco autoriza reiniciar la API con inicializadores que escriben.

**Fórmula E2:** fondo inicial + cobros físicos de tickets en efectivo + abonos físicos en efectivo + cobros físicos retenidos − salidas físicas de la sesión. Se calcula en centavos exactos y se presenta con desglose documental. Tres invariantes: (1) las identidades de recepción son disjuntas entre grupos; no se deduce una conversión de retenido por importe, cliente o fecha y un productor no soportado falla explícitamente; (2) la devolución representada por una salida no se resta de nuevo desde REVERSO; (3) no se suman aplicaciones, por lo que pagar varias notas no multiplica la recepción. La conversión operativa de retenido a abono no está implementada en E1/E2 ni se declara verificada.

**Caja abierta para efectivo, no para transferencia.** El efectivo físico requiere una sesión ABIERTA del mismo sitio, bloqueada durante la operación para coordinarse con el cierre: representa dinero de ese cajón. Una transferencia usa cuenta bancaria y no imputa sesión. Las correcciones contables y operaciones de crédito sin dinero no entran al cálculo físico. Las guardas de E1 permanecen cerradas, incluso para efectivo con una sesión válida.

**Devolución física preparada:** solo ADMIN activo y autorizado, motivo obligatorio, importe íntegro y recepción física nunca aplicada que permanezca totalmente disponible. No se usa solo el saldo global ni solo la ausencia de aplicaciones. El servicio verifica origen, evidencia, proyección vigente e historia bajo los candados del cliente; exige la sesión abierta actual del sitio. Claim, disposición única, salida, evidencia y auditoría son atómicos en el diseño transaccional; únicamente un abono tiene reverso en el ledger. **El corte donde entró originalmente el dinero nunca se modifica:** la salida pertenece a la sesión actual.

**Retenidos:** un cobro retenido es devolvible mientras permanezca íntegro y nunca aplicado. No se fabrica un ABONO ni un REVERSO para devolverlo. La preparación exige evidencia positiva de origen; los productores futuros tendrán que integrarla dentro de su transacción autorizada. No se habilitó captura de retenidos, no se creó conversión E5 ni se rellenaron históricos.

**Históricos:** el cierre nuevo prepara un snapshot versionado en el INSERT existente de auditoría, dentro de la misma transacción y bloqueo de sesión. Cerrados con snapshot válido leen ese snapshot; uno inválido causa error explícito. Los cerrados anteriores conservan los valores de su superficie, incluida la fórmula administrativa previa que no restaba salidas. No se corrige silenciosamente esa divergencia ni se hace backfill. Esto permite un único lector con compatibilidad histórica, no promete que las fórmulas antiguas discrepantes se hayan vuelto iguales.

**Importes del negocio:** incorporar una recepción al corte no aumenta Ventas, Contado cobrado ni Cobranza del periodo. No se modifican FIFO, deuda global, saldo a favor, límite de crédito ni candados producto–ubicación. No se habilita Fondo ni se reanuda Prompt P.

**Trazabilidad y papel:** el detalle compartido muestra los componentes, folios y enlaces existentes, más referencia, motivo, fecha y nombres cuando existen. Una salida monetaria existente no tiene folio ni página propia: se expone su evidencia real dentro del corte; no se inventa un recibo ni un folio de E3/E4.

**Verificación y límites:** los resultados de esta preparación, revisión exacta y manifiestos están en `reports/e2-verificacion-2026-09-18/` y en el informe de preparación E2. La lectura real `reports/e2-historico-lector-final.json` encontró **cero sesiones cerradas**, con READ ONLY confirmado; salió con código interno 2, no PASS histórico. No se crearon sesiones para fabricar esa evidencia. No se ejecutaron devoluciones/cierres reales ni SQL de soporte; las pruebas simuladas no acreditan concurrencia PostgreSQL, rollback real ni activación operativa.

Confirmación de la preparación inicial E2, anterior a la apertura limitada: typecheck canónico **exit 0 / cero diagnósticos**, suite seleccionada de 149 pruebas con **144 PASS y exactamente los cinco fallos de `80eaa93d`, sin fallos nuevos**. Fuente exacta: HEAD `1ad2cad601a667c586e084accbf52b3ca3b7cef7` más manifiesto de 4,066 archivos con SHA-256 agregado `2f075fd4533845ba694ff4d12a1ee7a1e70690eca82e24600f6302c9b469e292`. Detalle y límites en `reports/e2/preparacion-y-limites.md`; salidas terminales en `reports/e2-verificacion-2026-09-18/latest-final-*`. Las 16 pruebas nuevas de efectivo, 25 de devolución/opciones y dos de interfaz pasaron en aislamiento offline; las mutaciones negativas no sustituyen pruebas PostgreSQL.

La regla vigente de origen es la de «E1 — origen y evidencia de crédito»: recepción y aplicación son hechos distintos y el FIFO global puede repartir entre tiendas. No se impone una distribución nueva por notas propias ni se deriva el origen desde la nota. La sesión requerida para efectivo real tiene soporte estructural, pero su captura está cerrada; incorporar esos abonos al corte sigue fuera de E1.

**Antecedente sustituido parcialmente:** Prompt P permanecía detenido por
instrucción expresa del propietario, con Grupo 1 sin cerrar y grupos 2–4 sin
continuar. Las autorizaciones E7 posteriores abren únicamente lectores y
atribución financiera de solo lectura; no reanudan operaciones E5, atribución
histórica E1 ni grupos 2–4. Las decisiones de E1 siguen en su sección canónica;
las demás alternativas de Prompt Q no autorizan ampliar el trabajo.

En esta sesión de diseño se ejecutaron dos transacciones `REPEATABLE READ READ ONLY` con la conexión configurada para el proyecto, sin iniciar la API. Identidad consultada: `heliumdb/public`; snapshot principal del 16/09/2026 a las 23:22:37 CDMX: 3 movimientos, 1 venta con ticket y 2 abonos sin ticket; cero reversos y ajustes. Se revisaron columnas, restricciones, índices, triggers y relaciones agregadas. No se verificó el pool de un proceso API activo ni una base publicada independiente. La cifra histórica de $25,000 en Cruces frente a $0 neto global proviene de informes anteriores y no demuestra efectivo físico adicional. No se reejecutó ese episodio.

En la sesión histórica de Prompt Q solo se escribió documentación: no hubo cambios de aplicación, contratos, esquema o datos, ni migraciones, usuarios, sesiones de prueba, reinicios, pruebas funcionales, typecheck o codegen. Esa descripción no niega el DDL posterior de E1 ni cierra ninguno de los tres defectos.

## Prompt S — unificación mecánica y límites de verificación

Resultado: `reports/prompt-s/entrega.md`. Se sustituyeron únicamente las seis condiciones completas inventariadas en `admin-analytics.ts`, con alias `f` y `t`, por `accountedDocumentPredicate`. Incluyen `VENDIDO` y ambas ramas; el booleano `cobrado` tiene la misma semántica que `cobrado=true`, incluido NULL. No se cambió el helper canónico ni se reformateó SQL ajeno a la sustitución. `destinationReadModel`, FIFO y la proyección quedaron intactos.

**Variantes sin unificar, pendientes de evaluación separada:** en `admin-analytics.ts` hay filtros por `VENDIDO` sin discriminación documental, `VENDIDO AND cobrado` sin tipo y ramas exclusivas de NOTA autorizada sin TICKET; estas últimas pueden ser restricciones deliberadas a crédito. Las ramas de aplicaciones de `destinationReadModel` exigen `sale_ticket.estado='VENDIDO'`, no las dos condiciones de procesamiento, y siguen protegidas. `admin-alertas.ts` usa la expresión `cobrado=true OR autorizacion_estado='AUTORIZADA'` sin tipo ni estado en esa expresión. `reportes-inventory.ts`, la primera compra de `routes/clientes.ts` y consultas de caja/POS usan filtros operativos por estado; las condiciones JavaScript de Salidas resuelven entrega por tipo y procesamiento, no son copias SQL. Ninguna de estas diferencias se corrige como si fuera equivalente: ubicaciones, alias y contexto exactos en `reports/prompt-s/inventario.md`. Los helpers canónicos de contado, crédito e impago permanecen deliberadamente distintos, no son duplicaciones pendientes.

**Guardia de recurrencia:** `artifacts/api-server/src/lib/accounted-document-source-guard.contract.ts`, registrada en `test:accounted-document-source` y en `test:admin-analytics`, barre las fuentes mantenidas, incluidos `.mts` y `.cts`, y detecta copias completas tolerando espacios y alias. Se comprobó ejecutando la prueba real con una copia `.mts` introducida en un árbol temporal: exit 1; al retirarla, exit 0. No se sustituyeron módulos vigilados para probar el fallo.

**Verificado en esta sesión:** paridad de todos los campos de las dos funciones afectadas sobre un mismo snapshot real de solo lectura, ocho pares de resumen y margen de sesión; casos adicionales con SQL real sobre CTE `VALUES`, sin escrituras. Se comprobó la banda de Cobranza contra el total canónico de Cuentas Destino, separada de Contado cobrado; también la identidad de ventas y la conciliación positiva de tres filas/$180 en tres y dos páginas. Guardia 3/3. `pnpm run typecheck` completo terminó en cero; el último ajuste de la guardia se volvió a comprobar con typecheck de API. Codegen ejecutado sin diferencias.

**No está toda la regresión en verde:** el mismo manifiesto de 28 archivos dio 215 pruebas, 210 aprobadas y cinco fallos idénticos antes/después. Son dos aserciones de `pos-caja-final.contract.test.ts`, una de `tiempo-real-breakdown.contract.test.ts`, una de `tiempo-real.contract.test.ts` y una de `detail-link-tables.contract.test.ts`; no se alteraron para aprobar artificialmente. Suites de integración con escrituras quedaron fuera. No se reiniciaron servicios, ejecutaron inicializadores ni crearon usuarios/sesiones; no se acredita activación o navegación autenticada. Prompt P sigue detenido y su Grupo 1 sin cerrar.

## Regla de aceptación de pruebas de contrato

Una prueba de contrato comprueba **comportamiento observable, nunca la forma
textual del código**. No depende de nombres de variables, ternarios escritos
literalmente, orden de clases CSS, condiciones textuales ni número de
apariciones de una cadena en la fuente.

Antes de escribir o reescribir una prueba, se declara la regla vigente que debe
comprobar y su referencia en este documento. Si la regla no está documentada,
se informa expresamente; una expectativa antigua no autoriza restablecer un
flujo retirado. Las pruebas de interfaz montan los componentes reales y observan
sus resultados e interacciones, no una copia de su implementación.

**Si una prueba de contrato falla y el código parece correcto, primero se
comprueba si la regla escrita es equivocada o contradictoria.** Se revisa el
documento completo, se distingue a qué pantalla corresponde cada instrucción
y se consulta la decisión del propietario si hay conflicto; ni la prueba ni
la documentación se presumen infalibles. Confirmada la regla, se elimina la
redacción sustituida y se conserva una sola declaración canónica con referencias
desde las demás secciones, antes de decidir si hay que corregir la prueba o
la aplicación. Un fallo no autoriza por sí solo a cambiar código correcto.

**Una prueba nueva o reescrita solo se acepta después de verla fallar con el
defecto que debe detectar.** La comprobación introduce el defecto en una copia
aislada, ejecuta el corredor real y conserva el código de salida y la aserción
semántica fallida. Un error de importación, compilación o preparación no acredita
esa detección. Se retira el defecto de la misma copia y se exige aprobación.
Nunca se sustituyen temporalmente archivos servidos por la aplicación.

No se omiten pruebas para obtener verde ni se cambia el comportamiento de la
aplicación para satisfacer una expectativa. Si una reescritura requiere cambiar
la aplicación, se detiene ese caso y se reporta para decisión del propietario.

## Plan U — respuestas documentales del 2026-09-18

Fuente textual: `reports/prompt-u-respuestas-2026-09-18.md`. **Solo documentación:** no autoriza implementación, migración de cuentas, activaciones, SQL ni reinicios. El plan original `reports/prompt-u-plan-de-implementacion.md` se conserva como antecedente sin editar; las sustituciones de decisiones se enumeran aquí. Los conflictos expresamente contestados se marcan resueltos para construcción futura; los demás no se resuelven por precedencia automática.

- **P4 / E5 — sustituye la pregunta 4 pendiente:** rechazo de destino por ADMIN deja el dinero esperando otra propuesta. Si el cliente pide devolución, aplica importe completo nunca aplicado, solo ADMIN. No se introduce FIFO por rechazo.
- **P5 / E5 — sustituye la pregunta 5 pendiente:** se permite autorizar una parte y dejar el resto esperando; una propuesta puede abarcar varias notas del mismo cliente. El propietario acepta que el remanente tras una aplicación parcial deja de ser devolvible. No autoriza favor disponible; el procedimiento de P6 se precisa abajo.
- **P6 / E5 — sustituye la pregunta 6 pendiente y la nota anterior que dejaba su procedimiento sin contestar:** sin ADMIN, un pago dirigido solo se acepta por el importe exacto del saldo pendiente de la nota o notas indicadas, sin exceso. Si se pagan por otro medio durante la espera, aplica P4: el dinero espera otra propuesta o ADMIN lo devuelve completo bajo la condición vigente de importe íntegro nunca aplicado. No se habilita devolución de remanentes parcialmente aplicados ni favor automático.
- **P7 / E5 — sustituye la pregunta 7 pendiente:** el dinero dirigido sin aplicar se destaca y se avisa a ADMIN a partir de 3 días desde la recepción. No se redefine la fecha de recepción ni se inventa una hora de corte.
- **P8 / E9 — sustituye la pregunta 8 pendiente respecto de modalidad de entrega, autor del envío y diferencias:** cada tienda entrega su efectivo completo al cierre. ADMIN o SUPERVISOR documenta el envío. ADMIN cuenta y autoriza en Mariana; una diferencia abre investigación. No se ajusta automáticamente ni se modifica un corte cerrado. El 22P02 de `e9_validate_detail` era precedencia incorrecta al restar claves de `detail.investigacion`; quedó corregido, pasó el productor real en PostgreSQL desechable y su SQL mínimo fue COMMIT verificado en la base efectiva. E9 documental API/UI está ON. La custodia permanece separada de Fondo y `E9_FONDO_INGRESS_ENABLED` sigue OFF.
- **P9 / E11 — sustituye expresamente el alcance anterior del plan:** quedan sustituidas las frases «Ve todas las ventas y cobranza, facturadas o no» y «No filtrar su análisis exclusivamente por lo fiscal», así como el pendiente de que ContadorF concilie pagos a proveedor. ContadorF solo ve facturas, clientes facturados y ventas facturadas; no ve ventas no facturadas, Fondo ni pagos a proveedor. El manejo fiscal del Fondo se lleva fuera del sistema. Se añade un botón para aceptar que las ventas facturadas cuadran con su registro externo: aceptación diaria opcional, semanas y meses siempre aceptados; si marca «no cuadra», se notifica a ADMIN para abrir investigación. No se inventan vencimientos ni aceptación automática. La aceptación de conciliación no autoriza operaciones monetarias. **ContadorA queda como estaba en el plan.**
- **P10 / E11 — sustituye la pregunta 10 y el pendiente de asignación del plan:** toda cuenta CONTADOR sin A expresa se resuelve como ContadorF; el propietario asigna ContadorA a mano mediante el selector ADMIN habilitado. No se asignó automáticamente ningún usuario. F pierde todo acceso fuera de lo facturado y ningún perfil CONTADOR registra pagos a proveedor o de cliente. La herramienta de asignación no habilita preparación E5.
- **P12 / E12 — conflictos de retiros e inversos RESUELTOS:** pagos/retiros superiores al saldo registrado se bloquean; el desbloqueo ADMIN, con motivo obligatorio e historial, aplica **solo a caja**, no al Fondo. Sustituye la amplitud inicial que incluía Fondo en la excepción. Un retiro nunca deja el Fondo en negativo; por decisión del 2026-09-21, una corrección contable de un error de captura sí puede dejar saldo negativo y debe mostrarlo expresamente, conforme a E10. Esta respuesta no modifica el límite de crédito del cliente ni habilita el desbloqueo ahora.
- **P13 / E12 — sustituye la pregunta 13 pendiente:** pago a proveedor completo desde Fondo sin turno abierto; si usa caja, esa parte exige sesión abierta de Mariana. Se conserva proveedor exclusivo de Mariana; no se habilitan pagos mixtos ni conexiones E12.
- **P14 / E12 — sustituye la pregunta 14 pendiente:** al corregir o recuperar un pago mixto a proveedor, el dinero regresa a cada origen por lo que salió de cada uno; no se elige otro destino. Esto no registra una devolución física ni sustituye las reglas de inversos contables de E10.
- **Decisiones adicionales:** se confirma la prohibición de facturar ventas con líneas por metro y la confirmación de borrado con usuario y contraseña ADMIN, actualizadas en sus secciones. El conflicto de producto con solo historial de precios queda **resuelto para construcción junto con remate y precios**: se borran producto sin movimientos y sus renglones de precio, conservando bitácora; no se ejecuta ahora. Los movimientos #51, #52 y #53 se conservan «Sin sitio determinado»; **los 69 vetos de acción por rol siguen pendientes**, sin modificación de permisos.

**P9/P10 RESUELTO:** la conservación de accesos financieros amplios, Cuentas destino/consultas de caja y permisos de pagos del CONTADOR anterior no se traslada como excepción a ContadorF. Al construir E11 se retira todo lo que quede fuera de lo facturado y todo registro de pagos a cliente/proveedor, incluso si estaba concedido en su configuración anterior. No se cambiaron permisos actuales.

Las respuestas textuales y las resoluciones de P9/P10, retiros e inversos P12/E10, remate/matriz y producto/historial se conservan en el informe citado. La ampliación del 2026-09-21 también resuelve precio de lista sin costo, retiro de remate por ADMIN con motivo e historial y cambio de precios mediante matriz. Siguen pendientes la tensión de la purga completa y la amplitud de «SISTEMAS opera todo» frente al cambio de precios solo ADMIN, reportada sin modificar esa regla. No se dan por contestadas otras preguntas del plan ni se altera el estado inactivo de los flujos preparados.

## Decisiones futuras — remate, precios y purga

Fuentes: decisiones conservadas en `reports/prompt-u-respuestas-2026-09-18.md`, preparación histórica del 2026-09-19 y autorización vigente `reports/tanda-d-20260923/autorizacion.txt`, punto 1. **Remate, piso de precio y borrado individual de producto sin movimientos están ON en fuente por Tanda D.** Esta apertura sustituye su preparación inactiva anterior, no abre ninguna otra puerta ni autoriza ejecutar la purga general. SQL, pruebas y límites de instalación en `reports/tanda-d-20260923/tarea1.md`; el build offline de integración no demuestra despliegue ni ejecución en la base real.

1. **Remate — vigente ON por Tanda D (2026-09-23); matriz configurable.** «Marcar remate» es permiso de matriz, ADMIN por defecto y denegado al resto salvo personalizaciones existentes. API, adaptador y control de detalle de rollo están montados, por rollo y con motivo obligatorio. La venta solo admite bajo costo las fuentes físicas con marca activa, nunca todo el producto ni una declaración del cajero. BOLSA verifica dentro de la transacción los costos de las fuentes reales de FIFO; una fuente bajo costo no autorizada provoca rollback. Se conserva la pérdida en utilidad mediante ingresos/costos congelados y se muestra la señal histórica en el detalle web de Ticket/Nota desde auditoría. **Retiro:** solo ADMIN con motivo obligatorio, bloqueo del rollo y auditoría atómica; se elimina la marca activa, no el historial original ni la señal de ventas anteriores. No se autoriza editar la marca original. Implementación, SQL y límites de pruebas en `reports/tanda-d-20260923/tarea1.md`; el build no acredita por sí solo despliegue.
2. **Precios — piso vigente ON junto con remate.** No hay techo de subida; el piso es el costo registrado. Sin costo se permite asignar precio de lista y se conserva el bloqueo de venta por costo del rollo. Las mutaciones individual/masiva y UI aplican el piso sin alterar el cálculo canónico. La regla documental de cambios ADMIN-default mediante matriz, no veto fijo por rol, se conserva; el default histórico de SISTEMAS requiere la revisión señalada en el informe de tarea 1, sin sobrescribir personalizaciones.
3. **Purga pendiente — al terminar las entregas y cuando el propietario decida operar con datos reales.** En ese momento se hará la purga completa de datos de prueba y se restablecerá el procedimiento completo, incluido el procedimiento aplicable de respaldo, ensayo en copia desechable y ejecución autorizada. Incluye expresamente los movimientos #51, #52 y #53 sin sitio. **No se prepara ni se ejecuta nada ahora:** la autorización de liberación simple del 2026-09-23 no autoriza la purga, y no se reutilizan autorizaciones ni listas históricas como permiso para ejecutarla. Los tres movimientos continúan hoy «Sin sitio determinado»; su inclusión futura no los atribuye ni los elimina ahora.

**Estado de conflictos:** remate/matriz queda resuelto mediante permiso configurable; los 69 vetos pendientes no se resuelven con ello. El borrado individual de producto sin movimientos junto con su historial de precios queda resuelto por decisión expresa independiente y se construye junto con remate y precios, conservando bitácora. La purga completa futura sigue en tensión con la prohibición de DELETE operativo y la conservación del histórico financiero: las purgas excepcionales anteriores no autorizan otra ejecución ni se define aquí cómo sortear esas reglas.

El registro histórico de confirmación bajo costo no se reescribe como si ya hubiera sido un bloqueo. P9/P10, el alcance del desbloqueo P12 y la distinción de E10 entre retiro y corrección contable están resueltos para construcción futura. La amplitud de «Opera todo» en la descripción de SISTEMAS, que menciona diagnóstico de precios sin distinguir consulta de modificación, se reporta en `reports/prompt-u-respuestas-2026-09-18.md` frente al cambio de precios configurado solo para ADMIN; no se resuelve modificando esa regla ni permisos. Estas decisiones no dan por terminada ninguna entrega ni abren flujos operativos.

## E10 — Fondo de Mariana

**P12/E10 — conflictos RESUELTOS por el propietario:** el desbloqueo ADMIN motivado e histórico por insuficiencia aplica solo a caja (2026-09-18). Un retiro del Fondo no puede exceder saldo ni dejarlo en negativo; no tiene esa excepción. La precisión del 2026-09-21 permite que una corrección contable de un error de captura deje saldo negativo, mostrado expresamente, conforme a la regla de inversos de E10. Queda resuelto el conflicto entre retiro y corrección contable; no se implementan cambios ni se habilita el Fondo. Véase `reports/prompt-u-respuestas-2026-09-18.md`.

**Estado de habilitación:** fase aislada PostgreSQL, HTTP y navegador verificada;
SQL operativo aplicado el 18/09/2026 con autorización textual separada:
`COMMITTED_VERIFIED`, 30/30 sentencias, cero movimientos y cero arqueos.
Evidencia: `reports/e10-operativo-2026-09-18/resultado-operativo.md`.
El Fondo sigue sin habilitarse. La vista privada ya fue detenida. Las banderas
`FONDO_E10_ENABLED` y `VITE_FONDO_E10_ENABLED` permanecen apagadas por omisión.
No repetir el SQL operativo. La API no se pausó ni reinició para este DDL
aditivo; se verificó su pool vivo y se acotaron bloqueo y transacción.
La habilitación y cualquier saldo inicial real siguen pendientes de autorización
textual separada. Movimientos, historial y arqueo se habilitan juntos, nunca un
piloto de movimientos sin arqueo. Conservar ambos clusters aislados y el respaldo
local/Drive hasta el cierre completo de E10; esta instalación no lo declara cerrado.

### Reglas canónicas de E10

Fuente: especificación E10 del propietario y
`reports/e10-autorizacion-fase-aislada-2026-09-18.md`. Estas son reglas nuevas;
no sustituyen las reglas del fondo inicial de una sesión de Caja.

- Hay un único Fondo, siempre en la ubicación Mariana identificada por el
  servidor. No existe selección de tienda ni saldo editable.
- Sólo el rol real `ADMIN` puede obtener pantalla, datos, movimientos, detalles
  o archivos. Un permiso configurable no concede acceso a otro rol. La
  exclusividad incluye auditoría y exportaciones genéricas; no se difunden
  datos del Fondo mediante notificaciones generales ni totales compartidos.
- El saldo procede de la suma exacta del libro, en centavos. Su navegación
  abre los movimientos que lo explican; cada movimiento y arqueo tiene detalle.
- El primer ingreso lleva motivo «saldo inicial» y reconoce efectivo existente,
  no una venta, cobro de cliente ni capital nuevo. Se conserva la evidencia de
  conciliación y la declaración de no duplicar efectivo ya registrado en Caja
  o entregas. El propietario debe contar y reconocer el importe real.
- Los siguientes ingresos directos distinguen capital y otros ingresos. Todos
  los movimientos llevan motivo. Un retiro genérico no registra ni sustituye
  un pago a proveedor.
- No se edita ni elimina un movimiento. Se corrige mediante un inverso exacto,
  enlazado y único, conservando el original. El inverso es una corrección
  contable, no evidencia de una nueva entrada o salida física; puede dejar un
  saldo contable negativo que se muestra expresamente. Un retiro ordinario no
  puede exceder el saldo disponible.
  **Confirmado por el propietario (2026-09-21):** corregir contablemente un error
  de captura puede dejar saldo negativo, que debe mostrarse expresamente.
  La prohibición de dejar el Fondo en negativo corresponde a los retiros;
  no bloquea esa corrección ni habilita retiros sobre saldo.
- El arqueo persiste saldo de referencia, efectivo contado, diferencia
  `contado - saldo`, fecha, autor, motivo y versión de movimientos. No genera
  ajuste monetario. Si cambia el libro durante el conteo, exige revisar el
  conteo; no sustituye silenciosamente el saldo de referencia.
- Escrituras e inversos comparten un candado propio. Los reintentos idénticos
  no duplican; reutilizar la clave con otro contenido se rechaza. Saldo e
  historial se leen sobre la misma instantánea.
- Ningún movimiento del Fondo modifica Ventas, Contado cobrado, cobranza,
  deuda de clientes, crédito/FIFO, cierres de tienda ni inventario. No se
  reutiliza el saldo de Caja ni se etiqueta como efectivo total de empresa una
  cifra cuya composición no esté conciliada.
- E9 documental habilita envío, conteo, autorización de custodia e
  investigación sin conexión monetaria al Fondo. E12 (pagos a proveedor)
  continúa sin conexión ni accesos habilitados. E7 habilita únicamente lectura
  y atribución financiera de solo lectura; no abre operaciones E5, atribución
  histórica E1 ni los demás grupos de Prompt P.

### Frontera del ensayo

Sólo la copia local fijada en
`reports/e10-aislado-2026-09-18/aislamiento.json` admite escrituras del ensayo:
Fondo ficticio y auditoría asociada. El arnés verifica socket, nombre e
identidad efectiva y rechaza otros destinos. Se conservan las identidades
restauradas, sin altas de usuarios ni creación/copia de sesiones de autenticación.
Los contextos de autorización del arnés no equivalen a una prueba de login.
La copia se conserva hasta el cierre completo de E10.

La preparación comprobó la equivalencia semántica de las 66 tablas originales
con el respaldo consistente, exceptuando las filas de sesiones omitidas.
Esto no acredita por sí solo las pruebas funcionales: sus resultados, tiempos,
límites y el inventario SQL se registran en
`reports/e10-aislado-2026-09-18/`. No se declara E10 cerrado por tener código o
por aprobar una selección parcial de suites.

La fase aislada quedó verificada con el router real, PostgreSQL retenido y una
vista privada de navegador posteriormente detenida. La comprobación final
postnavegador es sólo lectura y conserva las 66 tablas originales, permitiendo
únicamente anexos de Fondo y su auditoría `FONDO`; no equivale a habilitación
operativa ni declara E10 cerrado. La entrega aislada detectó seis errores de
tipos en archivos de ensayo de E1; el diagnóstico posterior confirmó que eran
regresiones respecto de la línea base aceptada, no errores presentes en ella.
Su pertenencia a E1 no permite descontarlos del resultado global. Las
restricciones globales del corredor de pruebas siguen vigentes.

### Evidencia de verificación vinculada a una revisión exacta

Toda afirmación de verificación debe registrar el hash completo de la revisión
exacta sobre la que se ejecutó, junto con el comando, alcance y código de salida.
Un log sin su hash no acredita la verificación: no permite reproducirla ni
saber si el árbol cambió después. No sustituir esa identidad por «HEAD»,
«estado actual», una fecha o el nombre de la entrega.

Si se comprueba un árbol aún sin commit, registrar su hash de árbol Git y
verificar que coincide exactamente con el árbol del commit que después se
declara comprobado; vincular también ese hash de commit en la evidencia
conservada. No atribuir resultados a cambios posteriores a la ejecución.
Los archivos no versionados que afecten a la comprobación, las versiones de
herramientas y el estado de las dependencias deben quedar identificados.