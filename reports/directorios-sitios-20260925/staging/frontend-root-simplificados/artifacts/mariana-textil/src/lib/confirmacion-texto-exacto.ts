export const coincideTextoExacto = (texto: string, requerido: string) =>
  texto === requerido;

export const ejecutarSiTextoCoincide = (
  texto: string,
  requerido: string,
  accion: () => void,
) => {
  if (!coincideTextoExacto(texto, requerido)) return false;
  accion();
  return true;
};