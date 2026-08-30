---
name: Temporary Neon test branches
description: How to prepare disposable Neon branches for the isolated API test suites.
---

The Neon project used for isolated tests may not mirror the application’s development database schema. For database tests, create a disposable branch, reset only that branch’s `public` schema, then run the repository schema push and development seed before setting `TEST_DATABASE_URL`.

**Why:** A branch inherited a stale partial schema, so tests could not find current POS tables and schema push required an interactive truncation prompt.

**How to apply:** Never run database tests against the app database. Use a temporary branch, prepare it with the current schema and seed, run tests with `TEST_DATABASE_URL`, and delete the branch after the suite finishes.

The development seed must run with `NODE_ENV=development` even when its `DATABASE_URL` points to the disposable test database; switch back to `NODE_ENV=test` for the suites.

**Why:** The seed intentionally requires an admin password outside development, while isolated test preparation relies on its non-production bootstrap path.

**How to apply:** Scope `NODE_ENV=development` only to the seed command. Keep the temporary database URL explicit throughout, then run tests with `NODE_ENV=test`.

If a Neon operation's response is blocked by Replit's security scanner, do not assume it had no effect. Verify the branch/database state through the already-authorized test connection before retrying or choosing a recovery action.

**Why:** A blocked response hid a successful database drop while the following recreate step did not run, so blindly retrying the original sequence would have operated on unexpected state.

**How to apply:** Treat blocked tool output as an unknown outcome, stop, obtain user direction, inspect state through a safe independent path, and resume from the observed state.

The Neon MCP’s runtime schemas may differ from its bundled examples. Branch creation accepted only `project_id` and `parent_id`; connection lookup also required snake_case names and did not accept optional pool-selection fields.

**Why:** Repeated calls using documented camelCase, branch naming, expiration, and pooled flags were rejected before a minimal runtime-accepted call succeeded.

**How to apply:** Trust live validation over examples, begin with the minimal required snake_case arguments, and record the returned branch ID instead of assuming a requested name or expiration was applied.

Neon’s default returned connection string may use a `-pooler` host. Do not validate session-scoped advisory locks through that endpoint because backend-session affinity is not guaranteed and a lock can outlive the logical client.

**Why:** Concurrent startup appeared to bypass serialization and left a lock retained in a pooled backend; the direct endpoint produced deterministic serialization and clean unlock behavior.

**How to apply:** Use a direct Neon endpoint for tests involving session advisory locks. Use pooled connections only for transaction-scoped behavior, or explicitly prove session affinity first.