import { useGetReporteSeccion, getGetReporteSeccionQueryKey } from "@workspace/api-client-react";
import { GenericReportRenderer } from "../generic-report-renderer";
import CajaDiferencias from "@/pages/caja/diferencias";
import type { CashControls } from "../cash-controls";
import type { ReportComparisonFrame } from "../report-source-frame";

function ControlSourceFrame({
  apiParams,
  isDateRangeValid,
  selectedLocationId,
  siteLabel,
  controls,
  onControlsChange,
}: {
  apiParams: any;
  isDateRangeValid: boolean;
  selectedLocationId: number | null;
  siteLabel?: string;
  controls: CashControls;
  onControlsChange: (controls: CashControls) => void;
}) {
  const { data, isLoading, isError, refetch } = useGetReporteSeccion("control-operativo", apiParams, {
    query: {
      enabled: isDateRangeValid,
      queryKey: getGetReporteSeccionQueryKey("control-operativo", apiParams),
    },
  });

  return (
    <div className={siteLabel
      ? "space-y-4 rounded-xl border border-border/70 bg-card/40 p-4"
      : "space-y-4"}>
      {siteLabel && <h2 className="text-xl font-bold tracking-tight text-sidebar">{siteLabel}</h2>}
      <CajaDiferencias
        embedded
        filters={{
          desde: apiParams.desde,
          hasta: apiParams.hasta,
          ubicacionId: selectedLocationId,
        }}
        controls={controls}
        onControlsChange={onControlsChange}
      />
      <div className="pt-8 border-t border-border space-y-4">
        {siteLabel ? (
          <h3 className="text-lg font-bold tracking-tight text-sidebar">Alertas y Controles</h3>
        ) : (
          <h2 className="text-xl font-bold tracking-tight text-sidebar">Alertas y Controles</h2>
        )}
        <GenericReportRenderer
          data={data}
          isLoading={isLoading}
          isError={isError}
          refetch={refetch}
          section={`control-operativo${siteLabel ? `-${siteLabel}` : ""}`}
        />
      </div>
    </div>
  );
}

export function ControlOperativoTab({
  apiParams,
  isDateRangeValid,
  selectedLocationId,
  comparisonMode = false,
  comparisonFrames = [],
  cashControls,
  onCashControlsChange,
}: {
  apiParams: any;
  isDateRangeValid: boolean;
  selectedLocationId: number | null;
  comparisonMode?: boolean;
  comparisonFrames?: ReportComparisonFrame[];
  cashControls: CashControls;
  onCashControlsChange: (controls: CashControls) => void;
}) {
  return (
    <div className="space-y-12">
      {comparisonMode ? comparisonFrames.map((frame) => (
        <ControlSourceFrame
          key={frame.siteId}
          apiParams={frame.apiParams}
          isDateRangeValid={isDateRangeValid}
          selectedLocationId={frame.siteId}
          siteLabel={frame.siteLabel}
          controls={cashControls}
          onControlsChange={onCashControlsChange}
        />
      )) : (
        <ControlSourceFrame
          apiParams={apiParams}
          isDateRangeValid={isDateRangeValid}
          selectedLocationId={selectedLocationId}
          controls={cashControls}
          onControlsChange={onCashControlsChange}
        />
      )}
    </div>
  );
}
