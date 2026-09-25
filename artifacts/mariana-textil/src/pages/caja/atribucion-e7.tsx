import { useState } from "react";
import { Link, useSearch } from "wouter";
import { Scale, Wallet } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { E7Attribution } from "@/components/e7-readers";
import { e7On } from "@/lib/e7-feature-flags";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import "./cuentas-destino-layout.css";

const todayCdmx = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

/** Dedicated E7 attribution page. Same reader, contract, role and feature guards as before. */
export default function CajaAtribucionE7() {
  const search = new URLSearchParams(useSearch());
  // Initial period may come from the URL; E7 validates the range itself and never truncates it.
  const [desde, setDesde] = useState(() => search.get("desde") ?? todayCdmx());
  const [hasta, setHasta] = useState(() => search.get("hasta") ?? todayCdmx());
  return (
    <AppLayout>
      <div className="cuentas-destino-layout max-w-[1600px] mx-auto space-y-6 pb-12">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-sidebar flex items-center gap-2">
              <Scale className="h-6 w-6 text-primary" />
              Atribución de cobranza y aplicaciones
            </h1>
            <p className="text-muted-foreground text-sm">Lectura E7 por periodo y alcance autorizado.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="e7-desde" className="text-xs">Desde</Label>
              <Input id="e7-desde" type="date" value={desde} onChange={e => setDesde(e.target.value)} className="h-9 w-[150px]" data-testid="input-e7-desde" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="e7-hasta" className="text-xs">Hasta</Label>
              <Input id="e7-hasta" type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="h-9 w-[150px]" data-testid="input-e7-hasta" />
            </div>
            <Link href="/caja/cuentas-destino" className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-sidebar/5 hover:text-primary" data-testid="link-cuentas-destino">
              <Wallet className="h-4 w-4" /> Cuentas Destino
            </Link>
          </div>
        </div>
        {e7On()
          ? <E7Attribution desde={desde} hasta={hasta} surface="cuentas" />
          : <p role="alert" className="text-sm text-muted-foreground">La lectura E7 está cerrada.</p>}
      </div>
    </AppLayout>
  );
}
