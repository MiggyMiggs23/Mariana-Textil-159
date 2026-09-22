import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { meteredReferenceCost } from "./lib/metered-reference-cost";

const testUrl = process.env.TEST_DATABASE_URL;
const appUrl = process.env.DATABASE_URL;

if (!testUrl) {
  test.skip("metered reference cost integration requires explicit TEST_DATABASE_URL", () => {});
} else if (testUrl === appUrl) {
  throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL.");
} else {
  test("uses entradas.fecha and gives each received roll equal weight", async () => {
    const { db, pool } = await import("@workspace/db");
    const expectedDb = decodeURIComponent(new URL(testUrl).pathname.slice(1));
    const tag = `METER-COST-IT-${randomUUID()}`;
    const initials = [...randomUUID().replaceAll("-", "").slice(0, 3)]
      .map((digit) => String.fromCharCode(65 + Number.parseInt(digit, 16)))
      .join("");
    const ids = {
      location: 0,
      user: 0,
      product: 0,
      entries: [] as number[],
      rolls: [] as number[],
    };
    const mutate = async (text: string, values: unknown[] = []) => {
      const identity = await pool.query<{ database: string }>(
        "SELECT current_database() AS database",
      );
      assert.equal(identity.rows[0]?.database, expectedDb);
      return pool.query(text, values);
    };
    const one = async (text: string, values: unknown[] = []) =>
      (await mutate(text, values)).rows[0]!;

    try {
      const location = await one(
        "INSERT INTO ubicaciones(nombre,iniciales,tipo,activa) VALUES($1,$2,'BODEGA',true) RETURNING id",
        [`${tag} location`, initials],
      );
      ids.location = Number(location.id);
      const user = await one(
        `INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id,activo,alcance_consulta)
         VALUES($1,$2,'integration-only','ADMIN',$3,true,'PROPIA') RETURNING id`,
        [`${tag} user`, tag, ids.location],
      );
      ids.user = Number(user.id);
      const product = await one(
        "INSERT INTO productos(sku,tela,color,unidad,precio_sugerido,activo) VALUES($1,$2,'Azul','METRO',100,true) RETURNING id",
        [`${tag}-SKU`, `${tag} Tela`],
      );
      ids.product = Number(product.id);

      const received = [
        ["2025-01-10T00:00:00.000Z", "30", "10.00"],
        ["2025-02-10T00:00:00.000Z", "60", "20.00"],
        ["2025-03-10T00:00:00.000Z", "45", null],
        ["2023-01-10T00:00:00.000Z", "50", "8.00"],
      ] as const;
      for (const [date, quantity, cost] of received) {
        const entry = await one(
          `INSERT INTO entradas(
             folio,ubicacion_id,usuario_id,fecha,total_rollos,total_costo,uuid_cliente
           ) VALUES($1,$2,$3,$4,1,$5,gen_random_uuid()) RETURNING id`,
          [2_000_000_000 + ids.entries.length, ids.location, ids.user, date, cost],
        );
        ids.entries.push(Number(entry.id));
        const roll = await one(
          `INSERT INTO rollos(
             serie,producto_id,ubicacion_id,recepcion_id,estado,
             cantidad_inicial,cantidad_actual,costo_unitario
           ) VALUES($1,$2,$3,$4,'DISPONIBLE',$5,$5,$6) RETURNING id`,
          [
            `${tag}-${ids.rolls.length}`,
            ids.product,
            ids.location,
            entry.id,
            quantity,
            cost,
          ],
        );
        ids.rolls.push(Number(roll.id));
      }

      const current = await meteredReferenceCost(
        db,
        ids.product,
        new Date("2025-06-15T12:00:00.000Z"),
      );
      assert.deepEqual(
        {
          cost: current.cost,
          status: current.status,
          rollsIncluded: current.rollsIncluded,
        },
        { cost: "15.00", status: "AVERAGE_12_MONTHS", rollsIncluded: 2 },
      );

      const stale = await meteredReferenceCost(
        db,
        ids.product,
        new Date("2027-06-15T12:00:00.000Z"),
      );
      assert.equal(stale.cost, "20.00");
      assert.equal(stale.status, "STALE_LAST_KNOWN");
      assert.equal(stale.isOlderThan12Months, true);
    } finally {
      if (ids.rolls.length) {
        await mutate("DELETE FROM rollos WHERE id = ANY($1::int[])", [ids.rolls]);
      }
      if (ids.entries.length) {
        await mutate("DELETE FROM entradas WHERE id = ANY($1::int[])", [ids.entries]);
      }
      if (ids.product) {
        await mutate("DELETE FROM productos WHERE id=$1", [ids.product]);
      }
      if (ids.user) await mutate("DELETE FROM usuarios WHERE id=$1", [ids.user]);
      if (ids.location) {
        await mutate("DELETE FROM ubicaciones WHERE id=$1", [ids.location]);
      }
    }
  });
}