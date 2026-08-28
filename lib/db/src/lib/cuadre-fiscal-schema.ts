import type { Pool } from "pg";

/** Persistent, append-only fiscal reconciliation records. */
export async function ensureCuadreFiscalSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cuadre_fiscal_registros (
      id serial PRIMARY KEY,
      tipo text NOT NULL CHECK (tipo IN ('CONFIRMACION','DIFERENCIA')),
      desde date NOT NULL, hasta date NOT NULL,
      ubicacion_id integer REFERENCES ubicaciones(id),
      facturado_congelado numeric(12,2) NOT NULL,
      actor_id integer NOT NULL REFERENCES usuarios(id),
      direccion text CHECK (direccion IN ('MAS','MENOS')),
      monto numeric(12,2),
      descripcion text,
      estado text NOT NULL CHECK (estado IN ('CONFIRMADA','PENDIENTE','RESUELTA')),
      nota_resolucion text,
      resuelto_por_id integer REFERENCES usuarios(id),
      resuelto_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      CHECK ((tipo='CONFIRMACION' AND estado='CONFIRMADA') OR tipo='DIFERENCIA'),
      CHECK ((tipo='DIFERENCIA' AND monto > 0 AND char_length(descripcion) >= 20 AND direccion IS NOT NULL) OR tipo='CONFIRMACION')
    );
    CREATE INDEX IF NOT EXISTS cuadre_fiscal_registros_created_idx
      ON cuadre_fiscal_registros (created_at DESC);
  `);
}