// Exclusive disposable-copy browser pass. Never invoke without MAIN's explicit handoff.
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { chromium } from "../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";

const root = process.cwd();
const dir = path.join(root, "reports/continuacion-rollos-20260925/browser");
const priv = path.join(root, "private.local/roll-return-continuation");
const stage = process.argv[2];
const stages = ["fixtures", "sales", "roles", "receive", "reject", "prepareA", "apply", "fiscal"];
if (!stages.includes(stage)) throw Error("Specify stage: " + stages.join(", "));
const clockTime = "2026-11-02T18:00:00.000Z";
const origin = stage === "fiscal" && process.env.FISCAL_CLOCK_READY === "MAIN_STARTED_FORWARD_ONLY"
  ? "http://127.0.0.1:43941" : "http://127.0.0.1:43937";
if (process.env.CONTINUATION_READY !== "YES" || !fs.existsSync(path.join(priv, "credentials.json")))
  throw Error("MAIN handoff required: CONTINUATION_READY=YES and private.local/roll-return-continuation/credentials.json");
const credentials = JSON.parse(fs.readFileSync(path.join(priv, "credentials.json"), "utf8"));
if (!credentials.admin?.username || !credentials.admin?.password) throw Error("Missing canonical ADMIN credentials");
const stateFile = path.join(priv, "browser-continuation-state.json");
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : { completed: [], operations: {} };
if (state.completed.includes(stage)) throw Error(`Stage ${stage} already completed: do not replay`);
if (stages.indexOf(stage) !== state.completed.length) throw Error(`Expected next stage ${stages[state.completed.length]}`);
if (Object.values(state.operations).some(v => v.status === "UNCERTAIN")) throw Error("Uncertain write exists. Read back independently; do not replay.");
const persist = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), { mode: 0o600 });
const result = { stage, status: "RUNNING", steps: [], startedAt: new Date().toISOString() };
const save = () => fs.writeFileSync(path.join(dir, `${stage}-result.json`), JSON.stringify(result, null, 2));
const assert = (ok, message) => { if (!ok) throw Error(message); };
const browser = await chromium.launch({ headless: true, executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
let page;
const contexts = [];
const open = async (role) => {
  const context = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
  contexts.push(context);
  const p = await context.newPage(); page = p;
  if (stage === "fiscal" && origin.endsWith(":43941")) await p.clock.setFixedTime(new Date(clockTime));
  p.setDefaultTimeout(15000);
  await p.route("**/*", route => {
    const request = route.request();
    const u = new URL(request.url());
    if (u.origin !== origin || /\/api\/e5\/cobros\/[^/]+\/devolver(?:\?|$)/.test(u.pathname))
      return route.abort();
    return route.continue();
  });
  await p.goto(origin + "/login");
  const creds = role === "ADMIN" ? credentials.admin : state.roles?.[role];
  assert(creds?.username && creds?.password, `Missing ${role} private credentials`);
  await p.getByLabel("Usuario", { exact: true }).fill(creds.username);
  await p.getByLabel("Contraseña", { exact: true }).fill(creds.password);
  const response = p.waitForResponse(r => r.url().endsWith("/api/auth/login"));
  await p.getByRole("button", { name: "Ingresar", exact: true }).click();
  const r = await response;
  assert(r.status() === 200, `Native ${role} login HTTP ${r.status()}`);
  await p.waitForURL(u => !u.pathname.endsWith("/login"));
  result.steps.push({ action: "native-login", role, status: 200 });
  return p;
};
const snapshot = async (name) => {
  const prefix = path.join(dir, `${stage}-${name}`);
  await page.screenshot({ path: prefix + ".png", fullPage: true });
  fs.writeFileSync(prefix + ".txt", await page.locator("body").innerText());
};
const api = async (p, url) => p.evaluate(async url => {
  const r = await fetch(url, { credentials: "include" });
  const text = await r.text();
  return { status: r.status, body: JSON.parse(text) };
}, url);
const read = async (p, url) => {
  const r = await api(p, url);
  assert(r.status === 200, `Readback ${url} HTTP ${r.status}: ${JSON.stringify(r.body)}`);
  return r.body;
};
// A write is permanently uncertain until BOTH HTTP response AND UI acknowledgment AND fresh readback agree.
// Intent is journalled BEFORE click; a timeout/crash must never trigger an automatic repeat.
const write = async (key, method, endpoint, button, acknowledge, readback) => {
  assert(!state.operations[key], `${key} was already attempted; inspect readback before any new click`);
  state.operations[key] = { status: "UNCERTAIN", method, endpoint, startedAt: new Date().toISOString() }; persist();
  await snapshot(key + "-before");
  const pending = page.waitForResponse(r => r.request().method() === method && new URL(r.url()).pathname === endpoint);
  await button.click();
  const r = await pending;
  const body = await r.json();
  state.operations[key].http = { status: r.status(), body }; persist();
  assert(r.status() >= 200 && r.status() < 300, `${key} HTTP ${r.status()}: ${JSON.stringify(body)}`);
  await acknowledge(body);
  const persisted = await readback(body);
  state.operations[key] = { status: "ACK_READBACK", httpStatus: r.status(), response: body, persisted };
  persist(); result.steps.push({ action: key, httpStatus: r.status(), response: body, readback: persisted });
  await snapshot(key + "-after");
  return body;
};
const money = x => Math.round(Number(x) * 100);
const selectSite = async p => {
  await p.goto(origin + "/cobros");
  await p.getByRole("combobox").first().click();
  await p.getByRole("option", { name: "Mariana", exact: true }).click();
};
const selectGlobalSite = async p => {
  await p.getByRole("combobox").first().waitFor();
  const global = p.getByRole("combobox").filter({ hasText: "Vista Global" });
  result.steps.push({ action: "site-control", count: await global.count(),
    combos: await p.getByRole("combobox").allTextContents() });
  if (await global.count()) {
    await global.last().click();
    await p.getByRole("option", { name: "Mariana", exact: true }).click();
  }
  await p.getByText("Selecciona un sitio para consultar cobros retenidos.").waitFor({ state: "hidden" });
};
const note = (detail, index = 0) => {
  const n = detail.notasIndicadas[index];
  assert(n?.movimientoVentaId && n?.notaId && money(n.saldoPendiente) > 0, "Requires real authorized outstanding note");
  return n;
};
const e5 = async (p) => {
  const d = await read(p, `/api/e5/cobros/${state.cobroId}`);
  assert(d.id === state.cobroId, "E5 detail ID mismatch");
  return d;
};
const action = async (p, kind, amount, key) => {
  await selectSite(p);
  await p.goto(origin + `/cobros/pendientes/${state.cobroId}`);
  await selectGlobalSite(p);
  const before = await e5(p);
  const n = note(before);
  await p.getByRole("heading", { name: "Preparar / resolver" }).waitFor();
  await p.getByLabel("Acción").selectOption(kind);
  if (amount) await p.getByRole("textbox", { name: new RegExp(`Importe nota .* cargo ${n.movimientoVentaId}`) }).fill(amount);
  await p.getByLabel("Motivo / evidencia obligatoria").fill(`ENSAYO continuación ${key} sobre copia descartable`);
  await p.getByRole("button", { name: `Revisar ${kind}`, exact: true }).click();
  await p.getByRole("heading", { name: `Confirmar ${kind}`, exact: true }).waitFor();
  const endpoint = `/api/e5/cobros/${state.cobroId}/${kind === "preparar" ? "propuestas" : kind === "autorizar" ? "autorizar" : "rechazar"}`;
  return write(key, "POST", endpoint, p.getByRole("button", { name: `Confirmar ${kind}`, exact: true }),
    async () => p.getByRole("status").getByText(/Operación confirmada/).waitFor(),
    async () => {
      const after = await e5(p);
      assert(after.revision > before.revision, `${key}: E5 revision unchanged`);
      assert(money(after.importeRecibido) === money(before.importeRecibido), `${key}: unexpectedly received money`);
      if (kind === "autorizar") {
        assert(money(after.importeAplicado) - money(before.importeAplicado) === money(amount), "Partial authorization mismatch");
        assert(after.algunaVezAplicado && money(after.importePendiente) > 0 && !after.capacidades.puedeDevolver, "Residual must be retained and non-refundable");
      } else {
        assert(money(after.importeAplicado) === money(before.importeAplicado) && money(after.importePendiente) === money(before.importePendiente), "Preparation/rejection changed financial balances");
      }
      return { id: after.id, revision: after.revision, estado: after.estado, recibido: after.importeRecibido, aplicado: after.importeAplicado, retenido: after.importePendiente, propuestas: after.propuestas.length, rechazos: after.rechazos.length, refundEnabled: after.capacidades.puedeDevolver };
    });
};

try {
  if (stage === "fixtures") {
    const p = await open("ADMIN");
    const suffix = randomBytes(3).toString("hex").toUpperCase();
    const supplierName = `CONTINUACION ${suffix} PROVEEDOR`;
    const fabric = `CONTINUACION ${suffix} ALGODON`;
    const fixture = { supplierName, fabric };
    await p.goto(origin + "/proveedores");
    await p.getByTestId("button-create-supplier").click();
    await p.getByTestId("input-create-supplier-nombre").fill(supplierName);
    const supplier = await write("supplier", "POST", "/api/proveedores",
      p.getByTestId("button-save-supplier-create"),
      async () => p.getByRole("dialog").waitFor({ state: "hidden" }),
      async body => { assert(body.id, "Supplier missing ID"); return { id: body.id }; });
    fixture.supplierId = supplier.id;
    await p.goto(origin + "/productos");
    await p.getByTestId("button-create-product").click();
    await p.getByTestId("input-product-tela").fill(fabric);
    await p.getByTestId("input-product-color").fill("AZUL");
    await p.getByTestId("input-product-precio").fill("100");
    const product = await write("product", "POST", "/api/productos",
      p.getByTestId("button-save-product"),
      async () => p.getByRole("dialog").waitFor({ state: "hidden" }),
      async body => { assert(body.id, "Product missing ID"); return { id: body.id }; });
    fixture.productId = product.id;
    await p.goto(origin + "/entradas");
    await p.getByTestId("btn-create-entrada").click();
    await p.getByTestId("input-entrada-producto").fill(fabric);
    await p.getByRole("option").filter({ hasText: fabric }).first().click();
    await p.getByTestId("input-declared").fill("5");
    await p.getByTestId("input-costo-unitario").fill("50");
    await p.getByTestId("select-entrada-ubicacion").click();
    await p.getByRole("option", { name: "Mariana", exact: true }).click();
    await p.getByTestId("select-entrada-proveedor").click();
    await p.getByRole("option", { name: supplierName, exact: true }).click();
    await p.getByTestId("btn-add-line").click();
    await p.getByTestId("input-uniform-qty").fill("10");
    await p.getByTestId("button-apply-uniform").click();
    await p.getByTestId("button-confirm-line").click();
    await p.getByTestId("btn-save-entrada").click();
    const entry = await write("five-roll-entry", "POST", "/api/inventario/entradas",
      p.getByTestId("btn-confirm-entrada-review"),
      async () => p.getByText(/entrada.*registrada|entrada.*guardada/i).first().waitFor(),
      async body => {
        assert(body.id && body.rollos?.length === 5 && body.totalRollos === 5, "Entry missing ID or five actual rolls");
        return { id: body.id, rollSeries: body.rollos.map(r => r.serie) };
      });
    fixture.entryId = entry.id;
    fixture.rollSeries = entry.rollos.map(r => r.serie);
    fs.writeFileSync(path.join(priv, "fixture.json"), JSON.stringify(fixture, null, 2), { mode: 0o600 });
    result.steps.push({ action: "fixture-private-manifest", supplierId: supplier.id, productId: product.id, entryId: entry.id });
  }
  if (stage === "sales") {
    const p = await open("ADMIN");
    const fixture = JSON.parse(fs.readFileSync(path.join(priv, "fixture.json"), "utf8"));
    if (!fixture.rollSeries) {
      const entry = JSON.parse(fs.readFileSync(path.join(dir, "fixtures-result.json"), "utf8")).steps.find(s => s.action === "five-roll-entry");
      assert(entry?.response?.id === fixture.entryId && entry?.response?.rollos?.length === 5, "No matching actual entry response to recover roll series");
      fixture.rollSeries = entry.response.rollos.map(r => r.serie);
      fs.writeFileSync(path.join(priv, "fixture.json"), JSON.stringify(fixture, null, 2), { mode: 0o600 });
    }
    // Use the actual generated series observed in the native entry; never presume IDs/series.
    assert(Array.isArray(fixture.rollSeries) && fixture.rollSeries.length >= 2 &&
      fixture.rollSeries.every(s => typeof s === "string"), "Actual new roll series missing");
    if (!state.operations["credit-terms"]) {
      await p.goto(origin + "/clientes/2");
      await p.getByRole("tab", { name: "Crédito", exact: true }).click();
      await p.getByRole("button", { name: "Editar términos", exact: true }).click();
      await p.getByRole("dialog").locator("input").fill("5000");
      await p.getByTestId("select-edit-client-credit-days").click();
      await p.getByRole("option", { name: "7 días", exact: true }).click();
      await write("credit-terms", "PATCH", "/api/clientes/2/credito",
        p.getByRole("button", { name: "Guardar términos", exact: true }),
        async () => p.getByRole("dialog").waitFor({ state: "hidden" }),
        async () => ({ clientId: 2, creditLimit: "5000", days: 7 }));
    }
    if (!state.operations["open-cash"]) {
      await p.goto(origin + "/cobros");
      await p.getByRole("combobox").first().click();
      await p.getByRole("option", { name: "Mariana", exact: true }).click();
      await p.getByRole("heading", { name: "Apertura de Caja", exact: true }).waitFor();
      await p.locator('input[type="number"]').fill("0");
      await write("open-cash", "POST", "/api/sesiones-caja/abrir",
        p.getByRole("button", { name: "Abrir Turno", exact: true }),
        async () => p.getByRole("heading", { name: "Caja Operativa", exact: true }).waitFor(),
        async body => ({ id: body.id, opening: "0" }));
    }
    for (const [index, type] of ["invoice", "note"].entries()) {
      if (state.operations[type + "-sale"]?.status === "ACK_READBACK") continue; // acknowledged writes are NEVER repeated
      await p.goto(origin + "/pos");
      await p.getByRole("combobox").first().click();
      await p.getByRole("option", { name: "Mariana", exact: true }).click();
      await p.getByRole("button", { name: type === "invoice" ? "Ticket (Contado)" : "Notas (Crédito)", exact: true }).click();
      const search = p.getByPlaceholder("Buscar por serie de rollo, SKU o tela...");
      await search.fill(fixture.rollSeries[index]); await search.press("Enter");
      await p.getByRole("button", { name: "Agregar", exact: true }).click();
      await p.getByTestId("pos-cart-line").waitFor();
      await p.getByTestId("button-select-client").click();
      await p.getByTestId(type === "invoice" ? "option-client-1" : "option-client-2").click();
      if (type === "invoice") await p.getByLabel("Requiere Factura", { exact: true }).click();
      const sale = await write(type + "-sale", "POST", "/api/tickets",
        p.getByTestId("button-confirmar-venta"),
        async () => p.getByText(/creado correctamente/).first().waitFor(),
        async body => { assert(body.id, "Sale missing ID"); return { id: body.id }; });
      fixture[type + "SaleId"] = sale.id;
      fixture[type + "Folio"] = sale.folio;
      fs.writeFileSync(path.join(priv, "fixture.json"), JSON.stringify(fixture, null, 2), { mode: 0o600 });
    }
    await p.goto(origin + "/cobros");
    await p.getByRole("combobox").first().click();
    await p.getByRole("option", { name: "Mariana", exact: true }).click();
    if (!state.operations["authorize-note"]) {
    await p.getByRole("button", { name: "Autorizar", exact: true }).first().waitFor();
    const noteCard = p.getByText(`Nota folio ${fixture.noteFolio}`, { exact: true })
      .locator("xpath=ancestor::div[.//button[normalize-space()='Autorizar']][1]");
    assert(await noteCard.count() === 1, "Credit note card ambiguous; cannot authorize another note");
    await noteCard.getByRole("button", { name: "Autorizar", exact: true }).click();
    const site = p.getByRole("combobox", { name: "Sitio operativo de origen" });
    if (await site.count()) { await site.click(); await p.getByRole("option", { name: "Mariana", exact: true }).click(); }
    const authorized = await write("authorize-note", "POST", `/api/tickets/${fixture.noteSaleId}/autorizar`,
      p.getByRole("dialog").getByRole("button", { name: "Autorizar", exact: true }),
      async () => p.getByRole("dialog").waitFor({ state: "hidden" }),
      async body => {
        assert(body.id === fixture.noteSaleId && body.autorizadoPor && money(body.saldoPendiente) > 0, "Note authorization readback mismatch");
        return { id: body.id, clienteId: body.clienteId, authorizedBy: body.autorizadoPor, saldoPendiente: body.saldoPendiente };
      });
    fixture.notaId = authorized.id; fixture.clienteId = authorized.clienteId;
    fixture.clienteNombre = "Jesús"; fixture.ubicacionId = 1;
    fs.writeFileSync(path.join(priv, "fixture.json"), JSON.stringify(fixture, null, 2), { mode: 0o600 });
    }
    await p.goto(origin + "/cobros");
    await p.getByRole("combobox").first().click();
    await p.getByRole("option", { name: "Mariana", exact: true }).click();
    // If the invoice is not the first payable row, stop rather than paying somebody else's ticket.
    if (!state.operations["pay-invoiced-sale"]) {
    await p.getByRole("button", { name: "Cobrar", exact: true }).first().waitFor();
    const payable = p.getByText(`VENTA FACTURADA folio ${fixture.invoiceFolio}`, { exact: true })
      .locator("xpath=ancestor::div[.//button[normalize-space()='Cobrar']][1]");
    assert(await payable.count() === 1, "Invoice payable row ambiguous; do not pay another ticket");
    await payable.getByRole("button", { name: "Cobrar", exact: true }).click();
    await p.getByRole("button", { name: "Transf.", exact: true }).click();
    await p.getByPlaceholder("Número de rastreo o autorización").fill(`ENSAYO-${fixture.invoiceSaleId}`);
    await write("pay-invoiced-sale", "POST", `/api/tickets/${fixture.invoiceSaleId}/cobrar`,
      p.getByRole("button", { name: "Confirmar Pago", exact: true }),
      async () => p.getByText("Ticket cobrado exitosamente", { exact: true }).waitFor(),
      async body => {
        assert(body.id === fixture.invoiceSaleId && body.cobrado, "Paid sale readback mismatch");
        return { id: body.id, cobrado: body.cobrado, facturado: body.facturado, total: body.total };
      });
    }
    result.steps.push({ action: "native-sales-ready", invoiceSaleId: fixture.invoiceSaleId, noteSaleId: fixture.noteSaleId,
      next: "For E11, supply closed periods covering a nonempty invoiced sale (do not backdate or fabricate invoice dates)." });
  }
  if (stage === "roles") {
    const p = await open("ADMIN");
    await p.goto(origin + "/usuarios");
    state.roles = {};
    for (const role of ["F", "A"]) {
      const username = `continue${role.toLowerCase()}${randomBytes(5).toString("hex")}`;
      const password = randomBytes(20).toString("hex");
      state.roles[role] = { username, password }; persist(); // preserve recovery identity before first write
      await p.getByRole("button", { name: "Nuevo Usuario", exact: true }).click();
      await p.locator("#user-name").fill("CONTINUACION CONTADOR " + role);
      await p.locator("#user-username").fill(username);
      await p.getByRole("dialog").getByRole("combobox").first().click();
      await p.getByRole("option", { name: "Contador", exact: true }).click();
      await p.locator("#user-password").fill(password);
      const created = await write("create-" + role, "POST", "/api/users",
        p.getByRole("button", { name: "Crear usuario", exact: true }),
        async () => p.getByRole("dialog").waitFor({ state: "hidden" }),
        async body => {
          assert(body.id > 0, "User create returned no ID");
          await p.getByRole("row").filter({ hasText: username }).waitFor();
          return { id: body.id, rowVisible: true };
        });
      state.roles[role] = { username, password, id: created.id }; persist();
    }
    await p.getByRole("row").filter({ hasText: state.roles.A.username }).getByRole("button", { name: "Perfil contable A/F", exact: true }).click();
    await p.getByRole("dialog").locator("select").selectOption("A");
    await p.getByRole("dialog").locator("textarea").fill("ENSAYO copia desechable: preparar E5, nunca aplicar");
    await p.getByRole("button", { name: "Revisar cambio de perfil", exact: true }).click();
    await write("assign-A", "PUT", `/api/e11/usuarios/${state.roles.A.id}/perfil`,
      p.getByRole("button", { name: "Confirmar asignación ADMIN", exact: true }),
      async () => p.getByText(/Perfil A confirmado/).waitFor(),
      async () => {
        const profile = await read(p, `/api/e11/usuarios/${state.roles.A.id}/perfil`);
        assert(profile.perfil === "A", "A assignment not present on server");
        return { profile: profile.perfil, actorId: state.roles.A.id };
      });
    const f = await open("F"), a = await open("A");
    for (const [role, actor] of [["F", f], ["A", a]]) {
      const identity = await read(actor, "/api/e11/identidad");
      assert(identity.perfil === role, `${role} identity mismatch`);
      result.steps.push({ action: "identity", role, actorId: identity.usuarioId, profileVersion: identity.perfilVersion });
      for (const endpoint of ["/api/fondo", "/api/proveedores/1/pagos", "/api/tickets/1", "/api/clientes/1"]) {
        const denied = await api(actor, endpoint);
        assert(denied.status === 403, `${role} unexpectedly accessed ${endpoint}: HTTP ${denied.status}`);
        result.steps.push({ action: "restricted-legacy", role, endpoint, status: denied.status });
      }
      await actor.goto(origin + "/fondo");
      await actor.getByText(/no puede acceder|no autorizada|sin acceso/i).first().waitFor();
      page = actor; await snapshot(`${role}-fondo-denied`);
    }
  }
  if (stage === "receive") {
    const p = await open("ADMIN");
    const fixture = JSON.parse(fs.readFileSync(path.join(priv, "fixture.json"), "utf8"));
    assert(Number.isInteger(fixture.clienteId) && fixture.clienteId > 0 && fixture.clienteNombre && fixture.notaId, "fixture.json must specify authorized clienteId, clienteNombre, notaId after native sale/authorization");
    await selectSite(p);
    await p.goto(origin + "/cobros/pendientes");
    await selectGlobalSite(p);
    await p.getByRole("button", { name: "Recibir dirigido", exact: true }).click();
    await p.getByLabel("Buscar cliente autorizado").fill(fixture.clienteNombre);
    await p.getByRole("button", { name: "Buscar cliente", exact: true }).click();
    await p.getByLabel("Cliente receptor").selectOption(String(fixture.clienteId));
    const context = await read(p, `/api/e5/contexto?clienteId=${fixture.clienteId}&ubicacionId=${fixture.ubicacionId ?? 1}`);
    const n = context.notas.find(n => n.notaId === fixture.notaId);
    assert(n && money(n.saldoPendiente) > 100, "Fixture note unavailable or too small for partial approval");
    state.fixture = { clienteId: fixture.clienteId, notaId: n.notaId, movimientoVentaId: n.movimientoVentaId, saldo: n.saldoPendiente }; persist();
    await p.getByRole("checkbox", { name: new RegExp(`Nota ${n.folio}`) }).check();
    const amount = Number(n.saldoPendiente).toFixed(2);
    state.receivedAmount = amount; state.partialAmount = (Math.floor(money(amount) / 2) / 100).toFixed(2); persist();
    await p.getByLabel("Importe recibido").fill(amount);
    await p.getByLabel("Medio").selectOption("TRANSFERENCIA");
    await p.getByLabel("Cuenta receptora").selectOption("CUENTA_NO_FISCAL");
    await p.getByLabel("Sesión operativa (sin imputación física)").selectOption({ index: 1 });
    await p.getByLabel("Motivo / evidencia obligatoria").fill("ENSAYO dirigido pendiente sin aplicación, copia desechable");
    await p.getByRole("button", { name: "Revisar recepción", exact: true }).click();
    await p.getByRole("heading", { name: "Confirmar recepción real", exact: true }).waitFor();
    const body = await write("receive", "POST", "/api/e5/cobros",
      p.getByRole("button", { name: "Confirmar dinero recibido", exact: true }),
      async () => p.getByRole("status").getByText(/Operación confirmada/).waitFor(),
      async body => {
        const id = body.id;
        assert(id, "Receipt returned no ID");
        state.cobroId = id; persist();
        const d = await e5(p);
        assert(d.estado === "PENDIENTE" && money(d.importeAplicado) === 0 && money(d.importePendiente) === money(amount) && !d.propuestaVigenteId, "Pending receipt was applied/accepted unexpectedly");
        return { id, estado: d.estado, recibido: d.importeRecibido, retenido: d.importePendiente, aplicado: d.importeAplicado, revision: d.revision };
      });
    assert(body.id === state.cobroId, "Receipt ID mismatch");
  }
  if (stage === "reject") {
    const p = await open("ADMIN");
    await action(p, "preparar", state.receivedAmount, "initial-proposal");
    await action(p, "rechazar", null, "reject-proposal");
    const d = await e5(p);
    assert(d.rechazos.length > 0 && money(d.importePendiente) === money(state.receivedAmount), "Rejected proposal lost retained amount");
    await action(p, "preparar", state.receivedAmount, "reproposal");
  }
  if (stage === "prepareA") {
    const a = await open("A");
    await a.goto(origin + `/contabilidad/preparaciones/${state.cobroId}`);
    const before = await e5(await open("ADMIN"));
    const n = note(before);
    page = a;
    await a.getByRole("heading", { name: /Preparar aplicación/ }).first().waitFor();
    await a.getByRole("textbox", { name: `Importe cargo ${n.movimientoVentaId}` }).fill(state.receivedAmount);
    await a.getByRole("button", { name: "Revisar propuesta sin aplicación", exact: true }).click();
    await write("A-preparation", "POST", `/api/e11/a/preparaciones/${state.cobroId}`,
      a.getByRole("button", { name: "Confirmar preparación A", exact: true }),
      async () => a.getByRole("status").getByText(/preparada/).waitFor(),
      async () => {
        const d = await read(a, `/api/e11/a/preparaciones/${state.cobroId}`);
        assert(d.propuestaId, "A proposal not visible in readback");
        assert(money(d.retenido) === money(before.importePendiente), "A preparation moved retained funds");
        return { propuestaId: d.propuestaId, retenido: d.retenido };
      });
    const forbidden = await api(a, `/api/e5/cobros/${state.cobroId}`);
    assert(forbidden.status === 403, "A accessed ADMIN E5 detail unexpectedly");
    result.steps.push({ action: "A-legacy-E5-denied", status: forbidden.status });
  }
  if (stage === "apply") {
    const p = await open("ADMIN");
    const d = await e5(p);
    assert(money(d.importeAplicado) === 0 && money(d.importePendiente) === money(state.receivedAmount), "A preparation applied money");
    await action(p, "autorizar", state.partialAmount, "admin-partial-approval");
    await selectSite(p);
    await p.goto(origin + `/cobros/pendientes/${state.cobroId}`);
    await selectGlobalSite(p);
    const after = await e5(p);
    assert(after.estado === "PARCIAL" && after.algunaVezAplicado, "Expected partial retained state");
    const refund = await api(p, `/api/e5/cobros/${state.cobroId}/devolucion/opciones`);
    result.steps.push({ action: "forbidden-refund-read", status: refund.status, body: refund.body });
    assert(!after.capacidades.puedeDevolver && (refund.status === 403 || refund.body.elegible === false), "Refund unexpectedly available after application");
    await snapshot("retained-no-refund");
  }
  if (stage === "fiscal") {
    assert(origin.endsWith(":43941"), "Closed-period writes require MAIN-owned isolated forward-clock API 43940 / UI 43941; original API has current open periods");
    const f = await open("F");
    const fixture = JSON.parse(fs.readFileSync(path.join(priv, "fixture.json"), "utf8"));
    const invoiced = await read(f, `/api/e11/fiscal/facturas/${fixture.invoiceSaleId}`);
    assert(invoiced.ventaId === fixture.invoiceSaleId && money(invoiced.totalFacturado) > 0, "Paid invoice not in sanitized fiscal projection");
    const uninvoiced = await api(f, `/api/e11/fiscal/facturas/${fixture.noteSaleId}`);
    assert(uninvoiced.status === 404, "Uninvoiced note leaked to F fiscal invoice reader");
    const a = await open("A");
    // Wait for the SPA's post-login /auth/me and data reads to finish before a
    // separate requireSession call updates the same session's expiry row.
    await a.waitForLoadState("networkidle");
    const aFiscal = await api(a, `/api/e11/fiscal/facturas/${fixture.invoiceSaleId}`);
    result.steps.push({ action: "A-fiscal-boundary", status: aFiscal.status, body: aFiscal.body }); save();
    assert(aFiscal.status === 403, `A fiscal projection expected HTTP 403, received HTTP ${aFiscal.status}: ${JSON.stringify(aFiscal.body)}`);
    result.steps.push({ action: "fiscal-boundary", invoicedId: invoiced.facturaId, uninvoicedStatus: uninvoiced.status, aStatus: aFiscal.status });
    page = f;
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(invoiced.fechaFacturacion));
    const nextDay = new Date(`${day}T12:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const invoiceRange = { inicio: day, finExclusivo: nextDay.toISOString().slice(0, 10) };
    assert(day === "2026-09-25", "Invoice date provenance changed; do not infer closed periods");
    if (!fixture.fiscalPeriods) {
      fixture.fiscalPeriods = [
        { tipo: "DIA", inicio: day, finExclusivo: invoiceRange.finExclusivo, resultado: "ACEPTADA" },
        { tipo: "SEMANA", inicio: "2026-09-21", finExclusivo: "2026-09-28", resultado: "NO_CUADRA" },
        { tipo: "SEMANA", inicio: "2026-09-21", finExclusivo: "2026-09-28", resultado: "ACEPTADA" },
        { tipo: "MES", inicio: "2026-09-01", finExclusivo: "2026-10-01", resultado: "ACEPTADA" },
      ];
      fs.writeFileSync(path.join(priv, "fixture.json"), JSON.stringify(fixture, null, 2), { mode: 0o600 });
    }
    await f.goto(origin + "/contabilidad/fiscal");
    await snapshot("fiscal-before");
    await f.getByLabel("Desde (día CDMX)", { exact: true }).fill(invoiceRange.inicio);
    await f.getByLabel("Hasta, exclusivo (día CDMX)", { exact: true }).fill(invoiceRange.finExclusivo);
    await f.getByRole("button", { name: "Consultar intervalo", exact: true }).click();
    await f.getByRole("link", { name: new RegExp(`Documento interno ${fixture.invoiceFolio}`) }).waitFor();
    assert(await f.getByRole("link", { name: new RegExp(`Documento interno ${fixture.noteFolio}`) }).count() === 0, "Uninvoiced note leaked to F browser list");
    await snapshot("fiscal-invoiced-list");
    await f.getByRole("link", { name: new RegExp(`Documento interno ${fixture.invoiceFolio}`) }).click();
    await f.getByRole("heading", { name: /Documento interno facturado/ }).waitFor();
    await snapshot("fiscal-invoiced-detail");
    const currentDaySource = await read(f, `/api/e11/fiscal/ventas?desde=${invoiceRange.inicio}&hastaExclusivo=${invoiceRange.finExclusivo}&limit=20`);
    assert(currentDaySource.items.some(x => x.ventaId === fixture.invoiceSaleId) && money(currentDaySource.totalFacturado) > 0, "New paid invoice absent from current-day fiscal source");
    result.steps.push({ action: "current-day-nonempty-invoice-only", ...invoiceRange, total: currentDaySource.totalFacturado, items: currentDaySource.items.map(x => x.facturaId) });
    assert(Array.isArray(fixture.fiscalPeriods) && fixture.fiscalPeriods.length === 4, "Four closed nonempty fiscal cases required.");
    assert(["DIA:ACEPTADA", "SEMANA:ACEPTADA", "MES:ACEPTADA", "DIA:NO_CUADRA"].every(spec =>
      fixture.fiscalPeriods.filter(p => `${p.tipo}:${p.resultado}` === spec).length === 1), "Fiscal cases must be accepted day/week/month plus NO_CUADRA day");
    assert(fixture.fiscalPeriods.every(p => [
      "DIA:2026-09-25:2026-09-26",
      "SEMANA:2026-09-21:2026-09-28",
      "MES:2026-09-01:2026-10-01",
    ].includes(`${p.tipo}:${p.inicio}:${p.finExclusivo}`)), "Only closed nonempty September periods around the actual invoice may be used");
    for (const period of fixture.fiscalPeriods) {
      assert(["DIA", "SEMANA", "MES"].includes(period.tipo) && /^\d{4}-\d\d-\d\d$/.test(period.inicio) && ["ACEPTADA", "NO_CUADRA"].includes(period.resultado), "Invalid fiscal period");
      const key = `${period.tipo}-${period.inicio}-${period.resultado}`;
      const source = await read(f, `/api/e11/fiscal/ventas?desde=${period.inicio}&hastaExclusivo=${period.finExclusivo}&limit=20`);
      assert(source.items.length && money(source.totalFacturado) > 0, `${key}: refuses empty fiscal source`);
      result.steps.push({ action: "invoice-only-source", key, count: source.items.length, total: source.totalFacturado, items: source.items.map(i => i.facturaId) });
      await f.goto(origin + "/contabilidad/conciliaciones");
      await f.getByLabel("Desde (día CDMX)", { exact: true }).fill(period.inicio);
      await f.getByLabel("Hasta, exclusivo (día CDMX)", { exact: true }).fill(period.finExclusivo);
      await f.getByRole("button", { name: "Consultar intervalo", exact: true }).click();
      const article = f.locator("article").filter({ has: f.getByRole("heading", { name: new RegExp(`^${period.tipo} · ${period.inicio}`) }) });
      for (let pageIndex = 0; pageIndex < 6; pageIndex++) {
        if (await article.count()) break;
        const next = f.getByRole("button", { name: "Siguiente", exact: true }).first();
        assert(await next.isEnabled(), `${key}: target period not present on any fetched page`);
        await next.click();
        await f.waitForTimeout(150);
      }
      assert(await article.count() === 1, `${key}: target period absent or ambiguous`);
      await article.getByRole("button", { name: /Revisar y congelar periodo|Revisar nueva versión vinculada/ }).click();
      await f.getByRole("button", { name: "Revisar snapshot", exact: true }).click();
      const snap = await write(key + "-snapshot", "POST", "/api/e11/conciliaciones",
        f.getByRole("button", { name: "Confirmar snapshot inmutable", exact: true }),
        async () => f.getByRole("status").getByText(/Snapshot confirmado/).waitFor(),
        async body => {
          const d = await read(f, `/api/e11/conciliaciones/${body.id}`);
          assert(d.totalFacturado === source.totalFacturado && d.periodo.tipo === period.tipo && d.periodo.inicio === period.inicio, "Snapshot mismatch");
          return { id: d.id, totalFacturado: d.totalFacturado, revision: d.revision };
        });
      await f.getByRole("link", { name: "Abrir cifra congelada y conciliar" }).click();
      await f.locator("select").selectOption(period.resultado);
      await f.getByLabel("Total del registro externo", { exact: true }).fill(snap.totalFacturado);
      await f.getByLabel("Referencia externa obligatoria (texto)", { exact: true }).fill(`ENSAYO-${key}`);
      if (period.resultado === "NO_CUADRA") await f.locator("textarea").fill("Diferencia documental de composición, aunque coincida el total; aviso ADMIN.");
      await f.getByRole("button", { name: "Revisar decisión documental", exact: true }).click();
      await write(key + "-decision", "POST", `/api/e11/conciliaciones/${snap.id}/decisiones`,
        f.getByRole("button", { name: "Confirmar decisión", exact: true }),
        async () => f.getByText("Decisión documental registrada en la evidencia. Consulta la revisión actualizada.", { exact: true }).waitFor(),
        async () => {
          const d = await read(f, `/api/e11/conciliaciones/${snap.id}`);
          assert(d.decisiones.some(x => x.resultado === period.resultado), "Decision not persisted");
          const decision = d.decisiones.find(x => x.resultado === period.resultado);
          assert(period.resultado !== "NO_CUADRA" || decision.avisoAdminId, "NO_CUADRA lacked ADMIN notice ID");
          return { id: d.id, resultado: decision.resultado, avisoAdminId: decision.avisoAdminId ?? null, totalFacturado: d.totalFacturado };
        });
      if (period.resultado === "NO_CUADRA") {
        const admin = await open("ADMIN"); page = admin;
        await admin.goto(origin + "/notificaciones");
        await admin.getByRole("link", { name: /Revisar snapshot NO CUADRA/ }).waitFor();
        await snapshot(key + "-admin-notice");
        page = f;
      }
    }
  }
  state.completed.push(stage); persist();
  result.status = "PASS"; result.completedAt = new Date().toISOString();
} catch (error) {
  result.status = "BLOCKED_OR_UNCERTAIN";
  result.error = String(error?.message ?? error);
  if (page) await snapshot("blocked").catch(() => {});
  process.exitCode = 1;
} finally {
  save();
  for (const context of contexts) await context.close();
  await browser.close();
}
console.log(JSON.stringify({ stage, status: result.status, error: result.error, steps: result.steps.length }));