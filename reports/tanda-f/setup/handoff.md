# Tanda F — isolated setup handoff

> **HISTÓRICO — ENTORNO DESTRUIDO.** MAIN completó el teardown el 24/09/2026. `.local/tanda-f` ya no existe; los puertos 43820, 43821, 43831 y 55440 están cerrados y no quedan procesos privados. Las instrucciones de arranque y rutas siguientes documentan el estado previo y **ya no son ejecutables**. Evidencia: `../teardown-verification.json`.

Fresh effective API PID 180 database captured with `default_transaction_read_only=on`. Source identity and digest are in `source-identity.json`. No quiescence or continued equality is claimed. No application database writes, app starts, workflows, gates, commits, or browser mutations were performed.

Private files: `.local/tanda-f/source.dump`, `template.dump`, `credentials.json`, `session-secret`, `cluster/`. Credentials and dumps are private; never publish their contents. Restored actors were renamed, disabled, and rehashed, and restored authentication sessions removed **only inside the disposable copy**. Restored operational data remains sensitive and is not fully anonymized.

Históricamente se preparó un cluster privado PostgreSQL 16.10 en el puerto **55440** y directorio `/home/runner/workspace/.local/tanda-f/cluster`. Al cierre, los launchers ya habían terminado y quedó un `postmaster.pid` obsoleto; `pg_ctl status` confirmó que no había servidor. No se reclama parada grácil. MAIN verificó y eliminó después el árbol privado.

Independent databases: `tanda_f_browser`, `tanda_f_concurrency`, `tanda_f_permissions`, `tanda_f_reversal`. `tanda_f_template` is the prepared reference; `tanda_f_witness` is the empty isolation witness. They share one private cluster but not transactional data. MAIN coordinates start/stop and removes only these new campaign assets at final teardown.

`fixture-manifest-redacted.json` contains IDs: 3 synthetic stores, shared customer with hard credit limit 5000 and 30 days, domestic/import suppliers, all seven natural-role actors plus store 2/3 cashiers. No permission matrix edits or actor permission overrides. All stores have an OPEN cash session, fund 5000, current Mexico City operating day and daily guard; do not open duplicates.

96 synthetic rolls: 8 rolls per product/site for METRO, KILO, PIEZA, BOLSA, each quantity 10, unit cost 100, list price 150. Each has supplier → entry → canonical RECEPCION movement provenance. Verification passed separately across all 12 product/site balances: quantity/cache/ledger 80 each. No mixed-unit total is asserted. This is preparation, not a verified browser workflow.

Frozen source lives in `.local/tanda-f/source/`; API and UI were freshly built from current workspace source directly into private output directories (both exit 0), without altering application builds. Existing dependencies are linked/reused. `launch-isolated.sh` is supplied for MAIN, **not executed**. It preserves the successful E continuation test-import / inspection-boot method and minimal environment, localhost browser 43820/API43821.

Direct Playwright method: import the installed 1.55.0 index.mjs used by `reports/tanda-e-continuacion/browser-common.mjs`, launch `.cache/ms-playwright/chromium-1187/chrome-linux/chrome`, headless/no-sandbox, restrict requests to `http://127.0.0.1:43820` plus data/blob, use new private credentials and explicit locator timeouts. **Browser shared libraries still need resolution**: the prior private browser-libs directory was removed in E teardown, and ldd currently lists missing libraries. Do not reuse discarded E credentials or mutation scripts. MAIN should prepare the private library links before direct Playwright; no testing-subagent stall is necessary.

Preparation encountered and rolled back one invalid numeric store-initials attempt; corrected to TFA/TFB/TFC and resumed fixtures on the preserved new restore. All final checks passed. Original dumps/backups untouched.