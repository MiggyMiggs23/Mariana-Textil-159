# E4 UI release support — 2026-09-23

## Delivered UI behavior

- E4 cash-out flag is ON. E12 remains OFF; the E4 form exposes neither Fondo nor mixed funding.
- `Caja Operativa` uses one capture implementation only: `SalidasDineroE4Panel`. The former unguarded form in `cobros.tsx` was removed; when the E4 gate is OFF, the wrapper renders no operational surface and calls no E4 hooks.
- ADMIN, SUPERVISOR, and CAJA access is still derived from the existing `cobros_pagos` view/create permissions. The parent page does not add a role or location exception. DOM coverage mounts Mariana, Coco, and Cruces and verifies the existing own-store review restriction.
- Extraordinary capture requires amount and motive, is always Caja Física, refreshes the server balance immediately before mutation, and leaves final authority to the API.
- Insufficient cash is hard-blocked for CAJA/SUPERVISOR. ADMIN can proceed only for an extraordinary outflow with an explicit E4-native unlock motive.
- Supplier capture is available only in Mariana, requires an active supplier, is Caja Física only, and never exposes or sends an unlock.
- Capture and review lock synchronously before preflight/mutation. Retries preserve `claveOperacion` for identical content and rotate it when content changes.
- Lists and canonical cash queries refresh on mount/focus and every 15 seconds. Successful capture/review invalidates all Caja/session/corte/salida cache variants.
- ADMIN can accept or reclaim. Same-store SUPERVISOR can answer a reclaim. The review dialog and list show the durable actor/version history. E4 native unlock evidence shows motive, actor, prior balance, outflow, and timestamp.

## Contract consumed

- Request: `desbloqueoCaja: { motivo }`.
- Durable response: `salida.e4.desbloqueoCaja`, nullable, with `motivo`, `usuarioId`, `createdAt`, `saldoAntes`, and `egreso`.
- Required E4 create fields `tipo` and `claveOperacion` are sent.
- No E12 DTO is used by this flow.

## Verification and exact commands

1. `pnpm --filter @workspace/mariana-textil typecheck`
   - PASS, zero TypeScript errors, after generated E4 contract synchronization.
2. `pnpm typecheck`
   - PASS, all selected libraries/packages, zero TypeScript errors.
3. `pnpm --filter @workspace/mariana-textil test:e4-cash-out`
   - PASS at `reports/tanda-b-20260922/e4/frontend-node-mutants-2026-09-23T18-08-51.458Z`: all 21 active DOM obligations passed green, required mutant failed with the expected assertion, and restored source passed.
4. After consolidating the duplicate `cobros.tsx` surface:
   - `node reports/tanda-b-20260922/e4/run-frontend-node-mutants.mjs --ids E4-GATE-OFF,E4-PARENT-OFF-MARIANA,E4-PARENT-OFF-COCO`
   - PASS_SELECTED_CASES at `reports/tanda-b-20260922/e4/frontend-node-mutants-2026-09-23T18-15-04.383Z`.
5. Final full rerun:
   - `pnpm --filter @workspace/mariana-textil test:e4-cash-out`
   - All 21 green/mutant/restored cases completed successfully, but the runner's final source-integrity status was `FAIL_SOURCE_CHANGED` because the backend agent concurrently created `lib/db/src/run-e4-isolated-tests.mjs`. No UI/source file in this task changed during the run. Evidence: `reports/tanda-b-20260922/e4/frontend-node-mutants-2026-09-23T18-15-39.848Z`.
6. `git diff --check -- artifacts/mariana-textil/src`
   - PASS, no whitespace errors.

No browser, workflow, server restart, real database, or real user was used.

## Screen verification steps for the owner

1. Sign in as CAJA or SUPERVISOR assigned to a store, open **Caja Operativa**, and verify **Salidas de dinero** appears when `cobros_pagos` view permission is enabled.
2. In each of Mariana, Coco, and Cruces, choose **Extraordinaria**, enter amount and mandatory motive, then register. Verify the account is fixed to **Caja Física** and no Fondo/mix control exists.
3. Use an amount above the displayed server Caja balance:
   - CAJA/SUPERVISOR: registration must be blocked.
   - ADMIN: enter **Motivo de desbloqueo extraordinario** and confirm; then verify the list shows its durable unlock evidence.
4. In Mariana only, choose **Proveedor**, select an active supplier, and confirm that no unlock field is shown. An amount above Caja availability must remain blocked for ADMIN too.
5. As ADMIN, use **Aceptar** or **Reclamar** on an extraordinary entry. Reclaim requires an explanation.
6. As same-store SUPERVISOR, open a reclaimed entry and **Responder** with an explanation. A supervisor from another store must not see that action.
7. Select **Ver historial completo** and verify action, timestamp, actor ID, version, explanation, and optional evidence link.