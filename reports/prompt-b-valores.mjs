#!/usr/bin/env node

/*
 * Deterministic, DB-free evidence for Prompt B's value fixes.
 *
 * This deliberately reads the TypeScript sources as text and evaluates only
 * the AST-selected expressions.  It never imports an API route (the routes
 * initialise the database).  The shared number formatter is transpiled and
 * executed in a vm context so these results use the production
 * formatNumber/toExcelNumber implementations.
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const route = "artifacts/api-server/src/routes/clientes.ts";
const alerts = "artifacts/mariana-textil/src/pages/alertas.tsx";
const badge = "artifacts/mariana-textil/src/components/cliente-nota-estado-badge.tsx";
const numberFormat = "lib/number-format/src/index.ts";

const nowSource = fs.readFileSync(path.join(root, route), "utf8");
const beforeSource = execFileSync("git", ["show", `HEAD:${route}`], {
  cwd: root,
  encoding: "utf8",
});
const nowAlerts = fs.readFileSync(path.join(root, alerts), "utf8");
const beforeAlertsSource = execFileSync("git", ["show", `HEAD:${alerts}`], {
  cwd: root,
  encoding: "utf8",
});
const badgeSource = fs.readFileSync(path.join(root, badge), "utf8");
const numberFormatSource = fs.readFileSync(path.join(root, numberFormat), "utf8");

const report = [];
const emit = (line = "") => {
  report.push(line);
};
const json = (value) => JSON.stringify(value, (_key, item) =>
  typeof item === "bigint" ? `${item}n` : item,
);
const sourceFile = (text, fileName) =>
  ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const nodeText = (text, node) => text.slice(node.getStart(), node.end);

function walk(node, visit) {
  visit(node);
  node.forEachChild((child) => walk(child, visit));
}

function findExcelMap(text, fileName) {
  const file = sourceFile(text, fileName);
  let result;
  walk(file, (node) => {
    if (result || !ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
      return;
    }
    if (node.expression.name.text !== "addRows" || node.arguments.length !== 1) return;
    const rows = node.arguments[0];
    if (!ts.isCallExpression(rows) || !ts.isPropertyAccessExpression(rows.expression)) return;
    if (rows.expression.name.text !== "map") return;
    const callback = rows.arguments[0];
    if (!callback || !ts.isArrowFunction(callback) || !callback.body || !ts.isBlock(callback.body)) return;
    const returnStatement = callback.body.statements.find((statement) => ts.isReturnStatement(statement));
    if (!returnStatement?.expression || !ts.isObjectLiteralExpression(returnStatement.expression)) return;
    result = {
      callback,
      returnObject: returnStatement.expression,
      returnStatement,
    };
  });
  if (!result) throw new Error(`No se ubicó el callback map real de sheet.addRows en ${fileName}`);
  return result;
}

function objectKeyNames(object) {
  return object.properties
    .filter((property) => ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property))
    .map((property) => {
      if (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) {
        return property.name && ts.isIdentifier(property.name) ? property.name.text : null;
      }
      return null;
    })
    .filter(Boolean);
}

function duplicateNames(names) {
  return [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
}

function transpileCommonJs(text, fileName) {
  return ts.transpileModule(text, {
    fileName,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
}

function loadNumberFormat() {
  const module = { exports: {} };
  const sandbox = { module, exports: module.exports };
  vm.runInNewContext(transpileCommonJs(numberFormatSource, numberFormat), sandbox, {
    filename: numberFormat,
  });
  return module.exports;
}

const productionNumbers = loadNumberFormat();
if (typeof productionNumbers.formatNumber !== "function" || typeof productionNumbers.toExcelNumber !== "function") {
  throw new Error("No se pudieron cargar formatNumber/toExcelNumber reales");
}

function rowEvaluator(text, fileName) {
  const selected = findExcelMap(text, fileName);
  const body = nodeText(text, selected.callback.body);
  const functionSource = `
    function __excelRow(row, projection, projectedMovements) ${body}
  `;
  const compiled = transpileCommonJs(functionSource, `${fileName}#excel-row`);
  const sandbox = {
    centsToMoney: (cents) => (Number(cents) / 100).toFixed(2),
    moneyToCents: (value) => Math.round(Number(value) * 100),
    breakdownIvaIncluded: (cents) => ({ subtotalCents: cents, ivaCents: 0 }),
    deriveEstadoNota: () => "PENDIENTE",
    todayMexicoCity: () => "2026-01-01",
    toExcelNumber: productionNumbers.toExcelNumber,
    console,
  };
  vm.runInNewContext(`${compiled}\nthis.__excelRow = __excelRow;`, sandbox, {
    filename: `${fileName}#excel-row`,
  });
  return {
    evaluate: sandbox.__excelRow,
    object: selected.returnObject,
    objectKeys: objectKeyNames(selected.returnObject),
    objectSource: nodeText(text, selected.returnObject),
    callbackSource: body,
  };
}

function evaluateExpression(text, expression, fileName, extra = {}) {
  const expressionSource = nodeText(text, expression);
  const compiled = transpileCommonJs(
    `function __expression(credito) { return ${expressionSource}; }`,
    `${fileName}#expression`,
  );
  const sandbox = {
    formatNumber: productionNumbers.formatNumber,
    console,
    ...extra,
  };
  vm.runInNewContext(`${compiled}\nthis.__expression = __expression;`, sandbox, {
    filename: `${fileName}#expression`,
  });
  return {
    source: expressionSource,
    evaluate: sandbox.__expression,
  };
}

function findAlertExpressions(text, fileName) {
  const file = sourceFile(text, fileName);
  let saldoExpression;
  let moneyExpression;
  walk(file, (node) => {
    if (ts.isJsxAttribute(node) && node.name.text === "saldoPendiente") {
      if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        saldoExpression = node.initializer.expression;
      }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "formatNumber" &&
      node.arguments.length >= 1 &&
      ts.isPropertyAccessExpression(node.arguments[0]) &&
      ts.isIdentifier(node.arguments[0].expression) &&
      node.arguments[0].expression.text === "credito"
    ) {
      moneyExpression = node;
    }
  });
  if (!saldoExpression || !moneyExpression) {
    throw new Error(`No se ubicaron expresiones JSX reales de crédito en ${fileName}`);
  }
  return {
    saldo: evaluateExpression(text, saldoExpression, fileName),
    money: evaluateExpression(text, moneyExpression, fileName),
  };
}

function findBadgeDetails(text, fileName) {
  const file = sourceFile(text, fileName);
  let declaration;
  walk(file, (node) => {
    if (declaration || !ts.isFunctionDeclaration(node) || node.name?.text !== "ClienteNotaEstadoBadge") return;
    declaration = node;
  });
  if (!declaration?.body || declaration.parameters.length !== 1) {
    throw new Error("No se ubicó la función real ClienteNotaEstadoBadge");
  }
  const parameter = declaration.parameters[0].name;
  if (!ts.isObjectBindingPattern(parameter)) throw new Error("El badge no usa destructuring esperado");
  const names = parameter.elements
    .filter((element) => ts.isBindingElement(element) && ts.isIdentifier(element.name))
    .map((element) => element.name.text);
  const bodySource = nodeText(text, declaration.body);
  return { names, bodySource };
}

const beforeExcel = rowEvaluator(beforeSource, `HEAD:${route}`);
const afterExcel = rowEvaluator(nowSource, route);

const row = {
  id: "7",
  fecha: "2026-01-01",
  tipo: "VENTA_CREDITO",
  importe: "123.45",
  fechaVencimiento: "2026-01-01",
  formaPago: "CREDITO",
  referencia: null,
  folio: null,
  usuario: "synthetic",
  saldoCorridoHistorico: "0",
};
const projection = {
  allCharges: [{ movimientoId: 7, pendienteCents: 12345, originalCents: 12345, dueAt: "2026-01-01" }],
  balanceCents: 12345,
  overpaymentCents: 0,
};
const projectedMovements = new Map();
const beforeValue = beforeExcel.evaluate(row, projection, projectedMovements);
const afterValue = afterExcel.evaluate(row, projection, projectedMovements);
const beforeKeys = Object.keys(beforeValue);
const afterKeys = Object.keys(afterValue);

const noChargeRow = { ...row, id: "8", tipo: "AJUSTE", formaPago: "CONTADO", importe: "0" };
const noChargeProjection = { ...projection, allCharges: [] };
const nullBeforeValue = beforeExcel.evaluate(noChargeRow, noChargeProjection, new Map());
const nullAfterValue = afterExcel.evaluate(noChargeRow, noChargeProjection, new Map());

const beforeAlertExpressions = findAlertExpressions(beforeAlertsSource, `HEAD:${alerts}`);
const afterAlertExpressions = findAlertExpressions(nowAlerts, alerts);
const credito = { importe: "123.45", pendiente: undefined };
const beforeSaldoProp = beforeAlertExpressions.saldo.evaluate(credito);
const afterSaldoProp = afterAlertExpressions.saldo.evaluate(credito);
const beforeVisibleAmount = beforeAlertExpressions.money.evaluate(credito);
const afterVisibleAmount = afterAlertExpressions.money.evaluate(credito);

const badgeDetails = findBadgeDetails(badgeSource, badge);
const badgeIgnoresSaldo =
  !badgeDetails.names.includes("saldoPendiente") &&
  !/\bsaldoPendiente\b/.test(badgeDetails.bodySource);

emit("Prompt B — evidencia de valores (AST + Node vm, sin DB)");
emit("Comando ejecutado: node reports/prompt-b-valores.mjs");
emit("Fuentes comparadas: git show HEAD:artifacts/api-server/src/routes/clientes.ts vs archivo actual; git show HEAD:artifacts/mariana-textil/src/pages/alertas.tsx vs archivo actual.");
emit("Datos: exclusivamente sintéticos; no se importó ningún route ni se hicieron conexiones de red/DB.");
emit("");
emit("1) Excel: retorno REAL de sheet.addRows(result.rows.map(...))");
emit(`   AST objeto retorno antes: ${beforeExcel.objectSource.replace(/\s+/g, " ").trim()}`);
emit(`   AST objeto retorno actual: ${afterExcel.objectSource.replace(/\s+/g, " ").trim()}`);
emit(`   Keys AST saldoPendiente antes: ${beforeExcel.objectKeys.filter((key) => key === "saldoPendiente").length}; actual: ${afterExcel.objectKeys.filter((key) => key === "saldoPendiente").length}.`);
emit(`   Duplicados AST antes: ${json(duplicateNames(beforeExcel.objectKeys))}; actual: ${json(duplicateNames(afterExcel.objectKeys))}.`);
emit(`   Objeto efectivo ANTES: ${json(beforeValue)}`);
emit(`   Objeto efectivo DESPUÉS: ${json(afterValue)}`);
emit(`   Keys efectivos ANTES (${beforeKeys.length}): ${json(beforeKeys)}`);
emit(`   Keys efectivos DESPUÉS (${afterKeys.length}): ${json(afterKeys)}`);
emit(`   Igualdad profunda efectiva: ${json(JSON.stringify(beforeValue) === JSON.stringify(afterValue))}`);
emit(`   tipos/celdas: importe=${typeof afterValue.importe}(${afterValue.importe}), saldoCorridoHistorico=${typeof afterValue.saldoCorridoHistorico}(${afterValue.saldoCorridoHistorico}), saldoPendiente=${typeof afterValue.saldoPendiente}(${afterValue.saldoPendiente}), saldoDeudorProyectado=${afterValue.saldoDeudorProyectado === null ? "null" : typeof afterValue.saldoDeudorProyectado}, saldoAFavorProyectado=${afterValue.saldoAFavorProyectado === null ? "null" : typeof afterValue.saldoAFavorProyectado}.`);
emit(`   Conservación de valores sintéticos: ${json(afterValue.importe === 123.45 && afterValue.saldoCorridoHistorico === 0 && afterValue.saldoPendiente === 123.45 && afterValue.saldoDeudorProyectado === null && afterValue.saldoAFavorProyectado === null)}`);
emit(`   Caso null efectivo ANTES: ${json(nullBeforeValue)}`);
emit(`   Caso null efectivo DESPUÉS: ${json(nullAfterValue)}`);
emit(`   Conservación null + igualdad: ${json(nullBeforeValue.saldoPendiente === null && nullAfterValue.saldoPendiente === null && JSON.stringify(nullBeforeValue) === JSON.stringify(nullAfterValue))}`);
emit("");
emit("2) Alertas: expresiones JSX REALES ubicadas por AST");
emit(`   Prop saldoPendiente antes: ${beforeAlertExpressions.saldo.source}`);
emit(`   Prop saldoPendiente actual: ${afterAlertExpressions.saldo.source}`);
emit(`   Prop evaluada antes con credito={importe:"123.45", pendiente:undefined}: ${json(beforeSaldoProp)}`);
emit(`   Prop evaluada actual con credito={importe:"123.45", pendiente:undefined}: ${json(afterSaldoProp)}`);
emit(`   formatNumber real antes: ${beforeAlertExpressions.money.source}`);
emit(`   formatNumber real actual: ${afterAlertExpressions.money.source}`);
emit(`   Visible formatNumber antes (undefined): ${json(beforeVisibleAmount)}`);
emit(`   Visible formatNumber actual (importe 123.45): ${json(afterVisibleAmount)}`);
emit(`   Cambio visible demostrado: ${json(beforeVisibleAmount !== afterVisibleAmount && beforeVisibleAmount === "—" && afterVisibleAmount === "$123.45")}`);
emit("");
emit("3) Badge");
emit(`   Destructuring real de ClienteNotaEstadoBadge: ${json(badgeDetails.names)}`);
emit(`   Ignora saldoPendiente (no se destructura ni se lee en el cuerpo): ${json(badgeIgnoresSaldo)}`);
emit("   Conclusión: cambiar solo ese prop no cambia el badge; el badge presenta estadoNota/id/className.");

const checks = [
  JSON.stringify(beforeValue) === JSON.stringify(afterValue),
  duplicateNames(afterExcel.objectKeys).length === 0,
  afterExcel.objectKeys.filter((key) => key === "saldoPendiente").length === 1,
  afterValue.importe === 123.45 && afterValue.saldoCorridoHistorico === 0,
  afterValue.saldoPendiente === 123.45 &&
    afterValue.saldoDeudorProyectado === null &&
    afterValue.saldoAFavorProyectado === null,
  JSON.stringify(nullBeforeValue) === JSON.stringify(nullAfterValue) &&
    nullAfterValue.saldoPendiente === null,
  beforeVisibleAmount === "—" && afterVisibleAmount === "$123.45",
  badgeIgnoresSaldo,
];
emit("");
emit(`RESULTADO: ${checks.every(Boolean) ? "PASS" : "FAIL"} (${checks.filter(Boolean).length}/${checks.length} comprobaciones)`);
if (!checks.every(Boolean)) process.exitCode = 1;
process.stdout.write(`${report.join("\n")}\n`);