import {
  assertPreparedTestDatabase,
  pool,
} from "@workspace/db";
import { ensureStartupSchemas } from "../index";

try {
  await ensureStartupSchemas();
  await assertPreparedTestDatabase(pool);
  process.stdout.write(
    "Inicializadores y readiness de base de pruebas completados.\n",
  );
} finally {
  await pool.end();
}