# Prompt F — Navigation payload handoff

The frontend navigation is deliberately fail-closed for audited credit
movements. The current audit list/detail contract exposes `entidad` and
`entidadId`, but does not expose the owning `clienteId`. An
`/clientes/:id/movimientos/:movimientoId` URL cannot be constructed safely from
those two fields alone.

The backend read path that serves the audit history must append the owner from
`movimientos_credito.cliente_id` for `entidad = 'movimientos_credito'` (and
preserve the existing permission/scope predicates). It must not default to a
client such as `1`. The frontend accepts `clienteId` (or the existing
projection alias `entidadClienteId`) when present and renders no movement link
when it is absent.

The roll-history document resolver has the same requirement for a
`MOVIMIENTO_CREDITO` reference: resolve the route only after a read query has
established the movement's owning client. A missing owner must remain an
unresolved reference rather than becoming a guessed client route.