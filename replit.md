Los documentos impresos requieren `print-color-adjust: exact` para que el logo y los fondos lleguen al papel; sin esa regla el navegador los descarta.

**El ticket, la nota, la nota de productos y la hoja de Salida NO imprimen números de serie** y agrupan los rollos por producto. Las series de Salida permanecen completas en el sistema y se consultan desde su detalle en pantalla. **La hoja de viaje y la hoja de auditoría SÍ imprimen las series**, porque son documentos de control interno.

Todo documento imprimible debe poder abrirse en cualquier momento desde el folio de su lista, no solo al crearse.

Todos los documentos impresos llevan el logo centrado arriba y el QR en la esquina superior derecha. El QR lleva al mismo destino que el folio en azul de su lista, con la dirección construida desde el origen en que corre la aplicación, nunca escrita a mano.

**Documentos impresos, agregación:** Entrada y Salida imprimen **un renglón por producto** con el total de rollos y la cantidad total, no un renglón por rollo. Como el producto ya incluye el color y la unidad es atributo del producto, agrupar por producto agrupa por tela y color y nunca mezcla metros con kilos ni bolsas. Agrupar por tela sí los mezclaría y está prohibido.

El alta y la baja de rollos **siguen siendo rollo por rollo con su número de serie**, y el sistema conserva el detalle completo. Lo que cambia es solo qué se imprime.

**Salida** no imprime números de serie: quedan en el sistema y se consultan en el detalle en pantalla. **Entrada** sí los imprime, pero después de las hojas de globales, en un listado compacto agrupado por producto, con numeración continua y sin repetir el pie de firmas —ese va solo en la última hoja de globales, que es la que se firma.

**Escala del encabezado:** Entrada y Salida ya **no** comparten tamaño de encabezado. El mismo encabezado sobre A6 apaisado consume una cuarta parte de la hoja y deja cinco renglones. En Salida el encabezado va reducido; lo que se conserva es la rejilla de tres columnas, la alineación entre título, logo y QR, y que logo y QR midan lo mismo entre sí.

**Hojas de series:** el listado de series de una Entrada no repite el encabezado completo. Lleva una franja de una línea con folio, la leyenda "Listado de series" y la paginación —suficiente para volver a asociar una hoja suelta a su entrada—. El título grande, el logo y el QR van solo en las hojas de globales.

**Pie de firmas indivisible:** el bloque de observaciones y las tres firmas con su leyenda nunca se parte entre hojas. Si no cabe, la hoja lleva menos renglones de producto; nunca se empuja el pie a una hoja propia ni se dejan las líneas sin su leyenda. Va en la última hoja de globales, que es la que se firma.

**Desbordamiento acumulado:** cada hoja es un contenedor de altura fija que no puede desbordar. Un bloque más alto que la hoja empuja su sobrante arriba del encabezado de la siguiente y el error se suma hoja tras hoja, hasta que el navegador imprime más hojas de las que el documento numera. La señal de que existe es un renglón huérfano arriba de un encabezado, o que el conteo del navegador no coincida con la paginación. Se corrige midiendo, nunca bajando el número de renglones a ojo hasta que deje de verse.

Decisión conservadora para Entradas pequeñas: si el listado completo de series cabe en el espacio libre de la última hoja global, se imprime allí después de los productos y antes del pie; se incrusta completo o no se incrusta. Así una Entrada de una línea y una serie ocupa una sola hoja sin perder la serie ni separar las firmas.

Las líneas por página de cada documento son un valor medido, comentado junto a la constante. Cambiar el pie —agregar firmas, por ejemplo— invalida ese número y obliga a recalcularlo.

Decisión conservadora: el contrato vigente de `GET /entradas/:id` ya contiene tanto las líneas agregadas como cada rollo con serie, producto y cantidad. El documento reutiliza esa única respuesta; no se crea ni duplica un endpoint de series mientras el contrato siga completo.
# Decisiones de la Parte 9

**Formas de pago de clientes y proveedores:** EFECTIVO, TRANSFERENCIA y FACTURADO. CHEQUE y OTRO son valores **históricos no seleccionables**: siguen en la base para que los registros viejos se lean, y no se ofrecen en formularios. `formaPagoTicketEnum` es otra cosa y no cambia: CREDITO ahí es la modalidad de venta a crédito, no una forma de pago equivalente.

**FACTURADO e IVA:** mueve el saldo por el **monto capturado, que ya incluye el IVA**. El sistema **nunca** le suma 16% a un monto capturado; solo desglosa cuánto fue subtotal y cuánto IVA donde el desglose aporte. La tasa vive en una sola constante compartida y no se escribe a mano en ningún lugar nuevo.

El contador confirma **contra lo facturado**, no contra lo cobrado. La diferencia entre facturado y cobrado es cartera de ventas fiscales a crédito, no un descuadre, y la pantalla debe decirlo. Al confirmar se congela la cifra contra la que se confirmó.

En toda tabla del sistema, el identificador principal del renglón es un enlace al detalle: un solo enlace por renglón, y ninguna columna de "Ver detalle".

Pendiente de confirmar con el usuario: hoy no se puede marcar como facturada una venta con líneas metreadas.

# Mariana Textil

## Corrección — Bloque 4: Tubulares

**Tubulares:** casilla opcional al cobrar, sin marcar por omisión. Genera **una tira por color** en 80 mm, con los metrajes de los rollos de ese color, su total y el folio del ticket. Son adicionales al ticket, nunca lo sustituyen, y no tocan el registro de la venta.

- Se excluye **METREADO** porque no tiene un rollo fuente identificado del cual obtener una etiqueta física.
- Se imprime incluso cuando hay un solo color porque el usuario lo solicitó expresamente al activar la opción.
- Las tiras muestran metrajes con **2 decimales** porque son documento de venta; únicamente las etiquetas físicas de rollo conservan 3 decimales.

Sistema interno de inventarios, ventas y salidas entre ubicaciones para las tiendas y
bodegas de Mariana Textil. No es un sistema contable ni fiscal.

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

- El kardex es la fuente de verdad del inventario: toda alteración inserta movimientos con cantidades firmadas.
- El QR de la etiqueta contiene `SKU-SERIE`. La serie son los últimos 7 dígitos. Todo punto de escaneo pasa por `interpretarCodigoEscaneado`. La serie manda; el SKU solo verifica y genera advertencia si no coincide.
- Las tablas operativas no usan DELETE; las correcciones son movimientos inversos que referencian el original.
- Toda operación que modifica datos registra usuario, entidad y valores antes/después en `auditoria`.
- Cantidades usan `DECIMAL(10,3)` y dinero `DECIMAL(12,2)`; nunca float.
- Toda operación de inventario usa una transacción SQL con bloqueo de fila.
- Las operaciones reciben un UUID del cliente para garantizar idempotencia.
- El filtrado por ubicación siempre se aplica en el servidor, no solo en la interfaz.
- **Permisos:** ADMIN tiene acceso total a los 30 módulos sin consultar tablas. Para CAJA, SUPERVISOR y BODEGA la resolución es: override de usuario (non-null) > permiso de rol > denegar.
- **Conteo de módulos:** el catálogo configurable contiene 30 módulos y debe mantenerse alineado con la lista canónica del servidor y el seed de permisos.
- **Separación financiera:** clientes y proveedores tienen módulos separados para operativo vs. financiero. Los campos financieros no se envían al cliente cuando falta el permiso.
- **Invariantes ADMIN:** ADMIN no participa en la matriz ni acepta overrides; siempre tiene acceso total. Un usuario no puede modificar sus propios permisos.
- **Gobierno de precios:** `/precios` exige rol ADMIN directamente en el servidor. El costo actual es ponderado por cantidad disponible y unidad; sin costos válidos permanece pendiente (`null`), nunca cero.
- **Historial comercial:** todo cambio de precio bloquea el producto, captura costo/margen del momento y escribe historial más auditoría en la misma transacción. Nunca recalcula tickets existentes.
- **Costo y precio de venta metreada:** El costo de la venta metreada es el **promedio simple del costo por metro de cada rollo recibido en los últimos 12 meses corridos**. Cada rollo cuenta una vez, sin ponderar por cantidad. Promedio simple, nunca ponderado: es una regla del negocio y no debe "corregirse". Sin compras en 12 meses, cae al último costo conocido y se marca la advertencia. El costo se congela en la línea del ticket al momento de la venta. Cada producto tiene el interruptor `se_vende_por_metro`, que el POS hace cumplir en el servidor; los productos en kilos nunca lo tienen encendido. Mayoreo es 10 metros o más, contado por línea —producto y color—, nunca por ticket.
- **Definición de existencia:** Existencia de un producto en un sitio = lo que se puede tocar y vender ahí hoy. Solo rollos en estado `DISPONIBLE` en esa ubicación. Nada más se suma a ese número: ni `MOSTRADOR`, ni `EN_TRANSITO`, ni rollos que vienen en contenedor.
- **Totales en Vista Global:** el renglón de totales presenta un total **por unidad** —Mts., Kg., Bolsas— y nunca un solo número al pie de la columna de cantidad. El total de rollos sí es único. Los totales reflejan el filtro activo, se leen de `existencias` y se calculan sobre los valores guardados.
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

- Cambiados: `lib/inventario.ts` (`refreshCache`, `conciliarTodo`, `reconstruirCacheExistencias`, `getInventarioPorUbicacion`); `routes/inventario.ts` (`GET /existencias/agrupadas`); `lib/reportes-inventory.ts` (`buildInventoryReport`).
- Sin cambio: `routes/dashboard.ts:12-137` (`GET /dashboard`, consume `getInventarioPorUbicacion`); `routes/precios.ts:37` (`currentCost`, delega al filtro `DISPONIBLE` de `weightedCurrentUnitCost`); `lib/precios.ts:21` (`weightedCurrentUnitCost`, ya era solo `DISPONIBLE`).
- Sin cambio por ser listados, diagnósticos o historial y no existencia actual: `routes/inventario.ts:260` (`getRolloDetail`), `:1179` (`GET /rollos`) y `:642` (costos pendientes); `routes/etiquetas.ts:83,147,289` (listado, detalle e historial); `routes/productos.ts:468` (`GET /productos/:id`, compras por entrada); `lib/compras-proveedor.ts:1142` (`analiticaGlobalProveedores`, costos históricos).
- Sin cambio por ser puertas operativas: el flujo de captura de Salidas; validaciones de estado para venta en POS; transiciones y ajustes de Inventario.
- Sin cambio por pertenecer al dominio separado de contenedores: `lib/contenedores.ts:242` (`getContenedorDetail`) y `:509` (`getContenedoresSummary`), y `lib/contenedores-helpers.ts:88` (`canEditContenedor`).

## Parte 1, Bloque 2 — Catálogo de Productos

- `GET /productos` sigue devolviendo el arreglo completo del catálogo y acepta `ubicacionId` y `existencia` (`TODOS`, `CON_EXISTENCIA`, `AGOTADOS`).
- Sus totales, los sitios con existencia y el desglose del detalle se leen exclusivamente de `existencias`; los productos sin fila de cache permanecen visibles con cero.
- El alcance de lectura reutiliza `resolveReadScope` de Inventario. El detalle lista solo ubicaciones TIENDA/BODEGA activas permitidas y expone enlaces de rollos únicamente `DISPONIBLE`, sin derivar los totales de esos enlaces.
- Decisión conservadora: una ubicación inactiva o que no sea TIENDA/BODEGA no participa en el catálogo aunque tenga una fila histórica de cache.

## Parte 1, Bloque 3 — Auditoría de transferencias

- Se eliminaron exclusivamente las rutas tombstone `POST /inventario/rollos/:id/mover` y `POST /inventario/rollos/:id/recibir`, que solo respondían `410`, junto con sus paths OpenAPI, schemas y hooks/tipos generados.
- No existen los nombres solicitados `iniciarTransferencia`, `confirmarTransferencia` ni `cancelarTransferencia`. La transferencia directa activa equivalente es `transferirRolloInmediato`; el ajuste activo equivalente es `ajustarRollo`, que admite rollos `EN_TRANSITO`.
- Se retienen las funciones de núcleo `moverRollo` y `recibirTransferencia`, porque el ciclo activo de Salidas las invoca. También se retienen las rutas e interfaz de Salidas, los enums del kardex y todo el ciclo de vida e interfaz de Contenedores.
- El único alcance retirado fue el HTTP tombstone y su contrato generado; no se modificaron las superficies de Contenedores.

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
- Entradas: carta vertical 216 × 279 mm. Salidas: media carta horizontal 216 × 140 mm. Etiquetas: 100 × 70 mm. El diseño y la regla `@page` deben declarar siempre la misma medida.


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

Las unidades se muestran siempre como **Mts.**, **Kg.** y **Bolsas**, traducidas por una función compartida. Ninguna se escribe a mano.

## Fuente de verdad del crédito

El libro de movimientos de crédito es la fuente de verdad. El estado de una nota —pendiente, parcial, pagada— se deriva de los movimientos y nunca se marca a mano. Ninguna pantalla, endpoint o tarea puede guardar ese estado como una marca independiente.

## Parte 7 — Tickets, notas y viajes

El documento de venta se elige antes de vender: **TICKET** cuando el cliente se lleva la mercancía del mostrador, **NOTA** cuando sale a domicilio. Es una decisión sobre cómo sale la mercancía, no sobre cómo se paga; aplica a contado y a crédito. Una venta a crédito siempre emite Nota. La Nota se imprime con precios o como Nota de Productos sin ningún importe, a elección del operador; el filtrado de importes se hace en el servidor. La copia interna siempre lleva precios y QR. En el ticket y en las dos variantes de nota, las líneas de rollo se agrupan por producto mostrando la cantidad de rollos, y los números de serie no se imprimen; el detalle por rollo se conserva solo en el documento dentro del sistema, en la hoja de salida y en la hoja del viaje. Los viajes registran camioneta, chofer, origen y los documentos que se llevaron; no se cierran, no confirman entrega y no rastrean ubicación. Cuando una salida pertenece a un viaje, el chofer viene del viaje y no del campo de transportista.

El libro de movimientos de crédito es la fuente de verdad. El estado de una nota —pendiente, parcial, pagada— se deriva de los movimientos y nunca se marca a mano. Todo abono, de cliente o a proveedor, se aplica a la nota o compra más antigua por fecha; al saldarla, el sobrante pasa a la siguiente, y lo que sobre al final queda como saldo a favor. Clientes y proveedores usan el mismo algoritmo de reparto. Una venta a crédito imprime nota, no ticket: dos copias, la interna con QR y la del cliente sin él.

Para abonos de clientes, “cuenta destino” usa las categorías operativas existentes, no un catálogo bancario inventado: el efectivo entra a `CAJA_FISICA` y una transferencia debe indicar `CUENTA_FISCAL` o `CUENTA_NO_FISCAL`. Los movimientos históricos pueden conservar `null`, pero todo abono nuevo debe registrar una categoría coherente con su forma de pago.

El pago dirigido se solicita desde el cobro del cliente o el pago al proveedor, se autoriza desde la notificación sin entrar a otra pantalla, y su histórico vive en Reportes como registro de cuántas excepciones a la regla FIFO ha habido. No es una pantalla de trabajo diario.

## Roles SISTEMAS y CONTADOR

**SISTEMAS** es el rol del técnico responsable de la aplicación. Opera todo y sí ve el dinero, porque diagnostica problemas de cartera y de precios. No vende ni cobra: sin POS, sin cortes, sin cobros. Lee la bitácora y no puede alterarla. No puede crear administradores ni tocar a un usuario que ya es ADMIN: esa llave se queda con el dueño.

**CONTADOR** ve todo lo financiero y no toca la mercancía: consulta entradas, salidas y movimientos para cuadrar, pero no crea ni edita ninguno. Registra pagos a proveedores y cobros. No administra el sistema.

Los dos existen separados de ADMIN para poder distinguir en la bitácora qué hizo cada quien.

La matriz de permisos del seed valida al arranque que cada fila tenga tantos valores como roles existan y que cada valor sea válido. Una fila corta niega permisos en silencio, y así se creó por accidente un rol incompleto en la Parte 7.

Decisión conservadora: CONTADOR tiene `crear` en `cobros_pagos` y en `proveedores_finanzas` porque registra cobros y pagos. Si se decide que el perfil sea puramente de consulta, esas dos celdas se pueden retirar de la matriz.

### Limpieza para el piloto

La limpieza autorizada dejó vacíos los datos operativos y conservó clientes, proveedores, sitios, usuarios reales, permisos y los 154 productos del catálogo aprobado. Los usuarios y sitios generados por pruebas que siguen referenciados por la bitácora inmutable se conservaron completos; nunca se fuerza su eliminación ni se altera la auditoría para borrarlos.

La pantalla de acceso y los servicios quedaron disponibles después de la limpieza. La comprobación autenticada de las pantallas con una cuenta real queda pendiente para el usuario porque la contraseña vigente del administrador no está disponible en el workspace; no se restablecen contraseñas reales ni se crean sesiones artificiales para una prueba.

### Pendientes antes del piloto

- Definir y probar el procedimiento de salidas extraordinarias.
- Configurar, ejecutar y comprobar respaldos y restauración.
- Preparar la toma de inventario físico.
- Tomar la decisión final de impresora y validar el flujo físico.
- Cambiar la contraseña inicial antes de producción.

## Product

- Login sin registro público ni recuperación de contraseña
- Sesiones de 12 horas con vencimiento por 30 minutos de inactividad
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
- **Ajuste de fuente en la etiqueta:** el nombre del producto y el metraje usan el tamaño más grande con el que quepan completos, en escalones discretos, con un mínimo legible por debajo del cual no bajan. Nunca se cortan. Una fuente fija que haga caber al nombre más largo del catálogo —36 caracteres— dejaría ilegible al más corto —11—, y la etiqueta se lee de lejos entre los rollos. Cualquier cambio a esta lógica se valida contra los 154 productos del catálogo, no contra dos ejemplos.
- Ejecuta `codegen` después de cada cambio en OpenAPI.
- Ejecuta `push` y luego `NODE_ENV=development pnpm --filter @workspace/db run seed` al preparar la base de desarrollo.
- Ejecuta `pnpm run db:verify` antes y después de cualquier cambio de esquema; debe identificar la misma base que el proceso de la API.
- Toda E2E que necesite crear usuarios, sesiones o datos debe usar una rama Neon desechable con una base vacía, esquema y seed actuales. `TEST_DATABASE_URL` debe existir y ser distinta de `DATABASE_URL`.
- Las suites mutantes exigen `NODE_ENV=test`, `REQUIRE_ISOLATED_TEST_DATABASE=1` y `TEST_DATABASE_URL`; además comparan `current_database()` con development antes de crear el pool. Las suites unitarias sin base usan una conexión local inutilizable para que una consulta accidental falle sin tocar development.
- Está prohibido crear ADMIN temporales o limpiar usuarios/sesiones mediante `executeSql({ environment: "development" })`. La limpieza E2E consiste en eliminar únicamente la rama Neon desechable.
- Los precios existentes solo se modifican por `/precios`; `PATCH /productos/:id` rechaza cualquier intento de evadir el historial. El precio inicial al crear producto sí está permitido.
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