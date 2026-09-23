import test from "node:test";
import assert from "node:assert/strict";
import {routes,assertHttpContract} from "./http-off-contracts.mjs";
const response=(status,body)=>({status,bodyText:JSON.stringify(body)});
const e11={code:"E11_DISABLED",message:"E11 no está habilitado.",requestId:"12345678-1234-4234-9234-123456789abc"};
const positives=[
  ["/e7/disponibilidad",200,{enabled:false}],
  ["/e7/atribucion",403,{code:"E7_DISABLED",message:"E7 no está habilitado."}],
  ["/e5/cobros",403,{error:{code:"E5_DISABLED",message:"E5 no está habilitado."}}],
  ["/e11/identidad",403,e11],
];
for(const [route,status,body] of positives) {
  test(`candidate exact OFF contract ${route}`,()=>assertHttpContract("candidate",route,response(status,body)));
  test(`candidate ${route} rejects additional root fields`,()=>assert.throws(()=>assertHttpContract("candidate",route,response(status,{...body,extra:true}))));
  test(`candidate ${route} rejects missing route 404`,()=>assert.throws(()=>assertHttpContract("candidate",route,response(404,body))));
}
test("E7 availability rejects enabled true",()=>assert.throws(()=>assertHttpContract("candidate","/e7/disponibilidad",response(200,{enabled:true}))));
test("E7 data route rejects 200 even when body says disabled",()=>assert.throws(()=>assertHttpContract("candidate","/e7/atribucion",response(200,positives[1][2]))));
test("E5 rejects additional nested error fields",()=>assert.throws(()=>assertHttpContract("candidate","/e5/cobros",response(403,{error:{...positives[2][2].error,extra:true}}))));
test("E11 rejects malformed requestId",()=>assert.throws(()=>assertHttpContract("candidate","/e11/identidad",response(403,{...e11,requestId:"not-uuid"}))));
test("E11 rejects missing requestId",()=>{const {requestId,...rest}=e11;assert.throws(()=>assertHttpContract("candidate","/e11/identidad",response(403,rest)));});
test("candidate malformed JSON fails closed",()=>assert.throws(()=>assertHttpContract("candidate","/e7/disponibilidad",{status:200,bodyText:"not JSON"})));
test("wrong disabled code/message rejected",()=>{
  for(const [route,status,body] of positives.filter(([r])=>r!=="/e7/disponibilidad")) {
    const wrong=structuredClone(body);if(wrong.error)wrong.error.code="OTHER";else wrong.message="OTHER";
    assert.throws(()=>assertHttpContract("candidate",route,response(status,wrong)));
  }
});
test("E2 absent routes use separate exact404 status contract",()=>{
  for(const route of routes) {
    assertHttpContract("control-e2",route,{status:404,bodyText:"historical E2 route absent"});
    assert.throws(()=>assertHttpContract("control-e2",route,response(200,{enabled:false})));
    assert.throws(()=>assertHttpContract("control-e2",route,response(403,{})));
  }
});