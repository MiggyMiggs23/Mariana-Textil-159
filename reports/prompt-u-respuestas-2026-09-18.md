# Plan U — respuestas del propietario del 2026-09-18

Fuente: `attached_assets/Pasted-Solo-documentaci-n-No-toques-c-digo-no-escribas-en-la-b_1789785920886.txt`.

Alcance: solo documentación. Estas respuestas no acreditan implementación, migración de cuentas, activación de permisos ni cambios en la base. Los conflictos con reglas vigentes se registran abajo sin resolverlos.

## Respuestas textuales

P4 (E5). Si ADMIN rechaza el destino preparado, el dinero sigue esperando otra propuesta. Si el cliente pide que se le devuelva, aplica la regla vigente: importe completo nunca aplicado, solo ADMIN.

P5 (E5). Se permite autorizar una parte y dejar el resto esperando. Una propuesta puede abarcar varias notas del mismo cliente. El propietario acepta la consecuencia: la parte que quede después de una aplicación parcial ya no es devolvible, porque la devolución exige importe completo nunca aplicado.

P7 (E5). El dinero dirigido sin aplicar se destaca y se avisa a ADMIN a partir de 3 días desde su recepción.

P9 (E11). Esto cambia lo que decía el plan. ContadorF solo ve lo facturado: facturas, clientes facturados y ventas facturadas. Ya no ve las ventas no facturadas. Además tiene un botón para aceptar que las ventas facturadas cuadran con su registro externo. Puede aceptar por día si quiere, pero las semanas y los meses siempre deben quedar aceptados. Si no cuadra, marca "no cuadra" y se notifica a ADMIN para abrir una investigación. ContadorF no ve el Fondo ni los pagos a proveedor: el manejo fiscal del Fondo se lleva fuera del sistema. ContadorA queda como estaba en el plan.

P10 (E11). Todas las cuentas CONTADOR existentes pasan a ContadorF. El propietario asigna ContadorA a mano.

P12 (E12). Un pago o retiro que exceda el saldo registrado de caja o del Fondo se bloquea. ADMIN puede desbloquearlo con motivo obligatorio, y el desbloqueo queda en el historial.

P13 (E12). Un pago a proveedor que sale completo del Fondo no requiere turno de caja abierto. Si usa caja, esa parte sí requiere sesión abierta de Mariana.

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

P5 no cierra toda la pregunta 6: no decide por sí sola el procedimiento para una nota pagada durante la espera ni una eventual autorización de saldo a favor. No se extienden estas respuestas a las demás preguntas no contestadas. No se inventan hora de corte del umbral, vencimientos de aceptación semanal/mensual ni una aprobación diaria obligatoria.

## Conflictos con reglas vigentes de replit.md — sin resolver

### P9 y P10 frente al perfil CONTADOR vigente

En «Roles SISTEMAS y CONTADOR», la regla actual dice: «CONTADOR ve todo lo financiero» y «Conserva sus permisos de pagos a proveedores». También conserva `crear` en `cobros_pagos` y `proveedores_finanzas`. En «Decisión provisional de Control operativo por costo (2026-09-15)» se preservan Cuentas destino y las consultas de caja autorizadas.

La combinación de migrar todas las cuentas actuales a ContadorF y limitar ese perfil a lo facturado, sin pagos a proveedor, entra en tensión con esa amplitud de acceso vigente. Se informa el conflicto; no se decide aquí qué reglas operativas retirar, cómo remapear permisos u overrides ni qué accesos actuales conservar. La sustitución expresa del alcance de ContadorF en el plan no se presenta como modificación ejecutada del perfil CONTADOR actual.

### P12 frente al límite de retiros de E10

En «Reglas canónicas de E10» se establece: «Un retiro ordinario no puede exceder el saldo disponible». P12 introduce un desbloqueo ADMIN para pagos o retiros que excedan el saldo de caja o Fondo.

Se registra la respuesta, pero no se decide si esa excepción sustituye la prohibición vigente de E10 o requiere una categoría distinta. La regla vigente se conserva señalada como conflicto pendiente, sin habilitar la excepción.

### Límites que no constituyen conflictos adicionales

- P4/P5 conservan devolución íntegra nunca aplicada, solo ADMIN; no habilitan devoluciones parciales.
- P9 conserva la exclusividad ADMIN del Fondo y retira del plan la conciliación de proveedor por ContadorF, en lugar de abrirle datos del Fondo.
- P13 mantiene la exclusividad de Mariana para proveedores; no autoriza usar caja de otro sitio.
- P12 trata saldo de caja/Fondo, no el límite de crédito del cliente. No modifica la prohibición de override del límite de crédito.
- Que E5/E11/E12 no estén implementados o habilitados no es, por sí solo, un conflicto de reglas.

No se modificaron código, datos, permisos, configuración ni servicios.