import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const spec = read("../../../lib/api-spec/openapi.yaml");
const notifications = read("./routes/notificaciones.ts");
const reports = read("./lib/reportes.ts");
const clientDialog = read("../../mariana-textil/src/components/cliente-pago-dialog.tsx");
const supplierDialog = read("../../mariana-textil/src/components/proveedor-pago-dialog.tsx");
const bell = read("../../mariana-textil/src/components/notifications-bell.tsx");
const clientDetail = read("../../mariana-textil/src/pages/cliente-detail.tsx");
const supplierDetail = read("../../mariana-textil/src/pages/proveedor-detail.tsx");
const reportPage = read("../../mariana-textil/src/pages/reportes.tsx");
const app = read("../../mariana-textil/src/App.tsx");

test("directed payment feed exposes structured admin actions", () => {
  assert.match(spec, /DirectedPaymentNotificationAction:/);
  for (const field of ["requestId", "tipo", "contraparte", "documento", "importe", "motivo", "solicitante"]) {
    assert.match(spec, new RegExp(`${field}:`));
  }
  assert.match(notifications, /action: adminQueue \?/);
  assert.match(bell, /useAprobarSolicitudPagoDirigido/);
  assert.match(bell, /motivoRechazo\.trim\(\)\.length < 10/);
});

test("existing payment dialogs preserve FIFO and offer directed mode", () => {
  for (const dialog of [clientDialog, supplierDialog]) {
    assert.match(dialog, /Normal \(FIFO\)/);
    assert.match(dialog, /Pago dirigido/);
    assert.match(dialog, /useCreateSolicitudPagoDirigido/);
    assert.match(dialog, /motivo\.trim\(\)\.length < 10/);
  }
});

test("entity histories and historical report route are wired", () => {
  assert.match(clientDetail, /DirectedPaymentHistory tipo="CLIENTE"/);
  assert.match(supplierDetail, /DirectedPaymentHistory tipo="PROVEEDOR"/);
  assert.match(reportPage, /id: "pagos-dirigidos"/);
  assert.match(app, /setLocation\("\/reportes\?tab=pagos-dirigidos"\)/);
});

test("report includes only resolved directed requests with date and site scope", () => {
  assert.match(reports, /s\.estado IN \('APROBADA','RECHAZADA'\)/);
  assert.match(reports, /COALESCE\(s\.resuelta_at,s\.created_at\) >= \$1/);
  assert.match(reports, /s\.ubicacion_id=ANY\(\$3::int\[\]\)/);
});