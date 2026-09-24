import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
const dir=path.dirname(new URL(import.meta.url).pathname);
const selected=[
 ["transfer-caja-05-paid.png","Cobros150 efectivo y150 transferencia, separados."],
 ["abono-05-preview.png","E3 ordinario: FIFO50 sobre Nota1005; saldo150→100."],
 ["receipt-02-visible.png","Recibo sintético visible: copias Cliente y Tienda. No acredita impresión."],
 ["e4-04-success765.png","E4 suficiente25; estado de revisión PENDIENTE y efectivo765."],
 ["final-focused-05-cancellation-plus1.png","Rollo006 restaurado y signo corregido: CANCELACION+1.00, saldo6."],
 ["open-corte-03-preview765.png","Vista previa de corte765, sin confirmar cierre."],
 ["print-resize-fixed-raster-1.png","PDF final real, página1 A5 horizontal: Copia Cliente, abono50, deuda100."],
 ["print-resize-fixed-raster-2.png","PDF final real, página2 A5 horizontal: Copia Tienda, abono50, deuda100."],
];
const escape=s=>s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const inline=s=>escape(s).replace(/\[([^\]]+)\]\(([^)]+)\)/g,"$1 <small>[$2]</small>").replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/`([^`]+)`/g,"<code>$1</code>");
const md=fs.readFileSync(path.join(dir,"INFORME.md"),"utf8");
const content=md.split(/\n\n+/).map(block=>{
 if(/^#{1,3} /.test(block)){const m=block.match(/^(#{1,3}) (.*)/s);return `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`;}
 if(block.startsWith("- "))return "<ul>"+block.split("\n").map(l=>`<li>${inline(l.replace(/^- /,""))}</li>`).join("")+"</ul>";
 return `<p>${inline(block).replaceAll("\n"," ")}</p>`;
}).join("\n");
const figures=selected.map(([name,label])=>`<figure><img alt="${escape(label)}" src="data:image/png;base64,${fs.readFileSync(path.join(dir,"evidence",name)).toString("base64")}"><figcaption>${escape(label)}<br><small>${escape(name)}</small></figcaption></figure>`).join("\n");
const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tanda E · continuación · evidencia</title><style>
*{box-sizing:border-box}body{margin:0;background:#edf2f7;color:#172b43;font:16px/1.65 system-ui,sans-serif}main{max-width:1100px;margin:32px auto;padding:36px;background:white;border-radius:12px}h1,h2,h3{line-height:1.25;color:#142f52}h2{margin-top:36px;border-top:1px solid #dce4ed;padding-top:24px}code,small{overflow-wrap:anywhere}code{background:#eef2f6;padding:2px 4px}small{color:#53677e;font-size:12px}figure{margin:26px 0;border:1px solid #c9d4e1;padding:14px;border-radius:8px;break-inside:avoid}img{display:block;max-width:100%;height:auto;margin:auto}figcaption{padding:12px 0;font-weight:600}.status{background:#fff1d6;padding:16px;border-left:5px solid #b87910}footer{margin-top:32px;color:#53677e}@media print{body{background:white}main{padding:0;margin:0;max-width:none}h2{break-after:avoid}figure{break-before:page}}
</style></head><body><main><p class="status"><strong>Informe autocontenido · verificación completada</strong><br>Operaciones conciliadas. PDF digital real de dos páginas y signo CANCELACION: PASS. Impresora física no probada. Sesión abierta antes del desmontaje privado autorizado. Sin secretos ni recursos externos.</p>${content}<h2>Galería incorporada — evidencia sintética revisada</h2>${figures}<footer>Imágenes integradas en base64: este archivo se puede descargar y abrir sin conexión. Los nombres de evidencias referenciadas identifican el expediente, no requieren red para leer este informe.</footer></main></body></html>`;
fs.writeFileSync(path.join(dir,"INFORME-descargable.html"),html);
const privateDir=path.resolve(dir,"../../.local/tanda-e-continuacion");
const privateSecretsPresent=fs.existsSync(path.join(privateDir,"credentials.json"));
const credentials=privateSecretsPresent?JSON.parse(fs.readFileSync(path.join(privateDir,"credentials.json"),"utf8")):{};
const secretValues=[...Object.values(credentials).map(v=>v.password),privateSecretsPresent?fs.readFileSync(path.join(privateDir,"session-secret"),"utf8").trim():null].filter(Boolean);
const files=[];
function walk(folder){for(const ent of fs.readdirSync(folder,{withFileTypes:true})){const full=path.join(folder,ent.name);if(ent.isDirectory())walk(full);else if(/\.(mjs|sh|md|json|txt|html)$/.test(ent.name)&&ent.name!=="report-security-audit.json")files.push(full);}}
walk(dir);
const findings=[];
for(const file of files){
 const raw=fs.readFileSync(file,"utf8");
 if(secretValues.some(s=>raw.includes(s)))findings.push({file:path.relative(dir,file),kind:"private-synthetic-secret-literal"});
 const text=raw.replace(/data:image\/png;base64,[A-Za-z0-9+/=]+/g,"[embedded image]");
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|postgres(?:ql)?:\/\/[^/\s:]+:[^@\s]+@|Bearer\s+[A-Za-z0-9._-]{24,}/.test(text))findings.push({file:path.relative(dir,file),kind:"secret-like-literal-review"});
}
const audit={timestamp:new Date().toISOString(),scope:"All current report scripts/text/JSON/HTML; selected gallery images visually reviewed. Rerun before commit if evidence changes.",textFilesChecked:files.length,privateSyntheticCredentialsComparedWithoutDisclosure:privateSecretsPresent,priorPrivateComparisonEvidence:privateSecretsPresent?null:"report-security-audit-pre-teardown.json",applicationSecretsRead:false,findings,selectedSyntheticImages:selected.map(([file])=>file),imageReview:"Synthetic TEC actors/customer/product only; no copied real client identities or credentials observed; no masking needed. Nonselected raw images excluded from downloadable report; not cleared for broad publication.",html:{file:"INFORME-descargable.html",bytes:Buffer.byteLength(html),sha256:createHash("sha256").update(html).digest("hex"),embeddedImages:selected.length,externalResources:false},committed:false};
fs.writeFileSync(path.join(dir,"report-security-audit.json"),JSON.stringify(audit,null,2));
if(findings.length)throw Error("Report security findings require review; see audit metadata, no secret values logged.");
console.log(JSON.stringify({html:audit.html,textFilesChecked:files.length,findings:findings.length}));