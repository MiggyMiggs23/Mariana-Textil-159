# Proposed POS rehearsal — NOT EXECUTED

Owner interface for `e1-integration-review`: module `scripts/src/e1-rehearsal-pos-cases.mts` exports `POS_TARGET`, `POS_IDS`, `POS_FIXTURE_SQL` (alias `fixtureSql`) and `runPosCases({ pool, record? })` (alias `runCases`). `pool` is the real pinned `pg.Pool`; optional `record` receives `{ name, status, message? }` after each case. The returned report contains named cases, exact loaded-source hashes, fixture SQL hash, scope limitations and status. An assertion/execution error reports the failed case and throws. Nothing runs on import.

The master owns target/network guards, adapted approved E1 DDL, transaction around fixture SQL, and report persistence. Execute `fixtureSql` exactly once inside the master's fixture transaction, then call `runPosCases` serially after that transaction commits. The module intentionally has no fixture installer, BEGIN/COMMIT in its fixture SQL, DDL, cleanup, automatic retry, or API startup. It creates its own source-bound loader using `createRehearsalLoader({ pool })` from the customer worker's shared `e1-rehearsal-loader.mts`. Only `@workspace/db` is replaced, with real schema/Drizzle/pool; it never imports the production database singleton. The loader and module are part of the reviewed source digest.

Reserved POS IDs are in `1872000000+`: site/actor/session/customer `1872000101`; main note `1872000101`, over-limit note `1872000102`; linked salida `1872000101`. Site initials `EPR`; user `e1_pos_rehearsal_20260917`. UUID namespace `e1170000-0000-4000-8000-0000000001xx`. This module does not depend on shared fixture IDs. Do not share its entities with other modules. Collisions fail; no ON CONFLICT/update/delete cleanup.

Target ONLY: Unix socket `/tmp/prompt-h-block2-20260917165108-3655-3655`, port 5432, database `restore_disposable_20260917165108-3655`, role `postgres`. Before loading production functions the module calls the shared loader's `assertCloneIdentity(pool)` (explicit pinned pool fields plus live database/user/address/data-directory checks). The master additionally owns the per-connection network/target guard and restored cluster/schema checks.

This exercises actual `autorizarNota`, `cancelarTicket`, `cancelarSalidaODocumentoLigado` and `buildSalidaDetail` exports, not reimplemented producers. Linked cancellation dispatch is the production helper used by the salida route, NOT an HTTP/middleware/session-authentication test. Actor context is explicitly synthetic; password hash is deliberately unusable, not a login credential. No HTTP listener, app initialization, password authentication, migration, source connection or real-world data is needed.

Scope: 100.00 credit note, 1000.00 credit limit, separate 1001.00 over-limit pending note, one RECIBIDA linked salida. Deliberately no ticket lines/products/rolls; this verifies financial/authorization/audit/notification/linked-header atomicity, **not inventory consumption or restoration**. Over-limit rejection occurs after the production claim and ledger insertion; a second rollback proof throws only after real cancellation completed in a genuine PostgreSQL transaction, then compares all fixture state before/after rollback. Sequences may advance despite rollback; no sequence reset is proposed.

## Planned cases — 20, none executed

- Exact unused fixture prerequisites.
- Each producer: legacy/no E1 fields, missing origin, missing nature, unknown nature, incompatible CORRECCION_CONTABLE rejected with the expected named production error and zero residual fixture state changes (10 cases).
- Authorization: post-ledger credit-limit failure rolls back; full successful evidence acceptance; original-result replay after operational cash-session closure; same-key changed evidence conflict; same-key changed persisted amount conflict and rollback (5 cases).
- Cancellation via production linked-salida dispatcher: completed transaction then deliberate abort restores all dependent state; full successful cancellation references the original charge and cancels both headers; original-result replay emits replay marker without writes; same-key changed reason conflicts (4 cases).

Every unsuccessful operation is enclosed in a real Drizzle/PostgreSQL transaction. Full-row fixture snapshots cover claims, ledger, tickets, authorizations, notifications, audits, linked salida, cash session, customer, actor, inventory movements and allocations. These snapshots are compared before/after rejection or rollback. Acceptance explicitly checks the seven E1 columns, exact amounts, producer/key and charge/reversal link. `to_jsonb` numeric values are compared as JSON numbers, not pg numeric strings.

Expected final fixture state: one canceled AUTORIZADA main note, one untouched PENDIENTE over-limit note; +100.00 VENTA_CREDITO and -100.00 REVERSO; two immutable operation records, one authorization, one read notification, two audit rows; linked salida CANCELADA; operational session CERRADA, but both ledger rows have NULL cash-session attribution. Original operation UUIDs are `e1170000-0000-4000-8000-000000000121` (sale), `...000000000122` (cancellation); attempted over-limit UUID `...000000000123` must have no persisted claim.

In addition to production writes, cases perform this exact committed fixture-only session update:

```sql
UPDATE public.sesiones_caja SET estado='CERRADA',
  cerrada_at='2026-09-17T13:00:00Z',cerrada_por_id=1872000101 WHERE id=1872000101;
```

And this parameter-bound fixture-only update inside the same transaction as an expected immutable-key conflict, which must roll back:

```sql
UPDATE public.tickets SET total=101.00,subtotal=101.00 WHERE id=1872000101;
```

## Exact proposed fixture SQL

No SQL has been run. E1 SQL must first be installed on this clone by the authorized master; no schema repair or fixture substitution is automatic. The master wraps these six INSERT statements in its single fixture transaction. Seven rows are inserted; fixed IDs/UUIDs and timestamps are deliberate.

```sql
INSERT INTO public.ubicaciones (id,nombre,iniciales,tipo,activa,created_at)
VALUES (1872000101,'E1 POS rehearsal 20260917','EPR','TIENDA',true,'2026-09-17T12:00:00Z');
INSERT INTO public.usuarios
 (id,nombre,usuario,password_hash,rol,ubicacion_id,activo,alcance_consulta,created_at)
VALUES (1872000101,'E1 POS synthetic actor','e1_pos_rehearsal_20260917',
 '!E1_DISABLED_NO_LOGIN!','ADMIN',1872000101,true,'TODAS','2026-09-17T12:00:00Z');
INSERT INTO public.clientes
 (id,nombre,activo,es_sistema,dias_credito,limite_credito,saldo_credito,created_at,updated_at)
VALUES (1872000101,'E1 POS synthetic customer',true,false,7,1000.00,0.00,
 '2026-09-17T12:00:00Z','2026-09-17T12:00:00Z');
INSERT INTO public.sesiones_caja
 (id,ubicacion_id,usuario_id,abierta_at,fecha_operativa,fondo_inicial,estado)
VALUES (1872000101,1872000101,1872000101,'2026-09-17T12:00:00Z','2026-09-17',0.00,'ABIERTA');
INSERT INTO public.tickets
 (id,folio,ubicacion_id,usuario_terminal_id,cliente_id,documento_tipo,subtotal,iva,tasa_iva,
 total,estado,cobrado,facturado,credito,dias_plazo,fecha_vencimiento,uuid_cliente,
 created_at,autorizacion_estado)
VALUES
 (1872000101,1872000101,1872000101,1872000101,1872000101,'NOTA',100.00,0.00,0.0000,
 100.00,'VENDIDO',false,false,true,7,'2026-09-24',
 'e1170000-0000-4000-8000-000000000101','2026-09-17T12:00:00Z','PENDIENTE'),
 (1872000102,1872000102,1872000101,1872000101,1872000101,'NOTA',1001.00,0.00,0.0000,
 1001.00,'VENDIDO',false,false,true,7,'2026-09-24',
 'e1170000-0000-4000-8000-000000000102','2026-09-17T12:00:00Z','PENDIENTE');
INSERT INTO public.salidas
 (id,folio,origen_id,cliente_id,ticket_id,modalidad,estado,usuario_solicita_id,uuid_cliente,
 created_at,actividad_at,recibida_at)
VALUES (1872000101,1872000101,1872000101,1872000101,1872000101,
 'VENTA_CLIENTE','RECIBIDA',1872000101,'e1170000-0000-4000-8000-000000000111',
 '2026-09-17T12:00:00Z','2026-09-17T12:00:00Z','2026-09-17T12:00:00Z');
```