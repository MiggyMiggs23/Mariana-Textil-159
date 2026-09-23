const modulePath = process.env.ISOLATED_API_MODULE;
if (!modulePath) throw new Error("ISOLATED_API_MODULE is required.");

const api = await import(modulePath);
if (typeof api.startServer !== "function") {
  throw new Error("The isolated API bundle does not export startServer().");
}

// Import under NODE_ENV=test so @workspace/db enforces TEST_DATABASE_URL and
// the application witness. The restored effective schema is already prepared.
// Switch only the startup mode before listening to prevent normal boot
// initializers from colliding with restored deferred graph triggers.
if (process.env.NODE_ENV !== "test") {
  throw new Error("The isolated database guard must import under NODE_ENV=test.");
}
process.env.NODE_ENV = "development";
process.env.API_INSPECTION_BOOT = "1";
await api.startServer();