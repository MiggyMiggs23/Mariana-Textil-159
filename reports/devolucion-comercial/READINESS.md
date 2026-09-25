# Final candidate status — BLOCKED / CLOSED after third attempt

## STOP: no further attempts authorized

MAIN's third positive rehearsal failed on the **first service query**, SQLSTATE `42501`:
`SELECT enabled FROM public.commercial_return_gate WHERE id=1 FOR SHARE`.
Evidence: `main-positive-rehearsal-3.log`. PostgreSQL row-locking SELECT requires UPDATE privilege on at least one column of the locked table, in addition to SELECT. This conflicts with the deliberately protected, read-only runtime gate.

Readonly inspection of private PG55536 / `continuation_return_test` confirmed the third generated runtime role has gate SELECT, but neither table UPDATE nor any-column UPDATE. It is now NOLOGIN; the private gate is false. There are 10 committed fixture tickets/customers, 8 receiving sessions, 19 credit movements and 19 E1 operation envelopes, but **zero commercial returns and zero cash outflows**. No other active/idle-in-transaction client was present at inspection. No PostgreSQL writes or further rehearsal attempts were performed by this worker.

### What is actually proven

- MAIN's closed-install logs, including `main-closed-rehearsal-3.log`, explicitly report **CLOSED direct capture: PASS**.
- The third runner passed its identity/fresh-state preflight, generated-runtime privilege metadata check, and committed all baseline fixtures before reaching the service. These are setup results, not completed commercial-return tests.
- **Positive/adversarial commercial-return cases completed: 0.** The first partial-paid case failed before any return logic. Full-paid, unpaid, two-roll/retry, rollback, malicious split, service/raw-SQL concurrency and mutation cases were not reached. No positive financial, zero-debt-event or concurrency proof can be claimed.
- Earlier offline focused test results below remain offline evidence only; they do not override this PostgreSQL blocker.

### Unsafe workarounds forbidden

Do **not** grant UPDATE on the gate (including a column-only/dummy-column privilege workaround), use the postgres owner as runtime, relax the privilege checker, remove trigger protections, or bypass the gate. The current application owner connection remains a separate release blocker.

### Minimal future proposal — not implemented or authorized to run

Introduce a narrowly scoped, zero-argument SECURITY DEFINER gate-read/lock function owned by a trusted nonlogin owner. It must use a fixed safe search path and fully qualified fixed table reference, acquire the existing row-1 SHARE lock in the caller's transaction, and fail closed for a missing/disabled gate. It must neither accept SQL/object names nor mutate the gate. Revoke PUBLIC execution; grant only this function's EXECUTE to the explicitly approved nonowner runtime. Change only the service's gate-read boundary to call it, preserving the transaction-held lock and all actor/financial validation.

That proposal requires independent review, least-privilege direct-write probes, and a separately authorized fresh rehearsal; it is **not** release evidence. Keep product capture CLOSED. MAIN reports the old running bundle remains untouched and source capture remains closed. No servers/workflows were started or restarted; no nested helper jobs remain.

---

The instructions and third-attempt preparation below are historical handoff context, **not authorization to rerun**. Final status above supersedes earlier readiness language.

## Executable focused runner handoff

MAIN's already-installed candidate needs the narrowly scoped inventory-enum correction below: the original inventory history branch compared an inventory enum to the credit-only label `REVERSO`. Fresh `01-schema.sql` now protects reversal origin linkage directly. `04` updates only that existing function; it is not auto-installed by the runner.

```bash
# Existing owner URL, pinned private identity and acknowledgement remain exported.
psql -X "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f reports/devolucion-comercial/04-inventory-history-enum-fix.sql
bash reports/devolucion-comercial/run-positive-rehearsal.sh
```

Runner preflight checks `pg_stat_activity` and refuses before fixture writes if another active or idle-in-transaction client exists on the private cluster, including the annual-seed rehearsal. It neither terminates that client nor starts/restarts servers. Both owner and service connections have bounded query timeouts. Shell syntax and actual TypeScript loader/configuration refusal were verified locally without opening a DB connection; SQL/service execution is still MAIN-only.

### Third-attempt fixture audit (after MAIN's second failed run)

- The empty E1 operation objects were invalid. Compared the prior night's `positive-producers.mts` and actual POS/customer producers. Seeds now use the real `claimCreditOperationCore` with a PostgreSQL-backed store, POS authorization content, and ordinary-payment content; they persist the payment application too. No arbitrary nonempty filler JSON.
- Readonly inspection of the installed private catalog covered required/defaulted columns, CHECK/FK constraints and E1/E2/E5/E11 trigger dependencies, including payment applications. Sales carry matching credit terms, authorized/collected-note state and zero VAT rate. Full-roll frozen costs, stock quantities, active ADMIN/store/session references, and positive outflow fields satisfy their catalog checks.
- E2 finalization is specifically mandatory for physical **cash** ordinary/directed abonos. These baseline receipts are explicitly bank transfers; they do not impersonate cash or E5 retained-money application. E5 birth/graph triggers remain enabled; no E5/E11 business graph is seeded. Their helper functions retain executable default ACLs for the nonowner.
- Installed E5 deliberately emits SQLSTATE 40001 for simultaneous graph writers. The direct-SQL concurrency case logs and retries only that SQLSTATE, restarting the whole failed transaction up to four times, then still requires the canonical insufficient-cash rejection. No constraint or trigger bypass is introduced.
- The commercial-return service stores its nonempty request as E1 operation content. That satisfies the installed nonempty-object check and the commercial SQL request-mirror check; wrapping it in the ordinary-payment envelope would violate that mirror. No product-service edit was necessary for this failure.
- Second run left the synthetic masters and one receiving session, but its sale transaction rolled back. MAIN must restore a fresh schema-only private DB before the third attempt. Stop on any new failure; no fourth blind rehearsal or reset is authorized. No positive-service PASS has yet been obtained.

Candidate is ready for MAIN's first **disposable PostgreSQL review/rehearsal**, NOT release. No SQL was executed, no server/workflow started, and no application DB accessed by this worker.

## Candidate and evidence

- Install order: `00-enum.sql`, `01-schema.sql`, `01b-financial-integrity.sql`; then `02-rehearsal-closed.sql`.
- `01b` independently calculates canonical FIFO/directed/legacy-explicit allocations in integer cents, verifies exact debt/refund proportions and source nature/envelopes, and checks both historical prefixes and current allocation ownership. No caller-set closed-guard flag is trusted.
- Customer and cash row-write fences serialize direct writers, including stale isolation snapshots. Deferred dependency rechecks and historical guards cover mutation-before-capture within a transaction. Legitimate later stock state changes/session closing are not historical eligibility checks.
- Cash sufficiency is checked against canonical physical inputs/outflows at capture commit. This matches the currently **false** E12 supplier-cash gate; future E12 activation requires revisiting this SQL.
- `03-runtime-role.sql` checks nonowner runtime privileges; `verify-projection-parity.ts` compares SQL versus TypeScript for every selected synthetic customer's ledger prefix.
- Latest offline run: **94/94** focused API, projector, detail, report, export and frozen-cut tests; API TypeScript and API code generation passed. These are NOT PostgreSQL/concurrency proofs. Earlier frontend 12/12 and E7 commercial-return case passed; latest broader UI/DB regression remains MAIN's responsibility.

## MAIN commands — no server starts

Use an already-running **private disposable cluster** and its pre-commercial-return baseline DB. Never use the application DB as the dump source. These parameters are required, not inferred:

```bash
: "${PRIVATE_BASELINE_DATABASE_URL:?private baseline on the existing disposable cluster}"
: "${PRIVATE_CLUSTER_MAINTENANCE_URL:?maintenance DB on that same private cluster}"
: "${TEST_DATABASE_URL:?URL for newly created continuation_return_test on that cluster}"
: "${COMMERCIAL_RETURN_DISPOSABLE_SYSTEM_ID:?known private cluster system_identifier}"
export COMMERCIAL_RETURN_DISPOSABLE_ACK=NEW_PRIVATE_CLUSTER_ONLY
# MAIN verifies baseline and maintenance cluster identities before this copy.
createdb --maintenance-db="$PRIVATE_CLUSTER_MAINTENANCE_URL" continuation_return_test
pg_dump --schema-only --no-owner --no-privileges "$PRIVATE_BASELINE_DATABASE_URL" \
  | psql -X "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1
bash reports/devolucion-comercial/rehearse-closed.sh
# No manual seeds or runtime credentials: this runner creates and commits them.
# Requires the existing loopback private cluster on port 55536.
bash reports/devolucion-comercial/run-positive-rehearsal.sh
# Optional allocator differential run: use syntheticCustomerIds from PASS output.
COMMERCIAL_RETURN_TEST_CLIENT_IDS="$SYNTHETIC_CUSTOMER_IDS" \
  pnpm --filter @workspace/api-server exec tsx ../../reports/devolucion-comercial/verify-projection-parity.ts
```

The focused runner requires exactly `postgresql://postgres@127.0.0.1:55536/continuation_return_test` (or equivalent privileged credentials on that same loopback port/database), the separately pinned system ID and acknowledgement above. It checks that the core business tables are empty before any fixture writes. It generates an isolated nonowner login/password in memory, runs `03-runtime-role.sql` itself, seeds original authorized notes, rolls and immutable credit/physical-money evidence, and calls the actual service transaction function with real Drizzle/PostgreSQL, not a mock. It starts no HTTP/PG server and edits no product gate. The private SQL gate is opened for the run and closed in `finally`; the generated login is disabled and its password removed. Fixtures remain for inspection, so a rerun requires a new schema-only restore.

Cases are partial 1000/800/200, fully paid, fully unpaid, same-note 400+600 with exact 80/320 then 120/480 splits, discarded-response identical retry, full rollback, malicious direct SQL with coherent but wrong 100-debt/900-refund mirrors plus spoofed flags, concurrent service cash exhaustion, concurrent direct-SQL cash exhaustion, and forbidden linked-event mutation. No application login credentials are created: the synthetic ADMIN has a disabled-login password hash. Database login credentials never leave memory.

`SYNTHETIC_CUSTOMER_IDS` for the optional differential command is the comma-separated list reported by the completed run. Production's current postgres-owner application connection does **not** satisfy the nonowner privilege proof; passing with the generated runtime role does not certify that production configuration.

## Required positive/adversarial probes before promotion

Full-unpaid, full-paid/zero-debt, partial-paid, two-roll and tax exact-cent cases; fractional-cent rejection; directed and explicit/FIFO legacy mixtures; source correction/unknown settlement rejection; receipt reversal/application mutation/envelope mutation; sale/line/inventory identity mutation before AND after capture; wrong receiving store/session/day; insufficient cash; simultaneous returns, simultaneous cash withdrawal, stale REPEATABLE READ; duplicate retry; then legitimate later receipt, roll resale/transfer, and cash close.

Run direct writes as the runtime role, including attempts with the former closed-guard setting, and force `SET CONSTRAINTS ALL IMMEDIATE`. PostgreSQL syntax, catalog compatibility, actual trigger execution order, role usability, concurrency, and recheck cost are still unproven. Global deferred rechecks intentionally favor integrity over performance and need MAIN's measured review.

## Reader audit and changes

- Canonical debt/aging and credit notifications use the shared projector; zero pending remains visible in statement evidence but not overdue-debt alerts.
- E7 statement retains the debt-cancellation event; E7 cash attribution subtracts only actual refund. Exports inherit an explicit distinction in legends.
- Legacy destination-account totals/detail/current-vs-prior/export now include the physical refund at return date/receiving store, separately from debt cancellation.
- Analytics cash differences, repeat-shortage alerts and store comparisons now use validated immutable E2 cut snapshots where present, retaining each legacy reader's previous fallback only for genuinely legacy cuts. This prevents refund cash outflows becoming invented shortages.
- Sales/client reports and customer lifetime utility explicitly describe historical gross original-sale metrics; their export warnings preserve that distinction. They do not retrospectively rewrite original sale totals, taxes or margin. No new net-profit/tax policy was invented.

Known earlier broad-suite failures remain unrelated/unresolved: E7 test's E5=false expectation versus current true source; cash-admin and corte mock import allowlists. Do not treat the focused count as whole-application certification.