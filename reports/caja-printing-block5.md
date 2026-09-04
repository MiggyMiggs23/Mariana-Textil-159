# Auditoría de impresión en Caja — Bloque 5

- Se retiró el disparo automático que navegaba a `tickets/:id?print=3` después de Cobrar. Era impresión de documento de venta desde Caja.
- Se retiró el control y disparo `print-hoja-ventas`. Era otra impresión localizada en Caja y no es el corte; conforme a la regla se reporta y no se conserva.
- Se conserva exclusivamente `print-corte` y sus controles de **Imprimir Corte**, porque el corte de caja es la excepción expresa.
- La autorización de Notas no dispara impresión.