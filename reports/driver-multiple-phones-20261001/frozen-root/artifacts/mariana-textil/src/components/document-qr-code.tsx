import React from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";

export const DOCUMENT_QR_SIZE = 112;

export function DocumentQrCode({
  url,
  label,
  size = DOCUMENT_QR_SIZE,
  renderAsCanvas = false,
}: {
  url: string;
  label?: string;
  size?: number;
  renderAsCanvas?: boolean;
}) {
  const qrProps = {
    value: url,
    size,
    level: "M" as const,
    includeMargin: true,
    boostLevel: false,
    "aria-label": label,
  };
  return renderAsCanvas
    ? <QRCodeCanvas {...qrProps} />
    : <QRCodeSVG {...qrProps} shapeRendering="crispEdges" />;
}