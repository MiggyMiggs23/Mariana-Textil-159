# Prompt H — Bloque 2: respaldo + restauración desechable local

## Veredicto

**PASS** — reporte reparado desde evidencia capturada; no se ejecutó un nuevo
dump, restore, consulta a la fuente, preflight, purga, Drive, seed, ni reinicio.

La autorización aprobada permanece en
`reports/prompt-h/aprobacion-listas-no-purga.md` y no fue modificada.

## Fuente, archivo y restauración

- Fuente efectiva: `heliumdb`, PostgreSQL `16.10`
- Snapshot UTC: `2026-09-16T03:42:48.408Z`
- Snapshot Mexico City: `2026-09-15 21:42:48`
- Archivo custom: `/home/runner/workspace/.local/backups/prompt-h-block2-20260915214248-7517/prompt-h-block2-20260915214248-7517.dump`
- Tamaño: `440802` bytes
- SHA-256: `da7d3f7f342756511c6a04d000f0f4f4fa3feea6b9caad21e6abec5213dffb22`
- `pg_restore` exit code: `0`
- Cluster persistente: `/home/runner/workspace/.local/backups/prompt-h-block2-20260915214248-7517/restore-cluster`
- Socket Unix-only verificado: `true`
- Rol superusuario local: `postgres`
- Reconexión admin: `PGHOST="/tmp/prompt-h-block2-20260915214248-7517-7517" "/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin/psql" --no-psqlrc --no-password --dbname="restore_admin_20260915214248-7517"`
- Reconexión restore: `PGHOST="/tmp/prompt-h-block2-20260915214248-7517-7517" "/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin/psql" --no-psqlrc --no-password --dbname="restore_disposable_20260915214248-7517"`

El dump, metadatos y cluster permanecen bajo `.local/backups/`; no contienen
credenciales ni filas crudas en este reporte. El JSON privado
`/home/runner/workspace/.local/backups/prompt-h-block2-20260915214248-7517/source-snapshot.json` conserva solamente la evidencia capturada necesaria para
reproducir la comparación; esta tabla no duplica ese archivo.

## Evidencia global capturada

| Objeto | Fuente | Restaurado | Comparación |
|---|---:|---:|---|
| Tablas dinámicas | 60 | 60 | PASS |
| Columnas/defaults | 604 | 604 | PASS |
| Constraints | 286 | 286 | PASS |
| Índices | 218 | 218 | PASS |
| Funciones | 49 | 49 | PASS |
| Triggers no internos + estado enabled | 14 | 14 | PASS |
| Secuencias | 45 | 45 | PASS |

Las categorías capturadas `tables`, `columns`, `constraints`, `indexes`,
`functions`, `triggers`, `sequences`,
`tableCountsAndCanonicalRowHashes` y `sequenceStateAfterDump` tienen
listas de discrepancias vacías. La siguiente tabla expande esa evidencia
global al nivel requerido por cada tabla. Para cada columna de comparación,
`Fuente / restaurado / resultado`; el valor restaurado es igual al de fuente
porque la categoría correspondiente fue comparada y quedó con cero
discrepancias en el estado capturado.

## Comparación tabla por tabla (60 tablas)

| Tabla | Count fuente | Count restore | Hash fila ordenado fuente | Hash fila ordenado restore | Columnas | Constraints | Índices | Triggers + enabled | Resultado |
|---|---:|---:|---|---|---|---|---|---|---|
| `public.aplicaciones_credito` | 2 | 2 | `cf6e377d1dba97cf15ac29911592d315` | `cf6e377d1dba97cf15ac29911592d315` | 5 / 5 / PASS | 5 / 5 / PASS | 3 / 3 / PASS | 2 / 2 / PASS | PASS |
| `public.aplicaciones_pago_proveedor` | 4 | 4 | `d4108672c2110be2819a94eaec08b4bc` | `d4108672c2110be2819a94eaec08b4bc` | 5 / 5 / PASS | 5 / 5 / PASS | 3 / 3 / PASS | 2 / 2 / PASS | PASS |
| `public.auditoria` | 3286 | 3286 | `ebfb27fc49b43dbf3eb4082729d84b0d` | `ebfb27fc49b43dbf3eb4082729d84b0d` | 14 / 14 / PASS | 3 / 3 / PASS | 6 / 6 / PASS | 2 / 2 / PASS | PASS |
| `public.auditoria_inventario_escaneos` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | 16 / 16 / PASS | 6 / 6 / PASS | 2 / 2 / PASS | 0 / 0 / PASS | PASS |
| `public.auditoria_inventario_folio` | 11 | 11 | `6e50856eaa1e8d3930a630e7ec415f7d` | `6e50856eaa1e8d3930a630e7ec415f7d` | 2 / 2 / PASS | 2 / 2 / PASS | 1 / 1 / PASS | 0 / 0 / PASS | PASS |
| `public.auditoria_inventario_participantes` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | 5 / 5 / PASS | 3 / 3 / PASS | 1 / 1 / PASS | 0 / 0 / PASS | PASS |
| `public.auditoria_inventario_snapshot` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | 14 / 14 / PASS | 5 / 5 / PASS | 2 / 2 / PASS | 0 / 0 / PASS | PASS |
| `public.auditorias_inventario` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | 13 / 13 / PASS | 8 / 8 / PASS | 4 / 4 / PASS | 0 / 0 / PASS | PASS |
| `public.autorizaciones_nota` | 2 | 2 | `800618fe55265528b6224c8abcbcb9b2` | `800618fe55265528b6224c8abcbcb9b2` | 6 / 6 / PASS | 6 / 6 / PASS | 3 / 3 / PASS | 0 / 0 / PASS | PASS |
| `public.camionetas` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | 9 / 9 / PASS | 2 / 2 / PASS | 3 / 3 / PASS | 0 / 0 / PASS | PASS |
| `public.choferes` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | 6 / 6 / PASS | 1 / 1 / PASS | 3 / 3 / PASS | 0 / 0 / PASS | PASS |
| `public.cliente_documentos` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | 13 / 13 / PASS | 8 / 8 / PASS | 5 / 5 / PASS | 0 / 0 / PASS | PASS |
| `public.clientes` | 7 | 7 | `57547451eec364bf428e41924ded0b49` | `57547451eec364bf428e41924ded0b49` | 17 / 17 / PASS | 1 / 1 / PASS | 2 / 2 / PASS | 0 / 0 / PASS | PASS |
| `public.contenedor_lineas` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | 6 / 6 / PASS | 6 / 6 / PASS | 4 / 4 / PASS | 0 / 0 / PASS | PASS |
| `public.contenedores` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | 15 / 15 / PASS | 10 / 10 / PASS | 7 / 7 / PASS | 0 / 0 / PASS | PASS |
| `public.cuadre_fiscal_registros` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | 15 / 15 / PASS | 9 / 9 / PASS | 2 / 2 / PASS | 0 / 0 / PASS | PASS |
| `public.entrada_folio` | 11 | 11 | `a44d42b66287e3bf389533df0e1b6787` | `a44d42b66287e3bf389533df0e1b6787` | 2 / 2 / PASS | 2 / 2 / PASS | 1 / 1 / PASS | 0 / 0 / PASS | PASS |
| `public.entradas` | 6 | 6 | `3c7d501269c2f85e2e41b1ac57c23a83` | `3c7d501269c2f85e2e41b1ac57c23a83` | 11 / 11 / PASS | 5 / 5 / PASS | 9 / 9 / PASS | 0 / 0 / PASS | PASS |
| `public.equipos` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | 12 / 12 / PASS | 5 / 5 / PASS | 3 / 3 / PASS | 0 / 0 / PASS | PASS |
| `public.equipos_checklist` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | 4 / 4 / PASS | 3 / 3 / PASS | 2 / 2 / PASS | 0 / 0 / PASS | PASS |
| `public.existencias` | 37 | 37 | `0e7a5bd69febababa25152bb222d57b8` | `0e7a5bd69febababa25152bb222d57b8` | 5 / 5 / PASS | 3 / 3 / PASS | 3 / 3 / PASS | 0 / 0 / PASS | PASS |
| `public.movimientos` | 307 | 307 | `d2e7b0955020a35d045fa236f21fa700` | `d2e7b0955020a35d045fa236f21fa700` | 19 / 19 / PASS | 8 / 8 / PASS | 11 / 11 / PASS | 0 / 0 / PASS | PASS |
| `public.movimientos_credito` | 8 | 8 | `6ad6ae447d5dbae2c27b119c5172bc9b` | `6ad6ae447d5dbae2c27b119c5172bc9b` | 18 / 18 / PASS | 9 / 9 / PASS | 4 / 4 / PASS | 2 / 2 / PASS | PASS |
| `public.notificaciones_credito` | 2 | 2 | `e5e5ca188a6878f6fd0a73f1e18705c0` | `e5e5ca188a6878f6fd0a73f1e18705c0` | 15 / 15 / PASS | 6 / 6 / PASS | 4 / 4 / PASS | 0 / 0 / PASS | PASS |
| `public.notificaciones_sistema` | 16 | 16 | `65fc68b7c8e187e43e7213acfaa4b0ab` | `65fc68b7c8e187e43e7213acfaa4b0ab` | 9 / 9 / PASS | 2 / 2 / PASS | 5 / 5 / PASS | 0 / 0 / PASS | PASS |
| `public.pagos_proveedor` | 9 | 9 | `c1539ae30170fba704a98eb3a043e1da` | `c1539ae30170fba704a98eb3a043e1da` | 12 / 12 / PASS | 5 / 5 / PASS | 4 / 4 / PASS | 1 / 1 / PASS | PASS |
| `public.permisos_rol` | 192 | 192 | `4d18bc7f2e1076313bc0ed9cddfffe88` | `4d18bc7f2e1076313bc0ed9cddfffe88` | 9 / 9 / PASS | 3 / 3 / PASS | 2 / 2 / PASS | 0 / 0 / PASS | PASS |
| `public.permisos_ubicacion` | 54 | 54 | `bc5e55897a9b7e834766d59550c35db1` | `bc5e55897a9b7e834766d59550c35db1` | 10 / 10 / PASS | 4 / 4 / PASS | 2 / 2 / PASS | 0 / 0 / PASS | PASS |
| `public.permisos_usuario` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | 9 / 9 / PASS | 4 / 4 / PASS | 2 / 2 / PASS | 0 / 0 / PASS | PASS |
| `public.pisos` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | 6 / 6 / PASS | 3 / 3 / PASS | 2 / 2 / PASS | 0 / 0 / PASS | PASS |
| `public.precio_historial` | 1016 | 1016 | `64f5ec3242e70cdfe37e1a242c26b506` | `64f5ec3242e70cdfe37e1a242c26b506` | 12 / 12 / PASS | 3 / 3 / PASS | 3 / 3 / PASS | 0 / 0 / PASS | PASS |
| `public.productos` | 1234 | 1234 | `9b5a7bfb4133c1c700f9d242628c0c46` | `9b5a7bfb4133c1c700f9d242628c0c46` | 17 / 17 / PASS | 5 / 5 / PASS | 5 / 5 / PASS | 0 / 0 / PASS | PASS |
| `public.proveedores` | 27 | 27 | `4a0020d06fb591411ff067f4140e5994` | `4a0020d06fb591411ff067f4140e5994` | 11 / 11 / PASS | 1 / 1 / PASS | 1 / 1 / PASS | 0 / 0 / PASS | PASS |
| `public.reimpresiones_etiqueta` | 146 | 146 | `8c9c8547595493d1876db686568ee515` | `8c9c8547595493d1876db686568ee515` | 17 / 17 / PASS | 5 / 5 / PASS | 4 / 4 / PASS | 1 / 1 / PASS | PASS |
| `public.revisiones_etiqueta` | 31 | 31 | `3966f263e75fa9cc4a64290d01bfae4c` | `3966f263e75fa9cc4a64290d01bfae4c` | 7 / 7 / PASS | 4 / 4 / PASS | 5 / 5 / PASS | 2 / 2 / PASS | PASS |
| `public.rollos` | 226 | 226 | `42ffdc1dcdaabc1fff06aeec39c963d2` | `42ffdc1dcdaabc1fff06aeec39c963d2` | 16 / 16 / PASS | 6 / 6 / PASS | 9 / 9 / PASS | 0 / 0 / PASS | PASS |
| `public.salida_folio` | 11 | 11 | `33cf7f2dd99825ee4431af068c14f673` | `33cf7f2dd99825ee4431af068c14f673` | 2 / 2 / PASS | 2 / 2 / PASS | 1 / 1 / PASS | 0 / 0 / PASS | PASS |
| `public.salida_lineas` | 2 | 2 | `27441b5caa25b1e2896264e957f5fc43` | `27441b5caa25b1e2896264e957f5fc43` | 8 / 8 / PASS | 3 / 3 / PASS | 3 / 3 / PASS | 0 / 0 / PASS | PASS |
| `public.salida_rollos` | 12 | 12 | `da5e655bbbbd3c908aaa3f24532708b0` | `da5e655bbbbd3c908aaa3f24532708b0` | 8 / 8 / PASS | 4 / 4 / PASS | 5 / 5 / PASS | 0 / 0 / PASS | PASS |
| `public.salidas` | 2 | 2 | `0382fb71b8f0972655db2c1cde8fce90` | `0382fb71b8f0972655db2c1cde8fce90` | 34 / 34 / PASS | 17 / 17 / PASS | 12 / 12 / PASS | 0 / 0 / PASS | PASS |
| `public.salidas_dinero_caja` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | 8 / 8 / PASS | 7 / 7 / PASS | 3 / 3 / PASS | 0 / 0 / PASS | PASS |
| `public.series_consecutivo` | 1 | 1 | `2b82431c6ad349fe225084845360f85c` | `2b82431c6ad349fe225084845360f85c` | 2 / 2 / PASS | 1 / 1 / PASS | 1 / 1 / PASS | 0 / 0 / PASS | PASS |
| `public.sesiones` | 11 | 11 | `ea64f311a46b7247f621b2f5c9bddd1c` | `ea64f311a46b7247f621b2f5c9bddd1c` | 6 / 6 / PASS | 2 / 2 / PASS | 1 / 1 / PASS | 0 / 0 / PASS | PASS |
| `public.sesiones_caja` | 2 | 2 | `b0531b284fc6041a8d7485cbb2f6d82a` | `b0531b284fc6041a8d7485cbb2f6d82a` | 10 / 10 / PASS | 4 / 4 / PASS | 4 / 4 / PASS | 0 / 0 / PASS | PASS |
| `public.sesiones_caja_dias` | 2 | 2 | `c4db98b31f86add440c557a6bb70b145` | `c4db98b31f86add440c557a6bb70b145` | 3 / 3 / PASS | 3 / 3 / PASS | 1 / 1 / PASS | 0 / 0 / PASS | PASS |
| `public.solicitudes_pago_dirigido` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | 24 / 24 / PASS | 8 / 8 / PASS | 3 / 3 / PASS | 0 / 0 / PASS | PASS |
| `public.stock_minimo_episodios` | 4 | 4 | `109a81a6562cf93d2fadbed345fab00f` | `109a81a6562cf93d2fadbed345fab00f` | 10 / 10 / PASS | 8 / 8 / PASS | 3 / 3 / PASS | 0 / 0 / PASS | PASS |
| `public.stock_minimo_sitios` | 1 | 1 | `17a13e555dc56c6b9871558bd51ba05c` | `17a13e555dc56c6b9871558bd51ba05c` | 4 / 4 / PASS | 3 / 3 / PASS | 1 / 1 / PASS | 0 / 0 / PASS | PASS |
| `public.stock_minimos` | 3 | 3 | `60b15edc65d0fa3cbaf651c9427fc0ae` | `60b15edc65d0fa3cbaf651c9427fc0ae` | 6 / 6 / PASS | 6 / 6 / PASS | 4 / 4 / PASS | 0 / 0 / PASS | PASS |
| `public.ticket_folio` | 1 | 1 | `4f3e6be1959372bcbd014607fe6f4f2a` | `4f3e6be1959372bcbd014607fe6f4f2a` | 2 / 2 / PASS | 1 / 1 / PASS | 1 / 1 / PASS | 0 / 0 / PASS | PASS |
| `public.ticket_linea_consumos` | 20 | 20 | `a7b8b38b35de9287522e8903f9508704` | `a7b8b38b35de9287522e8903f9508704` | 14 / 14 / PASS | 12 / 12 / PASS | 8 / 8 / PASS | 1 / 1 / PASS | PASS |
| `public.ticket_lineas` | 57 | 57 | `0c405da8e5ebb97f0464e6105ec3be58` | `0c405da8e5ebb97f0464e6105ec3be58` | 12 / 12 / PASS | 5 / 5 / PASS | 6 / 6 / PASS | 0 / 0 / PASS | PASS |
| `public.ticket_pagos` | 4 | 4 | `7ca49f8f4ff26f21ca132eeb1943f6d8` | `7ca49f8f4ff26f21ca132eeb1943f6d8` | 7 / 7 / PASS | 3 / 3 / PASS | 2 / 2 / PASS | 1 / 1 / PASS | PASS |
| `public.tickets` | 6 | 6 | `368939723e40eb004127b723cac19c63` | `368939723e40eb004127b723cac19c63` | 30 / 30 / PASS | 11 / 11 / PASS | 12 / 12 / PASS | 0 / 0 / PASS | PASS |
| `public.ubicaciones` | 11 | 11 | `024961124e5a29d6f6e1c4053687a948` | `024961124e5a29d6f6e1c4053687a948` | 6 / 6 / PASS | 3 / 3 / PASS | 3 / 3 / PASS | 0 / 0 / PASS | PASS |
| `public.usuarios` | 31 | 31 | `658b6ca14c31aa1a9eaf3fdeede703f1` | `658b6ca14c31aa1a9eaf3fdeede703f1` | 10 / 10 / PASS | 3 / 3 / PASS | 2 / 2 / PASS | 0 / 0 / PASS | PASS |
| `public.viaje_folio` | 11 | 11 | `6e50856eaa1e8d3930a630e7ec415f7d` | `6e50856eaa1e8d3930a630e7ec415f7d` | 2 / 2 / PASS | 2 / 2 / PASS | 1 / 1 / PASS | 0 / 0 / PASS | PASS |
| `public.viaje_salidas` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | 2 / 2 / PASS | 3 / 3 / PASS | 2 / 2 / PASS | 0 / 0 / PASS | PASS |
| `public.viaje_tickets` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | 2 / 2 / PASS | 3 / 3 / PASS | 2 / 2 / PASS | 0 / 0 / PASS | PASS |
| `public.viajes` | 0 | 0 | `d41d8cd98f00b204e9800998ecf8427e` | `d41d8cd98f00b204e9800998ecf8427e` | 10 / 10 / PASS | 6 / 6 / PASS | 5 / 5 / PASS | 0 / 0 / PASS | PASS |

**Resultado de las 60 filas:** counts PASS, hashes PASS, columnas/defaults
PASS, constraints PASS, índices PASS y triggers/estados enabled PASS. No hubo
discrepancias por tabla.

## Secuencias no-MVCC

Se capturó estado antes y después de `pg_dump`; el indicador capturado
`sequenceChangedDuringDump` es
`**false**`. El snapshot
prueba el instante del respaldo, no la frescura de un preflight posterior. No
se ejecutó preflight.

## SQL exacto y reproducibilidad

### 1. Tabla dinámica, conteo y huella de filas

La siguiente consulta descubre el conjunto (no usa una lista de tablas). Para
cada fila del resultado se ejecutó la segunda consulta reemplazando solamente
`<schema>` y `<table>` por identificadores SQL entrecomillados:

```sql
SELECT n.nspname AS schema, c.relname AS table, c.relkind::text AS relkind,
       pg_get_userbyid(c.relowner) AS owner, c.relacl::text AS acl
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE c.relkind IN ('r', 'p', 'f')
   AND n.nspname NOT IN ('pg_catalog', 'information_schema')
   AND n.nspname NOT LIKE 'pg_toast%'
   AND n.nspname NOT LIKE 'pg_temp_%'
 ORDER BY n.nspname, c.relname;
```

```sql
WITH canonical_rows AS (
  SELECT to_jsonb(t)::text AS canonical
    FROM "<schema>"."<table>" AS t
)
SELECT count(*)::text AS count,
       md5(COALESCE(
         string_agg(md5(canonical), '' ORDER BY canonical, md5(canonical)),
         ''
       )) AS ordered_canonical_row_hash
  FROM canonical_rows;
```

`to_jsonb(row)::text` is PostgreSQL's canonical textual row projection. The
ordered digest is not a raw-row export and is sufficient to compare duplicate
rows as well as distinct rows.

### 2. Columns and defaults

```sql
SELECT n.nspname AS schema, c.relname AS table, a.attname AS column,
       a.attnum AS ordinal_position, format_type(a.atttypid, a.atttypmod) AS data_type,
       a.attnotnull AS not_null, pg_get_expr(d.adbin, d.adrelid) AS default_expression,
       NULLIF(a.attidentity, '') AS identity_kind,
       NULLIF(a.attgenerated, '') AS generated_kind
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
 WHERE a.attnum > 0 AND NOT a.attisdropped
   AND c.relkind IN ('r', 'p', 'f')
   AND n.nspname NOT IN ('pg_catalog', 'information_schema')
   AND n.nspname NOT LIKE 'pg_toast%'
   AND n.nspname NOT LIKE 'pg_temp_%'
 ORDER BY n.nspname, c.relname, a.attnum;
```

Comparison is semantic by schema/table/column/type/nullability/default/identity/
generated status; `ordinal_position` is deliberately not required to match
because a logical restore compacts dropped-column holes.

### 3. Constraints

```sql
SELECT n.nspname AS schema, c.relname AS table, con.conname AS name,
       CASE con.contype WHEN 'c' THEN 'CHECK' WHEN 'f' THEN 'FOREIGN KEY'
         WHEN 'p' THEN 'PRIMARY KEY' WHEN 'u' THEN 'UNIQUE'
         WHEN 'x' THEN 'EXCLUSION' ELSE con.contype::text END AS constraint_type,
       pg_get_constraintdef(con.oid, true) AS definition,
       con.convalidated AS validated, con.condeferrable AS deferrable,
       con.condeferred AS initially_deferred,
       rn.nspname AS referenced_schema, rc.relname AS referenced_table,
       con.confupdtype::text AS update_action, con.confdeltype::text AS delete_action,
       con.confmatchtype::text AS match_type
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_class rc ON rc.oid = con.confrelid
  LEFT JOIN pg_namespace rn ON rn.oid = rc.relnamespace
 WHERE con.contype IN ('c', 'f', 'p', 'u', 'x')
   AND n.nspname NOT IN ('pg_catalog', 'information_schema')
   AND n.nspname NOT LIKE 'pg_toast%'
   AND n.nspname NOT LIKE 'pg_temp_%'
 ORDER BY n.nspname, c.relname, con.conname;
```

### 4. Indexes

```sql
SELECT tn.nspname AS schema, tc.relname AS table, i.relname AS index_name,
       pg_get_indexdef(i.oid) AS definition, x.indisunique AS is_unique,
       x.indisprimary AS is_primary, x.indisexclusion AS is_exclusion,
       x.indisvalid AS is_valid, x.indisready AS is_ready, x.indislive AS is_live,
       pg_get_expr(x.indpred, x.indrelid) AS predicate,
       pg_get_expr(x.indexprs, x.indrelid) AS expressions
  FROM pg_index x
  JOIN pg_class i ON i.oid = x.indexrelid
  JOIN pg_class tc ON tc.oid = x.indrelid
  JOIN pg_namespace tn ON tn.oid = tc.relnamespace
 WHERE tc.relkind IN ('r', 'p', 'f')
   AND tn.nspname NOT IN ('pg_catalog', 'information_schema')
   AND tn.nspname NOT LIKE 'pg_toast%'
   AND tn.nspname NOT LIKE 'pg_temp_%'
 ORDER BY tn.nspname, tc.relname, i.relname;
```

### 5. Functions and noninternal trigger enabled states

```sql
SELECT n.nspname AS schema, p.proname AS name,
       pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       pg_get_function_result(p.oid) AS result_type,
       pg_get_functiondef(p.oid) AS definition,
       p.prokind::text AS kind, p.provolatile::text AS volatility,
       p.prosecdef AS security_definer, p.proleakproof AS leakproof,
       p.proparallel::text AS parallel, p.proacl::text AS acl,
       pg_get_userbyid(p.proowner) AS owner, ext.extname AS extension_name
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  LEFT JOIN pg_depend dep
    ON dep.classid = 'pg_proc'::regclass AND dep.objid = p.oid
   AND dep.deptype = 'e'
  LEFT JOIN pg_extension ext ON ext.oid = dep.refobjid
 WHERE p.prokind IN ('f', 'p')
   AND n.nspname NOT IN ('pg_catalog', 'information_schema')
   AND n.nspname NOT LIKE 'pg_toast%'
   AND n.nspname NOT LIKE 'pg_temp_%'
 ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid);
```

```sql
SELECT n.nspname AS schema, c.relname AS table, t.tgname AS trigger_name,
       pg_get_triggerdef(t.oid, true) AS definition, t.tgenabled::text AS enabled,
       pn.nspname AS function_schema, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS function_arguments
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = t.tgfoid
  JOIN pg_namespace pn ON pn.oid = p.pronamespace
 WHERE NOT t.tgisinternal
   AND n.nspname NOT IN ('pg_catalog', 'information_schema')
   AND n.nspname NOT LIKE 'pg_toast%'
   AND n.nspname NOT LIKE 'pg_temp_%'
 ORDER BY n.nspname, c.relname, t.tgname;
```

For all catalogue queries, source reads were in the captured
`REPEATABLE READ READ ONLY` transaction; restore reads were in a separate
read-only transaction on the disposable database.

Los únicos outputs persistidos por esta reparación son este Markdown y el JSON
de metadatos ya capturado. Los outputs de las consultas son nombres de objetos,
conteos, estados semánticos y hashes; nunca se imprimen ni se guardan filas de
datos o credenciales.
