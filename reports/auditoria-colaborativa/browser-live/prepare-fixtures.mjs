import fs from "node:fs";
import crypto from "node:crypto";
import pg from "../../../lib/db/node_modules/pg/lib/index.js";

const dir = "/tmp/scanner-e2e-isolated";
const env = JSON.parse(fs.readFileSync(`${dir}/test-env.json`, "utf8"));
const expected = "scanner_collab_e2e_20260926";
const test = new URL(env.TEST_DATABASE_URL);
const live = new URL(process.env.DATABASE_URL);
if (test.hostname.replace("-pooler", "") === live.hostname.replace("-pooler", "") ||
    test.pathname !== `/${expected}`) throw Error("Isolation guard failed");
const pool = new pg.Pool({ connectionString: test.href });
try {
  const identity = (await pool.query("SELECT current_database() AS database")).rows[0];
  if (identity.database !== expected) throw Error("Effective database mismatch");
  if ((await pool.query("SELECT count(*)::int AS n FROM usuarios")).rows[0].n !== 1)
    throw Error("Expected only authorized seeded administrator");
  await pool.query("BEGIN");
  const sites = [];
  for (const [nombre, iniciales] of [["E2E Scanner Norte", "ESN"], ["E2E Scanner Sur", "ESS"]]) {
    const site = (await pool.query(
      "INSERT INTO ubicaciones(nombre,iniciales,tipo) VALUES($1,$2,'BODEGA') RETURNING id,nombre",
      [nombre, iniciales])).rows[0];
    site.floor = (await pool.query(
      "INSERT INTO pisos(ubicacion_id,nombre) VALUES($1,'E2E Planta baja') RETURNING id",
      [site.id])).rows[0].id;
    sites.push(site);
  }
  const users = [];
  for (let i = 1; i <= 6; i++) {
    const usuario = `e2e.scanner.${i}`;
    const password = crypto.randomBytes(24).toString("base64url");
    const row = (await pool.query(
      `INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id,alcance_consulta)
       VALUES($1,$2,crypt($3,gen_salt('bf',12)),'BODEGA',$4,'PROPIA') RETURNING id,nombre,usuario`,
      [`E2E Scanner ${i}`, usuario, password, sites[0].id])).rows[0];
    users.push({ ...row, password });
  }
  const product = (await pool.query(
    `INSERT INTO productos(sku,tela,color,unidad,notas)
     VALUES('E2ESCAN','E2E Tela Scanner','E2E Azul','METRO','Synthetic authorized isolated fixture')
     RETURNING id,sku`)).rows[0];
  const rolls = [];
  for (let i = 1; i <= 12; i++) {
    const site = i === 12 ? sites[1] : sites[0];
    rolls.push((await pool.query(
      `INSERT INTO rollos(serie,producto_id,ubicacion_id,piso_id,estado,cantidad_inicial,cantidad_actual,notas)
       VALUES($1,$2,$3,$4,'DISPONIBLE',25,25,'Synthetic authorized isolated fixture')
       RETURNING id,serie,ubicacion_id,piso_id`,
      [String(990260000 + i), product.id, site.id, site.floor])).rows[0]);
  }
  await pool.query("COMMIT");
  const fixture = {
    database: expected, branch: "br-fancy-sound-ax3sbznv",
    sites, product, rolls, users: users.map(({ password, ...u }) => u),
    seedAdmin: "admin", effectiveDatabaseVerified: true, distinctLiveEndpoint: true,
  };
  fs.writeFileSync(`${dir}/credentials.json`, JSON.stringify({
    users, admin: { usuario: "admin", password: env.ADMIN_SEED_PASSWORD },
  }, null, 2), { mode: 0o600 });
  fs.writeFileSync(new URL("./fixture.json", import.meta.url), JSON.stringify(fixture, null, 2));
  console.log("Verified isolated fixture ready: six scoped scanners, seeded admin, two sites, twelve rolls.");
} catch (error) {
  await pool.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await pool.end();
}