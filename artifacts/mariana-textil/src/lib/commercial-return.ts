import { customFetch } from "@workspace/api-client-react";
import { z } from "zod";

/** Independent UI gate. Closing capture must never hide existing evidence. */
export const COMMERCIAL_RETURN_UI_ENABLED = false;
const amount = z.string().regex(/^(0|[1-9][0-9]*)\.[0-9]{2}$/);
const revision = z.object({ importeRollo: amount, deudaCancelada: amount, efectivoDevuelto: amount }).strict();
export const commercialReturnRequestSchema = z.object({
  uuidCliente: z.string().uuid(), ticketId: z.number().int().positive(), lineaId: z.number().int().positive(),
  ubicacionRecepcionId: z.number().int().positive(), sesionCajaId: z.number().int().positive(),
  cantidad: z.string().regex(/^(0|[1-9][0-9]{0,6})\.[0-9]{3}$/),
  motivo: z.string().trim().min(1).max(400), revision: revision.optional(),
}).strict();
export const commercialReturnPreviewSchema = revision.extend({
  ticketId: z.number().int().positive(), lineaId: z.number().int().positive(), serie: z.string().min(1),
  cantidad: z.string(), ubicacionRecepcionId: z.number().int().positive(), sesionCajaId: z.number().int().positive(),
}).strict();
export const commercialReturnResultSchema = commercialReturnPreviewSchema.extend({
  id: z.string().uuid(), rolloId: z.number().int().positive(), motivo: z.string().min(1), createdAt: z.string().datetime(),
}).strict();
export type CommercialReturnRequest = z.infer<typeof commercialReturnRequestSchema>;
export type CommercialReturnPreview = z.infer<typeof commercialReturnPreviewSchema>;
export type CommercialReturnResult = z.infer<typeof commercialReturnResultSchema>;
export function returnJournalKey(actorId: number, ticketId: number) {
  return `commercial-return:${actorId}:${ticketId}`;
}
export function commercialReturnMessage(error: unknown): string {
  const record = error as { data?: { error?: { message?: unknown } }; message?: unknown };
  const message = record?.data?.error?.message ?? record?.message;
  return typeof message === "string" ? message : "No se pudo confirmar la devolución.";
}
export async function requestCommercialReturn(input: CommercialReturnRequest, preview: boolean) {
  if (!COMMERCIAL_RETURN_UI_ENABLED) throw new Error("Devolución comercial no habilitada.");
  const body = commercialReturnRequestSchema.parse(input);
  const response = await customFetch<unknown>(`/api/devoluciones-comerciales${preview ? "/vista-previa" : ""}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return preview ? commercialReturnPreviewSchema.parse(response) : commercialReturnResultSchema.parse(response);
}