import { useLayoutEffect, useRef } from "react";
import { QRCodeSVG } from 'qrcode.react';
import { MonochromeBrandLogo } from "@/components/monochrome-brand-logo";
import { formatPackageQuantityLabel } from "@workspace/number-format";

export interface LabelData {
  sku: string;
  serie: string;
  tela: string;
  color: string;
  cantidad: string;
  unidad: string;
  reimpresaEn?: string;
}

function formatLabelQuantity(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(3) : value;
}

function AutoFitText({
  children,
  className,
  maxFontSize,
  minFontSize,
  testId,
}: {
  children: string;
  className: string;
  maxFontSize: number;
  minFontSize: number;
  testId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let cancelled = false;

    const fit = () => {
      if (cancelled) return;
      let fontSize = maxFontSize;
      element.style.fontSize = `${fontSize}px`;
      while (element.scrollWidth > element.clientWidth && fontSize > minFontSize) {
        fontSize -= 1;
        element.style.fontSize = `${fontSize}px`;
      }
    };

    fit();
    void document.fonts?.ready.then(() => requestAnimationFrame(fit));
    window.addEventListener("beforeprint", fit);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    observer?.observe(element);
    return () => {
      cancelled = true;
      observer?.disconnect();
      window.removeEventListener("beforeprint", fit);
    };
  }, [children, maxFontSize, minFontSize]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ fontSize: `${maxFontSize}px` }}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

export function LabelPrint({ data, className = "" }: { data: LabelData; className?: string }) {
  const qrPayload = `${data.sku}-${data.serie}`;
  const unitLabel = formatPackageQuantityLabel(data.unidad);
  const productName = `${data.tela} - ${data.color}`.toUpperCase();

  return (
    <div
      className={`label-page bg-white text-black p-[3mm] font-sans border border-gray-300 rounded-[3mm] relative overflow-hidden flex flex-col ${className}`}
      style={{ width: '100mm', height: '70mm', boxSizing: 'border-box' }}
    >
      <AutoFitText
        className="h-[11mm] px-[1mm] flex items-center justify-center font-black uppercase whitespace-nowrap overflow-hidden w-full flex-shrink-0 text-center leading-none tracking-[-0.02em]"
        maxFontSize={30}
        minFontSize={11}
      >
        {productName}
      </AutoFitText>

      <div className="border-b-[1.2mm] border-black w-full flex-shrink-0"></div>

      <div className="grid grid-cols-[31mm_30mm_minmax(0,1fr)] gap-[1mm] flex-1 min-h-0 pt-[2.5mm]">
        <div className="flex flex-col min-w-0 pr-[3mm]">
          <div className="flex-1 border-b border-gray-400 flex flex-col justify-center">
            <div className="text-[8px] font-medium text-gray-600 uppercase leading-none">SKU</div>
            <AutoFitText
              className="w-full overflow-hidden font-black whitespace-nowrap leading-none mt-[1.5mm]"
              maxFontSize={15}
              minFontSize={5}
            >
              {data.sku}
            </AutoFitText>
          </div>
          <div className="flex-1 border-b border-gray-400 flex flex-col justify-center">
            <div className="text-[8px] font-medium text-gray-600 uppercase leading-none">NO. DE SERIE</div>
            <div className="text-[21px] font-black truncate leading-none mt-[1.5mm] tracking-tight">{data.serie}</div>
          </div>
          <div className="flex-[1.25] flex flex-col justify-center">
            <div className="text-[8px] font-medium text-gray-600 uppercase leading-none">{unitLabel}</div>
            <AutoFitText
              className="w-full min-w-0 max-w-full overflow-hidden whitespace-nowrap font-black tabular-nums tracking-tighter leading-none mt-[1.5mm]"
              maxFontSize={29}
              minFontSize={10}
              testId="label-quantity"
            >
              {formatLabelQuantity(data.cantidad)}
            </AutoFitText>
          </div>
        </div>

        <div className="flex min-w-0 flex-col items-center justify-center px-0">
          <MonochromeBrandLogo className="h-auto max-h-[44mm] w-full max-w-[33mm]" />
          <div className="mt-[0.5mm] w-full whitespace-nowrap text-center text-[10px] font-black leading-none tracking-[-0.03em] text-black">
            MARIANA TEXTIL
          </div>
        </div>

        <div className="flex flex-col items-center justify-center relative min-w-0">
          <div className="box-border flex-none rounded-[2mm] border border-black bg-white p-[1mm]">
            <QRCodeSVG
              value={qrPayload}
              size={256}
              width="29mm"
              height="29mm"
              className="block shrink-0"
              style={{ width: "29mm", height: "29mm", minWidth: "29mm", minHeight: "29mm", flexShrink: 0 }}
              level="Q"
              includeMargin={true}
              fgColor="#000000"
              bgColor="#ffffff"
            />
          </div>
          <AutoFitText
            className="w-full overflow-hidden text-center font-black mt-[1.5mm] whitespace-nowrap leading-none text-black"
            maxFontSize={9}
            minFontSize={4}
          >
            {qrPayload}
          </AutoFitText>
          {data.reimpresaEn && (
            <div className="absolute bottom-0 right-0 text-[6px] font-medium tracking-wide text-gray-500">
              REIMPRESA · {new Date(data.reimpresaEn).toLocaleDateString("es-MX")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}