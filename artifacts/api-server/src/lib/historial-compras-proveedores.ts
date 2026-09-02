import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export type HistorialCompraSort =
  | "fecha"
  | "producto"
  | "proveedor"
  | "color"
  | "sitio"
  | "cantidad";

export type HistorialCompraDirection = "asc" | "desc";

export async function listarHistorialComprasProveedores(options: {
  ubicacionId?: number;
  proveedorId?: number;
  desde?: Date;
  hasta?: Date;
  sort: HistorialCompraSort;
  direction: HistorialCompraDirection;
  page: number;
  pageSize: number;
}) {
  const sortExpressions: Record<HistorialCompraSort, string> = {
    fecha: "fecha",
    producto: "producto",
    proveedor: "proveedor",
    color: "color",
    sitio: "sitio",
    cantidad: "cantidad",
  };
  const orderBy = sql.raw(
    `${sortExpressions[options.sort]} ${options.direction.toUpperCase()}, entrada_id DESC, producto_id ASC`,
  );
  const offset = (options.page - 1) * options.pageSize;

  const rows = await db.execute<{
    entrada_id: number;
    fecha: Date | string;
    producto_id: number;
    producto: string;
    color: string;
    unidad: "METRO" | "KILO" | "BOLSA";
    proveedor_id: number;
    proveedor: string;
    ubicacion_id: number;
    sitio: string;
    cantidad: string;
    total: string;
  }>(sql`
    WITH lineas AS (
      SELECT
        e.id AS entrada_id,
        e.fecha,
        pr.id AS producto_id,
        pr.tela AS producto,
        pr.color,
        pr.unidad,
        pv.id AS proveedor_id,
        pv.nombre AS proveedor,
        u.id AS ubicacion_id,
        u.nombre AS sitio,
        SUM(ro.cantidad_inicial) AS cantidad
      FROM entradas e
      JOIN proveedores pv ON pv.id = e.proveedor_id
      JOIN ubicaciones u ON u.id = e.ubicacion_id
      JOIN rollos ro ON ro.recepcion_id = e.id
      JOIN productos pr ON pr.id = ro.producto_id
      WHERE (${options.ubicacionId ?? null}::int IS NULL OR e.ubicacion_id = ${options.ubicacionId ?? null})
        AND (${options.proveedorId ?? null}::int IS NULL OR e.proveedor_id = ${options.proveedorId ?? null})
        AND (${options.desde ?? null}::timestamptz IS NULL OR e.fecha >= ${options.desde ?? null})
        AND (${options.hasta ?? null}::timestamptz IS NULL OR e.fecha <= ${options.hasta ?? null})
      GROUP BY e.id, e.fecha, pr.id, pr.tela, pr.color, pr.unidad,
        pv.id, pv.nombre, u.id, u.nombre
    )
    SELECT lineas.*, COUNT(*) OVER()::text AS total
    FROM lineas
    ORDER BY ${orderBy}
    LIMIT ${options.pageSize}
    OFFSET ${offset}
  `);

  return {
    items: rows.rows.map((row) => ({
      entradaId: Number(row.entrada_id),
      fecha: new Date(row.fecha).toISOString(),
      productoId: Number(row.producto_id),
      producto: row.producto,
      color: row.color,
      unidad: row.unidad,
      proveedorId: Number(row.proveedor_id),
      proveedor: row.proveedor,
      ubicacionId: Number(row.ubicacion_id),
      sitio: row.sitio,
      cantidad: String(row.cantidad),
    })),
    total: Number(rows.rows[0]?.total ?? 0),
    page: options.page,
    pageSize: options.pageSize,
  };
}