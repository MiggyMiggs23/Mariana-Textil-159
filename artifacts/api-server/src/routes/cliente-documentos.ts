import { randomUUID } from "node:crypto";
import express, { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  auditoriaTable,
  clienteDocumentosTable,
  clientesTable,
  db,
  usuariosTable,
} from "@workspace/db";
import { requireRole, requireSession } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { getRequestIp } from "../lib/request";
import {
  createPrivateReadStream,
  privateObjectPath,
  savePrivateObject,
} from "../lib/private-object-storage";

const router: IRouter = Router();
const MAX_BYTES = 5 * 1024 * 1024;
const MIME = new Set(["image/jpeg", "image/png", "application/pdf"]);
const raw = express.raw({ type: () => true, limit: MAX_BYTES + 1 });

router.use(["/clientes/:id/documentos", "/clientes/:id/documentos/:lado", "/cliente-documentos/:publicId/ver", "/cliente-documentos/:publicId/descargar"], requireSession);

function present(row: typeof clienteDocumentosTable.$inferSelect & { subidoPorNombre: string }) {
  return {
    publicId: row.publicId,
    tipo: row.tipo,
    lado: row.lado,
    nombreArchivo: row.nombreArchivo,
    mimeType: row.mimeType,
    tamanoBytes: row.tamanoBytes,
    subidoAt: row.subidoAt,
    subidoPor: { id: row.subidoPor, nombre: row.subidoPorNombre },
  };
}

router.get(
  "/clientes/:id/documentos",
  requierePermiso("clientes", "ver"),
  requireRole("ADMIN"),
  async (req, res, next): Promise<void> => {
    try {
      const clienteId = Number(req.params.id);
      if (!Number.isInteger(clienteId) || clienteId <= 0) {
        res.status(400).json({ error: "ID inválido." }); return;
      }
      const rows = await db
        .select({
          documento: clienteDocumentosTable,
          subidoPorNombre: usuariosTable.nombre,
        })
        .from(clienteDocumentosTable)
        .innerJoin(usuariosTable, eq(clienteDocumentosTable.subidoPor, usuariosTable.id))
        .where(and(eq(clienteDocumentosTable.clienteId, clienteId), eq(clienteDocumentosTable.vigente, true)))
        .orderBy(clienteDocumentosTable.lado);
      res.json(rows.map((row) => present({ ...row.documento, subidoPorNombre: row.subidoPorNombre })));
    } catch (error) { next(error); }
  },
);

router.post(
  "/clientes/:id/documentos/:lado",
  requierePermiso("clientes", "editar"),
  requireRole("ADMIN"),
  raw,
  async (req, res, next): Promise<void> => {
    try {
      const clienteId = Number(req.params.id);
      const lado = String(req.params.lado).toUpperCase();
      if (!Number.isInteger(clienteId) || !["FRENTE", "REVERSO"].includes(lado)) {
        res.status(400).json({ error: "Cliente o lado inválido." }); return;
      }
      const mimeType = String(req.headers["content-type"] ?? "").split(";")[0]!.trim().toLowerCase();
      if (!MIME.has(mimeType)) {
        res.status(415).json({ error: "Solo se permiten archivos JPG, PNG o PDF." }); return;
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ error: "El archivo está vacío." }); return;
      }
      if (req.body.length > MAX_BYTES) {
        res.status(413).json({ error: "El archivo excede el tamaño máximo de 5 MiB." }); return;
      }
      const nombreArchivo = String(req.headers["x-file-name"] ?? "").trim();
      if (!nombreArchivo || nombreArchivo.length > 255) {
        res.status(400).json({ error: "X-File-Name es obligatorio y debe tener máximo 255 caracteres." }); return;
      }
      const [cliente] = await db.select({ id: clientesTable.id }).from(clientesTable)
        .where(eq(clientesTable.id, clienteId)).limit(1);
      if (!cliente) { res.status(404).json({ error: "Cliente no encontrado." }); return; }

      const storagePath = privateObjectPath(randomUUID());
      try {
        await savePrivateObject(storagePath, req.body, mimeType);
      } catch (error) {
        req.log.error({ err: error }, "No se pudo guardar INE en App Storage");
        res.status(502).json({ error: "No se pudo guardar el documento en App Storage." }); return;
      }
      const created = await db.transaction(async (tx) => {
        const [previous] = await tx.select().from(clienteDocumentosTable)
          .where(and(eq(clienteDocumentosTable.clienteId, clienteId), eq(clienteDocumentosTable.lado, lado), eq(clienteDocumentosTable.vigente, true)))
          .orderBy(desc(clienteDocumentosTable.subidoAt)).limit(1);
        if (previous) {
          await tx.update(clienteDocumentosTable).set({ vigente: false })
            .where(eq(clienteDocumentosTable.id, previous.id));
        }
        const [documento] = await tx.insert(clienteDocumentosTable).values({
          clienteId, lado, nombreArchivo, rutaArchivo: storagePath, mimeType,
          tamanoBytes: req.body.length, subidoPor: req.auth!.user.id,
          reemplazaId: previous?.id ?? null,
        }).returning();
        return documento!;
      });
      res.status(201).json(present({ ...created, subidoPorNombre: req.auth!.user.nombre }));
    } catch (error) { next(error); }
  },
);

async function serve(req: express.Request, res: express.Response, next: express.NextFunction, download: boolean) {
  try {
    const publicId = String(req.params.publicId);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(publicId)) {
      res.status(400).json({ error: "Identificador de documento inválido." }); return;
    }
    const [row] = await db.select().from(clienteDocumentosTable)
      .where(eq(clienteDocumentosTable.publicId, publicId)).limit(1);
    if (!row) { res.status(404).json({ error: "Documento no encontrado." }); return; }
    await db.insert(auditoriaTable).values({
      usuarioId: req.auth!.user.id,
      accion: download ? "DESCARGAR_INE" : "VER_INE",
      entidad: "clientes",
      entidadId: String(row.clienteId),
      datosDespues: { documentoPublicId: row.publicId },
      ip: getRequestIp(req),
    });
    res.type(row.mimeType);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Length", String(row.tamanoBytes));
    if (download) {
      const safeName = row.nombreArchivo.replace(/["\r\n]/g, "_");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    }
    const stream = createPrivateReadStream(row.rutaArchivo);
    stream.on("error", (error) => {
      req.log.error({ err: error }, "No se pudo leer INE de App Storage");
      if (!res.headersSent) res.status(502).json({ error: "No se pudo leer el documento de App Storage." });
      else res.destroy(error as Error);
    });
    stream.pipe(res);
  } catch (error) { next(error); }
}

router.get("/cliente-documentos/:publicId/ver", requierePermiso("clientes", "ver"), requireRole("ADMIN"), (req, res, next) => void serve(req, res, next, false));
router.get("/cliente-documentos/:publicId/descargar", requierePermiso("clientes", "ver"), requireRole("ADMIN"), (req, res, next) => void serve(req, res, next, true));

export default router;