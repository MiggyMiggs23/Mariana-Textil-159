# Prompt U — Plan de implementación de las decisiones de los socios

**17 de septiembre de 2026 · Documento para decidir el orden de trabajo.**

**Actualización de decisiones del mismo día:** incorpora la respuesta del propietario sobre extraordinarias, autorización ADMIN, aplicación diferida, ContadorF/ContadorA, Fondo y pago a proveedor dividido. Se conserva el resto del plan. La instrucción nueva **sustituye** la antigua reasignación y la lista de dos cuentas: no se mantienen como alternativas vigentes. Fuente textual adicional en A12. Ninguna de estas decisiones autoriza implementar o escribir datos en esta entrega.

**Esto no es una implementación ni una autorización de escrituras.** Se revisaron código y documentos; no se consultó ni escribió la base, no se ejecutaron pruebas, migraciones o reinicios, y no se modificaron la aplicación, sus contratos ni `replit.md`. T tiene entrega y cierre documentados, incluidas las correcciones posteriores de restitución y activación. Sus diez pendientes adicionales de reversos no se consideran parte reabierta de T. El Grupo 1 de P continúa **sin aprobar ni cerrar**. [A0]

## 1. Resumen para el propietario

La prioridad es poder distinguir tres hechos que hoy se mezclan en algunas consultas:

1. **Dónde se recibió o devolvió dinero.**
2. **Qué notas quedaron pagadas con ese dinero.**
3. **Qué se corrigió en los registros sin mover dinero físicamente.**

Guardar la tienda no basta: también hay que relacionar el efectivo real con su caja, conservar evidencia del reparto y distinguir los movimientos físicos de las correcciones. Esa base desbloquea **siete de las otras once entregas propuestas**, aunque cada una conserve sus autorizaciones y comprobaciones.

Hay infraestructura que se puede aprovechar: captura de abonos, vista previa FIFO, solicitudes de pago dirigido, salidas de dinero y cortes. **No hay una reasignación de un pago ya recibido ni un recibo de dinero implementados.** Tampoco existe el control completo de aceptar o reclamar una salida de dinero extraordinaria.

El plan actualizado tiene **doce entregas**: E1–E9 conservan sus identificadores; E5 cambia a aplicación diferida, E9 pasa a ser el ingreso al Fondo desde tiendas, y se añaden **E10 Fondo, E11 contadores y E12 pago a proveedor caja/Fondo**. El renombre de cifras y el filtro activo pueden adelantarse. La base del Fondo también puede construirse sin esperar a la aplicación de crédito: recibir remesas y pagar a proveedor se conectan después.

**La diferencia central:** cobrar dinero, aplicarlo al crédito del cliente y trasladarlo al Fondo son tres hechos distintos. El cobro pendiente de autorización ya cuenta físicamente en caja y tiene comprobante, pero **no reduce deuda, no aumenta crédito disponible ni se convierte en saldo a favor utilizable**. Pasarlo al Fondo tampoco lo aplica a una nota. Al autorizar su aplicación no se registra un segundo ingreso.

### Las trece decisiones son firmes

No se someten de nuevo a votación. La respuesta posterior modifica expresamente el mecanismo de la decisión 11 y precisa la excepción dirigida de la 3; las demás permanecen. La siguiente tabla recoge el alcance vigente, no dos versiones contradictorias. Los números E identifican entregas, no tareas iniciadas.

| Decisión | Resultado que se debe conservar | Entrega |
|---|---|---|
| 1 | Sitio guardado explícitamente en cada movimiento nuevo; sesión para el efectivo físico. No inferir después el sitio desde la nota. | E1, E2 |
| 2 | Anticipos y saldo a favor sin nota, con sitio de recepción y recibo impreso. | E1, E3 |
| 3 | FIFO global por defecto. Para un cobro solicitado como dirigido: ADMIN autoriza al momento o se conserva sin aplicar hasta autorización; no se reparte FIFO durante esa espera. | E1, E3, E5, E7 |
| 4 | El ajuste se atribuye a la tienda de la nota que lo originó, con evidencia de esa relación. Si no puede identificarse esa nota, se captura con tienda elegida y justificación obligatoria, según la precisión posterior de E1. | E1 |
| 5 | Ingreso/devolución física y corrección contable se distinguen obligatoriamente. | E1, E2, E7 |
| 6 | La devolución física sale de la caja abierta de hoy; no modifica el corte de recepción original. | E2 |
| 7 | Los tres movimientos señalados quedan «Sin sitio determinado», con atribución posterior posible y trazable. | E1, E7 |
| 8 | Global conserva esa categoría; la tienda muestra aplicaciones comprobables a sus notas, no cobros supuestamente recibidos allí. | E7 |
| 9 | Se prepara este plan antes de reanudar P. | Esta entrega; E7 es trabajo futuro |
| 10 | Proveedores: pago exclusivo de Mariana. Supervisor y cajero capturan extraordinarias en su propia tienda; ADMIN revisa. Ante reclamo, explicación del supervisor obligatoria y comprobante opcional. | E4 |
| 11 | Cualquier ADMIN autoriza; no hay lista de cuentas nombradas. Sin ADMIN disponible para el dirigido, se cobra y entrega comprobante sin aplicar a notas. No se construye reasignación de pagos ya aplicados. | E3, E5 |
| 12 | Cuentas Destino distingue Contado cobrado y Cobranza del periodo. Identidad: **Ventas = Contado + Ventas a crédito**. | E6 |
| 13 | La consulta principal de Inventario filtra productos activos. | E8 |

**Invariantes:** no cambiar FIFO ordinario ni la validación global del límite de crédito; no modificar los candados de inventario por producto y ubicación; ninguna tabla operativa usa DELETE. Un abono aplicado o una devolución legítima puede cambiar el saldo; atribuir una tienda, renombrar una tarjeta o trasladar efectivo entre caja y Fondo no puede hacerlo. El dinero pendiente de aplicación se conserva fuera del saldo de crédito utilizable hasta la autorización. Tampoco se cambia la regla exclusiva de Mariana para proveedores.

**Aclaración de alcance:** la espera descrita corresponde al cobro solicitado como **dirigido**, no a todos los cobros de la empresa. El ordinario sigue aplicándose por FIFO por defecto; no se introduce una aprobación ADMIN para todo abono ordinario.

## 2. Lo que se comprobó antes de proponer el plan

### 2.1 ¿Ya se puede reasignar un pago aplicado?

**No como una operación propia.** El camino actual es revertir el abono completo y capturarlo otra vez; dirigir el nuevo pago exige el flujo de autorización correspondiente. No existe una acción para trasladar solamente parte o todo el reparto de un pago ya registrado. Las aplicaciones anteriores no se editan ni borran.

El flujo dirigido actual permite a un ADMIN crear y aplicar inmediatamente; una solicitud de otro usuario queda pendiente **sin registrar todavía el abono ni acreditar un cobro en caja**. La autoridad ADMIN coincide ahora con la decisión nueva, pero esa solicitud pendiente no sustituye el registro de dinero ya recibido.

**La reasignación queda retirada del alcance.** E5 tendrá que aplicar dinero cobrado que todavía no participó en crédito. No se puede reutilizar el abono ordinario para «apartarlo»: su cálculo actual lo aplicaría o generaría favor. Hace falta representar el cobro pendiente por separado y vincularlo con la aplicación autorizada posterior. [A1–A3]

### 2.2 Alcance retirado: reasignación y aviso de nota reabierta

Con el reverso actual, al volver a consultar se recalculan su pendiente y estado; también cambian los estados de cuenta y las nuevas exportaciones. Es un hecho del sistema actual, no una propuesta de nueva reasignación.

**Eso no avisa por sí solo al cliente ni corrige el papel que ya tiene.** En las rutas revisadas no se encontró aviso específico de reapertura; sí existen avisos de resolución de solicitudes dirigidas, que son otra cosa. Además, el alcance por tienda de ciertos estados de cuenta sigue incompleto por P: no puede prometerse que hoy todas las vistas lo expliquen correctamente.

**La pregunta 6 anterior se elimina, como pidió el propietario.** La nueva E5 solo consume dinero todavía sin aplicar: no retira pagos de notas ya liquidadas. Debe demostrar que aplicar un pendiente no aumenta el saldo de ninguna nota previamente pagada. Esto no elimina los reversos/devoluciones legítimos ya existentes ni promete que una nota jamás pueda cambiar por esas otras operaciones. [A1–A3, A8]

### 2.3 ¿Ya existe salida extraordinaria de dinero?

**Existe una salida de dinero genérica**, con monto, motivo, sesión de caja, cuenta de origen y proveedor opcional. Por ello no hace falta inventar desde cero el registro de un egreso sin proveedor.

Pero el servidor bloquea actualmente **toda** esa salida fuera de Mariana. Además, no se encontró el ciclo específico de ADMIN que acepta o reclama y del supervisor que responde. El corte ya descuenta las salidas registradas de la sesión; no distingue todavía ese nuevo control administrativo.

E4 debe separar explícitamente pago a proveedor y salida extraordinaria. **Proveedor vacío no será una excusa para evadir el candado de proveedores.** La salida reduce el efectivo esperado desde que se registra, aunque ADMIN aún no la haya revisado: esperar su aceptación reproduciría el corte inexplicable que motivó la decisión. Reclamar no borra el gasto ni devuelve dinero ficticiamente.

Ya está decidido quién captura y responde: supervisor/cajero en su tienda; ante reclamo ADMIN, explicación obligatoria del supervisor y comprobante opcional, solo si lo tiene. No bloquear la respuesta por falta de fotografía o documento.

No confundir este tema con las salidas extraordinarias **de rollos** por merma, robo o muestra; esas pertenecen a Inventario y quedan fuera. [A4]

### 2.4 ¿Existe recibo de dinero y qué formato puede aprovecharse?

**No se encontró un recibo de dinero implementado** en rutas, contratos o componentes. El historial de abonos, la vista previa del reparto, el estado de cuenta y el recibo de mercancía de una nota no lo sustituyen.

Sí hay una **especificación previa** de recibo de dinero: A5 horizontal, dos copias, folio propio, emisión desde un movimiento registrado, reimpresión identificada y auditada, aplicaciones y saldos conservados. Recomiendo reutilizar esa especificación, no volver a empezar el diseño ni tomarla como prueba de que ya existe. Su variante de pago a proveedor no se incorpora automáticamente a U. [A5]

| Documento comparable actual | Formato / capacidad documentada | Qué aporta al nuevo recibo |
|---|---|---|
| Salida | A5 horizontal; **10 renglones de producto por página**, con medición comentada en la plantilla. | Referencia de encabezado, márgenes, paginación y firmas. No prueba que quepan diez aplicaciones de crédito. |
| Nota | A5 vertical; **8 renglones de producto por página**, con medición documentada. | Referencia de importes, totales y bloques que no deben dividirse. |
| Entrada | Carta vertical; **10 renglones globales por página**; series tienen acomodo separado/dinámico. | Referencia de datos largos, pie indivisible y continuidad entre hojas. |
| Ticket | Térmico de 80 mm; no se encontró una cuota fija documentada de renglones. | No utilizar como supuesto de capacidad para A5. |
| Exportación financiera genérica | Paginación de **55 líneas** de texto. | No equivale a 55 renglones de un recibo con logo, saldos y firmas. |

**La capacidad del recibo sigue sin medir.** Debe medirse con varias notas, descripciones largas, saldo a favor, firmas y las dos copias. No se fijará en diez por parecerse a Salida. No se imprimieron pruebas en esta entrega. [A5–A6]

### 2.5 ¿Por qué no se puede asignar después una tienda?

El movimiento de crédito no tiene campos propios de tienda y sesión. Sus movimientos y aplicaciones están protegidos contra edición y eliminación. Tampoco existe una operación autorizada de atribución posterior.

**Propuesta recomendada:** guardar el sitio explícito para nuevos movimientos y una constancia adicional, inmutable, para atribuir posteriormente un histórico: movimiento exacto, tienda acreditada, evidencia, motivo, autor y fecha de decisión. Una rectificación de esa constancia agrega otra; no borra la anterior. Esto no representa dinero recibido hoy.

Alternativa: permitir un enriquecimiento controlado de los campos del movimiento original. Es menos recomendable porque obliga a modificar la protección de inmutabilidad y a demostrar que no permite alterar importes u otros hechos. No se recomienda usar un ajuste monetario para añadir una tienda: cambiaría dinero para corregir un dato descriptivo.

Los **tres movimientos** se toman de la decisión firmada y de la última lectura documentada, no de un conteo nuevo. No se atribuye automáticamente ni siquiera el que tiene una nota relacionada. Tampoco se suman los tres indiscriminadamente como cobranza: una venta a crédito no es efectivo recibido. La atribución posterior puede mover importes entre tiendas y «Sin sitio determinado», pero no puede fabricar una sesión histórica ni modificar un corte cerrado. [A1, A7]

### 2.6 Comprobaciones adicionales para la actualización

- **Fondo:** no se identificó un libro, pantalla o arqueo de tesorería equivalente. El «fondo inicial» existente pertenece a una sesión de caja; no es el Fondo de Mariana ni se debe fusionar con él.
- **Pago a proveedor:** el registro financiero y la salida de caja son caminos diferentes. El pago actual aplica al proveedor, pero no admite caja/Fondo/mixto ni registra por sí solo esas dos fuentes de dinero. E12 requiere una operación coordinada, no dos pagos al proveedor.
- **Contadores:** hoy existe un único rol técnico CONTADOR, global y sin tienda. La separación F/A y las restricciones nuevas de datos/preparación no están completas por ese hecho. Hay respuestas de clientes con direcciones/datos fiscales y consultas/exportaciones con costo, utilidad o margen que deben revisarse por servidor.
- Estas son comprobaciones de código, no lecturas de usuarios, saldos o movimientos reales. Referencias nuevas en A12.

## 3. Conflictos con reglas vigentes

Se dejan señalados, **sin corregir `replit.md` en U**. Las trece decisiones ya resuelven la dirección de estos cambios; falta implementarlas y sustituir las reglas viejas en la entrega correspondiente.

| Regla o comportamiento vigente | Decisión posterior / tratamiento futuro |
|---|---|
| «Cada tienda debe recibir el abono de sus propias notas», aunque el cálculo de crédito es global. | Decisión 3 permite FIFO entre tiendas. La tienda de recepción no será una condición para bloquear un cobro ni para cambiar el FIFO. Cita documental exacta en A7. |
| Ventas = Contado cobrado + Ventas a crédito; otras secciones mantienen el encabezado Cobrado y la decisión de nombres como pendiente. | Decisión 12 exige **Ventas = Contado + Ventas a crédito**. E6 retirará todas las redacciones sustituidas, no agregará una nota contradictoria al final. |
| Toda salida de dinero por el registro actual se limita a Mariana. | Decisión 10 conserva el candado únicamente para proveedores y permite extraordinarias en las tres tiendas. |
| Cualquier ADMIN puede autoaplicar y aprobar un pago dirigido; una solicitud no ADMIN espera sin registrar el dinero. | Se confirma la autoridad de cualquier ADMIN. La recepción del dirigido debe registrarse aunque falte autorización, pero queda sin aplicar: no FIFO provisional ni reasignación posterior. |
| La atribución de cobros se obtiene en varias consultas desde las notas o aplicaciones. | Decisiones 1, 7 y 8 separan recepción y aplicación; para nuevos movimientos se conserva el origen explícito y para los tres históricos no se inventa. |
| La protección actual impide editar un movimiento para completar su sitio. | La atribución posterior requiere una vía nueva compatible con esa protección; no quitarla por conveniencia. |

No se considera conflicto de U el permiso ADMIN de baja extraordinaria **de inventario**. Tampoco se propone que cualquier ADMIN autorice dirigidos por tener facultad de revisar gastos: son facultades distintas.

La autoridad de cualquier ADMIN para el dirigido procede de la **nueva decisión expresa del propietario**, no de deducirla del permiso de gastos. Se retiran las restricciones anteriores a dos cuentas.

**Conflictos nuevos que deben quedar visibles:**

- La regla vigente de aplicar el dinero recibido a deuda elegible antes de generar favor sigue rigiendo al **abono ordinario**. No permite registrar el dinero retenido como abono/favor mientras espera autorización. Se necesita una categoría separada de cobro pendiente.
- La definición actual de cobranza no tiene esa nueva categoría. E6 continúa siendo un renombre sin cambio numérico; E7 deberá añadir el dinero efectivamente recibido pendiente de aplicación y evitar volver a contarlo cuando se aplique.
- La salida actual de proveedor en efectivo no representa dos fuentes. La futura documentación debe distinguir caja del turno y Fondo sin retirar la exclusividad de Mariana.
- El rol único CONTADOR y sus respuestas actuales no acreditan los dos perfiles nuevos ni la protección de datos. Lectura global no concede operación global.
- **Pregunta sin resolver:** Fondo solo ADMIN frente a la evidencia que necesita ContadorF para cuadrar pagos a proveedor. No se abre el Fondo a contadores ni se decide ocultarles una evidencia indispensable sin la respuesta del propietario.

## 4. Entregas propuestas

**Cómo leerlas:** «global» se refiere al usuario que ve toda la empresa. Las diferencias monetarias deberán desglosarse por documento y fuente antes de liberar cada cambio; este plan no inventa montos actuales. Los archivos, rutas, contratos y pruebas concretos están exclusivamente en el anexo técnico, asociados al mismo número E.

### E1 — Origen del dinero y evidencia de crédito

**Tamaño: grande. Decisiones: 1, 4, 5, 7; base de 2, 3, 6 y 8.**

- **Precisión aprobada tras el Bloque 0:** exactamente una naturaleza obligatoria en cada movimiento nuevo: ingreso físico, devolución física, corrección contable u operación de crédito sin movimiento de dinero. Esta última corresponde a la venta a crédito y a su reverso automático sin dinero físico. Matriz de los siete productores, aprobación textual de diseño, clave aislada por productor y restricciones de verificación en `reports/e1-bloque0-decisiones-aprobadas.md`; no es autorización de escrituras en la base ni prueba de implementación.
- **Construye:** origen explícito de todos los nuevos movimientos de crédito, relación a sesión cuando hay efectivo real y exactamente una de las cuatro naturalezas aprobadas. Incluye ventas a crédito, abonos ordinarios y dirigidos, reversos y ajustes; no solo el formulario de abono. El ajuste conserva una referencia comprobable a la nota que lo originó cuando es identificable; si no lo es, exige tienda elegida y justificación obligatoria, sin bloquear la captura por esa ausencia. Conserva identificador de la operación para evitar un cobro duplicado.
- **Omisión del plan detectada:** la baja por incobrable también inserta un `AJUSTE` mediante SQL directo en `artifacts/api-server/src/routes/clientes-admin.ts:185–190`. Queda cubierta expresamente, como corrección contable, además del ajuste manual y de los demás productores.
- **Base nueva:** distinguir el comprobante de recepción del efecto sobre crédito. Para dinero dirigido en espera, conservar cliente, monto, saldo todavía sin aplicar, fecha/hora real de recepción, sitio, medio/cuenta, sesión si es efectivo y motivo/referencia. No insertar un abono ordinario que el cálculo pueda consumir antes de autorizar.
- **Históricos:** deja los tres indeterminados y prepara atribución posterior con evidencia. No adivina sitio por usuario, banco, fecha o nota. Conserva la identidad y fecha del movimiento al relacionar evidencia antigua, porque un ID por sí solo puede haberse reutilizado tras una purga.
- **Dependencias:** ninguna entrega de U; diseño aprobado en la constancia del Bloque 0, pero requiere autorización separada de escrituras. La atribución real de históricos espera la evidencia y decisión del propietario; no se ejecuta en E1. **La esperan directamente E2 e, indirectamente, E3, E4, E5, E7, E9 y E12.**
- **Qué toca:** registro de crédito, captura actual del cliente y productores automáticos; comprobaciones de origen, permisos, auditoría, consultas de evidencia y futura atribución. Detalle técnico E1/A1/A7.
- **Qué puede desalinearse:** aplicaciones móviles/web con cargas antiguas, aprobación de dirigidos, autorización de notas, reversos, ajustes, estado de cuenta y consultas que todavía deducen sitio. La estructura nueva no se libera con productores viejos que omitan sus datos obligatorios.
- **Cifras globales:** agregar evidencia o asignar una tienda no cambia deuda, saldo a favor, Ventas o cobranza total. Cambian únicamente los repartos por sitio y el subtotal «Sin sitio determinado» al atribuir un histórico. Un cobro nuevo retenido sí aumenta dinero recibido y pendiente de aplicación, pero no deuda/favor/disponible. Ningún histórico se convierte automáticamente en dinero retenido.
- **Verificación:** cada productor guarda origen válido; efectivo y corrección no se confunden; mismos registros monetarios antes/después; históricos intactos; permisos negativos; reintento sin duplicación; atribución tardía sin edición ni sesión inventada. **Propietario:** determina qué evidencia histórica es suficiente y reconoce la tienda donde realmente se recibió, algo que el programa no puede comprobar por una nota.
- **Salida segura:** es una base técnica, no un piloto financiero por sí sola. Coordinar nuevas capturas con E2 y E3. El modo dirigido en espera se activa solo con E5 y los lectores de E7 listos; no dejar dinero registrado sin capacidad de verlo, aplicarlo y conciliarlo.

### E2 — Corte confiable y devolución física en la caja de hoy

**Tamaño: grande. Decisiones: 1, 5, 6; habilita la captura de 2.**

- **Construye:** incorporación de abonos físicos y cobros dirigidos retenidos en efectivo a su sesión, caja abierta exigida para efectivo y no para transferencia. La devolución física requiere la caja abierta de hoy, motivo, fuente y evidencia; no cambia el corte de recepción original. Las correcciones contables quedan separadas de los movimientos del cajón.
- **Dependencias:** E1 y decisión sobre alcance de devoluciones, pregunta 3. **La esperan E3, E4 y E12; también, por cadena, la recepción E9.**
- **Qué toca:** apertura/cierre y lectura del corte, historial, detalle e impresión de corte; validación transaccional de entrada/salida real y su vínculo al crédito. Detalle E2/A4.
- **Fórmula a verificar:** fondo inicial de la sesión + cobros físicos de tickets en efectivo + abonos físicos + cobros físicos pendientes de aplicación − salidas físicas de la sesión. Los grupos deben ser disjuntos: un mismo cobro no entra como pendiente y abono a la vez. Una devolución ya incluida en salidas **no se resta dos veces**. Transferencias, aplicación posterior y traslado al Fondo no son cobros nuevos.
- **Qué puede desalinearse:** efectivo esperado, diferencia contra contado, desglose por medio/cuenta, reportes diarios y cortes impresos; cierre concurrente con abono/devolución. No sumar un pago a través de cada nota que liquidó.
- **Cifras globales:** para un periodo con abonos/cobros retenidos en efectivo, aumentan el **efectivo esperado de las sesiones** y disminuye la diferencia inexplicada correspondiente; una devolución nueva reduce el efectivo de hoy. No aumenta de nuevo **Ventas**, **Contado cobrado** ni **Cobranza del periodo** por incorporar al corte un cobro ya registrado. En E12, solo la parte caja del proveedor disminuye este esperado.
- **Verificación:** dos cajas/sitios, efectivo contra transferencia, caja cerrada, cierre simultáneo, devolución hoy de pago anterior, corrección sin dinero y operación repetida. Comparación de corte, historial y papel con desglose trazable. **Propietario:** conteo físico y comprobante de devolución; confirmar que el dinero realmente salió y que el corte antiguo permanece igual.

### E3 — Registrar abono desde Caja, anticipos y recibo

**Tamaño: grande. Decisiones: 2, 3; primera parte de 11.**

- **Requisito del propietario para el diseño futuro de captura:** la pregunta que identifica la naturaleza debe ser comprensible para el cajero y distinguir dinero realmente recibido de una recaptura sin dinero nuevo. No basta con que el campo sea obligatorio: no debe inducir a elegir cualquier respuesta para avanzar. La aceptación de E3 deberá comprobar esa comprensión con escenarios operativos, incluido el caso de las recapturas por $25,000 del 15 de septiembre de 2026. No se diseña aquí la pantalla ni su redacción final.
- **Construye:** entrada desde Caja reutilizando la captura del cliente, no un segundo motor de cobro. FIFO por defecto; vista previa obligatoria con notas, importes, remanente y saldo a favor. Permite anticipo sin nota. Al confirmar vuelve a validar saldos y caja, evita doble envío y conserva evidencia suficiente para emitir el recibo.
- **Dirigido sin ADMIN:** la vista previa debe decir **«Recibido, pendiente de aplicación»**, importe retenido y que deuda/disponible todavía no cambian. No mostrar notas como pagadas ni llamar saldo a favor utilizable a ese dinero. La recepción no necesita que ContadorA ya haya preparado la aplicación.
- **Recibo:** A5 horizontal y dos copias según especificación previa; folio propio y acceso posterior desde el historial. Conserva importes y reparto tal como se registraron, no los recalcula al reimprimir. El anticipo ordinario sin deuda conserva su tratamiento de favor; el dirigido retenido imprime **sin aplicación**, sin aplicaciones ni favor inventados. Al aplicarlo después se emite una constancia vinculada al recibo, no otro cobro ni una reescritura del comprobante original. Fallar la impresora no vuelve a cobrar.
- **Dependencias:** E2, que incluye E1. **La espera E5.**
- **Qué toca:** Caja, diálogo de pago del cliente, historial/detalle, nueva vista imprimible y evidencia de emisión/reimpresión; detalle E3/A5/A6. La variante del recibo de proveedores se deja fuera de esta entrega, salvo ampliación expresa.
- **Qué puede desalinearse:** respuesta de vista previa y confirmación, historial de pagos, permisos actuales de clientes frente al acceso desde Caja, copias y reimpresiones. No ampliar todos los permisos financieros de Caja solo para añadir este acceso.
- **Cifras globales:** el abono ordinario reduce deuda o aumenta favor según el cálculo actual. El cobro retenido aumenta **dinero recibido pendiente de aplicación**, sin bajar deuda ni subir disponible o favor utilizable. Ambos entran una sola vez a cobranza. Imprimir, reimprimir o autorizar después no genera otro ingreso.
- **Verificación:** pago a tres notas de distintas tiendas, anticipo puro, exceso, nota pagada entre vista previa y confirmación, doble clic/reintento, impresión y reimpresión con evidencia íntegra. Recibos históricos insuficientes se explican y no se reconstruyen con saldos actuales. **Propietario:** dos copias legibles, firmas, corte de papel, márgenes y lectura de datos largos en la impresora real.
- **Límite:** el flujo ordinario puede verificarse antes de E5. No habilitar el dirigido retenido en operación real hasta tener E5 y E7 completos; su fecha de cobro se conserva aunque se autorice otro día.

### E4 — Salidas de dinero extraordinarias y revisión ADMIN

**Tamaño: mediana. Decisión: 10.**

- **Construye:** clasificación explícita de proveedor frente a extraordinaria. Mantiene proveedor exclusivo de Mariana; **supervisor y cajero capturan en su propia tienda**, con motivo obligatorio y sesión/cuenta correctas. ADMIN acepta o reclama; ante reclamo, **explicación del supervisor obligatoria y comprobante opcional**, solo si lo tiene. Cruces y Coco pagan sus extraordinarias desde su caja, nunca desde el Fondo.
- **Dependencias:** E2. **La esperan E7 y, por esa vía, E9.** Puede ir antes o después de E3; el orden sugerido pone primero el recibo.
- **Qué toca:** salida de dinero existente, corte y reporte diario, bandeja o detalle de revisión y permisos de captura/revisión; detalle E4/A4. No toca las bajas o salidas extraordinarias de rollos.
- **Qué puede desalinearse:** el candado de Mariana, listados por sesión, saldo por cuenta, reporte de gastos y auditoría. Aceptar/reclamar no duplica el egreso ni recalcula un corte cerrado como si no hubiera sucedido.
- **Cifras globales:** una nueva salida física disminuye efectivo esperado/disponible y aumenta **salidas de dinero del día**. La mera aceptación o reclamación no cambia importes. No es pago a proveedor ni movimiento del saldo del cliente.
- **Verificación:** supervisor/cajero permitidos en su tienda y denegados en otra; extraordinaria permitida en Coco/Cruces/Mariana; proveedor rechazado fuera de Mariana; motivo ausente; sesión cerrada; ADMIN acepta/reclama; supervisor responde sin autoaceptarse, no puede omitir explicación y sí puede omitir comprobante; doble registro/revisión. **Propietario:** comprobar clasificación del gasto y que ya descontó del corte aun pendiente de aceptación. Esas reglas ya están decididas, no se vuelven a preguntar.

### E5 — Aplicación diferida de un cobro sin aplicar

**Tamaño: grande, con menor alcance y distinto riesgo que la E5 anterior. Decisiones: 3 y 11 actualizadas.**

- **Construye:** dinero solicitado como dirigido que se recibe y queda esperando; ContadorA puede preparar su aplicación a cualquier nota del mismo cliente, facturada o no, sin aplicarla. **Cualquier ADMIN** aprueba. No hay lista de personas ni facultad de aprobación para contador, supervisor o cajero. Con ADMIN disponible se permite autorizar el dirigido al momento.
- **Mientras espera:** importe y antigüedad desde la recepción visibles en ficha/estado de cuenta y lista de pendientes conforme al alcance de lectura. La deuda no baja; el disponible y el favor utilizable no suben. Preparar o modificar una propuesta tampoco produce efecto financiero.
- **Dependencias:** E3 para recepción/comprobante y E11 para preparación/lecturas de contadores. **La espera E7.** Desaparece la dependencia de decidir cómo reasignar aplicaciones históricas y de comunicar notas reabiertas. La activación se coordina con E7, no se libera una cola invisible para las consultas.
- **Qué toca:** registro de cobros pendientes, solicitud/preparación, aprobación/rechazo, saldo retenido, estado de cuenta, antigüedad, avisos y constancia de aplicación; detalle E5/A2/A3/A12.
- **Propuesta técnica recomendada:** un registro de recepción separado del libro que afecta crédito, vinculado a la aplicación autorizada. Alternativa: distinguirlos dentro de un libro ampliado, con exclusión explícita de pendientes en todos los cálculos de deuda/disponible. La segunda tiene mayor riesgo de que alguna consulta los descuente antes de tiempo. Ninguna alternativa edita aplicaciones anteriores.
- **Dos fechas distintas:** conservar la fecha real de cobro para caja/cobranza y la fecha real de autorización/aplicación para el efecto de crédito. No insertar el efecto de crédito retroactivamente para que reordene aplicaciones anteriores. La aprobación comprueba saldo actual de la nota y dinero todavía disponible, no confía en la vista previa vieja.
- **Atomicidad:** aprobación consume una sola vez el dinero retenido, registra la aplicación exacta y enlaza su evidencia. Dos ADMIN o un reintento no pueden aplicarlo dos veces. Si la nota ya se pagó por otro medio, se detiene esa propuesta para revisión: no se retira dinero de otra nota ni se cambia de destino sin autorización.
- **Qué puede desalinearse:** suma de dinero recibido/aplicado/pendiente, corte, fechas de cobranza, favor, crédito disponible, solicitudes, exportaciones y avisos. Rechazar una propuesta no borra el cobro ni lo convierte automáticamente en FIFO. Falta decidir el tratamiento de rechazo, remanentes y aprobación parcial en las preguntas finales.
- **Cifras globales:** recepción: suben cobranza física y dinero pendiente, no cambian deuda/disponible. Aplicación: baja el pendiente retenido y puede bajar deuda/vencido, subir disponible o generar favor autorizado según el reparto; **no vuelven a subir cobranza, efectivo, Ventas ni Contado cobrado**. Una nota previamente pagada no vuelve a tener saldo por esta operación.
- **Cambio de riesgo:** desaparecen reasignación, reapertura y modificación del reparto ya entregado al cliente. Aparecen riesgos de dinero retenido indefinidamente, doble aplicación y doble conteo. El trabajo sigue siendo grande porque la recepción y el crédito hoy están acoplados; no basta cambiar el nombre del botón.
- **Verificación:** FIFO ordinario intacto; dirigido retenido sin ADMIN; comprobante inmediato; deuda/disponible/favor invariantes durante espera; preparación por ContadorA sin aplicación; aprobación de cualquier ADMIN; bloqueo a otros roles; nota saldada durante la espera; aprobaciones concurrentes; fechas diferentes; traslado físico al Fondo sin aplicar al cliente; constancia y recibo sin segundo cobro. **Propietario:** comprobar que se entiende «ya pagó dinero, pero todavía no se aplicó» y que la antigüedad mostrada coincide con la operación real.
- **Fuera:** no construir reasignación de pagos ya aplicados, ni convertir históricos en dinero pendiente de aplicación. R4/R5 siguen pendientes separados, no son prerrequisitos automáticos para aplicar un cobro nuevo con evidencia íntegra.

### E6 — Nombres de cobranza e identidad de ventas

**Tamaño: chica. Decisión: 12.**

- **Construye:** Cuentas Destino y sus documentos distinguen **Contado cobrado** de **Cobranza del periodo**. Sustituye las identidades anteriores en la documentación canónica por **Ventas = Contado + Ventas a crédito**.
- **La cobranza del periodo incluye contado:** en la línea base actual, Contado + Abonos a notas + Saldos a favor recibidos, con sus reversos neteados. E7 incorporará además los cobros nuevos pendientes de aplicación sin duplicarlos después. Esa extensión se comprueba separadamente; E6 sigue siendo solo renombre, no excluye contado ni altera valores existentes.
- **Dependencias:** ninguna entrega financiera de U. **La espera E7** para conciliar con nombres inequívocos. Puede adelantarse.
- **Qué toca:** encabezados, desgloses, exportaciones y contratos de presentación de Cuentas Destino/Tiempo real, más sustitución de reglas anteriores; detalle E6/A9.
- **Qué puede desalinearse:** títulos de PDF/XLSX, denominadores de porcentajes, pruebas de nombres y asociación entre tarjeta y detalle. No renombrar claves técnicas indiscriminadamente ni aprovechar para alterar consultas.
- **Cifras globales:** **ninguna cambia de valor por E6**. Exigir igualdad al centavo antes/después para cada componente y total. La atribución por sitio se corrige en E7, no a escondidas en un renombre.
- **Verificación:** mismos valores y filtros, etiquetas consistentes en pantalla/archivos, textos legibles a 402 px; la identidad escrita anterior desaparece donde fue sustituida. **Propietario:** confirma comprensión del vocabulario y de los documentos impresos. El título específico «Cobros de periodos anteriores» se conserva como pendiente separado del apartado 6; no se da por autorizado todo cambio de redacción del sistema.

### E7 — Atribución en consultas y reanudación ordenada de P

**Tamaño: grande. Decisiones: 7, 8, 9; consume 1, 3, 5, 11 y 12.**

- **Construye:** lectura coherente de recepción de dinero, aplicación a notas y corrección contable en Cuentas Destino, Tiempo real y estados de cuenta. Añade dinero cobrado pendiente de aplicación y antigüedad sin confundirlo con favor. Global muestra «Sin sitio determinado»; una tienda recibe solamente sus aplicaciones comprobables, rotuladas como aplicaciones, no como cobros recibidos allí.
- **Dependencias:** E4, E5 y E6; incluye las bases anteriores. Esta es una propuesta de secuencia conservadora, no una autorización para reanudar P hoy. **La espera E9.**
- **Qué toca:** consultas compartidas, desglose, cartera, estado de cuenta y exportaciones; retoma primero el Grupo 1 de P con su clasificación ya acordada. Detalle E7/A8/A9.
- **Qué puede desalinearse:** abonos ordinarios sin nota desaparecidos de archivos por tienda, reversos, saldo pendiente de notas permitidas, clasificación global indebida, páginas de movimientos, XLSX/PDF/impresión y permisos. No volver a calcular FIFO por tienda ni sustituirlo por la suma de aplicaciones históricas.
- **Cifras globales:** atribuir sitio no debe cambiar **deuda global, saldo a favor, límite disponible, Ventas o cobranza total**. Sí cambian repartos por tienda y Sin sitio determinado. El dinero nuevo retenido agrega una categoría a cobranza: se cuenta por su recepción una vez, y su posterior aplicación no aumenta el total ni traslada el cobro a otro día. La deuda/disponible solo cambian cuando se aplica. Capital y traslados del Fondo no son cobranza de clientes. Presentar puente por fuente/periodo y conservar los totales históricos no afectados.
- **Alcance y privacidad:** ContadorF/ContadorA reciben lectura global conforme a E11. Para otros usuarios, la lista y el dinero en espera respetan sus sitios autorizados; no introducir por accidente una quinta cifra global irrestricta donde P solo permite cuatro. Identificación, direcciones, margen y Fondo se excluyen por servidor y de documentos/enlaces para contadores.
- **Histórico:** mantener los tres movimientos indeterminados. No presentar las recapturas históricas como nuevo ingreso físico comprobado. Los $25,000 por sitio frente a $0 neto global son un hallazgo histórico de atribución, no una medición nueva ni dinero encontrado en el cajón.
- **Verificación:** lectura global idéntica cuando solo cambia alcance; cuatro cifras globales de crédito conservadas; detalle restringido y leyendas dentro de archivos; cliente de varias tiendas, pago repartido, favor, reverso, indeterminado y cobro retenido que se aplica otro día. Cada tarjeta concilia con detalle/exportaciones; contadores ven todas las ventas/cobranza, no solo facturadas, sin datos prohibidos. **Propietario:** verifica que las leyendas no confundan recepción, aplicación y espera.
- **P no se cierra en bloque:** primero subsanar y acreditar Grupo 1; luego proponer la ejecución de grupos 2–4 según su inventario vigente. Una comparación de archivos con datos simulados no sustituye la comprobación autenticada autorizada. No inventar como ya construido el tablero de Clientes.

### E8 — Inventario: consulta de productos activos

**Tamaño: chica. Decisión: 13.**

- **Construye:** filtro de producto activo en la consulta agrupada que usa la pantalla principal, con y sin existencia y también en búsqueda. No es un cambio del estado de los rollos.
- **Dependencias:** ninguna entrega de U; se puede adelantar. **No bloquea entregas financieras.**
- **Qué toca:** consulta agrupada y sus pruebas, comprobación de la pantalla de Inventario; detalle E8/A10. No añade otra opción para volver a mostrar inactivos en esa consulta.
- **Qué puede desalinearse:** número de grupos/filas y cantidades visibles, búsquedas y pruebas de inclusión de productos inactivos. No extender silenciosamente el filtro al kardex, detalle por serie, auditorías, reconstrucción de existencias o reportes históricos. No confundir producto activo con sitio o piso activo.
- **Cifras globales:** pueden disminuir los **productos/grupos y existencias visibles en esa consulta**, por excluir productos inactivos; los movimientos y cantidades almacenadas no se alteran. No cambia una cifra financiera ni se recalcula inventario.
- **Verificación:** producto activo/inactivo, con cero/con existencia, búsqueda y cada sitio autorizado; un detalle histórico sigue legible y los datos originales quedan intactos. **Propietario:** comprueba que desactivar un producto significa que ya no desea verlo en la consulta operativa, sin perder su historial.

### E9 — Entregas de tiendas: recepción autorizada e ingreso al Fondo

**Tamaño: grande. La naturaleza ya está decidida; el procedimiento de entrega sigue pendiente de conversación de socios.**

- **Construye:** enlace entre corte de la tienda, entrega, confirmación de recepción en Mariana e ingreso al Fondo. **El Fondo aumenta al autorizarse la recepción, no cuando la tienda manda el dinero.** La confirmación y el ingreso quedan unidos: no puede existir uno duplicado o sin su origen.
- **Dependencias:** E7 para corte/cuentas conciliados y **E10 para que exista el Fondo con movimientos y arqueo**. E2/E4 están incluidos por cadena. La forma operativa de entregar sigue como pregunta 8: U no la decide. E9 no es ya una pieza aislada ni condición para construir los ingresos directos del Fondo.
- **Qué toca:** entregas/recepciones, confirmaciones, pendientes por origen y sus comprobantes; integración con Fondo, corte y navegación de evidencias; detalle E9/A4/A9/A12. La tienda ve el estado de su propia entrega sin recibir saldo/historial del Fondo.
- **Alternativas pendientes:** corte completo o entregas parciales; cómo confirmar diferencias y cómo documentar lo enviado frente a lo recibido. El plan no asume que enviar y recibir ocurren el mismo día ni reescribe el corte cerrado. Registrar el efectivo en tránsito evita que parezca estar simultáneamente en tienda y Fondo.
- **Qué puede desalinearse:** saldo por ubicación/custodia, efectivo en tránsito, pendientes de confirmación y conciliación por periodo. El ingreso debe abrir el corte y la confirmación exactos; no basta enviar a un listado general.
- **Cifras globales:** cambia saldo del Fondo al recibir y disminuye el pendiente interno correspondiente; **no aumenta el dinero total de la empresa, cobranza, ventas ni saldo de crédito**. Si el efectivo era un cobro retenido de cliente, continúa sin aplicar hasta E5, aunque físicamente ya esté en el Fondo.
- **Verificación:** envío sin ingreso prematuro al Fondo; recepción ADMIN única; dos confirmaciones simultáneas; diferencias; remesa de otro periodo; navegación a corte/confirmación; no duplicación de cobranza ni aplicación al cliente; sin acceso al Fondo por enlaces de la tienda. **Propietario:** entrega física, conteo y aceptación de diferencias según el procedimiento acordado por los socios.

### E10 — Fondo de Mariana: movimientos, arqueo e historial

**Tamaño: grande. Entrega nueva.**

- **Construye:** pestaña **Fondo** en la sección financiera de la barra lateral, **solo ADMIN, solo Mariana y siempre Mariana**. No puede crearse uno por tienda ni elegirse Coco/Cruces como ubicación del Fondo. Ningún contador, supervisor o cajero recibe pantalla, endpoints, saldo, movimientos, archivos o enlaces autorizados al Fondo.
- **Ingresos:** entregas de tiendas autorizadas mediante E9; ingresos directos por capital, saldo inicial y cualquier otro origen permitido, todos con motivo obligatorio. **Saldo inicial es el primer ingreso con motivo «saldo inicial»**, no un campo editable fuera del historial. No copiar el fondo inicial de una caja ni importar saldos históricos sin autorización.
- Ese primer ingreso reconoce efectivo existente: no es venta, cobro de cliente ni capital nuevo por el solo hecho de cargarlo. Al fijar el inicio debe conciliarse con lo que ya figure en caja o en entregas pendientes, para no contar el mismo dinero en dos lugares.
- **Salidas:** retiros para cualquier concepto con motivo; los pagos a proveedor se conectan mediante E12, una sola vez y vinculados a su pago. Un retiro genérico no debe sustituir silenciosamente ese registro si se trata de un pago a proveedor.
- **Arqueo e historial:** saldo del sistema, efectivo contado, fecha/autor y diferencia persistida; historial completo de movimientos y arqueos. Contar no ajusta silenciosamente el saldo. Un movimiento mal capturado se corrige con su inverso, conservando original, motivo y enlace; no DELETE ni edición del importe inicial.
- **Trazabilidad de cifras:** saldo abre movimientos que lo explican; cada ingreso/gasto abre su detalle. Ingreso de tienda lleva al corte y confirmación; proveedor lleva a su pago; ingreso directo al comprobante/motivo; arqueo al conteo y diferencia. No dejar cifras sin detalle.
- **Dependencias:** la base de movimientos, ingresos directos, retiros y arqueo puede construirse **sin esperar a E5 ni a E9**, porque no necesita aplicar crédito de clientes. La recepción desde tiendas requiere E9, y la salida a proveedor E12. **Desbloquea directamente E9 y E12.** No habilitar accesos incompletos a esas dos integraciones antes de verificarlas.
- **Qué toca:** esquema/libro de Fondo, rutas de movimientos/inversos/arqueos, controles ADMIN, pestaña, historial/detalle y navegación; detalle técnico A12. No reutilizar el saldo de sesión de caja.
- **Qué puede desalinearse:** saldo físico contra sistema, autorización por enlaces/API, cierre de detalle contra saldo, clasificación de capital/traslado como cobranza, retiros duplicados y movimientos posteriores a un arqueo. La concurrencia exige saldo consistente y una fecha de corte del conteo claramente definida.
- **Cifras globales:** ingresos directos/retiros cambian **saldo del Fondo y efectivo total de la empresa** según su naturaleza real; remesas internas solo cambian localización. **Ventas, Contado cobrado, cobranza de clientes y deuda de clientes no cambian por capital o traspasos.** El arqueo agrega contado y diferencia, no un ajuste monetario automático.
- **Verificación:** solo ADMIN; Fondo siempre Mariana incluso manipulando la solicitud; ingresos/motivos, primer saldo inicial, inverso y reintento, saldo/historial conciliados, arqueo con sobrante/faltante y movimientos concurrentes, enlaces precisos, ausencia de datos para contadores. **Propietario:** cuenta físicamente, reconoce saldo inicial/capital y comprueba que la diferencia queda registrada sin desaparecer al cerrar la pantalla.
- **¿Por etapas?** Sí como construcción interna: movimientos/historial primero, arqueo después. **Recomiendo entregar y habilitar ambos juntos.** Publicar movimientos reales sin arqueo deja meses de errores sin detección, exactamente el riesgo señalado por el propietario. La alternativa de un piloto sin arqueo exigiría autorización expresa y control físico externo documentado; no se asume ni se recomienda. Las integraciones E9/E12 sí pueden llegar después sobre un Fondo ya completo.

### E11 — ContadorF y ContadorA: lectura global protegida y preparación

**Tamaño: grande. Entrega nueva de permisos y contratos de lectura.**

- **ContadorF:** solo consulta; no registra operaciones ni prepara aplicaciones. Ve **todas** las ventas y cobranza, facturadas o no, para cotejar su registro manual. No filtrar su análisis exclusivamente por lo fiscal.
- **ContadorA:** puede preparar una aplicación de dinero ya recibido a cualquier nota del mismo cliente, facturada o no; **no aplica ni aprueba**. ADMIN resuelve por el flujo dirigido. Preparar no crea dinero ni disminuye deuda; debe referir un cobro pendiente real, no un importe libre sin fuente.
- **Ambos:** globales, sin tienda asignada. Ven nombre, contacto, límite, cartera con saldos, estado de cuenta y notas. No ven identificaciones, direcciones ni otros datos sensibles; tampoco margen por venta ni datos que permitan obtenerlo por un desglose de costos/utilidad. No tienen acceso al Fondo.
- **Dependencias:** no necesita que el Fondo ya esté construido para negarles acceso. La separación de perfiles y lecturas puede prepararse al inicio. **Desbloquea E5 y E12**, y por cadena E7/E9. La preparación funcional de ContadorA se activa con E5; antes no se presenta como una facultad ya operativa.
- **Qué toca:** perfiles/roles actuales, altas y edición de usuarios, matriz de permisos, controles de cada lectura/escritura, contratos filtrados, listados/detalle y archivos de clientes, notas y finanzas; detalle A12. Elegir dos roles técnicos o dos perfiles estrictos del rol existente es una decisión de implementación, no otra pregunta para los socios.
- **Qué puede desalinearse:** defaults de permisos, usuarios CONTADOR existentes, respuestas reutilizadas por otros roles, descargas/reimpresiones con datos sensibles y enlaces a documentos completos. Quitar una columna visual no protege los datos recibidos por el navegador. Permitir preparar tampoco debe conceder el permiso genérico de cobrar/ajustar.
- **Cifras globales:** los importes permitidos deben coincidir con el global autorizado de ADMIN, no reducirse a ventas facturadas. Cambia visibilidad, **no los saldos o totales de la empresa**. No asignar una tienda ficticia para satisfacer un formulario.
- **Verificación:** matriz positiva/negativa de F/A; consultas globales, facturadas/no facturadas; inspección de JSON, PDF/XLSX, notas/reimpresiones y enlaces; rechazo de creación de pagos/ajustes/gastos/aprobaciones; A prepara sin afectar dinero; F no prepara; Fondo inaccesible. **Propietario:** contrasta una conciliación manual y confirma que ve los importes necesarios sin los datos prohibidos.
- **Pendiente concreto:** decidir cómo asignar F o A a los usuarios CONTADOR que ya existan, sin convertirlos automáticamente a mayor privilegio. Además, la evidencia que ContadorF necesita de pagos a proveedor queda como pregunta expresa; no se abre el Fondo para resolverla por conveniencia.

### E12 — Pago a proveedor en efectivo: caja, Fondo o ambos

**Tamaño: grande. Se mantiene el pago a proveedor exclusivo de Mariana.**

- **Construye:** un único pago con total y desglose elegible por el usuario: caja del turno, Fondo, o mixto. Las partes deben sumar exactamente el total. **$1,247,000 = $1,000,000 de Fondo + $247,000 de caja**: el proveedor recibe un pago por $1,247,000; el corte resta $247,000; el Fondo registra una salida de $1,000,000.
- **Dependencias:** E2 para efectivo de caja, E10 para Fondo y E11 para contratos/privacidad de contadores. No necesita E9 para usar un Fondo alimentado mediante ingreso directo autorizado. El conflicto de visibilidad de ContadorF requiere respuesta antes de cerrar su recorrido de consulta.
- **Qué toca:** diálogo/pago de proveedor, registro de pago y reparto a compras, salida de caja, movimiento del Fondo, corte, estado de cuenta/historial de proveedor y enlaces; detalle A12. Incluir todas las entradas equivalentes, también una aprobación dirigida de proveedor si termina registrando ese mismo pago en efectivo; no dejar un camino que evada el desglose.
- **Consistencia:** validar montos y disponibilidad; registrar pago y dos fuentes en una operación indivisible, evitando pago financiero sin egreso o doble egreso sin pago. Si la parte caja es mayor que cero, exigir sesión abierta de Mariana. La necesidad de sesión cuando el pago es exclusivamente Fondo queda como pregunta operativa, no como candado heredado por accidente.
- **Permisos:** usar o conocer la porción Fondo debe respetar solo ADMIN. Un operador no ADMIN no puede conseguir saldo ni retiro del Fondo manipulando el pago de proveedor. Qué facultades previas se conservan para un pago exclusivamente caja se contrasta con los permisos vigentes; no se amplían automáticamente.
- **Qué puede desalinearse:** dos registros de pago por el mismo proveedor, doble aplicación FIFO, salida de caja genérica añadida otra vez, reversos de un pago mixto, detalle/exportación por fuente y diferencia del corte. Transferencia/facturado no reciben reparto de efectivo caja/Fondo.
- **Cifras globales:** deuda/favor del proveedor cambian una sola vez por el total según las reglas vigentes; efectivo esperado de caja baja solo por su tramo y Fondo solo por el suyo. El efectivo total disminuye por la suma, **no por suma más pago duplicado**. Ventas, cobranza de clientes y crédito de clientes no cambian.
- **Verificación:** caja sola, Fondo solo, mixto con el ejemplo exacto; sumas incorrectas, centavos, negativos, falta de saldo, sesión requerida, reintento/doble aprobación y fallo entre registros; detalle que reconcilia las partes; inversos vinculados según procedimiento autorizado; imposibilidad de pagar proveedor fuera de Mariana. **Propietario:** compara salida física de ambas fuentes con pago y corte, y valida la evidencia para su conciliación.
- **Por qué separarla de E10:** Fondo cuenta efectivo; proveedor aplica pagos a su propia deuda. Comparten una transacción de integración, pero no el motor de saldo. Construir el libro y arqueo primero facilita comprobar qué se descontó de cada lugar.

## 5. Orden, dependencias y qué se puede juntar

### 5.1 Orden recomendado

**Crédito/caja:** E1 → E2 → E3 → E5 → E7 → E9, con E4 después de E2 y antes de E7; E11 aporta roles/lecturas a E5 y E6 los nombres a E7.

**Fondo:** E10 puede construirse en paralelo con el inicio del trabajo financiero. Después, **E9 conecta las remesas** cuando corte/consultas sean fiables y los socios definan el procedimiento. **E12 conecta proveedores** cuando estén listos E2, E10 y los contratos de acceso de E11. E12 no espera a E9: puede usar ingresos directos autorizados al Fondo.

**Orden recomendado por tandas:** (1) E1, base de E11 y E10 en archivos independientes, adelantando E6/E8; (2) E2; (3) E3 y E4 con integración ordenada de Caja; (4) E5 y E12 según disponibilidad de sus superficies; (5) E7; (6) E9 tras la conversación de socios. No es obligación construir todo en paralelo ni una autorización para comenzar.

Las razones no son el tamaño: el corte necesita origen/sesión; retener dinero requiere comprobante y separación del crédito; preparar necesita el permiso del contador; aplicar necesita dinero real ya conservado y ADMIN; remesar necesita un Fondo donde ingresar y un corte conciliable. El libro y arqueo del Fondo no necesitan resolver antes la aplicación de notas.

| Entrega | Predecesoras directas propuestas | Desbloquea directamente | Desbloquea por cadena, sin contarse a sí misma |
|---|---|---|---:|
| E1 | — | E2 | **7:** E2, E3, E4, E5, E7, E9, E12 |
| E2 | E1 | E3, E4, E12 | **6:** E3, E4, E5, E7, E9, E12 |
| E3 | E2 | E5 | **3:** E5, E7, E9 |
| E4 | E2 | E7 | **2:** E7, E9 |
| E5 | E3, E11 | E7 | **2:** E7, E9 |
| E6 | — | E7 | **2:** E7, E9 |
| E7 | E4, E5, E6 | E9 | **1:** E9 |
| E8 | — | — | **0** |
| E9 | E7, E10 + procedimiento de socios | — | **0** |
| E10 | — para libro/arqueo; integraciones posteriores | E9, E12 | **2:** E9, E12 |
| E11 | — para separación y acceso; preparación se integra en E5 | E5, E12 | **4:** E5, E7, E9, E12 |
| E12 | E2, E10, E11 + decisión de visibilidad | — | **0** |

Son prerrequisitos de construcción, no promesa de cierre automático: faltan autorizaciones y respuestas. La captura retenida de E3, la preparación del contador y la aplicación de E5 se aceptan con sus lectores E7; no activar por separado una función a la que le falte esa integración. La base del Fondo se acepta con arqueo, aunque sus conexiones E9/E12 lleguen después.

Si se desea reanudar antes el Grupo 1 de P, la alternativa es trabajar tras E1–E3 y E6, reservando la conciliación de cobros pendientes/aplicados y los accesos de E11. Obliga a revisar nuevamente los consumidores después; **no autoriza cerrar P con esa cobertura incompleta**. Por eso recomiendo una sola integración final del alcance financiero.

### 5.2 Combinaciones recomendadas y separaciones

- **Juntar en E1** origen, naturaleza física/contable y evidencia histórica: los tres definen qué significa un movimiento. Añadir solo una columna dejaría abierta la causa del corte.
- **Juntar en E2** abonos en corte y devolución en la caja de hoy: comparten sesión, efectivo esperado y conservación del corte anterior.
- **Juntar en E3** botón, vista previa, anticipo y comprobante, con distinción de dinero pendiente: son la misma recepción de dinero. El recibo debe contar con evidencia desde la primera operación.
- **Juntar en E4** permitir extraordinarias y su revisión: habilitar únicamente el egreso deja sin construir el control que pidió el propietario.
- **Juntar en E6** renombre en pantalla/archivos y sustitución de la identidad: no dejar tres vocabularios vigentes.
- **Separar E5 de E2/E4:** aplica por primera vez dinero retenido al crédito; el otro trabajo cuenta dinero físico. No son el mismo motor, aunque ambos estén en Caja.
- **Separar E8 de todo lo financiero:** filtra una consulta operativa; no necesita modificaciones de crédito ni corte.
- **Juntar movimientos, arqueo e historial en la aceptación de E10:** el arqueo es el control necesario del libro físico, no un adorno posterior.
- **Separar E9 de la base E10:** el procedimiento de entrega sigue pendiente y no debe bloquear ingresos directos/arqueo. Su integración sí es indivisible: autorizar una recepción crea exactamente un ingreso al Fondo.
- **Separar E12 de la base E10:** conecta deuda de proveedores con dos fuentes físicas; comparte una transacción de pago, no un solo motor contable. No repartirlo en «pago primero y salida del Fondo después».
- **Separar E11, pero integrarlo con E5/E7/E12:** roles y privacidad afectan muchas lecturas; esconder el Fondo o un botón no reemplaza proteger API/documentos.
- E6 y E8 podrían publicarse en un mismo paquete de cambios pequeños, pero deben conservar verificaciones y aceptación separadas: no comparten naturaleza ni riesgo.

### 5.3 Paralelo sin editar los mismos archivos

- **E8 contra E1:** consulta y pruebas de inventario frente a esquema/rutas de crédito; sin cambios de contratos para E8, pues la forma de respuesta no cambia.
- **Base E10 contra E1:** módulos nuevos de Fondo, movimientos/arqueos y vista propia frente a crédito. Esquemas compartidos, contrato general, navegación y documentación se integran por un solo responsable, no desde dos escritores.
- **E6, limitado a presentación existente, contra E1:** etiquetas/exportaciones de Cuentas Destino frente al registro de crédito. E6 no renombra claves del contrato ni toca la consulta de atribución. La edición de documentación canónica se integra por una sola persona, no desde ambas entregas simultáneamente.
- **E3 contra E4, después de E2:** se pueden preparar componentes de recibo/historial y revisión de salidas en archivos propios. No prometer paralelismo integral: ambos pueden requerir contratos, rutas de Caja y menú compartidos. Esas modificaciones se integran en orden.
- **E11:** se puede preparar la matriz de perfiles y componentes de lectura aislados; sus cambios en rutas de clientes se serializan con E1/E5/E7. No prometer independencia por llamarse «permisos».
- **No paralelizar sin coordinación** E1/E5 sobre crédito; E2/E4/E12 sobre corte; E5/E12 sobre aprobaciones dirigidas; ni E7/E9/E11 sobre cuentas/lecturas. Las conexiones E9/E12 al Fondo esperan una interfaz E10 estable.
- Contrato API único, código generado, documentación canónica y archivos de navegación compartidos tienen **un solo escritor por tanda**. La tabla técnica especifica esos cruces; no se considera independiente una entrega solo porque su pantalla tenga otro nombre.

### 5.4 Autorización textual y escrituras

La regla vigente exige guardar en `reports/` **la autorización textual original del propietario y su alcance exacto antes de la primera escritura financiera**. Un plan, un resumen del agente o una autorización de otra operación no bastan. [A11]

- **E1:** columnas/tablas/validaciones, eventual atribución histórica y cualquier transformación de datos. No desactivar triggers ni autorizar un backfill implícito.
- **E2–E5:** pruebas y operaciones que registren pagos, devoluciones, gastos, revisiones, cobros retenidos, preparaciones/autorizaciones/aplicaciones o folios/evidencia de recibo. No se autoriza reasignación.
- **E7:** puede desarrollarse con lectura y datos simulados; si su aceptación requiere preparar datos o escribir movimientos, necesita autorización aparte, sin aprovechar una lectura como permiso de escritura.
- **E9/E10/E12:** entregas/recepciones, ingresos directos y saldo inicial, retiros/inversos, arqueos y pagos divididos requieren autorización y alcance propios. El saldo inicial del Fondo no se carga por estimación ni aprovechando una migración.
- **E11:** cambios de roles/perfiles, permisos, asignaciones y cualquier preparación de datos requieren autorización explícita; no crear, convertir o asignar usuarios reales desde este plan. La autorización de una captura no ampara una migración de privilegios.
- **E6 y E8:** se proponen sin escrituras de negocio ni migración. Si se modifica ese alcance o se preparan datos, se detiene y se solicita autorización.
- Una prueba autenticada necesita la solución de entorno y actores permitidos. Las 28 suites que crean usuarios no quedan autorizadas por aprobar U. No usar development como base de ensayo ni limpiar operaciones con DELETE.

Cada entrega debe conservar comparación con su línea base, resultados completos y negativos semánticos de las pruebas nuevas/rehechas en copias aisladas. No cambiar expectativas para obtener verde. Las pruebas automatizadas de interfaz autorizadas las ejecuta el implementador; al propietario solo se le asignan decisiones de negocio y comprobaciones físicas que el entorno no puede demostrar.

## 6. Lo que U no resuelve

Se conserva el barrido de la primera entrega: antes de crear el plan se localizaron **168 archivos Markdown en `reports/`**, de los cuales **93** contenían términos de pendiente/no cierre, además de `replit.md`. No son 93 pendientes independientes ni un conteo nuevo de esta actualización. Se contrastaron ahora las superficies afectadas por el nuevo alcance, sin repetir una auditoría completa ni consultar datos/usuarios.

### 6.1 Pendientes de desarrollo, decisión o revisión no cubiertos

| ID | Pendiente conservado | Qué falta / relación con U |
|---|---|---|
| R1 | **69 vetos de acción por rol** | Revisar cada restricción y decidir cuáles permanecen. E4/E5/E10/E11/E12 cubren solo facultades expresamente autorizadas; no cierran todo el inventario ni convierten su conteo histórico en un inventario recalculado. |
| R2 | **28 suites que crean usuarios** | Clasificar y adaptar al entorno/actores autorizados; no ejecutarlas ni crear usuarios para hacerlas pasar. No confundir con el manifiesto de 28 archivos de otro reporte. |
| R3 | **Etiqueta con nombres largos y color** | Rediseño y aceptación física pendientes. El reporte documenta un desbordamiento preexistente en 1 de 1,234 etiquetas; no atribuirlo a los ocho dígitos ni afirmar que todo color se pierde. |
| R4 | **Aplicaciones históricas que ocupan capacidad tras revertirse la venta** | La evidencia histórica y la disponibilidad actual no coinciden necesariamente. Sigue pendiente separado; E5 ya no reasigna esas aplicaciones ni convierte su reparación en prerrequisito automático del cobro nuevo retenido. |
| R5 | **Ajuste negativo sin la misma evidencia que un abono** | Puede generar favor, pero no tiene la misma vía de prueba de aplicaciones. No inventar equivalencia ni adjudicarle una aplicación sin evidencia. |
| R6 | **Título «Cobros de periodos anteriores»** | Sigue registrado como incorrecto pese al subtítulo «Abonos a notas», pero la búsqueda literal no encontró esa cadena en la fuente actual. Queda pendiente conciliar esa discrepancia; no declarar cierre por un reporte visual anterior ni afirmar que se vio hoy en pantalla. |
| R7 | **Diez vías de reverso de inventario** | Recepción tras traslado; venta administrativa tras restitución; ticket parcial con remanente trasladado; las dos patas de transferencia; ajuste positivo consumido por baja; ajuste negativo anterior a otra baja; baja en tránsito; reverso de cancelación; devolución histórica. Faltan definición de operación completa y trato de evidencia insuficiente. |
| R8 | **Catálogo de telas y agrupaciones de Precios** | Variantes/acentos pueden dividir grupos; el catálogo de telas sigue como solución de fondo pendiente. |
| R9 | **Facturación de ventas con líneas metreadas** | La restricción se conserva y está pendiente la confirmación de negocio registrada. U no autoriza retirarla. |
| R10 | **Confirmación administrativa para borrar** | Decidir la alternativa pendiente entre credenciales de un segundo ADMIN y contraseña del ADMIN en sesión; no modificarla por U. |
| R11 | **Historial de precios sin otros movimientos** | Decidir si cuenta como actividad para impedir eliminación del producto; mientras tanto no borrar producto ni historial. |
| R12 | **Aviso cuando coexisten saldo a favor y deuda abierta** | El dato/vista previa no acredita el aviso específico solicitado. |
| R13 | **Encabezados de Nota que todavía dicen Ticket** | Revisión de «Ticket #…» y «Cancelar Ticket» para notas; decisión de vocabulario separada de los dos nombres de cobranza. |
| R14 | **Importe de notificaciones frente al pendiente de la nota** | Hay un hallazgo registrado de aviso con importe original; requiere reconciliar con el estado actual antes de corregir o dar por cerrado. |
| R15 | **Predicados financieros divergentes conservados en S** | Revisar su intención por contexto; no homogeneizar ventas, crédito y alertas como si fueran duplicados. E7 cubre atribución/alcance, no una auditoría general de todos esos filtros. |
| R16 | **Fechas en solicitudes dirigidas y proveedores** | Permanecen caminos con fecha sin hora o sin zona horaria/validación equivalente. E5 y E12 deben cubrir expresamente sus rutas afectadas; no se declara corregido todo el resto por actualizar el plan. |
| R17 | **Pantallas independientes de ajuste, corte individual y evento de bitácora** | Requieren contratos, permisos y alcance propios. No confundir el corte imprimible existente con haber construido cada destino de navegación pendiente. |
| R18 | **Tablero de Clientes y demás filas abiertas del inventario P** | No construidos/no cerrados por este plan. E7 propone su secuencia posterior, no su aprobación anticipada. |
| R19 | **PDF genérico: URL larga** | Fallo preexistente registrado en la comparación de Grupo 1. El nuevo recibo no lo corrige automáticamente. |
| R20 | **Expectativas de pruebas antiguas pendientes de reconciliación** | El reporte S conserva cinco fallos iguales antes/después en su manifiesto. El cierre posterior de 390 pruebas de otro conjunto no demuestra por sí solo el cierre de esos cinco casos. |
| R21 | **Comprobación obligatoria antes de integrar cambios** | Sigue pendiente decidir el control automático que bloquee una integración si fallan tipos o el verificador. El build local ya protegido no demuestra que ese control se ejecute obligatoriamente antes de integrar. |

### 6.2 Evidencia, entorno y aceptación todavía pendientes

| ID | Pendiente | Tratamiento |
|---|---|---|
| V1 | Autorización textual de ciertas escrituras financieras históricas no comprobada | No repetir, revertir o modificar esos movimientos para «completar» la prueba. Es una brecha documental, no permiso para reparar. |
| V2 | Base permanente de pruebas y condiciones de uso | Sigue pendiente la decisión registrada de costo, responsables y aislamiento. El entorno local desechable no equivale a aprobar una base permanente ni las suites prohibidas. |
| V3 | Impresora de etiquetas, pistola y cámara física | Falta aceptación física documentada, incluido el recorrido de lecturas consecutivas. Una prueba de imagen o código de barras digital no basta. |
| V4 | Estados visuales PAGADA y CON RETRASO y nota real impresa | No confundir pruebas de render con recorrido autenticado y papel acreditados. Reconciliar las verificaciones históricas pendientes al planear cada entrega afectada. |
| V5 | Exportaciones autenticadas y casos mixtos de P | Grupo 1 permanece abierto pese a comparaciones aisladas aprobadas. Su aceptación futura debe cubrir los casos que faltan y conservar el alcance autorizado. |
| V6 | Legibilidad en teléfono e iluminación real de tienda | La documentación conserva límites de verificación física; no declararlos cerrados por una captura a 402 px. |
| V7 | Controles de reimpresión de etiquetas y entradas sin costo | Son controles operativos vigentes, no prueba automática de desarrollo faltante. Hay que conservar revisión explícita de etiquetas y resolución por captura de costos; abrir la pantalla no atiende ninguno. No se consultó cuántos casos reales siguen pendientes. |

**No se cuentan dos veces:** atribución, corte, recibo, extraordinarias, aplicación diferida, renombre, filtro activo, remesas, Fondo, contadores y pago dividido están en E1–E12. Los problemas de Grupo 1 pertenecen a E7, aunque su estado actual continúe abierto. La reasignación de pagos ya aplicados y su pregunta de nota reabierta se **retiran**, no se trasladan a una lista de futuras mejoras.

**No se reabren como pendientes de U:** T y la exclusión de restitución de una misma baja tienen cierre documentado; la activación quedó restringida. El viejo ejemplo venta → activar → reverso ya no es reproducible por ese eslabón; el riesgo restante de reverso de venta figura en R7 con otra combinación. Los errores de tipos históricos no se presentan como actuales frente al chequeo completo posterior en cero. Ninguno de esos cierres equivale a resolver todos los pendientes de R1–R21.

## Anexo técnico — referencias y superficies de cambio

Los nombres de código se limitan a este anexo. Las líneas se refieren a la revisión leída para U y pueden moverse en una implementación posterior.

### Mapa de archivos por entrega

Las rutas siguientes son relativas al repositorio. «Nuevo propuesto» designa una opción de organización, no un archivo ni endpoint ya implementado. Todas las modificaciones de contratos, cuando sean necesarias, pasan por `lib/api-spec/openapi.yaml` y su generación; no se editan clientes generados a mano.

| Entrega | Archivos/pantallas principales y extensión prevista |
|---|---|
| E1 | `lib/db/src/schema/pos.ts`, `lib/db/src/lib/clientes-schema.ts`, `artifacts/api-server/src/routes/clientes.ts`, `src/routes/pagos-dirigidos.ts`, `src/lib/pos.ts`; diálogo `artifacts/mariana-textil/src/components/cliente-pago-dialog.tsx`. Evidencia/atribución histórica: módulo de esquema y rutas dedicado, nuevo propuesto. |
| E2 | `artifacts/api-server/src/lib/pos.ts`, `src/routes/pos.ts`, `lib/db/src/schema/pos.ts`; `artifacts/mariana-textil/src/pages/caja/cortes.tsx`, `src/pages/corte-detail-shared.tsx`. Devolución y campos del corte: contrato extendido, no reutilizar un reverso contable como egreso físico sin clasificación. |
| E3 | `artifacts/mariana-textil/src/components/cliente-pago-dialog.tsx`, páginas de Caja y detalle/historial de cliente; `src/pages/recibo-dinero.tsx` como nuevo propuesto y registro de ruta en `src/App.tsx`. API de emisión/reimpresión y conservación de evidencia desde `routes/clientes.ts`, con módulo separado propuesto para documento y folio. |
| E4 | `artifacts/api-server/src/lib/pos.ts`, `src/routes/pos.ts` y esquema de salidas; `artifacts/mariana-textil/src/pages/caja/cortes.tsx`; componente separado propuesto para revisión. Nuevas acciones de aceptar/reclamar/responder, además del POST existente de salida. |
| E5 | `artifacts/api-server/src/routes/pagos-dirigidos.ts`, `src/lib/credit-aging-read-model.ts`, `src/lib/credit-allocation.ts` como consumidor a proteger, esquema de solicitudes/evidencia; `artifacts/mariana-textil/src/components/solicitud-pago-dirigido-dialog.tsx`, solicitudes/notificaciones y detalle del cobro. Nuevos contratos de recepción pendiente, preparación y aplicación autorizada; **no ruta de reasignación**. |
| E6 | `artifacts/mariana-textil/src/pages/caja/cuentas-destino.tsx`, consumidores de Tiempo real y pruebas de rótulos; exportadores en `artifacts/api-server/src/routes/admin-analytics.ts`; `replit.md` **solo en la futura implementación**. No modificar el cálculo para renombrar. |
| E7 | `artifacts/api-server/src/routes/clientes.ts`, `src/lib/admin-analytics.ts` y lectores compartidos de cartera/alcance; pantallas de cliente, Cuentas Destino y desgloses; contratos y pruebas por grupo de P. Los demás handlers se seleccionan del inventario de P, no se autorizan por proximidad. |
| E8 | `artifacts/api-server/src/routes/inventario.ts`, pruebas de la consulta agrupada y `artifacts/mariana-textil/src/pages/inventario.tsx` como consumidor a verificar. Sin cambio de forma de respuesta ni de motores. |
| E9 | Tras precisar procedimiento: módulos nuevos de entregas/recepciones y confirmaciones; integración con `artifacts/api-server/src/routes/pos.ts`, `src/routes/admin-analytics.ts`, cortes y libro/pantalla de Fondo. Contrato de remesa y recepción autorizada que crea ingreso único, no confirmación fiscal. |
| E10 | Nuevos propuestos: `lib/db/src/schema/fondo.ts`, `artifacts/api-server/src/lib/fondo.ts`, `src/routes/fondo.ts`, `artifacts/mariana-textil/src/pages/fondo.tsx` y componentes de movimientos/arqueo. Registro en exports/router/navegación existentes y contrato OpenAPI. No son rutas ya implementadas. |
| E11 | `lib/db/src/schema/enums.ts`, `artifacts/api-server/src/routes/users.ts`, permisos/resolvedores de lectura y `src/routes/clientes.ts`; contratos/serializadores y pantallas/exportadores de cliente. Revisar identidad de sesión y limpieza/separación de cachés al cambiar usuario/perfil, no solo menú. |
| E12 | `artifacts/api-server/src/routes/proveedores.ts`, `src/lib/compras-proveedor.ts`, `src/routes/pagos-dirigidos.ts`, `src/lib/pos.ts`, esquemas de pagos/orígenes y Fondo; `artifacts/mariana-textil/src/components/proveedor-pago-dialog.tsx`, detalle/historial de proveedor, corte y Fondo. Contrato de origen/desglose vinculado a un solo pago. |

En cada fila, `src/...` abreviado conserva la raíz del artefacto nombrado inmediatamente antes. Los archivos compartidos de E1/E2/E4/E5 y E7/E9 explican por qué no se promete paralelismo integral.

### A0. Fuente, condición de arranque y alcance de esta revisión

- Pedido original: `attached_assets/Pasted--Prompt-U-Plan-de-implementaci-n-de-las-decisiones-de-l_1789678333394.txt`, decisiones 22–56, comprobaciones 64–75, entregas 81–127, pendientes 133–155 y prohibiciones 159–172. Actualización posterior en A12 sustituye el alcance incompatible de la antigua decisión 11; no es autorización de implementación.
- Cierre T: `reports/prompt-t/verificacion.md:5–29,59–65`; corrección posterior: `reports/single-roll-return/verificacion.md`; restricción y límites: `reports/activation-programado/verificacion.md`.
- Referencia Q: `reports/prompt-q-diseno-atribucion-sitio.md:9–113`; su lectura de tres movimientos es del **16/09/2026 a las 23:22:37 CDMX**, no una consulta efectuada para U.
- No se leyó producción ni se inspeccionaron usuarios/secretos. No se puede cuantificar el efecto actual con montos reales desde esta revisión estática.

### A1. Crédito, estado de cuenta y evidencia — E1, E3, E7

- Esquema: `lib/db/src/schema/pos.ts:299–345`, `movimientosCreditoTable`; aplicaciones: `lib/db/src/schema/aplicaciones-credito.ts`. Campos de sitio/sesión no existen en el movimiento.
- Inmutabilidad/capacidad: `lib/db/src/lib/clientes-schema.ts:212–256,285–304`; triggers contra UPDATE/DELETE, validación de aplicación y SUM histórico.
- Rutas: `artifacts/api-server/src/routes/clientes.ts`:
  - `POST /api/clientes/:id/pagos/vista-previa`, 2068–2121.
  - `POST /api/clientes/:id/pagos`, 2124–2251.
  - `POST /api/clientes/:id/pagos/:pagoId/reversar`, 2285–2345.
  - Estado de cuenta 1356–1500; exportaciones 1504–1635; detalle de pago 1844–1962.
- Consumidores: `artifacts/mariana-textil/src/components/cliente-pago-dialog.tsx`, `cliente-nota-credito.tsx`; estados/documento en `pages/ticket-detail.tsx`.
- Contratos actuales/nuevos: `lib/api-spec/openapi.yaml`, generación en `lib/api-client-react` y `lib/api-zod`; documentar entradas de origen/naturaleza/sesión, evidencia y resultados de vista previa sin añadir deducciones silenciosas. Nueva atribución histórica exige esquema/rutas/permisos propios; nombre final propuesto, no endpoint existente.
- Para el nuevo cobro retenido, proponer un registro separado con `fechaRecepcion`, importe/pendiente, cliente, sitio/sesión/medio y vínculo único a solicitudes/aplicaciones. Los nombres son ilustrativos. No registrar `ABONO` consumible ni `saldoAFavor` utilizable antes de autorización. Captura, evidencia del cobro y efecto de caja deben ser atómicos.
- Productores cubiertos por E1: autorización de nota y reverso automático de `artifacts/api-server/src/lib/pos.ts`, abono/reverso/ajuste de las rutas de clientes, dirigido en `routes/pagos-dirigidos.ts` y **ajuste por baja incobrable en `routes/clientes-admin.ts:185–190`, omitido en el inventario anterior del plan**. La matriz completa revisada consta en `reports/e1-bloque0-decisiones-aprobadas.md`. No limitar el cambio a ABONO.
- Referencias de regresión: pruebas de crédito/FIFO bajo `artifacts/api-server/src/lib/`, contratos de notas y estados de cuenta; no ejecutar `inventario.test.ts` ni suites financieras con escrituras como si fueran pruebas puras.

### A2. Proyección frente a aplicaciones — E1, E5, E7

- `artifacts/api-server/src/lib/credit-allocation.ts:233–275,520–562`: `projectCreditLedger`/proyección por movimientos; fuentes revertidas y `directedMovimientoId`.
- `artifacts/api-server/src/lib/credit-aging-read-model.ts:35–75`: evidencia `aplicaciones_credito`, SUM de importes y JOIN de solicitud dirigida aprobada.
- `artifacts/api-server/src/routes/clientes.ts:1929–1959`: `projectedCharge.pendienteCents`, `deriveEstadoNota`; presentación de estado de cuenta en 215–445.
- `artifacts/mariana-textil/src/pages/nota.contract.test.ts:47–55,66–123`: estado canónico, pendiente y vencimiento.
- Límite: nuevas constancias no pueden convertirse simplemente en «SUM de aplicaciones = saldo». E5 aplica una fuente nueva, autorizada y financiada por un cobro pendiente real; conserva FIFO ordinario y no edita repartos anteriores. Fecha de recepción y fecha de efecto en crédito deben distinguirse para no retrotraer ni reordenar pagos ya aplicados.

### A3. Pago dirigido — E5

- `artifacts/api-server/src/routes/pagos-dirigidos.ts:212–260`: `POST /api/pagos-dirigidos`, autoaplicación de ADMIN y solicitud no ADMIN pendiente sin abono.
- Mismo archivo 269–285: `POST /api/pagos-dirigidos/:id/aprobar`, `requireRole("ADMIN")`; revisar también rechazo y cada autoaplicación, no solo el botón de aprobación.
- `notifyRequesterResolved` avisa resolución de solicitud; no acredita una notificación específica de reapertura de nota.
- Superficies: esquema de `solicitudes_pago_dirigido`, componentes/página de solicitudes y `App.tsx`, contratos OpenAPI, lectura de crédito, auditoría y posibles constancias nuevas.
- Operación propuesta, no existente: preparación sobre un `cobroPendienteId` real y aprobación ADMIN que registra su primera aplicación. El asiento de crédito que se genere al aplicar no constituye otra recepción física; debe conservar vínculo y exclusión de doble conteo en caja/cobranza. No aceptar un importe/destino libre sin fuente disponible y relación exacta al cliente.
- `requireRole("ADMIN")` coincide con la decisión nueva de cualquier ADMIN; no añadir allowlist de personas. Separar permiso de ContadorA para preparar de permisos para recibir dinero, crear ajustes y aprobar. No ampliar `clientes_finanzas.puedeCrear` indiscriminadamente para implementar preparación.
- R4/R5: `replit.md:1070` diferencia `projectCreditLedgerCore`, `evaluateAutomaticFavorEligibility`, `immutableAppliedCents` y falta de vía equivalente para AJUSTE_NEGATIVO. Siguen fuera del arreglo de históricos, no se resuelven ni bloquean automáticamente toda aplicación de una fuente nueva.

### A4. Caja y salidas de dinero — E2, E4, E9

- `artifacts/api-server/src/lib/pos.ts:1592–1618`: `crearSalidaDineroCaja`, proveedor opcional, motivo, sesión abierta y `CASH_OUT_LOCATION_FORBIDDEN`.
- `buildCorteCaja`, mismo archivo 2156–2211 y 2425–2473: pagos de tickets por sesión, salidas por sesión/cuenta y esperado; no incluye ABONO de crédito.
- `artifacts/api-server/src/routes/pos.ts:1014–1094`: `/api/sesiones-caja/:id/corte`, `/cerrar`, GET/POST `/salidas-dinero`; permisos y alcance deben conservarse o ampliarse solo para las acciones aprobadas.
- Esquema de sesiones y salidas de dinero en `lib/db/src/schema/pos.ts`; frontend `artifacts/mariana-textil/src/pages/caja/cortes.tsx`, `pages/corte-detail-shared.tsx` y sus consumidores.
- Contratos: corte, cobro pendiente de aplicación, salidas, creación/revisión y devolución/recepción. Nueva revisión: explicación obligatoria al responder reclamo, attachment opcional. No hay hoy ciclo completo de aceptar/reclamar identificado.
- Referencias de regresión: cortes/POS, `pos-caja-final.contract.test.ts` y pruebas de sesión; precisar qué son contratos sin DB frente a integración con escrituras antes de ejecutarlas.
- **No reutilizar como dinero** `routes/salidas.ts` ni `lib/salidas.ts`: esas recepciones son inventario. Tampoco `POST /admin/cuadre-fiscal/confirmaciones` acredita recepción física en Mariana.

### A5. Recibo: ausencia de implementación y especificación previa — E3

- Búsqueda de recibo/receipt en rutas, contratos y componentes: no se identificó documento de dinero. `receipt-preview-excess` en `cliente-pago-dialog.tsx` es vista previa de saldo a favor. El bloque de `ticket-detail.tsx:958–964` acredita mercancía, no abono.
- Especificación previa: `attached_assets/Pasted--Prompt-para-Replit-Agent-Recibo-de-dinero-abonos-de-cl_1789415439280.txt:11–50,66–98`: variantes cliente/proveedor, A5 horizontal/dos copias, medición de capacidad, folio, reimpresión y evidencia registrada.
- Política de evidencia recordada y a contrastar con el documento original en implementación: `.agents/memory/receipt-evidence-policy.md`. No es prueba de funcionalidad ni autoriza escrituras. La existencia de aplicaciones guardadas no demuestra que estén conservados remanente y saldo inmediatamente posterior.
- Rutas propuestas: emisión/consulta/reimpresión desde recepción registrada, con permiso y auditoría; estado explícito sin aplicación para retenidos y constancia posterior de aplicación enlazada. No nombrarlas como existentes. Conservar valores originales, sin recalcular FIFO ni cambiar una recepción en otra al reimprimir.

### A6. Capacidad de impresión — E3

- `artifacts/mariana-textil/src/pages/salida-documento.tsx:53–74`: `SALIDA_PRODUCT_ROWS_PER_PAGE = 10`, A5 horizontal y geometría comentada; no son 12 filas de un prompt antiguo.
- `artifacts/mariana-textil/src/pages/entrada-documento.tsx:35–52`: `rowsPerPage = 10`; renglones globales, no capacidad fija de series.
- `artifacts/mariana-textil/src/pages/ticket-detail.tsx:792–818`: `NOTE_PRODUCT_ROWS_PER_PAGE = 8`, A5 vertical. Sección térmica alrededor de 637, sin cuota de filas acreditada.
- `artifacts/api-server/src/lib/pdf.ts:26–48`: `pageSize = 55` para exporte tabular, no para recibo.
- Pruebas de referencia: `pages/impresion.contract.test.ts`, `entrada-documento.contract.test.ts`, `salida-documento.contract.test.ts`; adaptar a comprobaciones semánticas y PDF real, no perpetuar cadenas de código como único criterio.

### A7. Atribución y conflictos documentales — E1, E7

- `reports/prompt-q-diseno-atribucion-sitio.md:57–113`: columnas, cuatro criterios de atribución y corte; 121–158 y siguientes: alternativas de origen/evidencia.
- `replit.md:1345–1349`: causa compartida y regla de cobrar notas propias; P detenido. La decisión U3 sustituye la restricción de recepción por tienda, no FIFO.
- Identidad anterior en `replit.md:98,905`; nombres/fórmulas en 560–574 y apartado «Cobrado: dos definiciones sin reconciliar». La implementación deberá localizar y sustituir todas las reglas incompatibles, no solo la primera coincidencia.
- Para tres históricos: Q 34–55 y `replit.md:1351` documentan el snapshot; no usar como evidencia de recepción física ni de sesión histórica.

### A8. P y alcance financiero — E7

- `reports/financial-read-scope/group-1.md:1–16,142–177`: Grupo 1 parcial, abonos sin ticket omitidos, porciones desde proyección global, pendiente local suprimido, clasificación global indebida y verificación faltante.
- `reports/portfolio-scope/pendientes.md`: inventario vigente de familias/rutas y grupos 2–4; ninguna fila se cierra por este plan.
- `replit.md:1339–1349`: no aprobación/no reanudación vigente.
- Superficies: estado de cuenta JSON/impresión/PDF/XLSX en `routes/clientes.ts`; proveedores y agregados según la matriz de P; `admin-analytics.ts`, `admin-alertas.ts` y pantallas/desgloses relacionados solo cuando pertenezcan a la fila aprobada.
- Mantener la excepción de cuatro cifras globales de cliente, con detalle restringido y leyendas en los archivos; no filtrar la proyección por tienda.
- `reports/prompt-s/inventario.md` conserva otras variantes de predicado. No convertir su revisión en una modificación automática dentro de E7.

### A9. Cuentas Destino, nombres y confirmaciones — E6, E7, E9

- `artifacts/api-server/src/lib/admin-analytics.ts`: `destinationReadModel` desde 131; construcción de `header.cobrado` 1455–1462: `contado`, `abonos`, `saldosFavor`, `total`.
- `artifacts/api-server/src/routes/admin-analytics.ts`: GET `/api/admin/cuentas-destino` y movimientos alrededor de 244–256; XLSX 469–473 y PDF 517; confirmación fiscal 360, distinta de recepción de efectivo.
- `artifacts/mariana-textil/src/pages/caja/cuentas-destino.tsx:365–373`, `hooks/use-shared-cuentas-destino.ts` y tablero Tiempo real: conservar misma fuente/fecha/filtros.
- `artifacts/mariana-textil/src/caja-cobranza.contract.test.ts` y contratos de desgloses/tiempo real: nombres y cierre de cifras deben corresponder a la regla escrita. En E7 extender la fuente por recepción pendiente y netear transiciones sin contar de nuevo la aplicación; nunca sumar `COBRO_PENDIENTE` + su posterior `ABONO` como dos ingresos. Las etiquetas técnicas son propuestas.
- E6 no modifica `destinationReadModel`; E7 sí requiere revisar atribución y los consumidores. No ejecutar ambos como ediciones paralelas del mismo cálculo.

### A10. Consulta real de Inventario — E8

- `artifacts/mariana-textil/src/pages/inventario.tsx:76–105` usa `useGetExistenciasAgrupadas`, no la lista `/rollos` como fuente principal.
- `artifacts/api-server/src/routes/inventario.ts:1882–1980`, GET `/api/inventario/existencias/agrupadas`; SQL 1898–1914 sobre `productos p LEFT JOIN rollos r`. El predicado propuesto es `p.activo = true` en la selección común, conservando búsqueda, alcance e `includeSinExistencia`.
- No existe un total paginado separado en esa respuesta; comprobar grupos devueltos y agregados. La ruta `/rollos` y el detalle por serie son otros consumidores.
- Referencias: `inventory-six-view.integration.test.ts:464–522`, `lib/inventory-status-semantics.test.ts`, `purga-catalogos.contract.test.ts:167–204`. La primera no se ejecutará sin autorización/aislamiento si escribe datos.

### A11. Fuentes del barrido y autorización

| Pendientes | Referencias |
|---|---|
| R1 | `docs/remaining-role-checks.md`, inventario y advertencias; no matriz completa ya aprobada. |
| R2, V2 | `replit.md:476–525,716–718`; `reports/prompt-s/entrega.md:52`; distinguir creación de usuarios de manifiestos que casualmente tienen 28 archivos. |
| R3, V3 | `reports/prompt-l/full-catalog-label-fit.md:18–42`; `replit.md:409` sobre comprobación física de cámara/pistola. |
| R4–R6, R12–R14, V1, V4 | `replit.md:1042–1047,1067–1080`; `reports/credito-saldo-favor/verificacion.md:37–45,79–88`. Son pendientes registrados; no se usó el render antiguo de J para declarar cerrado R6. |
| R7 | `replit.md:781–805`; `reports/activation-programado/verificacion.md`. Diez familias abiertas; ejemplo de activar expresamente sustituido. |
| R8–R11 | `replit.md:42,46,52,302–304`. |
| R15, R20 | `replit.md:1359–1365`; `reports/prompt-s/inventario.md`, `mechanical-and-tests.md` y `entrega.md`. |
| R16 | `replit.md:1043`, distinción de pagos dirigidos/proveedores frente a los flujos de fecha ya corregidos. |
| R17 | `replit.md:1233`, apartado de navegación de referencias: pantallas de ajuste, corte individual y evento de bitácora expresamente pendientes. |
| R18, R19, V5 | `reports/portfolio-scope/pendientes.md`; `reports/financial-read-scope/group-1.md`; `replit.md:1339–1341`. |
| V6, V7 | `replit.md:454–458,885` y límites de verificaciones físicas; «pendiente de costo» no significa por sí mismo función sin construir. |
| R21 | `replit.md:1007`: propuesta de CI/hook no creada; el chequeo raíz de tipos existente no equivale a control obligatorio previo a integración. |
| Autorización original | `replit.md:1011` y reglas contiguas: guardar texto original y alcance antes de primera escritura financiera. Los reportes de agente no reemplazan esa fuente. |

### A12. Fuentes nuevas, Fondo, contadores y proveedor

- **Decisión original adicional:** `attached_assets/Pasted-4-Salidas-extraordinarias-Las-capturan-supervisor-y-caj_1789681528358.txt`: extraordinarias 1; ADMIN 3; aplicación diferida/no reasignación 5–15; entrega pendiente 17; contadores 19–25; Fondo 27–39; proveedor dividido 41–45; requisitos del plan 47–56. Esta fuente sustituye el mecanismo anterior incompatible; no se interpreta la frase final «trece decisiones» como orden de mantener a la vez dos mecanismos opuestos.
- **Roles actuales:** `lib/db/src/schema/enums.ts:10–18` contiene `CONTADOR`, no las dos variantes. `artifacts/api-server/src/routes/users.ts:35–43,82–100` le asigna alcance global y no tienda. Dos roles técnicos separados simplifican reglas negativas; dos perfiles obligatorios y estrictos del rol actual son una alternativa. La migración de cuentas existentes requiere asignación autorizada, no inferencia por nombre/actividad.
- **Datos de clientes:** `artifacts/api-server/src/routes/clientes.ts:99–118`, `presentClienteOperativo`, incluye campos no permitidos por la nueva política; 1776–1832 expone costos/margen/utilidad en estadísticas; 329–356 exporta analítica. Revisar también analítica, notas/reimpresiones, pagos, estado de cuenta y sus documentos. Construir respuestas por campos permitidos para contadores; nunca descargar un DTO completo y solo ocultar columnas.
- **Libro proveedor:** `artifacts/api-server/src/lib/compras-proveedor.ts:1–24,389–505,545–580`: PAGO reduce deuda, FIFO y reversos; `registrarPago` no crea movimientos de caja/Fondo. Reutilizarlo transaccionalmente, no ejecutarlo dos veces para dos fuentes.
- **Rutas proveedor:** `artifacts/api-server/src/routes/proveedores.ts:509–705`: pagos/estado de cuenta y POST `/api/proveedores/:id/pagos`; hoy sin reparto CAJA/FONDO/MIXTO. `artifacts/mariana-textil/src/components/proveedor-pago-dialog.tsx:34–42,102–141,193–203` captura forma, importe y solicitud FIFO/dirigida, no ese desglose.
- **Caja no es Fondo:** `artifacts/api-server/src/routes/pos.ts:924–1095` y `src/lib/pos.ts:1590–1617,2106–2140,2420–2449`; fondo inicial por sesión y salidas de caja. `cuentaOrigen` fiscal/no fiscal/caja no equivale a ubicación de custodia caja del turno/Fondo. No sustituir categorías fiscales por nuevas categorías de tesorería.
- **Rutas nuevas propuestas E10:** `/api/fondo`, `/api/fondo/movimientos`, detalle e inverso de movimiento, `/api/fondo/arqueos` y detalle. Todas requieren ADMIN; la ubicación Mariana se resuelve y valida en servidor. Motivo y trazabilidad de referencias obligatorios. No son endpoints encontrados en el código.
- **Rutas nuevas propuestas E9:** preparación/consulta de entrega por tienda y autorización de recepción que llama al registro de ingreso de Fondo una sola vez. Ruta exacta se define con el procedimiento. Una respuesta para la tienda no puede serializar el movimiento/saldo completo del Fondo; sí debe acreditar el estado autorizado de su propia remesa.
- **Contrato propuesto E12:** un pago y un desglose de importes por origen, con sumatoria en centavos igual al total; referencias al mismo pago en salida de caja y Fondo. Reintentos y aprobaciones deben conservar unicidad y atomicidad entre proveedor/caja/Fondo. No exponer parte Fondo, ni permitir inferirla mediante otras partes del detalle de ContadorF, sin resolver expresamente la pregunta de conciliación.
- **Verificación futura, no ejecutada:** contratos `proveedores-pagos-block5.contract.test.ts`, `pagos-dirigidos*.contract/integration.test.ts`, `caja-diaria-block4.contract.test.ts`; frontend `proveedores-historial.contract.test.ts` y `pages/caja/cortes.contract.test.ts`. Añadir cobertura real de operaciones atómicas, permisos/campos y días distintos. No ejecutar suites que creen usuarios o escriban fuera del entorno autorizado.

## Recomendación final y preguntas que faltan

**Recomendación: empezar por E1 y preparar en paralelo la separación de contadores y la base del Fondo donde no compartan archivos.** E1 habilita siete entregas por cadena. El Fondo se habilita con movimientos **y arqueo**, no meses antes de poder contarlo. Después conectar proveedor mixto y, cuando los socios definan la entrega, E9 como ingreso autorizado al Fondo.

E5 ya no es reasignación: es aplicación diferida, grande pero sin retirar pagos de notas liquidadas. El cobro retenido solo se activa con comprobante, control de espera, aplicación autorizada y reportes conciliados. E6/E8 siguen pudiendo adelantarse. P no se reanuda con esta actualización.

**Preguntas anteriores: estado tras las precisiones de E1 (se conserva la numeración):**

1. **Atribución histórica — facultad resuelta:** ADMIN y SUPERVISOR, con evidencia y motivo obligatorios, mediante hecho aparte inmutable. Sigue pendiente del propietario determinar qué evidencia concreta es suficiente y el sitio real de cada histórico; no se atribuyen en E1.
2. **Ajuste sin origen identificable — resuelto:** se captura con tienda elegida y justificación obligatoria; no se bloquea hasta encontrar la nota ni se inventa una relación documental.
3. **Devoluciones físicas:** ¿se permiten parciales y devoluciones de pagos ya aplicados, además de devolver favor, y quién las autoriza? La salida en caja abierta de hoy ya está decidida.

**Preguntas nuevas y procedimiento aún pendiente:**

4. **Propuesta rechazada:** si ADMIN rechaza el destino preparado, ¿el dinero continúa esperando otra propuesta o puede devolverse al cliente mediante autorización separada? No se aplicará FIFO por el solo hecho de rechazar.
5. **Aplicación por partes:** ¿se puede autorizar una parte del cobro y dejar el resto esperando, o cada autorización debe resolverlo completo? ¿Una propuesta puede abarcar varias notas del mismo cliente?
6. **Remanente:** si la nota se pagó durante la espera o queda un excedente, ¿se prepara otro destino, se autoriza favor disponible o se tramita devolución? No generar favor utilizable antes de esa decisión.
7. **Tiempo de espera:** ¿a partir de cuántas horas o días debe destacarse/avisarse el cobro pendiente y quién debe atenderlo? El monto y la antigüedad se mostrarán siempre, sin esperar a un umbral.
8. **Entrega en Mariana — conversación de socios pendiente:** ¿cómo se entrega y confirma el efectivo de cada tienda: corte completo o remesas parciales, quién documenta el envío y cómo se tratan diferencias/recepciones parciales? El ingreso al Fondo solo al autorizar recepción ya está decidido; falta precisar cuándo y cómo queda registrada la salida de origen sin modificar el corte cerrado.
9. **ContadorF y proveedor — pregunta expresa, sin resolver:** ¿limitar el Fondo a ADMIN impide que ContadorF cuadre los pagos a proveedor al no ver de dónde salió el dinero? ¿Qué evidencia necesita para hacerlo? Ocultar el nombre Fondo no basta si total menos parte caja revela el tramo reservado. No se propone una solución de acceso hasta que el propietario responda.
10. **Contadores existentes:** ¿cómo se asignará ContadorF o ContadorA a las cuentas que actualmente son CONTADOR? No se convertirán automáticamente a quien puede preparar.
11. **Arqueo del Fondo:** ¿con qué frecuencia se cuenta y cómo se trata una diferencia registrada? Recomiendo conteo/diferencia sin ajuste automático; una corrección posterior debe quedar autorizada y trazable.
12. **Disponibilidad de efectivo:** ¿se bloquea un retiro/pago que exceda el saldo registrado de caja o Fondo, o debe existir otro procedimiento de excepción ADMIN? El plan no inventa un saldo disponible ni una excepción silenciosa.
13. **Proveedor solo Fondo:** si el pago no usa nada de caja, ¿puede hacerse sin turno de caja abierto? Si usa caja, esa parte sí requiere sesión abierta.
14. **Corrección de un pago mixto:** cuando se corrige un pago o se recupera dinero, ¿se documenta retorno a cada origen o puede volver a otro? Hay que distinguir corrección de captura de devolución física, sin editar el corte cerrado ni inventar efectivo de regreso.

No se vuelven a preguntar captura de extraordinarias, comprobante opcional, cuentas nombradas, autorización exclusiva de socios ni nota reabierta por reasignación: ya quedaron precisados o retirados. La aprobación del orden sigue sin autorizar escrituras; cada entrega requiere texto original y alcance preciso conforme a la regla vigente.