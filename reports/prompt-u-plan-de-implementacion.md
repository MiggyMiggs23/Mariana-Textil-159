# Prompt U — Plan de implementación de las decisiones de los socios

**17 de septiembre de 2026 · Documento para decidir el orden de trabajo.**

**Esto no es una implementación ni una autorización de escrituras.** Se revisaron código y documentos; no se consultó ni escribió la base, no se ejecutaron pruebas, migraciones o reinicios, y no se modificaron la aplicación, sus contratos ni `replit.md`. T tiene entrega y cierre documentados, incluidas las correcciones posteriores de restitución y activación. Sus diez pendientes adicionales de reversos no se consideran parte reabierta de T. El Grupo 1 de P continúa **sin aprobar ni cerrar**. [A0]

## 1. Resumen para el propietario

La prioridad es poder distinguir tres hechos que hoy se mezclan en algunas consultas:

1. **Dónde se recibió o devolvió dinero.**
2. **Qué notas quedaron pagadas con ese dinero.**
3. **Qué se corrigió en los registros sin mover dinero físicamente.**

Guardar la tienda no basta: también hay que relacionar el efectivo real con su caja, conservar evidencia del reparto y distinguir los movimientos físicos de las correcciones. Esa base desbloquea **seis de las otras ocho entregas propuestas**, aunque cada una conserve sus autorizaciones y comprobaciones.

Hay infraestructura que se puede aprovechar: captura de abonos, vista previa FIFO, solicitudes de pago dirigido, salidas de dinero y cortes. **No hay una reasignación de un pago ya recibido ni un recibo de dinero implementados.** Tampoco existe el control completo de aceptar o reclamar una salida de dinero extraordinaria.

Recomiendo nueve entregas. El renombre de cifras y el filtro de productos activos pueden adelantarse sin esperar al trabajo financiero de fondo. No recomiendo mezclar la reasignación con la corrección del corte: afectan reglas distintas y un fallo en la primera puede volver a abrir una nota entregada como pagada.

### Las trece decisiones son firmes

No se someten de nuevo a votación. La siguiente tabla muestra dónde se atienden; los números E identifican entregas, no tareas iniciadas.

| Decisión | Resultado que se debe conservar | Entrega |
|---|---|---|
| 1 | Sitio guardado explícitamente en cada movimiento nuevo; sesión para el efectivo físico. No inferir después el sitio desde la nota. | E1, E2 |
| 2 | Anticipos y saldo a favor sin nota, con sitio de recepción y recibo impreso. | E1, E3 |
| 3 | FIFO global de la empresa; solo una instrucción dirigida autorizada es excepción. | E1, E3, E5, E7 |
| 4 | El ajuste sin nota se atribuye a la tienda de la nota que lo originó, con evidencia de esa relación. | E1 |
| 5 | Ingreso/devolución física y corrección contable se distinguen obligatoriamente. | E1, E2, E7 |
| 6 | La devolución física sale de la caja abierta de hoy; no modifica el corte de recepción original. | E2 |
| 7 | Los tres movimientos señalados quedan «Sin sitio determinado», con atribución posterior posible y trazable. | E1, E7 |
| 8 | Global conserva esa categoría; la tienda muestra aplicaciones comprobables a sus notas, no cobros supuestamente recibidos allí. | E7 |
| 9 | Se prepara este plan antes de reanudar P. | Esta entrega; E7 es trabajo futuro |
| 10 | Proveedores: pago exclusivo de Mariana. Extraordinarias: las tres tiendas registran la salida, con motivo y revisión ADMIN. | E4 |
| 11 | Solo propietario o socio autorizan la excepción; si no están, se cobra con FIFO y después se autoriza una reasignación. | E3, E5 |
| 12 | Cuentas Destino distingue Contado cobrado y Cobranza del periodo. Identidad: **Ventas = Contado + Ventas a crédito**. | E6 |
| 13 | La consulta principal de Inventario filtra productos activos. | E8 |

**Invariantes:** no cambiar la regla FIFO, la deuda global del cliente, el tratamiento del saldo a favor ni la validación global del límite de crédito; no modificar los candados de inventario por producto y ubicación; ninguna tabla operativa usa DELETE. Un pago o una devolución real cambia legítimamente el saldo; lo prohibido es cambiarlo artificialmente por atribuir una tienda, renombrar una tarjeta o reasignar el mismo pago. Tampoco se cambia la regla exclusiva de Mariana para proveedores.

## 2. Lo que se comprobó antes de proponer el plan

### 2.1 ¿Ya se puede reasignar un pago aplicado?

**No como una operación propia.** El camino actual es revertir el abono completo y capturarlo otra vez; dirigir el nuevo pago exige el flujo de autorización correspondiente. No existe una acción para trasladar solamente parte o todo el reparto de un pago ya registrado. Las aplicaciones anteriores no se editan ni borran.

El flujo dirigido actual tiene otra limitación: un ADMIN puede crear y aplicar inmediatamente; una solicitud de otro usuario queda pendiente **sin registrar todavía el abono**. Eso no satisface la decisión de recibir el dinero sin esperar a los socios. Solicitar, cobrar, autorizar y reasignar deben dejar de confundirse.

La reasignación nueva es, por tanto, **grande**, no un botón para cambiar la nota de una fila. Debe conservar el pago, su fecha, tienda, cuenta y recibo, y cambiar únicamente su reparto mediante una excepción autorizada y trazable. El reparto histórico guardado no sustituye al cálculo global FIFO. [A1–A3]

### 2.2 ¿Qué ocurre con una nota entregada como pagada?

Con el reverso actual, al volver a consultar se recalculan su pendiente y estado; también cambian los estados de cuenta y las nuevas exportaciones. Una reasignación correctamente construida tendrá que reflejar la reapertura del mismo modo.

**Eso no avisa por sí solo al cliente ni corrige el papel que ya tiene.** En las rutas revisadas no se encontró aviso específico de reapertura; sí existen avisos de resolución de solicitudes dirigidas, que son otra cosa. Además, el alcance por tienda de ciertos estados de cuenta sigue incompleto por P: no puede prometerse que hoy todas las vistas lo expliquen correctamente.

E5 debe mostrar antes de autorizar qué nota vuelve a tener deuda, cuánto, su vencimiento y la afectación a vencidos; conservar antes/después; y ofrecer una constancia de reasignación. Falta decidir quién comunica la corrección al cliente y cómo deja evidencia. No se cambia la fecha original de vencimiento para ocultar que volvió a quedar pendiente. [A1–A3, A8]

### 2.3 ¿Ya existe salida extraordinaria de dinero?

**Existe una salida de dinero genérica**, con monto, motivo, sesión de caja, cuenta de origen y proveedor opcional. Por ello no hace falta inventar desde cero el registro de un egreso sin proveedor.

Pero el servidor bloquea actualmente **toda** esa salida fuera de Mariana. Además, no se encontró el ciclo específico de ADMIN que acepta o reclama y del supervisor que responde. El corte ya descuenta las salidas registradas de la sesión; no distingue todavía ese nuevo control administrativo.

E4 debe separar explícitamente pago a proveedor y salida extraordinaria. **Proveedor vacío no será una excusa para evadir el candado de proveedores.** La salida reduce el efectivo esperado desde que se registra, aunque ADMIN aún no la haya revisado: esperar su aceptación reproduciría el corte inexplicable que motivó la decisión. Reclamar no borra el gasto ni devuelve dinero ficticiamente.

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

## 3. Conflictos con reglas vigentes

Se dejan señalados, **sin corregir `replit.md` en U**. Las trece decisiones ya resuelven la dirección de estos cambios; falta implementarlas y sustituir las reglas viejas en la entrega correspondiente.

| Regla o comportamiento vigente | Decisión posterior / tratamiento futuro |
|---|---|
| «Cada tienda debe recibir el abono de sus propias notas», aunque el cálculo de crédito es global. | Decisión 3 permite FIFO entre tiendas. La tienda de recepción no será una condición para bloquear un cobro ni para cambiar el FIFO. Cita documental exacta en A7. |
| Ventas = Contado cobrado + Ventas a crédito; otras secciones mantienen el encabezado Cobrado y la decisión de nombres como pendiente. | Decisión 12 exige **Ventas = Contado + Ventas a crédito**. E6 retirará todas las redacciones sustituidas, no agregará una nota contradictoria al final. |
| Toda salida de dinero por el registro actual se limita a Mariana. | Decisión 10 conserva el candado únicamente para proveedores y permite extraordinarias en las tres tiendas. |
| Cualquier ADMIN puede autoaplicar y aprobar un pago dirigido; una solicitud ordinaria espera sin cobrar. | Decisión 11 limita autorización a las cuentas del propietario y socio, sin extenderla a otros ADMIN; la espera no detiene el cobro FIFO. |
| La atribución de cobros se obtiene en varias consultas desde las notas o aplicaciones. | Decisiones 1, 7 y 8 separan recepción y aplicación; para nuevos movimientos se conserva el origen explícito y para los tres históricos no se inventa. |
| La protección actual impide editar un movimiento para completar su sitio. | La atribución posterior requiere una vía nueva compatible con esa protección; no quitarla por conveniencia. |

No se considera conflicto de U el permiso ADMIN de baja extraordinaria **de inventario**. Tampoco se propone que cualquier ADMIN autorice dirigidos por tener facultad de revisar gastos: son facultades distintas.

## 4. Entregas propuestas

**Cómo leerlas:** «global» se refiere al usuario que ve toda la empresa. Las diferencias monetarias deberán desglosarse por documento y fuente antes de liberar cada cambio; este plan no inventa montos actuales. Los archivos, rutas, contratos y pruebas concretos están exclusivamente en el anexo técnico, asociados al mismo número E.

### E1 — Origen del dinero y evidencia de crédito

**Tamaño: grande. Decisiones: 1, 4, 5, 7; base de 2, 3, 6 y 8.**

- **Construye:** origen explícito de todos los nuevos movimientos de crédito, relación a sesión cuando hay efectivo real y distinción obligatoria de ingreso, devolución y corrección contable. Incluye ventas a crédito, abonos ordinarios y dirigidos, reversos y ajustes; no solo el formulario de abono. El ajuste sin nota necesita una referencia comprobable a la nota que lo originó. Conserva identificador de la operación para evitar un cobro duplicado.
- **Históricos:** deja los tres indeterminados y prepara atribución posterior con evidencia. No adivina sitio por usuario, banco, fecha o nota. Conserva la identidad y fecha del movimiento al relacionar evidencia antigua, porque un ID por sí solo puede haberse reutilizado tras una purga.
- **Dependencias:** ninguna entrega de U; requiere resolver las preguntas 1 y 2 del cierre y autorización de escrituras. **La esperan directamente E2 e, indirectamente, E3, E4, E5, E7 y E9.**
- **Qué toca:** registro de crédito, captura actual del cliente y productores automáticos; comprobaciones de origen, permisos, auditoría, consultas de evidencia y futura atribución. Detalle técnico E1/A1/A7.
- **Qué puede desalinearse:** aplicaciones móviles/web con cargas antiguas, aprobación de dirigidos, autorización de notas, reversos, ajustes, estado de cuenta y consultas que todavía deducen sitio. La estructura nueva no se libera con productores viejos que omitan sus datos obligatorios.
- **Cifras globales:** agregar evidencia o asignar una tienda no cambia deuda, saldo a favor, Ventas o cobranza total. Cambian únicamente los repartos por sitio y el subtotal «Sin sitio determinado» al atribuir un histórico. Si aparece otra diferencia, se explica por separado; no se corrige bajo el nombre de migración.
- **Verificación:** cada productor guarda origen válido; efectivo y corrección no se confunden; mismos registros monetarios antes/después; históricos intactos; permisos negativos; reintento sin duplicación; atribución tardía sin edición ni sesión inventada. **Propietario:** determina qué evidencia histórica es suficiente y reconoce la tienda donde realmente se recibió, algo que el programa no puede comprobar por una nota.
- **Salida segura:** es una base técnica, no un piloto financiero por sí sola. Coordinar la activación de nuevas capturas con E2 y E3 para no aceptar efectivo que el corte o el recibo aún no puedan explicar.

### E2 — Corte confiable y devolución física en la caja de hoy

**Tamaño: grande. Decisiones: 1, 5, 6; habilita la captura de 2.**

- **Construye:** incorporación de abonos físicos en efectivo a su sesión, caja abierta exigida para efectivo y no para transferencia. La devolución física requiere la caja abierta de hoy, motivo, fuente y evidencia; no cambia el corte de recepción original. Las correcciones contables quedan separadas de los movimientos del cajón.
- **Dependencias:** E1 y decisión sobre alcance de devoluciones, pregunta 3. **La esperan E3 y E4; también la recepción final E9.**
- **Qué toca:** apertura/cierre y lectura del corte, historial, detalle e impresión de corte; validación transaccional de entrada/salida real y su vínculo al crédito. Detalle E2/A4.
- **Fórmula a verificar:** fondo inicial + cobros físicos de tickets en efectivo + abonos físicos en efectivo − salidas físicas de la sesión. Una devolución ya incluida en salidas **no se resta dos veces**. Transferencias, uso posterior del saldo a favor y reasignaciones no son entradas al cajón.
- **Qué puede desalinearse:** efectivo esperado, diferencia contra contado, desglose por medio/cuenta, reportes diarios y cortes impresos; cierre concurrente con abono/devolución. No sumar un pago a través de cada nota que liquidó.
- **Cifras globales:** para un periodo con abonos de efectivo, aumentan el **efectivo esperado de las sesiones** y disminuye la diferencia inexplicada correspondiente; una devolución nueva reduce el efectivo de hoy. No aumenta de nuevo **Ventas**, **Contado cobrado** ni **Cobranza del periodo** por incorporar al corte un abono ya registrado.
- **Verificación:** dos cajas/sitios, efectivo contra transferencia, caja cerrada, cierre simultáneo, devolución hoy de pago anterior, corrección sin dinero y operación repetida. Comparación de corte, historial y papel con desglose trazable. **Propietario:** conteo físico y comprobante de devolución; confirmar que el dinero realmente salió y que el corte antiguo permanece igual.

### E3 — Registrar abono desde Caja, anticipos y recibo

**Tamaño: grande. Decisiones: 2, 3; primera parte de 11.**

- **Construye:** entrada desde Caja reutilizando la captura del cliente, no un segundo motor de cobro. FIFO por defecto; vista previa obligatoria con notas, importes, remanente y saldo a favor. Permite anticipo sin nota. Al confirmar vuelve a validar saldos y caja, evita doble envío y conserva evidencia suficiente para emitir el recibo.
- **Recibo:** A5 horizontal y dos copias según especificación previa; folio propio y acceso posterior desde el historial. Conserva importes y reparto tal como se registraron, no los recalcula al reimprimir. Sin notas, imprime que es anticipo/saldo a favor, sin inventar aplicaciones. Fallar la impresora no vuelve a cobrar: se conserva el movimiento y se puede reimprimir.
- **Dependencias:** E2, que incluye E1. **La espera E5.**
- **Qué toca:** Caja, diálogo de pago del cliente, historial/detalle, nueva vista imprimible y evidencia de emisión/reimpresión; detalle E3/A5/A6. La variante del recibo de proveedores se deja fuera de esta entrega, salvo ampliación expresa.
- **Qué puede desalinearse:** respuesta de vista previa y confirmación, historial de pagos, permisos actuales de clientes frente al acceso desde Caja, copias y reimpresiones. No ampliar todos los permisos financieros de Caja solo para añadir este acceso.
- **Cifras globales:** el cobro real reduce deuda o aumenta saldo a favor, según el mismo cálculo actual; el importe recibido entra una sola vez a cobranza. Imprimir, reimprimir y posteriormente usar el saldo a favor no generan otro ingreso.
- **Verificación:** pago a tres notas de distintas tiendas, anticipo puro, exceso, nota pagada entre vista previa y confirmación, doble clic/reintento, impresión y reimpresión con evidencia íntegra. Recibos históricos insuficientes se explican y no se reconstruyen con saldos actuales. **Propietario:** dos copias legibles, firmas, corte de papel, márgenes y lectura de datos largos en la impresora real.
- **Límite:** antes de E5 ya puede cobrarse normalmente con FIFO, pero no se afirma construida la reasignación posterior ni cerrada toda la decisión 11.

### E4 — Salidas de dinero extraordinarias y revisión ADMIN

**Tamaño: mediana. Decisión: 10.**

- **Construye:** clasificación explícita de proveedor frente a extraordinaria. Mantiene proveedor exclusivo de Mariana; las tres tiendas pueden registrar extraordinaria con motivo obligatorio y sesión/cuenta correctas. Se muestra el mismo día, con estado pendiente de revisión, aceptación o reclamo; el supervisor aporta la respuesta/evidencia definida.
- **Dependencias:** E2. **La esperan E7 y, por esa vía, E9.** Puede ir antes o después de E3; el orden sugerido pone primero el recibo.
- **Qué toca:** salida de dinero existente, corte y reporte diario, bandeja o detalle de revisión y permisos de captura/revisión; detalle E4/A4. No toca las bajas o salidas extraordinarias de rollos.
- **Qué puede desalinearse:** el candado de Mariana, listados por sesión, saldo por cuenta, reporte de gastos y auditoría. Aceptar/reclamar no duplica el egreso ni recalcula un corte cerrado como si no hubiera sucedido.
- **Cifras globales:** una nueva salida física disminuye efectivo esperado/disponible y aumenta **salidas de dinero del día**. La mera aceptación o reclamación no cambia importes. No es pago a proveedor ni movimiento del saldo del cliente.
- **Verificación:** extraordinaria permitida en Coco/Cruces/Mariana; proveedor rechazado fuera de Mariana; motivo ausente; sesión cerrada; control de alcance; ADMIN acepta/reclama, supervisor responde sin autoaceptarse; doble registro/revisión. **Propietario:** comprobar clasificación de gastos y proceso de reclamo, y que el dinero ya descontó del corte aun pendiente de aceptación. Pregunta 4.

### E5 — Autorización de los socios y reasignación sin otro cobro

**Tamaño: grande. Decisión: 11; preserva 3.**

- **Construye:** autoridad limitada a las dos cuentas del propietario y socio, tanto en autoaplicación como en aprobación. SUPERVISOR puede gestionar lo que permitan sus permisos, pero no autorizar; otros ADMIN tampoco obtienen esta facultad por su rol.
- **Cobro sin espera:** si no hay autorización disponible, se registra el dinero con FIFO y se liga la solicitud al pago existente. Resolverla después cambia solo su reparto, no registra otro abono. La vista previa muestra qué nota se reabre y qué otra se paga; la autorización valida nuevamente disponibilidad y conserva antes/después.
- **Dependencias:** E3; preguntas 5–7 y decisión sobre el pendiente de capacidad/evidencia histórica. **La espera E7.** No basta añadir una pantalla al aprobador actual.
- **Qué toca:** solicitud, aprobación y rechazo, evidencia de reasignaciones, lectura de excepciones autorizadas dentro de la proyección, estado de cuenta y constancias; detalle E5/A2/A3. La regla de orden FIFO ordinaria permanece intacta, aunque deba ampliarse cómo se lee una excepción autorizada.
- **Alternativas viables:** (A) constancia nueva de reasignación, inmutable y vinculada al pago; (B) instrucciones dirigidas versionadas, conservando todas sus versiones y aplicando una sola versión vigente. Recomiendo A por separar con claridad el cobro ya sucedido de su autorización posterior. No editar aplicaciones antiguas ni simular una nueva entrada/salida de dinero.
- **Qué puede desalinearse:** capacidad de la fuente, reparto histórico, pendiente/estado/vencidos de notas, avisos y estados de cuenta. Los pendientes de aplicaciones tras cancelar una venta y del ajuste negativo sin evidencia equivalente **no quedan resueltos automáticamente** por esta decisión.
- **Cifras globales:** una reasignación pura conserva **deuda global, saldo a favor global, Ventas, Contado cobrado y Cobranza del periodo**. Sí puede cambiar **saldo de cada nota, deuda vencida, cantidad de notas vencidas y antigüedad**, además del reparto de aplicaciones por tienda. No cambia la tienda que recibió el dinero.
- **Verificación:** cobro inmediato cuando no están los socios; autorización denegada a SUPERVISOR y a otro ADMIN; movimiento original intacto; reasignación parcial/total según alcance aprobado; repetición/concurrencia; nota antes pagada que se reabre; fuente revertida o ya utilizada; estado de cuenta y constancia coherentes. **Propietario:** reconocer las dos cuentas autorizadas y decidir cómo se informa al cliente que su papel de «pagada» ya no describe el pendiente actual.
- **Límite de cierre:** si se aprueba empezar solo con pagos de evidencia íntegra y sin los conflictos históricos, se declara una entrega parcial, con causas de bloqueo y vía de revisión. No declarar resuelta universalmente la decisión 11 mientras esos casos sigan impedidos.

### E6 — Nombres de cobranza e identidad de ventas

**Tamaño: chica. Decisión: 12.**

- **Construye:** Cuentas Destino y sus documentos distinguen **Contado cobrado** de **Cobranza del periodo**. Sustituye las identidades anteriores en la documentación canónica por **Ventas = Contado + Ventas a crédito**.
- **La cobranza del periodo incluye contado:** Contado + Abonos a notas + Saldos a favor recibidos, con sus reversos neteados según la fuente vigente. No quitar el contado del total ni presentar solo abonos bajo el nuevo nombre.
- **Dependencias:** ninguna entrega financiera de U. **La espera E7** para conciliar con nombres inequívocos. Puede adelantarse.
- **Qué toca:** encabezados, desgloses, exportaciones y contratos de presentación de Cuentas Destino/Tiempo real, más sustitución de reglas anteriores; detalle E6/A9.
- **Qué puede desalinearse:** títulos de PDF/XLSX, denominadores de porcentajes, pruebas de nombres y asociación entre tarjeta y detalle. No renombrar claves técnicas indiscriminadamente ni aprovechar para alterar consultas.
- **Cifras globales:** **ninguna cambia de valor por E6**. Exigir igualdad al centavo antes/después para cada componente y total. La atribución por sitio se corrige en E7, no a escondidas en un renombre.
- **Verificación:** mismos valores y filtros, etiquetas consistentes en pantalla/archivos, textos legibles a 402 px; la identidad escrita anterior desaparece donde fue sustituida. **Propietario:** confirma comprensión del vocabulario y de los documentos impresos. El título específico «Cobros de periodos anteriores» se conserva como pendiente separado del apartado 6; no se da por autorizado todo cambio de redacción del sistema.

### E7 — Atribución en consultas y reanudación ordenada de P

**Tamaño: grande. Decisiones: 7, 8, 9; consume 1, 3, 5, 11 y 12.**

- **Construye:** lectura coherente de recepción de dinero, aplicación a notas y corrección contable en Cuentas Destino, Tiempo real y estados de cuenta. Global muestra «Sin sitio determinado»; una tienda recibe solamente sus aplicaciones comprobables, rotuladas como aplicaciones, no como cobros recibidos allí.
- **Dependencias:** E4, E5 y E6; incluye las bases anteriores. Esta es una propuesta de secuencia conservadora, no una autorización para reanudar P hoy. **La espera E9.**
- **Qué toca:** consultas compartidas, desglose, cartera, estado de cuenta y exportaciones; retoma primero el Grupo 1 de P con su clasificación ya acordada. Detalle E7/A8/A9.
- **Qué puede desalinearse:** abonos ordinarios sin nota desaparecidos de archivos por tienda, reversos, saldo pendiente de notas permitidas, clasificación global indebida, páginas de movimientos, XLSX/PDF/impresión y permisos. No volver a calcular FIFO por tienda ni sustituirlo por la suma de aplicaciones históricas.
- **Cifras globales:** atribuir sitio no debe cambiar **deuda global, saldo a favor, límite disponible, Ventas o cobranza total**. Sí cambian **cobranza recibida por tienda, aplicaciones a notas de cada tienda y Sin sitio determinado**. Separar corrección contable de dinero físico cambia las columnas/composición del reporte: presentar un puente antes/después por fuente y periodo. Cualquier diferencia adicional del total global debe explicarse y autorizarse como cambio de consulta, no suponerse consecuencia del nombre o del sitio.
- **Histórico:** mantener los tres movimientos indeterminados. No presentar las recapturas históricas como nuevo ingreso físico comprobado. Los $25,000 por sitio frente a $0 neto global son un hallazgo histórico de atribución, no una medición nueva ni dinero encontrado en el cajón.
- **Verificación:** lectura global idéntica cuando solo cambia alcance; cuatro cifras globales de crédito conservadas; detalle restringido y leyendas dentro de los archivos; cliente con notas en varias tiendas, pago repartido, favor, reverso y movimiento indeterminado. Cada tarjeta concilia con su detalle y sus exportaciones. **Propietario:** verifica que las leyendas no hagan creer a una tienda que recibió dinero que solo se aplicó a sus notas.
- **P no se cierra en bloque:** primero subsanar y acreditar Grupo 1; luego proponer la ejecución de grupos 2–4 según su inventario vigente. Una comparación de archivos con datos simulados no sustituye la comprobación autenticada autorizada. No inventar como ya construido el tablero de Clientes.

### E8 — Inventario: consulta de productos activos

**Tamaño: chica. Decisión: 13.**

- **Construye:** filtro de producto activo en la consulta agrupada que usa la pantalla principal, con y sin existencia y también en búsqueda. No es un cambio del estado de los rollos.
- **Dependencias:** ninguna entrega de U; se puede adelantar. **No bloquea entregas financieras.**
- **Qué toca:** consulta agrupada y sus pruebas, comprobación de la pantalla de Inventario; detalle E8/A10. No añade otra opción para volver a mostrar inactivos en esa consulta.
- **Qué puede desalinearse:** número de grupos/filas y cantidades visibles, búsquedas y pruebas de inclusión de productos inactivos. No extender silenciosamente el filtro al kardex, detalle por serie, auditorías, reconstrucción de existencias o reportes históricos. No confundir producto activo con sitio o piso activo.
- **Cifras globales:** pueden disminuir los **productos/grupos y existencias visibles en esa consulta**, por excluir productos inactivos; los movimientos y cantidades almacenadas no se alteran. No cambia una cifra financiera ni se recalcula inventario.
- **Verificación:** producto activo/inactivo, con cero/con existencia, búsqueda y cada sitio autorizado; un detalle histórico sigue legible y los datos originales quedan intactos. **Propietario:** comprueba que desactivar un producto significa que ya no desea verlo en la consulta operativa, sin perder su historial.

### E9 — Recepción de efectivo en Mariana y confirmación de cuentas

**Tamaño: grande, pendiente de precisar operación. Tema expresamente pospuesto por el propietario.**

- **Construye, sujeto a precisar el alcance:** recepción comprobable de efectivo en Mariana y confirmación contra su evidencia de origen. Para dimensionar esta propuesta se contempla entrega interna contra cortes; falta confirmar si abarca dinero de otras tiendas, de la propia caja o ambos. Debe distinguir un traspaso interno de un ingreso de cliente. No es recepción de mercancía ni confirmación fiscal de ventas.
- **Dependencias:** E7 en el orden recomendado, que deja disponibles corte confiable, extraordinarias revisables y consultas conciliadas. Pregunta 8 antes de empezar. No anticipar esta entrega porque el botón parezca sencillo.
- **Qué toca:** nuevo registro de entrega/recepción y evidencia, sesión/corte donde corresponda, conciliación de cuentas y pendientes por sitio; detalle E9/A4/A9. Reutilizar la visualización existente cuando corresponda, no hacer pasar una confirmación fiscal por una recepción de efectivo.
- **Alternativas:** entrega por corte completo, o remesas parciales vinculadas al mismo corte. Ambas requieren evitar doble recepción; cambian la complejidad y deben decidirse con la operación real.
- **Qué puede desalinearse:** efectivo en origen, efectivo en tránsito y recibido, diferencias, cuentas por confirmar y reportes entre tiendas. No registrar otro abono al cliente ni un ingreso nuevo a cobranza por recibir en Mariana el mismo dinero.
- **Cifras globales:** cambian saldos/localización del efectivo y pendientes de entrega/confirmación; **el dinero total de la empresa no aumenta por el traslado interno**. Faltantes o diferencias se exponen, no se compensan automáticamente.
- **Verificación:** recepción única, parcial si se autoriza, rechazo/diferencia, entrega de periodo anterior, trazabilidad a corte, recepción repetida y conciliación origen/destino. **Propietario:** entrega física, conteo en Mariana, responsabilidades y evidencia firmada; ninguna prueba automática certifica que el sobre contenía el dinero indicado.

## 5. Orden, dependencias y qué se puede juntar

### 5.1 Orden recomendado

**E1 → E2 → E3 → E5 → E7 → E9**, con **E4 después de E2 y antes de E7**. E6 y E8 pueden adelantarse. En calendario lineal: **E1, E2, E3, E4, E5, E7, E9**, ejecutando E6/E8 en los espacios independientes.

Las razones no son el tamaño: el corte necesita origen/sesión; cobrar requiere un corte capaz de reconocer el efectivo y evidencia imprimible; reasignar necesita un pago ya conservado; las consultas finales deben conocer tanto la recepción como las excepciones; recibir efectivo en Mariana necesita cortes y cuentas confiables.

| Entrega | Predecesoras directas propuestas | Desbloquea directamente | Desbloquea por cadena, sin contarse a sí misma |
|---|---|---|---:|
| E1 | — | E2 | **6:** E2, E3, E4, E5, E7, E9 |
| E2 | E1 | E3, E4 | **5:** E3, E4, E5, E7, E9 |
| E3 | E2 | E5 | **3:** E5, E7, E9 |
| E4 | E2 | E7 | **2:** E7, E9 |
| E5 | E3 + decisión de capacidad/evidencia | E7 | **2:** E7, E9 |
| E6 | — | E7 | **2:** E7, E9 |
| E7 | E4, E5, E6 | E9 | **1:** E9 |
| E8 | — | — | **0** |
| E9 | E7 | — | **0** |

Son dependencias de la propuesta, no promesa de desbloqueo automático: faltan autorizaciones y respuestas. Si se desea reanudar antes el Grupo 1 de P, la alternativa es hacerlo tras E1–E3 y E6, reservando explícitamente la conciliación de reasignaciones/extraordinarias. Reduce espera, pero obliga a revisar de nuevo los mismos consumidores después de E4/E5; **no autoriza cerrar P con esa cobertura incompleta**. Por eso recomiendo una sola integración final.

### 5.2 Combinaciones recomendadas y separaciones

- **Juntar en E1** origen, naturaleza física/contable y evidencia histórica: los tres definen qué significa un movimiento. Añadir solo una columna dejaría abierta la causa del corte.
- **Juntar en E2** abonos en corte y devolución en la caja de hoy: comparten sesión, efectivo esperado y conservación del corte anterior.
- **Juntar en E3** botón, vista previa, anticipo y recibo: son la misma recepción de dinero. El recibo debe contar con evidencia desde la primera operación, no reconstruirla después.
- **Juntar en E4** permitir extraordinarias y su revisión: habilitar únicamente el egreso deja sin construir el control que pidió el propietario.
- **Juntar en E6** renombre en pantalla/archivos y sustitución de la identidad: no dejar tres vocabularios vigentes.
- **Separar E5 de E2/E4:** reasigna deuda entre notas; el otro trabajo cuenta dinero físico. No son el mismo motor, aunque ambos estén en Caja.
- **Separar E8 de todo lo financiero:** filtra una consulta operativa; no necesita modificaciones de crédito ni corte.
- **Separar E9:** transportar/recibir dinero entre sitios no equivale a cobrar otra vez ni a aprobar un gasto.
- E6 y E8 podrían publicarse en un mismo paquete de cambios pequeños, pero deben conservar verificaciones y aceptación separadas: no comparten naturaleza ni riesgo.

### 5.3 Paralelo sin editar los mismos archivos

- **E8 contra E1:** consulta y pruebas de inventario frente a esquema/rutas de crédito; sin cambios de contratos para E8, pues la forma de respuesta no cambia.
- **E6, limitado a presentación existente, contra E1:** etiquetas/exportaciones de Cuentas Destino frente al registro de crédito. E6 no renombra claves del contrato ni toca la consulta de atribución. La edición de documentación canónica se integra por una sola persona, no desde ambas entregas simultáneamente.
- **E3 contra E4, después de E2:** se pueden preparar componentes de recibo/historial y revisión de salidas en archivos propios. No prometer paralelismo integral: ambos pueden requerir contratos, rutas de Caja y menú compartidos. Esas modificaciones se integran en orden.
- **No paralelizar sin coordinación** los cambios de E1/E5 sobre crédito, E2/E4 sobre corte, ni E7/E9 sobre cuentas/conciliación.
- Contrato API único, código generado, documentación canónica y archivos de navegación compartidos tienen **un solo escritor por tanda**. La tabla técnica especifica esos cruces; no se considera independiente una entrega solo porque su pantalla tenga otro nombre.

### 5.4 Autorización textual y escrituras

La regla vigente exige guardar en `reports/` **la autorización textual original del propietario y su alcance exacto antes de la primera escritura financiera**. Un plan, un resumen del agente o una autorización de otra operación no bastan. [A11]

- **E1:** columnas/tablas/validaciones, eventual atribución histórica y cualquier transformación de datos. No desactivar triggers ni autorizar un backfill implícito.
- **E2–E5:** pruebas y operaciones que registren pagos, devoluciones, gastos, revisiones, autorizaciones, reasignaciones o folios/evidencia de recibo.
- **E7:** puede desarrollarse con lectura y datos simulados; si su aceptación requiere preparar datos o escribir movimientos, necesita autorización aparte, sin aprovechar una lectura como permiso de escritura.
- **E9:** entregas/recepciones y confirmaciones de dinero requieren autorización y alcance propios.
- **E6 y E8:** se proponen sin escrituras de negocio ni migración. Si se modifica ese alcance o se preparan datos, se detiene y se solicita autorización.
- Una prueba autenticada necesita la solución de entorno y actores permitidos. Las 28 suites que crean usuarios no quedan autorizadas por aprobar U. No usar development como base de ensayo ni limpiar operaciones con DELETE.

Cada entrega debe conservar comparación con su línea base, resultados completos y negativos semánticos de las pruebas nuevas/rehechas en copias aisladas. No cambiar expectativas para obtener verde. Las pruebas automatizadas de interfaz autorizadas las ejecuta el implementador; al propietario solo se le asignan decisiones de negocio y comprobaciones físicas que el entorno no puede demostrar.

## 6. Lo que U no resuelve

Barrido de documentación: antes de crear este plan se localizaron **168 archivos Markdown en `reports/`**, de los cuales **93** contienen términos de pendiente/no cierre, además de las reglas de `replit.md`. Son documentos candidatos, **no 93 pendientes independientes**. Se cruzaron los inventarios y cierres posteriores; «pendiente» también describe estados normales del negocio y no demuestra una función sin construir. No se ejecutó una auditoría nueva de datos o seguridad.

### 6.1 Pendientes de desarrollo, decisión o revisión no cubiertos

| ID | Pendiente conservado | Qué falta / relación con U |
|---|---|---|
| R1 | **69 vetos de acción por rol** | Revisar cada restricción y decidir cuáles permanecen. E4/E5 solo cambian las facultades expresamente autorizadas, no resuelven todo el inventario. |
| R2 | **28 suites que crean usuarios** | Clasificar y adaptar al entorno/actores autorizados; no ejecutarlas ni crear usuarios para hacerlas pasar. No confundir con el manifiesto de 28 archivos de otro reporte. |
| R3 | **Etiqueta con nombres largos y color** | Rediseño y aceptación física pendientes. El reporte documenta un desbordamiento preexistente en 1 de 1,234 etiquetas; no atribuirlo a los ocho dígitos ni afirmar que todo color se pierde. |
| R4 | **Aplicaciones históricas que ocupan capacidad tras revertirse la venta** | La evidencia histórica y la disponibilidad actual no coinciden necesariamente. E5 necesita una decisión de alcance; U no autoriza reparar históricos automáticamente. |
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
| R16 | **Fechas en solicitudes dirigidas y proveedores** | Permanecen caminos con fecha sin hora o sin zona horaria/validación equivalente. La parte cliente que use E5 deberá delimitarse; U no cierra por extensión todo el flujo de proveedores. |
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

**No se cuentan dos veces:** atribución, corte, recibo, extraordinarias, reasignación, renombre, filtro activo y recepción en Mariana están en E1–E9. Los problemas de Grupo 1 pertenecen a E7, aunque su estado actual continúe abierto.

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
| E5 | `artifacts/api-server/src/routes/pagos-dirigidos.ts`, `src/lib/credit-aging-read-model.ts`, `src/lib/credit-allocation.ts`, esquema de solicitudes/evidencia; `artifacts/mariana-textil/src/components/solicitud-pago-dirigido-dialog.tsx`, solicitudes/notificaciones y detalle del pago. Ruta nueva propuesta de reasignación sobre pago existente y contrato de antes/después. |
| E6 | `artifacts/mariana-textil/src/pages/caja/cuentas-destino.tsx`, consumidores de Tiempo real y pruebas de rótulos; exportadores en `artifacts/api-server/src/routes/admin-analytics.ts`; `replit.md` **solo en la futura implementación**. No modificar el cálculo para renombrar. |
| E7 | `artifacts/api-server/src/routes/clientes.ts`, `src/lib/admin-analytics.ts` y lectores compartidos de cartera/alcance; pantallas de cliente, Cuentas Destino y desgloses; contratos y pruebas por grupo de P. Los demás handlers se seleccionan del inventario de P, no se autorizan por proximidad. |
| E8 | `artifacts/api-server/src/routes/inventario.ts`, pruebas de la consulta agrupada y `artifacts/mariana-textil/src/pages/inventario.tsx` como consumidor a verificar. Sin cambio de forma de respuesta ni de motores. |
| E9 | Tras precisar operación: módulos nuevos propuestos de entregas/recepciones de efectivo en esquema/API/frontend; integración con `artifacts/api-server/src/routes/pos.ts`, `src/routes/admin-analytics.ts` y pantalla de Cuentas Destino. Contratos nuevos de recepción, diferencias y confirmación; no suponer que la ruta de confirmación fiscal sirve para este fin. |

En cada fila, `src/...` abreviado conserva la raíz del artefacto nombrado inmediatamente antes. Los archivos compartidos de E1/E2/E4/E5 y E7/E9 explican por qué no se promete paralelismo integral.

### A0. Fuente, condición de arranque y alcance de esta revisión

- Pedido original: `attached_assets/Pasted--Prompt-U-Plan-de-implementaci-n-de-las-decisiones-de-l_1789678333394.txt`, decisiones 22–56, comprobaciones 64–75, entregas 81–127, pendientes 133–155 y prohibiciones 159–172.
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
- Productores adicionales a inventariar al implementar E1: autorización de nota y movimientos de reverso/ajuste de `artifacts/api-server/src/lib/pos.ts` y rutas de clientes, además de `routes/pagos-dirigidos.ts`. No limitar el cambio a ABONO.
- Referencias de regresión: pruebas de crédito/FIFO bajo `artifacts/api-server/src/lib/`, contratos de notas y estados de cuenta; no ejecutar `inventario.test.ts` ni suites financieras con escrituras como si fueran pruebas puras.

### A2. Proyección frente a aplicaciones — E1, E5, E7

- `artifacts/api-server/src/lib/credit-allocation.ts:233–275,520–562`: `projectCreditLedger`/proyección por movimientos; fuentes revertidas y `directedMovimientoId`.
- `artifacts/api-server/src/lib/credit-aging-read-model.ts:35–75`: evidencia `aplicaciones_credito`, SUM de importes y JOIN de solicitud dirigida aprobada.
- `artifacts/api-server/src/routes/clientes.ts:1929–1959`: `projectedCharge.pendienteCents`, `deriveEstadoNota`; presentación de estado de cuenta en 215–445.
- `artifacts/mariana-textil/src/pages/nota.contract.test.ts:47–55,66–123`: estado canónico, pendiente y vencimiento.
- Límite: nuevas constancias no pueden convertirse simplemente en «SUM de aplicaciones = saldo». E5 deberá integrar una excepción autorizada conservando FIFO ordinario y sus candados financieros, sin tocar los candados de inventario.

### A3. Pago dirigido — E5

- `artifacts/api-server/src/routes/pagos-dirigidos.ts:212–260`: `POST /api/pagos-dirigidos`, autoaplicación de ADMIN y solicitud no ADMIN pendiente sin abono.
- Mismo archivo 269–285: `POST /api/pagos-dirigidos/:id/aprobar`, `requireRole("ADMIN")`; revisar también rechazo y cada autoaplicación, no solo el botón de aprobación.
- `notifyRequesterResolved` avisa resolución de solicitud; no acredita una notificación específica de reapertura de nota.
- Superficies: esquema de `solicitudes_pago_dirigido`, componentes/página de solicitudes y `App.tsx`, contratos OpenAPI, lectura de crédito, auditoría y posibles constancias nuevas.
- Operación propuesta, no existente: reasignación de un `pagoId` ya registrado con origen/destino/monto/motivo/evidencia de autorización. No requiere inventar un nuevo ABONO. La identificación del autorizador debe usar las dos cuentas permitidas, no solo un rol.
- R4/R5: `replit.md:1070` diferencia `projectCreditLedgerCore`, `evaluateAutomaticFavorEligibility`, `immutableAppliedCents` y falta de vía equivalente para AJUSTE_NEGATIVO.

### A4. Caja y salidas de dinero — E2, E4, E9

- `artifacts/api-server/src/lib/pos.ts:1592–1618`: `crearSalidaDineroCaja`, proveedor opcional, motivo, sesión abierta y `CASH_OUT_LOCATION_FORBIDDEN`.
- `buildCorteCaja`, mismo archivo 2156–2211 y 2425–2473: pagos de tickets por sesión, salidas por sesión/cuenta y esperado; no incluye ABONO de crédito.
- `artifacts/api-server/src/routes/pos.ts:1014–1094`: `/api/sesiones-caja/:id/corte`, `/cerrar`, GET/POST `/salidas-dinero`; permisos y alcance deben conservarse o ampliarse solo para las acciones aprobadas.
- Esquema de sesiones y salidas de dinero en `lib/db/src/schema/pos.ts`; frontend `artifacts/mariana-textil/src/pages/caja/cortes.tsx`, `pages/corte-detail-shared.tsx` y sus consumidores.
- Contratos: corte, salidas, creación/revisión y eventual devolución/recepción. Nuevos estados de revisión son propuesta; no hay hoy ciclo completo de aceptar/reclamar identificado.
- Referencias de regresión: cortes/POS, `pos-caja-final.contract.test.ts` y pruebas de sesión; precisar qué son contratos sin DB frente a integración con escrituras antes de ejecutarlas.
- **No reutilizar como dinero** `routes/salidas.ts` ni `lib/salidas.ts`: esas recepciones son inventario. Tampoco `POST /admin/cuadre-fiscal/confirmaciones` acredita recepción física en Mariana.

### A5. Recibo: ausencia de implementación y especificación previa — E3

- Búsqueda de recibo/receipt en rutas, contratos y componentes: no se identificó documento de dinero. `receipt-preview-excess` en `cliente-pago-dialog.tsx` es vista previa de saldo a favor. El bloque de `ticket-detail.tsx:958–964` acredita mercancía, no abono.
- Especificación previa: `attached_assets/Pasted--Prompt-para-Replit-Agent-Recibo-de-dinero-abonos-de-cl_1789415439280.txt:11–50,66–98`: variantes cliente/proveedor, A5 horizontal/dos copias, medición de capacidad, folio, reimpresión y evidencia registrada.
- Política de evidencia recordada y a contrastar con el documento original en implementación: `.agents/memory/receipt-evidence-policy.md`. No es prueba de funcionalidad ni autoriza escrituras. La existencia de aplicaciones guardadas no demuestra que estén conservados remanente y saldo inmediatamente posterior.
- Rutas propuestas: emisión/consulta/reimpresión desde un movimiento, con permiso y auditoría. No nombrarlas como existentes. La constancia debe guardar valores suficientes al confirmar, para que ninguna reimpresión recalcule FIFO.

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
- `artifacts/mariana-textil/src/caja-cobranza.contract.test.ts` y contratos de desgloses/tiempo real: nombres y cierre de cifras deben corresponder a la regla escrita.
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

## Recomendación final y preguntas que faltan

**Recomendación: empezar por E1, origen y evidencia, y no por la reasignación.** Es la base que habilita seis entregas posteriores. Adelantar E6 y E8 sin mezclarlos con los motores financieros; después completar corte y recibo antes del piloto. La recepción en Mariana permanece al final.

Las trece decisiones se mantienen. Estas preguntas concretan lo que todavía no definen:

1. **Atribución histórica:** ¿quién puede asignar o rectificar la tienda de uno de los tres movimientos y qué comprobante debe adjuntar? Recomiendo evidencia y motivo obligatorios, sin editar el movimiento.
2. **Ajuste sin origen identificable:** si quien captura no puede identificar la nota que originó el ajuste, ¿lo deja pendiente de aclaración hasta identificarla? No propongo inventar la tienda ni cambiar la decisión 4.
3. **Devoluciones físicas:** ¿se permiten devoluciones parciales y devoluciones de pagos ya aplicados a notas, además de devolver saldo a favor? ¿Quién las autoriza? La salida siempre será en la caja abierta de hoy; eso ya está decidido.
4. **Extraordinarias:** ¿quién puede capturarlas en cada tienda y qué evidencia/respuesta debe presentar el supervisor cuando ADMIN las reclama? La revisión ADMIN y la posibilidad de registrar en las tres tiendas no se replantean.
5. **Cuentas autorizadoras:** ¿cuáles son las dos cuentas del propietario y socio que tendrán esta facultad? No se piden contraseñas ni se propone extenderla a todos los ADMIN o exigir dos firmas.
6. **Nota reabierta:** ¿quién informa al cliente y qué constancia se le entrega cuando una reasignación deja pendiente una nota que tenía como pagada? Recomiendo constancia vinculada al recibo original y acuse de la comunicación.
7. **Alcance inicial de reasignación:** ¿se acepta una primera versión solo para pagos con evidencia íntegra y sin los conflictos históricos descritos, dejando esos casos para revisión, o deben resolverse antes de habilitarla? La primera opción es parcial y no autoriza presentar como ilegítima una corrección solo porque falta evidencia.
8. **Entrega en Mariana:** ¿se recibirá efectivo de otras tiendas, de la propia caja o ambos; se confirmará por corte completo o también por entregas parciales, y cómo se acreditará una diferencia? Esto debe resolverse antes de E9, no antes de iniciar la base de crédito.

La aprobación de este orden no autoriza por sí misma ninguna escritura: al elegir una entrega se deberá guardar la autorización textual y el alcance específico conforme a la regla vigente.