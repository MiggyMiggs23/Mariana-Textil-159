import assert from "node:assert/strict";
export const routes=["/e7/disponibilidad","/e7/atribucion","/e5/cobros","/e11/identidad"];
export function assertHttpContract(mode,route,response) {
  assert.ok(["candidate","control-e2"].includes(mode),"Explicit candidate/control contract required");
  if(route==="/healthz"){assert.equal(response.status,200,"Health status");return;}
  assert.ok(routes.includes(route),"Unknown OFF probe");
  if(mode==="control-e2") {
    assert.equal(response.status,404,`Retained E2 absent route ${route}`);
    return; // Body is preserved; E2 404 format is NOT candidate gate evidence.
  }
  const expectedStatus=route==="/e7/disponibilidad"?200:403;
  assert.equal(response.status,expectedStatus,`${route} candidate status`);
  const body=JSON.parse(response.bodyText);
  if(route==="/e7/disponibilidad")assert.deepEqual(body,{enabled:false});
  if(route==="/e7/atribucion")assert.deepEqual(body,{code:"E7_DISABLED",message:"E7 no está habilitado."});
  if(route==="/e5/cobros")assert.deepEqual(body,{error:{code:"E5_DISABLED",message:"E5 no está habilitado."}});
  if(route==="/e11/identidad") {
    assert.ok(body&&typeof body==="object"&&!Array.isArray(body));
    assert.deepEqual(Object.keys(body).sort(),["code","message","requestId"].sort());
    assert.equal(body.code,"E11_DISABLED");assert.equal(body.message,"E11 no está habilitado.");
    assert.equal(typeof body.requestId,"string");
    assert.match(body.requestId,/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  }
}