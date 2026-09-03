import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { DocumentQrCode } from "@/components/document-qr-code";
import { MonochromeBrandLogo } from "@/components/monochrome-brand-logo";

export function PrintableDocumentHeader({
  children,
  qrUrl,
  qrLabel,
  qrSize,
  qrRenderAsCanvas,
  className = "",
  logoClassName = "h-28 w-28",
  logoSize,
  logoVariant = "color",
  qrContainerClassName = "min-h-28",
  qrWrapperClassName = "",
}: {
  children: ReactNode;
  qrUrl?: string;
  qrLabel?: string;
  qrSize?: number;
  qrRenderAsCanvas?: boolean;
  className?: string;
  logoClassName?: string;
  logoSize?: number;
  logoVariant?: "color" | "monochrome";
  qrContainerClassName?: string;
  qrWrapperClassName?: string;
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
        {logoVariant === "monochrome" ? (
          <MonochromeBrandLogo className="h-full w-full" />
        ) : (
          <BrandLogo variant="mark" className="h-full w-full" />
        )}
      </div>
      <div className={`flex justify-end ${qrContainerClassName}`}>
        {qrUrl && (
          <div className={qrWrapperClassName}>
            <DocumentQrCode
              url={qrUrl}
              label={qrLabel}
              size={qrSize}
              renderAsCanvas={qrRenderAsCanvas}
            />
          </div>
        )}
      </div>
    </header>
  );
}