import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
const [root, destination] = process.argv.slice(2);
if (!root?.startsWith("/tmp/") || !fs.existsSync(path.join(root,"package.json"))) throw new Error("Only isolated /tmp copies permitted");
const {runTypecheck} = await import(pathToFileURL(path.join(root,"scripts/src/typecheck-runner.mjs")));
const processes = [];
const result = await runTypecheck({
  root,
  spawnImpl(command,args,options) {
    const row = {command,args,cwd:options.cwd};
    processes.push(row);
    const child = spawn(command,args,options);
    child.on("error",error => { row.error = error.message; });
    child.on("close",(exitCode,signal) => { row.exitCode = exitCode; row.signal = signal; });
    return child;
  },
});
fs.writeFileSync(destination,JSON.stringify({result,processes},null,2));
process.exitCode = result.exitCode;