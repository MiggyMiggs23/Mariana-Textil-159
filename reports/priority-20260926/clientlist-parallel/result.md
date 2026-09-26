# Client directory parallel-read candidate — ready for MAIN launch

## Change and security boundary

Read `.agents/memory/financial-cache-auth-transitions.md` before implementation. The new candidate starts the existing server-authorized `/api/clientes/listado` fetch while the **unchanged always-fresh auth/me request is pending**, but it does not show rows until current-user verification succeeds. No prefetched directory data is injected before the measured user action.

* `src/pages/clientes.tsx`: retains the original `refetchOnMount: always` and existing cartera/report behavior; only the directory receives separate request-enabled and display-enabled signals.
* `src/lib/client-directory-auth.ts`: per-mount UUID + monotonic verification generation. Identity comprises existing user ID/role/query scope/assigned site partition plus financial visibility and directory permission. A new auth verification, denial, identity/role/scope/site/permission change invalidates the previous generation. Completing verification with the same identity adopts the speculative response without a second fetch.
* `src/components/client-directory.tsx`: query key and placeholder acceptance both require identity/financial scope **and generation**. Request cancellation remains AbortSignal-based. Rows are only available when the independent display barrier is open. Failed current-user verification, absent user or denied directory permission cannot reveal an old cached result. Existing fresh-match caching/pagination within one verification generation is unchanged; no financial cache TTL was expanded.

This is not client-side authorization: every request still includes cookies and goes through the unchanged API authorization. Fresh user mismatch discards the old key's result; late responses cannot populate the new identity/generation. A per-mount verification generation is a cache isolation mechanism, not a claim of cryptographic server-session attestation.

No credit report code, financial semantics, permissions backend, directory API, backend projector or PIEZA source was changed.

## Frozen lineage

Parent source: `reports/noche-20260926/tarea-7/staging/frontend-root-inventory`.
Candidate source: `reports/priority-20260926/clientlist-parallel/frozen-root`.
An exact inventory check permits **only** the three directory files above to differ (two replacements, one added helper). All other parent files, including PIEZA/inventory and credit reports, were verified unchanged. Original parent files/build remain untouched.

Built frontend: `artifacts/mariana-textil/dist-priority-clientlist-parallel-20260926`.
Index SHA256: `c80639769e32336b6fcb64d990c14c7b6324bee4bcb61a9793355bbda17ae446`.

Launch manifest: `reports/priority-20260926/clientlist-parallel/candidate.json`. It has the complete frontend file hashes and retains current performance-copy backend metadata (exact combined v6 API). MAIN should use its frontendRoot/frontendFiles for the coordinated candidate launch and regenerate ready identity; this worker did not mutate active launch metadata or restart anything.

## Verification completed

`node --test reports/priority-20260926/clientlist-parallel/auth-transitions.test.mjs` passed 2/2 tests. The mounted test uses the **actual ClientDirectory, generation hook, React Query and shared QueryClient** with test-only HTTP doubles; UI primitives are simplified only in the test harness.

Verified:

1. Directory request begins during fresh auth verification, but a completed financial response renders **zero data rows** until matching verification succeeds; no duplicate request on success.
2. Old global cache + login as restricted user **without logout**; old pending requests abort, late global responses never appear in new scope, restricted rows never show global financial values.
3. Same UID role change, assigned-site change, scope change and financial-permission change each create a distinct request generation and suppress old rows.
4. Failed auth/me with a cached user, explicit directory denial, logout then login: no sensitive flash and no request while denied.
5. Generation state-machine and fail-closed visibility truth table.

`node reports/priority-20260926/clientlist-parallel/build-candidate.mjs` passed isolated frontend TypeScript checking and Vite production build. Build emitted existing sourcemap-reporting/chunk-size warnings; no build failure.

## Live <2s: pending coordinated launch, not claimed

Baseline actual default navigation was 2608/2136/2141ms, including ~783–1060ms before the directory request. The new candidate overlaps the directory request with that auth-readiness interval instead of weakening readiness. It needs the same three-sample **actual default user navigation** test, plus Nombre/activity/search and permission transitions, after MAIN launches the exact manifest and releases the fiscal/timed-browser contention window.

No new browser load or measurement was run while the other worker owned its window. No DB writes, server starts, workflows, credit implementation or commits were performed by this worker.

## MAIN-launched live result — exclusive window completed

MAIN subsequently launched the exact candidate and granted an exclusive timing window. Verified actual frontend index hash `c80639769e32336b6fcb64d990c14c7b6324bee4bcb61a9793355bbda17ae446`, candidate/ready API hashes equal to v6, and dedicated URL18238 before measuring.

Three consecutive fresh-session **actual default navigation** samples, no warm-up or dropped failures:

| Evidence under `reports/priority-perf-20260926/measurements-aligned/` | Action→visible + two frames | Result |
|---|---:|---|
| default-4.json / PNG | 2606.842ms | **SLOW** |
| default-5.json / PNG | 1614.573ms | PASS |
| default-6.json / PNG | 1608.571ms | PASS |

**Overall: 2/3 pass, strict three-sample <2s acceptance NOT achieved.** Do not replace the failed first sample with a later warmed result. No 429/page errors; one directory request per sample, all `nombre ASC`, active=true, period=all, page1/50. Fifty rows displayed; final screenshot visually reviewed and healthy.

The intended optimization is directly verified: directory requests now start **286.749 / 295.294 / 294.319ms** after action, alongside auth/me (286.930 / 295.431 / 294.475ms), instead of waiting ~783–1060ms for auth verification.

The first sample's directory request itself took **2055.573ms** (requestStart5.480ms, first byte2027.768ms). Auth/me also took1016.452ms; simultaneous inventory/background reads took1555–2157ms and a notification-feed request already in flight before the action took3325ms. No measured long task occurred during that first action. This points to server-side/in-flight workload or cold-start effects, **not** failure to overlap requests, browser connection queueing, duplicate directory fetches or heavy directory rendering. It does not prove a particular SQL bottleneck.

In the following samples the directory request took1174.916/1200.831ms, allowing visible data under2s. Auth remains mandatory and continues to gate display; it was not removed to obtain the passing samples.

No further unmeasured frontend patch is justified by this evidence: parallel dispatch is already working. The feasible next step is route-level timing/query-budget evidence for auth middleware, connection acquisition, transaction, master/activity/ledger reads and response validation, while observing the same app's background feed. Only then choose a scoped directory/backend improvement. Current responses have no Server-Timing/query-budget headers. Disabling notifications/auth, changing data, warming before the action or timing a later header click would bias the acceptance test and was not done.

**Exclusive timed window RELEASED after these three samples.** No credit code or credit measurements in this follow-up.