# MAIN-only launch and testing-agent handoff

**Prepared, not executed.** No app DB access, startup, login, browser, fixture insert or test was performed by the preparation worker. All synthetic accounts/data below belong only to a fresh native disposable PostgreSQL cluster. Do not use the app preview or inherited DATABASE_URL. Do not start/restart workflows.

## 1. MAIN after candidate readiness

Supply candidate paths explicitly; there are no active-build defaults:

```sh
node reports/receipt-terminal-runtime-20261001/prepare-readiness.mjs \
  "$CANDIDATE_API_FILE" "$CANDIDATE_UI_DIRECTORY" \
  reports/receipt-terminal-runtime-20261001/candidate-ready.json

node reports/receipt-terminal-runtime-20261001/run-main.mjs --main-authorized \
  --api "$CANDIDATE_API_FILE" --ui "$CANDIDATE_UI_DIRECTORY" \
  --playwright "$PLAYWRIGHT_INDEX_MJS" \
  --candidate-ready reports/receipt-terminal-runtime-20261001/candidate-ready.json
```

Run the second command in MAIN's persistent process mechanism. Do not kill it at a tool timeout. The process intentionally stays alive, including after failures. It does not run the receipt matrix automatically.

Locate the owned run through `latest-run.txt`. Wait for `result.json.status === "READY_FOR_TESTING_AGENT"`, not merely healthz or process existence. The directory is mode 0700. `credentials.json` is 0600 and contains only ephemeral isolated origin, usernames/password, and Playwright module path. Never print its contents, copy to public artifacts, or log the password. Runner `ownerPid`, isolated API PID, heartbeat, target identity hash, and in-process API identity proof are in the run. HTTPS retains Secure cookies unchanged. Origin is a loopback high port, NOT the app's port 80.

Startup replays canonical push/seed/initializers and the established native financial migration chain, including already-committed construction-gate retirements. It never disables native integrity triggers. Source provenance hashes are recorded. The API imports the supplied frozen candidate only after verifying its database name/data directory/socket-only identity. UI bytes are checked against the readiness manifest on every serve. Native note/E1 provenance is seeded in the disposable; both sites' initial E3 and E5 receipts are then produced through the actual candidate HTTP API, not INSERTed.

If setup fails: preserve the run and investigate only its owned resources. `retry-fixtures` can resume API receipt setup after bootstrap; it is NOT a general rebootstrap. Do not rerun financial migrations over a partly installed database. Earlier failures require explicit cleanup and a new MAIN launch.

## 2. Browser reception FIRST (testing agent)

Import `login`, `control`, `receiptPaths`, `auditedPdf`, `denyReceipt`, and `assertAuditDelta` from `browser-tools.mjs`. Import Chromium from the protected credentials' Playwright path. Launch a separate testing browser with `ignoreHTTPSErrors:true`; use the supplied `login()` for **actual login-page authentication** (not fabricated cookies/tokens). It refreshes auth/me, copies exact real auth headers to its API helper, and preserves response/error evidence.

Read `fixture.json` for site/session/source IDs. There are five independent 10.00 native-note client sources per site. `api-*` already have receipts; never collect those again. Browser sources are intentionally unreceived. Make the following actual browser submissions, saving screenshots before review and after confirmation and the exact successful network response. Do not replace these submissions with `context.request`/fetch or API setup receipts:

* Login as `CAJA receive` on own site. On `/cobros`, enter **Cartera / Estado de cuenta** if needed to expose the actual Caja tools.
* E3 `browser-e3`: **Registrar Abono** (`button-caja-registrar-abono`); client selector combobox → `input-cliente-context-search` → `option-cliente-ID`. Fill `cliente-payment-amount` = `10`, choose payment via `e3-payment-method` = Transferencia and `e3-payment-account` = Cuenta fiscal if desired; ordinary efectivo is also valid against the open site session. Click `e3-preview`, verify ordinary FIFO preview, then `e3-confirm`. Capture POST `/api/caja/abonos-e3` 201 with `body.recibo`. The Radix dialog hides background accessible elements: use the visible dialog, then close it before inspecting background headings.
* E5 `browser-e5-directed`: **Recibir dirigido**, search **Buscar cliente autorizado**, click **Buscar cliente**, choose **Cliente receptor**, check the source note. Set Medio TRANSFERENCIA, Cuenta receptora CUENTA_FISCAL, and the own site's open **Sesión operativa (sin imputación física)**. Enter **Motivo / evidencia obligatoria**. CAJA must see an exact 10.00 amount, NOT ADMIN's editable amount/application switch. **Revisar recepción** then **Confirmar dinero recibido**. Capture POST `/api/e5/cobros` 201, `id`, `reciboId`, and full state.
* E5 `browser-e5-retained`: independently repeat the same native directed receipt through the UI for this client's note, using EFECTIVO/own physical session to cover retained money. Assert received 10.00, applied 0.00, pending 10.00, `PENDIENTE`. "Directed" and "retained" are **not mutually exclusive states**: a CAJA-directed receipt is retained pending ADMIN application. Do not invent a second product mode or apply money to make the names distinct.
* Own-site CAJA positive is required; repeat E3 and E5 receipt creation with the other site's CAJA if both-sites browser evidence is desired. At minimum the other site already has genuine API-produced E3/E5 exclusion fixtures.
* On each E5 response assert `capacidades.puedeAutorizar === false`. Verify ADMIN application controls absent. Attempt actual POST `/api/e5/cobros/ID/autorizar` with a valid-shaped payload only after checking candidate schema; expect 403, not 400. To prove the same boundary without proposal dependencies, POST `/api/e5/cobros` with a valid context/key/evidence and `aplicarAhora` allocation as CAJA, expect 403, and verify no new receipt/money. Do NOT perform a successful ADMIN application.

Persist `browser-receipts.json` in the run with each receipt descriptor (`family`, `site`, `client`, `folio` for E3 or `id`/`documentId` for E5), original response, submitting actor ID, source, and screenshot paths. A descriptor alone is not proof of a browser submission: retain network evidence and screenshots. On timeout inspect recorded operation key/native audit before retrying; never blindly receive the same money twice.

## 3. Financial baseline, permissions, scope, actual PDFs

Only AFTER all fixture/browser receipts and the CAJA authorization negatives, request:

```js
await control(run, "snapshot");
```

This records SQL-native full financial rows, sorted text, counts, hashes, amounts/statuses, allocations and immutable documents (`financial-before.json`), plus print audit/receipt IDs (`audit-before.json`). Auth sessions, view tokens, and intended print audit appends are excluded. All native E5/Fondo/E11 and credit/cash/ticket tables are included. No deletion/reset/financial writes are allowed during the print matrix.

Use **distinct freshly logged-in browser contexts**, not the CAJA reception context:

1. **TERMINAL default** (no user receipt override): assert auth/me effective `recibos_abonos.puedeVer=true`. Navigate to proposed `/recibos-abonos` (confirm worker's final route; current component is ReceiptDiscovery). Search actual own client/folio, click actual discovered link, not just direct goto. Own E3 and each own E5 directed/retained receipt must be discoverable.
2. **ADMIN default**: no receipt override; prove actual E3 and E5 detail and printing. ADMIN may intentionally have wider scope; do not apply other-store denial assertions to ADMIN.
3. **CAJA custom-granted**: verify seeded CAJA default receipt permission is false, user override is true, and auth/me says true. Discover own receipts, get and print E3 and E5. This proves no hardcoded ADMIN/TERMINAL whitelist. Paired **CAJA custom-denied** holds operational permissions constant and must fail receipt list/get/print.
4. For TERMINAL default, on each own receipt click **Solicitar impresión / reimpresión** twice. Both invocations must create independent audit events, neither new money nor new receipt. Use a unique file name and expected exact folio/customer text:

```js
const paths = receiptPaths(receipt);
await auditedPdf({
  page: session.page, out: run, name: "terminal-e5-retained-reprint-2",
  expectedText: [actualFolio, actualClientName],
  auditPath: paths.print
});
```

The helper intercepts only native `window.print` with a CDP debugger pause, after the real button's successful audit HTTP response. This lets `Page.printToPDF` run before the handler's `finally` removes temporary `e5-print`. No CSS/classes are injected, no API is mocked, no page ranges hide overflow. It saves all PDF pages, asserts `pdftotext` has actual folio/name and nonblank text **on every page**, saves pdfinfo, and rasterizes every page to PNG. Visually inspect each raster (not merely DOM or byte length) and the captured real-print-state screenshot. E3's natural two A5 copies and E5's natural page count should be documented. Do not claim a physical printer test.

5. TERMINAL own-site list `/api/caja/recibos-e3` and `/api/e5/recibos` must contain own IDs and omit ALL other-store IDs/customer metadata, including when searching another site's exact client/folio. The UI list must also omit those links/names. For every other-site E3/E5 receipt use `denyReceipt()` to attempt **GET and POST print** (403 or 404 only), then direct UI URL and screenshot. Assert no leaked amounts, customer, location or snapshot. Compare denial bodies excluding only requestId when needed; preserve raw request IDs separately.
6. Toggle the SAME TERMINAL actor with `await control(run,"terminal-permission",{allowed:false})`. Close its old context; fresh login must show effective false. Require both receipt list endpoints 403; own GET/print 403 or 404; discovery denied/absent; direct receipt routes no print control or metadata. Use `denyReceipt()` for E3 and both E5 receipts. Repeat with paired custom-denied actor.
7. `await control(run,"terminal-permission",{allowed:true})`, close context, fresh login: recheck discovery/get and one audited print for E3/E5. This is positive → negative → fresh-positive proof, not merely session-cached state. Do not call destructive reset.

For each positive audited print append to an expectation array `{actorId, family, document}` where `document=E3 folio` or `E5 documentId`. Count every repeated button press. Save matrix evidence including effective permission cells, raw status/bodies, context actor/site, UI screenshots and PDFs. HTTP-only negatives alone do not establish UI visibility.

## 4. Compare, terminal evidence and ownership cleanup

```js
await control(run, "compare");
const before = JSON.parse(fs.readFileSync(path.join(run,"audit-before.json")));
const after = JSON.parse(fs.readFileSync(path.join(run,"audit-after.json")));
assertAuditDelta(before, after, expectedPrints);
```

Compare fails if ANY captured financial row/count/hash/amount/status/document changes. Audit comparison requires exactly one append per button per actor/document and no audit append for denied requests; all old audit records must remain unchanged. E5 print-table delta must match E5 audit count. Record actual PASS/FAIL in a testing-agent result, with completed and untested cells separately; `READY_FOR_TESTING_AGENT` is NOT a test PASS.

MAIN decides whether to preserve for targeted retries or clean:

```js
await control(run,"cleanup");
```

Cleanup closes only owned browser/API/HTTPS/pool/native cluster, removes ephemeral credentials/private TLS/bootstrap, scrubs credentials from private API diagnostics and records terminal cleanup proof. Verify `result.json.cleanup.passed`, API exit proof, runner terminal exit, and absent credentials file. No app DB cleanup is ever needed or authorized.