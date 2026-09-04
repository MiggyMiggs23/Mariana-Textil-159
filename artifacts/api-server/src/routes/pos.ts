import type { NextFunction, Request, Response } from "express";
import { Router, type IRouter } from "express";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import {
  AbrirSesionCajaBody,
  AutorizarNotaParams,
  AutorizarNotaResponse,
  AbrirSesionCajaResponse,
  CrearSalidaDineroCajaBody,
  CrearSalidaDineroCajaParams,
  CrearSalidaDineroCajaResponse,
  ListarSalidasDineroCajaParams,
  ListarSalidasDineroCajaResponse,
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
  ListarTicketsCajaQueryParams,
  ListarTicketsCajaResponse,
  ListarTicketsPendientesQueryParams,
  ListarTicketsPendientesResponse,
  ListarSesionesCajaResponse,
  ListarTicketsQueryParams,
  ListarTicketsResponse,
  ObtenerCorteCajaParams,
  ObtenerCorteCajaResponse,
  ObtenerDocumentoImpresionTicketQueryParams,
  ObtenerSesionCajaActualQueryParams,
  ObtenerSesionCajaActualResponse,
  ObtenerTicketParams,
  ObtenerTicketResponse,
  GetPosClienteCreditoDisponibleParams,
  GetPosClienteCreditoDisponibleQueryParams,
  GetPosClienteCreditoDisponibleResponse,
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
  proveedoresTable,
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
  autorizarNota,
  buildCorteCaja,
  buildTicketDetail,
  buscarPos,
  cancelarTicket,
  cerrarSesionCaja,
  crearSalidaDineroCaja,
  cobrarTicket,
  crearTicket,
  isInventoryError,
  listarTicketsCajaOperativa,
  listarTicketsPendientesCaja,
  listarSesionesCajaHistorial,
  PosError,
  projectTicketPrintDocument,
  validarPrecioPos,
} from "../lib/pos";
import { normalizeUsername } from "../lib/auth-identifiers";
import {
  loadCustomerCreditProjection,
  loadCustomerCreditReservationCents,
} from "../lib/credit-aging-read-model";

const router: IRouter = Router();
router.use(["/pos", "/tickets", "/caja", "/sesiones-caja"], requireSession);

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
      throw new PosError("Selecciona una ubicación.", "LOCATION_REQUIRED");
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

function normalizeBooleanQueryParam(value: unknown): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
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

function assertTicketReadLocation(req: Request, ubicacionId: number): void {
  if (["ADMIN", "CONTADOR", "SISTEMAS"].includes(req.auth!.user.rol)) return;
  assertOperationalLocation(req, ubicacionId);
}

/** Fiscal/technical reviewers may inspect an immutable ticket, never operate POS. */
function requiereLecturaTicket(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (["ADMIN", "CONTADOR", "SISTEMAS"].includes(req.auth!.user.rol)) {
    next();
    return;
  }
  void requiereAlguno([
    { modulo: "pos", accion: "ver" },
    { modulo: "cobros_pagos", accion: "ver" },
  ])(req, res, next);
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
        check.accion === "ver" ? permission?.puedeVer : permission?.puedeCrear;
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
        eq(usuariosTable.usuario, normalizeUsername(credentials.usuario)),
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

router.get(
  "/pos/clientes/:clienteId/credito-disponible",
  requierePermiso("pos", "crear"),
  async (req, res, next): Promise<void> => {
    try {
      const { clienteId } = GetPosClienteCreditoDisponibleParams.parse(req.params);
      const { ubicacionId: requestedLocationId } =
        GetPosClienteCreditoDisponibleQueryParams.parse(req.query);
      const ubicacionId = scopedLocation(req, requestedLocationId);
      assertOperationalLocation(req, ubicacionId);

      const [cliente] = await db
        .select({
          id: clientesTable.id,
          activo: clientesTable.activo,
          limiteCredito: clientesTable.limiteCredito,
        })
        .from(clientesTable)
        .where(eq(clientesTable.id, clienteId))
        .limit(1);
      if (!cliente?.activo) {
        throw new PosError("Cliente no encontrado o inactivo.", "INVALID_CLIENT", 404);
      }

      const [projection, reservationCents] = await Promise.all([
        loadCustomerCreditProjection(clienteId),
        loadCustomerCreditReservationCents(clienteId),
      ]);
      const ledgerNetCents =
        projection.balanceCents - projection.overpaymentCents;
      const committedCents = ledgerNetCents + reservationCents;
      const limitCents = Math.round(Number(cliente.limiteCredito) * 100);
      const availableCents = Math.max(0, limitCents - committedCents);
      res.json(
        GetPosClienteCreditoDisponibleResponse.parse({
          clienteId,
          limiteCredito: (limitCents / 100).toFixed(2),
          saldoComprometido: (committedCents / 100).toFixed(2),
          creditoDisponible: (availableCents / 100).toFixed(2),
          puedeComprarCredito: availableCents > 0,
        }),
      );
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
      const notaSinPrecios = (req.body as Record<string, unknown>)
        .notaSinPrecios;
      if (
        notaSinPrecios !== undefined &&
        typeof notaSinPrecios !== "boolean"
      ) {
        throw new PosError(
          "notaSinPrecios debe ser booleano.",
          "INVALID_NOTA_SIN_PRECIOS",
        );
      }
      const body = CrearTicketBody.parse(req.body);
      if (body.clienteId == null) {
        throw new PosError(
          "Debes seleccionar un cliente para crear el ticket.",
          "CLIENT_REQUIRED",
        );
      }
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
            documentoTipo: body.documentoTipo,
            notaSinPrecios: notaSinPrecios === true,
            nombreDestinatario: body.nombreDestinatario,
            direccionEntregaSnapshot: body.direccionEntregaSnapshot,
            tipo: body.tipo,
            facturado: body.facturado,
            diasPlazo: body.diasPlazo,
            uuidCliente: body.uuidCliente,
            lineas: body.lineas.map((linea) => ({
              rolloId: linea.rolloId,
              productoId: linea.productoId,
              tipo: linea.tipo,
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
      const query = ListarTicketsQueryParams.parse({
        ...req.query,
        cobrado: normalizeBooleanQueryParam(req.query.cobrado),
      });
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
           notaSinPrecios: ticketsTable.notaSinPrecios,
          subtotal: ticketsTable.subtotal,
          iva: ticketsTable.iva,
          tasaIva: ticketsTable.tasaIva,
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
  "/tickets/pendientes",
  requiereAlguno([
    { modulo: "pos", accion: "ver" },
    { modulo: "cobros_pagos", accion: "ver" },
  ]),
  async (req, res, next): Promise<void> => {
    try {
      const query = ListarTicketsPendientesQueryParams.parse(req.query);
      const ubicacionId = scopedLocation(req, query.ubicacionId);
      const rows = await listarTicketsPendientesCaja(db, ubicacionId);
      const response = ListarTicketsPendientesResponse.parse(
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
  "/caja/tickets",
  requierePermiso("cobros_pagos", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const query = ListarTicketsCajaQueryParams.parse(req.query);
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
        res.json(ListarTicketsCajaResponse.parse([]));
        return;
      }
      const tickets = await listarTicketsCajaOperativa(db, {
        ubicacionId,
        sesionCajaId: sesion.id,
      });
      res.json(ListarTicketsCajaResponse.parse(tickets));
    } catch (error) {
      handlePosError(error, res, next);
    }
  },
);

router.get(
  "/tickets/:id/documento-impresion",
  requiereLecturaTicket,
  async (req, res, next): Promise<void> => {
    try {
      const params = ObtenerTicketParams.parse(req.params);
      const { copia } = ObtenerDocumentoImpresionTicketQueryParams.parse(
        req.query,
      );
      const ticket = await buildTicketDetail(db, params.id, false);
      if (!ticket) {
        res.status(404).json({ error: "Ticket no encontrado." });
        return;
      }
      assertTicketReadLocation(req, ticket.ubicacionId);
      res.json(projectTicketPrintDocument(ticket, copia));
    } catch (error) {
      handlePosError(error, res, next);
    }
  },
);

router.get(
  "/tickets/:id",
  requiereLecturaTicket,
  async (req, res, next): Promise<void> => {
    try {
      const params = ObtenerTicketParams.parse(req.params);
      const terminal = req.auth!.user.rol === "TERMINAL";
      const ticket = await buildTicketDetail(db, params.id, !terminal);
      if (!ticket) {
        res.status(404).json({ error: "Ticket no encontrado." });
        return;
      }
      assertTicketReadLocation(req, ticket.ubicacionId);
      const parsed = ObtenerTicketResponse.parse(ticket);
      res.json(
        omitTerminalTicketSensitiveFields(
          {
            ...(parsed as unknown as Record<string, unknown>),
            diasCreditoCliente: ticket.diasCreditoCliente,
          },
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
      const result = await db.transaction((tx) =>
        cobrarTicket(
          tx,
          {
            ticketId: params.id,
            sesionCajaId: session.id,
            usuarioId: req.auth!.user.id,
            clienteId: body.clienteId,
            facturado: body.facturado,
            pagos: body.pagos.map((pago) => ({
              formaPago: pago.formaPago,
              importe: String(pago.importe),
              referencia: pago.referencia,
            })),
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

router.post(
  "/tickets/:id/autorizar",
  requierePermiso("cobros_pagos", "crear"),
  async (req, res, next): Promise<void> => {
    try {
      const params = AutorizarNotaParams.parse(req.params);
      const [ticket] = await db.select({ ubicacionId: ticketsTable.ubicacionId })
        .from(ticketsTable).where(eq(ticketsTable.id, params.id)).limit(1);
      if (!ticket) { res.status(404).json({ error: "Nota no encontrada." }); return; }
      assertOperationalLocation(req, ticket.ubicacionId);
      const [session] = await db.select({ id: sesionesCajaTable.id }).from(sesionesCajaTable)
        .where(and(eq(sesionesCajaTable.ubicacionId, ticket.ubicacionId), eq(sesionesCajaTable.estado, "ABIERTA"))).limit(1);
      if (!session) throw new PosError("Abre una sesión de caja antes de autorizar.", "OPEN_SESSION_REQUIRED", 409);
      const result = await db.transaction((tx) => autorizarNota(tx, {
        ticketId: params.id, sesionCajaId: session.id,
        usuarioId: req.auth!.user.id, ip: getRequestIp(req),
      }, true));
      res.json(AutorizarNotaResponse.parse(result));
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

router.get(
  "/sesiones-caja",
  async (req, res, next): Promise<void> => {
    try {
      if (req.auth!.user.rol !== "ADMIN") {
        res
          .status(403)
          .json({ error: "Solo ADMIN puede consultar el historial de caja." });
        return;
      }
      res.json(
        ListarSesionesCajaResponse.parse(await listarSesionesCajaHistorial(db)),
      );
    } catch (error) {
      handlePosError(error, res, next);
    }
  },
);

router.post(
  "/sesiones-caja/abrir",
  requierePermiso("cortes", "ver"),
  requierePermiso("cortes", "crear"),
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
  requierePermiso("cortes", "ver"),
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

router.get(
  "/sesiones-caja/:id/salidas-dinero",
  requierePermiso("cortes", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const sesionId = ListarSalidasDineroCajaParams.parse(req.params).id;
      const corte = await buildCorteCaja(db, sesionId);
      if (!corte) { res.status(404).json({ error: "Sesión no encontrada." }); return; }
      assertOperationalLocation(req, corte.sesion.ubicacionId);
      res.json(ListarSalidasDineroCajaResponse.parse({ salidas: corte.salidas }));
    } catch (error) { handlePosError(error, res, next); }
  },
);

router.post(
  "/sesiones-caja/:id/salidas-dinero",
  requierePermiso("cortes", "ver"),
  requierePermiso("cortes", "crear"),
  async (req, res, next): Promise<void> => {
    try {
      const sesionId = CrearSalidaDineroCajaParams.parse(req.params).id;
      const body = CrearSalidaDineroCajaBody.parse(req.body);
      const session = await getSesion(sesionId);
      if (!session) { res.status(404).json({ error: "Sesión no encontrada." }); return; }
      assertOperationalLocation(req, session.ubicacionId);
      const salida = await db.transaction((tx) => crearSalidaDineroCaja(tx, {
        sesionCajaId: sesionId, monto: body.monto, motivo: body.motivo, proveedorId: body.proveedorId,
        cuentaOrigen: body.cuentaOrigen, creadoPorId: req.auth!.user.id, ip: getRequestIp(req),
      }));
      res.status(201).json(CrearSalidaDineroCajaResponse.parse({
        ...salida, createdAt: salida.createdAt,
      }));
    } catch (error) { handlePosError(error, res, next); }
  },
);

router.get(
  "/caja/proveedores-activos",
  requierePermiso("cortes", "ver"),
  async (_req, res, next): Promise<void> => {
    try {
      // Deliberately a minimal operational catalog: no balances, contact data, or purchases.
      const proveedores = await db.select({ id: proveedoresTable.id, nombre: proveedoresTable.nombre })
        .from(proveedoresTable).where(eq(proveedoresTable.activo, true)).orderBy(proveedoresTable.nombre);
      res.json(proveedores);
    } catch (error) { handlePosError(error, res, next); }
  },
);

export default router;
