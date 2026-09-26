import assert from "node:assert/strict";
import crypto from "node:crypto";
import { launch, recorder, session, credentials, origin, readState, persist, api } from "./runtime.mjs";
const decisionRecovery = process.env.PRIORITY_DECISION_RECOVERY === "1";
const weekRecovery = process.env.PRIORITY_WEEK_RECOVERY === "1";
const b = await launch(), r = recorder(weekRecovery ? "v8-week-uncertain-recovery" : decisionRecovery ? "v8-confirmed-decision-recovery" : process.env.PRIORITY_ACK === "1" ? "v8-confirmed-snapshot-recovery" : process.env.PRIORITY_V8 === "1" ? "v8-reads-and-exact-recovery" : "observed-reads-and-explicit-recovery"), state = readState();
const journal = weekRecovery ? (state.weekSnapshotRecovery ??= {}) : decisionRecovery ? (state.confirmedDecisionRecovery ??= {}) : process.env.PRIORITY_ACK === "1" ? (state.confirmedSnapshotRecovery ??= {}) : state;
try {
  const admin = await session(b, credentials.admin, "OBSERVED-ADMIN", r);
  for (const [route, endpoint] of [
    ["/precios", "/api/precios"],
    [`/clientes/${state.client.id}`, `/api/clientes/${state.client.id}/comportamiento-pago`],
    ["/contabilidad/fiscal", "/api/auth/me"],
  ]) await r.check("observed-read-" + endpoint.replaceAll("/", "-"), async () => {
    await admin.goto(origin + route); const d = await api(admin, endpoint);
    r.data.checks.at(-1).response = d; r.save(); assert.equal(d.status, 200);
    return { status: d.status };
  }, [admin]);
  await r.check("explicit-original-snapshot-recovery", async () => {
    const uuid = weekRecovery ? state.operations["observed-SEMANA-ACEPTADA-snapshot"].requestBody.uuid : decisionRecovery ? state.operations["observed-DIA-NO_CUADRA-decision"].requestBody.uuid : process.env.PRIORITY_ACK === "1" ? state.operations["observed-DIA-NO_CUADRA-snapshot"].body.uuid : "b2548914-0933-4a8f-a67d-b925b0a8df68";
    const action = decisionRecovery ? "DECISION" : "SNAPSHOT";
    const terminal = process.env.PRIORITY_ACK === "1" ? "CONFIRMADA" : "CERRADA_SIN_EFECTO";
    const path = `/api/e11/operaciones/${state.roles.F.id}/${action}/${uuid}`;
    const identity = await api(admin, "/api/e11/identidad");
    assert.equal(identity.status, 200); assert.equal(identity.body.rolBase, "ADMIN"); assert.equal(identity.body.perfil, null);
    assert.ok(identity.body.capacidades.includes("FISCAL_LEER"));
    const before = await api(admin, path); r.data.checks.at(-1).before = before; r.save(); assert.equal(before.status, 200);
    assert.equal(before.body.uuidOriginal, uuid); assert.equal(before.body.actorId, state.roles.F.id);
    if (before.body.estado === terminal && before.body.resolucionId) {
      journal.originalSnapshotResolution = before.body; persist(state); return before;
    }
    assert.equal(before.body.estado, process.env.PRIORITY_ACK === "1" ? "CONFIRMADA" : "PENDIENTE");
    assert.ok(!journal.originalSnapshotResolver || process.env.PRIORITY_V8 === "1", "Exact retry only authorized for v8 repair.");
    const body = journal.originalSnapshotResolver?.body ?? { uuid: crypto.randomUUID(), revisionEsperada: before.body.revision, identidadVersion: identity.body.permisosVersion, motivo: "Resolver intención original de snapshot DAY 2026-09-25. Verificar evidencia autoritativa bajo bloqueo; confirmar resultado existente o cerrar sin efecto sólo si servidor confirma ausencia. Nunca reenviar snapshot." };
    assert.equal(body.identidadVersion, identity.body.permisosVersion);
    assert.equal(body.revisionEsperada, before.body.revision);
    journal.originalSnapshotResolver ??= { path, body, status: "UNCERTAIN" };
    journal.originalSnapshotResolver.attempts ??= [];
    journal.originalSnapshotResolver.attempts.push({ at: new Date().toISOString(), priorResponse: journal.originalSnapshotResolver.response }); persist(state);
    const result = await admin.evaluate(async ({ path, body }) => {
      const response = await fetch(path + "/resolucion", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    }, { path, body });
    journal.originalSnapshotResolver.response = result; persist(state);
    r.data.checks.at(-1).resolverResponse = result; r.save();
    const after = await api(admin, path); r.data.checks.at(-1).after = after; r.save();
    assert.equal(after.status, 200); assert.equal(after.body.estado, terminal); assert.ok(after.body.resolucionId);
    assert.equal(after.body.uuidOriginal, uuid); assert.equal(after.body.actorId, state.roles.F.id); assert.equal(after.body.accion, action);
    journal.originalSnapshotResolution = after.body; journal.originalSnapshotResolver.status = "ACK"; persist(state);
    return { resolution: after.body, originalSnapshotNeverReplayed: true };
  }, [admin]);
} catch (e) { await r.check("setup", async () => { throw e; }); }
finally { await b.close(); await r.finish(); }