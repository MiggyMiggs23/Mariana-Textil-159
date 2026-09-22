// Existing native cases only, selected because their panel/item changed for P12.
// GREEN regression only; new P12 defects have paired E12 mutation cycles.
import { cases } from "../e4/frontend-mutants-cases.mjs";
export const ids = [
  "E4-ADMIN", "E4-SUPERVISOR", "E4-OTHER-STORE", "E4-CLAIM-REASON",
  "E4-CAPTURE-RETRY", "E4-PROVIDER-REQUIRED", "E4-GATE-OFF",
  "E4-CAPTURE-DOUBLE", "E4-CAPTURE-CONTENT", "E4-CAPTURE-PERMISSION",
  "E4-PROVIDER-LOCATION", "E4-REVIEW-DOUBLE", "E4-REVIEW-RETRY",
  "E4-REVIEW-CONTENT", "E4-CAJA-NO-REVIEW",
];
export const regressions = ids.map(id => {
  const source = cases.find(entry => entry.id === id);
  if (!source) throw Error(`Unknown immutable E4 regression ${id}`);
  return { ...source, mode: "EXISTING_E4_GREEN_ONLY",
    testFile: "src/components/e4-node.dom.test.tsx" };
});