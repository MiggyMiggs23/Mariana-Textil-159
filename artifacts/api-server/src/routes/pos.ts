import type { NextFunction, Request, Response } from "express";
import { Router, type IRouter } from "express";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import {
  AbrirSesionCajaBody,
  AbrirSesionCajaResponse,
  BuscarPosQueryParams,
  BuscarPosResponse,
  CancelarTicketBody,
  CancelarTicketParams,
  CancelarTicketResponse,
  CerrarSesionCajaBody,
  CerrarSesionCajaParams,
  CerrarSesionCajaResponse,
  CobrarTicketBody,
  CobrarTicketParams,
  CobrarTicketResponse,
  CrearTicketBody,
  CrearTicketResponse,
  ListarTicketsQueryParams,
  ListarTicketsResponse,
  ObtenerCorteCajaParams,
  ObtenerCorteCajaResponse,
  ObtenerSesionCajaActualQueryParams,
  ObtenerSesionCajaActualResponse,
  ObtenerTicketParams,
  ObtenerTicketResponse,
  ValidarPrecioPosBody,
  ValidarPrecioPosResponse,
} from "@workspace/api-zod";
import {
  clientesTable,
  db,
  sesionesCajaTable,
  ticketLineasTable,
  ticketPagosTable,
  ticketsTable,
  ubicacionesTable,
  usuariosTable,
} from "@workspace/db";
import { requireSession } from "../middlewares/auth";
import {
  requierePermiso,
  resolvePermiso,
  type ModuloId,
} from "../lib/permisos";
import { getRequestIp } from "../lib/request";
import { omitTerminalSensitiveFields } from "../lib/sensitive-data";
import {
  abrirSesionCaja,
  buildCorteCaja,
  buildTicketDetail,
  buscarPos,
  cancelarTicket,
  cerrarSesionCaja,
  cobrarTicket,
  crearTicket,
  isInventoryError,
  PosError,
  validarPrecioPos,
} from "../lib/pos";

const router: IRouter = Router();
router.use(requireSession);

function handlePosError(
  error: unknown,
  res: Response,
  next: NextFunction,
): void {
  if (error instanceof PosError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  if (isInventoryError(error)) {
    const status =
      error.code === "INVALID_TRANSITION" || error.code === "ALREADY_CANCELLED"
        ? 409
        : 400;
    res.status(status).json({ error: error.message, code: error.code });
    return;
  }
  next(error);
}

function scopedLocation(req: Request, requested?: number): number {
  if (req.auth!.user.rol === "ADMIN") {
    if (requested == null) {
      throw new PosError(
        "Selecciona una ubicación.",
        "LOCATION_REQUIRED",
      );
    }
    return requested;
  }
  if (req.auth!.user.ubicacionId == null) {
    throw new PosError(
      "No tienes una ubicación asignada.",
      "LOCATION_REQUIRED",
      403,
    );
  }
  return req.auth!.user.ubicacionId;
}

function assertOperationalLocation(req: Request, ubicacionId: number): void {
  if (req.auth!.user.rol === "ADMIN") return;
  if (req.auth!.user.ubicacionId !== ubicacionId) {
    throw new PosError(
      "No tienes permiso para operar en esa ubicación.",
      "LOCATION_FORBIDDEN",
      403,
    );
  }
}

function requiereAlguno(
  checks: Array<{ modulo: ModuloId; accion: "ver" | "crear" }>,
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const auth = req.auth!;
    if (auth.user.rol === "ADMIN") {
      next();
      return;
    }
    for (const check of checks) {
      const permission = await resolvePermiso(
        auth.user.id,
        auth.user.rol,
        check.modulo,
      );
      const allowed =
        check.accion === "ver"
          ? permission?.puedeVer
          : permission?.puedeCrear;
      if (allowed) {
        next();
        return;
      }
    }
    res.status(403).json({ error: "No tienes permisos para esta operación." });
  };
}

async function verifyAdminCredentials(
  credentials:
    | {
        usuario: string;
        password: string;
      }
    | null
    | undefined,
): Promise<number | null> {
  if (!credentials) return null;
  const [admin] = await db
    .select({ id: usuariosTable.id })
    .from(usuariosTable)
    .where(
      and(
        eq(usuariosTable.usuario, credentials.usuario.trim()),
        eq(usuariosTable.rol, "ADMIN"),
        eq(usuariosTable.activo, true),
        sql`${usuariosTable.passwordHash} = crypt(${credentials.password}, ${usuariosTable.passwordHash})`,
      ),
    )
    .limit(1);
  if (!admin) {
    throw new PosError(
      "Las credenciales de administrador no son válidas.",
      "INVALID_ADMIN_CREDENTIALS",
      403,
    );
  }
  return admin.id;
}

function omitTerminalPaymentState(
  value: Record<string, unknown>,
  terminal: boolean,
): Record<string, unknown> {
  if (!terminal) return value;
  const {
    cobrado: _cobrado,
    cobradoAt: _cobradoAt,
    usuarioCajaId: _usuarioCajaId,
    nombreUsuarioCaja: _nombreUsuarioCaja,
    sesionCajaId: _sesionCajaId,
    pagos: _pagos,
    ...safe
  } = value;
  return safe;
}

function omitTerminalTicketSensitiveFields(
  value: Record<string, unknown>,
  terminal: boolean,
): Record<string, unknown> {
  return omitTerminalSensitiveFields(
    omitTerminalPaymentState(value, terminal),
    terminal,
  );
}

async function getSesion(sesionId: number) {
  const [sesion] = await db
    .select({
      id: sesionesCajaTable.id,
      ubicacionId: sesionesCajaTable.ubicacionId,
      nombreUbicacion: ubicacionesTable.nombre,
      usuarioId: sesionesCajaTable.usuarioId,
      nombreUsuario: usuariosTable.nombre,
      abiertaAt: sesionesCajaTable.abiertaAt,
      cerradaAt: sesionesCajaTable.cerradaAt,
      fondoInicial: sesionesCajaTable.fondoInicial,
      efectivoContado: sesionesCajaTable.efectivoContado,
      estado: sesionesCajaTable.estado,
    })
    .from(sesionesCajaTable)
    .innerJoin(
      ubicacionesTable,
      eq(sesionesCajaTable.ubicacionId, ubicacionesTable.id),
    )
    .innerJoin(usuariosTable, eq(sesionesCajaTable.usuarioId, usuariosTable.id))
    .where(eq(sesionesCajaTable.id, sesionId))
    .limit(1);
  return sesion ?? null;
}

router.get(
  "/pos/buscar",
  requierePermiso("pos", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const query = BuscarPosQueryParams.parse(req.query);
      const ubicacionId = scopedLocation(req, query.ubicacionId);
      const result = await buscarPos(db, query.q, ubicacionId);
      res.json(BuscarPosResponse.parse(result));
    } catch (error) {
      handlePosError(error, res, next);
    }
  },
);

router.post(
  "/pos/validar-precio",
  requierePermiso("pos", "crear"),
  async (req, res, next): Promise<void> => {
    try {
      const body = ValidarPrecioPosBody.parse(req.body);
      const ubicacionId = scopedLocation(req, body.ubicacionId);
      assertOperationalLocation(req, ubicacionId);
      const result = await validarPrecioPos(db, {
        ubicacionId,
        productoId: body.productoId,
        rolloId: body.rolloId,
        precioUnitario: String(body.precioUnitario),
      });
      res.json(ValidarPrecioPosResponse.parse(result));
    } catch (error) {
      handlePosError(error, res, next);
    }
  },
);

router.post(
  "/tickets",
  requierePermiso("pos", "crear"),
  async (req, res, next): Promise<void> => {
    try {
      const body = CrearTicketBody.parse(req.body);
      const ubicacionId = scopedLocation(req, body.ubicacionId);
      assertOperationalLocation(req, ubicacionId);
      const includeCosts = req.auth!.user.rol !== "TERMINAL";
      const result = await db.transaction((tx) =>
        crearTicket(
          tx,
          {
            ubicacionId,
            usuarioTerminalId: req.auth!.user.id,
            clienteId: body.clienteId,
            tipo: body.tipo,
            facturado: body.facturado,
            uuidCliente: body.uuidCliente,
            lineas: body.lineas.map((linea) => ({
              rolloId: linea.rolloId,
              productoId: linea.productoId,
              cantidad: String(linea.cantidad),
              precioUnitario: String(linea.precioUnitario),
            })),
            ip: getRequestIp(req),
          },
          includeCosts,
        ),
      );
      const parsed = CrearTicketResponse.parse(result);
      res
        .status(201)
        .json(
          omitTerminalTicketSensitiveFields(
            parsed as unknown as Record<string, unknown>,
            req.auth!.user.rol === "TERMINAL",
          ),
        );
    } catch (error) {
      handlePosError(error, res, next);
    }
  },
);

router.get(
  "/tickets",
  requiereAlguno([
    { modulo: "pos", accion: "ver" },
    { modulo: "cobros_pagos", accion: "ver" },
  ]),
  async (req, res, next): Promise<void> => {
    try {
      const query = ListarTicketsQueryParams.parse(req.query);
      const ubicacionId = scopedLocation(req, query.ubicacionId);
      const conditions = [eq(ticketsTable.ubicacionId, ubicacionId)];
      if (query.cobrado != null) {
        conditions.push(eq(ticketsTable.cobrado, query.cobrado));
      }
      if (query.estado != null) {
        conditions.push(eq(ticketsTable.estado, query.estado));
      }
      if (query.folio != null) {
        conditions.push(eq(ticketsTable.folio, query.folio));
      }
      const rows = await db
        .select({
          id: ticketsTable.id,
          folio: ticketsTable.folio,
          ubicacionId: ticketsTable.ubicacionId,
          nombreUbicacion: ubicacionesTable.nombre,
          usuarioTerminalId: ticketsTable.usuarioTerminalId,
          nombreUsuarioTerminal: usuariosTable.nombre,
          clienteId: ticketsTable.clienteId,
          nombreCliente: clientesTable.nombre,
          tipo: ticketsTable.tipo,
          subtotal: ticketsTable.subtotal,
          total: ticketsTable.total,
          estado: ticketsTable.estado,
          cobrado: ticketsTable.cobrado,
          cobradoAt: ticketsTable.cobradoAt,
          usuarioCajaId: ticketsTable.usuarioCajaId,
          facturado: ticketsTable.facturado,
          sesionCajaId: ticketsTable.sesionCajaId,
          uuidCliente: ticketsTable.uuidCliente,
          createdAt: ticketsTable.createdAt,
          canceladoAt: ticketsTable.canceladoAt,
          canceladoPor: ticketsTable.canceladoPor,
          motivoCancelacion: ticketsTable.motivoCancelacion,
          autorizadoPor: ticketsTable.autorizadoPor,
          lineasCount: count(ticketLineasTable.id),
        })
        .from(ticketsTable)
        .innerJoin(
          ubicacionesTable,
          eq(ticketsTable.ubicacionId, ubicacionesTable.id),
        )
        .innerJoin(
          usuariosTable,
          eq(ticketsTable.usuarioTerminalId, usuariosTable.id),
        )
        .leftJoin(clientesTable, eq(ticketsTable.clienteId, clientesTable.id))
        .leftJoin(
          ticketLineasTable,
          eq(ticketLineasTable.ticketId, ticketsTable.id),
        )
        .where(and(...conditions))
        .groupBy(
          ticketsTable.id,
          ubicacionesTable.nombre,
          usuariosTable.nombre,
          clientesTable.nombre,
        )
        .orderBy(asc(ticketsTable.cobrado), desc(ticketsTable.createdAt))
        .limit(200);
      const response = ListarTicketsResponse.parse(
        rows.map((row) => ({
          ...row,
          nombreUsuarioCaja: null,
          nombreUsuarioCancelacion: null,
          nombreUsuarioAutorizacion: null,
        })),
      );
      const terminal = req.auth!.user.rol === "TERMINAL";
      res.json(
        terminal
          ? response.map((ticket) =>
              omitTerminalTicketSensitiveFields(
                ticket as unknown as Record<string, unknown>,
                true,
              ),
            )
          : response,
      );
    } catch (error) {
      handlePosError(error, res, next);
    }
  },
);

router.get(
  "/tickets/:id",
  requiereAlguno([
    { modulo: "pos", accion: "ver" },
    { modulo: "cobros_pagos", accion: "ver" },
  ]),
  async (req, res, next): Promise<void> => {
    try {
      const params = ObtenerTicketParams.parse(req.params);
      const terminal = req.auth!.user.rol === "TERMINAL";
      const ticket = await buildTicketDetail(db, params.id, !terminal);
      if (!ticket) {
        res.status(404).json({ error: "Ticket no encontrado." });
        return;
      }
      assertOperationalLocation(req, ticket.ubicacionId);
      const parsed = ObtenerTicketResponse.parse(ticket);
      res.json(
        omitTerminalTicketSensitiveFields(
          parsed as unknown as Record<string, unknown>,
          terminal,
        ),
      );
    } catch (error) {
      handlePosError(error, res, next);
    }
  },
);

router.post(
  "/tickets/:id/cancelar",
  requierePermiso("pos", "crear"),
  async (req, res, next): Promise<void> => {
    try {
      const params = CancelarTicketParams.parse(req.params);
      const body = CancelarTicketBody.parse(req.body);
      let autorizadoPor = req.auth!.user.id;
      if (req.auth!.user.rol !== "ADMIN") {
        const adminId = await verifyAdminCredentials(body.credencialesAdmin);
        if (adminId == null) {
          throw new PosError(
            "La cancelación requiere autorización de ADMIN.",
            "ADMIN_AUTH_REQUIRED",
            403,
          );
        }
        autorizadoPor = adminId;
      }
      const current = await buildTicketDetail(db, params.id, false);
      if (!current) {
        res.status(404).json({ error: "Ticket no encontrado." });
        return;
      }
      assertOperationalLocation(req, current.ubicacionId);
      const terminal = req.auth!.user.rol === "TERMINAL";
      const result = await db.transaction((tx) =>
        cancelarTicket(
          tx,
          {
            ticketId: params.id,
            usuarioId: req.auth!.user.id,
            autorizadoPor,
            motivo: body.motivo,
            ip: getRequestIp(req),
          },
          !terminal,
        ),
      );
      const parsed = CancelarTicketResponse.parse(result);
      res.json(
        omitTerminalTicketSensitiveFields(
          parsed as unknown as Record<string, unknown>,
          terminal,
        ),
      );
    } catch (error) {
      handlePosError(error, res, next);
    }
  },
);

router.post(
  "/tickets/:id/cobrar",
  requierePermiso("cobros_pagos", "crear"),
  async (req, res, next): Promise<void> => {
    try {
      const params = CobrarTicketParams.parse(req.params);
      const body = CobrarTicketBody.parse(req.body);
      const [ticket] = await db
        .select({
          ubicacionId: ticketsTable.ubicacionId,
        })
        .from(ticketsTable)
        .where(eq(ticketsTable.id, params.id))
        .limit(1);
      if (!ticket) {
        res.status(404).json({ error: "Ticket no encontrado." });
        return;
      }
      assertOperationalLocation(req, ticket.ubicacionId);
      const [session] = await db
        .select({ id: sesionesCajaTable.id })
        .from(sesionesCajaTable)
        .where(
          and(
            eq(sesionesCajaTable.ubicacionId, ticket.ubicacionId),
            eq(sesionesCajaTable.estado, "ABIERTA"),
          ),
        )
        .limit(1);
      if (!session) {
        throw new PosError(
          "Abre una sesión de caja antes de cobrar.",
          "OPEN_SESSION_REQUIRED",
          409,
        );
      }
      const autorizadoPor = await verifyAdminCredentials(
        body.credencialesAdmin,
      );
      const result = await db.transaction((tx) =>
        cobrarTicket(
          tx,
          {
            ticketId: params.id,
            sesionCajaId: session.id,
            usuarioId: req.auth!.user.id,
            clienteId: body.clienteId,
            pagos: body.pagos.map((pago) => ({
              formaPago: pago.formaPago,
              importe: String(pago.importe),
              referencia: pago.referencia,
            })),
            autorizadoPor,
            ip: getRequestIp(req),
          },
          true,
        ),
      );
      res.json(CobrarTicketResponse.parse(result));
    } catch (error) {
      handlePosError(error, res, next);
    }
  },
);

router.get(
  "/sesiones-caja/actual",
  requierePermiso("cobros_pagos", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const query = ObtenerSesionCajaActualQueryParams.parse(req.query);
      const ubicacionId = scopedLocation(req, query.ubicacionId);
      const [sesion] = await db
        .select({ id: sesionesCajaTable.id })
        .from(sesionesCajaTable)
        .where(
          and(
            eq(sesionesCajaTable.ubicacionId, ubicacionId),
            eq(sesionesCajaTable.estado, "ABIERTA"),
          ),
        )
        .limit(1);
      if (!sesion) {
        res.json(
          ObtenerSesionCajaActualResponse.parse({
            sesion: null,
            resumen: null,
          }),
        );
        return;
      }
      const corte = await buildCorteCaja(db, sesion.id);
      res.json(
        ObtenerSesionCajaActualResponse.parse({
          sesion: corte?.sesion ?? null,
          resumen: corte
            ? {
                ticketsCobrados: corte.ticketsCobrados,
                ticketsPendientes: corte.ticketsPendientes,
                totalCobrado: corte.totalCobrado,
                efectivoEsperado: corte.efectivoEsperado,
              }
            : null,
        }),
      );
    } catch (error) {
      handlePosError(error, res, next);
    }
  },
);

router.post(
  "/sesiones-caja/abrir",
  requierePermiso("cobros_pagos", "crear"),
  async (req, res, next): Promise<void> => {
    try {
      const body = AbrirSesionCajaBody.parse(req.body);
      const ubicacionId = scopedLocation(req, body.ubicacionId);
      assertOperationalLocation(req, ubicacionId);
      const created = await db.transaction((tx) =>
        abrirSesionCaja(tx, {
          ubicacionId,
          usuarioId: req.auth!.user.id,
          fondoInicial: String(body.fondoInicial),
          ip: getRequestIp(req),
        }),
      );
      const session = await getSesion(created.id);
      res.status(201).json(AbrirSesionCajaResponse.parse(session));
    } catch (error) {
      handlePosError(error, res, next);
    }
  },
);

router.get(
  "/sesiones-caja/:id/corte",
  requierePermiso("cortes", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const params = ObtenerCorteCajaParams.parse(req.params);
      const corte = await buildCorteCaja(db, params.id);
      if (!corte) {
        res.status(404).json({ error: "Sesión no encontrada." });
        return;
      }
      assertOperationalLocation(req, corte.sesion.ubicacionId);
      res.json(ObtenerCorteCajaResponse.parse(corte));
    } catch (error) {
      handlePosError(error, res, next);
    }
  },
);

router.post(
  "/sesiones-caja/:id/cerrar",
  requierePermiso("cortes", "crear"),
  async (req, res, next): Promise<void> => {
    try {
      const params = CerrarSesionCajaParams.parse(req.params);
      const body = CerrarSesionCajaBody.parse(req.body);
      const session = await getSesion(params.id);
      if (!session) {
        res.status(404).json({ error: "Sesión no encontrada." });
        return;
      }
      assertOperationalLocation(req, session.ubicacionId);
      const corte = await db.transaction((tx) =>
        cerrarSesionCaja(tx, {
          sesionId: params.id,
          usuarioId: req.auth!.user.id,
          efectivoContado: String(body.efectivoContado),
          ip: getRequestIp(req),
        }),
      );
      res.json(CerrarSesionCajaResponse.parse(corte));
    } catch (error) {
      handlePosError(error, res, next);
    }
  },
);

export default router;