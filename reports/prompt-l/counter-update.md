# Prompt L — narrow series counter update

## Status: **COMMITTED**

- Mode: `apply`
- Effective database: `heliumdb`; schema: `public`.
- Connection credentials, host, users, sessions, passwords, and raw snapshot rows are omitted.
- This CLI never imports the API, creates users/sessions, reads passwords, seeds data, or restarts the API.

## Approved source and preflight

- Snapshot: `.local/backups/prompt-h-block2-20260915214248-7517/source-snapshot.json`
- Prompt H preflight: `reports/prompt-h/block3-preflight-metadata.json`
- Prompt L read-only gate: `reports/prompt-l/block0-database-gate.json`
- Dynamic public tables: **60** (A/B/C 35/7/18).
- Non-MVCC sequence values checked: **45**.

## Read-only precondition

- Zero rollos: **—**.
- Zero assigned series: **—**.
- Control row: `"not captured"`.
- Physical PostgreSQL default: `1000000`; unchanged and intentionally not altered.

## Mutation plan and safety

The apply path takes one transaction and locks `public.series_consecutivo` in ACCESS EXCLUSIVE mode first, then `public.rollos` in SHARE mode. It executes no DELETE, INSERT, DDL, sequence call, schema ALTER, or API lifecycle action.

```sql
UPDATE public.series_consecutivo SET ultimo_numero = 10000000 WHERE id = 1 AND ultimo_numero = 1000000 RETURNING *
```

- Dry-run writes: **—**.
- Apply main-review gate: `PROMPT_L_MAIN_REVIEW=APPROVED`.
- Physical default policy: **remains 1000000**; the code/Drizzle default is intentionally 10000000, and this operator does not issue ALTER TABLE.

## Full 60-table canonical evidence

Hashes use the approved PostgreSQL method `to_jsonb(t)::text`, with ordered per-row MD5 values. Only the control table may differ across the guarded UPDATE.

| Table | Count | Canonical full-row hash |
| --- | ---: | --- |
| aplicaciones_credito | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| aplicaciones_pago_proveedor | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| auditoria | 3287 | `19782842fc9fd7592523ebe03972f50f` |
| auditoria_inventario_escaneos | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| auditoria_inventario_folio | 11 | `6e50856eaa1e8d3930a630e7ec415f7d` |
| auditoria_inventario_participantes | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| auditoria_inventario_snapshot | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| auditorias_inventario | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| autorizaciones_nota | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| camionetas | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| choferes | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| cliente_documentos | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| clientes | 7 | `57547451eec364bf428e41924ded0b49` |
| contenedor_lineas | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| contenedores | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| cuadre_fiscal_registros | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| entrada_folio | 11 | `6e50856eaa1e8d3930a630e7ec415f7d` |
| entradas | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| equipos | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| equipos_checklist | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| existencias | 37 | `cf4fec9ce687afbde4c378d846505625` |
| movimientos | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| movimientos_credito | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| notificaciones_credito | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| notificaciones_sistema | 12 | `24c477404df84bb09ec8c376c2c7e38f` |
| pagos_proveedor | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| permisos_rol | 192 | `59b7b2b7af34cd49c0c856e05b2f86ab` |
| permisos_ubicacion | 54 | `2814b0b8726673baf5c62009ed1b0e38` |
| permisos_usuario | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| pisos | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| precio_historial | 1016 | `64f5ec3242e70cdfe37e1a242c26b506` |
| productos | 1234 | `9b5a7bfb4133c1c700f9d242628c0c46` |
| proveedores | 27 | `4a0020d06fb591411ff067f4140e5994` |
| reimpresiones_etiqueta | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| revisiones_etiqueta | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| rollos | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| salida_folio | 11 | `6e50856eaa1e8d3930a630e7ec415f7d` |
| salida_lineas | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| salida_rollos | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| salidas | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| salidas_dinero_caja | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| series_consecutivo | 1 | `425e214a431270c700029d189b1c414d` |
| sesiones | 1 | `134d86c61d0950b737a2b39dfabcfc19` |
| sesiones_caja | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| sesiones_caja_dias | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| solicitudes_pago_dirigido | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| stock_minimo_episodios | 3 | `ee466b3b81125f83760eacd3addc2dd4` |
| stock_minimo_sitios | 1 | `17a13e555dc56c6b9871558bd51ba05c` |
| stock_minimos | 3 | `60b15edc65d0fa3cbaf651c9427fc0ae` |
| ticket_folio | 1 | `1b34fd1b69e6a439935eaf4c7efe7d72` |
| ticket_linea_consumos | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| ticket_lineas | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| ticket_pagos | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| tickets | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| ubicaciones | 11 | `024961124e5a29d6f6e1c4053687a948` |
| usuarios | 31 | `62380f26a0ff1802243c3f416babbc72` |
| viaje_folio | 11 | `6e50856eaa1e8d3930a630e7ec415f7d` |
| viaje_salidas | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| viaje_tickets | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| viajes | 0 | `d41d8cd98f00b204e9800998ecf8427e` |

## Transaction proof

- Lock order: `public.series_consecutivo ACCESS EXCLUSIVE` → `public.rollos SHARE`.
- Exact UPDATE affected rows: **1**.
- Changed tables after full before/after comparison: **series_consecutivo**.
- Other counters/control tables unchanged: **PASS**.
- Protected productos/precio_historial unchanged: **PASS**.
- All 45 sequence values unchanged: **PASS**.

## Post-commit read-only proof

- Status: **PASS**.
- Full 60-table verification: **PASS**.
- 45 sequence values unchanged: **PASS**.
- API restarted by this CLI: **no**.

## Retry policy

- There is no automatic retry. A commit acknowledgement failure is recorded separately as `COMMIT_STATUS_UNKNOWN_AFTER_COMMIT_ATTEMPT_NO_RETRY`; a second `--apply` is refused.
- API stop/restart remains the main agent's responsibility.

