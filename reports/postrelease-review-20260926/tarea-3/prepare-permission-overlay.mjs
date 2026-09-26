import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
const root = process.cwd();
const out = path.join(root, 'reports/postrelease-review-20260926/tarea-3');
const relative = 'artifacts/mariana-textil/src/pages/conciliacion.tsx';
const parent = path.join(root, 'reports/postrelease-review-20260926/tarea-4/frozen-root', relative);
const original = fs.readFileSync(parent, 'utf8');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
assert.equal(hash(original), 'dbea832020088b2e6ef3eaacfdf5387ad5a609e407516ac9fcb7c3f23324797f',
  'Task4 parent changed: coordinate MAIN before overlaying');
let text = original;
const replace = (before, after) => {
  assert(text.includes(before), before);
  text = text.replace(before, after);
};
replace('  useGetConciliacion,', '  useGetCurrentUser,\n  getGetCurrentUserQueryKey,\n  useGetConciliacion,');
replace('import { useState } from "react";',
  'import { useState } from "react";\nimport { hasPermission, Modules } from "@/lib/permisos";');
replace('  const queryClient = useQueryClient();',
  '  const queryClient = useQueryClient();\n  const { data: user } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });\n  const canRecalculate = hasPermission(user, Modules.CONCILIACION, "autorizar");');
replace('  const handleRecalcular = (pId: number, uId: number) => {',
  '  const handleRecalcular = (pId: number, uId: number) => {\n    if (!canRecalculate || recalcular.isPending) return;');
replace('disabled={recalcular.isPending}', 'disabled={!canRecalculate || recalcular.isPending}');
const destination = path.join(out, 'permission-overlay', relative);
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, text);
fs.writeFileSync(path.join(out, 'permission-overlay.json'), JSON.stringify({
  status: 'CANDIDATE_ONLY_NOT_BUILT_OR_ACTIVATED',
  parent: path.relative(root, parent), parentSha256: hash(original),
  file: relative, overlay: path.relative(root, destination), sha256: hash(text),
  changes: 'Permission conciliacion/autorizar on Recalcular button and handler, ADMIN bypass via existing helper. Task4 error state preserved. No permission matrix, API or site semantics changes.',
}, null, 2));
console.log(hash(text));