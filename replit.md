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

En toda tabla del sistema, el identificador principal del renglón es un enlace al detalle: un solo enlace por renglón, y ninguna columna de "Ver detalle".

Pendiente de confirmar con el usuario: hoy no se puede marcar como facturada una venta con líneas metreadas.

**Formas de cobro de un ticket:** Efectivo y Transferencia. FACTURADO permanece en `formaPagoTicketEnum` únicamente como valor histórico no seleccionable para leer cobros anteriores. La factura se decide en el POS mediante el campo `facturado`, y la cuenta destino se deriva de ese campo, nunca de la forma de pago. **El crédito es exclusivo de las notas**, se decide en el POS y nunca se ofrece como forma de cobro; Caja únicamente autoriza la Nota.

**Cobro de METREADO:** si cualquier línea es METREADO, Caja ofrece únicamente Efectivo, también en pago dividido. Esta restricción conserva coherencia con el servidor (`METREADO_CASH_ONLY`) y con la regla existente que rechaza facturar ventas metreadas; no se permite construir en la interfaz una combinación que el servidor rechazará.

La revisión del flujo encontró además un panel de validación y un bloqueo del botón final condicionados a `esCredito`; ambos pertenecían a la antigua opción Crédito y se retiraron junto con ella.

**La pantalla se llama Precios** y debe mostrar los productos sin precio, marcados como "Sin precio" y nunca como $0.00. Es la única vía para capturar el precio de un producto que se importó sin él, así que filtrarlos la vuelve inservible justo cuando más se necesita.

**Agrupación de Precios:** el listado muestra un renglón por producto y sus colores plegados. Como no existe un catálogo de telas, la agrupación usa la cadena `tela` recortada y sin distinguir mayúsculas, conserva la primera escritura encontrada y ordena producto/color en español. Variantes, acentos o errores que la normalización no iguale todavía pueden partir un producto; crear un catálogo de telas es la solución de fondo pendiente. El renglón de grupo nunca suma ni promedia costo, precio o margen: esas cifras pertenecen a cada color y un agregado se leería falsamente como precio operativo.

**Selección y cambio masivo de Precios:** la casilla del producto selecciona únicamente sus colores visibles y nunca otro producto; cambiar entre Rollo, Mayoreo y Menudeo vacía la selección. En Mayoreo y Menudeo no son seleccionables los colores sin venta fraccionada ni los productos por kilo o pieza, exactamente igual que en el servidor. Todo cambio masivo exige precio positivo y motivo, admite como máximo 200 productos y escribe historial y auditoría por producto, nunca por tanda. La tanda corre en una sola transacción, valida todo antes de escribir, toma candados en orden ascendente de identificador y reutiliza el mismo cálculo que el cambio individual; el límite evita mantener una transacción y sus candados abiertos durante tandas excesivas. El umbral de Mayoreo es 10 unidades y su única fuente es `MAYOREO_THRESHOLD_UNITS` en `lib/metered-pricing/src/index.ts`; no se duplica.

**Cambio del 7 de septiembre de 2026:** se renombró la pantalla a Precios, se agrupó el catálogo por producto/color y se agregó captura masiva transaccional con selección visible, confirmación bajo costo, historial y auditoría individuales.

**Movimientos → ticket:** el único enlace de ticket de cada representación del renglón se construye exclusivamente con `ticketId`, el ID primario real validado contra un ticket existente; nunca con el índice visual ni con el folio. Los movimientos sin ticket real no muestran enlace. Búsqueda, filtros y página usan el estado de la entrada del historial SPA, por lo que Atrás restaura la vista y una entrada directa o recargada conserva el estado de `history.state` cuando existe, con valores seguros por omisión cuando no existe.

# Mariana Textil

## POS y Caja — regla contable vigente

**Nada cuenta hasta que caja lo procesa.** Un Ticket entra a Ventas, Cobrado y Utilidad únicamente al cobrarse; una Nota entra a Ventas, Ventas a crédito y Utilidad únicamente al autorizarse. La identidad es **Ventas = Cobrado + Ventas a crédito**. Pendiente de cobro queda fuera de Ventas y es solo un indicador operativo. Esta regla sustituye expresamente cualquier regla anterior que sumara pendientes a Ventas. La autorización de Nota tiene estado y evento durable propios; nunca se infiere de `estado='VENDIDO'`.

**Comportamiento de pago:** cada Nota pesa igual. Liquidar el día del vencimiento cuenta a tiempo, sin gracia; una vencida impaga cuenta tarde y una abierta no vencida se excluye y se reporta aparte. Los colores son verde ≥90%, amarillo 70–89% y rojo <70%, pero se requieren **5 Notas liquidadas** para asignar color: es un mínimo conservador que evita llamar verde a dos operaciones aisladas. La sugerencia de revisar el límite exige verde, historial suficiente, cero vencidas y utilización sustancial de al menos **75%**; solo explica evidencia, nunca cambia el límite ni propone un monto. La fecha efectiva del movimiento de pago determina puntualidad y `aplicaciones_credito` queda como evidencia, no como fuente de saldo.

**Ticket es contado, Nota es crédito.** No existe ticket a crédito ni nota de contado. **El plazo se elige en el POS**, no en caja: la nota se imprime en el POS con su pagaré, y el pagaré remite a la fecha de pago señalada en la nota; decidir el plazo después dejaría esa referencia vacía.

**Caja distingue las dos operaciones:** un ticket se **cobra**, una nota se **autoriza**. **El límite de crédito es duro y se valida al autorizar la Nota** contra el saldo contable autorizado del libro de movimientos de crédito, bajo un candado transaccional por cliente que serializa autorizaciones concurrentes. Las Notas pendientes no reservan crédito. Si el saldo vigente más la Nota excede el límite, la autorización se rechaza sin excepción: no hay override con contraseña ni aprobación remota. La única vía es que un ADMIN suba antes el límite de crédito del cliente, como una decisión separada sobre su perfil y con su propia auditoría.

**Caja no imprime documentos de venta.** El corte de caja es la única excepción.

En la lista de Caja, una venta con `facturado=true` se identifica como **VENTA FACTURADA** en rojo y con su folio, sin llamarla Ticket ni Nota. El rojo significa exclusivamente que la venta lleva factura; no representa un error.

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
- La API, Drizzle, migraciones, pruebas y seed usan exclusivamente el `DATABASE_URL` administrado por Replit.
- El proyecto externo visible en el MCP de Neon no es la base de la aplicación. Solo puede usarse para ramas/base desechables de pruebas; nunca como conexión de la app ni para datos reales.

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
- El QR de la etiqueta contiene `SKU-SERIE`. La serie son los últimos 7 dígitos. Todo punto de escaneo pasa por `interpretarCodigoEscaneado`. La serie manda; el SKU solo verifica y genera advertencia si no coincide.
- Las tablas operativas no usan DELETE; las correcciones son movimientos inversos que referencian el original.
- Toda operación que modifica datos registra usuario, entidad y valores antes/después en `auditoria`.
- Cantidades usan `DECIMAL(10,3)` y dinero `DECIMAL(12,2)`; nunca float.
- Toda operación de inventario usa una transacción SQL con bloqueo de fila.
- Las operaciones reciben un UUID del cliente para garantizar idempotencia.
- El filtrado por ubicación siempre se aplica en el servidor, no solo en la interfaz.
- **Permisos:** ADMIN tiene acceso total a los 30 módulos sin consultar tablas. Para TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS y CONTADOR la resolución es: override de usuario (non-null) > permiso de rol > denegar. La base de CAJA es estricta: únicamente `cobros_pagos` (`ver` y `crear`) y en la interfaz solo Caja > Cobros; dentro de esa pantalla CAJA únicamente ejecuta Cobrar. Toda escritura de gestión de caja (abrir/cerrar sesión y salidas) requiere conjuntamente `cortes.ver` y `cortes.crear`; las consultas de corte permanecen disponibles con solo `cortes.ver`.
- **Conteo de módulos:** el catálogo configurable contiene 30 módulos y debe mantenerse alineado con la lista canónica del servidor y el seed de permisos.
- **Separación financiera:** clientes y proveedores tienen módulos separados para operativo vs. financiero. Los campos financieros no se envían al cliente cuando falta el permiso.
- **Invariantes ADMIN:** ADMIN no participa en la matriz ni acepta overrides; siempre tiene acceso total. Un usuario no puede modificar sus propios permisos.
- **Precios:** `/precios` exige rol ADMIN directamente en el servidor. El costo actual es ponderado por cantidad disponible y unidad; sin costos válidos permanece pendiente (`null`), nunca cero.
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
- **Recomendación pendiente de decisión del propietario:** usuario y contraseña, como se solicitó, permiten que un segundo ADMIN autorice desde la sesión ADMIN de otra persona y la auditoría conserva ambas identidades. Pedir solo la contraseña del ADMIN en sesión sería más simple y eliminaría esa ambigüedad; no se cambia a esa alternativa sin decisión del propietario.
- **Contrato móvil del borrado:** el diálogo limita su ancho al viewport, permite partir tela/color/SKU largos y apila botones y campos en teléfono. La apertura está condicionada al preflight exitoso; el servidor vuelve a contar bajo candados antes de comprobar credenciales y borrar, de modo que ni una llamada directa con credenciales válidas omite las reglas.
- **Historial de precios sin movimientos:** pendiente de decisión de negocio. Mientras se decide si cuenta como actividad, el producto no se borra y ningún renglón de `precio_historial` se elimina.
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

- Cambiados: `lib/inventario.ts` (`refreshCache`, `conciliarTodo`, `reconstruirCacheExistencias`, `getInventarioPorUbicacion`); `routes/inventario.ts` (`GET /inventario/existencias/agrupadas`); `lib/reportes-inventory.ts` (`buildInventoryReport`).
- Sin cambio: `routes/dashboard.ts:12-137` (`GET /dashboard`, consume `getInventarioPorUbicacion`); `routes/precios.ts:37` (`currentCost`, delega al filtro `DISPONIBLE` de `weightedCurrentUnitCost`); `lib/precios.ts:21` (`weightedCurrentUnitCost`, ya era solo `DISPONIBLE`).
- Sin cambio por ser listados, diagnósticos o historial y no existencia actual: `routes/inventario.ts:260` (`getRolloDetail`), `:1179` (`GET /inventario/rollos`) y `:642` (costos pendientes); `routes/etiquetas.ts:83,147,289` (listado, detalle e historial); `routes/productos.ts:468` (`GET /productos/{id}`, compras por entrada); `lib/compras-proveedor.ts:1142` (`analiticaGlobalProveedores`, costos históricos).
- Sin cambio por ser puertas operativas: el flujo de captura de Salidas; validaciones de estado para venta en POS; transiciones y ajustes de Inventario.
- Sin cambio por pertenecer al dominio separado de contenedores: `lib/contenedores.ts:242` (`getContenedorDetail`) y `:509` (`getContenedoresSummary`), y `lib/contenedores-helpers.ts:88` (`canEditContenedor`).

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

- Estados vigentes: `ARMANDO`, `EN_TRANSITO`, `RECIBIDA`, `CANCELADA`.
- Transiciones permitidas: `ARMANDO → EN_TRANSITO`, `ARMANDO → CANCELADA` y `EN_TRANSITO → RECIBIDA`. No se permite cancelar una salida en tránsito.
- Conteo previo en development (consulta con encabezado y cero filas): `REGISTRADA=0`, `SOLICITADA=0`, `ACEPTADA=0`, `RECHAZADA=0`, `PREPARADA=0`, `ENVIADA=0`, `RECIBIDA=0`, `CERRADA=0`, `CANCELADA=0`.
- Mapeo aplicado sin borrar filas: `REGISTRADA|SOLICITADA|ACEPTADA|PREPARADA → ARMANDO`; `ENVIADA → EN_TRANSITO`; `RECIBIDA|CERRADA → RECIBIDA`; `RECHAZADA|CANCELADA → CANCELADA`.
- Crear una salida solo reserva sus rollos en el documento y no altera inventario. Enviar ejecuta origen → ubicación `TRANSITO` mediante `moverRollo`; la recepción conserva `recibirTransferencia`.
- Se conservaron `transportista` y `notaEnvio`. Las columnas históricas del esquema físico se mantienen para no destruir metadatos de instalaciones con filas migradas, pero se retiraron del contrato y del flujo activo.
- Decisión conservadora: el endpoint de recepción no se expone todavía; su interfaz y reglas de sitio pertenecen al Bloque 3. El núcleo existente queda adaptado a `EN_TRANSITO → RECIBIDA`.

## Parte 1.5, Bloque 3 — Recepción por QR

- La hoja foliada imprime un QR grande con una URL del origen relativo desplegado hacia `Salidas → Recepción`, incluyendo el folio. El login conserva esa ruta de retorno.
- Recepción es una pestaña interna de Salidas. Usa `CampoEscaneo` para teclado, pistola o cámara por el mismo callback y acepta tanto la URL del QR como un folio numérico.
- El servidor lista y permite recibir únicamente salidas `EN_TRANSITO` destinadas al sitio asignado. La única excepción es ADMIN con alcance `TODAS`; cualquier rol con sitio asignado puede ejecutar la recepción.
- Una confirmación aterriza todos los rollos mediante `recibirTransferencia`. Una segunda confirmación se rechaza por estado. La casilla “¿Llegó completo?” inicia marcada; si se desmarca, la nota sigue siendo opcional y se crea una notificación operativa persistente para ADMIN.
- Cada recepción registra en auditoría usuario, instante, IP, origen, destino, indicador de recepción completa y nota.
- Decisión conservadora: “incompleta” describe la condición reportada de la entrega, pero no deja rollos varados ni abre recepción rollo por rollo; todos aterrizan con la cantidad enviada y la incidencia queda en auditoría/notificación.

## Parte 1.5, Bloque 4 — Alertas y tránsito separado

- Alertas ADMIN incluye salidas `EN_TRANSITO` sin recibir que superan `SALIDA_EN_TRANSITO_ALERT_THRESHOLD_HOURS` (24 horas). La constante está nombrada y comentada en `lib/admin-alertas.ts`; el límite es estricto, por lo que exactamente 24 horas aún no alerta.
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
- Puntos de rollo conectados en cliente y servidor: POS (`/pos/buscar`), Salida Nueva (`POST /salidas/borrador/rollos`), Etiquetas (`/etiquetas/rollos`) y Ajustes mediante el listado de Inventario (`/rollos`).
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


## Permission modules (30 total)

`dashboard`, `pos`, `entradas`, `salidas`, `movimientos`, `etiquetas`, `inventario`, `auditoria_inventario`, `productos`, `precios`, `ajustes`, `clientes`, `clientes_credito`, `clientes_precios`, `clientes_finanzas`, `proveedores`, `proveedores_finanzas`, `contenedores`, `ubicaciones`, `usuarios`, `permisos`, `resumen_caja`, `cortes`, `cobros_pagos`, `reportes`, `conciliacion`, `auditoria`, `camionetas`, `choferes`, `viajes`

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
- Cada suite debe crear fixtures con identificadores únicos y limpiar solo sus propias filas. Una suite fallida nunca autoriza limpieza amplia.
- Toda prueba debe abortar si falta `TEST_DATABASE_URL`, si coincide con `DATABASE_URL` o si `current_database()` no coincide con el nombre seguro esperado.

### Ventajas y costos

- Ventajas: elimina la preparación repetida de ramas, acelera E2E, facilita reproducir fallos y permite ejecutar validaciones frecuentes.
- Costos: consume recursos del plan Neon, requiere Secret y credenciales adicionales, mantenimiento de esquema/seed, limpieza de fixtures, monitoreo de datos envejecidos y disciplina para que nunca reciba información real.
- Riesgo operativo: al ser persistente, una prueba puede depender accidentalmente de residuos anteriores; por eso no sustituye fixtures aislados ni las guardias de identidad.

Mientras esta decisión siga pendiente, continúa vigente el procedimiento de rama Neon desechable: base vacía con esquema y seed actuales, `current_database()` confirmado, `TEST_DATABASE_URL` distinta de `DATABASE_URL`, prohibición de crear ADMIN o sesiones de prueba en development y eliminación completa de la rama al terminar.

## Cierre del plan de cinco partes

La bitácora de auditoría es de solo lectura, sin excepciones ni siquiera para ADMIN. Las acciones destructivas exigen escribir un texto exacto para confirmarse. El sistema impide dejar la instalación sin ningún ADMIN activo con acceso completo, validado en el servidor dentro de la transacción. El SUPERVISOR opera clientes y proveedores pero solo lee productos, porque editar un producto toca el precio.

## Parte 10 — Catálogo por tela y unidad BOLSA

Un producto sigue siendo **tela más color**; la pantalla los agrupa por tela pero el modelo no cambia. Una tela de un solo color también se agrupa.

La unidad **BOLSA** mapea al modelo existente sin estructuras nuevas: una **caja** es un rollo, con su serie y su etiqueta, y su cantidad de **bolsas** es editable como los metros. Vender una caja equivale a vender un rollo; vender una bolsa suelta equivale a la venta metreada. Cada bolsa trae 100 piezas, pero el sistema cuenta bolsas, no piezas.

**Metros, kilos y bolsas nunca se suman entre sí.**

Las unidades se muestran siempre como **Mts.**, **Kg.**, **Bolsas** y **Pzas.**, traducidas por una función compartida. Ninguna se escribe a mano.

## Fuente de verdad del crédito

El libro de movimientos de crédito es la fuente de verdad. El estado de una nota —pendiente, parcial, pagada— se deriva de los movimientos y nunca se marca a mano. Ninguna pantalla, endpoint o tarea puede guardar ese estado como una marca independiente.

## Parte 7 — Tickets, notas y viajes

El documento de venta se elige antes de vender: **TICKET** para contado y **NOTA** para crédito. Nota implica crédito siempre y el servidor lo hace cumplir en `artifacts/api-server/src/lib/pos.ts`; el crédito y su plazo se deciden en el POS y Caja únicamente autoriza. La Nota se imprime con precios o como Nota de Productos sin ningún importe, a elección del operador; el filtrado de importes se hace en el servidor. La copia interna siempre lleva precios y QR. En el ticket y en las dos variantes de nota, las líneas de rollo se agrupan por producto mostrando la cantidad de rollos, y los números de serie no se imprimen; el detalle por rollo se conserva solo en el documento dentro del sistema, en la hoja de salida y en la hoja del viaje. Los viajes registran camioneta, chofer, origen y los documentos que se llevaron; no se cierran, no confirman entrega y no rastrean ubicación. Cuando una salida pertenece a un viaje, el chofer viene del viaje y no del campo de transportista.

El libro de movimientos de crédito es la fuente de verdad. El estado de una nota —pendiente, parcial, pagada— se deriva de los movimientos y nunca se marca a mano. Todo abono, de cliente o a proveedor, se aplica a la nota o compra más antigua por fecha; al saldarla, el sobrante pasa a la siguiente, y lo que sobre al final queda como saldo a favor. Clientes y proveedores usan el mismo algoritmo de reparto. Una venta a crédito imprime nota, no ticket: dos copias, la interna con QR y la del cliente sin él.

Para abonos de clientes, “cuenta destino” usa las categorías operativas existentes, no un catálogo bancario inventado: el efectivo entra a `CAJA_FISICA` y una transferencia debe indicar `CUENTA_FISCAL` o `CUENTA_NO_FISCAL`. Los movimientos históricos pueden conservar `null`, pero todo abono nuevo debe registrar una categoría coherente con su forma de pago.

El pago dirigido se solicita desde el cobro del cliente o el pago al proveedor, se autoriza desde la notificación sin entrar a otra pantalla, y su histórico vive en Reportes como registro de cuántas excepciones a la regla FIFO ha habido. No es una pantalla de trabajo diario. Solo `PENDIENTE` permanece como evento derivado activo. Al aprobar o rechazar, la solicitud desaparece inmediatamente del feed y, en la misma transacción, se guarda una notificación no leída dirigida exclusivamente al solicitante; al leerla sale del feed pero permanece en su historial y enlaza a Pagos dirigidos.

## Cuentas Destino

Facturación y forma de cobro son preguntas independientes. Efectivo siempre cae en `CAJA_FISICA`; una transferencia cae en `CUENTA_FISCAL` si la venta está facturada y en `CUENTA_NO_FISCAL` si no; el crédito puede combinarse con cualquiera de los dos estados fiscales y representa una promesa, no una cuenta con dinero. Esta derivación vive exclusivamente en `destinationReadModel()` y `accountDestination()` y no debe duplicarse.

La caja física mezcla ventas facturadas y sin factura porque el cajón es uno solo. Es la única cuenta cuyo estatus fiscal no se deduce de la cuenta destino, por eso su tarjeta declara por separado cuánto efectivo corresponde a ventas facturadas.

El encabezado contiene **Cobrado**, **Por cobrar** y **Vendido**. Cuentas por cobrar nunca se suma con las tres cuentas reales bajo una etiqueta de ingreso. Los porcentajes de Caja física, Cuenta fiscal y Cuenta no fiscal se calculan sobre Cobrado.

La matriz cruza facturación con forma de cobro y debe cerrar por renglón y por columna. El servidor verifica el cierre y la interfaz muestra cualquier descuadre en vez de ajustarlo u ocultarlo. Toda forma de pago sin columna propia cae en **Otras**, para que ninguna desaparezca en silencio. Ninguna cifra financiera de esta pantalla se calcula en el navegador.

Para contar cobros se excluye explícitamente `CREDITO` en vez de enumerar las formas conocidas que sí cobran. Así, una forma nueva entra por omisión y no desaparece del importe o del conteo.

**Pendiente de decisión:** `isValidPaymentDestination` permite cobrar el abono de una venta facturada a una cuenta no fiscal y `cliente-pago-dialog.tsx` todavía ofrece “Facturado” como forma de pago del abono. La pantalla lo señala, pero no lo impide. `allocateCreditFifo` puede repartir un solo depósito entre notas facturadas y sin factura; cualquier regla futura debe resolver esa combinación.

**Reglas duplicadas encontradas, no unificadas en este cambio:**
- `artifacts/api-server/src/lib/pos.ts:2082-2088` deriva las cuentas del corte con condicionales propios; hoy coincide con la regla canónica.
- `artifacts/api-server/src/lib/admin-analytics.ts:324-335` repite el predicado de documento contabilizado en ventas, subtotal, IVA y conteo; hoy coincide con `accountedDocumentPredicate()`.
- `artifacts/api-server/src/lib/admin-analytics.ts:376-378` repite el mismo predicado para margen por sesión; hoy coincide con la regla canónica.

La divergencia hallada en el feed de Caja se corrigió: `artifacts/api-server/src/routes/notificaciones.ts:194` usa `pendingTicketPredicate()`, por lo que muestra tickets sin cobrar y notas sin autorizar, pero retira una nota en cuanto queda autorizada.

**Cambio del 7 de septiembre de 2026:** se reconstruyó Cuentas Destino con encabezado Cobrado/Por cobrar/Vendido, cuentas reales, matriz conciliada, IVA facturado, detalles filtrados, incongruencias y desglose por tienda; además se corrigieron el conteo abierto de formas de cobro y el feed pendiente de Caja. Se retiraron los borradores sueltos de la raíz: ningún cálculo de variación se replica fuera del servidor, ni siquiera como archivo de prueba manual. Las tarjetas de cuenta muestran el importe del periodo anterior junto a su porcentaje, por la misma razón que el encabezado.

## Roles SISTEMAS y CONTADOR

**TERMINAL** abre `/pos` al iniciar sesión, según `artifacts/mariana-textil/src/lib/home-route.ts`. El servidor le omite recursivamente de las respuestas toda clave cuyo nombre contenga costo, precio, margen o utilidad; esa defensa vive en `artifacts/api-server/src/lib/sensitive-data.ts`.

**SISTEMAS** es el rol del técnico responsable de la aplicación. Opera todo y sí ve el dinero, porque diagnostica problemas de cartera y de precios. No vende ni cobra: sin POS, sin cortes, sin cobros. Lee la bitácora y no puede alterarla. No puede crear administradores ni tocar a un usuario que ya es ADMIN: esa llave se queda con el dueño.

**CONTADOR** ve todo lo financiero y no toca la mercancía: consulta entradas, salidas y movimientos para cuadrar, pero no crea ni edita ninguno. Registra pagos a proveedores y cobros. No administra el sistema.

Los dos existen separados de ADMIN para poder distinguir en la bitácora qué hizo cada quien.

La matriz de permisos del seed valida al arranque que cada fila tenga tantos valores como roles existan y que cada valor sea válido. Una fila corta niega permisos en silencio, y así se creó por accidente un rol incompleto en la Parte 7.

Decisión conservadora: CONTADOR tiene `crear` en `cobros_pagos` y en `proveedores_finanzas` porque registra cobros y pagos. Si se decide que el perfil sea puramente de consulta, esas dos celdas se pueden retirar de la matriz.

### Limpieza para el piloto

La limpieza autorizada dejó vacíos los datos operativos y conservó clientes, proveedores, sitios, usuarios reales, permisos y los 154 productos del catálogo aprobado. Ese conteo corresponde al momento de la limpieza y no representa el tamaño vigente del catálogo. Los usuarios y sitios generados por pruebas que siguen referenciados por la bitácora inmutable se conservaron completos; nunca se fuerza su eliminación ni se altera la auditoría para borrarlos.

La pantalla de acceso y los servicios quedaron disponibles después de la limpieza. La comprobación autenticada de las pantallas con una cuenta real queda pendiente para el usuario porque la contraseña vigente del administrador no está disponible en el workspace; no se restablecen contraseñas reales ni se crean sesiones artificiales para una prueba.

### Pendientes antes del piloto

El piloto se realizará en Cruces. La carga inicial de inventario es el bloqueo operativo para arrancarlo.

- Configurar, ejecutar y comprobar respaldos y restauración.
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

Existe **un solo** algoritmo de reparto de crédito, en `lib/credit-allocation.ts`, usado tanto para aplicar abonos como para calcular la antigüedad de cartera, en clientes y en proveedores. Nunca debe existir una segunda implementación: dos algoritmos para el mismo número producen dos verdades que divergen en silencio. Las pruebas de integración leen su base de `TEST_DATABASE_URL` y verifican con `current_database()` que no sea la de desarrollo; ningún nombre de base va escrito a mano en el código.

En Reportes, el color codifica información y nunca decora: modalidad, signo, rango, categoría o estado. Cada color debe tener un significado documentado; si no puede explicarse en una frase, no se usa.

Los destinos de dinero conservan sus códigos internos y se presentan siempre en este orden: **Efectivo**, **Cuentas No Fiscales**, **Cuentas Fiscales**, **Ventas a Crédito**. Las etiquetas se resuelven desde `@workspace/number-format`; no deben duplicarse en frontend, API, PDF o XLSX.

## Parte 8 — Auditoría de inventario, purga y corte diario

**Bitácora** es el registro de quién hizo qué en el sistema; es inmutable y vive en Configuración. **Conciliación de Kardex** compara el caché de existencias contra el kardex: el sistema contra sí mismo. **Auditoría de Inventario** compara el sistema contra la mercancía física y vive en Inventario. Los tres nombres deben decir qué compara cada uno. Al abrirse toma una fotografía de la existencia del sitio, contra la cual compara; varias personas escanean sobre la misma auditoría al mismo tiempo y un rollo repetido no se duplica. **La auditoría nunca corrige el inventario por su cuenta**: reporta, y ADMIN decide si se generan los ajustes. Solo cuenta rollos por QR; no verifica metros ni kilos.

Un registro inactivo solo puede eliminarse si no tiene ninguna referencia en el sistema. Un usuario que aparece en la bitácora o en el kardex nunca se borra: perder su rastro rompe la trazabilidad.

**Una sola sesión de caja por sitio y por día:** se registra el fondo de caja chica en la mañana, se opera, y se corta al terminar. Únicamente Tienda Mariana registra salidas de dinero a proveedores, y el sitio autorizado es una constante nombrada. Al cerrar se imprime la hoja de ventas del día, agrupada por producto y sin series.

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

El orden fijo de las cinco tarjetas, de izquierda a derecha, es: **Ventas (Total) → Cobrado (Caja) → Ventas a crédito → Utilidad → Ventas pendientes de cobro o autorización**. Pendientes va al extremo derecho porque es un indicador operativo fuera de Ventas, no un componente de la identidad contable **Ventas = Cobrado + Ventas a crédito**.

La tarjeta de pendientes cuenta tanto tickets vendidos sin cobrar como notas vendidas sin autorizar. Permanece fuera de Ventas hasta que Caja procese el documento. La alerta de 30 minutos se calcula solo para tickets: un ticket sin cobrar media hora después es un problema de mostrador, mientras una Nota sin autorizar no comparte esa urgencia y su vencimiento se vigila en Cartera. El texto secundario distingue cuántos tickets y cuántas notas están esperando.

**Cobrado (Caja)**, **Ventas a crédito** y **Ventas pendientes de cobro o autorización** son clicables y abren el desglose de los documentos que componen su cifra. Cada desglose reutiliza exactamente el mismo predicado de su tarjeta; con igual rango y ubicación, la suma debe cuadrar al centavo con la cifra mostrada. La respuesta del servidor no envía costo, utilidad ni margen al cliente.

**Ventas (Total)** no es clicable porque ya es exactamente la suma de Cobrado y Ventas a crédito. **Utilidad** tampoco es clicable porque tiene reglas propias de ocultamiento y líneas sin costo que requieren un desglose independiente.

**El plazo de crédito se elige en POS**, al crear la venta, no en el diálogo de cobro: la caja no tiene impresora y la nota con el pagaré se imprime desde el POS. Se precarga de `clientes.diasCredito` y se puede cambiar para esa venta sin modificar el perfil. Un cliente sin plazo obliga a elegirlo.

**El límite de crédito es duro.** Debajo procede, arriba se rechaza, **sin excepción**: no existe autorización de ADMIN, ni aprobación remota, ni override posterior. Un límite que se puede saltar no es un límite. El cajero ve el crédito disponible al seleccionar al cliente, y el rechazo dice cuánto hay y cuánto falta, en vez de un "no se puede" genérico.

**La notificación de venta a crédito es guardada**, no derivada: una venta es un hecho ocurrido, no una condición vigente, y como alerta derivada se quedaría para siempre.

**Escaneo en POS:** un rollo escaneado que se identifica sin ambigüedad **se agrega al carrito directamente**, con el mismo criterio de Salidas: la serie manda y la discrepancia de SKU avisa sin bloquear. No se agrega nada cuando el escaneo devuelve varios resultados, ni cuando el rollo no está disponible, es de otro sitio o ya está en el carrito; esos casos se rechazan con aviso, porque un rechazo silencioso produce un ticket con menos rollos de los que se lleva el cliente. El tecleo manual sigue mostrando resultados para elegir.

**Renglones agrupados:** los rollos del mismo producto forman **un solo renglón** con su conteo y cantidad total, y el precio se captura una vez para todos. Agrupar por tela mezclaría colores y unidades y está prohibido.

La agrupación es **presentación y captura de precio**: el renglón conserva por debajo las series de sus rollos, y el ticket sigue registrando línea por rollo, con descuento de inventario y costo congelado individuales. Si un cambio de presentación toca cómo se registra la venta, está mal planteado.

**Procesamiento contable de Ticket y Nota:** un Ticket pendiente no genera Ventas, Cobrado ni Utilidad; cuando Caja lo cobra, entra simultáneamente en los tres, también cuando la venta está marcada como facturada. Una Nota pendiente tampoco genera Ventas, Ventas a crédito ni Utilidad; cuando Caja la autoriza, entra simultáneamente en esos tres conceptos y nunca en Cobrado. Los abonos posteriores reducen el saldo de cartera, pero no vuelven a contar la venta ni cambian su clasificación histórica como venta a crédito. Por tanto, los pendientes son solo indicadores operativos y la identidad financiera es siempre **Ventas = Cobrado + Ventas a crédito**.

**El orden de las tiendas es Mariana, Coco, Cruces**, y vive en un solo lugar compartido por todas las vistas. Repetirlo por componente hace que una vista quede desincronizada de las demás. Una tienda nueva nunca desaparece de una lista por no estar en el orden.

**La vista de ventas por tienda** aplica `resolveReadScope` siempre: un usuario con alcance PROPIA no ve otra tienda ni manipulando la dirección. La utilidad no se envía al cliente cuando el rol no debe verla; taparla solo en pantalla no es una restricción.

**Ventas por tienda** tiene dos pestañas: **Global** —agrupada por tela, desplegable por color— y **Detalle**, el listado de tickets. Global es la pestaña por omisión. Los filtros de fecha son compartidos: dos pestañas que muestren periodos distintos hacen que el usuario deje de confiar en los dos números.

El filtro de forma de pago pertenece solo a **Detalle**. Al entrar a Global se limpia junto con la página de Detalle, conservando las fechas; así Global siempre representa todas las ventas del periodo y al volver a Detalle no queda un subconjunto oculto que contradiga el total.

Agrupar "por producto y por color" sería una sola agrupación, porque **el producto es la pareja tela-color**. La jerarquía tela → color contesta cuánto se movió de cada tela y qué colores dentro de ella.

**Rollos y metraje nunca comparten un mismo margen**, aquí como en el resto de los reportes: se costean distinto —costo exacto del rollo contra promedio de 12 meses congelado— y sumarlos produce un número que no significa nada. En Ventas por tienda se presentan en columnas de utilidad separadas y las cantidades se distinguen por modalidad y unidad.

**El total de Global debe cuadrar siempre con la suma de Detalle** en el mismo periodo. Es la prueba objetiva de que las dos pestañas leen lo mismo. El total bruto de cada ticket se distribuye a centavos entre sus líneas para conservar también el IVA.

Las **ventas a crédito cuentan** como ventas y los **cancelados no**. La utilidad excluye las líneas sin costo, así que toda vista que la muestre declara cuántas quedaron fuera, incluso cuando son cero. Si ninguna línea de una modalidad tiene costo conocido, la utilidad se presenta como **Pendiente**, nunca como cero.

**Devoluciones y notas de crédito de producto:** el modelo actual no tiene líneas de devolución ni una nota de crédito que reste cantidades e importes por producto; `NOTA` es un tipo documental de venta. Ventas por tienda no inventa una resta sin un movimiento trazable.

`DEVOLUCION` existe únicamente como valor de `tipoMovimientoEnum` y como etiqueta y color en `movimientos.tsx`; no hay ruta, servicio ni prueba que lo genere.

**SUPERVISOR y Ventas por tienda:** el techo de permisos actual niega `resumen_caja`, incluso con un permiso individual. La omisión recursiva de campos de utilidad/costo queda aplicada como defensa adicional si ese techo cambia; no se amplían permisos para mostrar este reporte.

## Formatos de impresión

**Formatos de impresión.** Los cuatro formatos vigentes son: Entrada carta vertical 216 × 279 mm, Salida A5 horizontal 210 × 148 mm, Nota A5 vertical 148 × 210 mm y Ticket térmico de 80 mm. Entrada y Nota usan papel blanco a color; Salida usa papel **de color distinto por sitio** y diseño a color. No existe Nota de contado.

Se eligió **A5 y no media carta** porque las bandejas de las impresoras láser admiten A5 en cajón; media carta solo entra por alimentación manual, hoja por hoja, lo que es inviable en un mostrador, y quedó eliminada del software. No son el mismo tamaño: A5 es 148 × 210 mm y media carta 140 × 216 mm.

El respaldo cuando falla la impresora térmica consiste en mandar el mismo Ticket de 80 mm a otra impresora desde el diálogo del navegador. No existe ni debe crearse un segundo diseño en papel para ese respaldo.

**Los documentos no se diseñan para monocromático.** El color lo aporta el papel de la bandeja y la impresora convierte a grises por su cuenta. Un logo azul impreso en negro se ve bien; un logo dibujado en gris plano se ve mal en color y en negro. La Salida conserva su diseño a color aunque se imprima en monocromático sobre papel de color.

**El QR de la Salida lleva recuadro blanco detrás.** Sobre papel de color el contraste puede caer y el código deja de leerse; si el QR no escanea, se rompe el flujo de recepción. Es una regla operativa, no estética, y aplica a cualquier color de papel presente o futuro.

**Los renglones por hoja son mediciones independientes por documento:** la Nota usa siempre 8; Salida usa 10. El Ticket de contado usa tira térmica de 80 mm y no tiene una capacidad A5. La Nota reserva el pagaré legible, mientras Salida reserva encabezado a escala de Entrada, observaciones, totales y tres firmas. En la Nota, el noveno renglón invade el pie al rasterizar; en Salida, 11 o más renglones recortan el pie.

**Captura de importes:** los campos de monto usan `type="text"` con `inputMode="decimal"`, no `type="number"`, porque este último **no admite comas** y deja al usuario capturando cifras largas sin separador. El separador de miles aparece **mientras se escribe**, en formato mexicano —coma para miles, punto para decimales—, y **el cursor no salta** al insertarlo. El separador es presentación y se retira antes de enviar: el servidor recibe el mismo valor de siempre. El comportamiento vive en un solo componente compartido.

Todo documento dibuja su capacidad completa con renglones cerrados y perímetro negro. Las hojas adicionales repiten encabezado y pie, conservan numeración continua y nunca desbordan. El pagaré usa 10 px (7.5 pt) con interlineado de 12 px (9 pt), conserva su texto literal y aparece solo en la última hoja de cada copia de crédito.

**Un renglón de producto es indivisible**: o cabe entero en la hoja o pasa completo a la siguiente, nunca se parte a la mitad. En los documentos impresos por hoja, los renglones se miden contando el renglón completo más todo lo que va debajo de la tabla —totales, leyenda y firma—; cada formato tiene su propia capacidad.

## Higiene de la documentación

- Este archivo se deriva del código en rutas, conteos y roles. Toda ruta citada aquí debe existir textualmente en `lib/api-spec/openapi.yaml`.
- Ninguna regla de validación se escribe contra un conteo fijo de productos: los conteos caducan en la siguiente importación y dejan la validación falsamente aprobada.
- Toda lista de roles escrita aquí debe cotejarse contra `rolUsuarioEnum` antes de darse por completa.
- **Limpieza del 2026-09-06:** se corrigieron rutas de Entradas y Productos, el formato A5 de Salida, la documentación de TERMINAL, los conteos caducos, CREDITO y DEVOLUCION, y las reglas vigentes de impresión, POS/Caja y Caja en Tiempo Real.