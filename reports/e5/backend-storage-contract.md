# E5 backend storage contract

Prepared DDL only; this document does not authorize execution or activation. E5 and E11-A remain OFF.

The backend owns these names. UUID keys are PostgreSQL `uuid`; amounts are exact `numeric` with two fractional digits; snapshots/evidence/source are `jsonb`; timestamps are `timestamptz`. Integer identities reference the existing tables. Changes require MAIN coordination.

| Table | Columns consumed/written by backend |
|---|---|
| e5_recepciones | id UUID PK, cliente_id, ubicacion_id, importe, fecha_recepcion, medio, cuenta_destino, sesion_caja_id nullable, actor_id, snapshot |
| e5_cobros | id UUID PK, cliente_id, ubicacion_id, revision positive integer, detail JSONB |
| e5_aplicaciones | id UUID PK (piece key), cobro_id UUID, grupo_id UUID (application DTO id), propuesta_id UUID, movimiento_venta_id nullable (favor only), importe, favor boolean, actor_id, fecha_aplicacion, snapshot |
| e5_vinculos_credito | aplicacion_id UUID unique, movimiento_id integer unique |
| e5_devoluciones | clave UUID PK, cobro_id UUID unique, actor_id, fuente JSONB, importe, peticion text, evidencia JSONB, salida_id nullable integer, movimiento_fondo_id nullable UUID |
| e5_salidas_bancarias | clave UUID PK, cobro_id UUID unique, ubicacion_id, cuenta_origen, importe, actor_id, evidencia JSONB, created_at default now() |
| e5_documentos | id UUID PK, cobro_id UUID, tipo text RECIBO/CONSTANCIA, snapshot JSONB |
| e5_operaciones | clave UUID PK, cobro_id UUID, revision, accion text, actor_id, content canonical text, response JSONB |
| e5_impresiones | clave UUID PK, documento_id UUID, actor_id, content canonical text, motivo text |

## Write order and constraints

Reception source is inserted before the E1 operation and pending receipt. The E1 receipt retains producer COBRO_PENDIENTE and nature INGRESO_FISICO; only a matching immutable e5_recepciones attestation may pass the pending guard. Do not enable the generic E1 pending helper. Statement guard must reject zero-row inserts and reject any unattested row in a multi-row insert.

Each application piece first inserts e5_aplicaciones, then operaciones_credito_e1, movimientos_credito, its approved directed request and aplicaciones_credito (unless explicit favor), then e5_vinculos_credito. Producer is E5_APLICACION_RETENIDA, nature OPERACION_CREDITO_SIN_DINERO, type ABONO with negative amount, null forma_pago/cuenta_destino/sesion_caja_id. Direction is recorded through solicitudes_pago_dirigido: tipo CLIENTE, estado APROBADA, forma_pago APLICACION_SIN_DINERO, cuenta_destino null, exact documento_movimiento_id. Application rows are evidence, never the balance authority.

Reception/applications/documents/refund effects can precede e5_cobros insertion/update in the SAME transaction. Cross-table aggregate and snapshot consistency therefore requires deferred checks. e5_cobros is the only mutable aggregate (CAS revision); all sources, evidence, links, operations and documents are append-only. Proposals/rejections live in aggregate history and operation snapshots, not separate tables.

Refund inserts a real salidas_dinero_caja row OR e5_salidas_bancarias row OR existing Fondo RETIRO, followed by e5_devoluciones and aggregate save. Refund must equal the entire reception, have no historical application, and use exactly its declared source. Bank reference is documentary proof of an external transfer, not a bank API or fabricated available balance.

Enforce actor ADMIN for applications/refunds, ownership and source/link amount identity, aggregate received=applied+pending+refunded, immutable historical application prohibition on refunds, and no independent credit reversals/Fondo inverses/cash-output deletion of owned evidence. All operation and print UUIDs share one logical replay namespace; backend serializes them via advisory lock.

Existing source tables referenced: usuarios, clientes, ubicaciones, sesiones_caja, tickets, operaciones_credito_e1, cobros_credito_pendientes_e1, movimientos_credito, solicitudes_pago_dirigido, aplicaciones_credito, salidas_dinero_caja, fondo_mariana and Fondo movement tables through its existing transactional executor; auditoria receives private modulo FONDO records.

Rollback must refuse any E5 evidence, restore original E1 guards and permanent producer restrictions, and never delete business evidence.

## Productive integration / DDL alignment review

Names above remain frozen. Source metadata in lib/db/src/schema/pos.ts declares E5_APLICACION_RETENIDA exclusively in the no-money branch of operaciones_productor_naturaleza_ck_e1. Generic CreditProducer helpers still do NOT accept E5: the dedicated adapter writes positive source attestation first and validates receipt/application ownership and conservation. This source declaration is not a schema push or SQL execution.

SQL owner must prepare (not apply) the narrow E1 extension:

- The permanent operation constraint must recognize E5_APLICACION_RETENIDA exclusively with OPERACION_CREDITO_SIN_DINERO.
- The permanent movement validator must retain every original check and add ONLY the owned E5 negative ABONO branch: matching same-transaction application source/actor/client/amount/site/key, no payment medium/account/session, non-incobrable, no reversal origin, no sale ticket, no fake physical receipt. Source graph remains deferred because approved directed marker/link follow the movement.
- The pending statement guard must use the inserted transition relation, reject zero rows, and validate every COBRO_PENDIENTE row against same-transaction immutable e5_recepciones and E1 operation. No setting/user variable/global E1 switch is authorization. Ordinary pending producers remain closed.
- Keep E5's construction closure and all runtime gates false. Rollback must restore exact original E1 definitions after refusing all evidence.

Reviewed prepared DDL matches the nine adapter tables, bank created_at and trigger-populated birth_xid (adapter does not supply provenance). Its current E1 restrictions deliberately still reject the adapter and therefore remain a delivery dependency, not a tested integration.

Important review findings for SQL owner: the favor-piece graph must distinguish initial issuance without applications from later legitimate canonical FIFO consumption (the current unconditional rejection of any aplicaciones_credito row for favor can block that consumption). Global graph lock (650005,5) across legacy writers must be reviewed against existing customer/session/Fondo lock ordering; no concurrency claim is made.

Shared caja-corte-reader already reads E1 retained cash receipts and actual cash outflows, while excluding E5 applications by null session and nonphysical nature. e5-destination-reader adds reception and cash/bank return rows to shared destination/conciliation reads, never application money or Fondo source. E5 tables are not referenced by that SQL fragment while E5 is OFF. Cliente reversal checks producer identity regardless of gate; Fondo inverse calls the E5 ownership check alongside the unchanged E9 guard, and prepared SQL also independently forbids inverses.