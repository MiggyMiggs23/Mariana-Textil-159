# Prompt F — API/contract handoff

## Endpoint

`GET /clientes/:id/pagos/:pagoId`

- `operationId`: `getClientePagoDetalle` (unchanged).
- Generated React query remains `useGetClientePagoDetalle` (unchanged).
- Permission: `clientes_finanzas` action `ver`.
- The route remains nested under the client and requires both `m.id = pagoId`
  and `m.cliente_id = id`; a movement from another client is returned as 404.
- Supported movement types are `ABONO`, `REVERSO`, and `AJUSTE`. Other types,
  including `VENTA_CREDITO`, are returned as 404.
- Invalid path ids return 400. Missing, wrong-client, or unsupported-type
  movements return 404. Permission/session behavior remains the existing
  401/403 behavior.

The API returns timestamps as RFC 3339 date-time values. The frontend should
format `fechaEfectiva`, `fecha`, `fechaCaptura`, and audit `fecha` in
`America/Mexico_City`; the API does not normalize dates to a display timezone.

## Legacy fields preserved

These fields remain present for the existing Ver Reparto dialog:

```ts
{
  id: number;
  clienteId: number;
  fecha: string; // legacy effective timestamp
  montoTotalAbono: string; // absolute legacy amount
  formaPago: "EFECTIVO" | "TRANSFERENCIA" | "FACTURADO" | "CHEQUE" | "OTRO" | "CREDITO" | null;
  cuentaDestino: "CAJA_FISICA" | "CUENTA_FISCAL" | "CUENTA_NO_FISCAL" | null;
  referencia: string | null;
  usuarioRegistrador: string;
  revertido?: boolean;
  reversoMovimientoId?: number | null;
  motivoReverso?: string | null;
  aplicaciones: Array<{
    ticketId: number;
    folio: number;
    movimientoVentaId: number;
    aplicado: string;
    importeOriginal: string;
    saldoActual: string;
    resultado: "PENDIENTE" | "PARCIAL" | "PAGADA";
    estadoNota: "PENDIENTE" | "ABONO_PARCIAL" | "PAGADA" | "CON_RETRASO";
  }>;
}
```

`aplicaciones` is retained storage evidence for ABONO compatibility. It is
not the authority for current balances or the new projected reparto.

## Additive movement fields

```ts
{
  clienteNombre?: string;
  tipo?: "ABONO" | "REVERSO" | "AJUSTE";
  importe?: string; // signed ledger amount
  fechaEfectiva?: string; // created_at/effective ledger timestamp
  fechaCaptura?: string | null; // null when audit identity cannot be proved
  usuarioCaptura?: string | null;
  notas?: string | null;
  ticketId?: number | null;
  ticketFolio?: number | null;
  movimientoOriginalId?: number | null;
  reparto?: Reparto[];
  saldoAFavor?: string | null; // ABONO only
  aplicacionesRevertidas?: Reparto[]; // REVERSO of an ABONO only
  auditoria?: Auditoria[]; // omitted when no verified event exists
}

type Reparto = {
  ticketId: number | null;
  folio: number | null;
  movimientoVentaId: number;
  importeAplicado: string;
  saldoAntes: string | null;
  saldoDespues: string | null;
  vigente: boolean;
};

type Auditoria = {
  id: number;
  accion: string;
  fecha: string;
  usuario: string | null;
  motivo: string | null;
};
```

Irrelevant sections are omitted: `reparto` and `saldoAFavor` are only emitted
for ABONO; `aplicacionesRevertidas` is only emitted for a REVERSO whose
same-client original is an ABONO. AJUSTE may have a ticket or no ticket and
does not receive a synthetic reparto or zero balance.

For an active ABONO, `reparto` comes from the actual current canonical
`projectCreditLedger` projection, including its applied, before, after, and
source-favor values. For an original ABONO that was reversed, `reparto`
contains only immutable inactive application evidence with `vigente: false`.
For a REVERSO, `aplicacionesRevertidas` contains that same immutable evidence
and the REVERSO never gets its own reparto. Where the matching capture audit
retains allocation `saldoAntes`/`saldoDespues`, those stored values are
returned only after matching the application identity; otherwise they remain
`null`. Recomputed ledger-prefix values
are never labeled as captured history: when stored before/after evidence is
absent, `saldoAntes` and `saldoDespues` are explicitly `null`, and the UI
should explain that the historical balance was not retained. Current final
balances are never presented as historical before/after values or replaced
with zero.

## Source and verification notes

Before this implementation, Block 0 was confirmed in
`artifacts/api-server/src/routes/clientes.ts`: the legacy endpoint selected
the movement and user, preserved `fecha`, amount, payment destination,
reference, reversal metadata, and queried `aplicaciones_credito`; its predicate
was explicitly `m.tipo='ABONO'`, so REVERSO and AJUSTE returned 404. The
canonical ledger read model is
`loadCustomerCreditProjection` → `projectCreditLedger`; the detail builder now
uses its current allocation trace rather than introducing a second FIFO
calculation, and deliberately does not use recomputed movement prefixes as
historical evidence.

The shared readonly builder is:

`artifacts/api-server/src/lib/credit-movement-detail.ts`

The existing endpoint delegates to this builder. No writes, migrations,
startup initializers, or frontend files were added for this contract.

Generated contract outputs:

- `lib/api-spec/openapi.yaml`
- `lib/api-zod/src/generated/api.ts`
- `lib/api-zod/src/generated/types/clientePagoDetalle.ts`
- `lib/api-zod/src/generated/types/clientePagoDetalleReparto.ts`
- `lib/api-zod/src/generated/types/clientePagoAuditoria.ts`
- `lib/api-client-react/src/generated/api.ts`
- `lib/api-client-react/src/generated/api.schemas.ts`

Focused pure tests are in
`artifacts/api-server/src/lib/credit-movement-detail.test.ts`; they cover
canonical projected before/after values, reversed-ABONO prefix evidence,
positive/negative AJUSTE ledger behavior, and audit collision rejection.
