import "./_group.css";
import { SummaryCard } from "./_shared/SummaryCard";

const DISCONNECTED_VALUE = "Sin conectar";

/**
 * Static visual proposal only. Financial data is intentionally not connected.
 * This reuses the local Proveedores summary card without introducing a Clientes
 * API, calculation, authentication, or persistence dependency.
 */
export function PropuestaClientes() {
  return (
    <main className="min-h-screen bg-background p-6 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Propuesta visual — pendiente de corregir alcance por sitio
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">Clientes</h1>
          <p className="text-muted-foreground">
            Gestión de cuentas y saldos de clientes.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Total Cartera" value={DISCONNECTED_VALUE} />
          <SummaryCard label="Total Vencido" value={DISCONNECTED_VALUE} />
          <SummaryCard label="Clientes con Saldo" value={DISCONNECTED_VALUE} />
          <SummaryCard label="Total Clientes" value={DISCONNECTED_VALUE} />
        </div>

        <p className="text-xs text-muted-foreground">
          Propuesta visual sin conexión a datos financieros ni conteos globales.
        </p>
      </div>
    </main>
  );
}