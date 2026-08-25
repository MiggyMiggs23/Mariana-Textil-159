import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CajaComparativo from "@/pages/caja/comparativo";
import CajaDiferencias from "@/pages/caja/diferencias";

export default function Reportes() {
  const [location, setLocation] = useLocation();
  const activeTab = location.endsWith("/diferencias") ? "diferencias" : "comparativo";

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">Reportes</h1>
          <p className="mt-1 text-muted-foreground">
            Análisis consolidados para seguimiento operativo y financiero.
          </p>
        </div>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setLocation(`/reportes/${value}`)}
          className="space-y-6"
        >
          <TabsList>
            <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
            <TabsTrigger value="diferencias">Diferencias</TabsTrigger>
          </TabsList>
          {activeTab === "comparativo" ? (
            <CajaComparativo embedded />
          ) : (
            <CajaDiferencias embedded />
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}