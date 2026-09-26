import fs from "node:fs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chromium } from "../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
const out="reports/print-corrections-20260926/labels";
fs.mkdirSync(`${out}/raster`,{recursive:true});
if(!fs.existsSync(`${out}/raster/label-26.png`))execFileSync("pdftoppm",["-scale-to","1600","-png",`${out}/etiquetas-top25-y-gabardina.pdf`,`${out}/raster/label`]);
const browser=await chromium.launch({headless:true,executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]});
const page=await browser.newPage();
const results=[];
try{
 await page.addScriptTag({path:"node_modules/.pnpm/@zxing+library@0.23.0/node_modules/@zxing/library/umd/index.min.js"});
 for(const file of fs.readdirSync(`${out}/raster`).filter(n=>n.endsWith(".png")).sort()){
   const data="data:image/png;base64,"+fs.readFileSync(`${out}/raster/${file}`).toString("base64");
   const text=await page.evaluate(async data=>{
     const image=new Image();image.src=data;await image.decode();
     // Crop the QR column from the actual PDF raster (no re-rendered SVG).
     const sx=Math.floor(image.width*.69),sy=Math.floor(image.height*.40);
     const canvas=document.createElement("canvas");canvas.width=Math.floor(image.width*.25);canvas.height=Math.floor(image.height*.36);
     const ctx=canvas.getContext("2d");ctx.drawImage(image,sx,sy,canvas.width,canvas.height,0,0,canvas.width,canvas.height);
     const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;
     const grey=new Uint8ClampedArray(canvas.width*canvas.height);
     for(let i=0;i<grey.length;i++)grey[i]=(rgba[i*4]+2*rgba[i*4+1]+rgba[i*4+2])/4;
     const source=new ZXing.RGBLuminanceSource(grey,canvas.width,canvas.height);
     const hints=new Map([[ZXing.DecodeHintType.PURE_BARCODE,true]]);
     return new ZXing.QRCodeReader().decode(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(source)),hints).getText();
   },data);
   const index=Number(file.match(/(\d+)\.png$/)[1]);
   assert(text.endsWith(`-${10000122+index}`),text);
   results.push({page:index,file,qr:text});
 }
 assert.equal(results.length,26);
}finally{fs.writeFileSync(`${out}/pdf-qr-verification.json`,JSON.stringify(results,null,2));await browser.close()}