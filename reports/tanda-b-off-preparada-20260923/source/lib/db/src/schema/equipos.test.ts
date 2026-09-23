import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect, getTableConfig } from "drizzle-orm/pg-core";
import {
  CHECKLIST_KEYS_EQUIPO,
  TIPOS_EQUIPO,
} from "../lib/equipos-catalog";
import { equiposChecklistTable, equiposTable } from "./equipos";

const dialect = new PgDialect();

function compiledCheck(table: Parameters<typeof getTableConfig>[0], name: string) {
  const check = getTableConfig(table).checks.find((item) => item.name === name);
  assert.ok(check, `Missing check ${name}`);
  return dialect.sqlToQuery(check.value);
}

test("equipment catalog checks compile as parameter-free DDL fragments", () => {
  const typeCheck = compiledCheck(equiposTable, "equipos_tipo_check");
  const checklistCheck = compiledCheck(
    equiposChecklistTable,
    "equipos_checklist_item_key_check",
  );

  assert.deepEqual(typeCheck.params, []);
  assert.deepEqual(checklistCheck.params, []);
  assert.doesNotMatch(typeCheck.sql, /\$\d+/);
  assert.doesNotMatch(checklistCheck.sql, /\$\d+/);

  for (const type of TIPOS_EQUIPO) {
    assert.match(typeCheck.sql, new RegExp(`'${type}'`));
  }
  for (const key of CHECKLIST_KEYS_EQUIPO) {
    assert.match(checklistCheck.sql, new RegExp(`'${key}'`));
  }
});