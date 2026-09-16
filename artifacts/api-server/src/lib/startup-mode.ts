/** Inspection is opt-in and must never silently become a writing startup. */
export function startupMode(env: Record<string, string | undefined>): "normal" | "inspection" {
  if (env.API_INSPECTION_BOOT !== "1") return "normal";
  if (env.NODE_ENV === "production") {
    throw new Error("API_INSPECTION_BOOT is development-only; refusing to run startup maintenance.");
  }
  return "inspection";
}