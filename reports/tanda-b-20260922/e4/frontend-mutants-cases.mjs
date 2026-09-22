const item = "src/components/salidas-dinero-e4-item.tsx";
const panel = "src/components/salidas-dinero-e4-panel.tsx";
const cobros = "src/pages/cobros.tsx";
const itemTest = "src/components/salidas-dinero-e4-item.dom.test.tsx";
const panelTest = "src/components/salidas-dinero-e4-panel.dom.test.tsx";
const entry = (id, testFile, suite, title, file, before, after) =>
  ({ id, testFile, suite, title, file, before, after, assertion: id });
const i = (id, title, before, after) => entry(id, itemTest, "SalidaDineroE4Item Contract Tests", title, item, before, after);
const p = (id, title, before, after) => entry(id, panelTest, "SalidasDineroE4Panel Contract Tests", title, panel, before, after);
export const cases = [
  i("E4-ADMIN", "ADMIN puede ACEPTAR y RECLAMAR una salida PENDIENTE",
    "const isAdmin = userRole === Role.ADMIN;", "const isAdmin = false;"),
  i("E4-SUPERVISOR", "SUPERVISOR de la misma tienda puede RESPONDER sobre una salida RECLAMADA",
    'isSupervisorOfStore && e4 && e4.estado === "RECLAMADA";', 'false && e4 && e4.estado === "RECLAMADA";'),
  i("E4-OTHER-STORE", "SUPERVISOR de OTRA tienda NO puede RESPONDER",
    "userUbicacionId === tiendaId;", "true;"),
  i("E4-CLAIM-REASON", "RECLAMAR requiere explicación y envía datos correctos",
    'if (dialogState.accion === "RECLAMAR" && !explicacion.trim()) {', "if (false) {"),
  p("E4-CAPTURE-RETRY", "EXTRAORDINARIA envía el payload correcto con cuentaOrigen bloqueada y claveOperacion constante",
    "          claveOperacion: lastIntention.current.uuid,", "          claveOperacion: crypto.randomUUID(),"),
  p("E4-PROVIDER-REQUIRED", "PROVEEDOR requiere proveedor seleccionado y rechaza envío sin él",
    'if (tipo === "PROVEEDOR" && (proveedorId === "none" || !proveedorId)) {', "if (false) {"),
  entry("E4-GATE-OFF", "src/pages/cobros-e4-off.dom.test.tsx", "Cobros OFF State Tests",
    "Con E4_CASH_OUT_ENABLED=false renderiza el formulario original y no llama hooks E4",
    cobros, "if (E4_CASH_OUT_ENABLED) {", "if (true) {"),
  p("E4-CAPTURE-DOUBLE", "E4-CAPTURE-DOUBLE", "if (isSubmitting.current) return;", "if (false) return;"),
  p("E4-CAPTURE-CONTENT", "E4-CAPTURE-CONTENT", "if (lastIntention.current.snapshot !== currentSnapshot) {", 'if (lastIntention.current.snapshot === "") {'),
  p("E4-CAPTURE-PERMISSION", "E4-CAPTURE-PERMISSION", "{canCreate && (", "{true && ("),
  p("E4-PROVIDER-LOCATION", "E4-PROVIDER-LOCATION", "const canCaptureProveedor = isMariana;", "const canCaptureProveedor = true;"),
  i("E4-REVIEW-DOUBLE", "E4-REVIEW-DOUBLE", "if (isSubmitting.current) return;", "if (false) return;"),
  i("E4-REVIEW-RETRY", "E4-REVIEW-RETRY", "          claveOperacion: lastIntention.current.uuid,", "          claveOperacion: crypto.randomUUID(),"),
  i("E4-REVIEW-CONTENT", "E4-REVIEW-CONTENT", "if (lastIntention.current.snapshot !== currentSnapshot) {", 'if (lastIntention.current.snapshot === "") {'),
  i("E4-CAJA-NO-REVIEW", "E4-CAJA-NO-REVIEW", "const isAdmin = userRole === Role.ADMIN;", "const isAdmin = true;"),
  ...[
    ["E4-PARENT-COCO", 'const canViewE4 = hasPermission(currentUser, Modules.COBROS_PAGOS, "ver");', 'const canViewE4 = hasPermission(currentUser, Modules.CORTES, "ver");'],
    ["E4-PARENT-CRUCES", "E4_CASH_OUT_ENABLED ? canViewE4 :", "E4_CASH_OUT_ENABLED ? (canViewE4 && sesionData.sesion.ubicacionId === MARIANA_LOCATION_ID) :"],
    ["E4-PARENT-VIEW", 'const canViewE4 = hasPermission(currentUser, Modules.COBROS_PAGOS, "ver");', "const canViewE4 = true;"],
    ["E4-PARENT-CREATE", 'const canCreateE4 = hasPermission(currentUser, Modules.COBROS_PAGOS, "crear");', "const canCreateE4 = true;"],
    ["E4-PARENT-OFF-COCO", "(canViewCashManagement && sesionData.sesion.ubicacionId === MARIANA_LOCATION_ID)", "(canViewCashManagement)"],
    ["E4-PARENT-OFF-MARIANA", "if (E4_CASH_OUT_ENABLED) {", "if (true) {"],
  ].map(([id, before, after]) => entry(id, "src/pages/cobros-e4-parent.dom.test.tsx", "E4 mounted parent", id, cobros, before, after)),
];