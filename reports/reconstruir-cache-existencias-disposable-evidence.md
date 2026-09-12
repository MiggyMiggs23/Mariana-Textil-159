# reconstruirCacheExistencias — evidencia en PostgreSQL descartable

- **Estado:** PASS
- **Alcance:** clúster local nuevo de PostgreSQL, únicamente base descartable; no hubo conexión con la base de aplicación, desarrollo o producción.
- **Función real:** `reconstruirCacheExistencias()` importada de `artifacts/api-server/src/lib/inventario.ts`; BD simulada: no.
- **Política del actor:** se copió/restauró **un solo registro de actor existente** del respaldo local capturado únicamente en la BD descartable para satisfacer la FK no nula `movimientos.usuario_id`. Esto sí fue un `INSERT` de restauración en la BD descartable; **no** se creó una cuenta de prueba nueva ni credenciales, y **no** se tocaron cuentas operativas.
- **Precondición de inicializador:** se restauró del respaldo capturado la línea base no relacionada con usuarios de `clientes`; este reporte no incluye valores de clientes.
- **Esquema:** se aplicó el esquema completo vigente de Drizzle; terminaron todos los inicializadores/migraciones de arranque exportados. No se ejecutó el script de seed.

## Comprobaciones de identidad

- Antes de las mutaciones de la base objetivo: `{"current_database":"disposable_inventory_rebuild","current_user":"runner","data_directory":"/tmp/rebuild-cache-pg-1789182009-1765","server_addr":"127.0.0.1/32","server_port":55440}`
- Después de la reconstrucción: `{"current_database":"disposable_inventory_rebuild","current_user":"runner","data_directory":"/tmp/rebuild-cache-pg-1789182009-1765","server_addr":"127.0.0.1/32","server_port":55440}`
- Identidad del clúster local antes de crear la base: `{"current_database" : "postgres", "current_user" : "runner", "data_directory" : "/tmp/rebuild-cache-pg-1789182009-1765","server_addr" : null, "server_port" : null}`
- Identidad de la base objetivo antes de mutar esquema/fixtures (socket Unix): `{"current_database":"disposable_inventory_rebuild","current_user":"runner","data_directory":"/tmp/rebuild-cache-pg-1789182009-1765","server_addr":null,"server_port":null}`

## Conteos antes/después

| Tabla | Antes | Después |
|---|---:|---:|
| existencias | 4 | 4 |
| movimientos | 9 | 9 |
| rollos | 5 | 5 |
| stock_minimos | 2 | 2 |
| stock_minimo_sitios | 2 | 2 |

## Valores de caché después de la reconstrucción

| producto_id | ubicacion_id | cantidad_total | rollos_count | updated_at |
|---:|---:|---:|---:|---|
| 1 | 1 | 8.000 | 1 | 2026-09-12T03:00:18.695Z |
| 1 | 2 | 7.000 | 1 | 2026-09-12T03:00:18.695Z |
| 2 | 1 | 2.250 | 1 | 2026-09-12T03:00:18.695Z |
| 2 | 2 | 0.000 | 0 | 2026-09-12T03:00:18.695Z |

## Valores de caché antes de la reconstrucción

| producto_id | ubicacion_id | cantidad_total | rollos_count | updated_at |
|---:|---:|---:|---:|---|
| 1 | 1 | 99.999 | 99 | 2026-09-12T03:00:18.695Z |
| 1 | 2 | 88.888 | 88 | 2026-09-12T03:00:18.695Z |
| 2 | 1 | 77.777 | 77 | 2026-09-12T03:00:18.695Z |
| 2 | 2 | 66.666 | 66 | 2026-09-12T03:00:18.695Z |

Los valores posteriores esperados son iguales a la suma firmada del kardex y al conteo de rollos `DISPONIBLE` de cada par; los cuatro valores previos, deliberadamente obsoletos, cambiaron y coinciden con la evidencia del kardex.

## Configuración de mínimos antes/después

Las siguientes filas exactas fueron profundamente iguales antes y después de reconstruir el caché.

| SKU | Sitio | mínimo | habilitado | mínimo updated_by | mínimo updated_at | sitio updated_by | sitio updated_at |
|---|---|---:|---|---:|---|---:|---|
| REBUILD-P1 | RA | 5.125 | true | null | 2026-01-02T03:06:07.000Z | null | 2026-01-02T03:04:05.000Z |
| REBUILD-P1 | RB | null/sin mínimo | true | null | null | null | 2026-01-02T03:05:06.000Z |
| REBUILD-P2 | RA | 0.000 | true | null | 2026-01-02T03:07:08.000Z | null | 2026-01-02T03:04:05.000Z |
| REBUILD-P2 | RB | null/sin mínimo | true | null | null | null | 2026-01-02T03:05:06.000Z |

Se capturaron dos mínimos numéricos y dos pares sin mínimo (`null`); ambos interruptores de sitio estaban habilitados y no cambiaron.

## Afirmaciones

- El caché posterior es igual a las sumas del kardex más los conteos de rollos disponibles: **PASS**
- El caché previo estaba obsoleto y cambió después de la función real: **PASS**
- Se conservaron los conteos y la configuración de mínimos antes/después (incluidos autor/fechas anulables y ajustes de sitio): **PASS**
- El fixture del kardex referencia rollos físicos y tiene pares válidos de producto/sitio: **PASS**

## Honestidad sobre pruebas

- Afirmaciones de la verificación independiente contra la base: **PASS**.
- Suites del repositorio: **no ejecutadas**; no se tocaron intencionalmente los workflows de aplicación, el preview ni los logs de workflows.
- No se presentó ninguna prueba simulada como sustituto de esta ejecución real contra PostgreSQL.
- Se conservó el script independiente sanitizado y protegido en `scripts/src/reconstruir-cache-existencias-disposable-verification.mts`; no se volvió a ejecutar ni crea recursos automáticamente.

## Traza sanitizada de comandos

- initdb -D <temporary-local-data-dir> --auth=trust --no-locale --encoding=UTF8
- pg_ctl -D <temporary-local-data-dir> ... -k <temporary-local-socket> -p <temporary-local-port> start
- createdb -h <temporary-local-socket> -p <temporary-local-port> <disposable-db>
- pnpm --filter @workspace/db run push-force (DATABASE_URL=<disposable-local-url>)
- pg_restore --data-only --table=usuarios <captured-dump> (se restauró un solo actor existente; no se creó cuenta nueva ni se ejecutó seed)
- pg_restore --data-only --table=clientes <captured-dump> (solo línea base no relacionada con usuarios para el inicializador; no se ejecutó seed)
- pnpm --filter @workspace/api-server exec tsx <startup-initializers-script>
- psql <fixture-sql> (2 productos × 2 sitios, mínimos/configuración, kardex y caché obsoleto)
- pnpm --filter @workspace/api-server exec tsx <real-function-verification-script>

## Limpieza

Terminó el desmantelamiento del clúster descartable; se verificó que no existen el directorio de datos ni el socket temporales creados.
