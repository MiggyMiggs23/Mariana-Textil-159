import { Client, type PoolConfig } from "pg";
import { TestResetError } from "./service";

const KEY = [19670925, 2] as const;
let activeLease: { exclusive: boolean; valid: boolean } | undefined;

/**
 * All API instances participate BEFORE startup writers/listen. Ordinary builds
 * hold a shared lifetime lease; a reset-enabled build requires an exclusive
 * lifetime lease and therefore cannot coexist with any other participating API.
 * One metadata SELECT at boot, not extra DB writes/locks on every request.
 */
export async function acquireResetProcessLease(config: PoolConfig, exclusive: boolean) {
  const client = new Client(config);
  try {
    await client.connect();
    const lock = exclusive ? "pg_try_advisory_lock" : "pg_try_advisory_lock_shared";
    const { rows } = await client.query<{ acquired: boolean }>(`SELECT ${lock}($1,$2) AS acquired`, [...KEY]);
    if (!rows[0]?.acquired) {
      throw new TestResetError("No se puede iniciar: otra API usa esta base. El reinicio exige una sola API y terminar sus solicitudes anteriores.");
    }
  } catch (error) {
    await client.end().catch(() => undefined);
    throw error;
  }
  const state = { exclusive, valid: true };
  activeLease = state;
  client.on("error", () => { state.valid = false; });
  client.on("end", () => { state.valid = false; });
  return {
    get valid() { return state.valid; },
    async close() {
      state.valid = false;
      await client.end();
    },
  };
}

export function assertExclusiveResetProcess() {
  if (!activeLease?.exclusive || !activeLease.valid) {
    throw new TestResetError("Reinicio bloqueado: falta la exclusividad de esta API. No se borró nada.", 503);
  }
}
export function resetProcessLeaseLost() {
  return activeLease != null && !activeLease.valid;
}