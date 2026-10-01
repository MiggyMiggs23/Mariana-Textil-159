import assert from "node:assert/strict";
import path from "node:path";

export async function login(browser, origin, username, password) {
  const context = await browser.newContext({ viewport:{width:1440,height:1050}, ignoreHTTPSErrors:true });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const requests = [], errors = [];
  let headers = {};
  page.on("response", r => {
    const u = new URL(r.url());
    if(u.pathname.startsWith("/api/")) requests.push({path:u.pathname+u.search,status:r.status()});
  });
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(origin+"/login");
  await page.getByLabel("Usuario",{exact:true}).fill(username);
  await page.getByLabel("Contraseña",{exact:true}).fill(password);
  const response = page.waitForResponse(r => new URL(r.url()).pathname==="/api/auth/login");
  await page.getByRole("button",{name:"Ingresar",exact:true}).click();
  const r = await response;
  assert.equal(r.status(),200,`Login ${username}`);
  await page.waitForURL(u => !u.pathname.includes("/login"));
  // Use the exact authenticated request, like benchmark-main.mjs; do not
  // assume a login JSON token field or a cookie-only transport.
  // Reload forces a real auth/me request instead of login's cached user DTO.
  const meResponse = page.waitForResponse(r =>
    new URL(r.url()).pathname==="/api/auth/me" && r.status()===200);
  await page.reload({waitUntil:"domcontentloaded"});
  const authenticated = await meResponse;
  const sent = await authenticated.request().allHeaders();
  headers = Object.fromEntries(Object.entries(sent).filter(([k]) =>
    k==="authorization" || k==="cookie" || k.startsWith("x-")));
  assert.ok(headers.authorization || headers.cookie,"Successful browser auth/me must carry real credentials");
  const api = async(method,url,body) => {
    const r = await context.request.fetch(origin+url,{method,headers,...(body?{data:body}:{}),maxRedirects:0});
    const text = await r.text();
    let parsed; try { parsed=JSON.parse(text); } catch { parsed=text; }
    return {method,path:url,status:r.status(),body:parsed};
  };
  assert.equal((await api("GET","/api/auth/me")).status,200,"Authenticated browser-derived API session");
  return {context,page,api,requests,errors};
}

export async function exercise({browser,origin,actor,password,fixture,out,attempt}) {
  const session = await login(browser,origin,actor.username,password);
  const {page,api,requests,errors} = session;
  const evidence = {id:`${actor.family}:${actor.role}:${actor.variant}`,attempt,actorId:actor.id,role:actor.role,
    family:actor.family,variant:actor.variant,checks:[],requests,errors};
  try {
    const me = await api("GET","/api/auth/me");
    evidence.effectivePermissions = me.body.permisos;
    assert.equal(me.body.id,actor.id);
    assert.equal(me.body.rol,actor.role);
    for (const module of actor.family==="e5" ? ["caja_abonos","clientes_finanzas"] : ["ajustes","inventario","movimientos"]) {
      const expected = actor.matrix.find(p=>p.modulo===module);
      const effective = me.body.permisos.find(p=>p.modulo===module);
      assert.ok(expected && effective, `Effective permission ${module}`);
      assert.equal(effective.puedeVer,actor.role==="CONTADOR"?false:expected.puede_ver,
        "CONTADOR legacy permissions are suppressed by E11, not proof of inner cell");
    }
    if(actor.family==="e5") {
      const allowedRole = ["TERMINAL","CAJA","SUPERVISOR"].includes(actor.role);
      const allowed = allowedRole && actor.variant!=="off";
      evidence.classification = allowedRole ? "COMPOUND_PERMISSION_DIFFERENTIAL" : "OUTER_ROLE_DENIAL_NOT_INNER_PERMISSION_COVERAGE";
      const urls = [
        `/api/e5/disponibilidad?ubicacionId=${fixture.site}`,
        `/api/e5/cobros?ubicacionId=${fixture.site}&clienteId=${fixture.client}`,
        `/api/e5/contexto?ubicacionId=${fixture.site}&clienteId=${fixture.client}`,
        `/api/e5/cobros/${fixture.cobro}`,
      ];
      for(const url of urls) {
        const result = await api("GET",url); evidence.checks.push(result);
        assert.equal(result.status,allowed?200:403,`${evidence.id} ${url}`);
        if(allowed && actor.role==="SUPERVISOR"){
          // Frozen API app middleware applies recursive nonfinancial projection
          // after route output validation, independently of the E5 read gate.
          const forbidden=["importe","monto","formapago","costo","precio","saldo","limitecredito","diascredito","creditodisponible"];
          const walk=(value)=>{
            if(!value||typeof value!=="object")return;
            for(const [key,nested] of Object.entries(value)){
              const normalized=key.replace(/[_\-\s]/g,"").toLowerCase();
              assert.ok(!forbidden.some(k=>normalized.includes(k)),`SUPERVISOR sensitive field must be absent: ${key}`);
              walk(nested);
            }
          };
          walk(result.body);
          evidence.economicProjection="SUPERVISOR recursive financial-field omission asserted separately from unchanged 200/403 permission checks";
        }
        if(!allowed) assert.match(JSON.stringify(result.body),/E5_FORBIDDEN|NO_AUTORIZADO|NO_PERMITIDO|PERMISO|perfil|permiso|E11/i);
        else if(url.includes("/cobros?")) assert.ok(result.body.items.some(c=>c.id===fixture.cobro),"Real fixture listed");
        else if(url.endsWith(fixture.cobro)) {
          assert.equal(result.body.id,fixture.cobro);
          assert.equal(result.body.clienteId,fixture.client);
          assert.equal(result.body.ubicacionId,fixture.site);
          assert.equal(result.body.estado,"PENDIENTE");
          assert.equal(result.body.clienteNombre,"Permission nine disposable");
          assert.ok(result.body.notasIndicadas.some(n=>n.notaId===fixture.ticket));
          if(actor.role==="SUPERVISOR"){
            for(const key of ["importePendiente","importeRecibido","importeAplicado","importeDevuelto","formaPago"])
              assert.equal(Object.hasOwn(result.body,key),false,`Projected detail must omit ${key}`);
            for(const key of ["puedeRecibir","puedePreparar","puedeAutorizar","puedeRechazar","puedeDevolver","puedeImprimir"])
              assert.equal(result.body.capacidades[key],false,`Read-only actor must not gain ${key}`);
          }else assert.equal(result.body.importePendiente,"10.00");
        } else if(url.includes("disponibilidad")) assert.equal(result.body.enabled,true);
        else assert.equal(result.body.clienteId,fixture.client);
      }
      await page.goto(origin+"/cobros");
      if(actor.role==="CONTADOR") {
        await page.getByRole("heading",{name:/Contabilidad/}).waitFor();
        assert.equal(await page.getByRole("link",{name:"Abrir bandeja de pendientes",exact:true}).count(),0);
      } else {
        await page.getByRole("button",{name:"Caja operativa",exact:true}).waitFor();
        const cartera=page.getByRole("button",{name:"Cartera / Estado de cuenta",exact:true});
        evidence.cobrosParentGate={
          financeRead:actor.variant==="or",
          carteraNavigationPresent:await cartera.count()>0,
          meaning:"E5Entry is in CarteraContent, not default Caja operativa. Cartera has an additional clientes_finanzas.ver gate.",
        };
        assert.equal(evidence.cobrosParentGate.carteraNavigationPresent,actor.variant==="or");
        assert.equal(await page.getByRole("link",{name:"Abrir bandeja de pendientes",exact:true}).count(),0,
          "Default operational tab does not mount E5Entry");
        if(actor.variant==="or"){
          await cartera.click();
          if(allowed)await page.getByRole("link",{name:"Abrir bandeja de pendientes",exact:true}).waitFor();
          else await page.getByText(/Sin permiso efectivo de consulta E5/).waitFor();
        }
      }
      await page.screenshot({path:path.join(out,`${actor.family}-${actor.role}-${actor.variant}-${attempt}-entry.png`),fullPage:true});
      // caja_abonos-only readers cannot enter Cartera through its finance gate.
      // The released dedicated pending route is the legitimate compound-read
      // surface and mounts the same E5Boundary / E5EntryBody without that gate.
      evidence.uiSurface="Dedicated /cobros/pendientes route; negative permission variant is ProtectedRoute denial, not a mounted E5Entry denial";
      if(allowed) {
        if(actor.variant==="or")await page.getByRole("link",{name:"Abrir bandeja de pendientes",exact:true}).click();
        else await page.goto(origin+"/cobros/pendientes");
        await page.getByRole("heading",{name:"Cobros pendientes de aplicación",exact:true}).waitFor();
        await page.getByRole("link",{name:"Abrir bandeja de pendientes",exact:true}).waitFor();
        await page.screenshot({path:path.join(out,`${actor.family}-${actor.role}-${actor.variant}-${attempt}-pending.png`),fullPage:true});
        await page.locator(`a[href="/cobros/pendientes/${fixture.cobro}"]`).first().waitFor();
        await page.locator(`a[href="/cobros/pendientes/${fixture.cobro}"]`).first().click();
        await page.waitForURL(`**/cobros/pendientes/${fixture.cobro}`);
        await page.getByText("Permission nine disposable",{exact:false}).first().waitFor();
      } else {
        await page.goto(origin+`/cobros/pendientes/${fixture.cobro}`);
        await page.locator("body").filter({hasText:/Sin acceso|Sin permiso|perfil no puede|Contabilidad/}).waitFor();
      }
    } else {
      // These APIs deliberately do NOT use ajustes.ver. Compare identical
      // dependent readers rather than inventing a nonexistent exact API gate.
      evidence.classification = actor.role==="CONTADOR" ? "E11_OUTER_UI_BOUNDARY_NOT_INNER_PERMISSION_COVERAGE" : "UI_PERMISSION_DIFFERENTIAL_API_DEPENDENCIES_CONSTANT";
      for(const url of [
        `/api/inventario/rollos?ubicacionId=${fixture.site}&page=1&pageSize=5`,
        `/api/inventario/movimientos/${fixture.movement}`,
        "/api/inventario/ajustes/pendientes",
      ]) {
        const result = await api("GET",url);
        if(actor.role==="CONTADOR"){
          // Preserve original HTTP evidence; only the per-request correlation
          // identifier is excluded from this role's paired-body comparison.
          (evidence.rawDependentChecks ??= []).push(structuredClone(result));
          assert.ok(result.body && typeof result.body==="object" && !Array.isArray(result.body));
          assert.equal(typeof result.body.requestId,"string","Expected E11 response correlation ID");
          (evidence.requestCorrelations ??= []).push({path:url,requestId:result.body.requestId});
          const body={...result.body};
          delete body.requestId;
          evidence.checks.push({...result,body});
        }else evidence.checks.push(result);
        assert.equal(result.status,actor.role==="CONTADOR"?403:200,`${evidence.id} dependent reader ${url}`);
      }
      await page.goto(origin+"/");
      if(actor.role==="CONTADOR") await page.getByRole("heading",{name:/Contabilidad/}).waitFor();
      else await page.getByText(actor.username,{exact:true}).filter({visible:true}).first().waitFor();
      const nav = page.locator('a[href="/inventario/ajustes"]');
      evidence.navigationVisible = await nav.filter({visible:true}).count()>0;
      evidence.navigationBoundary=actor.role==="TERMINAL"?"Whole sidebar excluded for TERMINAL; do not claim inner nav permission differential":
        actor.role==="CONTADOR"?"E11 outer application boundary":"Normal desktop sidebar permission gate";
      assert.equal(evidence.navigationVisible,actor.variant==="on" && actor.role==="CAJA");
      await page.screenshot({path:path.join(out,`${actor.family}-${actor.role}-${actor.variant}-${attempt}-navigation.png`),fullPage:true});
      await page.goto(origin+`/inventario/ajustes?movementId=${fixture.movement}`);
      if(actor.role==="CONTADOR") await page.getByRole("heading",{name:/Contabilidad/}).waitFor();
      else if(actor.variant==="off") await page.getByRole("heading",{name:"Sin acceso",exact:true}).waitFor();
      else {
        // movementId deliberately opens a modal. Radix hides the background
        // page from the accessibility tree until that modal is closed.
        const detail=page.getByRole("dialog",{name:`Detalle del movimiento #${fixture.movement}`,exact:true});
        await detail.waitFor();
        await detail.getByText("NINE-RUNTIME",{exact:true}).waitFor();
        await detail.getByRole("link",{name:"990000001",exact:true}).waitFor();
        evidence.movementDialog={movementId:fixture.movement,product:"NINE-RUNTIME",roll:"990000001",verified:true};
        await page.screenshot({path:path.join(out,`${actor.family}-${actor.role}-${actor.variant}-${attempt}-movement.png`),fullPage:true});
        await detail.getByRole("button",{name:"Cerrar",exact:true}).first().click();
        await page.getByRole("heading",{name:"Ajustes de Inventario",exact:true}).waitFor();
      }
      if(actor.role==="CONTADOR" || actor.variant==="off")
        assert.equal(await page.getByRole("heading",{name:"Ajustes de Inventario",exact:true}).count(),0);
    }
    evidence.finalUrl = new URL(page.url()).pathname;
    await page.screenshot({path:path.join(out,`${actor.family}-${actor.role}-${actor.variant}-${attempt}-final.png`),fullPage:true});
    assert.deepEqual(errors,[],"No browser crashes");
    evidence.status="PASS";
  } catch(error) {
    evidence.status="FAIL"; evidence.error=String(error.stack||error);
    await page.screenshot({path:path.join(out,`${actor.family}-${actor.role}-${actor.variant}-${attempt}-failure.png`),fullPage:true}).catch(()=>{});
  } finally { await session.context.close(); }
  return evidence;
}