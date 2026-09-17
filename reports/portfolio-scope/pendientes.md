# Bloque 3 — otras lecturas financieras sin alcance

Inventario de código. Todos los endpoints listados son GET y tienen prefijo `/api/clientes`. No se modificaron en esta entrega. La protección de Cartera no protege automáticamente el directorio, la ficha ni las demás pestañas.

| Endpoint | Información económica | Consumidor |
| --- | --- | --- |
| `/clientes` (ruta completa `/api/clientes`) y `/:id` | Saldo actual, saldo a favor y límite global cuando el actor tiene permiso financiero | `pages/clientes.tsx`, directorio; `pages/cliente-detail.tsx`, ficha |
| `/analitica`, `/analitica.xlsx` | Ventas, costos, margen, concentración, riesgo y vencido | `pages/clientes.tsx`, pestaña de análisis y descarga |
| `/comportamiento-pago`, `/:id/comportamiento-pago` | Indicadores y evaluación de pago y riesgo de crédito | Listado y ficha del cliente |
| `/:id/credito` | Deuda, favor, crédito disponible, vencido y antigüedad | Ficha, pestaña Crédito |
| `/:id/estado-cuenta`, `/:id/estado-cuenta/imprimir`, `/:id/estado-cuenta.xlsx`, `/:id/estado-cuenta.pdf` | Movimientos, importes, saldos corridos/proyectados y pendientes | Ficha, estado de cuenta y exportaciones |
| `/:id/compras` | Importes de tickets, cantidades, costos/margen | Ficha, compras |
| `/:id/analitica` | Ventas por producto/periodo, margen, pagos e indicadores del cliente | Ficha, análisis |
| `/:id/estadisticas` | Compras, cantidades, costos y utilidad acumulada | Ficha, estadísticas |
| `/:id/pagos`, `/:id/pagos/:pagoId` | Abonos, importes, cuentas destino y detalle de movimientos | Ficha e historial/detalle de pagos |
| `/:id/notas/:ticketId`, `/:id/notas/:ticketId/reimprimir` | Importe, pendiente y aplicaciones de pago de una nota | `components/cliente-nota-credito.tsx`, detalle y reimpresión |

Fuente de rutas: `artifacts/api-server/src/routes/clientes.ts`. Consumidores bajo `artifacts/mariana-textil/src/`, con solicitudes adicionales en `lib/clientes-api.ts` y el cliente generado.

Las comprobaciones de permiso de módulo/acción no sustituyen la comprobación del sitio. En notas y pagos, comprobar la relación con el cliente tampoco autoriza el sitio.

Se excluyen de este inventario las rutas administrativas globales intencionales y el catálogo de precios negociados: no se equiparan automáticamente con cartera por sitio.

## Otros pendientes expresamente fuera del alcance

- Atribución de reversos de saldo a favor sin aplicar en cobranza por sitio: conservar la asimetría documentada, sin corregirla aquí.
- Corte de caja: sin cambios.
- Tablero de Clientes: no construido.
- Verificación autenticada: no sustituirla por pruebas aisladas ni crear usuarios/sesiones para aparentarla.