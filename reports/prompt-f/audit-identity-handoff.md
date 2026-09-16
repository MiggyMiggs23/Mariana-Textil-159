# Prompt F audit identity handoff

The audit UI now consumes the server-provided `documentoRuta` for
`entidad: movimientos_credito`; it no longer reconstructs a client movement
URL. The server obtains that URL from the shared Kardex document resolver, the
same resolver used by roll history.

## Backend/OpenAPI properties

The API contract owner should add these optional nullable properties and
regenerate the API types. This file intentionally does not edit OpenAPI.

```yaml
# AuditoriaEntry and AuditoriaDetail
clienteId:
  type: ["number", "null"]
  description: >
    Verified live owner for a movimientos_credito audit row; null when the
    movement is missing or strict retained identity is unavailable/mismatched.
documentoRuta:
  type: ["string", "null"]
  description: >
    Server-resolved client movement URL for a verified movimientos_credito
    audit row; null when clienteId is unresolved.
```

For a verified row, `documentoRuta` is exactly the shared resolver output:

`/clientes/{clienteId}/movimientos/{entidadId}`

Other audit entity routes and existing ticket/entrada/salida/cancellation
references remain unchanged.

## Strict identity required from future audit writers

`resolveAuditedCreditMovementOwner` and its exported predicate
`auditMatchesCreditMovementIdentity` intentionally fail closed. For a
movement-owned audit row, before linking the backend requires:

1. `entidad === "movimientos_credito"`;
2. `entidadId` equal to the live movement ID;
3. retained stored audit data containing `clienteId` (or `cliente_id`);
4. retained `tipo` equal to the live movement type;
5. retained `createdAt` (or `created_at`) exactly equal to the live
   `movimientos_credito.created_at` instant; and
6. retained `importe` equal to the live amount at cent precision.

The audit timestamp must not precede the live movement timestamp. An absent
live movement, old `REVERSAR_PAGO_CLIENTE` payload without these identity
fields, reused IDs, amount/type/client mismatches, or malformed identity all
produce `clienteId: null` and `documentoRuta: null`. No current historical
payload is rewritten and no owner is guessed from `auditoria.id` or
`entidadId`. The credit detail adapter applies the same predicate to
client-owned `PAGO_CLIENTE`/`AJUSTE_CREDITO` events only after their action,
client entity, and movement-id predicates pass; it normalizes the owner
resolver's navigation key without changing the stored audit entity.

## Future credit movement writer payloads

The detail reader also requires the existing event-specific predicate plus a
complete immutable movement snapshot before exposing capture evidence. The
snapshot must retain `id`, `clienteId`, `tipo`, exact stored `createdAt`, and
stored `importe`; an entity id, movement id field, amount, or assignment list
alone is not identity. Events without that snapshot return
`fechaCaptura: null` and do not produce `auditoria`.

Future `PAGO_CLIENTE` events keep their existing client-owned identity and add
this object to `datosDespues`:

```json
{
  "movimientoCreditoId": 123,
  "movimiento": {
    "id": 123,
    "clienteId": 7,
    "tipo": "ABONO",
    "createdAt": "2026-09-15T15:00:00.000Z",
    "importe": "-60.00"
  },
  "importe": "60.00",
  "asignaciones": []
}
```

Future `AJUSTE_CREDITO` events use the same `datosDespues.movimiento`
snapshot, with `tipo: "AJUSTE"` and the exact signed stored adjustment
`importe`; their existing `entidad: "clientes"` and client `entidadId` do not
change.

Future `REVERSAR_PAGO_CLIENTE` events continue to identify the newly created
reverse (`entidad: "movimientos_credito"`, `entidadId` equal to the new
reverse id, and `datosDespues.reversoId` equal to that id). They add only the
new reverse snapshot to `datosDespues`:

```json
{
  "reversoId": 200,
  "movimiento": {
    "id": 200,
    "clienteId": 7,
    "tipo": "REVERSO",
    "createdAt": "2026-09-16T15:00:00.000Z",
    "importe": "60.00"
  },
  "importe": "60.00",
  "motivo": "Captura incorrecta",
  "asignaciones": []
}
```

The reversal's `datosAntes.pagoId` and application list reference the
original ABONO, not the reverse identity. The original ABONO's own
`PAGO_CLIENTE` event must carry its ABONO snapshot. The reversal event must
never use the referenced original's timestamp as the reverse's capture
timestamp. No existing audit rows are rewritten and no new audit event is
created by this change.
