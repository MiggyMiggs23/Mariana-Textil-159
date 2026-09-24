# Tanda G disposable setup handoff

Prepared fresh effective-API PID180 read-only dump; identity/digest in `source-identity.json`. No application writes, workflow changes, API starts, UI starts, initializers, schema changes, commits, metrage enabling or gate flags. Restored operational data remains sensitive; private tree is mode0700 and credentials mode0600.

## Frozen baseline and fixtures

Baseline is **git HEAD 8e5dc4a3d5ffe33ea30dbd9ff2f170d7214390a5**, not the concurrently edited working tree. `git archive HEAD` extracted into `.local/tanda-g/baseline-source`; workspace dependencies explicitly resolve to frozen libraries. API and UI builds succeeded; hashes in `build-identity.json`. UI output is `artifacts/mariana-textil/dist/public`.

Fresh PostgreSQL16.10 cluster: `.local/tanda-g/cluster`, localhost **55441**. Independent databases: `tanda_g_baseline`, `tanda_g_candidate`, `tanda_g_browser`; prepared reference `tanda_g_template`; empty isolation witness `tanda_g_witness`. PostgreSQL was restarted for final read-only identity checks and stopped gracefully before handoff.

All copies have 9 natural-role synthetic actors including canonical active `ADMIN` username `admin`; three stores; shared credit customer; domestic/import suppliers; 96 traced rolls across METRO/KILO/PIEZA/BOLSA. Supplier → entry → RECEPCION provenance verified; each product/site starts roll/cache/ledger quantity80. Restored actors disabled/renamed/rehashed and restored auth sessions removed **only on copies**. Permission matrix unchanged and no overrides added. Open cash sessions already exist; do not create duplicates.

`fixture-manifest-redacted.json` holds IDs. `.local/tanda-g/credentials.json` holds private credentials. `final-copy-identities.json` verifies exact SQL identities, canonical admin guard, empty witness, zero active metrage products and zero synthetic metrage products.

## Actual baseline reproduction completed

Cases **1,2,4,5,6,7,8,9** executed using the frozen real production helpers against `tanda_g_baseline`; every step committed. Reports: `../baseline/case-N.json`, `../baseline/summary.json`. These are native-helper/PostgreSQL reproductions, **not HTTP or browser results**. Cases3 and10 deliberately excluded. Baseline is now consumed; candidate/browser remain pristine prepared fixtures.

The F harness reuses the same METRO product across distinct case rolls; product/site discrepancies can carry over across cases. Inspect each case's own baseline, step snapshots and summary `caseDiscrepancyDelta`, not just cumulative final balance. All eight case files preserve original F step order.

Frozen compiled runner: `.local/tanda-g/baseline-run.mjs`; source adapter `build-baseline-runner.mjs`; invocation `bash reports/tanda-g/setup/run-baseline-case.sh N` after private cluster start. **Do not rerun against consumed baseline without explicitly recreating it from private template.dump.**

## MAIN-owned runtime lifecycle

1. `bash reports/tanda-g/setup/start-cluster.sh` (keep alive through MAIN's durable lifecycle).
2. `bash reports/tanda-g/setup/launch-api.sh baseline`: port43841, frozen baseline bundle.
3. Candidate/browser launchers expect MAIN/backend's completed private candidate bundle at `.local/tanda-g/candidate-source/artifacts/api-server/dist/index.mjs`; ports43842/43843 respectively. No candidate bundle was copied while its implementation is in progress.
4. `bash reports/tanda-g/setup/launch-ui.sh [private-built-UI-directory]`: localhost43840 → browser API43843. Default is frozen baseline UI; pass completed candidate UI explicitly for candidate verification.

Launchers use minimal env, explicit private copy/witness URLs, required isolated-test guard, test import followed by inspection boot (E continuation lifecycle). No application credentials inherited. MAIN must keep runtime processes alive outside short-lived shell children, as in successful E continuation.

Current backend handoff proposes audit JSON evidence without additive schema; none applied. Any later additive schema belongs **only to candidate/browser copies**, never effective source DB or baseline.

## Rerunnable final cleanup

`node reports/tanda-g/setup/teardown.mjs` stops identity-checked private processes/cluster. After preserving nonsecret reports, `node reports/tanda-g/setup/teardown.mjs --remove` also removes only `.local/tanda-g`. Repeat safely. Source application, original dumps/backups and reports remain untouched.