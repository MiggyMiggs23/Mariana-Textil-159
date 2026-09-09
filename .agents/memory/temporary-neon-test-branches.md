---
name: Temporary Neon test branches
description: How to prepare disposable Neon branches for the isolated API test suites.
---

The Neon project used for isolated tests may not mirror the application’s development database schema. For database tests, create a disposable branch, reset only that branch’s `public` schema, then run the repository schema push and development seed before setting `TEST_DATABASE_URL`.

**Why:** A branch inherited a stale partial schema, so tests could not find current POS tables and schema push required an interactive truncation prompt.

**How to apply:** Never run database tests against the app database. Use a temporary branch, prepare it with the current schema and seed, run tests with `TEST_DATABASE_URL`, and delete the branch after the suite finishes.

The current seed always requires its admin bootstrap secret, regardless of `NODE_ENV`. Verify that the secret is available before treating schema preparation as complete.

**Why:** Schema push succeeded but seed exited immediately for a missing bootstrap secret; the table-only database then produced misleading foreign-key failures because the expected seeded user did not exist.

**How to apply:** Check secret availability through the secure environment flow before creating the test database. Fail preparation immediately if seed fails, and never run suites against a database that only completed schema push.

If a Neon operation's response is blocked by Replit's security scanner, do not assume it had no effect. Verify the branch/database state through the already-authorized test connection before retrying or choosing a recovery action.

**Why:** A blocked response hid a successful database drop while the following recreate step did not run, so blindly retrying the original sequence would have operated on unexpected state.

**How to apply:** Treat blocked tool output as an unknown outcome, stop, obtain user direction, inspect state through a safe independent path, and resume from the observed state.

The Neon MCP’s runtime schemas may differ from its bundled examples. Branch creation accepted only `project_id` and `parent_id`; connection lookup also required snake_case names and did not accept optional pool-selection fields.

**Why:** Repeated calls using documented camelCase, branch naming, expiration, and pooled flags were rejected before a minimal runtime-accepted call succeeded.

**How to apply:** Trust live validation over examples, begin with the minimal required snake_case arguments, and record the returned branch ID instead of assuming a requested name or expiration was applied.

Neon’s default returned connection string may use a `-pooler` host. Do not validate session-scoped advisory locks through that endpoint because backend-session affinity is not guaranteed and a lock can outlive the logical client.

**Why:** Concurrent startup appeared to bypass serialization and left a lock retained in a pooled backend; the direct endpoint produced deterministic serialization and clean unlock behavior.

**How to apply:** Use a direct Neon endpoint for tests involving session advisory locks. Use pooled connections only for transaction-scoped behavior, or explicitly prove session affinity first.

Do not rely on `/tmp` files containing an isolated database URL surviving workflow restarts or being visible to background/tester runtimes.

**Why:** Workflow restarts and separate execution runtimes lost or could not read a temporary connection file, blocking an otherwise isolated browser test.

**How to apply:** Finish dependent shell suites before restarting workflows. If another runtime needs the connection, reacquire it through Neon inside that runtime; never copy credentials into the workspace.

Append-only integration suites must not share the same prepared database when their assertions depend on global counts or totals. Use one empty database per suite within the disposable branch, then delete the branch as the only cleanup boundary.

**Why:** A report suite left immutable credit evidence that changed a later Caja suite from one expected account-receivable movement to two; deleting the evidence would have violated the production append-only trigger.

**How to apply:** Prepare schema, seed, startup initializers, and `current_database()` verification independently for each suite whose fixtures cannot be rolled back. Sharing the branch is safe; sharing the database is not.

Long database suites launched synchronously through the code-execution sandbox can lose their transport while leaving the test process and pooled sessions alive. Run them as detached processes with separate log and exit-status files.

**Why:** A synchronous inventory suite disconnected twice without returning a result; the second attempt left twelve idle database sessions until they were explicitly terminated.

**How to apply:** Pass the test URL only in the detached process environment, never in command text or files. Monitor a credential-free log plus an explicit status file, and verify or terminate stale sessions before retrying.