import fs from "node:fs";
import pg from "../../../lib/db/node_modules/pg/lib/index.js";

const file = new URL("./fixture.json", import.meta.url);
const fixture = JSON.parse(fs.readFileSync(file, "utf8"));
const env = JSON.parse(fs.readFileSync("/tmp/scanner-e2e-isolated/test-env.json", "utf8"));
const url = new URL(env.TEST_DATABASE_URL);
const live = new URL(process.env.DATABASE_URL);
if (url.pathname !== "/scanner_collab_e2e_20260926" ||
    url.hostname.replace("-pooler", "") === live.hostname.replace("-pooler", ""))
  throw Error("Fixture isolation guard failed");
const pool = new pg.Pool({ connectionString: url.href });
const client = await pool.connect();
try {
  const identity = (await client.query("SELECT current_database() AS database")).rows[0];
  if (identity.database !== fixture.database) throw Error("Effective database mismatch");
  await client.query("BEGIN");
  const sites = (await client.query(
    "SELECT id,nombre FROM ubicaciones WHERE id=ANY($1::int[]) ORDER BY id",
    [fixture.sites.map(site => site.id)])).rows;
  if (sites.length !== 2 || sites[0].nombre !== "E2E Scanner Norte" ||
      sites[1].nombre !== "E2E Scanner Sur") throw Error("Synthetic site identity mismatch");
  const before = (await client.query("SELECT count(*)::int AS count FROM auditoria")).rows[0].count;
  // Configuration-only changes to synthetic sites; no row/audit deletion.
  await client.query("UPDATE pisos SET nombre='Primer piso',updated_at=now() WHERE id=$1 AND ubicacion_id=$2",
    [fixture.sites[0].floor, sites[0].id]);
  for (const name of ["Segundo piso", "Tercer piso"]) {
    await client.query(
      `INSERT INTO pisos(ubicacion_id,nombre) SELECT $1,$2
       WHERE NOT EXISTS(SELECT 1 FROM pisos WHERE ubicacion_id=$1 AND nombre=$2)`,
      [sites[0].id, name]);
  }
  await client.query("UPDATE pisos SET activo=false,updated_at=now() WHERE ubicacion_id=$1", [sites[1].id]);
  await client.query("UPDATE rollos SET piso_id=NULL,updated_at=now() WHERE ubicacion_id=$1 AND serie='990260012'", [sites[1].id]);
  const floors = (await client.query(
    "SELECT id,nombre FROM pisos WHERE ubicacion_id=$1 AND activo ORDER BY nombre", [sites[0].id])).rows;
  if (floors.length !== 3 || floors[0].nombre !== "Primer piso") throw Error("Configured floor order mismatch");
  const after = (await client.query("SELECT count(*)::int AS count FROM auditoria")).rows[0].count;
  if (after !== before) throw Error("Unexpected audit trail change");
  await client.query("COMMIT");
  fixture.sites[0].floors = floors;
  fixture.sites[0].floorOrder = "API order: nombre ascending";
  fixture.sites[1].floor = null;
  fixture.sites[1].floors = [];
  fixture.sites[1].inactiveFloorRetained = true;
  fixture.rolls.find(roll => roll.serie === "990260012").piso_id = null;
  fixture.floorScenario = {
    desktopFixedFloor: floors[0],
    concurrentMobileChoices: floors,
    misplacedRoll: "990260001",
    expectedFloor: floors[0],
    scannedFloor: floors[1],
    expectedResult: "MAL_ACOMODADO",
    automaticApplicationForbidden: true,
    auditTrailRowsPreserved: before,
  };
  fs.writeFileSync(file, JSON.stringify(fixture, null, 2));
  console.log("Isolated floor fixture extended: three active north floors, zero active south floors; audit trail retained.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}