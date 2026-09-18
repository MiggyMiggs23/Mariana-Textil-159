# Inventario SQL E10 (propuesto, no ejecutado)

## Congelación y lista de sentencias

- `operativo.sql` SHA-256: `a7eb52a85b3b3b6072d1b88941b9998bcafe15b253e52b0520b8bfc8cc43cdb4`
- 30 sentencias superiores, en orden: `BEGIN`; `SET LOCAL search_path`; preflight `DO`; 3 `CREATE TABLE`; 1 `CREATE SEQUENCE`; 1 `ALTER SEQUENCE ... OWNED BY`; 1 `INSERT` de identidad sin saldo; 8 `CREATE INDEX`; 4 `CREATE FUNCTION`; 8 `CREATE TRIGGER`; `COMMIT`.
- `negative-probes.sql` SHA-256: `5df2279b4cb81d24673a1cae14f06d3827fc2dd99f64c4ad79509e439b305b11`.

Los hashes corresponden a los bytes finales entregados; cualquier cambio posterior exige recalcularlos antes del ensayo.

## Tablas (3)
- `fondo_mariana`
- `fondo_movimientos`
- `fondo_arqueos`

## Secuencias (1)
- `fondo_movimientos_ordinal_seq`, creada explícitamente y propiedad de `fondo_movimientos.ordinal`; el trigger toma primero el mismo lock del Fondo y después llama `nextval`, por lo que produce el orden monótono autoritativo. Las claves públicas E10 siguen siendo UUID.

## Claves y constraints
- PK: `fondo_mariana_pkey`, `fondo_movimientos_pkey`, `fondo_arqueos_pkey`.
- FK: Fondo→`ubicaciones`; movimientos/arqueos→Fondo y `usuarios`; movimiento inverso→movimiento; versión arqueo→movimiento.
- Checks: nombre fijo; naturaleza, categoría, centavos, productor y motivo de movimiento; conteo, diferencia, productor y motivo de arqueo; hash SHA-256 canónico.

## Índices explícitos
- `fondo_mariana_singleton_uidx`
- `fondo_mariana_ubicacion_uidx`
- `fondo_movimientos_productor_idempotencia_uidx`
- `fondo_movimientos_original_uidx`
- `fondo_movimientos_ordinal_uidx`
- `fondo_movimientos_fondo_ordinal_idx`
- `fondo_arqueos_productor_idempotencia_uidx`
- `fondo_arqueos_fondo_fecha_idx`

Los PK/FK/unique constraints pueden crear además sus índices de soporte PostgreSQL.

## Funciones (4)
- `fondo_assert_fixed_mariana()`
- `fondo_reject_mutation()`
- `fondo_validate_movement()`
- `fondo_validate_audit()`

## Triggers (8)
- `fondo_mariana_fixed_before_mutation`
- `fondo_mariana_immutable_before_truncate`
- `fondo_movimientos_validate_before_insert`
- `fondo_movimientos_immutable_before_mutation`
- `fondo_movimientos_immutable_before_truncate`
- `fondo_arqueos_validate_before_insert`
- `fondo_arqueos_immutable_before_mutation`
- `fondo_arqueos_immutable_before_truncate`

## Lock y datos de migración
Los dos validadores escritores toman el advisory transaction lock entero `4600112`. La migración inserta una sola identidad (sin saldo) resuelta por exactamente una ubicación activa, tipo `TIENDA`, nombre normalizado `MARIANA`. El bloque preflight aborta ante identidad ambigua/ausente, dependencias ausentes u objetos E10 preexistentes.

La primera sentencia tras `BEGIN` fija localmente `search_path = public, pg_catalog`; no depende del `search_path` del helper aislado y no cambia configuración fuera de la transacción. Los tres triggers `BEFORE TRUNCATE FOR EACH STATEMENT` cierran la vía de borrado masivo sin tocar tablas antiguas.

`fondo_validate_movement()` valida con `IS DISTINCT FROM`, `jsonb_typeof` y `coalesce` que la conciliación inicial sea un objeto, que declaración sea el booleano JSON `true`, que conteo/evidencia sean strings presentes, que el conteo sea dinero canónico y coincida al centavo. Así valores SQL/JSON `null` o claves ausentes no atraviesan lógica ternaria.

Pruebas SQL negativas separadas: `negative-probes.sql` (declaración ausente, conteo ausente, conciliación JSON `null` y `TRUNCATE` simple bloqueado); no forman objetos persistentes ni usan `CASCADE`.