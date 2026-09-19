import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

// Input copy must already be populated by git archive (or a frozen candidate).
const [source, target] = process.argv.slice(2).map(x => path.resolve(x));
if (!target.startsWith("/tmp/")) throw new Error("Destination must be isolated in /tmp");
const packages = execFileSync("git", ["ls-tree", "-r", "--name-only", "80eaa93d4300e86d9be54492e634f88f0c0abc90"], {cwd:source,encoding:"utf8"})
  .trim().split("\n").filter(x => /^(?:package.json|(?:artifacts|lib)\/[^/]+\/package.json|scripts\/package.json)$/.test(x));
const internal = new Map(packages.map(file => [JSON.parse(fs.readFileSync(path.join(target,file))).name, path.dirname(file)]));
const links = [];
function copyModules(src, dest) {
  fs.mkdirSync(dest, {recursive:true});
  for (const entry of fs.readdirSync(src,{withFileTypes:true})) {
    if (entry.name.startsWith(".")) continue;
    const from = path.join(src,entry.name), to = path.join(dest,entry.name);
    if (entry.isDirectory() && entry.name.startsWith("@")) {copyModules(from,to);continue;}
    const resolved = fs.realpathSync(from);
    let output = resolved;
    if (resolved.startsWith(source + "/") && !resolved.startsWith(source + "/node_modules/")) {
      output = path.join(target,path.relative(source,resolved));
      if (!fs.existsSync(output)) throw new Error(`Missing historical workspace dependency: ${output}`);
    }
    fs.symlinkSync(output,to,fs.statSync(from).isDirectory() ? "dir" : "file");
    links.push({from:to,to:output});
  }
}
for (const file of packages) {
  const dir = path.dirname(file), src = path.join(source,dir,"node_modules"), dest = path.join(target,dir,"node_modules");
  if (fs.existsSync(src)) copyModules(src,dest);
  const pkg = JSON.parse(fs.readFileSync(path.join(target,file)));
  for (const [name, version] of Object.entries({...pkg.dependencies,...pkg.devDependencies,...pkg.optionalDependencies})) {
    if (!String(version).startsWith("workspace:")) continue;
    if (!internal.has(name)) throw new Error(`Unknown workspace dependency ${name}`);
    const link = path.join(dest,name), expected = path.join(target,internal.get(name));
    fs.mkdirSync(path.dirname(link),{recursive:true});
    if (fs.existsSync(link)) fs.unlinkSync(link);
    fs.symlinkSync(expected,link,"dir");
    links.push({from:link,to:expected});
  }
}
// pnpm scripts need bin shims; immutable compiler path only, never app sources.
fs.mkdirSync(path.join(target,"node_modules/.bin"),{recursive:true});
const compiler = fs.realpathSync(path.join(source,"node_modules/typescript/bin/tsc"));
fs.symlinkSync(compiler,path.join(target,"node_modules/.bin/tsc"));
console.log(JSON.stringify({source,target,packages,links},null,2));