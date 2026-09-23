# Tanda E · tarea 3 · navegación de cifras E3/E4/E7/E9/remate

Fecha: 2026-09-23.

## Alcance y reglas aplicadas

Auditoría de las superficies nuevas E3, E4, E7, E9 y remate, sin abrir gates, cambiar reglas de negocio, escribir en base, tocar workflows/builds ni ejecutar la aplicación. Se aplicaron `replit.md` (en especial identidad de navegación, documento desde folio y cifra → detalle → documento), `reference-navigation-review`, `cross-location-read-authorization`, `financial-boundary-enablement` y la guía React/Vite.

Reglas de implementación:

- sólo IDs internos o `href` entregados por el servidor;
- nunca se construye una ruta con folio, serie, índice visual o UUID opaco cuyo destino no esté contratado;
- un enlace se muestra únicamente cuando la ruta existente y su permiso coinciden;
- la revisión multi-sitio E7/E9 no amplía helpers de mutación;
- E9 documental no enlaza Fondo ni habilita ingreso; E7 sigue siendo lectura y no habilita E5;
- una relación estable existente se incorpora al contrato y se enlaza; sólo la ausencia real de identidad documental o un acceso E5 expresamente vedado permanece bloqueada, sin disfrazarse con un enlace falso.

## Inventario completo de superficies y cifras

| Superficie | Cifras / identificadores visibles | Camino de detalle y documento | Dictamen |
|---|---|---|---|
| E3 · diálogo de abono de Caja/cliente | importe a aplicar; por nota: folio, saldo anterior, aplicado y saldo posterior; remanente/favor; importe confirmado; folio de recibo | El diálogo ya es el desglose. **Corregido:** cada nota con `ticketId + folio` abre `/tickets/:ticketId`; tras confirmar, el folio E3 abre `/recibos-e3/:folio`. Sin `ticketId` no se enlaza. | **FIXED** |
| E3 · recaptura histórica | importe registrado, favor generado, remanente, aplicado por nota y folio | **Corregido:** cada folio con `ticketId` abre el Ticket/Nota real. El resultado durable reaparece en la lista de recibos del cliente. | **FIXED** |
| E3 · ficha de cliente | lista de recibos y sus folios | Ya enlazaba por folio a `/recibos-e3/:folio`; acceso E3 permanece ADMIN. | **PASS** |
| E3 · detalle de movimiento de cliente | importe, reparto, saldos, folios de notas y folio de recibo | Ya abre Nota/Ticket mediante `ticketId` y recibo E3 mediante folio; la ruta exige `clientes_finanzas:ver`. | **PASS** |
| E3 · detalle de corte | importe y folio de cada recibo E3 de la sesión | La tarjeta completa ya abre `/recibos-e3/:folio`; consulta/listado sólo se monta para ADMIN. | **PASS** |
| E3 · recibo A5 / pantalla de recibo | total, saldos, aplicado y folios de notas; movimiento de crédito | **Corregido:** notas con `ticketId` abren `/tickets/:id`; la pantalla ofrece el detalle real `/clientes/:clienteId/movimientos/:movimientoId`, desde donde el folio documental abre la Nota/Ticket. | **FIXED** |
| E4 · captura y registro dentro de Caja/corte | monto capturado, saldo de Caja consultado, monto de salida, saldo antes/egreso del desbloqueo; versión/usuario de revisión | **Corregido:** monto de salida y cifras del desbloqueo abren `/caja/cortes?sesionId=:sesionId`, usando la identidad estable de la sesión y sólo con `cortes:ver`. El corte es el documento canónico que ya contiene el egreso y su historial; no se inventa folio E4. | **FIXED** |
| E7 · atribución en Cuentas Destino y Tiempo real | Cobranza del periodo, recepciones físicas, aplicaciones; totales del puente; importes de movimientos; total/importes retenidos y antigüedad | **Corregido:** cada total es un `details` accionable que abre sus filas constitutivas. OpenAPI y backend ahora entregan `detailHref` y `documentHref` explícitos, derivados de relaciones `ticket_id`, `cliente_id` y movimiento; POS abre Ticket, ledger/aplicación abre movimiento de cliente y su folio abre el Ticket exacto. La UI sólo acepta patrones de rutas contratados, no analiza prefijos de ID. | **FIXED** para POS/ledger/aplicaciones |
| E7 · estado de cuenta financiero del cliente | cuatro cifras globales; movimientos; saldo pendiente de nota; retenidos | **Corregido:** cada cifra global abre el detalle de movimientos bajo el alcance autorizado. Importes usan `detailHref` de backend y folios usan `documentHref`; el frontend verifica además que la ruta de movimiento pertenezca al cliente mostrado. | **FIXED** para relaciones documentales existentes |
| E7 · PDF/XLSX/Imprimir | mismas cifras de resumen, movimientos y retenidos | Fuera del alcance de pantallas indicado para tarea 3; no se expandió. | **OUT OF SCOPE** |
| E9 · lista de entregas | número de corte e importe enviado | **Corregido:** ambos abren el detalle E9 con el `E9Entrega.id` real; se eliminó el control redundante “Ver detalle”. | **FIXED** |
| E9 · detalle de entrega/conteos/investigación | enviado, recibido, diferencia, versión y número de corte | **Corregido:** enviado, recibido, diferencia y número de corte abren el corte exacto sólo si `corteHref` cumple `/caja/cortes?...`; la autorización GET conserva el sitio. No enlaza Fondo. | **FIXED** |
| E9 · envío desde corte y confirmación | total físico congelado, número de corte e importe enviado | La captura ocurre dentro del detalle real del corte. **Corregido:** después de guardar, el número de corte usa el `corteHref` validado entregado por API. | **FIXED** |
| E9 · documento canónico | E9 tiene UUID de entrega y corte relacionado | El documento canónico existente es el corte, alcanzable mediante `corteHref`; no se inventó folio E9 ni se convirtió `corteId` en uno. | **PASS** |
| Remate · detalle de rollo | ID de rollo y estado marcado/no marcado | Ya es `/inventario/rollos/:id`; acciones se condicionan al permiso configurable `marcar_remate:autorizar`, retiro a ADMIN. | **PASS** |
| Remate · señal histórica en Ticket/Nota | IDs de rollos de remate y todas las cifras del documento de venta | El Ticket/Nota ya es el detalle documental abierto por su ID y folio. **Corregido:** cada ID de rollo abre `/inventario/rollos/:id` sólo si el actor tiene `inventario:ver`; para CONTADOR u otro lector documental sin inventario queda texto, no enlace inaccesible. | **FIXED** |

## Bloqueos genuinos restantes

1. **E7 E5/retenidos:** `cobroId` es una identidad E5, pero no existe una ruta GET documental permitida para los lectores ADMIN/SISTEMAS de atribución sin cruzar el gate/perfil E5. Backend devuelve explícitamente `detailHref: null` y `documentHref: null`; abrirlo requeriría una capacidad GET E5 nueva y no puede habilitarse implícitamente en esta tarea.
2. **E7 registros históricos sin Ticket:** filas de migración sin relación `ticket_id` conservan su detalle de movimiento de cliente cuando éste existe, pero no pueden fabricar documento. Es una carencia genuina de identidad documental histórica.

## Cobertura enfocada agregada

Se amplió `src/components/e7-release.contract.test.ts` para fijar:

- que E7 sólo acepta el `detailHref` explícito del backend cuando coincide exactamente con el cliente mostrado;
- que usa `documentHref` explícito y nunca el folio como ID de Ticket;
- que E3 exige `ticketId + folio`;
- que E9 usa el ID de entrega y valida `corteHref`;
- que remate sólo ofrece el destino de rollo bajo `inventario:ver`;
- que E4 sólo muestra el enlace de corte bajo `cortes:ver`.

## Verificación realizada y límites

- `git diff --check`: sin errores.
- Codegen OpenAPI + typecheck de librerías: PASS.
- Test unitario backend E7 enfocado: 16/16 PASS.
- Contrato frontend de navegación: 4/4 PASS.
- Typecheck `@workspace/api-server`: PASS.
- Typecheck `@workspace/mariana-textil`: PASS.
- Suite enfocada E4 (`test:e4-cash-out`): PASS.
- Las suites DOM E4/E9 no pueden ejecutarse directamente con el runner genérico porque Node intenta importar el PNG estático del layout; esta limitación preexistente del harness no se presentó como fallo funcional. E9 conserva cobertura DOM de navegación exacta, ampliada para las tres cifras.
- Revisión estática de rutas existentes en `App.tsx`, contratos OpenAPI generados, permisos frontend y productores E7/E9.
- No se ejecutaron app, workflows, builds, DB, SQL ni red.
- No se cambiaron gates, permisos por defecto, reglas financieras, API/DB ni configuración de build.

## Archivos tocados

- `artifacts/mariana-textil/src/components/cliente-pago-dialog.tsx`
- `artifacts/mariana-textil/src/components/cliente-e3-recaptura-dialog.tsx`
- `artifacts/mariana-textil/src/pages/caja/recibo-e3.tsx`
- `artifacts/mariana-textil/src/components/e7-readers.tsx`
- `artifacts/mariana-textil/src/components/e9-entregas-panel.tsx`
- `artifacts/mariana-textil/src/components/e9-envio-panel.tsx`
- `artifacts/mariana-textil/src/pages/ticket-detail.tsx`
- `artifacts/mariana-textil/src/components/e7-release.contract.test.ts`
- `artifacts/api-server/src/lib/e7-read-model.ts`
- `artifacts/api-server/src/lib/e7.test.ts`
- `lib/api-spec/openapi.yaml` y salidas generadas de API/Zod
- `artifacts/mariana-textil/src/components/salidas-dinero-e4-panel.tsx`
- `artifacts/mariana-textil/src/components/salidas-dinero-e4-item.tsx`
- `artifacts/mariana-textil/src/components/e9-node.dom.test.tsx`
- `reports/tanda-e-20260923/tarea-3.md`

Sin commit; MAIN separa la entrega. Tarea 4 puede reubicar su auditoría de color contra estas líneas finales.