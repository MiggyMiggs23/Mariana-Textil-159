export type DatosConfirmacionAjuste = {
  cantidadActual: number | string;
  cantidadNueva?: number | string;
  isBaja: boolean;
};

/**
 * Los ajustes que modifican más de diez unidades requieren una confirmación
 * explícita. En una baja se evalúa la cantidad que será retirada.
 */
export const requiereConfirmacionAjuste = ({
  cantidadActual,
  cantidadNueva,
  isBaja,
}: DatosConfirmacionAjuste) => {
  const actual = Number(cantidadActual);

  if (!Number.isFinite(actual)) return false;
  if (isBaja) return actual > 10;

  const nueva = Number(cantidadNueva);
  return Number.isFinite(nueva) && Math.abs(nueva - actual) > 10;
};