type Named = { nombre: string; esSistema?: boolean };

export const spanishCollator = new Intl.Collator("es", {
  sensitivity: "base",
  numeric: true,
});

export function ordenarEspanol<T extends Named>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const aSystem = a.esSistema === true || a.nombre === "Venta a Público";
    const bSystem = b.esSistema === true || b.nombre === "Venta a Público";
    if (aSystem !== bSystem) return aSystem ? -1 : 1;
    return spanishCollator.compare(a.nombre, b.nombre);
  });
}

export function direccionEntregaEfectiva(cliente: {
  direccionEntrega: string | null;
  direccionParticular: string | null;
}): string | null {
  return cliente.direccionEntrega?.trim() || cliente.direccionParticular?.trim() || null;
}