# E1 offline verification

These maintained test-only launchers make no database, startup, API, or network
call. The backend manifest is explicit and non-empty. It includes only the five
listed E1 pure/offline tests; it does not include API integration or database suites.
The frontend continues to use its validated 99-file safe manifest.

Run the guard denial self-check (the only command permitted before the parent
runs the suite):

```sh
E1_OFFLINE_GUARD_ACTIVE=1 node --require ./scripts/src/offline-test-guard.cjs ./scripts/src/offline-test-guard-selfcheck.cjs
```

Later, run the frontend manifest:

```sh
node --require ./scripts/src/offline-test-guard.cjs ./scripts/src/frontend-test-runner.mjs --offline-preload "$(pwd)/scripts/src/offline-test-guard.cjs"
```

Later, run the E1 backend pure tests:

```sh
node --require ./scripts/src/offline-test-guard.cjs ./scripts/src/offline-test-runner.mjs
```

The root tsconfig is a solution file. Do not use `tsc -p tsconfig.json --noEmit`
as a complete workspace check: it can succeed without checking referenced packages.

Run the canonical full static check separately, with a clean environment:

```sh
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test pnpm run typecheck
```

This static checker does not run application code. Unlike the test commands above,
this package-manager command does not claim the network-denial preload; its
subprocesses include the repository's reviewed typecheck runner and TypeScript.

The test launchers pass only `PATH`, `HOME`, and `NODE_ENV=test` to test children.
Both invoke Node's native test runner with the absolute `tsx` package loader
resolved from `scripts/package.json`; they do not start the tsx CLI or its IPC
server. The frontend child also receives only its explicit
`TSX_TSCONFIG_PATH=tsconfig.render-tests.json` transform setting.
The backend runner additionally passes the fixed, non-secret module-load sentinel
`postgresql://e1-offline.invalid:9/forbidden`. The guard removes every other
database/Postgres credential and `NODE_OPTIONS` from each permitted Node,
esbuild, or worker child. Even the sentinel cannot connect because all socket and
DNS paths are synchronously disabled. The guard emits no per-test marker; the
single `E1_OFFLINE_GUARD_ACTIVE=1` marker is reserved for the self-check.