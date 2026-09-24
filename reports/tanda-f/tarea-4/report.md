# Tanda F — Task 4: natural permissions versus API

## Final bounded follow-up — authoritative combined result

The final completeness tranche expanded the actionable cases rather than leaving all 524 earlier gaps unexplained. It added **102 final authenticated requests (96 mutation-method requests)**, all **403**, with unchanged immediate/aggregate 106-table fingerprints. The retained 91-request intermediate expansion is separate duplicate evidence, not added to final coverage.

Across the original finalized run and the new finalized expansion: **483 requests, 136 mutation-method attempts, all 403**, covering **289 of 722 denied cells** (**91 newly covered cells**). Of these 289 cells, **64 are CONTADOR E11 legacy-boundary observations**, not inner permission proofs. No business-table row change was observed. The status is still **PARTIAL**, not full matrix PASS.

All **433 residual cells now have a per-cell reason** in `followup/combined-cell-classification.json`; none remains an unexplained “time gap”:

| Classification | Cells | Meaning |
|---|---:|---|
| NO_OPERATION_FOUND_STATIC | 357 | Configured false action flag has no consuming operation discovered in frozen-source review; not an API PASS and not proof no dynamic endpoint can exist. |
| BLOCKED_SYNTHETIC_FIXTURE | 65 | Concrete endpoint exists but setup supplies no required pending ticket, container, audit state, reprint watermark, reversible exit, or editable synthetic equipment/driver/vehicle. Exact prerequisite is listed per cell. No unrelated positive setup mutations or restored-data mutation targets were introduced. |
| BLOCKED_LEGACY_CAPTURE_GATE | 6 | `clientes_finanzas.crear` legacy capture routes are intercepted by the released E3 migration guard. E3's real `caja_abonos.crear` and `clientes_recapturas.crear` were tested separately, not miscounted as the legacy permission. |
| UNTESTED_SCOPE_RESTRICTION | 5 | `permisos.editar` endpoints exist, but configuration mutation attempts were withheld under the no-matrix-changes instruction. They are expressly untested, not blocked by missing endpoints. |

The `NO_OPERATION_FOUND_STATIC` reasons explain action aliases precisely—for example, remate only consumes `autorizar`, price changes consume `editar`, cash closure consumes `cortes.crear`, and ticket authorization consumes `cobros_pagos.crear`, not their similarly named `autorizar` cells. These distinctions avoid inventing endpoints solely because the 4-column matrix contains a false flag.

Expanded request groups: product creation/corrected product edit, remate authorization, label reprint, roll floor editing, inventory audit creation, quantity adjustment, reconciliation authorization, supplier/client financial adjustments, user name editing and creation, container creation, vehicle/driver/equipment creation, cash closure, E3 cash context/preview and customer recapture preview.

**Input correction:** the first run's product-edit request used `nombre`, which is not the product update field. Its 403 was permission-first evidence only, not a valid-input probe. The expansion resent `tela` against the actual frozen schema and obtained 403 for every applicable natural denied role. This supersedes the original validity claim for that case. User-creation passwords in the expansion were generated randomly in request memory and never persisted in the report; `probe-cases.json` intentionally omits that secret field.

Run expansion and regenerate classifications:

    TASK4_FOLLOWUP=1 node reports/tanda-f/tarea-4/probe.mjs
    node reports/tanda-f/tarea-4/classify-followup.mjs

`followup/combined-summary.json` contains role-by-role counts. Follow-up matrices, identity, request cases, all statuses and before/after fingerprints are retained independently of the original run. API lifecycle remains owned by MAIN; it may now shut down port43831. This worker never stopped the shared cluster.

---

## Original tranche evidence (historical; expanded above)

## Verdict: bounded denial evidence, NOT complete authorization PASS

All **seven natural roles** were authenticated against the isolated API on **127.0.0.1:43831**, bound to **tanda_f_permissions** on the private cluster at **55440**. No permission rows, role assignments, gates or product code were changed. MAIN launched and owns shutdown of this API. No production/development application endpoint was used.

The final tranche made **381 authenticated requests across 95 distinct method/URL pairs** selected from actual denied permission cells. All returned **403**. This includes **40 mutation requests**, with unchanged per-table row fingerprints immediately before/after every mutation attempt. Aggregate before/after fingerprints of **106 public tables** were also unchanged. Authentication sessions are deliberately excluded: middleware refreshes expiration even for denied requests. Login/audit creation occurred before each tranche's baseline.

This is **198 covered denied role/module/action cells out of 722**, not exhaustive denial coverage. **524 cells remain unprobed.** Multiple URLs can exercise the same cell. A 403 at an outer guard does not prove an inner guard independently.

| Natural role | Denied cells / 140 | Covered cells | Unprobed cells | Final HTTP attempts | Mutation attempts |
|---|---:|---:|---:|---:|---:|
| ADMIN | 0 | 0 | 0 | 0 | 0 |
| TERMINAL | 129 | 35 | 94 | 69 | 7 |
| CAJA | 138 | 45 | 93 | 93 | 9 |
| SUPERVISOR | 111 | 26 | 85 | 47 | 5 |
| BODEGA | 125 | 37 | 88 | 66 | 9 |
| SISTEMAS | 79 | 9 | 70 | 11 | 1 |
| CONTADOR | 140 | 46 | 94 | 95 | 9 |

ADMIN is **not omitted by assumption**: its authenticated `/auth/me` response actually contained 35 modules × four true actions, and the frozen resolver has the corresponding explicit full-access branch. Therefore there were no naturally denied ADMIN cells to challenge without prohibited matrix edits. ADMIN login and `/auth/me` were performed, but no denied mutation is claimed for ADMIN.

CONTADOR had all 140 legacy cells false. E11 is enabled in the frozen source; its closed-world legacy middleware denies before most module handlers. CONTADOR's 95 responses demonstrate that boundary, **not** independent execution of 95 inner guards and **not** coverage of E11's separately authorized projections.

## Exact coverage and configuration

* `effective-matrices.json`: actual authenticated effective configuration, every role and all 35 modules; no defaults inferred.
* `denied-action-coverage.json`: exhaustive list of the 722 false cells, with exact attempts/denials and explicit `GAP_NOT_PROBED` entries.
* `probe-cases.json` and `api-results.json`: concrete method, URL, module/action, request body where applicable, status and mutation-difference result.
* `endpoint-inventory.json`: 307 literal route registrations from the **frozen built source**, including extracted permission guards.
* `guard-citations.json`: source file/line citations for module, role, ADMIN and inline resolution checks, including checks the route extractor cannot associate.

The endpoint inventory is **lexical, not a complete Express graph**. Arrays/aliases, dynamic factories, nested routers, `router.use`, OR guards, role guards, feature boundaries and inline conditional checks need manual interpretation. No claim is made that all guarded endpoints were challenged.

Mutation groups tested with existing synthetic fixture IDs:

* `editar`: products, clients, suppliers, locations, client credit, prices.
* `crear`: clients, suppliers, locations.

Bodies use named schema fields and sensible values, including a national supplier type, uppercase site initials, a positive price with reason, and valid 30-day credit terms. Product 2078, client 8, supplier 226 and site 836 are setup fixtures. These are **schema/source-validated candidates**, not demonstrated successful positive mutation controls: authorization runs before validation, so 403 alone cannot prove every deeper business precondition. No successful control mutations were introduced.

GET coverage includes representative inventory, roll/entry/movement detail, catalogs, finance, POS, labels, cash, transport, permissions/admin and read endpoints guarded by create/authorize permissions when present. Exact role-specific cases are in the result file.

## UI comparison: STATIC ONLY

The actual frozen `hasPermission` function body was evaluated against all **980 role/module/action combinations** from the authenticated responses. It agreed with the effective matrix in all 980 cases. The only transformation was removing TypeScript's function signature; its body was executed unchanged in a VM.

`ui-static-comparison.json` contains every comparison and the source SHA-256; `ui-citations.json` records UI permission call sites. This proves helper predicate agreement, **not browser-rendered button invisibility**, route accessibility, mutation affordance wiring or absence of other UI controls.

Manual inspection of `App.tsx` shows route checks also include `allowedRoles`, `requiredRoles`, `adminOnly`, and `allowedAnyModules`. In particular, `allowedRoles` can satisfy the route condition alongside a denied module, and OR-module routes are not correctly modeled as a single module. Feature-specific pages have additional predicates. Those compound conditions and page-level rendering were **not comprehensively executed**. The headline zero static mismatches must not be read as a complete UI/API parity result.

## Preliminary discoveries, retained rather than hidden

`preliminary/` retains the first 148-request tranche (144 × 403, 2 × 200, 2 × 404). Inspection corrected three test mappings:

1. `GET /tickets` uses `pos.ver OR cobros_pagos.ver`; CAJA's 200 is legitimate through its cash permission, not a POS bypass. The final single-permission POS probe uses `/pos/buscar?q=994000001`.
2. `/caja/tickets` checks `cobros_pagos.ver`, not `resumen_caja.ver`; CAJA's 200 is legitimate. The final summary probe uses `/caja/tiendas/836/ventas`.
3. `/inventario/movimientos` was not the list endpoint; its 404 proves no denial. The final movement list probe uses the actual `/inventario/kardex` route, with synthetic product/site IDs.

These preliminary responses are **not counted as final denial successes or confirmed defects**. No product fixes were made. The final script reflects source-confirmed mappings.

## Isolation and reproducibility

`launch-api.sh` is the MAIN-run API-only launcher. `probe.mjs` checks DB name, server port, data directory, cluster PID command line, API PID environment and local witness URL before login/probes. `identity.json` records only safe identity evidence. The witness was checked as an environment binding; this task made no queries or mutations against that other database.

Run from repository root while MAIN's isolated API is already running:

    node --check reports/tanda-f/tarea-4/probe.mjs
    node reports/tanda-f/tarea-4/probe.mjs

The script reads private credentials in memory and never writes cookie values, passwords, tokens, raw operational rows or successful response bodies. Snapshots persist only table counts and row digests. Credentials and frozen build must remain available privately to rerun. Reruns perform real logins (with normal disposable audit/session writes) before taking baselines.

## Explicit residual gaps

* 524 denied permission cells unprobed, including most authorize operations and complex transactional writes (sales, receipts, transfers, reversals, financial adjustments, audits and permission administration).
* No successful positive controls; no assurance that every candidate body passes downstream business rules.
* No browser interaction or visual verification; actual control hiding/disabling and compound route predicates are not covered.
* No live probes of separate E11 projections, every feature-gated endpoint, role-only guards, aliases, exports, multipart/document workflows or asynchronous external effects.
* Row snapshots do not fingerprint sequence values, filesystem/object storage, external services, or transient writes rolled back before inspection. No business-table mutation was observed, rather than an unlimited “no side effect” claim.
* Database equality was checked within this disposable worker DB only; no comparison against a changing production/source database.

The bounded denial tranche is clean. The **full matrix remains partially verified**, with exact gaps preserved rather than converted to PASS.