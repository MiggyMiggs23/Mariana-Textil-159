import fs from "node:fs";
const root="/home/runner/workspace", report=root+"/reports/tanda-h/setup";
let text=fs.readFileSync(root+"/reports/tanda-g-ampliada/setup/lifecycle.mjs","utf8")
 .replaceAll("tanda-g-ampliada","tanda-h").replaceAll("tanda_ga","tanda_h").replaceAll("ga_","h_").replaceAll("55442","55444")
 .replace('["permissions","inventory","month","performance","failure"]','["inventory","performance","permissions"]')
 .replaceAll("43851","43871").replaceAll("43861","43881")
 .replace(/   identity\.metrage=.*\n   if\(identity\.metrage.*\n/g,"")
 .replace('console.log("All five worker identities sealed; sibling CONNECT denied; metrage zero.");','console.log("Worker identities sealed; sibling CONNECT denied; no application started.");')
 .replace('else if(action==="seal")','else if(action==="stop")stop();\nelse if(action==="seal")')
 .replace('start|seal|api WORKER','start|stop|seal|api WORKER');
fs.writeFileSync(report+"/lifecycle.mjs",text);
fs.writeFileSync(report+"/api-runner.mjs",fs.readFileSync(root+"/reports/tanda-g-ampliada/setup/api-runner.mjs","utf8").replaceAll("tanda-g-ampliada","tanda-h").replaceAll("tanda_ga","tanda_h").replaceAll("55442","55444"));
fs.writeFileSync(report+"/proxy.mjs",fs.readFileSync(root+"/reports/tanda-e-20260923/tarea-1/proxy.mjs","utf8"));
let load=fs.readFileSync(root+"/reports/tanda-g-ampliada/tarea-4/load.mjs","utf8")
 .replaceAll("tanda-g-ampliada","tanda-h").replaceAll("tanda_ga","tanda_h").replaceAll("ga_performance","h_performance").replaceAll("55442","55444")
 .replace('const out=root+"/reports/tanda-h/tarea-4";','const out=root+"/reports/tanda-h/performance";\nfs.mkdirSync(out,{recursive:true});')
 .replace("1+(g-1)%7","1+(g-1)%3")
 .replaceAll("TANDA-GA-PERF","TANDA-H-PERF").replaceAll("GA-PERF","H-PERF");
fs.writeFileSync(report+"/performance-load.mjs",load);