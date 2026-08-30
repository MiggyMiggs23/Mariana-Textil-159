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
}: {
  children: ReactNode;
  qrUrl?: string;
  qrLabel?: string;
  qrSize?: number;
  qrRenderAsCanvas?: boolean;
  className?: string;
  logoClassName?: string;
}) {
  return (
    <header
      className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start border-b-2 border-black ${className}`}
    >
      <div className="min-w-0">{children}</div>
      <BrandLogo
        variant="mark"
        className={`${logoClassName} justify-self-center`}
      />
      <div className="flex min-h-28 justify-end">
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