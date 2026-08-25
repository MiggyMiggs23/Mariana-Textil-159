import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireRole, requireSession } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { getRequestIp } from "../lib/request";
import { normalizeUsername } from "../lib/auth-identifiers";

const router: IRouter = Router();
router.use("/clientes", requireSession);

function idParam(value: string | string[]): number | null {
  const id = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get(
  "/clientes/incobrables",
  requireRole("ADMIN"),
  async (req, res, next): Promise<void> => {
    try {
      const fechaDesde = typeof req.query.fechaDesde === "string" ? req.query.fechaDesde : null;
      const fechaHasta = typeof req.query.fechaHasta === "string" ? req.query.fechaHasta : null;
      const date = /^\d{4}-\d{2}-\d{2}$/;
      if ((fechaDesde && !date.test(fechaDesde)) || (fechaHasta && !date.test(fechaHasta))) {
        res.status(400).json({ error: "Las fechas deben usar el formato YYYY-MM-DD." }); return;
      }
      const result = await pool.query(
        `SELECT m.id, c.id AS "clienteId", c.nombre AS cliente,
          (-m.importe)::text AS monto, m.created_at AS fecha,
          autorizador.nombre AS "autorizadoPor",
          ejecutor.nombre AS "ejecutadoPor", m.motivo_incobrable AS motivo
         FROM movimientos_credito m
         JOIN clientes c ON c.id=m.cliente_id
         JOIN usuarios autorizador ON autorizador.id=m.autorizado_por
         JOIN usuarios ejecutor ON ejecutor.id=m.usuario_id
         WHERE m.es_incobrable
           AND ($1::date IS NULL OR m.created_at >= $1::date)
           AND ($2::date IS NULL OR m.created_at < $2::date + interval '1 day')
         ORDER BY m.created_at DESC, m.id DESC`,
        [fechaDesde, fechaHasta],
      );
      const total = result.rows.reduce((sum, row) => sum + Number(row.monto), 0);
      res.json({
        periodo: { fechaDesde, fechaHasta },
        filas: result.rows,
        total: total.toFixed(2),
        cantidad: result.rows.length,
      });
    } catch (error) { next(error); }
  },
);

router.post(
  "/clientes/:id/baja",
  requierePermiso("clientes", "editar"),
  async (req, res, next): Promise<void> => {
    const id = idParam(req.params.id);
    if (!id) { res.status(400).json({ error: "ID inválido." }); return; }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query(
        `SELECT id,nombre,activo,es_sistema FROM clientes WHERE id=$1 FOR UPDATE`,
        [id],
      );
      const cliente = locked.rows[0];
      if (!cliente) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "Cliente no encontrado." }); return;
      }
      if (cliente.es_sistema) {
        await client.query("ROLLBACK");
        res.status(409).json({
          error: "Venta a Público es un cliente protegido y no puede renombrarse, desactivarse ni recibir crédito.",
          code: "SYSTEM_CLIENT_PROTECTED",
        }); return;
      }
      await client.query("SELECT id FROM tickets WHERE cliente_id=$1 FOR UPDATE", [id]);
      await client.query("SELECT id FROM movimientos_credito WHERE cliente_id=$1 FOR UPDATE", [id]);
      const state = await client.query(
        `SELECT
          (SELECT count(*)::int FROM tickets WHERE cliente_id=$1) AS tickets,
          count(m.id)::int AS movimientos,
          COALESCE(SUM(m.importe),0)::numeric AS saldo
         FROM movimientos_credito m WHERE m.cliente_id=$1`,
        [id],
      );
      const saldo = Number(state.rows[0].saldo);
      const tickets = Number(state.rows[0].tickets);
      const movimientos = Number(state.rows[0].movimientos);
      if (saldo <= 0 && tickets === 0 && movimientos === 0) {
        await client.query("DELETE FROM clientes WHERE id=$1", [id]);
        await client.query(
          `INSERT INTO auditoria(usuario_id,accion,entidad,entidad_id,datos_antes,ip)
           VALUES($1,'BAJA_ELIMINAR','clientes',$2,$3,$4)`,
          [req.auth!.user.id, String(id), JSON.stringify({ nombre: cliente.nombre }), getRequestIp(req)],
        );
        await client.query("COMMIT");
        res.json({ clienteId: id, resultado: "ELIMINADO", saldoAnterior: "0.00", montoIncobrable: "0.00", desdeCuando: null });
        return;
      }
      if (saldo <= 0) {
        await client.query("UPDATE clientes SET activo=false,updated_at=now() WHERE id=$1", [id]);
        await client.query(
          `INSERT INTO auditoria(usuario_id,accion,entidad,entidad_id,datos_despues,ip)
           VALUES($1,'BAJA_DESACTIVAR','clientes',$2,$3,$4)`,
          [req.auth!.user.id, String(id), JSON.stringify({ activo: false }), getRequestIp(req)],
        );
        await client.query("COMMIT");
        res.json({ clienteId: id, resultado: "DESACTIVADO", saldoAnterior: "0.00", montoIncobrable: "0.00", desdeCuando: null });
        return;
      }
      const vencido = await client.query(
        `SELECT COALESCE(SUM(pendiente),0)::numeric AS monto, MIN(due_at) AS desde
         FROM credit_fifo_aging($1)
         WHERE due_at < (now() AT TIME ZONE 'America/Mexico_City')::date`,
        [id],
      );
      const montoVencido = Number(vencido.rows[0].monto);
      const desdeCuando = vencido.rows[0].desde;
      if (montoVencido <= 0) {
        await client.query("ROLLBACK");
        res.status(409).json({
          error: `Este cliente tiene un saldo pendiente de $${saldo.toFixed(2)}. Liquida el saldo antes de darlo de baja.`,
          code: "CLIENT_BALANCE_PENDING",
          requiereAutorizacion: false,
          monto: saldo.toFixed(2),
          saldo: saldo.toFixed(2),
          desdeCuando: null,
        }); return;
      }
      const { adminUsuario, adminPassword } = (req.body ?? {}) as Record<string, unknown>;
      const motivo = typeof req.body?.motivo === "string" ? req.body.motivo.trim() : "";
      if (typeof adminUsuario !== "string" || typeof adminPassword !== "string") {
        await client.query("ROLLBACK");
        res.status(401).json({
          error: "Se requiere usuario y contraseña de un ADMIN activo.",
          code: "ADMIN_AUTH_REQUIRED",
          requiereAutorizacion: true,
          monto: saldo.toFixed(2),
          saldo: saldo.toFixed(2), montoVencido: montoVencido.toFixed(2), desdeCuando,
        }); return;
      }
      if (motivo.length < 20) {
        await client.query("ROLLBACK");
        res.status(400).json({
          error: "El motivo debe tener al menos 20 caracteres.",
          code: "INCOBRABLE_REASON_REQUIRED",
          requiereAutorizacion: true,
          monto: saldo.toFixed(2),
          saldo: saldo.toFixed(2), montoVencido: montoVencido.toFixed(2), desdeCuando,
        }); return;
      }
      const auth = await client.query(
        `SELECT id,nombre FROM usuarios
         WHERE usuario=$1 AND rol='ADMIN' AND activo
           AND password_hash=crypt($2,password_hash)`,
        [normalizeUsername(adminUsuario), adminPassword],
      );
      const autorizador = auth.rows[0];
      if (!autorizador) {
        await client.query("ROLLBACK");
        res.status(401).json({
          error: "Las credenciales del ADMIN no son válidas.",
          code: "ADMIN_AUTH_REQUIRED",
          requiereAutorizacion: true,
          monto: saldo.toFixed(2),
          desdeCuando,
        }); return;
      }
      await client.query(
        `INSERT INTO movimientos_credito
          (cliente_id,tipo,importe,usuario_id,notas,es_incobrable,motivo_incobrable,autorizado_por)
         VALUES($1,'AJUSTE',$2,$3,$4,true,$4,$5)`,
        [id, (-saldo).toFixed(2), req.auth!.user.id, motivo, autorizador.id],
      );
      await client.query("UPDATE clientes SET activo=false,updated_at=now() WHERE id=$1", [id]);
      await client.query(
        `INSERT INTO auditoria(usuario_id,accion,entidad,entidad_id,datos_despues,ip)
         VALUES($1,'BAJA_INCOBRABLE','clientes',$2,$3,$4)`,
        [req.auth!.user.id, String(id), JSON.stringify({
          ejecutadoPor: req.auth!.user.id, autorizadoPor: autorizador.id,
          monto: saldo.toFixed(2), montoVencido: montoVencido.toFixed(2),
          desdeCuando, motivo,
        }), getRequestIp(req)],
      );
      await client.query("COMMIT");
      res.json({
        clienteId: id, resultado: "DESACTIVADO_INCOBRABLE",
        saldoAnterior: saldo.toFixed(2), montoIncobrable: saldo.toFixed(2), desdeCuando,
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      next(error);
    } finally { client.release(); }
  },
);

router.post(
  "/clientes/:id/reactivar",
  requierePermiso("clientes", "editar"),
  async (req, res, next): Promise<void> => {
    const id = idParam(req.params.id);
    if (!id) { res.status(400).json({ error: "ID inválido." }); return; }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query("SELECT id,nombre,activo,es_sistema FROM clientes WHERE id=$1 FOR UPDATE", [id]);
      const cliente = result.rows[0];
      if (!cliente) { await client.query("ROLLBACK"); res.status(404).json({ error: "Cliente no encontrado." }); return; }
      if (cliente.es_sistema) { await client.query("ROLLBACK"); res.status(409).json({ error: "Venta a Público es un cliente protegido.", code: "SYSTEM_CLIENT_PROTECTED" }); return; }
      await client.query("UPDATE clientes SET activo=true,updated_at=now() WHERE id=$1", [id]);
      await client.query(
        `INSERT INTO auditoria(usuario_id,accion,entidad,entidad_id,datos_antes,datos_despues,ip)
         VALUES($1,'REACTIVAR','clientes',$2,$3,$4,$5)`,
        [req.auth!.user.id, String(id), JSON.stringify({ activo: cliente.activo }), JSON.stringify({ activo: true }), getRequestIp(req)],
      );
      await client.query("COMMIT");
      res.json({ clienteId: id, activo: true });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if ((error as { code?: string }).code === "23505") {
        res.status(409).json({ error: "Ya existe un cliente activo con ese nombre.", code: "CLIENT_NAME_CONFLICT" }); return;
      }
      next(error);
    } finally { client.release(); }
  },
);

export default router;