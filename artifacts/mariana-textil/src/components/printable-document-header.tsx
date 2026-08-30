import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { DocumentQrCode } from "@/components/document-qr-code";

export function PrintableDocumentHeader({
  children,
  qrUrl,
  qrLabel,
  qrSize,
  qrRenderAsCanvas,
  className = "",
  logoClassName = "h-28 w-28",
  logoSize,
  qrContainerClassName = "min-h-28",
}: {
  children: ReactNode;
  qrUrl?: string;
  qrLabel?: string;
  qrSize?: number;
  qrRenderAsCanvas?: boolean;
  className?: string;
  logoClassName?: string;
  logoSize?: number;
  qrContainerClassName?: string;
}) {
  return (
    <header
      className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start border-b-2 border-black ${className}`}
    >
      <div className="min-w-0">{children}</div>
      <div
        className={`${logoClassName} justify-self-center`}
        style={logoSize ? { width: logoSize, height: logoSize } : undefined}
      >
        <BrandLogo variant="mark" className="h-full w-full" />
      </div>
      <div className={`flex justify-end ${qrContainerClassName}`}>
        {qrUrl && (
          <DocumentQrCode
            url={qrUrl}
            label={qrLabel}
            size={qrSize}
            renderAsCanvas={qrRenderAsCanvas}
          />
        )}
      </div>
    </header>
  );
}