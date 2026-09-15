# Bloque 5 — Abono en la autorización de nota

Fecha: 2026-09-15. **Propuesta entregada; no implementada.**

## Recomendación: distinguir FIFO normal de una excepción

### Sin deuda elegible más antigua

Permitir un abono en la misma ventana de autorización, después de descontar
el saldo a favor aplicado automáticamente. Bajo el candado del cliente,
comprobar que la nueva nota sea el primer cargo pendiente elegible.

En ese caso FIFO produce exactamente el destino pedido: el abono es normal,
no una excepción. Registrar el movimiento, el reparto y una auditoría
`ABONO_AL_AUTORIZAR` con la relación a la nota, actor y motivo. No obligar a una
solicitud/aprobación separada para una operación que ya autorizan los permisos
de la caja. Tampoco registrarla engañosamente como excepción a FIFO.

Si el favor automático liquida la nota, no crear otro ABONO. Para este flujo
inicial, limitar el abono al pendiente resultante; recibir un excedente sería
una decisión adicional, no un comportamiento implícito de esta propuesta.

### Con deuda elegible más antigua

No permitir el atajo: mostrar la deuda anterior y usar el flujo completo de
pago dirigido ya existente. Autorizar una nota no concede por sí mismo
permiso para aprobar una excepción a FIFO.

La solicitud conserva el movimiento de venta exacto como destino. Un actor
con autorización real puede aprobar conforme a la política existente;
actualmente la aprobación del endpoint está restringida a ADMIN.
Si ya tiene ese permiso, se puede reutilizar la aprobación inmediata existente.
No relajar globalmente ese permiso para los demás cajeros.

Una solicitud pendiente no crea un ingreso ni un recibo de dinero cobrado.
La interfaz debe distinguir solicitar autorización de recibir el dinero.
La alternativa de permitir que cualquier caja apruebe su propia excepción
requeriría otra decisión explícita del propietario.

## Cómo reutilizar lo existente

- Extraer/reutilizar los servicios transaccionales de validación del documento,
  bloqueo, registro del abono, reparto y auditoría de
  `artifacts/api-server/src/routes/pagos-dirigidos.ts`, junto con los servicios
  de abono normal. No hacer llamadas HTTP entre handlers dentro de la operación.
- Mantener un modo FIFO normal para el caso sin deuda anterior. Insertar una
  solicitud dirigida APROBADA para ese caso fijaría un destino en el proyector;
  no usar ese truco mientras se afirma que el pago es FIFO normal.
- Para la verdadera excepción, conservar `solicitudes_pago_dirigido`,
  solicitante, aprobador, motivo, estado y vínculo al movimiento exacto.
  Esa operación sí aparece en el histórico y Reportes de excepciones.
- Conservar `movimientos_credito` como fuente de saldo y
  `aplicaciones_credito` como evidencia append-only del reparto.

## Endpoints, contratos y archivos

Puntos existentes:

- `GET /tickets/{id}/autorizar`: proyección de autorización.
- `POST /tickets/{id}/autorizar`: autorización transaccional.
- `POST /clientes/{id}/pagos` y su vista previa: abono FIFO normal.
- `POST /pagos-dirigidos`: solicitud y aprobación inmediata cuando los
  permisos existentes la permiten.
- `POST /pagos-dirigidos/{id}/aprobar` y `/rechazar`: resolución de excepciones.
- `GET /pagos-dirigidos`: consulta del histórico.

Cambios futuros propuestos:

1. Extender la proyección y la operación de autorización con un objeto de
   abono opcional, o añadir una operación explícita combinada. Debe ser una
   sola transacción, no dos solicitudes independientes desde el navegador.
2. Modificar `artifacts/api-server/src/routes/pos.ts`,
   `src/lib/pos.ts`, los servicios extraídos de `routes/clientes.ts` y
   `routes/pagos-dirigidos.ts`.
3. Extender `lib/api-spec/openapi.yaml` y regenerar cliente/Zod.
   Los contratos de autorización a extender serían `AutorizarNotaInput`
   y `AutorizacionNotaProyeccion`, de las operaciones `autorizarNota` y
   `obtenerProyeccionAutorizacionNota`. El objeto de abono contendría importe,
   forma de pago, cuenta destino, fecha efectiva, referencia/notas, motivo
   y clave idempotente; actor, sitio y sesión se validarían en el servidor,
   no se aceptarían como atribución libre del navegador.
   Reutilizar los contratos `SolicitudPagoDirigidoInput`,
   `SolicitudPagoDirigido`, `SolicitudPagoDirigidoAplicada` cuando corresponda
   una excepción real, no para disfrazar un pago normal.
4. Integrar la captura en `artifacts/mariana-textil/src/pages/cobros.tsx`,
   reutilizando selección de destino y fechas de `cliente-pago-dialog.tsx`
   y el flujo de `solicitud-pago-dirigido-dialog.tsx`.
5. Conservar los enlaces de `directed-payment-history.tsx`,
   `pages/pagos-dirigidos.tsx`, auditoría y los reportes de pagos dirigidos.

## Transacción e idempotencia

La operación debe adquirir el candado de crédito del cliente y bloquear la
nota. Bajo esos candados debe volver a comprobar permisos, deuda anterior,
favor automático, límite duro, pendiente de la nota, sesión de caja y destino.

Solo después se registran autorización, cargo, ABONO, aplicaciones y auditoría.
Un error revierte la operación entera. Incorporar una clave idempotente única
para que doble clic o reintento no creen dos abonos.

## Caja, cuenta, sitio y corte

- Para efectivo, exigir una sesión abierta en el sitio permitido. Elegir
  `CAJA_FISICA` no sustituye esa validación.
- Guardar la identidad de la sesión y del sitio que recibió el dinero. No
  deducir después el sitio de recepción desde la nota a la que se aplicó.
- Para transferencia, conservar destino y referencia, sin asignar efectivo
  ficticio a caja.
- Usar fecha efectiva con hora y desplazamiento explícitos y respetar las
  reglas del día operativo y del corte.
- El ingreso nuevo debe contarse una vez; la aplicación de favor previo, cero
  veces como ingreso nuevo.
- **Dependencia pendiente:** existen divergencias previamente diagnosticadas
  entre Cobrado principal, Cuentas Destino y atribución por sitio. Esta
  propuesta no las corrige ni promete que las cifras actuales ya concilien.
  Deben resolverse antes de aprobar el flujo combinado como completo para caja.

## Pruebas que requeriría

1. Sin deuda anterior: abono aplicado a la nueva nota por FIFO normal, con
   saldos por nota y favor exactos, sin falsa excepción.
2. Con deuda anterior: atajo bloqueado; solicitud dirigida y autorización
   conforme al permiso existente, sin autoescalamiento.
3. Favor suficiente, insuficiente y agotado; ningún ABONO artificial al
   liquidar con dinero que ya había entrado.
4. Dos autorizaciones simultáneas y reintentos: un solo ingreso y evidencia
   consistente.
5. Sesión abierta/cerrada, sitio correcto/incorrecto, efectivo/transferencia,
   cuenta válida/ausente y corte por fecha local.
6. Operación fallida: sin autorización parcial ni ingreso huérfano.
7. Histórico: solicitante, aprobador, motivo y vínculo consultables; pendientes
   excluidos de ingresos; excepciones reales visibles en Reportes.

Estas pruebas son una propuesta de cobertura, no verificaciones ejecutadas.
Las suites que crean usuarios o sesiones en development permanecen bloqueadas.