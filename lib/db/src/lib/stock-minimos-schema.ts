import type { Pool } from "pg";

/**
 * Version 1 of the minimum-stock ledger/configuration schema.
 *
 * This is an additive, repeatable startup migration.  It intentionally does
 * not seed sites, products, users, role rows, or minimum values.
 */
export const STOCK_MINIMOS_SCHEMA_VERSION = 1;

export async function ensureStockMinimosSchema(
  pool: Pick<Pool, "query">,
): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_minimo_sitios (
      ubicacion_id integer PRIMARY KEY REFERENCES ubicaciones(id),
      habilitado boolean NOT NULL DEFAULT false,
      updated_by integer REFERENCES usuarios(id),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS stock_minimos (
      id serial PRIMARY KEY,
      producto_id integer NOT NULL REFERENCES productos(id),
      ubicacion_id integer NOT NULL REFERENCES ubicaciones(id),
      cantidad numeric(18,3) NOT NULL,
      updated_by integer REFERENCES usuarios(id),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT stock_minimos_cantidad_nonnegative_check CHECK (cantidad >= 0),
      CONSTRAINT stock_minimos_producto_ubicacion_unique
        UNIQUE (producto_id, ubicacion_id)
    );
    ALTER TABLE stock_minimos
      ADD COLUMN IF NOT EXISTS updated_by integer REFERENCES usuarios(id),
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
    DO $stock_minimos_constraints$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'stock_minimos'::regclass
          AND conname = 'stock_minimos_cantidad_nonnegative_check'
      ) THEN
        ALTER TABLE stock_minimos
          ADD CONSTRAINT stock_minimos_cantidad_nonnegative_check
          CHECK (cantidad >= 0);
      END IF;
    END
    $stock_minimos_constraints$;

    CREATE INDEX IF NOT EXISTS stock_minimos_ubicacion_idx
      ON stock_minimos(ubicacion_id);
    CREATE UNIQUE INDEX IF NOT EXISTS stock_minimos_producto_ubicacion_uidx
      ON stock_minimos(producto_id, ubicacion_id);

    CREATE TABLE IF NOT EXISTS stock_minimo_episodios (
      id serial PRIMARY KEY,
      producto_id integer NOT NULL REFERENCES productos(id),
      ubicacion_id integer NOT NULL REFERENCES ubicaciones(id),
      minimo numeric(18,3) NOT NULL CHECK (minimo >= 0),
      existencia numeric(18,3) NOT NULL CHECK (existencia >= 0),
      diferencia numeric(18,3) NOT NULL CHECK (diferencia >= 0),
      abierto_at timestamptz NOT NULL DEFAULT now(),
      cerrado_at timestamptz,
      movimiento_id bigint REFERENCES movimientos(id)
    );
    CREATE INDEX IF NOT EXISTS stock_minimo_episodios_ubicacion_abierto_idx
      ON stock_minimo_episodios(ubicacion_id, cerrado_at);
    CREATE UNIQUE INDEX IF NOT EXISTS stock_minimo_episodios_activo_uidx
      ON stock_minimo_episodios(producto_id, ubicacion_id)
      WHERE cerrado_at IS NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS
      notificaciones_sistema_stock_minimo_episode_recipient_uidx
      ON notificaciones_sistema(entidad, entidad_id, destinatario_usuario_id)
      WHERE tipo = 'STOCK_MINIMO';
  `);
}