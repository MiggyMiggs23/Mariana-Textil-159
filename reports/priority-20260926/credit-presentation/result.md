# Authorized credit-report presentation pagination

## Ready for MAIN

Literal owner authorization was already saved by MAIN and was read before implementation:
`reports/autorizacion-propietario-liberacion-20260926.txt`.

Frontend-only candidate:
`reports/priority-20260926/credit-presentation/candidate.json`.

Built frontend:
`artifacts/mariana-textil/dist-priority-credit-presentation-20260926`.

Index SHA256:
`af0541fd749f49ffe917aaae51ba6adc8c1f99f1dd5ad1de419a57a2a0c578b5`.

Parent is the frozen lifecycle + parallel-directory + PIEZA frontend with index
`02e8384c8f458daa0d29a958bc1c519ca7e2b75705a47db3d8b514527965ad78`.
This is **not** a full-HEAD build. Exact source inventory allows only:

* `components/reportes/report-table.tsx`
* `components/reportes/generic-report-renderer.tsx`
* `components/reportes/tabs/clientes-tab.tsx`

Actual workspace versions of these three files exactly match the candidate.
Parent artifacts and unrelated current application changes were preserved.
MAIN must retain its authorized API and choose when/how to launch the candidate;
this manifest does not replace API metadata.

## Presentation-only behavior

Credit tables opt into screen pagination (default 50; selectable 25/50/100).
All rows are sorted **before** slicing the visible page, with the previous
numeric/string comparator unchanged. Totals use the complete original server
totals, never a page sum. Labels disclose that totals, exports and printing
include all rows of the filtered report.

Accessible previous/next controls announce page/range/count and disable at
boundaries. Page resets on sorting, page-size changes, filter/scope changes and
replacement row sets. Returning to an earlier cached filter cannot revive an
old page. Comparison-site tables page independently.

“Imprimir reporte completo” uses native printing. The beforeprint lifecycle
synchronously renders every sorted row, including Ctrl/Cmd+P; afterprint returns
to the screen page. Print CSS removes table scroll clipping and controls, and
print rendering disables sticky headers/footers. Full printing intentionally
incurs full-row DOM cost only when printing.

Other report sections and resolved directed-payment tables are not opted into
pagination. Charts are **unchanged**, with no top-N slicing or meaning changes.

## Financial and export invariants

No ledger SQL, API report query, financial projection, financial amount, KPI,
chart data, backend export source or export handler changed. Existing complete
filtered XLSX/PDF requests remain at `/api/reportes/vistas/clientes/export.*`;
screen page/size/offset are not transmitted to those requests. No direct SQL or
application-DB test operation was executed by this task; later authorized browser
reads/login/export checks used MAIN's disposable copy.

## Verification performed

`node --test reports/priority-20260926/credit-presentation/presentation.test.mjs`
passes **3/3 mounted tests**. The first mounts the actual production
Reportes → ClientesTab → GenericReportRenderer → ReportTable chain, using
test-only API/session/layout/chart stand-ins and the real export handler,
report scope functions, formatter and table logic.

Assertions cover all 137 synthetic test rows occurring exactly once across
sorted pages; numeric sort across off-page rows; unchanged full totals and KPI
input; untruncated chart input; page/filter/row resets; keyboard sorting;
unchanged complete-filter XLSX/PDF request parameters and full response-blob
delivery; synchronous full-row beforeprint and page restoration; independent
comparison-site paging/printing; opt-in isolation for other report tables.

These are deterministic mounted-component tests, **not** claims of live export
financial reconciliation or measured browser latency.

Isolated frontend TypeScript check and Vite production build passed. Existing
sourcemap-reporting and large-chunk warnings remain non-fatal.

## Genuine before/after browser measurements — complete

MAIN launched both production frontends over **the same API process PID1540,
port18237**, API SHA256
`1de24ede8cad2ee2290987c6d718e85937515f3a7a7e306c7d32d155613c065e`,
and disposable DB `release_perf_20260926`. No API restart occurred.
Baseline origin18238 served UI02e838; candidate-only proxy18239 served UIaf0541.
This origin difference is explicit; every sample used a fresh browser/session.
Effective served hashes were checked in response headers.

Same synthetic annual model: 54,750 tickets, 2025-09-27 through 2026-09-26,
global credit scope, ordinary login followed by full annual-report navigation.
No credit-request warmup and no client-list timing. Exports and interactive
checks happened only after the third timed sample in each phase.

| Sample | Baseline full navigation | Candidate full navigation | Baseline credit HTTP | Candidate credit HTTP |
|---|---:|---:|---:|---:|
| 1 | 10,978.244 ms | 5,431.429 ms | 2,172.220 ms | 2,277.580 ms |
| 2, completed retry | 15,276.559 ms | 5,195.218 ms | 2,128.457 ms | 2,073.785 ms |
| 3 | 15,049.783 ms | 5,402.697 ms | 2,150.335 ms | 1,984.618 ms |

Full-navigation metric ends at visible report plus two animation frames,
including navigation/assets/auth/report/render phases; it is not conflated with
HTTP responseEnd. Completed-sample median: **15,049.783 → 5,402.697 ms,
64.10% lower**. This is materially faster but **not a sub-3-second result**.
Credit response-end to visible dropped from 5,748–9,700 ms to 715–916 ms;
financial HTTP work remains essentially unchanged.

**Retained anomaly:** the first attempt at baseline sample2 exceeded the
300-second shell harness deadline after authentication, without a trustworthy
action-to-visible result. Cause remains unestablished. It is preserved at
`measurements/baseline-2-first-attempt-timeout.json`, not silently excluded or
classified as a fast/product-success sample. Bounded diagnostics were added,
then sample2 was repeated. The medians above describe completed samples only;
this was not a clean uninterrupted six-attempt run.

Full report DOM: **16,268 → 106 rows**, including empty-state rows from both
credit and resolved-payment sections. Credit-only DOM:16,267→105.
Actual returned credit data rows remain **16,265** (2,575 clients,1 public
summary,2 payment-method rows,13,687 FIFO rows). Whole-document elements:
**238,227 → 7,987**. Empty-state rows are not counted as financial data.

### Live financial/export/print evidence

All six completed API responses have exactly equal KPI values, complete
table-row hashes/counts, columns hashes, totals and chart-data hash. Full totals
include sales5,201,300, utility2,600,650 and FIFO balance1,587,692 unchanged.

Actual UI XLSX/PDF downloads succeeded on both versions. All **10 non-metadata
workbook sheets have equal full-cell hashes**, including2,575 client rows and
13,687 FIFO rows plus their headers/totals, KPIs, charts and notices. The
`Periodo` metadata sheet differs; the unchanged exporter includes generation
time at B2. Binary XLSX/PDF hashes differ, so whole-file byte equality is **not**
claimed. PDF checks confirm successful full-filter requests, valid signatures
and approximately3.57MB downloads; extracted PDF financial-text equality was
not tested.

Actual candidate UI next-page action changed rows without changing full totals;
sorting covered all data before paging, page-size change reset correctly.
Actual production-page beforeprint DOM rendered all2,575 client and13,687 FIFO
rows (and all other tables), print navigation computed `display:none`,
headers were non-sticky, both table wrappers computed `overflow:visible` and
`max-height:none`. Afterprint restored the25-row screen page. This verifies the
actual print DOM/CSS, not a physical printer or browser PDF spooler.

Evidence:
`measurements/{baseline,after}-{1,2,3}.{json,png}`,
`measurements/after-3-print.png`, and **`measurements/comparison.json`**.
Reproducible checks: `browser-measure.mjs` and `compare-measurements.mjs`.

No server/workflow starts/restarts, direct SQL writes, application-DB tests or
release were performed by this task. MAIN owns activation.

## Client directory: owner decision, no further optimization

The owner explicitly accepts approximately **2.61 s cold and 1.6 s warm** as
cold startup, not a query defect. The historical strict-threshold observation
was 2/3 samples under two seconds; it is not being used to justify further
optimization. Client-list optimization is stopped. This candidate preserves
its existing parallel-directory behavior without further changes.