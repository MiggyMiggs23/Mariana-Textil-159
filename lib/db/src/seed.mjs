import pg from "pg";
import {
  MATRIX,
  MODULOS,
  ROLES,
  assertSeedPermissionMatrix,
} from "./lib/seed-permissions.mjs";
import {
  ADVISORY_LOCK_NAMESPACES,
  transactionAdvisoryLock,
} from "./lib/advisory-locks.mjs";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const adminSeedPassword = process.env.ADMIN_SEED_PASSWORD;

if (!connectionString) {
  throw new Error("DATABASE_URL es obligatoria para ejecutar el seed.");
}

if (!adminSeedPassword) {
  throw new Error("ADMIN_SEED_PASSWORD es obligatoria para ejecutar el seed.");
}

const pool = new Pool({ connectionString });

assertSeedPermissionMatrix();

try {
  // Bootstrap the role rename before any query can mention the new label.
  const migrationClient = await pool.connect();
  let supportUserCount = 0;
  try {
    await migrationClient.query("BEGIN");
    await transactionAdvisoryLock(
      migrationClient,
      ADVISORY_LOCK_NAMESPACES.SCHEMA_ROLE,
    );
    const { rows: supportUsers } = await migrationClient.query(`
      SELECT count(*)::int AS count
      FROM usuarios
      WHERE rol::text = 'SOPORTE'
    `);
    supportUserCount = supportUsers[0]?.count ?? 0;
    await migrationClient.query(`
      DO $$
      DECLARE
        has_legacy boolean;
        has_supervisor boolean;
        has_soporte boolean;
        has_sistemas boolean;
      BEGIN
      SELECT EXISTS (
        SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'rol_usuario' AND e.enumlabel = 'INVENTARIOS'
      ) INTO has_legacy;
      SELECT EXISTS (
        SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'rol_usuario' AND e.enumlabel = 'SUPERVISOR'
      ) INTO has_supervisor;
      IF has_legacy AND has_supervisor THEN
        RAISE EXCEPTION
          'rol_usuario contiene INVENTARIOS y SUPERVISOR; se requiere reparación manual';
      ELSIF has_legacy THEN
        ALTER TYPE rol_usuario RENAME VALUE 'INVENTARIOS' TO 'SUPERVISOR';
      END IF;
      SELECT EXISTS (
        SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'rol_usuario' AND e.enumlabel = 'SOPORTE'
      ) INTO has_soporte;
      SELECT EXISTS (
        SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'rol_usuario' AND e.enumlabel = 'SISTEMAS'
      ) INTO has_sistemas;
      IF has_soporte AND has_sistemas THEN
        RAISE EXCEPTION
          'rol_usuario contiene SOPORTE y SISTEMAS; se requiere reparación manual';
      ELSIF has_soporte THEN
        ALTER TYPE rol_usuario RENAME VALUE 'SOPORTE' TO 'SISTEMAS';
      ELSIF NOT has_sistemas THEN
        ALTER TYPE rol_usuario ADD VALUE 'SISTEMAS';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'rol_usuario' AND e.enumlabel = 'CONTADOR'
      ) THEN
        ALTER TYPE rol_usuario ADD VALUE 'CONTADOR';
      END IF;
      IF EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'usuarios'
             AND column_name = 'alcance_consulta'
         ) AND EXISTS (
           SELECT 1
           FROM pg_type t
           JOIN pg_enum e ON e.enumtypid = t.oid
           WHERE t.typname = 'rol_usuario' AND e.enumlabel = 'SUPERVISOR'
         ) THEN
        UPDATE usuarios
        SET alcance_consulta = 'TODAS'
        WHERE rol = 'SUPERVISOR'
          AND alcance_consulta IS DISTINCT FROM 'TODAS';
      END IF;
      END $$;
    `);
    await migrationClient.query("COMMIT");
  } catch (error) {
    await migrationClient.query("ROLLBACK");
    throw error;
  } finally {
    migrationClient.release();
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS choferes (
      id serial PRIMARY KEY,
      nombre_completo text NOT NULL,
      telefono text NOT NULL,
      activo boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS choferes_activo_idx ON choferes (activo);
    CREATE INDEX IF NOT EXISTS choferes_nombre_completo_idx ON choferes (nombre_completo);
  `);
  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS camionetas (
      id serial PRIMARY KEY,
      nombre text NOT NULL,
      placas text NOT NULL,
      marca text,
      modelo text,
      tipo text NOT NULL,
      activa boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT camionetas_tipo_check CHECK (tipo IN ('PROPIA', 'CONTRATADA'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS camionetas_placas_unique ON camionetas (placas);
    CREATE INDEX IF NOT EXISTS camionetas_activa_idx ON camionetas (activa);
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS viaje_folio (
      ubicacion_id integer PRIMARY KEY REFERENCES ubicaciones(id),
      ultimo_folio integer NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS viajes (
      id serial PRIMARY KEY, folio integer NOT NULL,
      origen_id integer NOT NULL REFERENCES ubicaciones(id),
      camioneta_id integer NOT NULL REFERENCES camionetas(id),
      chofer_id integer NOT NULL REFERENCES choferes(id),
      salida_at timestamptz NOT NULL, observaciones text,
      creado_por_id integer NOT NULL REFERENCES usuarios(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT viajes_origen_folio_unique UNIQUE (origen_id, folio)
    );
    CREATE TABLE IF NOT EXISTS viaje_tickets (
      viaje_id integer NOT NULL REFERENCES viajes(id),
      ticket_id integer NOT NULL REFERENCES tickets(id),
      CONSTRAINT viaje_tickets_ticket_unique UNIQUE(ticket_id)
    );
    CREATE TABLE IF NOT EXISTS viaje_salidas (
      viaje_id integer NOT NULL REFERENCES viajes(id),
      salida_id integer NOT NULL REFERENCES salidas(id),
      CONSTRAINT viaje_salidas_salida_unique UNIQUE(salida_id)
    );
    CREATE INDEX IF NOT EXISTS viaje_tickets_viaje_idx ON viaje_tickets(viaje_id);
    CREATE INDEX IF NOT EXISTS viaje_salidas_viaje_idx ON viaje_salidas(viaje_id);
  `);

  const locations = [
    ["Mariana", "MA", "TIENDA"],
    ["Cruces", "CR", "TIENDA"],
    ["Coco", "CO", "TIENDA"],
    ["Tomás", "TO", "BODEGA"],
    ["Don Nacho", "DN", "BODEGA"],
    ["Lucas Alamán", "LA", "BODEGA"],
    ["Bodega Cruces", "BC", "BODEGA"],
    ["En tránsito", "TR", "TRANSITO"],
    ["Externo", "EX", "EXTERNO"],
  ];

  for (const [nombre, iniciales, tipo] of locations) {
    await pool.query(
      `INSERT INTO ubicaciones (nombre, iniciales, tipo)
       VALUES ($1, $2, $3)
       ON CONFLICT (nombre) DO UPDATE SET
         iniciales = EXCLUDED.iniciales,
         tipo = EXCLUDED.tipo`,
      [nombre, iniciales, tipo],
    );
  }

  await pool.query(
    `INSERT INTO usuarios (nombre, usuario, password_hash, rol, ubicacion_id)
     VALUES ('Administrador', 'admin', crypt($1, gen_salt('bf', 12)), 'ADMIN', NULL)
     ON CONFLICT (usuario) DO NOTHING`,
    [adminSeedPassword],
  );

  // Protected fallback customer. Explicit id + sequence repair makes this
  // safe both on fresh databases and installations with existing customers.
  await pool.query(`
    -- Upgrade-safe ticket document fields. Existing records remain TICKET.
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS documento_tipo text;
     ALTER TABLE tickets ADD COLUMN IF NOT EXISTS nota_sin_precios boolean NOT NULL DEFAULT false;
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS nombre_destinatario text;
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS direccion_entrega_snapshot text;
    UPDATE tickets SET documento_tipo = 'TICKET' WHERE documento_tipo IS NULL;
    ALTER TABLE tickets ALTER COLUMN documento_tipo SET DEFAULT 'TICKET';
    ALTER TABLE tickets ALTER COLUMN documento_tipo SET NOT NULL;
    ALTER TABLE clientes ADD COLUMN IF NOT EXISTS es_sistema boolean NOT NULL DEFAULT false;
    ALTER TABLE clientes ADD COLUMN IF NOT EXISTS contacto_nombre text;
     ALTER TABLE clientes ADD COLUMN IF NOT EXISTS recibe_nota_sin_precios boolean NOT NULL DEFAULT false;
    ALTER TABLE clientes ADD COLUMN IF NOT EXISTS dias_credito integer NOT NULL DEFAULT 0;
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clientes' AND column_name='direccion')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clientes' AND column_name='direccion_particular') THEN
        ALTER TABLE clientes RENAME COLUMN direccion TO direccion_particular;
      ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clientes' AND column_name='direccion') THEN
        UPDATE clientes SET direccion_particular=COALESCE(direccion_particular,direccion);
        ALTER TABLE clientes DROP COLUMN direccion;
      END IF;
    END $$;
    ALTER TABLE clientes ADD COLUMN IF NOT EXISTS direccion_particular text;
    ALTER TABLE clientes ADD COLUMN IF NOT EXISTS direccion_entrega text;
    DO $$
    DECLARE replacement_id integer;
    BEGIN
      IF EXISTS (SELECT 1 FROM clientes WHERE id=1 AND NOT es_sistema) THEN
        SELECT nextval(pg_get_serial_sequence('clientes', 'id')) INTO replacement_id;
        ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_cliente_id_clientes_id_fk;
        ALTER TABLE movimientos_credito DROP CONSTRAINT IF EXISTS movimientos_credito_cliente_id_clientes_id_fk;
        UPDATE tickets SET cliente_id=replacement_id WHERE cliente_id=1;
        UPDATE movimientos_credito SET cliente_id=replacement_id WHERE cliente_id=1;
        UPDATE clientes SET id=replacement_id WHERE id=1;
        ALTER TABLE tickets ADD CONSTRAINT tickets_cliente_id_clientes_id_fk
          FOREIGN KEY (cliente_id) REFERENCES clientes(id);
        ALTER TABLE movimientos_credito ADD CONSTRAINT movimientos_credito_cliente_id_clientes_id_fk
          FOREIGN KEY (cliente_id) REFERENCES clientes(id);
      END IF;
    END $$;
    INSERT INTO clientes
      (id, nombre, activo, es_sistema, limite_credito, saldo_credito, dias_credito)
    VALUES (1, 'Venta a Público', true, true, 0, 0, 0)
    ON CONFLICT (id) DO UPDATE SET
      nombre = CASE WHEN clientes.es_sistema THEN 'Venta a Público' ELSE clientes.nombre END,
      activo = true, es_sistema = true,
      limite_credito = 0, dias_credito = 0;
    SELECT setval(pg_get_serial_sequence('clientes', 'id'),
      GREATEST((SELECT COALESCE(MAX(id), 1) FROM clientes), 1), true);
    UPDATE tickets SET cliente_id = 1 WHERE cliente_id IS NULL;
    INSERT INTO clientes (nombre, activo, es_sistema, limite_credito, saldo_credito, dias_credito)
    SELECT seed.nombre, true, false, 0, 0, 0
    FROM (VALUES ('Rafael Flores'), ('Jacinta Mendoza'), ('Hilario Bonifacio'),
      ('Jesús López'), ('José López'), ('Miguel Esteban')) seed(nombre)
    WHERE NOT EXISTS (
      SELECT 1 FROM clientes c
      WHERE lower(translate(btrim(c.nombre), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')) =
            lower(translate(btrim(seed.nombre), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'))
    );
  `);

  await pool.query(
    `DELETE FROM permisos_usuario
     WHERE usuario_id IN (SELECT id FROM usuarios WHERE rol = 'ADMIN')`,
  );
  await pool.query("DELETE FROM permisos_rol WHERE rol = 'ADMIN'");

  // Only maintain configurable role/module rows. This never touches users,
  // their overrides, operational data, or the ADMIN bypass.
  await pool.query(
    `DELETE FROM permisos_rol
     WHERE rol = ANY($1::rol_usuario[])
       AND NOT (modulo = ANY($2::text[]))`,
    [ROLES, MODULOS],
  );

  const { rows: cajaRows } = await pool.query(
    "SELECT count(*)::int AS count FROM usuarios WHERE rol = 'CAJA'",
  );

  // Seed default permission matrix. Rows without updated_por are inherited
  // defaults and may be safely upgraded; an administrator's explicit role
  // customization is marked with updated_por and is never overwritten.
  for (const modulo of MODULOS) {
    const matrixRow = MATRIX[modulo];
    for (let i = 0; i < ROLES.length; i++) {
      const rol = ROLES[i];
      const [puedeVer, puedeCrear, puedeEditar, puedeAutorizar] =
        matrixRow[i];

      await pool.query(
        `INSERT INTO permisos_rol (rol, modulo, puede_ver, puede_crear, puede_editar, puede_autorizar)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (rol, modulo) DO UPDATE SET
           puede_ver = EXCLUDED.puede_ver,
           puede_crear = EXCLUDED.puede_crear,
           puede_editar = EXCLUDED.puede_editar,
           puede_autorizar = EXCLUDED.puede_autorizar,
            updated_at = NOW()
          WHERE permisos_rol.updated_por IS NULL`,
        [rol, modulo, puedeVer, puedeCrear, puedeEditar, puedeAutorizar],
      );
    }
  }

  await pool.query(
    `INSERT INTO ticket_folio (id, ultimo_folio)
     VALUES (1, 999)
     ON CONFLICT (id) DO NOTHING`,
  );

  console.log(
    "Seed completado: ubicaciones, admin, ticket_folio y matriz de permisos para TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS y CONTADOR.",
  );
  console.log(
    `Usuarios existentes con rol CAJA conservados sin cambios: ${cajaRows[0].count}.`,
  );
  console.log(
    `Usuarios que tenían el rol SOPORTE antes de migrar a SISTEMAS: ${supportUserCount}.`,
  );
  console.warn(
    "ADVERTENCIA: cambia la contraseña inicial del usuario admin inmediatamente después del primer acceso.",
  );
} finally {
  await pool.end();
}
