// Disposable-only harness; identical for candidate/control. Bundle bytes intact.
import net from "node:net";
import path from "node:path";
import {pathToFileURL} from "node:url";
const original=net.Server.prototype.listen;
net.Server.prototype.listen=function(...args) {
  if(args[0]&&typeof args[0]==="object") {
    if(args[0].path||args[0].fd||!args[0].port)throw Error("Only private TCP listener allowed");
    args[0]={...args[0],host:"127.0.0.1"};
  } else if(typeof args[0]==="number"||/^[0-9]+$/.test(args[0]??"")) {
    if(typeof args[1]==="string")args[1]="127.0.0.1";else args.splice(1,0,"127.0.0.1");
  } else throw Error("Unsupported listener in disposable harness");
  return original.apply(this,args);
};
if(!process.argv[2]||!path.isAbsolute(process.argv[2]))throw Error("Explicit absolute candidate/control path required");
await import(pathToFileURL(process.argv[2]).href);