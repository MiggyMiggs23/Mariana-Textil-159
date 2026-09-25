// Disposable-only candidate start; avoids inheriting --input-type into workers.
if (process.env.NODE_ENV !== "development" || process.env.API_INSPECTION_BOOT !== "1" || !process.env.DATABASE_URL?.endsWith("/night56_test")) {
  throw new Error("Disposable candidate identity required");
}
// Match the actual served development boot; schema was provisioned separately.
await import("../../../artifacts/api-server/dist-night-task12/index.mjs");