import fs from "node:fs";
import path from "node:path";
const root="/home/runner/workspace", frozen=root+"/.local/tanda-g/"+(process.argv[2]==="candidate"?"candidate-source":"baseline-source");
for(const rel of [".","artifacts/api-server","artifacts/mariana-textil",...fs.readdirSync(root+"/lib").map(n=>"lib/"+n)]){
  const original=path.join(root,rel,"node_modules"), target=path.join(frozen,rel,"node_modules");
  if(!fs.existsSync(original))continue;
  fs.mkdirSync(target,{recursive:true});
  for(const name of fs.readdirSync(original)){
    const from=path.join(original,name),to=path.join(target,name);
    if(fs.existsSync(to))continue;
    if(name==="@workspace"){
      fs.mkdirSync(to,{recursive:true});
      for(const pkg of fs.readdirSync(from)){
        const actual=fs.realpathSync(path.join(from,pkg));
        const privateActual=path.join(frozen,path.relative(root,actual));
        if(!privateActual.startsWith(frozen+"/lib/"))throw Error("Unexpected workspace dependency");
        fs.symlinkSync(privateActual,path.join(to,pkg),"dir");
      }
    }else fs.symlinkSync(fs.realpathSync(from),to);
  }
}