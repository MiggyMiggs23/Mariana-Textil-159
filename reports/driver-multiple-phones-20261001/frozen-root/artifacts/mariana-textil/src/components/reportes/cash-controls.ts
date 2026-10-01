import { GetAdminDiferenciasAgrupacion } from "@workspace/api-client-react";

export type CashControls = {
  agrupacion: GetAdminDiferenciasAgrupacion;
  umbralCorte: string;
  umbralTienda: string;
};

export const DEFAULT_CASH_CONTROLS: CashControls = {
  agrupacion: GetAdminDiferenciasAgrupacion.semana,
  umbralCorte: "0",
  umbralTienda: "0",
};