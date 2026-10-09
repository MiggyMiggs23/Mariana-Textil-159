import { createHash } from "node:crypto";
import documents from "../../../../reports/e7/frontend-document-bytes.json";
import type { UbicacionInventario } from "@workspace/api-client-react";

// Real PDF/XLSX bytes generated offline by backend e7-export.ts, not magic-byte
// placeholders. Creation evidence/source hashes live in reports/e7/document preflight.
export type DocumentKind = "pdf" | "xlsx";
export type DocumentScope = keyof typeof documents.documents;
export const documentProof = documents;
export const downloadSites: UbicacionInventario[] = [{ id: 2, nombre: "Sitio aplicación sintético", tipo: "TIENDA", activa: true }];
export const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export function serializedBlob(kind: DocumentKind, scope: DocumentScope = "global") {
  const fixture = documents.documents[scope][kind];
  const bytes = Buffer.from(fixture.base64, "base64");
  if (digest(bytes) !== fixture.sha256 || bytes.length !== fixture.bytes) throw Error("E7_BINARY_FIXTURE_HASH_MISMATCH");
  return new Blob([Uint8Array.from(bytes)], { type: fixture.mime });
}
export async function exactSerializedBlob(blob: Blob, kind: DocumentKind, scope: DocumentScope = "global") {
  const fixture = documents.documents[scope][kind];
  return blob.type === fixture.mime && blob.size === fixture.bytes
    && digest(new Uint8Array(await blob.arrayBuffer())) === fixture.sha256;
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
export function captureDownloads() {
  const created: { blob: Blob; url: string }[] = [];
  const revoked: string[] = [];
  const saved: { url: string; name: string }[] = [];
  const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
  const proto = window.HTMLAnchorElement.prototype, click = proto.click;
  // Actual Node object-URL implementation and real Blob are retained. Only the
  // browser's terminal save/navigation boundary is observed, never UI decisions.
  URL.createObjectURL = blob => {
    if (!(blob instanceof Blob)) throw Error("E7_REAL_BLOB_REQUIRED");
    const url = create.call(URL, blob); created.push({ blob, url }); return url;
  };
  URL.revokeObjectURL = url => { revoked.push(url); revoke.call(URL, url); };
  proto.click = function () { saved.push({ url: this.href, name: this.download }); };
  return {
    created, revoked, saved,
    restore() {
      URL.createObjectURL = create; URL.revokeObjectURL = revoke; proto.click = click;
      for (const item of created) if (!revoked.includes(item.url)) revoke.call(URL, item.url);
    },
  };
}