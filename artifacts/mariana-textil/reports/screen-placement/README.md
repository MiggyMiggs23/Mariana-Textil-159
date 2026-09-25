# Screen placement: Cuentas Destino / Tiempo real / Atribución E7

All images are SYNTHETIC. They come from the isolated browser harness
(`src/observable-test/browser.ts`) and the real page components, with a mock
`@workspace/api-client-react` transport. Each image has a banner that says "DATOS SINTÉTICOS".
No app DB, no auth, no writes.

Fixture (same for before and after): a complete Cuentas Destino payload
validated with `GetAdminCuentasDestinoResponse`. It has real account rows:
- Cash 500.00, of which 320.00 is invoiced.
- No-fiscal 225.00 and fiscal 150.00, for 875.00 collected.
- Sales matrix: 560.00 invoiced + 440.00 not invoiced = 1,000.00.
- Two stores.
It also uses the existing dashboard/pending fixtures and a synthetic E7Atribucion.

- before/: RECONSTRUCTED BASELINE, not the served app. It was captured from an
  isolated snapshot of HEAD (`git archive HEAD` into /tmp, with node_modules
  symlinked). No live/watched file was modified.
- after/: the working tree after the change, at 1440 px and 402 px.
- To capture the after images: `echo after > reports/screen-placement/.phase`, then
  `node ../../scripts/src/frontend-test-runner.mjs --file reports/screen-placement/capture.test.ts`
  (the runner sanitizes env, so the phase comes from the sidecar file).

DOM suites that need the E7/E11 bundle (png dataurl loader, offline guard, jsdom):
`node artifacts/mariana-textil/reports/screen-placement/run-e7-dom.mjs <e7|e11|e11-placement>`
(run from the workspace root).
