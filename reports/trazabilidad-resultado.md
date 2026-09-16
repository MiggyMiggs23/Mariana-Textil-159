# Trazabilidad A + B — resultado

Fecha local: 2026-09-15, Ciudad de México.

## Alcance

Implementados A + B y la precisión de la regla en `replit.md`. El Bloque 0 se comunicó con fragmentos textuales antes de editar; queda reproducido en `reports/trazabilidad-bloque-0.md`.

**No se crearon pantallas ni rutas nuevas de categoría C.** No se ejecutaron pagos, abonos, reversos, cierres ni consultas SQL manuales. No se modificaron predicados financieros, reglas de cobro, impresión, permisos ni esquemas de DB. El arranque normal de la API sí ejecutó sus inicializadores existentes; no se afirma conservación de DB basada únicamente en pruebas de código.

## Cambios por caso

| Caso | Resultado |
|---|---|
| A1, historial de rollo | Enlace mediante `documentoRuta`/`documentoEtiqueta` resueltos por backend. Se conserva la referencia original como texto cuando no es resoluble, sin fabricar un href. |
| A2, corte | Los folios de Tickets Cobrados enlazan por `ticketId`. No se cambió el cálculo ni se creó detalle nuevo de corte. |
| A3, series de ticket/nota | «Ver rollos» enlaza las series con `rolloId` real. Las líneas sin ID quedan sin enlace. No se cambiaron agrupación ni documentos impresos. |
| A4, Ver Reparto | Cada nota enlaza por `asig.ticketId`. Un clic primario normal cierra el reparto; clics modificados o de nueva pestaña conservan el diálogo actual. |
| A5, cartera | Acceso al estado de cuenta por `clienteId` + `movimientoId`, y al ticket mediante su ID real cuando existe. |
| A6, Movimientos | Referencias documentales enlazadas en las representaciones desktop/mobile; se conservan los enlaces de ticket existentes y su retorno, sin anidar anclas. |
| Serie en Ajustes | Enlace al rollo existente, no a un detalle nuevo del ajuste. |
| Producto en Conciliación | Enlace por `productoId` al producto existente, no a una nueva pantalla de discrepancia. |
| B1, AdminAlertaCredito | `ticketId` nullable añadido a OpenAPI, generados y productores, obtenido de la relación real del movimiento; consumido en Cobros y Alertas. |
| B2, documentoId | Los productores revisados usan IDs, pero el historial necesitaba resolución: se añadieron campos de navegación y enriquecimiento por lotes. |
| B3, rolloId | Ya existía en contrato y respuesta; no se añadió un campo duplicado. |
| Regla documental | Varios identificadores de entidades distintas pueden enlazar desde un renglón. Se mantiene la prohibición de columnas decorativas y de rutas construidas desde folios. |

## Identidad y divergencias atendidas

1. **Entrada histórica:** se retiró del enriquecimiento afectado el lookup ambiguo ID-o-folio. Para recepciones se usa la relación estable `rollos.recepcionId`; no se deduce una entrada por coincidencia numérica.
2. **Cancelaciones:** el movimiento original debe pertenecer al mismo rollo antes de heredar cualquier documento. Identidad ausente o incompatible deja la referencia sin ruta.
3. **Venta metreada:** `TICKET_METRO_METREADO` tiene un ticket real y una ruta existente. Se reconoció en una clasificación de navegación separada, sin ampliar las listas usadas por filtros/cálculos.
4. **Recepción de Salida:** el resolver antiguo apuntaba a `/salidas/:id/documento/recepcion`, inexistente. Se utiliza `/salidas/:id`, comprobando el ID existente. No se creó la pantalla faltante.
5. **Tipos desconocidos / referencias incompletas:** quedan sin enlace; no se fuerzan hacia una entidad parecida.

## Categoría C detenida

No se construyeron detalles individuales de movimiento de crédito, ajuste, corte, evento de bitácora, auditoría de inventario, salida de dinero, pago a proveedor, reimpresión ni discrepancia de conciliación. Tampoco se implementó una nueva resolución de entidades de bitácora dentro del caso C4 del inventario. Los accesos a documentos, rollos, productos y estado de cuenta ya existentes no equivalen a esos detalles nuevos.

## Verificación y límites

- **Codegen:** ejecutado una vez tras actualizar el contrato; incluyó el chequeo de bibliotecas.
- **Backend, pruebas focales puras:** 3/3, cubriendo IDs distintos de folios, colisiones, referencias sin relación, recepción de Salida hacia ruta existente y cancelación con rollo incompatible. Evidencia: `reports/trazabilidad-pruebas-backend-final.txt`.
- **Frontend, render/contratos:** 9/9 tras corregir el arnés de pruebas para JSX y assets. Evidencia: `reports/trazabilidad-pruebas-ui-corregidas.txt`.
- **Confirmación del fallback final:** 3/3 de los mismos casos de referencia, después de preservar la referencia original como texto. No se suman como tres casos adicionales. Evidencia: `reports/trazabilidad-referencias-no-resueltas-cierre.txt`.
- **Build frontend:** aprobado; `reports/trazabilidad-build.txt`.
- **Build backend:** aprobado; `reports/trazabilidad-build-backend.txt`. El arranque final volvió a compilar el backend actualizado correctamente.
- **Typecheck completo sin detenerse en el primer paquete:** conserva cuatro diagnósticos únicos preexistentes, no nuevos: `pos.ts` (`toISOString` sobre `never`), propiedad duplicada en `routes/clientes.ts` y dos usos de `pendiente` en Alertas. Los errores de API se repiten en scripts, no son errores únicos adicionales. Evidencia: `reports/trazabilidad-typecheck-final.txt`; la última comprobación backend conserva solo los dos conocidos en `reports/trazabilidad-typecheck-backend-cierre.txt`.
- **Fallo previo no corregido:** la suite completa de `kardex-sale-documents.contract.test.ts` contiene una aserción estática rígida sobre `salidas.ts` que falla. No se modificó para obtener un verde; los resultados del backend citados son focales, no aprobación de toda esa suite.
- **Arranque:** ambos workflows quedaron RUNNING. Se conservó el warning conocido de propiedad duplicada; no se declaró un typecheck limpio.
- **Vista previa:** `reports/trazabilidad-vista-previa.jpg` muestra login y respuestas 401 sin sesión. Confirma que la app carga, **no** una verificación visual autenticada de los nuevos enlaces.
- **Límite:** no hubo E2E autenticada ni consulta de datos reales para acreditar cada referencia histórica. Las pruebas son de identidad, render y contrato con datos controlados, no una operación financiera real.

Las salidas iniciales fallidas del arnés se conservaron. No se confunde un comando terminado con una prueba aprobada: el estado final se basa en los conteos y errores leídos.