import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import {
  ADVISORY_LOCK_NAMESPACES,
  transactionAdvisoryLock,
} from "@workspace/db/advisory-locks";
import { requireRole, requireSession } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { getRequestIp } from "../lib/request";
import { normalizeUsername } from "../lib/auth-identifiers";
import { loadCustomerCreditProjection } from "../lib/credit-aging-read-model";
import { isPostgresUniqueViolation } from "../lib/postgres-errors";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Tx } from "../lib/inventario";
import {
  readCreditEvidenceInput, canonicalCreditMoney, assertCreditEvidenceAccess,
  assertCreditEvidenceScope, claimCreditOperation, insertCreditMovementE1,
  CreditEvidenceError,
} from "../lib/credit-evidence";

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
    if (req.auth!.user.rol === "SUPERVISOR") {
      res.status(403).json({
        error: "El rol SUPERVISOR no puede dar de baja clientes.",
      });
      return;
    }
    const id = idParam(req.params.id);
    if (!id) { res.status(400).json({ error: "ID inválido." }); return; }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Keep the existing pg transaction; the adapter never opens a second connection.
      const tx = drizzle(client) as unknown as Tx;
      const authorizingWriteoff = req.body?.montoIncobrable != null ||
        req.body?.adminUsuario != null || req.body?.adminPassword != null;
      const evidence = authorizingWriteoff ? readCreditEvidenceInput(req.body) : null;
      let authorizedId: number | null = null;
      let authorizedAmount: string | null = null;
      const motivo = typeof req.body?.motivo === "string" ? req.body.motivo.trim() : "";
      if (evidence) {
        authorizedAmount = canonicalCreditMoney(req.body?.montoIncobrable);
        if (Number(authorizedAmount) <= 0 || motivo.length < 20) {
          throw new CreditEvidenceError("Declara monto incobrable positivo y motivo de al menos 20 caracteres.");
        }
        const { adminUsuario, adminPassword } = req.body as Record<string, unknown>;
        if (typeof adminUsuario !== "string" || typeof adminPassword !== "string") {
          await client.query("ROLLBACK");
          res.status(401).json({
            error: "Se requieren credenciales de un ADMIN activo: usuario y contraseña.",
            code: "ADMIN_CREDENTIALS_REQUIRED",
            requiereAutorizacion: true,
          });
          return;
        }
        const auth = await client.query(
          `SELECT id FROM usuarios WHERE usuario=$1 AND rol='ADMIN' AND activo
            AND password_hash=crypt($2,password_hash)`,
          [normalizeUsername(adminUsuario), adminPassword],
        );
        if (!auth.rows[0]) throw new CreditEvidenceError("Las credenciales del ADMIN no son válidas.", 401);
        authorizedId = Number(auth.rows[0].id);
        await assertCreditEvidenceAccess(req, evidence, tx);
        const claim = await claimCreditOperation(tx, {
          productor: "BAJA_INCOBRABLE", clave: evidence.operacionClave,
          naturaleza: evidence.naturaleza, actorId: req.auth!.user.id,
          contenido: {
            clienteId: id, montoIncobrable: authorizedAmount, motivo,
            destinos: [],
            autorizadoPor: authorizedId, ...evidence,
          },
        });
        if (claim.replay) {
          const audit = await client.query(
            `SELECT datos_despues FROM auditoria WHERE accion='BAJA_INCOBRABLE'
              AND entidad='clientes' AND entidad_id=$1
              AND datos_despues->>'movimientoCreditoId'=$2 ORDER BY id LIMIT 1`,
            [String(id), String(claim.movement.id)],
          );
          if (!audit.rows[0]) throw new CreditEvidenceError("No se encontró la respuesta auditada de la baja original.", 409);
          const saved = audit.rows[0].datos_despues;
          await client.query("COMMIT");
          res.json({
            clienteId: id, resultado: "DESACTIVADO_INCOBRABLE", movimientoId: claim.movement.id,
            saldoAnterior: saved.monto, montoIncobrable: saved.monto, desdeCuando: saved.desdeCuando,
          });
          return;
        }
        await assertCreditEvidenceScope(req, evidence, tx);
        if (evidence.notaOrigenId != null) {
          const note = await client.query(
            `SELECT id FROM tickets WHERE id=$1 AND cliente_id=$2 AND ubicacion_id=$3 AND documento_tipo='NOTA'`,
            [evidence.notaOrigenId, id, evidence.sitioOrigenId],
          );
          if (!note.rows[0]) throw new CreditEvidenceError("La nota de origen no pertenece al cliente y sitio autorizado.");
        }
      }
      await transactionAdvisoryLock(
        client,
        ADVISORY_LOCK_NAMESPACES.CUSTOMER_CREDIT,
        id,
      );
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
          0::numeric AS saldo
         FROM movimientos_credito m WHERE m.cliente_id=$1`,
        [id],
      );
       const projection = await loadCustomerCreditProjection(id, client);
      const saldo = projection.balanceCents / 100;
      if (authorizedAmount != null && canonicalCreditMoney(saldo.toFixed(2)) !== authorizedAmount) {
        throw new CreditEvidenceError("El saldo cambió; revisa el monto incobrable antes de autorizar.", 409);
      }
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
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
      const overdue = projection.charges.filter((charge) => charge.dueAt != null && charge.dueAt < today);
      const montoVencido = overdue.reduce((sum, charge) => sum + charge.pendienteCents, 0) / 100;
      const desdeCuando = overdue.map((charge) => charge.dueAt).sort()[0] ?? null;
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
      if (!evidence || authorizedId !== Number(autorizador.id)) {
        throw new CreditEvidenceError("Faltan datos E1 de la baja incobrable. Actualiza la aplicación.");
      }
      const movement = await insertCreditMovementE1(tx, {
        clienteId: id, tipo: "AJUSTE", importe: (-saldo).toFixed(2),
        usuarioId: req.auth!.user.id, notas: motivo, esIncobrable: true,
        motivoIncobrable: motivo, autorizadoPor: authorizedId,
      }, evidence, "BAJA_INCOBRABLE");
      await client.query("UPDATE clientes SET activo=false,updated_at=now() WHERE id=$1", [id]);
      await client.query(
        `INSERT INTO auditoria(usuario_id,accion,entidad,entidad_id,datos_despues,ip)
         VALUES($1,'BAJA_INCOBRABLE','clientes',$2,$3,$4)`,
        [req.auth!.user.id, String(id), JSON.stringify({
          ejecutadoPor: req.auth!.user.id, autorizadoPor: autorizador.id,
          movimientoCreditoId: movement.id,
          monto: saldo.toFixed(2), montoVencido: montoVencido.toFixed(2),
          desdeCuando, motivo,
        }), getRequestIp(req)],
      );
      await client.query("COMMIT");
      res.json({
        clienteId: id, resultado: "DESACTIVADO_INCOBRABLE", movimientoId: movement.id,
        saldoAnterior: saldo.toFixed(2), montoIncobrable: saldo.toFixed(2), desdeCuando,
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (error instanceof CreditEvidenceError) {
        res.status(error.statusCode).json({ error: error.message }); return;
      }
      next(error);
    } finally { client.release(); }
  },
);

router.post(
  "/clientes/:id/reactivar",
  requierePermiso("clientes", "editar"),
  async (req, res, next): Promise<void> => {
    if (req.auth!.user.rol === "SUPERVISOR") {
      res.status(403).json({
        error: "El rol SUPERVISOR no puede reactivar clientes.",
      });
      return;
    }
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
      if (isPostgresUniqueViolation(error)) {
        res.status(409).json({ error: "Ya existe un cliente activo con ese nombre.", code: "CLIENT_NAME_CONFLICT" }); return;
      }
      next(error);
    } finally { client.release(); }
  },
);

export default router;