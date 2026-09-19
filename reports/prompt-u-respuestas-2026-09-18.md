# Plan U — respuestas del propietario del 2026-09-18

Fuente: `attached_assets/Pasted-Solo-documentaci-n-No-toques-c-digo-no-escribas-en-la-b_1789785920886.txt`.

Fuente de la ampliación: mensaje posterior del propietario en esta conversación, registrado bajo la misma fecha documental. Se conserva literalmente en la sección siguiente.

Alcance: solo documentación. Estas respuestas no acreditan implementación, migración de cuentas, activación de permisos ni cambios en la base. Los conflictos con reglas vigentes se registran abajo sin resolverlos.

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
| P12 | Pregunta 12: bloqueo por insuficiencia y procedimiento de excepción ADMIN sin decidir. | Se registra el bloqueo y desbloqueo motivado e histórico solicitado, con conflicto vigente de E10 pendiente de resolución. |
| P13 | Pregunta 13: pago exclusivamente del Fondo sin turno por decidir. | No requiere turno si sale completo del Fondo; la parte de caja requiere sesión abierta de Mariana. |
| P6 | Pregunta 6: procedimiento ante nota pagada durante la espera o excedente; nota de este informe que aún dejaba ese procedimiento pendiente. | Sin ADMIN solo se recibe el importe exacto del saldo pendiente de las notas indicadas, sin exceso. Si se pagan por otro medio durante la espera, aplica P4. No se autoriza conversión automática en favor ni devolución de remanentes ya aplicados. |
| P8 | Pregunta 8: corte completo o remesas parciales, responsable de documentar envío y tratamiento de diferencias por decidir. | Cada tienda entrega efectivo completo al cierre; envío documentado por ADMIN/SUPERVISOR; diferencia al recibir en Mariana abre investigación. No se inventa ajuste automático ni se modifica un corte cerrado. |
| P14 | Pregunta 14: retorno a cada origen o a un origen diferente por decidir. | El dinero regresa a cada origen por el importe que salió de él. No se autoriza un origen alternativo ni se acredita una recuperación ya realizada. |

La nueva P6 sustituye la nota anterior «P5 no cierra toda la pregunta 6» en cuanto al procedimiento ahora contestado. Se conserva P5: después de una aplicación parcial, el remanente no es devolvible. La remisión de P6 a P4 no elimina la condición de importe íntegro nunca aplicado. No se extienden estas respuestas a las demás preguntas no contestadas. No se inventan hora de corte del umbral, vencimientos de aceptación semanal/mensual ni una aprobación diaria obligatoria.

### Sustituciones y confirmaciones adicionales en replit.md

- **Facturación:** se sustituye «Pendiente de confirmar con el usuario: hoy no se puede marcar como facturada una venta con líneas metreadas» por la restricción confirmada de no facturar ventas con líneas por metro.
- **Confirmación de borrado:** se sustituye la recomendación pendiente de decidir entre usuario/contraseña y solo contraseña del ADMIN en sesión. Se confirma usuario y contraseña de un ADMIN, sin modificar las reglas de sesión ejecutora, auditoría ni elegibilidad del producto.
- **Historial de precios:** queda respondida la decisión de negocio antes pendiente: el historial de precios por sí solo no impide autorizar el borrado de un producto sin movimientos. Se registra la condición de detención del propietario; no se sustituye por cuenta propia el bloqueo operativo ni la prohibición de eliminar renglones de historial. Véase el impedimento abajo.
- **Históricos:** la determinación pendiente del sitio real de los movimientos #51, #52 y #53 se sustituye por conservar «Sin sitio determinado». No se ejecutan atribuciones ni se altera la vía general futura de atribución.
- **Vetos:** los 69 vetos de acción por rol siguen pendientes. No se aprueban, descartan ni cambian permisos mediante esta documentación.

## Conflictos con reglas vigentes de replit.md — sin resolver

### P9 y P10 frente al perfil CONTADOR vigente

En «Roles SISTEMAS y CONTADOR», la regla actual dice: «CONTADOR ve todo lo financiero» y «Conserva sus permisos de pagos a proveedores». También conserva `crear` en `cobros_pagos` y `proveedores_finanzas`. En «Decisión provisional de Control operativo por costo (2026-09-15)» se preservan Cuentas destino y las consultas de caja autorizadas.

La combinación de migrar todas las cuentas actuales a ContadorF y limitar ese perfil a lo facturado, sin pagos a proveedor, entra en tensión con esa amplitud de acceso vigente. Se informa el conflicto; no se decide aquí qué reglas operativas retirar, cómo remapear permisos u overrides ni qué accesos actuales conservar. La sustitución expresa del alcance de ContadorF en el plan no se presenta como modificación ejecutada del perfil CONTADOR actual.

### P12 frente al límite de retiros de E10

En «Reglas canónicas de E10» se establece: «Un retiro ordinario no puede exceder el saldo disponible». P12 introduce un desbloqueo ADMIN para pagos o retiros que excedan el saldo de caja o Fondo.

Se registra la respuesta, pero no se decide si esa excepción sustituye la prohibición vigente de E10 o requiere una categoría distinta. La regla vigente se conserva señalada como conflicto pendiente, sin habilitar la excepción.

### Producto con historial de precios — impedimento y detención

La regla operativa anterior de `replit.md` dice que, mientras se decide, el producto no se borra y ningún renglón de `precio_historial` se elimina. La nueva decisión responde el aspecto de negocio, pero condiciona cualquier avance a no borrar ni dejar huérfano ese historial.

La inspección exclusivamente estática muestra:

- `lib/db/src/schema/precio-historial.ts`: `producto_id` es obligatorio (`notNull`) y referencia `productos.id`; no declara borrado en cascada ni desvinculación.
- `artifacts/api-server/src/lib/purga-catalogos.ts`: la purga cuenta las referencias foráneas y las incorpora como impedimentos; `precio_historial.producto_id` se identifica como «Historial de precios». No se exceptúa ese historial.

Con el esquema declarado, no se puede borrar físicamente el producto dejando sus renglones de precio intactos con la misma referencia. La clave foránea debe impedir ese borrado, no producir huérfanos. No se comprobó el esquema efectivo en la base ni se intentó borrar ningún producto.

**DETENIDO en este punto**, conforme a la instrucción del propietario: se reporta la incompatibilidad con la relación actual y se conserva el bloqueo operativo. No se propone cómo resolverla, no se eliminan históricos, no se relajan restricciones y no se cambia código. La actualización del resto de la documentación no habilita este borrado.

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

- Remate se registra como entrega nueva futura, sin asignarle un identificador del plan ni iniciar construcción. La excepción es por rollos específicos marcados por ADMIN con motivo, no por producto completo ni por decisión del cajero. Se conserva la obligación de señalar la venta y mostrar su pérdida en utilidad.
- Precios se construirá junto con remate. La decisión exige bloqueo bajo costo, no advertencia ni confirmación que permita guardarlo. No se presenta ese bloqueo como ya implementado. El registro histórico del 7 de septiembre en `replit.md` describe «confirmación bajo costo»; se conserva como antecedente, no como aceptación del comportamiento futuro. No se redefine el cálculo del costo ni se inventa tratamiento para costo desconocido.
- La purga es una decisión futura condicionada al cierre de entregas y a que el propietario la decida y autorice. No se elaboró procedimiento operativo, inventario, respaldo, copia desechable, script ni comando de ejecución. La referencia al procedimiento del 13 de septiembre no reutiliza automáticamente su autorización ni sus listas históricas.
- Los movimientos #51, #52 y #53 siguen hoy «Sin sitio determinado», sin atribución ni borrado. La nueva decisión los incluye expresamente en la futura purga; no equivale a haberla realizado. No se extiende esa decisión al borrado individual del producto con historial de precios ni se levanta su detención.

### Conflictos o tensiones con reglas vigentes — sin resolver

1. **Remate exclusivo de ADMIN frente a la regla de matriz.** `replit.md`, «Matriz y alcance son responsabilidades separadas», dice que no deben existir vetos de acción por rol que limiten permisos concedidos por ADMIN y que las restricciones se configuran en la matriz, no como techos inmutables en código. La nueva exclusividad de marcar remate para ADMIN requiere conciliar ese alcance. Se registran ambas instrucciones sin decidir una excepción a la matriz ni cómo implementarla. Los 69 vetos existentes continúan pendientes.
2. **Purga completa frente a conservación operativa.** `replit.md` prohíbe DELETE en tablas operativas y preserva el histórico financiero permanente. También documenta purgas excepcionales ya autorizadas. Se señala la tensión con la futura eliminación de datos de prueba, incluidos #51–#53, sin convertir esta decisión en una excepción operativa vigente ni suponer qué otras tablas o registros pueden eliminarse. Las reglas actuales de conservación permanecen intactas hasta la autorización futura; no se propone cómo sortearlas.
3. **Precios: diferencia con comportamiento documentado.** La confirmación bajo costo del registro histórico no cumple el nuevo bloqueo solicitado. Se registra como cambio futuro deliberado, no como conflicto que deba resolverse alterando ahora ese antecedente o el código. No se encontró en las reglas revisadas un techo de negocio para subir el precio que deba retirarse.

No se modificaron código, datos, permisos, configuración ni servicios.