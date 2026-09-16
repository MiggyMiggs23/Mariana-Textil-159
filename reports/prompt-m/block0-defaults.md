# Prompt M — Bloque 0: defaults y filas de contadores (solo lectura)

## Veredicto

**STOP antes de los Bloques 1 y 2.** La consulta directa al PostgreSQL vivo
`heliumdb.public` terminó en una transacción `REPEATABLE READ READ ONLY` y se
cerró con `ROLLBACK`. No se ejecutaron `ALTER`, inserciones, pruebas en base
desechable, usuarios, sesiones ni ningún otro cambio de base.

La evidencia completa, incluyendo el texto exacto de las consultas y las 46
filas de control, está en
`reports/prompt-m/block0-defaults.json`.

## Identidad de la consulta

| Campo | Valor |
|---|---|
| Base | `heliumdb` |
| Esquema | `public` |
| Usuario de consulta | `postgres` |
| PostgreSQL | `16.10` |
| Zona horaria de la sesión | `America/Mexico_City` |
| Timestamp de transacción | `2026-09-15 23:21:00.625 -06:00` |
| Timestamp de sentencia | `2026-09-15 23:21:00.627 -06:00` |
| `transaction_read_only` | `on` |
| `transaction_isolation` | `repeatable read` |
| Cierre | `ROLLBACK` |

No se registraron valores de entorno ni credenciales.

## Puerta de propietario y respaldo H

Se verificó el cierre documental
`reports/prompt-h/cierre-propietario.md`: `currentUIStatus:
APPROVED_BY_OWNER`.

El dump aprobado sigue presente y se verificó únicamente su existencia, tamaño y
SHA-256; no se restauró ni se leyeron credenciales:

| Campo | Valor |
|---|---|
| Dump | `.local/backups/prompt-h-block2-20260915214248-7517/prompt-h-block2-20260915214248-7517.dump` |
| Tamaño | `440802` bytes |
| SHA-256 registrado por H | `da7d3f7f342756511c6a04d000f0f4f4fa3feea6b9caad21e6abec5213dffb22` |
| SHA-256 calculado ahora | `da7d3f7f342756511c6a04d000f0f4f4fa3feea6b9caad21e6abec5213dffb22` |
| Coincidencia | `true` |

## Comparación de los seis contadores

Las declaraciones se localizaron primero en `lib/db/src/schema/`:

| Tabla | Columna | Declaración Drizzle | Default vivo | Diferencia | Filas |
|---|---|---:|---:|---|---:|
| `entrada_folio` | `ultimo_folio` | `0` (`lib/db/src/schema/entradas.ts:71`) | `99` | **sí** | 11 |
| `salida_folio` | `ultimo_folio` | `0` (`lib/db/src/schema/salidas.ts:182`) | `499` | **sí** | 11 |
| `viaje_folio` | `ultimo_folio` | `0` (`lib/db/src/schema/viajes.ts:47`) | `0` | no | 11 |
| `auditoria_inventario_folio` | `ultimo_folio` | `0` (`lib/db/src/schema/auditorias-inventario.ts:25`) | `0` | no | 11 |
| `ticket_folio` | `ultimo_folio` | `999` (`lib/db/src/schema/pos.ts:403`) | `999` | no | 1 |
| `series_consecutivo` | `ultimo_numero` | `10000000` (`lib/db/src/schema/series.ts:20`) | `1000000` | **sí; deriva inesperada** | 1 |

Defaults vivos: `entrada_folio=99`, `salida_folio=499`,
`viaje_folio=0`, `auditoria_inventario_folio=0`, `ticket_folio=999` y
`series_consecutivo=1000000`.

## Valores actuales de todas las filas de control

Las cuatro tablas por sitio tienen las mismas claves actuales:
`ubicacion_id = 1, 2, 3, 4, 5, 6, 7, 8, 9, 458, 531`.

| Tabla | Conteo | Valores actuales por clave |
|---|---:|---|
| `entrada_folio` | 11 | `1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0, 458:0, 531:0` |
| `salida_folio` | 11 | `1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0, 458:0, 531:0` |
| `viaje_folio` | 11 | `1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0, 458:0, 531:0` |
| `auditoria_inventario_folio` | 11 | `1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0, 458:0, 531:0` |
| `ticket_folio` | 1 | `id 1: 999` |
| `series_consecutivo` | 1 | `id 1: 10000000` |

La fila de `series_consecutivo` ya está en `10000000`, mientras que su default
vivo todavía es `1000000`. Esto confirma una deriva adicional no resuelta por
los dos defaults conocidos del prompt. El estado actual de la fila **no**
autoriza inferir cuál default debe ganar para nuevas filas.

## Decisión requerida

El hallazgo `series_consecutivo.ultimo_numero` es una diferencia no anticipada:

- código: default `10000000`;
- catálogo vivo: default `1000000`;
- fila existente `id=1`: valor `10000000`.

Por la instrucción del Bloque 0, se detiene aquí y se requiere decisión explícita
del propietario antes de cualquier `ALTER`. No se autoalinea
`series_consecutivo`, no se cambia su fila y tampoco se ejecutan los Bloques 1 o
2. Aunque `entrada_folio` y `salida_folio` también difieren (`99` y `499` frente
a `0`), permanecen sin tocar hasta recibir la decisión requerida.

## Consultas exactas ejecutadas

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL TIME ZONE 'America/Mexico_City';
```

Identidad y reloj:

```sql
SELECT current_database() AS database_name, current_user AS current_user_name, session_user AS session_user_name, current_setting('server_version') AS server_version, current_setting('TimeZone') AS timezone_setting, current_setting('transaction_read_only') AS transaction_read_only, current_setting('transaction_isolation') AS transaction_isolation, to_char(transaction_timestamp(), 'YYYY-MM-DD HH24:MI:SS.MS TZH:TZM') AS transaction_timestamp_mexico, to_char(statement_timestamp(), 'YYYY-MM-DD HH24:MI:SS.MS TZH:TZM') AS statement_timestamp_mexico, to_char(clock_timestamp(), 'YYYY-MM-DD HH24:MI:SS.MS TZH:TZM') AS clock_timestamp_mexico
```

Catálogo:

```sql
SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name, format_type(a.atttypid, a.atttypmod) AS data_type, a.attnotnull AS not_null, pg_get_expr(d.adbin, d.adrelid) AS default_expression, NULLIF(a.attidentity, '') AS identity_kind, NULLIF(a.attgenerated, '') AS generated_kind
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE n.nspname = 'public' AND c.relname IN ('entrada_folio','salida_folio','viaje_folio','auditoria_inventario_folio','ticket_folio','series_consecutivo') AND a.attname IN ('ultimo_folio','ultimo_numero') AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY array_position(ARRAY['entrada_folio','salida_folio','viaje_folio','auditoria_inventario_folio','ticket_folio','series_consecutivo'], c.relname);
```

Conteos:

```sql
SELECT * FROM (
  SELECT 'entrada_folio' AS table_name, count(*)::int AS row_count FROM public.entrada_folio
  UNION ALL SELECT 'salida_folio', count(*)::int FROM public.salida_folio
  UNION ALL SELECT 'viaje_folio', count(*)::int FROM public.viaje_folio
  UNION ALL SELECT 'auditoria_inventario_folio', count(*)::int FROM public.auditoria_inventario_folio
  UNION ALL SELECT 'ticket_folio', count(*)::int FROM public.ticket_folio
  UNION ALL SELECT 'series_consecutivo', count(*)::int FROM public.series_consecutivo
) AS counts ORDER BY array_position(ARRAY['entrada_folio','salida_folio','viaje_folio','auditoria_inventario_folio','ticket_folio','series_consecutivo'], table_name);
```

Filas:

```sql
SELECT * FROM (
  SELECT 'entrada_folio' AS table_name, ubicacion_id::text AS control_key, ultimo_folio::text AS control_value FROM public.entrada_folio
  UNION ALL SELECT 'salida_folio', ubicacion_id::text, ultimo_folio::text FROM public.salida_folio
  UNION ALL SELECT 'viaje_folio', ubicacion_id::text, ultimo_folio::text FROM public.viaje_folio
  UNION ALL SELECT 'auditoria_inventario_folio', ubicacion_id::text, ultimo_folio::text FROM public.auditoria_inventario_folio
  UNION ALL SELECT 'ticket_folio', id::text, ultimo_folio::text FROM public.ticket_folio
  UNION ALL SELECT 'series_consecutivo', id::text, ultimo_numero::text FROM public.series_consecutivo
) AS rows ORDER BY array_position(ARRAY['entrada_folio','salida_folio','viaje_folio','auditoria_inventario_folio','ticket_folio','series_consecutivo'], table_name), control_key::bigint;
```

Transaction state and close:

```sql
SELECT current_setting('transaction_read_only') AS transaction_read_only, current_setting('transaction_isolation') AS transaction_isolation;
ROLLBACK;
```
