import { createHash } from "node:crypto";

// E2/E3/Tanda B catalog format: public enum attributes are
// { kind: "enum", parent: type name, name: label, definition: enumsortorder }.
// Captures stay untouched. Only the comparison representation changes.
export const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
  : value && typeof value === "object" ? `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}` : JSON.stringify(value);
const digest = value => createHash("sha256").update(value).digest("hex");

export function comparisonAttributes(attributes) {
  if (!Array.isArray(attributes)) throw new Error("Catalog attributes must be an array");
  const groups = new Map();
  for (const row of attributes) {
    if (row.kind !== "enum") continue;
    if (typeof row.parent !== "string" || !row.parent || typeof row.name !== "string"
      || typeof row.definition !== "string" || !row.definition.trim()
      || !Number.isFinite(Number(row.definition))) {
      throw new Error("Invalid enum catalog attribute");
    }
    // Legacy captures are explicitly public-only; qualified captures retain
    // their schema identity as well. Never combine different types or schemas.
    const key = canonical([row.schema_name ?? row.schema ?? "public", row.parent]);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  const ranks = new Map();
  for (const rows of groups.values()) {
    const ordered = [...rows].sort((a, b) => Number(a.definition) - Number(b.definition));
    const labels = new Set();
    ordered.forEach((row, i) => {
      if (labels.has(row.name) || (i > 0 && Number(ordered[i - 1].definition) === Number(row.definition))) {
        throw new Error("Ambiguous enum catalog order or duplicate label");
      }
      labels.add(row.name);
      ranks.set(row, String(i + 1));
    });
  }
  // Preserve all other fields, non-enum attributes, and the canonical SQL row
  // ordering. Labels are NOT alphabetically reinterpreted as enum order.
  return attributes.map(row => row.kind === "enum" ? { ...row, definition: ranks.get(row) } : row);
}

export function fingerprints(catalog) {
  if (!Array.isArray(catalog.schemaRows)) throw new Error("Catalog schemaRows must be an array");
  return {
    schemaSha256: digest(canonical(catalog.schemaRows)),
    attributesSha256: digest(canonical(comparisonAttributes(catalog.attributes))),
  };
}