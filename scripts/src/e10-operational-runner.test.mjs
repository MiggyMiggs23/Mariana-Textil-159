import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolve } from "node:path";
import {
  assertPermitBoundary,
  exactBackendMatches,
  reviewFiles,
  splitExactSql,
  supervisorExitIsFailure,
  validateExactSql,
} from "./e10-operational-runner.mjs";

const ROOT = resolve(import.meta.dirname, "../..");

test("exact immutable source splits into exactly 30 byte slices", async () => {
  const source = await readFile(resolve(ROOT, "reports/e10-aislado-2026-09-18/sql/operativo.sql"), "utf8");
  const statements = validateExactSql(source);
  assert.equal(statements.length, 30);
  assert.equal(statements.join("") + source.slice(statements.join("").length), source);
  assert.match(statements.find((statement) => statement.includes("fondo_validate_movement")) ?? "", /\$\$/);
});

test("splitter protects semicolons in all PostgreSQL lexical boundaries", () => {
  const sql = `-- leading ;\nDO $tag$ BEGIN PERFORM ';'; /* ; */ END $tag$;\n`
    + `SELECT 'a;''b', "x;y"; /* outer ; /* nested ; */ done */\nCOMMIT;`;
  const statements = splitExactSql(sql);
  assert.equal(statements.length, 3);
  assert.equal(statements.join("") + sql.slice(statements.join("").length), sql);
  assert.match(statements[0], /DO \$tag\$/);
});

test("splitter rejects unterminated and delimiter-free SQL", () => {
  assert.throws(() => splitExactSql("SELECT 'broken;"), /Unterminated/);
  assert.throws(() => splitExactSql("SELECT 1"), /without semicolon/);
});

test("review is offline and reports missing or present gates without opening DB", async () => {
  const review = await reviewFiles();
  assert.equal(review.networkOrDatabaseUsed, false);
  assert.equal(review.sql.exactStatements, 30);
  assert.match(review.status, /^(WAITING_FOR_GATES|READY_FOR_MAIN_GATE_REVIEW_NOT_EXECUTION)$/);
});

test("supervisor simulation binds all five immutable backend fields", () => {
  const target = {
    pid: 42, backend_start: "2026-09-18 18:00:00+00", database_oid: "16384",
    database_role: "postgres", application_name: "e10-ddl",
  };
  assert.equal(exactBackendMatches({ ...target }, target), true);
  for (const key of ["pid", "backend_start", "database_oid", "database_role", "application_name"]) {
    const mutant = { ...target, [key]: `${target[key]}-mutant` };
    assert.equal(exactBackendMatches(mutant, target), false, key);
  }
  assert.doesNotThrow(() => assertPermitBoundary({
    armedAt: 100, now: 29_999, fired: false, target, observed: { ...target },
  }));
  assert.throws(() => assertPermitBoundary({
    armedAt: 100, now: 30_100, fired: false, target, observed: { ...target },
  }), /deadline/);
  assert.throws(() => assertPermitBoundary({
    armedAt: 100, now: 101, fired: true, target, observed: { ...target },
  }), /already fired/);
  assert.equal(supervisorExitIsFailure(false), true, "unexpected exit must fail closed");
  assert.equal(supervisorExitIsFailure(true), false, "acknowledged normal stop must not mark failure");
});