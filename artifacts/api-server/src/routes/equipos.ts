import { Router, type IRouter } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  CreateEquipoBody,
  CreateEquipoResponse,
  ListEquiposQueryParams,
  ListEquiposResponse,
  ToggleEquipoChecklistBody,
  ToggleEquipoChecklistParams,
  ToggleEquipoChecklistResponse,
  UpdateEquipoBody,
  UpdateEquipoParams,
  UpdateEquipoResponse,
} from "@workspace/api-zod";
import {
  auditoriaTable,
  checklistEquipo,
  db,
  equiposChecklistTable,
  equiposTable,
  esChecklistEquipoValido,
  ubicacionesTable,
  usuariosTable,
  DEFINICIONES_EQUIPO,
  type TipoEquipo,
} from "@workspace/db";
import { requireSession } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { getRequestIp } from "../lib/request";
import { checkOperationalScope, resolveReadScope } from "./inventario";

const router: IRouter = Router();

type EquipmentRow = typeof equiposTable.$inferSelect & {
  ubicacionNombre: string;
};

async function loadEquipos(ubicacionId?: number, equipoId?: number) {
  const filter =
    ubicacionId !== undefined && equipoId !== undefined
      ? and(
          eq(equiposTable.ubicacionId, ubicacionId),
          eq(equiposTable.id, equipoId),
        )
      : ubicacionId !== undefined
        ? eq(equiposTable.ubicacionId, ubicacionId)
        : equipoId !== undefined
          ? eq(equiposTable.id, equipoId)
          : undefined;
  const rows = await db
    .select({
      id: equiposTable.id,
      ubicacionId: equiposTable.ubicacionId,
      tipo: equiposTable.tipo,
      identificador: equiposTable.identificador,
      marca: equiposTable.marca,
      modelo: equiposTable.modelo,
      numeroSerie: equiposTable.numeroSerie,
      notas: equiposTable.notas,
      creadoPor: equiposTable.creadoPor,
      actualizadoPor: equiposTable.actualizadoPor,
      createdAt: equiposTable.createdAt,
      updatedAt: equiposTable.updatedAt,
      ubicacionNombre: ubicacionesTable.nombre,
    })
    .from(equiposTable)
    .innerJoin(
      ubicacionesTable,
      eq(ubicacionesTable.id, equiposTable.ubicacionId),
    )
    .where(filter)
    .orderBy(
      ubicacionesTable.nombre,
      sql`CASE ${equiposTable.tipo}
        WHEN 'COMPUTADORA_POS' THEN 1
        WHEN 'IMPRESORA_ETIQUETAS' THEN 2
        WHEN 'IMPRESORA_TICKETS' THEN 3
        WHEN 'PISTOLA_ESCANER' THEN 4
        WHEN 'SMARTPHONE_ESCANER' THEN 5
      END`,
      equiposTable.identificador,
    );

  const ids = rows.map((row) => row.id);
  const checks =
    ids.length === 0
      ? []
      : await db
          .select({
            equipoId: equiposChecklistTable.equipoId,
            itemKey: equiposChecklistTable.itemKey,
            checkedAt: equiposChecklistTable.checkedAt,
            actorId: usuariosTable.id,
            actorNombre: usuariosTable.nombre,
          })
          .from(equiposChecklistTable)
          .innerJoin(
            usuariosTable,
            eq(usuariosTable.id, equiposChecklistTable.checkedPor),
          )
          .where(inArray(equiposChecklistTable.equipoId, ids));
  const byEquipo = new Map<number, typeof checks>();
  for (const check of checks) {
    const current = byEquipo.get(check.equipoId) ?? [];
    current.push(check);
    byEquipo.set(check.equipoId, current);
  }
  return rows.map((row) => presentEquipo(row, byEquipo.get(row.id) ?? []));
}

function presentEquipo(
  row: EquipmentRow,
  checkedRows: {
    itemKey: string;
    checkedAt: Date;
    actorId: number;
    actorNombre: string;
  }[],
) {
  const checked = new Map(checkedRows.map((item) => [item.itemKey, item]));
  const checklist = checklistEquipo(row.tipo).map((definition) => {
    const state = checked.get(definition.key);
    return {
      key: definition.key,
      label: definition.label,
      checked: state !== undefined,
      actorId: state?.actorId ?? null,
      actorNombre: state?.actorNombre ?? null,
      checkedAt: state?.checkedAt ?? null,
    };
  });
  const faltantes = checklist.filter((item) => !item.checked);
  return {
    id: row.id,
    ubicacionId: row.ubicacionId,
    ubicacionNombre: row.ubicacionNombre,
    tipo: row.tipo,
    tipoLabel: DEFINICIONES_EQUIPO[row.tipo].label,
    identificador: row.identificador,
    marca: row.marca,
    modelo: row.modelo,
    numeroSerie: row.numeroSerie,
    notas: row.notas,
    activo: faltantes.length === 0,
    faltantes: faltantes.length,
    checklist,
    creadoPor: row.creadoPor,
    actualizadoPor: row.actualizadoPor,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function cleanOptional(value: string | null | undefined) {
  if (value === undefined) return undefined;
  const clean = value?.trim() ?? "";
  return clean === "" ? null : clean;
}

router.use("/equipos", requireSession);

router.get(
  "/equipos",
  requierePermiso("equipos", "ver"),
  async (req, res): Promise<void> => {
    const query = ListEquiposQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: "Filtro de equipos inválido." });
      return;
    }
    const requested = query.data.ubicacionId;
    const scope = resolveReadScope(req.auth!, requested);
    if (
      scope.scopeError ||
      (requested !== undefined &&
        scope.ubicacionId !== undefined &&
        requested !== scope.ubicacionId)
    ) {
      res
        .status(403)
        .json({ error: scope.scopeError ?? "No puedes consultar otra ubicación." });
      return;
    }
    if (scope.ubicacionId === null) {
      res.json(ListEquiposResponse.parse([]));
      return;
    }
    res.json(
      ListEquiposResponse.parse(
        await loadEquipos(scope.ubicacionId ?? undefined),
      ),
    );
  },
);

router.post(
  "/equipos",
  requierePermiso("equipos", "editar"),
  async (req, res, next): Promise<void> => {
    const body = CreateEquipoBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Datos del equipo inválidos." });
      return;
    }
    const scopeError = checkOperationalScope(req.auth!, [
      body.data.ubicacionId,
    ]);
    if (scopeError) {
      res.status(403).json({ error: scopeError });
      return;
    }
    try {
      const id = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(equiposTable)
          .values({
            ubicacionId: body.data.ubicacionId,
            tipo: body.data.tipo as TipoEquipo,
            identificador: body.data.identificador.trim(),
            marca: body.data.marca.trim(),
            modelo: body.data.modelo.trim(),
            numeroSerie: cleanOptional(body.data.numeroSerie),
            notas: cleanOptional(body.data.notas),
            creadoPor: req.auth!.user.id,
            actualizadoPor: req.auth!.user.id,
          })
          .returning();
        await tx.insert(auditoriaTable).values({
          usuarioId: req.auth!.user.id,
          sitioId: row!.ubicacionId,
          modulo: "equipos",
          accion: "CREAR",
          entidad: "equipos",
          entidadId: String(row!.id),
          datosDespues: row as Record<string, unknown>,
          ip: getRequestIp(req),
        });
        return row!.id;
      });
      const [created] = await loadEquipos(undefined, id);
      res.status(201).json(CreateEquipoResponse.parse(created));
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        res.status(409).json({
          error: "Ya existe un equipo con ese identificador en el sitio.",
        });
        return;
      }
      next(error);
    }
  },
);

router.patch(
  "/equipos/:id",
  requierePermiso("equipos", "editar"),
  async (req, res, next): Promise<void> => {
    const params = UpdateEquipoParams.safeParse(req.params);
    const body = UpdateEquipoBody.safeParse(req.body);
    if (
      !params.success ||
      !body.success ||
      Object.keys(body.data).length === 0
    ) {
      res.status(400).json({ error: "Datos del equipo inválidos." });
      return;
    }
    try {
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT id FROM equipos WHERE id = ${params.data.id} FOR UPDATE`,
        );
        const [before] = await tx
          .select()
          .from(equiposTable)
          .where(eq(equiposTable.id, params.data.id))
          .limit(1);
        if (!before) throw new Error("NOT_FOUND");
        const targetSite = body.data.ubicacionId ?? before.ubicacionId;
        const scopeError = checkOperationalScope(req.auth!, [
          before.ubicacionId,
          targetSite,
        ]);
        if (scopeError) throw new Error(`SCOPE:${scopeError}`);
        const nextType = body.data.tipo as TipoEquipo | undefined;
        const checkedBefore = await tx
          .select({
            itemKey: equiposChecklistTable.itemKey,
            checkedPor: equiposChecklistTable.checkedPor,
            checkedAt: equiposChecklistTable.checkedAt,
          })
          .from(equiposChecklistTable)
          .where(eq(equiposChecklistTable.equipoId, before.id));
        if (nextType !== undefined && nextType !== before.tipo) {
          await tx
            .delete(equiposChecklistTable)
            .where(eq(equiposChecklistTable.equipoId, before.id));
        }
        const [after] = await tx
          .update(equiposTable)
          .set({
            ubicacionId: body.data.ubicacionId,
            tipo: nextType,
            identificador: body.data.identificador?.trim(),
            marca: body.data.marca?.trim(),
            modelo: body.data.modelo?.trim(),
            numeroSerie: cleanOptional(body.data.numeroSerie),
            notas: cleanOptional(body.data.notas),
            actualizadoPor: req.auth!.user.id,
            updatedAt: new Date(),
          })
          .where(eq(equiposTable.id, before.id))
          .returning();
        await tx.insert(auditoriaTable).values({
          usuarioId: req.auth!.user.id,
          sitioId: targetSite,
          modulo: "equipos",
          accion: "ACTUALIZAR",
          entidad: "equipos",
          entidadId: String(before.id),
          datosAntes: { ...before, checklist: checkedBefore },
          datosDespues: {
            ...after,
            checklist:
              nextType !== undefined && nextType !== before.tipo
                ? []
                : checkedBefore,
          },
          ip: getRequestIp(req),
        });
      });
      const [updated] = await loadEquipos(undefined, params.data.id);
      res.json(UpdateEquipoResponse.parse(updated));
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") {
        res.status(404).json({ error: "Equipo no encontrado." });
        return;
      }
      if (error instanceof Error && error.message.startsWith("SCOPE:")) {
        res.status(403).json({ error: error.message.slice(6) });
        return;
      }
      if ((error as { code?: string }).code === "23505") {
        res.status(409).json({
          error: "Ya existe un equipo con ese identificador en el sitio.",
        });
        return;
      }
      next(error);
    }
  },
);

router.patch(
  "/equipos/:id/checklist/:itemKey",
  requierePermiso("equipos", "editar"),
  async (req, res): Promise<void> => {
    const params = ToggleEquipoChecklistParams.safeParse(req.params);
    const body = ToggleEquipoChecklistBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Casilla de verificación inválida." });
      return;
    }
    try {
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT id FROM equipos WHERE id = ${params.data.id} FOR UPDATE`,
        );
        const [equipment] = await tx
          .select()
          .from(equiposTable)
          .where(eq(equiposTable.id, params.data.id))
          .limit(1);
        if (!equipment) throw new Error("NOT_FOUND");
        const scopeError = checkOperationalScope(req.auth!, [
          equipment.ubicacionId,
        ]);
        if (scopeError) throw new Error(`SCOPE:${scopeError}`);
        if (!esChecklistEquipoValido(equipment.tipo, params.data.itemKey)) {
          throw new Error("INVALID_ITEM");
        }
        const [before] = await tx
          .select({
            checkedPor: equiposChecklistTable.checkedPor,
            checkedPorNombre: usuariosTable.nombre,
            checkedAt: equiposChecklistTable.checkedAt,
          })
          .from(equiposChecklistTable)
          .innerJoin(
            usuariosTable,
            eq(usuariosTable.id, equiposChecklistTable.checkedPor),
          )
          .where(
            and(
              eq(equiposChecklistTable.equipoId, equipment.id),
              eq(equiposChecklistTable.itemKey, params.data.itemKey),
            ),
          )
          .limit(1);
        let effectiveAt: Date;
        let effectiveCheckedPor: number | null = null;
        if (body.data.checked) {
          const [written] = await tx
            .insert(equiposChecklistTable)
            .values({
              equipoId: equipment.id,
              itemKey: params.data.itemKey,
              checkedPor: req.auth!.user.id,
              checkedAt: sql`clock_timestamp()`,
            })
            .onConflictDoUpdate({
              target: [
                equiposChecklistTable.equipoId,
                equiposChecklistTable.itemKey,
              ],
              set: {
                checkedPor: req.auth!.user.id,
                checkedAt: sql`clock_timestamp()`,
              },
            })
            .returning();
          effectiveAt = written!.checkedAt;
          effectiveCheckedPor = written!.checkedPor;
        } else {
          await tx
            .delete(equiposChecklistTable)
            .where(
              and(
                eq(equiposChecklistTable.equipoId, equipment.id),
                eq(equiposChecklistTable.itemKey, params.data.itemKey),
              ),
            );
          const timestamp = await tx.execute<{ effectiveAt: Date }>(
            sql`SELECT clock_timestamp() AS "effectiveAt"`,
          );
          effectiveAt = timestamp.rows[0]!.effectiveAt;
        }
        const effectiveActor = {
          id: req.auth!.user.id,
          nombre: req.auth!.user.nombre,
        };
        await tx.insert(auditoriaTable).values({
          usuarioId: req.auth!.user.id,
          sitioId: equipment.ubicacionId,
          modulo: "equipos",
          accion: body.data.checked ? "PALOMEAR" : "DESPALOMEAR",
          entidad: "equipos_checklist",
          entidadId: `${equipment.id}:${params.data.itemKey}`,
          datosAntes: {
            checked: before !== undefined,
            checkedPor: before?.checkedPor ?? null,
            checkedPorNombre: before?.checkedPorNombre ?? null,
            checkedAt: before?.checkedAt ?? null,
          },
          datosDespues: {
            checked: body.data.checked,
            checkedPor: effectiveCheckedPor,
            checkedAt: body.data.checked ? effectiveAt : null,
            effectiveActor,
            effectiveAt,
          },
          ip: getRequestIp(req),
        });
      });
      const [updated] = await loadEquipos(undefined, params.data.id);
      res.json(ToggleEquipoChecklistResponse.parse(updated));
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") {
        res.status(404).json({ error: "Equipo no encontrado." });
        return;
      }
      if (error instanceof Error && error.message === "INVALID_ITEM") {
        res.status(400).json({
          error: "La casilla no pertenece al tipo de este equipo.",
        });
        return;
      }
      if (error instanceof Error && error.message.startsWith("SCOPE:")) {
        res.status(403).json({ error: error.message.slice(6) });
        return;
      }
      throw error;
    }
  },
);

export default router;