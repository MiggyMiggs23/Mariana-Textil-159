// One-off authorized migration. Never imported by the application.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { Pool } = require('../../lib/db/node_modules/pg');
const dir = __dirname;
const floors = [
  [1,2,'Planta Baja',true,0],[2,2,'Planta Alta',true,1],
  [3,1,'Planta Baja',true,0],[4,1,'Planta Alta',true,1],
  [5,3,'Planta Baja',true,0],[6,3,'Planta Alta',true,1],
  [7,4,'Primer Piso',true,1],[8,4,'Segundo Piso',true,2],
  [9,4,'Tercer Piso',true,3],[10,5,'Planta Baja',true,0],
  [11,5,'Primer Piso',true,1],[12,5,'Segundo Piso',true,2],
  [13,5,'Tercer Piso',true,3],
];
const sites = [[1,'Mariana',true],[2,'Cruces',true],[3,'Coco',true],
  [4,'Tomás',true],[5,'Don Nacho',true],[6,'Lucas Alamán',false],
  [7,'Bodega Cruces',false],[8,'En tránsito',true],[9,'Externo',true],
  [458,'UbSAT SA1787447615051_6',false],[531,'UbSAT SA1787447882698_6',false]];
const literal = x => typeof x === 'string' ? "'" + x.replaceAll("'", "''") + "'" : String(x);
const values = rows => rows.map(row => '(' + row.map(literal).join(',') + ')').join(',\n');
const hash = x => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function main() {
  const local = process.argv[2] === 'local';
  let connectionString;
  let identity;
  if (local) {
    connectionString = 'postgresql://runner@127.0.0.1:55439/floor_migration_disposable';
    identity = { mode: 'disposable-local-test' };
  } else {
    if (process.argv[2] !== 'apply') throw Error('Explicit local/apply mode required');
    const pid = process.argv[3];
    if (!/^\d+$/.test(pid || '')) throw Error('Runtime PID required');
    const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
    if (!cmd.includes('artifacts/api-server/dist-inventory-floors-20260926/index.mjs')) throw Error('Unexpected runtime');
    const env = Object.fromEntries(fs.readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean).map(x => [x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
    if (env.TEST_DATABASE_URL || env.NODE_ENV === 'test' || env.REQUIRE_ISOLATED_TEST_DATABASE === '1') throw Error('Test override forbidden');
    connectionString = env.DATABASE_URL;
    const url = new URL(connectionString);
    if (url.hostname !== 'helium' || url.pathname !== '/heliumdb' || connectionString !== process.env.DATABASE_URL) throw Error('Runtime endpoint mismatch');
    if (!fs.existsSync(`${dir}/local-migration-proof.json`)) throw Error('Local proof missing');
    identity = { mode: 'current-workspace-runtime', pid, host: url.hostname, database: 'heliumdb', shellMatchesRuntime: true };
  }
  const pool = new Pool({connectionString,max:1,connectionTimeoutMillis:5000});
  let client = await pool.connect();
  try {
    const db = (await client.query('SELECT current_database() AS name')).rows[0].name;
    if (db !== (local ? 'floor_migration_disposable' : 'heliumdb')) throw Error('Database mismatch');
    if (local) {
      await client.query(`CREATE TABLE public.ubicaciones(id integer primary key,nombre text,activa boolean);
        INSERT INTO public.ubicaciones VALUES ${values(sites)};
        CREATE TABLE public.pisos(id integer primary key,ubicacion_id integer,nombre text,activo boolean,created_at timestamptz default now(),updated_at timestamptz default now());
        INSERT INTO public.pisos(id,ubicacion_id,nombre,activo) VALUES ${values(floors.map(r=>r.slice(0,4)))};`);
      client.release(true);
      client = await pool.connect();
    }
    let sql = fs.readFileSync(`${dir}/floor-level-migration.template.sql`,'utf8')
      .replace('\\set ON_ERROR_STOP on','')
      .replace("-- INSERT INTO reviewed_target VALUES ('OWNER_CONFIRMED_DATABASE', 'public');", `INSERT INTO reviewed_target VALUES (${literal(db)}, 'public');`)
      .replace('-- INSERT INTO reviewed_floor_levels VALUES (...);', `INSERT INTO reviewed_floor_levels VALUES ${values(floors)};`)
      .replace('ROLLBACK;', '');
    sql = sql.slice(sql.indexOf('BEGIN;'), sql.indexOf('-- Later,'));
    const extraGuards = `
LOCK TABLE public.ubicaciones IN SHARE MODE;
CREATE TEMP TABLE reviewed_sites(id integer primary key,nombre text,activa boolean) ON COMMIT DROP;
INSERT INTO reviewed_sites VALUES ${values(sites)};
DO $guard$ BEGIN
 IF (SELECT count(*) FROM public.pisos) <> 13 OR (SELECT count(*) FROM public.ubicaciones) <> 11
 OR EXISTS(SELECT 1 FROM public.ubicaciones u FULL JOIN reviewed_sites r USING(id)
 WHERE u.id IS NULL OR r.id IS NULL OR u.nombre IS DISTINCT FROM r.nombre OR u.activa IS DISTINCT FROM r.activa)
 THEN RAISE EXCEPTION 'Site/catalog count or identity mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.pisos'::regclass AND NOT tgisinternal)
 THEN RAISE EXCEPTION 'Unexpected floor trigger'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pisos' AND column_name='nivel')
 THEN RAISE EXCEPTION 'Expected additive migration; nivel already exists'; END IF;
END $guard$;
CREATE TEMP TABLE preserved_floors ON COMMIT DROP AS SELECT to_jsonb(p) AS row FROM public.pisos p;
CREATE TEMP TABLE preserved_sites ON COMMIT DROP AS SELECT to_jsonb(u) AS row FROM public.ubicaciones u;
`;
    sql = sql.replace('LOCK TABLE public.pisos IN ACCESS EXCLUSIVE MODE;', 'LOCK TABLE public.pisos IN ACCESS EXCLUSIVE MODE;\n' + extraGuards);
    const assertion = `
DO $preserve$ BEGIN
 IF EXISTS((SELECT to_jsonb(p)-'nivel' FROM public.pisos p EXCEPT SELECT row FROM preserved_floors)
 UNION ALL (SELECT row FROM preserved_floors EXCEPT SELECT to_jsonb(p)-'nivel' FROM public.pisos p))
 THEN RAISE EXCEPTION 'Existing floor values changed'; END IF;
 IF EXISTS((SELECT to_jsonb(u) FROM public.ubicaciones u EXCEPT SELECT row FROM preserved_sites)
 UNION ALL (SELECT row FROM preserved_sites EXCEPT SELECT to_jsonb(u) FROM public.ubicaciones u))
 THEN RAISE EXCEPTION 'Existing site values changed'; END IF;
 IF EXISTS(SELECT 1 FROM public.pisos p JOIN reviewed_floor_levels r USING(id) WHERE p.nivel IS DISTINCT FROM r.nivel)
 THEN RAISE EXCEPTION 'Mapping mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pisos'
 AND column_name='nivel' AND data_type='integer' AND is_nullable='YES' AND column_default IS NULL)
 THEN RAISE EXCEPTION 'Unexpected column definition'; END IF;
 IF EXISTS(SELECT 1 FROM pg_stat_xact_user_tables WHERE schemaname='public' AND relname<>'pisos'
 AND (n_tup_ins<>0 OR n_tup_upd<>0 OR n_tup_del<>0))
 THEN RAISE EXCEPTION 'Non-floor write in migration transaction'; END IF;
END $preserve$;
`;
    // Local fixture setup is committed before this new transaction; counters reset.
    await client.query(sql);
    const before = (await client.query('SELECT row FROM preserved_floors ORDER BY (row->>\'id\')::int')).rows.map(x=>x.row);
    const after = (await client.query('SELECT to_jsonb(p) AS row FROM public.pisos p ORDER BY id')).rows.map(x=>x.row);
    await client.query(assertion);
    const writes = (await client.query("SELECT relname,n_tup_ins,n_tup_upd,n_tup_del FROM pg_stat_xact_user_tables WHERE schemaname='public' AND (n_tup_ins<>0 OR n_tup_upd<>0 OR n_tup_del<>0)")).rows;
    const outputs = (await client.query(`SELECT u.id,u.nombre,u.activa,p.id AS piso_id,p.nombre AS piso,p.nivel
      FROM public.ubicaciones u LEFT JOIN LATERAL(SELECT id,nombre,nivel FROM public.pisos
      WHERE ubicacion_id=u.id AND activo ORDER BY nivel,id LIMIT 1)p ON true WHERE u.id BETWEEN 1 AND 7 ORDER BY u.id`)).rows;
    const proof = {identity,before,after,unchangedFloorHash:hash(before),afterWithoutNivelHash:hash(after.map(({nivel,...r})=>r)),writes,outputs,
      preservation:'Atomic SQL EXCEPT checks on every old floor value and every site value; transaction-local write counters reject non-floor public writes.'};
    const prefix = local ? 'local' : 'executed';
    fs.writeFileSync(`${dir}/${prefix}-migration.sql`,sql+assertion+'\nCOMMIT;\n',{mode:0o600});
    fs.writeFileSync(`${dir}/${prefix}-migration-proof.json`,JSON.stringify({...proof,status:'pending commit'},null,2),{mode:0o600});
    await client.query('COMMIT');
    proof.status = 'committed';
    proof.readback = (await client.query('SELECT id,nivel FROM public.pisos ORDER BY id')).rows;
    fs.writeFileSync(`${dir}/${prefix}-migration-proof.json`,JSON.stringify(proof,null,2),{mode:0o600});
    console.log(JSON.stringify({status:proof.status,identity,writes,outputs,hashMatches:proof.unchangedFloorHash===proof.afterWithoutNivelHash}));
  } catch(error) {
    await client.query('ROLLBACK').catch(()=>{});
    throw error;
  } finally {client.release();await pool.end();}
}
main().catch(e=>{console.error(JSON.stringify({error:e.message,code:e.code}));process.exitCode=1;});