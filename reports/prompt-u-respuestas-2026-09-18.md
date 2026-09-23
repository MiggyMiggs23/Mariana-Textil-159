# Plan U — respuestas del propietario del 2026-09-18

Fuente: `attached_assets/Pasted-Solo-documentaci-n-No-toques-c-digo-no-escribas-en-la-b_1789785920886.txt`.

Fuente de la ampliación: mensaje posterior del propietario en esta conversación, registrado bajo la misma fecha documental. Se conserva literalmente en la sección siguiente.

Alcance: solo documentación. Estas respuestas no acreditan implementación, migración de cuentas, activación de permisos ni cambios en la base. Las respuestas textuales se conservan como historial; el estado actualizado de cada conflicto distingue las resoluciones expresas del propietario de los puntos que siguen pendientes.

## Respuestas textuales

P4 (E5). Si ADMIN rechaza el destino preparado, el dinero sigue esperando otra propuesta. Si el cliente pide que se le devuelva, aplica la regla vigente: importe completo nunca aplicado, solo ADMIN.

P5 (E5). Se permite autorizar una parte y dejar el resto esperando. Una propuesta puede abarcar varias notas del mismo cliente. El propietario acepta la consecuencia: la parte que quede después de una aplicación parcial ya no es devolvible, porque la devolución exige importe completo nunca aplicado.

P7 (E5). El dinero dirigido sin aplicar se destaca y se avisa a ADMIN a partir de 3 días desde su recepción.

P9 (E11). Esto cambia lo que decía el plan. ContadorF solo ve lo facturado: facturas, clientes facturados y ventas facturadas. Ya no ve las ventas no facturadas. Además tiene un botón para aceptar que las ventas facturadas cuadran con su registro externo. Puede aceptar por día si quiere, pero las semanas y los meses siempre deben quedar aceptados. Si no cuadra, marca "no cuadra" y se notifica a ADMIN para abrir una investigación. ContadorF no ve el Fondo ni los pagos a proveedor: el manejo fiscal del Fondo se lleva fuera del sistema. ContadorA queda como estaba en el plan.

P10 (E11). Todas las cuentas CONTADOR existentes pasan a ContadorF. El propietario asigna ContadorA a mano.

P12 (E12). Un pago o retiro que exceda el saldo registrado de caja o del Fondo se bloquea. ADMIN puede desbloquearlo con motivo obligatorio, y el desbloqueo queda en el historial.

P13 (E12). Un pago a proveedor que sale completo del Fondo no requiere turno de caja abierto. Si usa caja, esa parte sí requiere sesión abierta de Mariana.

## Respuestas textuales — ampliación

P6 (E5). Sin ADMIN, un pago dirigido solo se acepta por el importe exacto del saldo pendiente de la nota o notas indicadas. No se acepta de más. Si mientras espera la nota se paga por otro medio, aplica P4: el dinero sigue esperando otra propuesta o ADMIN lo devuelve completo.

P8 (E9). Cada tienda entrega su efectivo completo al cierre. El envío lo documenta ADMIN o SUPERVISOR. Si lo recibido en Mariana no coincide con lo enviado, se abre una investigación.

P14 (E12). Al corregir o recuperar un pago mixto a proveedor, el dinero regresa a cada origen por lo que salió de cada uno.

Facturación con líneas metreadas: se mantiene la restricción. No se permite facturar ventas con líneas por metro.

Confirmación administrativa para borrar: se piden usuario y contraseña de un ADMIN, como está hoy.

Producto sin movimientos que solo tiene historial de precios: sí se puede borrar. Si borrarlo obliga a borrar o dejar huérfanos sus renglones de precio_historial, detente y repórtamelo antes de proponer cómo.

Los tres movimientos históricos sin sitio (#51, #52, #53) se quedan como "Sin sitio determinado". Los 69 vetos de acción por rol quedan pendientes.

## Texto anterior sustituido en las decisiones del plan

Referencia: `reports/prompt-u-plan-de-implementacion.md`. Se conserva ese archivo sin editar como antecedente; estas sustituciones quedan registradas también en `replit.md`.

| Respuesta | Texto o estado anterior sustituido | Nuevo alcance documental |
|---|---|---|
| P4 | Pregunta 4: esperar otra propuesta o devolver tras rechazo de ADMIN. | Espera otra propuesta; devolución a petición del cliente bajo la regla vigente. No se aplica FIFO por rechazo. |
| P5 | Pregunta 5: autorización completa o por partes y posibilidad de varias notas. | Se permiten partes y varias notas del mismo cliente; remanente después de aplicación parcial no devolvible. |
| P7 | Pregunta 7: umbral y destinatario del aviso sin decidir. | Desde 3 días de la recepción, destacado y aviso a ADMIN. |
| P9 | E11: «Ve **todas** las ventas y cobranza, facturadas o no» y «No filtrar su análisis exclusivamente por lo fiscal»; «solo consulta; no registra operaciones» no contemplaba la aceptación de conciliación. Pregunta 9 y referencias a la necesidad de que ContadorF cuadre pagos a proveedor. | ContadorF limitado a lo facturado, con aceptación de conciliación y aviso de discrepancias según la respuesta textual; sin Fondo ni pagos a proveedor. La aceptación no se interpreta como facultad de crear operaciones monetarias. ContadorA no cambia. |
| P10 | Pregunta 10 y pendiente de E11: asignación de perfiles a cuentas CONTADOR por decidir. | Todas se destinan a ContadorF; ContadorA lo asigna manualmente el propietario. No se ejecutó migración. |
| P12 | Pregunta 12: bloqueo por insuficiencia y procedimiento de excepción ADMIN sin decidir. | Resuelto: el desbloqueo ADMIN motivado e histórico aplica solo a caja; no al Fondo. Un retiro nunca deja el Fondo en negativo; una corrección contable de un error de captura sí puede dejar saldo negativo, mostrado expresamente. El conflicto de inversos E10 queda resuelto por decisión del 2026-09-21. |
| P13 | Pregunta 13: pago exclusivamente del Fondo sin turno por decidir. | No requiere turno si sale completo del Fondo; la parte de caja requiere sesión abierta de Mariana. |
| P6 | Pregunta 6: procedimiento ante nota pagada durante la espera o excedente; nota de este informe que aún dejaba ese procedimiento pendiente. | Sin ADMIN solo se recibe el importe exacto del saldo pendiente de las notas indicadas, sin exceso. Si se pagan por otro medio durante la espera, aplica P4. No se autoriza conversión automática en favor ni devolución de remanentes ya aplicados. |
| P8 | Pregunta 8: corte completo o remesas parciales, responsable de documentar envío y tratamiento de diferencias por decidir. | Cada tienda entrega efectivo completo al cierre; envío documentado por ADMIN/SUPERVISOR; diferencia al recibir en Mariana abre investigación. No se inventa ajuste automático ni se modifica un corte cerrado. |
| P14 | Pregunta 14: retorno a cada origen o a un origen diferente por decidir. | El dinero regresa a cada origen por el importe que salió de él. No se autoriza un origen alternativo ni se acredita una recuperación ya realizada. |

La nueva P6 sustituye la nota anterior «P5 no cierra toda la pregunta 6» en cuanto al procedimiento ahora contestado. Se conserva P5: después de una aplicación parcial, el remanente no es devolvible. La remisión de P6 a P4 no elimina la condición de importe íntegro nunca aplicado. No se extienden estas respuestas a las demás preguntas no contestadas. No se inventan hora de corte del umbral, vencimientos de aceptación semanal/mensual ni una aprobación diaria obligatoria.

### Sustituciones y confirmaciones adicionales en replit.md

- **Facturación:** se sustituye «Pendiente de confirmar con el usuario: hoy no se puede marcar como facturada una venta con líneas metreadas» por la restricción confirmada de no facturar ventas con líneas por metro.
- **Confirmación de borrado:** se sustituye la recomendación pendiente de decidir entre usuario/contraseña y solo contraseña del ADMIN en sesión. Se confirma usuario y contraseña de un ADMIN, sin modificar las reglas de sesión ejecutora, auditoría ni elegibilidad del producto.
- **Historial de precios — resuelto para construcción futura:** la detención anterior queda sustituida por borrar producto y sus renglones de `precio_historial` cuando nunca tuvo movimientos, conservando la bitácora. Se construye junto con remate y precios; no se ejecuta ni habilita ahora.
- **Históricos:** la determinación pendiente del sitio real de los movimientos #51, #52 y #53 se sustituye por conservar «Sin sitio determinado». No se ejecutan atribuciones ni se altera la vía general futura de atribución.
- **Vetos:** los 69 vetos de acción por rol siguen pendientes. No se aprueban, descartan ni cambian permisos mediante esta documentación.

## Conflictos registrados — estado actualizado por decisión del propietario

### P9 y P10 frente al perfil CONTADOR — RESUELTO para E11

En «Roles SISTEMAS y CONTADOR», la regla actual dice: «CONTADOR ve todo lo financiero» y «Conserva sus permisos de pagos a proveedores». También conserva `crear` en `cobros_pagos` y `proveedores_finanzas`. En «Decisión provisional de Control operativo por costo (2026-09-15)» se preservan Cuentas destino y las consultas de caja autorizadas.

La nueva resolución sustituye esa conservación de facultades al construir E11: las cuentas migradas a ContadorF pierden todo acceso fuera de lo facturado y no pueden registrar pagos de proveedor ni de cliente. Esto incluye los accesos anteriores que pudieran sobrevivir mediante permisos u overrides: no se conservan como excepción a la decisión. No se migraron cuentas ni se cambiaron permisos ahora.

### P12 frente al límite de retiros de E10 — RESUELTO para pagos/retiros

En «Reglas canónicas de E10» se establece: «Un retiro ordinario no puede exceder el saldo disponible». La primera respuesta P12 incluía caja y Fondo en el desbloqueo; esa amplitud queda sustituida.

El desbloqueo ADMIN por insuficiencia, con motivo obligatorio e historial, aplica solo a caja. El retiro del Fondo no puede exceder saldo. Esta resolución no implementa el desbloqueo. La decisión del 2026-09-21 acota la prohibición de saldo negativo a los retiros y conserva los inversos contables de E10 para corregir errores de captura, aun si dejan saldo negativo mostrado expresamente; el conflicto adicional queda resuelto.

### Producto con historial de precios — impedimento histórico RESUELTO para construcción futura

La instrucción anterior exigía detenerse si el borrado requería eliminar o dejar huérfano el historial. La decisión nueva sustituye esa detención: si el producto nunca tuvo movimientos, se borrará junto con sus renglones de `precio_historial`, conservando el registro en bitácora. Si tuvo cualquier movimiento, no se borra. Se construye junto con remate y precios, no ahora.

La inspección exclusivamente estática muestra:

- `lib/db/src/schema/precio-historial.ts`: `producto_id` es obligatorio (`notNull`) y referencia `productos.id`; no declara borrado en cascada ni desvinculación.
- `artifacts/api-server/src/lib/purga-catalogos.ts`: la purga cuenta las referencias foráneas y las incorpora como impedimentos; `precio_historial.producto_id` se identifica como «Historial de precios». No se exceptúa ese historial.

Con el esquema declarado, no se puede borrar físicamente el producto dejando sus renglones de precio intactos con la misma referencia. La clave foránea debe impedir ese borrado, no producir huérfanos. No se comprobó el esquema efectivo en la base ni se intentó borrar ningún producto.

La relación obligatoria sigue describiendo el código actual, no un conflicto de negocio pendiente: el propietario ya permite borrar los renglones dependientes junto con el producto. Se verificó por lectura estática que `artifacts/api-server/src/routes/precios.ts` registra `CAMBIAR_PRECIO` en `auditoria` con datos anteriores y posteriores; no se verificó la cobertura de registros históricos en la base. No se eliminó historial ni se modificó código. La decisión no habilita el borrado ahora ni retira los demás controles de producto, como existencia cero, credenciales y auditoría.

### P6, P8 y P14 — alcance y compatibilidad

No se identificó otro conflicto con las reglas vigentes: P6 remite a P4 y conserva la condición de devolución íntegra nunca aplicada; P8 no autoriza modificar cortes cerrados ni habilitar E9; P14 define el retorno físico a los orígenes y no sustituye las reglas de inversos contables de E10. No se inventa una entrada física por una corrección que aún no haya devuelto dinero.

### Límites que no constituyen conflictos adicionales

- P4/P5 conservan devolución íntegra nunca aplicada, solo ADMIN; no habilitan devoluciones parciales.
- P9 conserva la exclusividad ADMIN del Fondo y retira del plan la conciliación de proveedor por ContadorF, en lugar de abrirle datos del Fondo.
- P13 mantiene la exclusividad de Mariana para proveedores; no autoriza usar caja de otro sitio.
- P12 trata saldo de caja/Fondo, no el límite de crédito del cliente. No modifica la prohibición de override del límite de crédito.
- Que E5/E11/E12 no estén implementados o habilitados no es, por sí solo, un conflicto de reglas.

## Decisiones textuales — remate, precios y purga pendiente

Fuente: nuevo mensaje del propietario en esta conversación. Solo documentación; no construir, preparar ni ejecutar ahora.

1. Remate (entrega nueva, no construir todavía). Solo ADMIN puede marcar rollos específicos como "remate", con motivo obligatorio. Solo esos rollos se pueden vender por debajo del costo; el cajero no puede hacerlo por su cuenta. La venta queda señalada como remate y su pérdida aparece en los reportes de utilidad. Fuera de eso, vender por debajo del costo sigue bloqueado.

2. Precios. El precio de lista no tiene techo para subir. Para bajar, el mínimo es el costo: la pantalla de Precios debe bloquear un precio de lista menor al costo en lugar de solo guardar la advertencia (routes/precios.ts, advertenciaBajoCosto). Se construye junto con el remate.

3. Purga pendiente. Cuando el propietario lo decida, al terminar las entregas, se hará una purga completa de datos de prueba con el mismo procedimiento del 13 de septiembre (respaldo, ensayo en copia desechable y ejecución autorizada). Eso incluye los movimientos #51, #52 y #53 sin sitio. No se prepara ni se ejecuta nada ahora.

### Alcance documental y diferencias con lo anterior

- Remate se registra como entrega nueva futura, sin asignarle un identificador del plan ni iniciar construcción. La formulación inicial «solo ADMIN» queda precisada por la resolución posterior: «Marcar remate» es un permiso configurable de matriz que por defecto solo tiene ADMIN. No hay veto fijo por rol. Se conserva el motivo, la marca por rollo, la señalización de la venta y su pérdida en utilidad; no se permite al cajero eludir la marca requerida.
- Precios se construirá junto con remate. La decisión exige bloqueo bajo costo cuando el producto tenga costo, no advertencia ni confirmación que permita guardarlo. No se presenta ese bloqueo como ya implementado. El registro histórico del 7 de septiembre en `replit.md` describe «confirmación bajo costo»; se conserva como antecedente, no como aceptación del comportamiento futuro. No se redefine el cálculo del costo. La decisión del 2026-09-21 permite asignar precio de lista al producto sin costo registrado: el piso aplica cuando tenga costo y la venta conserva el bloqueo por costo del rollo.
- La purga es una decisión futura condicionada al cierre de entregas y a que el propietario la decida y autorice. No se elaboró procedimiento operativo, inventario, respaldo, copia desechable, script ni comando de ejecución. La referencia al procedimiento del 13 de septiembre no reutiliza automáticamente su autorización ni sus listas históricas.
- Los movimientos #51, #52 y #53 siguen hoy «Sin sitio determinado», sin atribución ni borrado. La decisión los incluye expresamente en la futura purga; no equivale a haberla realizado. La resolución posterior del borrado individual con historial de precios es independiente de esa purga.

### Conflictos o tensiones de remate y purga — estado actualizado

1. **Remate frente a matriz — RESUELTO.** «Marcar remate» será permiso de matriz que por defecto solo tiene ADMIN, no una restricción fija en código. Sustituye la lectura de exclusividad inmutable del primer texto. Los 69 vetos existentes continúan pendientes; no se implementó el nuevo permiso.
2. **Purga completa frente a conservación operativa.** `replit.md` prohíbe DELETE en tablas operativas y preserva el histórico financiero permanente. También documenta purgas excepcionales ya autorizadas. Se señala la tensión con la futura eliminación de datos de prueba, incluidos #51–#53, sin convertir esta decisión en una excepción operativa vigente ni suponer qué otras tablas o registros pueden eliminarse. Las reglas actuales de conservación permanecen intactas hasta la autorización futura; no se propone cómo sortearlas.
3. **Precios: diferencia con comportamiento documentado.** La confirmación bajo costo del registro histórico no cumple el nuevo bloqueo solicitado. Se registra como cambio futuro deliberado, no como conflicto que deba resolverse alterando ahora ese antecedente o el código. No se encontró en las reglas revisadas un techo de negocio para subir el precio que deba retirarse.

## Resoluciones textuales del propietario — ampliación posterior

1. P9/P10 contra el perfil CONTADOR vigente. Al pasar a ContadorF, las cuentas CONTADOR pierden todo lo que hoy tienen fuera de lo facturado: dejan de ver lo financiero no facturado y ya no pueden registrar pagos a proveedor ni pagos de cliente. Esto sustituye "CONTADOR ve todo lo financiero" y la conservación de sus permisos de pagos. Se aplica al construir E11, no ahora.

2. P12 contra E10. El desbloqueo ADMIN por insuficiencia de saldo aplica solo a caja. El Fondo nunca queda en negativo: se conserva la regla de E10 de que un retiro no excede el saldo disponible.

3. Remate contra la regla de matriz. "Marcar remate" será un permiso de la matriz que por defecto solo tiene ADMIN, no una restricción fija en código.

4. Borrar un producto con historial de precios. Si el producto nunca tuvo movimientos, se borra junto con sus renglones de precio_historial. La bitácora ya conserva cada cambio de precio (CAMBIAR_PRECIO en routes/precios.ts), así que no se pierde el registro. Si el producto tuvo cualquier movimiento, no se borra, como hoy. Se construye junto con remate y precios.

### Fondo e inversos contables — conflicto RESUELTO por el propietario (2026-09-21)

La resolución 2 anterior decía «El Fondo nunca queda en negativo». El propietario acota expresamente esa frase: un retiro nunca deja el Fondo en negativo; una corrección contable de un error de captura sí puede dejarlo en negativo y ese saldo se muestra expresamente, como establece E10.

El conflicto de inversos queda resuelto por esa decisión, no por interpretación del agente. Se conserva el inverso exacto, enlazado y único, sin borrar el original ni presentarlo como nueva entrada/salida física. El desbloqueo de retiros sigue limitado a caja; no habilita retiros del Fondo sobre saldo.

La tensión de la purga completa con conservación operativa sigue pendiente y no se amplía su autorización. La revisión de la ampliación del 2026-09-21 se detalla abajo. No se modificaron código, datos, permisos, configuración ni servicios.

## Decisiones textuales del propietario — ampliación del 2026-09-21

Fuente: mensaje del propietario en esta conversación. **Solo documentación:** no tocar código, escribir en la base ni reiniciar la API. Las decisiones siguientes no acreditan implementación ni activación.

1. Producto sin costo registrado: se le puede poner precio de lista. El piso de precio aplica cuando tenga costo. En venta sigue protegido por el bloqueo del costo del rollo.

2. Marca de remate: ADMIN puede quitarla con motivo obligatorio. Queda en el historial y no se borra la marca original.

3. Cambio de precios: solo ADMIN, configurado como permiso de la matriz, no como restricción fija en código. Corrige en replit.md el texto que describe un guard directo de ADMIN en Precios.

4. Se acota la frase "El Fondo nunca queda en negativo": un retiro nunca deja el Fondo en negativo. Una corrección contable de un error de captura sí puede dejarlo en negativo, y se muestra expresamente, como ya dice la regla de E10. Queda resuelto el conflicto reportado.

### Sustituciones documentales y límites

- **Costo no registrado:** queda resuelta la decisión de negocio sobre asignar precio de lista. No equivale a costo cero, no cambia el cálculo del costo ni habilita la venta de un rollo bloqueado por costo. La implementación y cobertura de otras rutas de edición/importación siguen sin acreditarse.
- **Retiro de remate:** queda contestado el retiro por ADMIN con motivo e historial, conservando la marca original. No se autoriza borrarla ni reescribirla. La edición de una marca, distinta de retirarla con trazabilidad, no queda contestada; tampoco se cambian aquí los permisos de otros roles ni el permiso configurable de «Marcar remate».
- **Cambio de precios:** se sustituye la regla documental de guard directo ADMIN por permiso configurable de matriz, configurado para que solo ADMIN cambie precios. No se añade un techo fijo por rol ni se ejecuta cambio alguno de la matriz. No se redefine quién puede consultar precios.
- **Fondo:** se actualizan todas las notas que dejaban pendiente el conflicto de inversos. La corrección contable no es un retiro ni evidencia de movimiento físico. El Fondo continúa sin habilitarse.

### Otras reglas revisadas — tensión reportada, sin resolver

En «Roles SISTEMAS y CONTADOR», `replit.md` conserva para SISTEMAS la frase **«Opera todo»** y menciona el diagnóstico de precios, pero no distingue allí consulta de cambio de precios. Esa amplitud documental está en tensión con la configuración ahora confirmada de que solo ADMIN cambie precios. Se reporta sin convertir el diagnóstico en permiso de edición, sin retirar facultades de SISTEMAS por cuenta propia y sin modificar esa regla. No se consultaron permisos efectivos en la base.

La regla general de matriz configurable es compatible con la decisión 3; no se interpreta «solo ADMIN» como veto fijo en código. Retirar la marca conservando original e historial es compatible con no borrar evidencia. La tensión anterior de la purga completa y los 69 vetos de rol siguen pendientes, fuera de estas cuatro decisiones.

## E3 — decisión textual del propietario sobre captura y recibo (2026-09-21)

Transcripción histórica, conservada sin reescribir las palabras del propietario. La regla vigente de actores es la decisión de Parte 2 del 2026-09-22, registrada debajo: permiso de matriz por defecto solo ADMIN, sin veto ADMIN fijo en código y conservando la guarda E1. Sustituye la exclusividad normativa de Tanda A.

> Decisión nueva del propietario sobre la naturaleza del dinero: el cajero nunca ve una pregunta de naturaleza. Todo abono capturado desde Caja es dinero real recibido en ese momento y entra a la caja abierta. Las recapturas (pagos recibidos antes que solo se registran, sin dinero nuevo) solo se capturan desde la pantalla del cliente, con motivo obligatorio, y nunca entran a caja. Es un permiso de la matriz que por defecto solo tiene ADMIN. Regístralo en prompt-u-respuestas y en replit.md.
>
> Recuerda además: sin ADMIN, un pago dirigido solo se acepta por el importe exacto del saldo pendiente (P6). El recibo A5, en dos copias, se genera al cobrar pero se imprime desde otro equipo, porque no hay impresora en caja. ADMIN llega al recibo desde el abono, el estado de cuenta y el corte.

### Sustitución y límites

- Sustituye el requisito de E3 del plan que pedía una pregunta de naturaleza comprensible para el cajero. No se presenta esa pregunta: el flujo de Caja declara en servidor ingreso físico real y el flujo de recaptura desde cliente declara corrección contable. No se eliminan las cuatro naturalezas E1 ni sus validaciones por productor.
- La recaptura conserva el efecto contable de crédito que corresponda; no es un nuevo ingreso, no entra al corte y requiere motivo. Se autoriza por permiso configurable de matriz, por defecto solo ADMIN, sin veto ADMIN fijo en código. Se conserva la guarda E1 que excluye a CONTADOR, SISTEMAS y BODEGA; ningún permiso de matriz supera esa exclusión.
- La sesión abierta de la operación de Caja y la sesión de efectivo en E1 son conceptos separados: las transferencias conservan su cuenta bancaria y no se suman al efectivo del cajón. La asociación operativa del recibo no altera esa evidencia permanente. Si esa separación resultase insuficiente, se debe reportar el conflicto, no relajar la regla E1.
- P6 exige exactitud para el dirigido sin ADMIN. Continúa la dependencia de E5/E7 para liberar dinero retenido y su aplicación; no se presenta como deuda pagada ni como favor disponible.
- La generación del recibo al confirmar la recepción es independiente de su posterior impresión por ADMIN desde otro equipo. No se recobra por fallo de impresión y no se reconstruye evidencia faltante.
- Se autoriza **construcción apagada**, no liberación. No acceder a la base de la API, no ejecutar SQL contra ella, no reiniciar la API ni modificar el bundle en ejecución. SQL y reversión, si hacen falta, quedan preparados sin ejecución.
- Permanecen protegidos `reports/e2-paquete-liberacion-preparado-20260921/`, `artifacts/api-server/dist-e2-20260927/` y el dist retenido. Toda prueba nueva debe demostrar fallo con su defecto introducido. Resultados, revisión exacta y asuntos detenidos se documentan por separado en `reports/e3-20260921/`.

### Actores de recaptura E3 — conflicto resuelto por el propietario

La decisión vigente de Parte 2 del 2026-09-22 conserva la guarda E1 y define recaptura como permiso de matriz, por defecto solo ADMIN, igual que remate y precios; no se fija ADMIN en código. CONTADOR, SISTEMAS y BODEGA no pueden capturar recapturas aunque reciban el permiso. SUPERVISOR, CAJA y TERMINAL pueden recibirlo mediante personalización, pero su autorización general como actores de crédito no basta. Se descarta el antiguo pendiente técnico de exigir ADMIN ante permisos personalizados, sustituido expresamente por el propietario. No se cambia ni se sortea E1. Esto no se confunde con la separación entre sesión operativa y evidencia de efectivo de una transferencia.

### Apertura E3 — decisión Parte 2 del 2026-09-22, no liberación

La futura liberación E3 abre la captura ordinaria de efectivo. Retiro dirigido/retenido, devolución, atribución y Fondo siguen cerrados. Se prepara un candidato operativo nuevo, sin modificar E2 ni el paquete CLOSED previo: expectativas desde la conexión efectiva de la API en READ ONLY, esquema sin filas reales, SQL 01 y retiro acotado de la guarda ordinaria SQL 03 exclusivamente en PostgreSQL nuevo desechable y destruido al terminar. Los gates de la fuente que sirve desarrollo siguen OFF; la activación ordinaria E3 y su matriz se limita a una copia física aislada para compilar el candidato con fuente y hashes trazables. No se activa dirigido ni ningún otro gate.

Esta preparación no autoriza fase B, SQL en la base de la API, reinicios ni cambios de workflow o bundle activo. El texto de fase B debe entregarse para autorización posterior con inicio «a partir del momento en que el propietario pegue el texto»; no se ejecuta. El paquete anterior conserva sus citas y evidencia histórica, pero su pendiente de exclusividad ADMIN ya no rige. Autorización íntegra: `reports/e2-liberacion-20260922/autorizacion-tres-partes-20260922.txt`. Esta actualización documental no acredita compilación, ensayo ni entrega del nuevo paquete.

## BODEGA y Contenedores — decisión del propietario (2026-09-23)

BODEGA no debe ver contenedores con costo pendiente. La regla vigente es la revocación predeterminada de `contenedores` establecida por la actualización de costos pendientes: el rol BODEGA no recibe `contenedores.ver`. El seed debe declarar el mismo default y no contradecir la revocación. Se conserva la regla general de defaults: las filas sin `updated_por` se corrigen al valor vigente y una personalización administrativa explícita, identificada por `updated_por`, no se sobrescribe.