# Prompt L — Full-catalog LabelPrint stop-gate

**Status: PASS_RENDERED_CATALOG_GATE.**

- Live catalog: **1234 products**; products hash 9b5a7bfb4133c1c700f9d242628c0c46 (approved 9b5a7bfb4133c1c700f9d242628c0c46).
- Live price history: **1016 rows**; hash 64f5ec3242e70cdfe37e1a242c26b506 (approved 64f5ec3242e70cdfe37e1a242c26b506).
- Live rollos: **0**; assigned series: **0**.
- Source gate: **PASS_READONLY_SOURCE_GATE**; export used the default `DATABASE_URL` in a `REPEATABLE READ READ ONLY` transaction.
- API server was not imported, restarted, or used; no users or sessions were read.

## Exact mounted renderer

- Real component: `artifacts/mariana-textil/src/components/label-print.tsx`.
- Real monochrome logo import and compiled application CSS were used; no lookalike CSS or logo was substituted.
- Browser used `print` media plus `body.printing-labels`, after `document.fonts.ready`, two frames, `beforeprint`, and two more frames.
- Label geometry target: 100 × 70 mm; QR target: 29 × 29 mm; quantity: `35.000`.

## Full-catalog geometry

- Seven-digit baseline (`9999999`): 1234/1234 labels; overflows: **1**.
- Eight-digit minimum (`10000001`): 1234/1234 labels; overflows: **1**.
- Eight-digit maximum (`99999999`): 1234/1234 labels; overflows: **1**.
- Introduced by eight digits (minimum): **0**.
- Introduced by eight digits (maximum): **0**.
- Eight-digit maximum full tela+color product text exact: **1234/1234**.
- Eight-digit maximum AutoFit: product name **1233/1234**, SKU **1234/1234**, quantity **1234/1234**, QR payload **1234/1234**.
- Eight-digit maximum series exact: **1234/1234**; scrollWidth ≤ clientWidth **1234/1234**; text bounding width ≤ clientWidth **1234/1234**.
- Eight-digit maximum physical boxes: labels 100×70 mm **1234/1234**; QR 29×29 mm **1234/1234**.

Existing seven-digit overflow is reported as evidence and was not fixed here. Any eight-digit introduced overflow is a stop condition before production code or the authorized counter update.

## QR proof

- ZXing decoder: @zxing/browser BrowserQRCodeReader.
- Rendered eight-digit maximum SVGs decoded exactly: **1234/1234**.
- Expected payload for every row was exactly `SKU-SERIE`.

## Physical limitation

Physical printer output and scans with the warehouse pistol and phone camera remain **PENDING**; digital DOM geometry and ZXing decoding do not accredit a physical scan.

Full JSON evidence is in `reports/prompt-l/full-catalog-label-fit.json`; the read-only product export is `reports/prompt-l/full-products-readonly-export.json`.
