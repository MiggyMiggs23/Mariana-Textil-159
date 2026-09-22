import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import locationsRouter from "./locations";
import usersRouter from "./users";
import productosRouter from "./productos";
import proveedoresRouter from "./proveedores";
import clientesRouter from "./clientes";
import clientesAdminRouter from "./clientes-admin";
import clienteDocumentosRouter from "./cliente-documentos";
import creditEvidenceRouter from "./credit-evidence";
import creditRefundsRouter from "./credit-refunds";
import permisosRouter from "./permisos";
import { inventarioRouter } from "./inventario";
import posRouter from "./pos";
import salidasRouter from "./salidas";
import adminAnalyticsRouter from "./admin-analytics";
import notificacionesRouter from "./notificaciones";
import etiquetasRouter from "./etiquetas";
import adminAlertasRouter from "./admin-alertas";
import reportesRouter from "./reportes";
import contenedoresRouter from "./contenedores";
import preciosRouter from "./precios";
import auditoriaRouter from "./auditoria";
import pagosDirigidosRouter from "./pagos-dirigidos";
import camionetasRouter from "./camionetas";
import choferesRouter from "./choferes";
import viajesRouter from "./viajes";
import auditoriasInventarioRouter from "./auditorias-inventario";
import purgaRouter from "./purga";
import cajaVentasRouter from "./caja-ventas";
import equiposRouter from "./equipos";
import stockMinimosRouter from "./stock-minimos";
import { pool } from "@workspace/db";
import { requireRole, requireSession } from "../middlewares/auth";
import { createFondoRouter } from "./fondo";
import { createE3Router } from "./e3-collections";
import { e3Repository, readE3Receipts, recordE3Print, readE3Context } from "../lib/e3-repository";
import { requierePermiso } from "../lib/permisos";

const router: IRouter = Router();

// Must precede broad /clientes authentication middlewares: CLOSED E3 never queries auth/DB.
router.use(createE3Router({
  authenticate: requireSession, permission: requierePermiso, admin: requireRole("ADMIN"),
  repository: e3Repository, receipts: readE3Receipts, print: recordE3Print, context: readE3Context,
}));
router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(locationsRouter);
router.use(usersRouter);
router.use(productosRouter);
router.use(preciosRouter);
router.use(proveedoresRouter);
router.use(creditEvidenceRouter);
router.use(creditRefundsRouter);
router.use(clientesAdminRouter);
router.use(clienteDocumentosRouter);
router.use(clientesRouter);
router.use(permisosRouter);
router.use("/inventario", inventarioRouter);
router.use("/inventario", auditoriasInventarioRouter);
router.use(posRouter);
router.use(cajaVentasRouter);
router.use(salidasRouter);
router.use(adminAnalyticsRouter);
router.use(adminAlertasRouter);
router.use(reportesRouter);
router.use(contenedoresRouter);
router.use(notificacionesRouter);
router.use(etiquetasRouter);
router.use(auditoriaRouter);
router.use(pagosDirigidosRouter);
router.use(camionetasRouter);
router.use(choferesRouter);
router.use(viajesRouter);
router.use(equiposRouter);
router.use(stockMinimosRouter);
router.use(createFondoRouter({
  db: pool as unknown as import("../lib/fondo").FondoPool,
  authorizeAdmin: [requireSession, requireRole("ADMIN")],
}));
router.use(purgaRouter);

export default router;
