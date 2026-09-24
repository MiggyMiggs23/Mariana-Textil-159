import fs from "node:fs";
import pg from "../../../scripts/node_modules/pg/lib/index.js";
import {root,dir} from "./browser.mjs";
const pid=Number(fs.readFileSync(root+"/.local/tanda-f/api.pid","utf8"));
const cmd=fs.readFileSync(`/proc/${pid}/cmdline`,"utf8");
const env=fs.readFileSync(`/proc/${pid}/environ`,"utf8").split("\0");
if(!cmd.includes("/.local/tanda-f/source/api-runner.mjs")||!env.includes("TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55440/tanda_f_browser"))throw Error("API mismatch");
export const c=new pg.Client({connectionString:"postgresql://postgres@127.0.0.1:55440/tanda_f_browser",options:"-c default_transaction_read_only=on"});
await c.connect();
export const identity=(await c.query("select current_database() db,current_setting('data_directory') dir,inet_server_port() port,current_setting('transaction_read_only') readonly")).rows[0];
if(identity.db!=="tanda_f_browser"||identity.dir!==root+"/.local/tanda-f/cluster"||identity.port!==55440||identity.readonly!=="on")throw Error("DB mismatch");
if(process.argv[1].endsWith("/db.mjs")){console.log((await c.query(process.argv[2])).rows);await c.end();}