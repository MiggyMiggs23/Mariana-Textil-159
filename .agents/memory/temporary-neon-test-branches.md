---
name: Temporary Neon test branches
description: How to prepare disposable Neon branches for the isolated API test suites.
---

The Neon project used for isolated tests may not mirror the application’s development database schema. For database tests, create a disposable branch, reset only that branch’s `public` schema, then run the repository schema push and development seed before setting `TEST_DATABASE_URL`.

**Why:** A branch inherited a stale partial schema, so tests could not find current POS tables and schema push required an interactive truncation prompt.

**How to apply:** Never run database tests against the app database. Use a temporary branch, prepare it with the current schema and seed, run tests with `TEST_DATABASE_URL`, and delete the branch after the suite finishes.