import fs from "node:fs";
import path from "node:path";
import https from "node:https";
const run=path.resolve("reports/receipt-terminal-runtime-20261001/run-JTxs5F");
const root=path.resolve("reports/scanner-burst-20261006/revision-2/web");
const origin=JSON.parse(fs.readFileSync(path.join(run,"credentials.json"))).origin;
const types={".js":"application/javascript",".css":"text/css",".html":"text/html",".png":"image/png",".svg":"image/svg+xml",".ogg":"audio/ogg"};
https.createServer({key:fs.readFileSync(path.join(run,"localhost-key.pem")),cert:fs.readFileSync(path.join(run,"localhost-cert.pem"))},(req,res)=>{
  if(req.url.startsWith("/api/")){
    const p=https.request(new URL(req.url,origin),{method:req.method,headers:req.headers,rejectUnauthorized:false},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
    p.on("error",()=>{res.writeHead(502);res.end();});req.pipe(p);return;
  }
  let file=path.resolve(root,"."+decodeURIComponent(req.url.split("?")[0]));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.join(root,"index.html");
  res.setHeader("Content-Type",types[path.extname(file)]||"application/octet-stream");
  res.setHeader("Cache-Control","no-store");fs.createReadStream(file).pipe(res);
}).listen(18445,"127.0.0.1",()=>console.log("https://127.0.0.1:18445"));
