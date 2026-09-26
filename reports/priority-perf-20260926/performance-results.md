# Dedicated annual browser performance — terminal result

Timed browser window is RELEASED. No browser measurement processes remain intentionally running. No server restart, DB write, credit implementation or auth/permission shortcut was performed by this worker.

## Candidate and procedure

API: exact combined v6 `f3870a6e76bee58a0237e345dec303e11cf9e42af6acd99fa6314de416fc0e97`; frontend index `09e9fb57f7fc495b98107b86d796e5cbce980aa5755a62a6bb47a87bd98ad9c9`. Dedicated origin localhost:18238 / API18237. Annual fixture supplied by MAIN (54,750 committed documents, 2,575 clients). Private credentials read only from private path, never printed.

Final evidence: `measurements-aligned/{default,nombre,activity,search,credit}-{1,2,3}.json` and corresponding PNGs. Fresh real browser/session per sample; login/site setup excluded, user action to visible table/report plus two animation frames included. No warm-up query, altered sort, prefetched directory, or SQL latency substituted for the actual default navigation. Tests were serial, not parallel.

`browser-measure.mjs` now records action epoch plus Node monotonic timestamps, browser time origin, navigation, long tasks, full finished-request timings, row/DOM counts and response headers. DOM counting happens AFTER the acceptance timer ends. Earlier `measurements/` are exploratory diagnostics, NOT final acceptance evidence: diagnostic DOM snapshots were inside their timer and some collection waits stalled. Final collector bounds `response.finished()` waits outside the acceptance timer. Aborted exploratory attempts are not represented as passing samples.

## Final action-to-visible results (ms)

| Action | Sample 1 | Sample 2 | Sample 3 | <2s result |
|---|---:|---:|---:|---|
| Default Clientes navigation | 2608.436 | 2136.492 | 2141.160 | **FAIL 3/3** |
| Click Nombre header | 1201.032 | 1022.587 | 1259.461 | PASS 3/3 |
| Click Última actividad header | 1338.518 | 1301.282 | 1101.140 | PASS 3/3 |
| Search existing rendered customer | 1079.223 | 1051.167 | 1272.204 | PASS 3/3 |
| Credit report (diagnostic only) | 10912.052 | 13856.470 | 11591.555 | No implementation; >3s |

**Observed actual default request**: `/api/clientes/listado?...&sort=nombre&direction=asc&period=all&page=1&pageSize=50&active=true`. It is NOT lastActivity and NOT legacy `/api/clientes`. Nombre header changes to DESC; Última actividad changes to lastActivity ASC. Report these actual click behaviors, not an inferred sort.

All final samples show no page errors. Directory responses expose `Cache-Control: private, no-store`; no Server-Timing/x-query/x-db budget headers were returned. Consequently these browser artifacts do NOT establish SQL query count/budget. Offline query-scope tests remain separate evidence, not server-header proof.

Reviewed final default-3 screenshot: usable Clientes directory, Nombre A–Z/Activos/Todo el tiempo visible, data rows present and no error banner. UI reports **2,576 matching directory customers**, distinct from the supplied annual cohort of 2,575; do not silently conflate cohort count and full directory count.

## Default failure: concrete critical path, no rendering speculation

| Default sample | Action→directory start | Directory request duration | Response end→locator visible |
|---|---:|---:|---:|
| 1 | 1060.477 | 1032.313 | 495.210 |
| 2 | 784.205 | 936.293 | 405.502 |
| 3 | 783.228 | 961.779 | 383.993 |

Active frozen `src/pages/clientes.tsx:55–62` requests auth/me with `refetchOnMount: always`; `authReady` explicitly requires `!isFetching`. Line 150 disables ClientDirectory until that check finishes. Auth request starts ~267–316ms after action and takes ~474–779ms. This is a real serialized pre-directory authorization-readiness step, not expensive rendering of thousands of customers: directory renders only 50 rows, ~1,193 DOM nodes. Measured main-thread long tasks are absent or around 79ms, not seconds.

Response-end→locator-visible is **detection latency**, not React CPU time. Playwright locator polling/backoff and UI readiness contribute; do not subtract it from the acceptance result or relabel it as confirmed render work. Final timer deliberately preserves the established visible-data acceptance semantics.

The safe backend page-before-hydration optimization is already in this tested candidate. All steady-state list operations pass. The remaining default-navigation failure must not be hidden by using the warmed Nombre-click number, removing auth freshness, serving stale financial data, or starting the stopwatch after auth. A next safe candidate is **speculative request execution while retaining the existing auth-ready display barrier**, with cancellation and auth-partition/permission-change tests; it is NOT implemented here because changing when permission-partitioned data is fetched requires dedicated negative tests and a new frontend build/restart controlled by MAIN. Another target is endpoint/middleware timings to identify the ~1s request cost; missing budget headers prevent attributing that cost to SQL versus auth/network.

## Credit diagnosis now directly evidenced

| Credit sample | Action→report start | Report request duration | Response end→locator visible |
|---|---:|---:|---:|
| 1 | 1301.134 | 2147.496 | 7315.370 |
| 2 | 1484.346 | 1965.239 | 8609.415 |
| 3 | 1248.940 | 1932.612 | 7126.448 |

All report samples render **16,268 table rows** and approximately **238,227 DOM elements**. Recorded contiguous browser long tasks include **6,703ms / 6,944ms / 5,305ms** shortly after the report response, plus substantial subsequent tasks. This is now direct evidence of main-thread blockage after the API, unlike the original unaffiliated 2.2s/11.5s numbers. No relative-clock subtraction bug: primary duration uses Node monotonic clock at both ends; request epochs and browser `timeOrigin + entry.startTime` align phases. Browser screenshot/diagnostic serialization is outside the final timer.

The already prepared `reports/priority-20260926/credit-opciones.md` option 1 (presentation pagination retaining full server totals/export) is supported by this evidence. No financial semantics, report queries, credit source, chart membership or report rendering were changed.

## Remaining acceptance

Do **not** release this as “all directory operations <2s”: actual default navigation fails. MAIN owns next candidate selection, combined frontend/API build, restarts, permission-transition tests and a new uncontended measurement window. This worker has completed the requested 15 final measurements and released the window.