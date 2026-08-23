import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import locationsRouter from "./locations";
import usersRouter from "./users";
import productosRouter from "./productos";
import proveedoresRouter from "./proveedores";
import clientesRouter from "./clientes";
import permisosRouter from "./permisos";
import { inventarioRouter } from "./inventario";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(locationsRouter);
router.use(usersRouter);
router.use(productosRouter);
router.use(proveedoresRouter);
router.use(clientesRouter);
router.use(permisosRouter);
router.use("/inventario", inventarioRouter);

export default router;
