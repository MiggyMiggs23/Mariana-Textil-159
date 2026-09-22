import { useLayoutEffect, useRef } from "react";
import { QRCodeSVG } from 'qrcode.react';
import { MonochromeBrandLogo } from "@/components/monochrome-brand-logo";
import { formatPackageQuantityLabel } from "@workspace/number-format";

/**
 * Discrete print-safe steps. The minimum remains legible on paper while the
 * largest step keeps short product names readable from a distance.
 */
export const LABEL_PRODUCT_NAME_FONT_STEPS_PX = [30, 24, 18, 14] as const;
export const LABEL_QUANTITY_FONT_STEPS_PX = [29, 24, 19, 13] as const;
const LABEL_SKU_FONT_STEPS_PX = [15, 12, 9, 6] as const;
const LABEL_QR_PAYLOAD_FONT_STEPS_PX = [9, 7, 5, 4] as const;

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
  fontSteps,
  testId,
}: {
  children: string;
  className: string;
  fontSteps: readonly number[];
  testId?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;
    let cancelled = false;

    const fit = () => {
      if (cancelled) return;
      let selectedStep = fontSteps.at(-1) ?? 1;
      let fits = false;
      for (const fontSize of fontSteps) {
        container.style.fontSize = `${fontSize}px`;
        selectedStep = fontSize;
        const styles = window.getComputedStyle(container);
        const availableWidth =
          container.getBoundingClientRect().width -
          Number.parseFloat(styles.paddingLeft || "0") -
          Number.parseFloat(styles.paddingRight || "0");
        const textWidth = text.getBoundingClientRect().width;
        fits = textWidth <= availableWidth + 0.5;
        container.dataset.textWidth = textWidth.toFixed(2);
        container.dataset.availableWidth = availableWidth.toFixed(2);
        if (fits) break;
      }
      container.dataset.fontStep = String(selectedStep);
      container.dataset.fitState = fits ? "fits" : "overflow";
    };

    fit();
    void document.fonts?.ready.then(() => requestAnimationFrame(fit));
    window.addEventListener("beforeprint", fit);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    observer?.observe(container);
    const clippingAncestor = container.closest(".label-page");
    if (clippingAncestor) observer?.observe(clippingAncestor);
    return () => {
      cancelled = true;
      observer?.disconnect();
      window.removeEventListener("beforeprint", fit);
    };
  }, [children, fontSteps]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ fontSize: `${fontSteps[0] ?? 1}px` }}
      data-testid={testId}
    >
      <span ref={textRef} className="inline-block whitespace-nowrap">
        {children}
      </span>
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
        className="h-[11mm] px-[1mm] flex items-center justify-center font-black uppercase whitespace-nowrap w-full flex-shrink-0 text-center leading-none tracking-[-0.02em]"
        fontSteps={LABEL_PRODUCT_NAME_FONT_STEPS_PX}
        testId="label-product-name"
      >
        {productName}
      </AutoFitText>

      <div className="border-b-[1.2mm] border-black w-full flex-shrink-0"></div>

      <div className="grid grid-cols-[31mm_30mm_minmax(0,1fr)] gap-[1mm] flex-1 min-h-0 pt-[2.5mm]">
        <div className="flex flex-col min-w-0 pr-[3mm]">
          <div className="flex-1 border-b border-gray-400 flex flex-col justify-center">
            <div className="text-[8px] font-medium text-gray-600 uppercase leading-none">SKU</div>
            <AutoFitText
              className="w-full font-black whitespace-nowrap leading-none mt-[1.5mm]"
              fontSteps={LABEL_SKU_FONT_STEPS_PX}
              testId="label-sku"
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
              className="w-full min-w-0 max-w-full whitespace-nowrap font-black tabular-nums tracking-tighter leading-none mt-[1.5mm]"
              fontSteps={LABEL_QUANTITY_FONT_STEPS_PX}
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
            className="w-full text-center font-black mt-[1.5mm] whitespace-nowrap leading-none text-black"
            fontSteps={LABEL_QR_PAYLOAD_FONT_STEPS_PX}
            testId="label-qr-payload"
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