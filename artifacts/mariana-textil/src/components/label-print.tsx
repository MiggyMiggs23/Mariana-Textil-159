import { useLayoutEffect, useRef } from "react";
import { QRCodeSVG } from 'qrcode.react';
import { formatNumber } from "@workspace/number-format";

export interface LabelData {
  sku: string;
  serie: string;
  tela: string;
  color: string;
  cantidad: string;
  unidad: string;
  reimpresaEn?: string;
}

function AutoFitText({
  children,
  className,
  maxFontSize,
  minFontSize,
}: {
  children: string;
  className: string;
  maxFontSize: number;
  minFontSize: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const fit = () => {
      let fontSize = maxFontSize;
      element.style.fontSize = `${fontSize}px`;
      while (element.scrollWidth > element.clientWidth && fontSize > minFontSize) {
        fontSize -= 1;
        element.style.fontSize = `${fontSize}px`;
      }
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [children, maxFontSize, minFontSize]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ fontSize: `${maxFontSize}px` }}
    >
      {children}
    </div>
  );
}

export function LabelPrint({ data, className = "" }: { data: LabelData; className?: string }) {
  const qrPayload = `${data.sku}-${data.serie}`;
  const unitLabel = data.unidad.toUpperCase().startsWith('K') ? 'KILOS DEL ROLLO' : 'METROS DEL ROLLO';
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

      <div className="grid grid-cols-[30%_35%_35%] flex-1 min-h-0 pt-[2.5mm]">
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
            <div className="text-[29px] font-black tracking-tighter leading-none mt-[1.5mm]">{formatNumber(data.cantidad, { kind: "quantity" })}</div>
          </div>
        </div>

        <div className="border-l border-gray-400 flex flex-col items-center justify-center px-[3mm] min-w-0">
          <svg aria-label="Mariana Textil" viewBox="0 0 120 92" className="w-[27mm] h-[26mm] text-black" role="img">
            <path fill="currentColor" d="M7 7h25l28 38L88 7h25v78H88V43L60 80 32 43v42H7z" />
            <path fill="#fff" d="M32 7h20l8 12 8-12h20L60 45z" />
          </svg>
          <div className="text-[18px] font-black leading-none tracking-[0.03em] mt-[1mm]">MARIANA</div>
          <div className="text-[7px] font-bold leading-none tracking-[0.16em] mt-[1.5mm] whitespace-nowrap">TEXTIL S.A. DE C.V.</div>
        </div>

        <div className="border-l border-gray-400 flex flex-col items-center justify-center pl-[3mm] relative min-w-0">
          <div className="bg-white border border-black rounded-[2mm] p-[1mm] flex-none">
            <QRCodeSVG 
              value={qrPayload} 
              size={256}
              width="27mm"
              height="27mm"
              className="block shrink-0"
              style={{ width: "27mm", height: "27mm", minWidth: "27mm", minHeight: "27mm", flexShrink: 0 }}
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