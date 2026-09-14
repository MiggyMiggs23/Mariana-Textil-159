**FAIL — Block 4 is not complete: applying existing favor changes location-filtered Cobrado, and reversal paths can expose favor that the database then refuses to apply.** Block 1’s sticky circular counter and Block 3’s canonical status derivation otherwise appear substantially implemented.

### Critical findings
1. **Receipt conservation fails under location filters.** `admin-analytics.ts:155-185` emits applied portions as `ABONO` at the *target note’s* location, while unapplied favor is emitted only when no location filter is present. Thus a receipt held as favor contributes 0 to a location before application and contributes the applied amount afterward, despite no new cash. Globally, normal inserts are not double-counted because applications plus remainder conserve the receipt and the DB caps total source applications (`clientes-schema.ts:245-254`), but the receipt’s breakdown/location attribution mutates. The purported test at `clientes-aging.test.ts:159-210` only checks an in-memory projection and unrelated predicates; it never exercises production analytics, period totals, location filters, or later application.

2. **Cancellation can create unusable favor.** The projector reduces/reverses the target and dynamically makes the old ABONO residual available (`credit-allocation.ts:176-213,233-301`; cancellation at `pos.ts:1272-1285`), but immutable `aplicaciones_credito` rows remain. The insert trigger still subtracts every historical application from the receipt (`clientes-schema.ts:245-254`), including applications to the reversed sale. Result: UI/read models can show favor that authorization cannot consume.

3. **Favor cannot rescue an over-limit authorization in the UI.** GET projection computes `autorizable` without selected favor (`routes/pos.ts:842-856`), while `cobros.tsx:1089-1102` requires that flag even after the cashier selects favor. The POST would accept the reduced exposure, but the button remains disabled.

4. **One Block 3 view displays a non-canonical pending amount.** Stored credit notifications derive the correct state, but `pages/notificaciones.tsx:65` passes original `item.importe` as `saldoPendiente`; partially paid/overdue notes therefore show the wrong balance beside the canonical badge.

### Security
None observed; relevant authorization and customer-credit advisory locks are present.

### Next actions
1. Model Cobrado from immutable receipt events/location, never from later application destinations; add an analytics integration test covering before/after application globally and per-location.
2. Make reversal-aware source availability identical in projection and DB enforcement, with cancellation/reapplication coverage.
3. Recompute authorization eligibility from selected favor and return/render current pending balances in notifications.