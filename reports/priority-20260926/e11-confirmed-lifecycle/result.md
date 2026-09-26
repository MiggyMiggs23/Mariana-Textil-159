# E11 confirmed-operation lifecycle fix — candidate ready

## Reproduced defect

Frozen parent `src/hooks/use-e11-write.ts:81–90` persisted authoritative confirmation, awaited query invalidation and a fresh session check, then returned solely because the writer component had unmounted. The durable CONFIRMED marker was left behind although the operation and refresh had succeeded, blocking the next intention.

The **mounted actual-hook regression test fails against the parent**: `E11_WRITE_BASELINE=1 node --test --test-name-pattern='authoritative ACK' reports/priority-20260926/e11-confirmed-lifecycle/lifecycle.test.mjs`. Expected failure is the acknowledged intention still present after unmount/refresh, not a simulated source-pattern check.

## Narrow fix

Only `src/hooks/use-e11-write.ts` differs from the parallel-directory frozen candidate:

1. Capture the exact serialized acknowledged command/scope/operation/confirmed record.
2. After successful invalidation **and the existing fresh session.check**, clear durable state even if the writer component unmounted.
3. Immediately before deletion, require the exact persisted record still matches and the original actor/action/UUID recovery remains CONFIRMED. A replacement intention, changed payload, quarantine or uncertain state is never removed.
4. React pending-state updates still require a mounted component and matching saved UUID.

No changes to POST ordering, server authorization, retry/recovery protocol, business amounts, financial projection, credit reports or session provider. Failed invalidation/session recheck does not reach cleanup. Existing first-attempt definitive-no-effect rejection semantics remain unchanged.

**Old persisted CONFIRMED markers are NOT auto-cleaned on mount.** They have no live authoritative-ACK plus successful-refresh/check continuation; they remain blocked and require the existing authorized ADMIN resolution protocol. Do not manually remove localStorage/sessionStorage or resend their original UUID merely to unblock the browser. Resolve the old decision namespace through the existing server-verified protocol, then test new fixed flows.

## Verification

`node --test reports/priority-20260926/e11-confirmed-lifecycle/lifecycle.test.mjs`: **10/10 pass** using real React mounting/unmounting, the actual useE11Write hook and actual e11-recovery storage/event implementation. Test-only session/network/invalidation controls exercise:

* ACK → unmount during invalidation → successful refresh/check → exact cleanup.
* Mounted successful cleanup, with one send only.
* Refresh rejection preserves confirmed evidence.
* Failed/uncertain send preserves uncertain evidence.
* Newer UUID intention in the same slot is retained.
* Same UUID with a changed command payload is retained.
* Logout/session-check rejection preserves recovery, including provider-style quarantine.
* Changed recovery state is retained even if session check succeeds.
* Previously cached CONFIRMED markers remain blocked; no automatic cleanup or POST.

Isolated frontend TypeScript check and Vite production build passed. Existing Vite sourcemap-reporting/chunk-size warnings remain warnings.

## MAIN launch handoff

Frontend-only manifest with complete asset hashes:
`reports/priority-20260926/e11-confirmed-lifecycle/candidate.json`.

FrontendRoot:
`artifacts/mariana-textil/dist-priority-e11-confirmed-lifecycle-20260926`.

Index SHA256:
`02e8384c8f458daa0d29a958bc1c519ca7e2b75705a47db3d8b514527965ad78`.

Manifest intentionally does **not** select an API version: MAIN must retain its authorized fiscal backend (including V8 where applicable) and update only frontendRoot/frontendFiles in runtime metadata. Source inventory verifies exactly one file changed from `clientlist-parallel/frozen-root`; parallel client-directory optimization, all PIEZA/inventory files and credit report sources are unchanged. Parent candidate is untouched.

No runtime start/restart, DB operation, workflow, new business change or commit performed. Live fiscal flow validation awaits MAIN-controlled frontend activation and authorized recovery of the already-stuck old intention.

## Final scope and strict performance verdict

The preceding parallel-client-directory default samples 4–6 were
2606.842 / 1614.573 / 1608.571 ms. **Strict `<2 s` acceptance: FAIL, only 2/3
samples passed.** This lifecycle candidate does not establish a new client-list
performance result; no new runtime measurements were taken.

**Credit reports: no changes.** No credit balances, report definitions, query
semantics or related UI were modified. Parallel-directory and PIEZA behavior
remain the preserved parent candidate behavior.

The actual workspace hook was synchronized only after verifying it was
byte-for-byte equal to the frozen parent hook. It now exactly matches the
candidate hook; no other current application changes were overwritten.
Durable lessons were incorporated into existing recovery and controlled-clock
memory topics, not an implementation log or duplicate clock topic.