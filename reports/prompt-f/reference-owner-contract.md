# Prompt F reference-owner contract handoff

See `reports/prompt-f/audit-identity-handoff.md` for the strict audit
identity predicate, server-resolved audit route, and future-writer payload
requirements.

This backend change keeps existing document references and routes intact, but
adds the owner metadata required to build client-scoped credit links. The API
contract owner should add these properties to the OpenAPI schemas and regenerate
the API types; this handoff intentionally does not edit the specification.

## `AuditoriaEntry` and `AuditoriaDetail`

Add the following optional, nullable property:

```yaml
clienteId:
  type: ["number", "null"]
  description: >
    Owner client ID only when entidad is movimientos_credito and the live
    movement matches the complete stored audit identity; null means unresolved.
```

The property is emitted for `entidad: movimientos_credito` in list, detail, and
export responses. It is `null` when the live movement is missing, the audit
payload lacks any of `clienteId`, `tipo`, `createdAt`, or `importe`, or one of
those values does not match the live row. Other audit entities do not need the
property.

The same audit entry should expose:

```yaml
documentoRuta:
  type: ["string", "null"]
  description: >
    Shared server-resolved client movement route for a verified
    movimientos_credito reference; null when clienteId is unresolved.
```

The backend never derives this value from `auditoria.id` or
`auditoria.entidadId` alone. It validates the entity ID plus client, type,
created-at timestamp, and amount from retained audit payload data against the
live `movimientos_credito` row. No client name, count, or other client data is
returned.

## `MovimientoRow` (rollo/kardex history)

Add the following optional, nullable property:

```yaml
documentoClienteId:
  type: ["number", "null"]
  description: >
    Owner client ID for a live MOVIMIENTO_CREDITO document reference; null for
    other document types or when the referenced movement cannot be resolved.
```

For `MOVIMIENTO_CREDITO`, the shared resolver uses this ID to produce the
existing client-scoped movement route:
`/clientes/{clienteId}/movimientos/{movimientoId}`. Existing
`documentoTipo`, `documentoId`, `documentoEtiqueta`, `documentoRuta`, ticket,
entrada, salida, cancellation, location, and permission behavior is unchanged.
The movement detail endpoint remains the authority for client/permission
checks; this field exposes only the numeric owner ID needed for navigation.
