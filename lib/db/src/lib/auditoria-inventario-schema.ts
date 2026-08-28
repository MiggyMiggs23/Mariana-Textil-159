import type { Pool } from "pg";

/** Repeatable schema application for physical inventory audits. */
export async function ensureAuditoriaInventarioSchema(
  pool: Pick<Pool, "connect">,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(7003057)");
    await client.query(`
      CREATE TABLE IF NOT EXISTS auditoria_inventario_folio (
        ubicacion_id integer PRIMARY KEY REFERENCES ubicaciones(id),
        ultimo_folio integer NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS auditorias_inventario (
        id serial PRIMARY KEY,
        folio integer NOT NULL,
        ubicacion_id integer NOT NULL REFERENCES ubicaciones(id),
        estado text NOT NULL DEFAULT 'ABIERTA'
          CHECK (estado IN ('ABIERTA','CERRADA','CANCELADA','CONFIRMADA')),
        creada_por_id integer NOT NULL REFERENCES usuarios(id),
        cerrada_por_id integer REFERENCES usuarios(id),
        confirmada_por_id integer REFERENCES usuarios(id),
        cancelada_por_id integer REFERENCES usuarios(id),
        motivo_cancelacion text,
        abierta_at timestamptz NOT NULL DEFAULT now(),
        cerrada_at timestamptz,
        confirmada_at timestamptz,
        cancelada_at timestamptz,
        UNIQUE (ubicacion_id, folio)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS auditorias_inventario_una_abierta_por_sitio
        ON auditorias_inventario(ubicacion_id) WHERE estado = 'ABIERTA';
      CREATE INDEX IF NOT EXISTS auditorias_inventario_ubicacion_idx
        ON auditorias_inventario(ubicacion_id);
      CREATE TABLE IF NOT EXISTS auditoria_inventario_snapshot (
        auditoria_id integer NOT NULL REFERENCES auditorias_inventario(id),
        rollo_id integer NOT NULL REFERENCES rollos(id),
        serie text NOT NULL,
        cantidad_snapshot numeric(10,3) NOT NULL,
        sku_snapshot text NOT NULL,
        tela_snapshot text NOT NULL,
        color_snapshot text NOT NULL,
        unidad_snapshot text NOT NULL,
        ubicacion_snapshot_id integer NOT NULL REFERENCES ubicaciones(id),
        ubicacion_snapshot text NOT NULL,
        estado_snapshot text NOT NULL,
        resolucion text NOT NULL DEFAULT 'PENDIENTE',
        PRIMARY KEY (auditoria_id, serie)
      );
      CREATE INDEX IF NOT EXISTS auditoria_inventario_snapshot_rollo_idx
        ON auditoria_inventario_snapshot(rollo_id);
      CREATE TABLE IF NOT EXISTS auditoria_inventario_escaneos (
        auditoria_id integer NOT NULL REFERENCES auditorias_inventario(id),
        serie text NOT NULL,
        rollo_id integer REFERENCES rollos(id),
        usuario_id integer NOT NULL REFERENCES usuarios(id),
        escaneado_at timestamptz NOT NULL DEFAULT now(),
        cantidad_cierre numeric(10,3),
        sku_cierre text,
        tela_cierre text,
        color_cierre text,
        unidad_cierre text,
        estado_cierre text,
        ubicacion_cierre_id integer REFERENCES ubicaciones(id),
        ubicacion_cierre text,
        resolucion text NOT NULL DEFAULT 'PENDIENTE',
        PRIMARY KEY (auditoria_id, serie)
      );
      ALTER TABLE auditoria_inventario_snapshot
        ADD COLUMN IF NOT EXISTS cantidad_snapshot numeric(10,3),
        ADD COLUMN IF NOT EXISTS sku_snapshot text,
        ADD COLUMN IF NOT EXISTS tela_snapshot text,
        ADD COLUMN IF NOT EXISTS color_snapshot text,
        ADD COLUMN IF NOT EXISTS unidad_snapshot text,
        ADD COLUMN IF NOT EXISTS ubicacion_snapshot_id integer REFERENCES ubicaciones(id),
        ADD COLUMN IF NOT EXISTS ubicacion_snapshot text,
        ADD COLUMN IF NOT EXISTS estado_snapshot text,
        ADD COLUMN IF NOT EXISTS resolucion text NOT NULL DEFAULT 'PENDIENTE';
      UPDATE auditoria_inventario_snapshot s
        SET cantidad_snapshot = r.cantidad_actual
        FROM rollos r
        WHERE s.rollo_id = r.id AND s.cantidad_snapshot IS NULL;
      UPDATE auditoria_inventario_snapshot
        SET cantidad_snapshot = 0 WHERE cantidad_snapshot IS NULL;
      UPDATE auditoria_inventario_snapshot s
      SET sku_snapshot = COALESCE(p.sku, 'DESCONOCIDO'),
          tela_snapshot = COALESCE(p.tela, 'DESCONOCIDO'),
          color_snapshot = COALESCE(p.color, 'DESCONOCIDO'),
          unidad_snapshot = COALESCE(p.unidad::text, 'DESCONOCIDA'),
          ubicacion_snapshot_id = COALESCE(r.ubicacion_id, 0),
          ubicacion_snapshot = COALESCE(u.nombre, 'DESCONOCIDO'),
          estado_snapshot = COALESCE(r.estado::text, 'SIN_REGISTRO')
      FROM rollos r
      LEFT JOIN productos p ON p.id=r.producto_id
      LEFT JOIN ubicaciones u ON u.id=r.ubicacion_id
      WHERE s.rollo_id=r.id AND (
        s.sku_snapshot IS NULL OR s.tela_snapshot IS NULL OR s.color_snapshot IS NULL
        OR s.unidad_snapshot IS NULL OR s.ubicacion_snapshot_id IS NULL
        OR s.ubicacion_snapshot IS NULL OR s.estado_snapshot IS NULL
      );
      UPDATE auditoria_inventario_snapshot
      SET sku_snapshot = COALESCE(sku_snapshot, 'DESCONOCIDO'),
          tela_snapshot = COALESCE(tela_snapshot, 'DESCONOCIDO'),
          color_snapshot = COALESCE(color_snapshot, 'DESCONOCIDO'),
          unidad_snapshot = COALESCE(unidad_snapshot, 'DESCONOCIDA'),
          ubicacion_snapshot_id = COALESCE(ubicacion_snapshot_id, 0),
          ubicacion_snapshot = COALESCE(ubicacion_snapshot, 'DESCONOCIDO'),
          estado_snapshot = COALESCE(estado_snapshot, 'SIN_REGISTRO');
      ALTER TABLE auditoria_inventario_snapshot
        ALTER COLUMN cantidad_snapshot SET NOT NULL,
        ALTER COLUMN sku_snapshot SET NOT NULL,
        ALTER COLUMN tela_snapshot SET NOT NULL,
        ALTER COLUMN color_snapshot SET NOT NULL,
        ALTER COLUMN unidad_snapshot SET NOT NULL,
        ALTER COLUMN ubicacion_snapshot_id SET NOT NULL,
        ALTER COLUMN ubicacion_snapshot SET NOT NULL,
        ALTER COLUMN estado_snapshot SET NOT NULL;
      ALTER TABLE auditoria_inventario_escaneos
        ADD COLUMN IF NOT EXISTS cantidad_cierre numeric(10,3),
        ADD COLUMN IF NOT EXISTS sku_cierre text,
        ADD COLUMN IF NOT EXISTS tela_cierre text,
        ADD COLUMN IF NOT EXISTS color_cierre text,
        ADD COLUMN IF NOT EXISTS unidad_cierre text,
        ADD COLUMN IF NOT EXISTS estado_cierre text,
        ADD COLUMN IF NOT EXISTS ubicacion_cierre_id integer REFERENCES ubicaciones(id),
        ADD COLUMN IF NOT EXISTS ubicacion_cierre text,
        ADD COLUMN IF NOT EXISTS resolucion text NOT NULL DEFAULT 'PENDIENTE';
      UPDATE auditoria_inventario_escaneos e
      SET cantidad_cierre = COALESCE(e.cantidad_cierre, r.cantidad_actual),
          sku_cierre = COALESCE(e.sku_cierre, p.sku),
          tela_cierre = COALESCE(e.tela_cierre, p.tela),
          color_cierre = COALESCE(e.color_cierre, p.color),
          unidad_cierre = COALESCE(e.unidad_cierre, p.unidad::text),
          estado_cierre = COALESCE(e.estado_cierre, r.estado::text),
          ubicacion_cierre_id = COALESCE(e.ubicacion_cierre_id, r.ubicacion_id),
          ubicacion_cierre = COALESCE(e.ubicacion_cierre, u.nombre)
      FROM rollos r
      JOIN productos p ON p.id=r.producto_id
      JOIN ubicaciones u ON u.id=r.ubicacion_id
      WHERE e.rollo_id=r.id AND (
        e.cantidad_cierre IS NULL OR e.sku_cierre IS NULL OR e.tela_cierre IS NULL
        OR e.color_cierre IS NULL OR e.unidad_cierre IS NULL OR e.estado_cierre IS NULL
        OR e.ubicacion_cierre_id IS NULL OR e.ubicacion_cierre IS NULL
      );
      UPDATE auditoria_inventario_escaneos
      SET estado_cierre = COALESCE(estado_cierre, 'SIN_REGISTRO')
      WHERE estado_cierre IS NULL AND rollo_id IS NULL;
      CREATE INDEX IF NOT EXISTS auditoria_inventario_escaneos_usuario_idx
        ON auditoria_inventario_escaneos(usuario_id);
      CREATE TABLE IF NOT EXISTS auditoria_inventario_participantes (
        auditoria_id integer NOT NULL REFERENCES auditorias_inventario(id),
        usuario_id integer NOT NULL REFERENCES usuarios(id),
        escaneos integer NOT NULL DEFAULT 0,
        primero_at timestamptz NOT NULL DEFAULT now(),
        ultimo_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (auditoria_id, usuario_id)
      );
      INSERT INTO permisos_rol
        (rol, modulo, puede_ver, puede_crear, puede_editar, puede_autorizar)
      VALUES
        ('TERMINAL', 'auditoria_inventario', false, false, false, false),
        ('CAJA', 'auditoria_inventario', false, false, false, false),
        ('SUPERVISOR', 'auditoria_inventario', true, true, true, false),
        ('BODEGA', 'auditoria_inventario', true, true, true, false),
        ('SISTEMAS', 'auditoria_inventario', true, true, true, false),
        ('CONTADOR', 'auditoria_inventario', false, false, false, false)
      ON CONFLICT (rol, modulo) DO NOTHING;
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}