---
name: Temporary Neon test branches
description: How to prepare disposable Neon branches for the isolated API test suites.
---

The Neon project used for isolated tests may not mirror the application’s development database schema. For database tests, create a disposable branch, reset only that branch’s `public` schema, then run the repository schema push and development seed before setting `TEST_DATABASE_URL`.

**Why:** A branch inherited a stale partial schema, so tests could not find current POS tables and schema push required an interactive truncation prompt.

**How to apply:** Never run database tests against the app database. Use a temporary branch, prepare it with the current schema and seed, run tests with `TEST_DATABASE_URL`, and delete the branch after the suite finishes.

If a Neon operation's response is blocked by Replit's security scanner, do not assume it had no effect. Verify the branch/database state through the already-authorized test connection before retrying or choosing a recovery action.

**Why:** A blocked response hid a successful database drop while the following recreate step did not run, so blindly retrying the original sequence would have operated on unexpected state.

**How to apply:** Treat blocked tool output as an unknown outcome, stop, obtain user direction, inspect state through a safe independent path, and resume from the observed state.