export type SupplierSort = "nombre" | "tipo" | "saldo" | "comprado" | "ultima" | "estado" | "demanda";

type Row = {
  id: number;
  nombre: string;
  tipo: string;
  activo: boolean;
  saldoPendiente?: string | null;
  totalComprado12Meses?: string | null;
  ultimaCompra?: string | null;
};

export function sortSupplierDirectoryRows<T extends Row>(
  rows: readonly T[],
  sort: SupplierSort,
  direction: "asc" | "desc",
  counts: ReadonlyMap<number, number>,
): T[] {
  const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });
  return [...rows].sort((a, b) => {
    if (sort === "ultima") {
      // Unknown dates are never most-recent, including when the heading is reversed.
      if (!a.ultimaCompra && b.ultimaCompra) return 1;
      if (a.ultimaCompra && !b.ultimaCompra) return -1;
    }
    const numeric = sort === "demanda" || sort === "saldo" || sort === "comprado";
    const value = (p: T): string | number => {
      switch (sort) {
        case "demanda": return counts.get(p.id) ?? 0;
        case "saldo": return Number(p.saldoPendiente ?? 0);
        case "comprado": return Number(p.totalComprado12Meses ?? 0);
        case "ultima": return p.ultimaCompra ?? "";
        case "estado": return p.activo ? 1 : 0;
        case "tipo": return p.tipo;
        default: return p.nombre;
      }
    };
    const av = value(a), bv = value(b);
    const comparison = numeric || sort === "estado" ? Number(av) - Number(bv) : collator.compare(String(av), String(bv));
    return (direction === "asc" ? comparison : -comparison) || collator.compare(a.nombre, b.nombre) || a.id - b.id;
  });
}