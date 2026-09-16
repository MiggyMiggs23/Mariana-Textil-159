import "./_group.css";
import { SummaryCard } from "./_shared/SummaryCard";

const PLACEHOLDER_VALUE = "—";

/**
 * Current visual reference extracted from Proveedores' four summary cards.
 * It deliberately renders placeholders instead of production financial data.
 */
export function CurrentProveedores() {
  return (
    <main className="min-h-screen bg-background p-6 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Referencia visual — datos de ejemplo
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">Proveedores</h1>
          <p className="text-muted-foreground">
            Gestión de proveedores nacionales y de importación.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Total Deuda" value={PLACEHOLDER_VALUE} />
          <SummaryCard label="Compras del Mes" value={PLACEHOLDER_VALUE} />
          <SummaryCard label="Proveedores con Saldo" value={PLACEHOLDER_VALUE} />
          <SummaryCard label="Total Proveedores" value={PLACEHOLDER_VALUE} />
        </div>

        <p className="text-xs text-muted-foreground">
          Todos los importes y conteos son marcadores visuales; no representan valores financieros reales.
        </p>
      </div>
    </main>
  );
}