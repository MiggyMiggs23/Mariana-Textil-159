# Tanda E continuación — prepared disposable environment

## Follow-up: launcher repaired and running

The first launch failed because the unchanged prepared-test database guard requires an active synthetic ADMIN with canonical username `admin`. Renamed synthetic ADMIN234 only; password and ID are unchanged, private credentials and redacted manifest updated. No guard was disabled.

The isolated environment is now running: launcher PID **1359**, API PID **1373**, proxy PID **1408**. URL **http://127.0.0.1:43820/**. Health returns `{"status":"ok"}` and UI HTTP200 across separate tool calls. The actual API-owned TCP socket was mapped to the PostgreSQL backend in `tanda_e_continuacion_copy`; evidence is in `health-check.txt`. Session46 remains ABIERTA/fund500.

The initial ShellExec background child was cleaned up at tool completion. The persistent launcher was therefore started as a detached subprocess through the execution runtime, not a workflow. These tools expose no task-ID primitive; **1359 is the concrete launcher process identifier**, not a fabricated task ID. Do not run another launcher while this one is alive. Existing teardown remains applicable.

The following preparation notes are historical; the follow-up above supersedes the earlier “not runtime-tested” status.

Prepared only. No browser, application server, workflow restart, application database write or commit was performed. The local PostgreSQL server was started solely for restore/fixture preparation and is now stopped. The original Tanda E reports are unchanged.

## Launch

The owning agent must keep this command alive in the foreground during browser work:

```sh
bash reports/tanda-e-continuacion/launch-isolated.sh
```

Browser URL: `http://127.0.0.1:43820/`

Private credentials: `.local/tanda-e-continuacion/credentials.json`, mode `0600`, keys `admin` and `caja`, each with `username`, `password`, `id`. Never copy passwords, cookies or private logs into reports.

Launcher checks exact database identity and supplies only local copy/witness URLs through a minimal environment. It imports the historical inspection runner under the isolated database guard, without changing startup or business source. The static proxy listens on loopback; API uses its existing application listener on port 43821. No preview/workflow routing is modified.

**Not runtime-tested:** per preparation-only scope, API/browser startup was not executed. Shell/JavaScript syntax and external dependency resolution passed. The owner must verify readiness and effective served copy identity before browser mutations.

## Capture and frozen build

Effective running API PID 180 database configuration matched the shell configuration internally, without displaying secrets. Read-only `current_database()` returned `heliumdb`, transaction read-only `on`, PostgreSQL `160010`. A fresh full custom dump was restored only to `tanda_e_continuacion_copy`, local port 55439. `tanda_e_continuacion_witness` is a separate empty local database used by the isolation guard.

Current clean source HEAD `588a13640e6a56ee8d401a9e04d002da3c359f5d` is archived under `.local/tanda-e-continuacion/source/`. The exact currently served API/UI `dist-tanda-e-20260923` bundles were copied there; their matching hashes are in `build-identity.txt`. This does not claim those served bundles were freshly rebuilt from HEAD. Existing package dependencies are linked read-only in use from the API node_modules; no dependencies were installed or changed.

Private dump and secret material remain within the mode-0700 private directory. This is a transactional capture, not proof of source quiescence or continuing equality. No migrations, trigger bypasses, permissions overrides or application-source fixes were applied.

## Fixtures ready

- Site TEC / TANDA E CONTINUACION, id 835.
- ADMIN id 234 and CAJA id 235, natural roles, no exceptional permissions.
- Restored actors anonymized, randomly recredentialed and disabled **only in copy**; restored authentication sessions removed only in copy.
- Credit customer id 8, credit limit 5000, term 30 days. No debt or preapproved Note is fabricated; create/authorize the synthetic credit Note through the normal browser flow.
- Product id 2078 / TANDA-EC-POS, list 150, each physical roll costs 100.
- Supplier id 226, canonical entry id 468 / folio 1, ten rolls / total cost 1000.
- Rolls `993000001` through `993000010`, ids 6233–6242. Each is DISPONIBLE, one meter, with matching supplier, entry, canonical RECEPCION movement and ledger/existence cache.
- Suggested purposes: 001 cash, 002 transfer, 003 credit/E3, 004 unmarked under-cost negative, 005 mark-remate flow, 006–010 reserves. No roll is already marked remate.
- **Session 46 is already ABIERTA**, fondo inicial **500.00**, natural Mexico City operational date 2026-09-23. Its daily-session guardian exists. **Do not open another session or close this one during preparation.** Complete all pending browser operations before any authorized close.
- Final verification: exactly two active synthetic actors, zero restored active actors, zero auth sessions, zero tickets at the synthetic site, ten meters in both inventory ledger and existence cache.

Evidence: `source-identity.txt`, `build-identity.txt`, `fixture-manifest-redacted.json`, `fixture-check.json`, `progress.txt`. No browser evidence exists yet.

## Teardown

After the owner ends browser work:

```sh
bash reports/tanda-e-continuacion/teardown-isolated.sh
```

It signals only the matching private launcher, stops this exact private cluster and deletes `.local/tanda-e-continuacion/`. Reports remain. The source application database and workflows are untouched.