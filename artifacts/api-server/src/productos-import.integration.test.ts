import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import test from "node:test";

const testUrl = process.env.TEST_DATABASE_URL;
const appUrl = process.env.DATABASE_URL;

if (!testUrl) {
  test.skip("productos import integration requires explicit TEST_DATABASE_URL", () => {});
} else if (testUrl === appUrl) {
  throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL.");
} else {
  test("importación persiste precios opcionales y conserva duplicados sin cambios", async () => {
    const [{ pool }, { default: app }] = await Promise.all([
      import("@workspace/db"),
      import("./app"),
    ]);
    const expectedDb = decodeURIComponent(new URL(testUrl).pathname.slice(1));
    const tag = `IMPORT-OPTIONAL-${randomUUID()}`;
    const session = randomUUID();
    const createdProductIds: number[] = [];
    let server: Server | undefined;
    let baseUrl = "";

    const mutate = async (text: string, values: unknown[] = []) => {
      const identity = await pool.query<{ database: string }>(
        "SELECT current_database() AS database",
      );
      assert.equal(
        identity.rows[0]?.database,
        expectedDb,
        "TEST_DATABASE_URL database identity changed",
      );
      return pool.query(text, values);
    };
    const request = async (
      path: string,
      body: { fileName: string; content: string },
    ) => {
      const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          cookie: `mariana_session=${session}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      return { response, body: (await response.json()) as any };
    };
    const encodeCsv = (csv: string) => Buffer.from(csv, "utf8").toString("base64");

    try {
      const admin = await pool.query<{ id: number }>(
        "SELECT id FROM usuarios WHERE rol = 'ADMIN' AND activo = true ORDER BY id LIMIT 1",
      );
      assert.ok(admin.rows[0], "La base aislada requiere el ADMIN del seed.");
      await mutate(
        "INSERT INTO sesiones(id,usuario_id,expira_at,ip,user_agent) VALUES($1,$2,now()+interval '1 hour','127.0.0.1',$3)",
        [session, admin.rows[0].id, tag],
      );

      server = createServer(app);
      await new Promise<void>((resolve) =>
        server!.listen(0, "127.0.0.1", resolve),
      );
      const address = server.address();
      assert(address && typeof address !== "string");
      baseUrl = `http://127.0.0.1:${address.port}`;

      const csv = [
        "tela,color,unidad,precio_sugerido",
        `${tag} Manta,Crudo,METRO,`,
        `${tag} Gabardina,Azul,METRO,`,
        `${tag} Lino,Rojo,METRO,50`,
        `${tag} Popelina,Verde,KILO,75.50`,
        `${tag} Texto,Negro,METRO,gratis`,
        `${tag} Negativo,Blanco,METRO,-1`,
      ].join("\n");
      const importBody = {
        fileName: "productos-precio-opcional.csv",
        content: encodeCsv(csv),
      };
      const preview = await request("/api/productos/import/preview", importBody);
      assert.equal(preview.response.status, 200);
      assert.equal(
        preview.body.filter((row: { estado: string }) => row.estado === "NUEVO").length,
        4,
      );
      assert.deepEqual(
        preview.body
          .filter((row: { estado: string }) => row.estado === "NUEVO")
          .map((row: { precioSugerido: string | null }) => row.precioSugerido),
        [null, null, "50.00", "75.50"],
      );
      const previewErrors = preview.body
        .filter((row: { estado: string }) => row.estado === "ERROR")
        .map((row: { error: string }) => row.error);
      assert.equal(previewErrors.length, 2);
      assert.match(previewErrors[0], /precio inválido: "gratis"/);
      assert.match(previewErrors[1], /precio inválido: "-1"/);

      const threeColumns = await request("/api/productos/import/preview", {
        fileName: "productos-tres-columnas.csv",
        content: encodeCsv(
          `tela,color,unidad\n${tag} Tres Columnas,Marfil,KILO`,
        ),
      });
      assert.equal(threeColumns.response.status, 200);
      assert.equal(threeColumns.body[0].estado, "NUEVO");
      assert.equal(threeColumns.body[0].precioSugerido, null);

      const confirmed = await request("/api/productos/import/confirm", importBody);
      assert.equal(confirmed.response.status, 200);
      assert.deepEqual(confirmed.body, {
        insertados: 4,
        duplicados: 0,
        errores: 2,
      });

      const stored = await mutate(
        "SELECT id,color,precio_sugerido FROM productos WHERE tela ILIKE $1 ORDER BY color",
        [`${tag}%`],
      );
      createdProductIds.push(...stored.rows.map((row) => Number(row.id)));
      assert.deepEqual(
        Object.fromEntries(
          stored.rows.map((row) => [row.color, row.precio_sugerido]),
        ),
        {
          Azul: null,
          Crudo: null,
          Rojo: "50.00",
          Verde: "75.50",
        },
      );

      const duplicateCsv = [
        "tela,color,unidad,precio_sugerido",
        `${tag} Manta,Crudo,METRO,999`,
        `${tag} Gabardina,Azul,METRO,888`,
        `${tag} Lino,Rojo,METRO,1`,
        `${tag} Popelina,Verde,KILO,2`,
        `${tag} Texto,Negro,METRO,gratis`,
        `${tag} Negativo,Blanco,METRO,-1`,
      ].join("\n");
      const duplicate = await request("/api/productos/import/confirm", {
        fileName: "productos-duplicados.csv",
        content: encodeCsv(duplicateCsv),
      });
      assert.equal(duplicate.response.status, 200);
      assert.deepEqual(duplicate.body, {
        insertados: 0,
        duplicados: 4,
        errores: 2,
      });
      const unchanged = await mutate(
        "SELECT color,precio_sugerido FROM productos WHERE id = ANY($1::int[]) ORDER BY color",
        [createdProductIds],
      );
      assert.deepEqual(unchanged.rows, [
        { color: "Azul", precio_sugerido: null },
        { color: "Crudo", precio_sugerido: null },
        { color: "Rojo", precio_sugerido: "50.00" },
        { color: "Verde", precio_sugerido: "75.50" },
      ]);
    } finally {
      if (server) {
        await new Promise<void>((resolve) => server!.close(() => resolve()));
      }
      if (createdProductIds.length) {
        await mutate(
          "DELETE FROM productos WHERE id = ANY($1::int[])",
          [createdProductIds],
        );
      }
      await mutate("DELETE FROM sesiones WHERE id = $1", [session]);
    }
  });
}