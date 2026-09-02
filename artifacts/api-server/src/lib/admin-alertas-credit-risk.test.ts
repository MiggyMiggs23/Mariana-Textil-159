import assert from "node:assert/strict";
import test from "node:test";
import {
  CREDIT_RISK_ALERT_LEAD_DAYS,
  isCreditRiskCharge,
} from "./admin-alertas";

test("solo alerta saldos pendientes vencidos o próximos", () => {
  assert.equal(CREDIT_RISK_ALERT_LEAD_DAYS, 3);
  assert.equal(
    isCreditRiskCharge({ pendienteCents: 100, dueAt: "2026-09-04" }, "2026-09-04"),
    true,
  );
  assert.equal(
    isCreditRiskCharge({ pendienteCents: 0, dueAt: "2026-09-01" }, "2026-09-04"),
    false,
  );
  assert.equal(
    isCreditRiskCharge({ pendienteCents: 100, dueAt: "2026-09-05" }, "2026-09-04"),
    false,
  );
  assert.equal(
    isCreditRiskCharge({ pendienteCents: 100, dueAt: null }, "2026-09-04"),
    false,
  );
});