# Parte 6 — Notas de crédito y aplicación de abonos

Fecha de validación: 27 de agosto de 2026
Resultado: **APROBADO**

## Alcance completado

1. Las ventas a crédito imprimen una nota de crédito en dos copias de `216 × 140 mm`: la interna incluye QR y la del cliente no.
2. Cobros incluye Cartera, búsqueda y escaneo de notas, resaltado del documento encontrado y acceso sujeto a permisos financieros.
3. Los abonos de cliente exigen vista previa, se aplican FIFO y registran forma de pago y cuenta destino coherentes.
4. Nota y abono ofrecen detalle bidireccional; los estados PENDIENTE, PARCIAL y PAGADA se derivan del saldo.
5. Los pagos a proveedor reutilizan el mismo motor FIFO, admiten saldo a favor y ofrecen detalle compra↔pago.
6. Los reversos de cliente y proveedor son movimientos inversos enlazados. No borran ni actualizan movimientos o aplicaciones.
7. Se endurecieron carreras, reconciliación histórica, límites monetarios, serialización de contratos y presentación de reversos.

## Reglas contables verificadas

- `movimientos_credito` y `pagos_proveedor`, junto con sus relaciones de aplicación append-only, son la evidencia contable.
- Ningún abono o pago nuevo se dirige a una nota o compra concreta; se reparte desde la obligación más antigua.
- El sobrante pasa a la siguiente obligación y, al terminar, queda como saldo a favor.
- Una aplicación deja de contar en el saldo cuando su pago tiene un movimiento REVERSO, pero permanece visible como evidencia.
- Un pago revertido no vuelve a ofrecer la acción de reverso.
- Cliente y proveedor comparten el asignador FIFO; no existe una segunda implementación paralela.
- Venta a crédito y abono de cliente comparten bloqueo advisory por cliente para evitar carreras de saldo.
- EFECTIVO de cliente usa `CAJA_FISICA`; TRANSFERENCIA usa `CUENTA_FISCAL` o `CUENTA_NO_FISCAL`.
- La antigüedad parte de la fecha de vencimiento en calendario local.
- La primera impresión automática no cuenta como reimpresión; una reimpresión manual se audita antes de imprimir.

## Compatibilidad histórica

- Los pagos proveedor históricos con `entrada_id` se materializan una sola vez como aplicaciones append-only.
- La reconciliación es idempotente.
- Después de reconciliar, las aplicaciones activas son la única distribución contable; no queda un fallback que vuelva a dirigir pagos nuevos por `entrada_id`.
- El orden de arranque asegura primero el esquema de movimientos proveedor y después las aplicaciones y reconciliación.

## Hallazgos corregidos durante E2E

- El estado de cuenta de cliente no proyectaba `cuenta_destino` desde su CTE.
- El contrato de una aplicación de cliente eliminaba `revertido` de la respuesta.
- El detalle proveedor confundía el `entradaId` público con el id interno del movimiento COMPRA.
- Los detalles proveedor entregaban filas SQL en snake_case en vez del contrato público camelCase.
- El detalle de compra no marcaba aplicaciones de pagos revertidos y seguía ofreciendo Reversar.
- El enum público de movimientos proveedor no admitía `REVERSO`, aunque el endpoint de reverso devolvía ese tipo.

Todos quedaron cubiertos por contratos o validación de respuesta, además del recorrido E2E.

## Aislamiento de datos

- Las escrituras de integración y navegador se ejecutaron exclusivamente en la rama Neon desechable `parte6-notas-credito-20260827` (`br-still-cake-ax7imi4a`).
- La base aislada fue `parte6_credit_test_20260827`.
- Antes de cada grupo de escrituras se confirmó `current_database() = parte6_credit_test_20260827`.
- Se comprobó que la URL temporal era distinta de `DATABASE_URL`.
- El proceso API usado por navegador reportó `database_class=temp`.
- No se crearon usuarios, sesiones, abonos, pagos, reversos ni fixtures de prueba en development.
- Al terminar se restauraron los workflows normales y se confirmó que la API ya no usaba la URL temporal.
- La rama desechable y todos sus datos fueron eliminados.

## E2E de navegador

Resultado: **success** contra la base temporal.

### Cliente

- Nota inicial por $1,000.00 localizada desde Cartera.
- Dos copias de impresión detectadas; QR solo en COPIA INTERNA.
- Vista previa de abono por $800.00: aplicado $800.00 y saldo $200.00.
- Después de confirmar: estado PARCIAL y saldo $200.00.
- Después de reversar: estado PENDIENTE y saldo $1,000.00.
- El historial conserva el abono con etiqueta REVERTIDO y sin segundo botón Reversar.

### Proveedor

- Compras iniciales por $400.00 y $300.00, ambas PENDIENTE.
- Vista previa de pago por $500.00: $400.00 a la compra antigua y $100.00 a la siguiente.
- Después de confirmar: primera compra PAGADA; segunda PARCIAL con saldo $200.00.
- Los detalles compra→pago y pago→compras muestran la relación bidireccional.
- Después de reversar: ambas compras PENDIENTE con saldos $400.00 y $300.00.
- La aplicación histórica aparece REVERTIDO y no ofrece una segunda reversión.

### Responsive

- En viewport `390 × 844` no hubo desbordamiento horizontal.

## Evidencia automática

- Contratos frontend: **37/37**.
- Suite backend relevante, incluidos PostgreSQL real, FIFO, detalles y reversos: **18/18**.
- Después del último ajuste contractual: contratos de reverso **5/5** e integración de reversos **1/1**.
- Typecheck global del workspace: aprobado.
- Build API: aprobado.
- Build frontend: aprobado.
- `git diff --check`: aprobado.
- Revisión arquitectónica final: **PASS**, sin bloqueadores ni hallazgos altos.
- Preview normal: login visible; workflows API y web en ejecución.

## Cierre

- La decisión contable solicitada quedó documentada en `replit.md`.
- Los workflows normales quedaron restaurados contra development.
- Los archivos adjuntos de alcance no fueron modificados, eliminados ni añadidos al commit.