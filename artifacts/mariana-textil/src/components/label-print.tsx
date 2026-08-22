import { QRCodeSVG } from 'qrcode.react';
import { BrandLogo } from './brand-logo';

export interface LabelData {
  sku: string;
  serie: string;
  tela: string;
  color: string;
  cantidad: string;
  unidad: string;
}

export function LabelPrint({ data, className = "" }: { data: LabelData; className?: string }) {
  const qrPayload = `${data.sku}-${data.serie}`;
  const unitLabel = data.unidad === 'KILO' ? 'Kilos del Rollo' : 'Metros del Rollo';

  return (
    <div 
      className={`label-page bg-white text-black p-[6mm] font-sans border border-gray-300 rounded-md print:border-none print:rounded-none relative overflow-hidden flex flex-col ${className}`} 
      style={{ width: '100mm', height: '60mm', boxSizing: 'border-box' }}
    >
      {/* Name on top */}
      <div className="font-bold text-[16px] uppercase truncate w-full mb-1 flex-shrink-0 text-center leading-tight">
        {data.tela} - {data.color}
      </div>
      
      <div className="border-b-2 border-black w-full mb-2 flex-shrink-0"></div>

      <div className="flex flex-1 min-h-0">
        {/* Left stack */}
        <div className="flex-1 flex flex-col justify-between pr-2">
          <div>
            <div className="text-[10px] font-bold text-gray-500 uppercase leading-none">SKU</div>
            <div className="text-[13px] font-bold truncate leading-none mt-1">{data.sku}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-gray-500 uppercase leading-none mt-2">No. de Serie</div>
            <div className="text-[18px] font-black truncate leading-none mt-1 tracking-tight">{data.serie}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-gray-500 uppercase leading-none mt-2">{unitLabel}</div>
            <div className="text-[26px] font-black tracking-tighter leading-none mt-1">{parseFloat(data.cantidad).toFixed(2)}</div>
          </div>
        </div>

        {/* Dotted divider */}
        <div className="border-l-[3px] border-dotted border-gray-400 mx-1"></div>

        {/* Right QR */}
        <div className="flex flex-col items-center justify-between pl-2 w-[110px] shrink-0 relative">
          <div className="absolute top-[-4px] right-0">
             <BrandLogo variant="mark" className="w-6 h-6 grayscale opacity-90" />
          </div>
          <div className="mt-4 bg-white p-0.5 border border-gray-200 rounded-md">
            <QRCodeSVG 
              value={qrPayload} 
              size={100} 
              level="Q" 
              includeMargin={true} 
              fgColor="#000000"
              bgColor="#ffffff"
            />
          </div>
          <div className="text-[9px] font-mono text-center font-bold mt-1 break-all leading-tight max-w-full text-black">
            {qrPayload}
          </div>
        </div>
      </div>
    </div>
  );
}