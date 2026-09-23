# 09 — Devolución de mercancía: ausencia del flujo y alternativas

## Dictamen y límites

Revisión exclusivamente estática, sin base, red, scripts ni ejecución. **No se encontró un flujo operativo específico para recibir mercancía devuelta por un cliente y vincularla a la venta original conservando esa venta como hecho histórico.** Es una conclusión sobre los productores/rutas revisados, no sobre la existencia de datos históricos ni sobre mercancía real recibida.

Se revisaron las rutas de inventario, POS, salidas, clientes, devoluciones de crédito y E5; productores del motor de inventario; cancelación de tickets y consumos; enum y esquema de movimientos. `DEVOLUCION` está declarado como retorno de cliente (`lib/db/src/schema/enums.ts:66-80`), pero la búsqueda en `artifacts/api-server/src` no encontró productor actual de ese tipo para inventario. La existencia de un enum no demuestra un proceso implementado.

Referencias abreviadas `inventario.ts`, `pos.ts`, `supplier-trace.ts`, `credit-refund.ts`, `e5.ts` corresponden a `artifacts/api-server/src/lib/`.

## Tres conceptos diferentes

| Concepto | Evidencia y efecto real |
|---|---|
| Retorno de **mercancía** | Debería identificar rollo/pieza, metros retornados, condición física, sitio/piso receptor y venta de origen. No se encontró ese productor dedicado. No se obtiene por declarar DEVOLUCION en el enum. |
| E2 / `DEVOLUCION_FISICA` | Es devolución física de **dinero**, no de tela. `credit-refund.ts:66-111` exige prueba positiva de origen íntegro nunca aplicado y mantiene el gate de captura; `115-132` registra reverso financiero y salida de dinero de caja, no recepción de rollo. `artifacts/api-server/src/lib/credit-evidence-contract.ts:115-134` conserva el control de permiso de devolución de efectivo. |
| E5 / devolver cobro | Ruta `artifacts/api-server/src/routes/e5.ts:96-97`; `e5.ts:278-285` admite solo total íntegro nunca aplicado, marca el cobro DEVUELTO y guarda su devolución financiera. **Rechaza si alguna vez se aplicó, si tiene aplicaciones, si el pendiente difiere del recibido o si ya se devolvió.** No es un retorno de inventario. |

Ejemplo financiero: devolver un cobro retenido de $500.00 íntegro y nunca aplicado no agrega ni 1.000 m a ningún rollo. Si esos $500.00 ya se aplicaron a una venta, **E5 no es una alternativa disponible**, ni aunque después se restituya un saldo. E2 también revisa aplicaciones históricas (`credit-refund.ts:84-98`): no es una puerta lateral para el caso rechazado.

## Qué hay actualmente y por qué no sustituye una devolución

1. **Activación:** solo PROGRAMADO→DISPONIBLE; VENDIDO, BAJA, tránsito y MOSTRADOR se rechazan con vías específicas (`inventario.ts:1331-1347`). R vendido de 50.000 m no puede volver por “activar”. Es una recepción inicial, no retorno del cliente.
2. **Cancelación documental:** `pos.ts:1486-1534` revierte todas las ventas del ticket y sus consumos, y `1616-1633` cancela ticket/salidas vinculadas. Es anular una operación, no registrar que una venta válida terminó con retorno parcial posterior. Además rechaza salidas ligadas entregadas (`pos.ts:1475,1655-1666`); no afirmar que una entrega real siempre puede devolverse cancelando el ticket.
3. **Reverso genérico:** las ventas de ticket exigen cancelación documental (`inventario.ts:2676-2684`). La inversa conserva sitio físico aunque el asiento vuelva al original (`2798-2819`). En VENTA tradicional METRO/KILO conserva cantidad; para `TICKET_METRO_METREADO` sí la repone (`2776-2796`). No es un receptor de mercancía con inspección, autorización y metraje recibido.
4. **Ajuste:** solo rollos DISPONIBLES/EN_TRANSITO (`inventario.ts:2267-2271`), registra diferencia o baja (`2274-2327`). Un aumento manual puede subir la cantidad de un remanente, pero no acredita por sí mismo una devolución de cliente ni resuelve precio, deuda, impuestos, cobro o trazabilidad comercial.
5. **Reactivación de faltante:** su productor es `REACTIVACION_FALTANTE` y usa la evidencia de una baja de auditoría (`inventario.ts:2528-2618`); no es mercancía vendida que vuelve. MOSTRADOR permanece terminal para el reverso (`2847-2854`). No ofrecer ninguno como atajo.

## Consecuencias concretas

**Venta completa.** R=50.000 m, vendido válidamente y entregado. El cliente devuelve físicamente los 50.000 a B. La aplicación no ofrece una recepción comercial dedicada para documentar ese nuevo hecho. Activar lo rechaza; cancelar puede estar bloqueado por entrega. Registrar un alta independiente sin vínculo corre el riesgo de perder venta de origen/costo; revertir una venta registrada en A no coloca automáticamente el rollo en B. Esto no prueba que haya ocurrido: describe el vacío funcional (`inventario.ts:1331-1347,2798-2819`; `pos.ts:1655-1666`).

**Venta parcial.** R=100.000 m en A; ticket vende 30.000, remanente=70.000 DISPONIBLE (`inventario.ts:2169-2189`). El cliente devuelve solo 10.000: la existencia física total debe aumentar a 80.000, y debe quedar acreditado que conserva 20.000 de la venta. Cancelar el ticket entero suma los 30.000 y produce 100.000, no 80.000 (`pos.ts:1521-1534`; `inventario.ts:2785-2795`). Si esos 10.000 son un corte separado, fusionarlos sin prueba con los 70.000 falsea además la identidad física del rollo.

**Remanente reubicado.** R=100.000 en A; venta de 50.000; remanente recibido en B; cancelación añade 50.000 a la fila en B y asiento +50.000 en A (`inventario.ts:2791-2819`). Resultado fila B=100.000, kardex A=50.000/B=50.000. Un verdadero retorno debería registrar dónde se reciben los metros devueltos, no heredar el sitio accidental del remanente. Véase `08-reversos.md`, caso 3.

**Dinero y trazabilidad.** `supplier-trace.ts:288-335` revierte consumos originales al cancelar; no recibe una porción retornada con su condición/costo. Aceptar físicamente 10.000 m tampoco demuestra automáticamente cuánto dinero se devuelve o qué deuda se reduce. Si el cobro ya fue aplicado, `e5.ts:279-280` bloquea su devolución E5; esa limitación requiere decisión de negocio y diseño financiero específico, no etiquetar el retorno como E5.

## Tres diseños coherentes — propuestas, no implementados

### 1. Retorno íntegro del mismo rollo, sin cortes

Documento específico de devolución vinculado a venta y línea, reservado a la identidad íntegra comprobable: R de 50.000 m vuelve completo, sin consumo posterior incompatible. Registrar +50.000 en el sitio receptor B y estado de inspección/aceptación definido por negocio; conservar venta original y procedencia. No usar CANCELACION como sinónimo del nuevo hecho. Si se reutiliza R, la cantidad anterior y su estado deben tratarse según el modo original de venta: una venta tradicional conserva 50.000 en la fila, mientras un consumo vaciado deja 0.000. No sumar automáticamente 50.000 a ambos casos.

Ventaja: identidad y costo de origen claros. Límite: no resuelve cortes ni devoluciones parciales. La resolución financiera debe distinguir reducción de deuda, obligación de reembolso o ausencia de dinero; para un cobro ya aplicado exige un flujo nuevo autorizado, no E5/E2 como atajo.

### 2. Retorno parcial como pieza/rollo derivado

Documento de retorno por porción vendida, con entidad física nueva vinculada al consumo original, cantidad devuelta acumulada y límites contra doble devolución. Ejemplo: venta 30.000 de R=100.000 deja R=70.000; vuelven 10.000 como R2 en B. Resultado R=70.000 en A + R2=10.000 en B, total 80.000. La venta original sigue acreditando 30.000 vendidos y su devolución acredita 10.000 retornados; no fingir que nunca se vendieron.

Conservar procedencia/costo de los consumos originales sin reasignar FIFO de ventas previas; definir prorrateo de descuentos, costo y eventual compensación financiera. No sumar el corte a R salvo reunificación física expresamente permitida y documentada. Ventaja: soporta cortes y sitio diferente. Costo: nueva identidad y modelo de trazabilidad/valoración.

### 3. Recepción en custodia y resolución posterior

Recibir mercancía en un documento/área no vendible mientras se acredita venta, cantidad, calidad y derecho al retorno. Ejemplo: llegan 10.000 m identificados como parte de la venta de 30.000; R sigue disponible en 70.000 y custodia registra 10.000 **sin agregarlos al disponible**. Tras aprobar, crear R2 disponible de 10.000 según diseño 2, o reintegrar íntegramente según diseño 1. Si se rechaza, documentar la entrega al cliente sin aparentar una venta nueva.

Requiere estados y responsabilidades explícitos; no se afirma que hoy exista ese estado de custodia. Ventaja: permite investigar históricos sin inventar procedencia ni contaminar disponible. La recepción física no promete automáticamente reembolso: una resolución financiera separada y enlazada autoriza deuda/compensación/dinero cuando corresponda.

**Controles comunes propuestos:** cantidades exactas con unidad, venta/línea/consumo original cuando sea demostrable, sitio y piso receptor, motivo, evidencia de recepción/inspección, autorización, idempotencia y máximo retornable neto. Revalidar al confirmar bajo el protocolo de candados existente: revisión de pantalla no congela existencias. Las memorias `normal-vs-fifo-locking.md`, `inventory-audit-concurrent-surplus.md` y `review-confirmation-freshness.md` son límites para un diseño posterior, no autorización para modificar concurrencia en esta tanda.

## Preguntas al propietario

1. ¿Se aceptan solo rollos íntegros cerrados o también cortes, metros parcialmente usados y mercancía dañada?
2. ¿El mismo rollo conserva identidad al volver? ¿Todo corte retornado debe generar una identidad derivada? ¿Se permite reunificar físicamente con un remanente?
3. ¿Puede recibirse en otro sitio y quién inspecciona/autoriza su disponibilidad? ¿Se necesita custodia no vendible?
4. ¿Qué evidencia exige una venta histórica sin consumo reconstruible? ¿Quién resuelve el caso sin inventar procedencia?
5. ¿La compensación será reducción de deuda, saldo comercial, cambio por mercancía o reembolso? Para dinero ya aplicado, ¿se autoriza diseñar una vía nueva con controles propios, sabiendo que E5/E2 no resuelven ese supuesto?
6. ¿Debe mantenerse la distinción estricta entre corregir una venta inexistente y registrar el retorno posterior de una venta válida? ¿Qué tratamiento de costos, descuentos y documentos comerciales se aprueba?