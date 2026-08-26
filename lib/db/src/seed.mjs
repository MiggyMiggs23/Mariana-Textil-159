import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const isDevelopment = process.env.NODE_ENV === "development";
const adminSeedPassword =
  process.env.ADMIN_SEED_PASSWORD ??
  (isDevelopment ? "Mariana2026*" : undefined);

if (!connectionString) {
  throw new Error("DATABASE_URL es obligatoria para ejecutar el seed.");
}

if (!adminSeedPassword) {
  throw new Error(
    "ADMIN_SEED_PASSWORD es obligatoria fuera del entorno de desarrollo.",
  );
}

const pool = new Pool({ connectionString });

// 24 configurable module identifiers.
const MODULOS = [
  "dashboard",
  "pos",
  "entradas",
  "salidas",
  "movimientos",
  "inventario",
  "productos",
  "ajustes",
  "clientes",
  "clientes_credito",
  "clientes_precios",
  "clientes_finanzas",
  "proveedores",
  "proveedores_finanzas",
  "contenedores",
  "ubicaciones",
  "usuarios",
  "permisos",
  "resumen_caja",
  "cortes",
  "cobros_pagos",
  "reportes",
  "conciliacion",
  "auditoria",
];

// Default role matrix
// total = [ver, crear, editar, autorizar] all true
// — = all false
// ver = [true, false, false, false]
// ver/crear = [true, true, false, false]
// ver/crear/editar = [true, true, true, false]
const N = [false, false, false, false]; // —
const V = [true, false, false, false]; // ver
const VC = [true, true, false, false]; // ver/crear
const VCE = [true, true, true, false]; // ver/crear/editar
const VE = [true, false, true, false]; // ver/editar

// Matrix: modulo -> [TERMINAL, CAJA, INVENTARIOS, BODEGA]
const MATRIX = {
  dashboard: [V, N, V, V],
  pos: [VC, N, N, N],
  entradas: [N, N, VCE, VC],
  salidas: [V, V, VCE, VC],
  movimientos: [N, N, V, V],
  etiquetas: [N, N, VC, VC],
  inventario: [V, V, V, V],
  productos: [V, N, V, N],
  ajustes: [N, N, VC, VC],
  clientes: [VCE, V, N, N],
  clientes_credito: [V, V, N, N],
  clientes_precios: [V, N, N, N],
  clientes_finanzas: [N, V, N, N],
  proveedores: [N, N, V, N],
  proveedores_finanzas: [N, N, N, N],
  contenedores: [N, N, VCE, V],
  ubicaciones: [N, N, N, N],
  usuarios: [N, N, N, N],
  permisos: [N, N, N, N],
  resumen_caja: [N, V, N, N],
  cortes: [N, VC, N, N],
  cobros_pagos: [N, VC, N, N],
  reportes: [N, N, V, N],
  conciliacion: [N, N, N, N],
  auditoria: [N, N, N, N],
};

const ROLES = ["TERMINAL", "CAJA", "INVENTARIOS", "BODEGA"];

try {
  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");

  const locations = [
    ["Mariana", "TIENDA"],
    ["Cruces", "TIENDA"],
    ["Coco", "TIENDA"],
    ["Tomás", "BODEGA"],
    ["Don Nacho", "BODEGA"],
    ["Lucas Alamán", "BODEGA"],
    ["Bodega Cruces", "BODEGA"],
    ["En tránsito", "TRANSITO"],
    ["Externo", "EXTERNO"],
  ];

  for (const [nombre, tipo] of locations) {
    await pool.query(
      `INSERT INTO ubicaciones (nombre, tipo)
       VALUES ($1, $2)
       ON CONFLICT (nombre) DO UPDATE SET tipo = EXCLUDED.tipo`,
      [nombre, tipo],
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
    ALTER TABLE clientes ADD COLUMN IF NOT EXISTS es_sistema boolean NOT NULL DEFAULT false;
    ALTER TABLE clientes ADD COLUMN IF NOT EXISTS contacto_nombre text;
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

  // Seed default permission matrix. Updates ensure the documented matrix is
  // applied to existing installations as well as new ones.
  for (const modulo of MODULOS) {
    const matrixRow = MATRIX[modulo];
    if (!matrixRow) continue;

    for (let i = 0; i < ROLES.length; i++) {
      const rol = ROLES[i];
      const [puedeVer, puedeCrear, puedeEditar, puedeAutorizar] = matrixRow[i];

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
    "Seed completado: ubicaciones, admin, ticket_folio y matriz de permisos para TERMINAL, CAJA, INVENTARIOS y BODEGA.",
  );
  console.log(
    `Usuarios existentes con rol CAJA conservados sin cambios: ${cajaRows[0].count}.`,
  );
  console.warn(
    "ADVERTENCIA: cambia la contraseña inicial del usuario admin inmediatamente después del primer acceso.",
  );
} finally {
  await pool.end();
}
