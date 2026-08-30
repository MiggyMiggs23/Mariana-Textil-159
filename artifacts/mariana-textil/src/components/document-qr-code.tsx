import React from "react";
import { QRCodeSVG } from "qrcode.react";

export const DOCUMENT_QR_SIZE = 96;

export function DocumentQrCode({
  url,
  label,
}: {
  url: string;
  label?: string;
}) {
  return (
    <QRCodeSVG
      value={url}
      size={DOCUMENT_QR_SIZE}
      level="M"
      includeMargin
      aria-label={label}
    />
  );
}