import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Invoked only inside rehearse.mjs after the startup preservation comparison.
// All actors are synthetic; no operational rows are loaded.
export async function exerciseE3({ sql, evidence, packageDir }) {
  const results = { status: "FAIL", cases: [], mutations: [] };
  const save = () => fs.writeFileSync(path.join(evidence, "integration-cash.json"), JSON.stringify(results, null, 2) + "\n");
  const roles = ["ADMIN", "SUPERVISOR", "CAJA", "TERMINAL", "CONTADOR", "SISTEMAS", "BODEGA"];
  const actors = Object.fromEntries(roles.map((rol, i) => [rol, { id: 810001 + i, session: randomUUID() }]));
  const tableHash = () => sql(`SELECT jsonb_build_object(
    'movimientos',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM movimientos_credito t),
    'operaciones',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY productor,clave),'[]') FROM operaciones_credito_e1 t),
    'recibos',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY folio),'[]') FROM recibos_abono_e3 t),
    'aplicaciones',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM aplicaciones_credito t),
    'folio',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY sitio_id),'[]') FROM recibo_folio_e3 t));`);
  const request = async (rol, endpoint, body) => {
    const response = await fetch(`http://127.0.0.1:18093/api${endpoint}`, {
      method: "POST", headers: { "Content-Type": "application/json", Cookie: `mariana_session=${actors[rol].session}` },
      body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    let data; try { data = JSON.parse(text); } catch { data = { text }; }
    return { status: response.status, data };
  };
  const cash = () => ({ operacionClave: randomUUID(), clienteId: 810001, importeCentavos: 1250,
    formaPago: "EFECTIVO", cuentaDestino: "CAJA_FISICA", sitioId: 810001, sesionCajaId: 810001 });
  const recap = () => ({ ...cash(), sesionCajaId: null, motivo: "Recaptura sintética de ensayo aislado",
    fechaRecepcion: new Date(Date.now() - 60000).toISOString() });
  const base = "/caja/abonos-e3";
  const rec = "/clientes/810001/recapturas-e3";
  const preview = async (rol, route, input) => {
    const r = await request(rol, route + "/vista-previa", input);
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(typeof r.data.previewToken, "string");
    return { ...input, previewToken: r.data.previewToken };
  };
  const grant = rol => sql(`INSERT INTO permisos_usuario(usuario_id,modulo,puede_crear)
    VALUES (${actors[rol].id},'clientes_recapturas',true)
    ON CONFLICT(usuario_id,modulo) DO UPDATE SET puede_crear=true;`);
  try {
    sql(`INSERT INTO ubicaciones(id,nombre,tipo,iniciales) VALUES(810001,'Sitio sintético E3','TIENDA','ZZZ');
      INSERT INTO clientes(id,nombre) VALUES(810001,'Cliente sintético E3');`);
    for (const rol of roles) {
      const { id, session } = actors[rol];
      sql(`INSERT INTO usuarios(id,nombre,usuario,password_hash,rol,ubicacion_id)
        VALUES(${id},'Actor sintético ${rol}','ensayo-e3-${rol}','NOT_A_LOGIN_PASSWORD','${rol}',810001);
        INSERT INTO sesiones(id,usuario_id,expira_at,ip,user_agent)
        VALUES('${session}',${id},now()+interval '1 hour','127.0.0.1','E3 disposable rehearsal');`);
    }
    sql(`INSERT INTO sesiones_caja(id,ubicacion_id,usuario_id,fondo_inicial,fecha_operativa)
      VALUES(810001,810001,810001,0,current_date);`);

    // Defect: restore the obsolete CLOSED cash SQL guard, then run the success assertion.
    sql(fs.readFileSync(path.join(packageDir, "sql/04-restore-cash-gate.REHEARSAL-ONLY.sql"), "utf8"));
    const redInput = await preview("ADMIN", base, cash());
    const redBefore = tableHash();
    const red = await request("ADMIN", base, redInput);
    assert.notEqual(red.status, 201, "Closed cash mutant unexpectedly accepted");
    assert.deepEqual(tableHash(), redBefore, "Failed cash mutant left partial financial records");
    results.mutations.push({ defect: "ordinary SQL cash guard restored CLOSED", expectedSuccessAssertionFailed: true,
      response: red, atomicRollback: true });
    save();
    sql(fs.readFileSync(path.join(packageDir, "sql/03-prepare-ordinary-cash-gate-retirement.REHEARSAL-ONLY.sql"), "utf8"));
    const goodInput = await preview("ADMIN", base, cash());
    const good = await request("ADMIN", base, goodInput);
    assert.equal(good.status, 201, JSON.stringify(good));
    assert.equal(good.data.replay, false);
    assert.equal(good.data.recibo.sesionCajaId, 810001);
    const movement = Number(good.data.recibo.movimientoId);
    assert(Number.isInteger(movement) && movement > 0);
    const joined = JSON.parse(sql(`SELECT row_to_json(t) FROM (
      SELECT m.naturaleza,m.operacion_productor,m.sesion_caja_id,m.importe::text,
        o.clave::text, r.folio, m.id FROM movimientos_credito m
      JOIN operaciones_credito_e1 o ON o.productor=m.operacion_productor AND o.clave=m.operacion_clave
      JOIN recibos_abono_e3 r ON r.movimiento_id=m.id WHERE m.id=${movement}) t;`));
    assert.equal(joined.naturaleza, "INGRESO_FISICO");
    assert.equal(joined.operacion_productor, "ABONO_ORDINARIO");
    assert.equal(joined.sesion_caja_id, 810001);
    assert.equal(Number(joined.importe), -12.5);
    const beforeReplay = tableHash();
    const replay = await request("ADMIN", base, goodInput);
    assert.equal(replay.status, 201, JSON.stringify(replay));
    assert.equal(replay.data.replay, true);
    assert.deepEqual(tableHash(), beforeReplay);
    results.cases.push({ case: "ordinary cash HTTP preview/confirm + persisted FK chain + idempotent replay", passed: true, joined });
    save();

    for (const rol of roles.filter(r => r !== "ADMIN")) {
      const denied = await request(rol, rec + "/vista-previa", recap());
      assert.equal(denied.status, 403, `${rol}: ${JSON.stringify(denied)}`);
    }
    // Real permission mutation: a non-ADMIN default grant must turn the deny assertion red.
    grant("SUPERVISOR");
    const defaultMutant = await request("SUPERVISOR", rec + "/vista-previa", recap());
    assert.equal(defaultMutant.status, 200, JSON.stringify(defaultMutant));
    results.mutations.push({ defect: "non-ADMIN recapture granted before customization", defaultDenyAssertionFailed: true });
    sql(`DELETE FROM permisos_usuario WHERE usuario_id=${actors.SUPERVISOR.id} AND modulo='clientes_recapturas';`);
    assert.equal((await request("SUPERVISOR", rec + "/vista-previa", recap())).status, 403);
    results.cases.push({ case: "recapture defaults ADMIN only; deny assertion sensitive to custom grant", passed: true });
    for (const rol of roles) {
      if (rol !== "ADMIN") grant(rol);
      if (["CONTADOR", "SISTEMAS", "BODEGA"].includes(rol)) {
        const blocked = await request(rol, rec + "/vista-previa", recap());
        assert.equal(blocked.status, 403, `${rol}: ${JSON.stringify(blocked)}`);
        results.cases.push({ case: `${rol} excluded by E1 despite custom permission`, passed: true });
      } else {
        const data = await preview(rol, rec, recap());
        const accepted = await request(rol, rec, data);
        assert.equal(accepted.status, 201, `${rol}: ${JSON.stringify(accepted)}`);
        assert.equal(accepted.data.recibo.sesionCajaId, null);
        const nature = sql(`SELECT naturaleza::text||':'||coalesce(sesion_caja_id::text,'NULL')
          FROM movimientos_credito WHERE id=${Number(accepted.data.recibo.movimientoId)};`).trim();
        assert.equal(nature, "CORRECCION_CONTABLE:NULL");
        results.cases.push({ case: `${rol} permitted recapture produces no cash association`, passed: true });
      }
    }
    save();

    // Fail at the last write, after movement, E2 finalization and receipt insertion.
    const atomicInput = await preview("ADMIN", base, cash());
    const beforeAtomic = tableHash();
    sql(`CREATE FUNCTION public.e3_test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.accion='E3_ABONO_REGISTRADO' THEN RAISE EXCEPTION 'E3_ATOMIC_DEFECT'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER e3_test_fail_audit BEFORE INSERT ON public.auditoria
      FOR EACH ROW EXECUTE FUNCTION public.e3_test_fail_audit();`);
    const atomic = await request("ADMIN", base, atomicInput);
    assert.notEqual(atomic.status, 201);
    assert.equal(tableHash(), beforeAtomic);
    sql(`DROP TRIGGER e3_test_fail_audit ON public.auditoria; DROP FUNCTION public.e3_test_fail_audit();`);
    const retry = await request("ADMIN", base, atomicInput);
    assert.equal(retry.status, 201, JSON.stringify(retry));
    results.mutations.push({ defect: "last audit INSERT fails", successAssertionFailed: true, fullFinancialRollback: true });
    results.cases.push({ case: "atomic movement/operation/allocation/receipt/folio rollback; same intent succeeds after defect removed", passed: true });
    // Exercise immutable evidence trigger and an installed FK, each inside rollback.
    const immutable = sql(`DO $$ BEGIN
      BEGIN UPDATE recibos_abono_e3 SET folio='MUTATED' WHERE movimiento_id=${movement};
        RAISE EXCEPTION 'IMMUTABILITY_NOT_ENFORCED';
      EXCEPTION WHEN raise_exception THEN
        IF SQLERRM='IMMUTABILITY_NOT_ENFORCED' THEN RAISE; END IF;
      END;
      BEGIN INSERT INTO vistas_abono_e3(operacion_clave,token,intent_hash,actor_id,emitida_at)
        VALUES(gen_random_uuid(),repeat('a',64),repeat('b',64),2147483000,now());
        RAISE EXCEPTION 'FOREIGN_KEY_NOT_ENFORCED';
      EXCEPTION WHEN foreign_key_violation THEN NULL; END;
    END $$; SELECT 'PASS_FK_AND_IMMUTABILITY';`);
    assert.match(immutable, /PASS_FK_AND_IMMUTABILITY/);
    results.cases.push({ case: "real actor FK and receipt immutability trigger reject invalid writes", passed: true });
    results.status = "PASS";
    return results;
  } catch (error) {
    results.error = error.message;
    throw error;
  } finally { save(); }
}