// One semantic productive-source mutation per grouped mounted obligation.
// Prepared only: no GREEN/RED/restored evidence is claimed.
export const coverageStatus = "PREPARED_23_GROUPED_NATIVE_OBLIGATIONS_NOT_EXECUTED";
export const knownGreenBlockers = [];
export const limits = [
  "No authenticated acceptance, API/DB calls or live financial effects.",
  "Operational CuentaDestinoDetalle stays legacy with an explicit non-addition notice; no substituted E7 detail coverage.",
  "Client integration is Grupo 1 preview/actions only; no Grupo 4 rewrite.",
  "Real backend-serialized PDF/XLSX success, late identity revocation and pending-response scope changes are prepared, not executed. Binary fixture construction is not authenticated acceptance.",
  "A/F and SISTEMAS reader vetoes are reached through actual parents under real providers after authorized real-App positive controls; route guards are not replaced.",
  "Client-swap pending-request races and full cache inventory need additional owner-reviewed obligations; no claim of exhaustive authorization lifecycle coverage.",
];
export const hookCoverage = {
  useGetE7Disponibilidad: ["E7-OFF", "E7-AVAILABILITY"],
  useGetE7Atribucion: ["E7-RECEIPT-APPLICATION", "E7-SITES-NOT-RECEIPTS", "E7-SCOPE-QUERY"],
  useGetE7ClienteExportacion: ["E7-GROUP1-FOUR", "E7-GROUP1-LINKS", "E7-FOREIGN-PREVIEW"],
  useExportE7AtribucionPdf: { actualUiFunction: "exportE7AtribucionPdf", cases: ["E7-DOWNLOAD-CONTEXT", "E7-DOWNLOAD-IDENTITY", "E7-DOWNLOAD-REAL-BINARIES", "E7-DOWNLOAD-LATE-REVOCATION", "E7-DOWNLOAD-LATE-SCOPE"], hookMounted: false },
  useExportE7AtribucionXlsx: { actualUiFunction: "exportE7AtribucionXlsx", cases: ["E7-DOWNLOAD-CONTEXT", "E7-DOWNLOAD-REAL-BINARIES", "E7-DOWNLOAD-LATE-REVOCATION", "E7-DOWNLOAD-LATE-SCOPE"], hookMounted: false },
};
const reader = "src/components/e7-readers.tsx";
const one = (id, file, before, after) => ({ id, assertion: id, file, before, after });
export const cases = [
  one("E7-PARENT-CUENTAS", "src/pages/caja/cuentas-destino.tsx", '{!e7On() && <section className="space-y-6">', '{true && <section className="space-y-6">'),
  one("E7-OFF", reader, 'export function E7Attribution({ desde, hasta, surface }: { desde: string; hasta: string; surface: "cuentas" | "tiempo-real" }) {\n  if (!e7On()) return null;', 'export function E7Attribution({ desde, hasta, surface }: { desde: string; hasta: string; surface: "cuentas" | "tiempo-real" }) {\n  if (false) return null;'),
  one("E7-RECEIPT-APPLICATION", reader, 'money(d.cobranzaTotal)', 'money(String(Number(d.cobranzaTotal) + Number(d.aplicacionesNotas)))'),
  one("E7-SITES-NOT-RECEIPTS", reader, 'd.alcance.tipo === "GLOBAL" ? <>', 'true ? <>'),
  one("E7-RETAINED-STOCK", reader, '{r.antiguedadDias} días', '{0} días'),
  one("E7-PHYSICAL-HISTORY", reader, 'money(d.recepcionesFisicas)', 'money(d.cobranzaTotal)'),
  one("E7-QUERY-ERROR", reader, 'if (q.error) return <section data-testid="e7-attribution">', 'if (q.error && !q.data) return <section data-testid="e7-attribution">'),
  one("E7-PARENT-TIEMPO", "src/pages/caja/tiempo-real.tsx", '!e7On() && !cuentasLoading && !cuentasError && cobranzaStat', '!cuentasLoading && !cuentasError && cobranzaStat'),
  one("E7-GROUP1-FOUR", reader, 'money(d.resumenGlobal.deudaActual)', 'money(d.totalRetenido)'),
  one("E7-GROUP1-LINKS", reader, 'const suffix = siteId ? `?ubicacionId=${siteId}` : "";', 'const suffix = "";'),
  one("E7-FOREIGN-PREVIEW", reader, 'if (d.clienteId !== clienteId) return', 'if (false) return'),
  one("E7-DOWNLOAD-CONTEXT", reader, 'kind === "pdf" ? exportE7AtribucionPdf(params) : exportE7AtribucionXlsx(params)', 'kind === "pdf" ? exportE7AtribucionXlsx(params) : exportE7AtribucionPdf(params)'),
  one("E7-DOWNLOAD-IDENTITY", reader, 'if (JSON.stringify(await getCurrentUser()) !== identity || !alive.current) throw new Error("Identidad modificada.', 'if (!alive.current) throw new Error("Identidad modificada.'),
  one("E7-OPERATIONAL-BOUNDARY", "src/pages/caja/cuenta-destino-detalle.tsx", 'No sumar este subtotal a la cobranza E7.', 'Sumar este subtotal a la cobranza E7.'),
  one("E7-RANGE", reader, '(end - start) / 86400000 + 1 > 366)', '(end - start) / 86400000 + 1 > 3660)'),
  one("E7-SCOPE-QUERY", reader, '...(selectedLocationId ? { ubicacionId: String(selectedLocationId) } : {})', '...({})'),
  one("E7-AVAILABILITY", reader, 'if (!q.data.enabled) return', 'if (false) return'),
  one("E7-COUNTER-BOUNDARY", reader, 'user.data.rol !== "CONTADOR" && (surface === "exportacion"', 'true && (surface === "exportacion"'),
  one("E7-SISTEMAS-TIEMPO", reader, ': surface === "tiempo-real" ? user.data.rol === "ADMIN" :', ': surface === "tiempo-real" ? ["ADMIN", "SISTEMAS"].includes(user.data.rol) :'),
  one("E7-LEGENDS", reader, '<p key={t}>{t}</p>', '<p key={t}>{t.replace("todos los sitios", "el sitio actual")}</p>'),
  one("E7-DOWNLOAD-REAL-BINARIES", reader, 'const url = URL.createObjectURL(blob), link = document.createElement("a");', 'const url = URL.createObjectURL(new Blob([String(blob)])), link = document.createElement("a");'),
  one("E7-DOWNLOAD-LATE-REVOCATION", reader, 'if (JSON.stringify(await getCurrentUser()) !== identity || !alive.current) throw new Error("Identidad revocada; archivo descartado.");', 'if (!alive.current) throw new Error("Identidad revocada; archivo descartado.");'),
  one("E7-DOWNLOAD-LATE-SCOPE", reader, 'if (JSON.stringify(await getCurrentUser()) !== identity || !alive.current) throw new Error("Identidad revocada; archivo descartado.");', 'if (JSON.stringify(await getCurrentUser()) !== identity) throw new Error("Identidad revocada; archivo descartado.");'),
];