import fs from "node:fs";
import pg from "../../../lib/db/node_modules/pg/lib/index.js";
const env = JSON.parse(fs.readFileSync("/tmp/scanner-e2e-isolated/test-env.json"));
const fixture = JSON.parse(fs.readFileSync(new URL("./fixture.json", import.meta.url)));
const url = new URL(env.TEST_DATABASE_URL);
if (url.pathname !== "/scanner_collab_e2e_20260926") throw Error("Isolation guard");
const pool = new pg.Pool({ connectionString: url.href });
try {
  if ((await pool.query("SELECT current_database() AS d")).rows[0].d !== fixture.database) throw Error("Identity mismatch");
  await pool.query("BEGIN");
  const users = (await pool.query("SELECT id,usuario,rol,alcance_consulta FROM usuarios WHERE id=ANY($1::int[]) ORDER BY id", [fixture.users.map(u => u.id)])).rows;
  if (users.length !== 6 || users.some((u, i) => u.usuario !== fixture.users[i].usuario || u.rol !== "BODEGA" || u.alcance_consulta !== "PROPIA")) throw Error("Synthetic actors mismatch");
  for (const user of users) await pool.query(
    `INSERT INTO permisos_usuario(usuario_id,modulo,puede_ver,puede_crear,puede_editar,puede_autorizar)
     VALUES($1,'auditoria_inventario',true,true,true,false)
     ON CONFLICT(usuario_id,modulo) DO UPDATE SET puede_ver=true,puede_crear=true,puede_editar=true,puede_autorizar=false`,
    [user.id]);
  await pool.query("COMMIT");
  console.log("Six authorized synthetic scoped scanners granted audit module only; roles and closure authority unchanged.");
} catch (error) { await pool.query("ROLLBACK"); throw error; }
finally { await pool.end(); }