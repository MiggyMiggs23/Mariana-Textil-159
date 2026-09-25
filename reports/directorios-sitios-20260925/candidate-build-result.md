# Candidato aislado, listo para pruebas; NO activar

El tester puede abrir directamente **`artifacts/mariana-textil/dist-directorios-sitios-20260925/index.html`** como build estático candidato. Rutas y hashes de ambos candidatos están en `candidate-ready.json`; overlays byte a byte y hashes del padre en `approval.json`, inventario por hunk en `hunk-inventory.json`, trazas en `api-candidate-provenance.json` y `front-candidate-provenance.json`.

| Binario candidato | SHA-256 |
|---|---|
| API `index.mjs` | `b870909beced1957603ccbac785983d4c129c8438715d0e206c0e72fb1d90dbe` |
| API `pino-file.mjs` | `b7baffb56acc1e0362f569756028b8d812ebda7e67af17b0322513bf73cf190b` |
| API `pino-worker.mjs` | `46ebe17c12e8aa25a2be0f97a17bfdf4025eb6e6935671b6afdaa022197bac3e` |
| API `pino-pretty.mjs` | `1a05aa85bf5ce035c5d1f19a32e0308d6dbab00c7194e1936c7f632d10994fac` |
| API `thread-stream-worker.mjs` | `b490228463d2d47a57932bcbe6bb307af9c54d1b4f3953191e1077e791bb188d` |
| Frontend `index.html` | `6d3c648fa1946641f58b513dd383318bc48576dc91688826be05a1d83e8ee423` |
| Frontend `assets/index-CnJlxeX3.js` | `7f2d09a50f92bd553c7a4a3b56ebc6ac6dcab61e3d46b268b79e73fa2246c10f` |
| Frontend `assets/index-1U6Cw9Y7.css` | `6e070f5ab3abbd47fdd8db4ca067eae24668fccd756d4977e4205eadea430ad5` |

## Composición y exclusiones

- API: 4 cambios exactos sobre **todas** las fuentes originales en sourcemap activo: `routes/clientes.ts` (2 hunks de SELECT/ORDER; no resto de HEAD), `routes/proveedores.ts` (6 hunks directorio y RFC), `lib/api-zod/src/generated/api.ts` (8 hunks de proveedor, primero aplicado con contexto limitado por divergencia histórica del generado) y `lib/db/src/schema/proveedores.ts` (columna nullable). Los sourcemaps emitidos se verificaron contra las fuentes retenidas/overlays. Barrel `lib/api-zod/src/index.ts` y módulos de `generated/types` que no emiten JS se leyeron de la línea E7 segura, **no** del generado de HEAD.
- Frontend: 11 archivos existentes cambiados solo por hunks `git diff HEAD` revisados contra E7 segura y 3 módulos de tarea nuevos (selector de crédito, alcance de folio y orden del proveedor). Los 14 archivos staged coinciden con los SHA-256 de `approval.json`. `cliente-detail.tsx` se compuso por sus 3 hunks de historial; no se incluyeron bloques comerciales preexistentes en HEAD.
- Se excluyeron `AppLayout`, `LocationScopeProvider`, cambios de caja/operaciones ajenos, las pruebas (no necesarias en el bundle), DDL candidato, y reexportaciones/codegen completos de HEAD. Ningún archivo de workspace emitido por la API contiene marcadores de devolución comercial. El contrato OpenAPI, índices/types generados y el SQL candidato quedan en fuentes HEAD **solo para revisión**: no se copiaron en bloque al runtime. El código de cliente usa el hook y los tipos de proveedor compuestos separadamente.
- El plugin Pino generó inicialmente rutas absolutas de workers; se recompiló el candidato reemplazando exclusivamente ese literal del directorio de build por `globalThis.__dirname` en sus bundles. Los cinco `.mjs` pasaron `node --check` del entrypoint y ya no contienen rutas al candidato en código JS; trabajadores están junto al entrypoint con nombres relativos. No se inició el servidor.

## Typechecks, límites

- TypeScript de frontend **en staging aislado**: referencias compuestas construidas en `staging/frontend-root/lib`, seguido de `tsc -p artifacts/mariana-textil/tsconfig.json --noEmit`: **PASS**. Se enlazaron exclusivamente fixtures históricos E7 para resolver dos imports de pruebas preexistentes, no se empaquetan. Vite candidato: **PASS** (5673 módulos).
- Backend: `pnpm --filter @workspace/api-server run typecheck`: **PASS en HEAD**, no atribuirlo a una compilación TS aislada de API. El aislamiento API se validó por sourcemap byte a byte y esbuild; no se realizó una segunda compilación TypeScript desde un árbol retenido completo (sourcemap incluye módulos ejecutables, no todas las dependencias de tipos). No se probó conexión de base, HTTP ni autorización con sesiones.
- **Bloqueo de activación:** schema API candidato lee `proveedores.rfc` pero la columna de producción no existe hasta que MAIN autorice y aplique por separado el DDL nullable. Ninguna migración/DDL/DB se ejecutó aquí. La interfaz candidata puede inspeccionarse con fixture/testing aislado; no dirigirla a una API activa que aún no incluya `/proveedores/directorio`.

No hubo reemplazo de activos `dist-clientes-lista-20260925`, reinicio, workflow, cambio de configuración de servicio, activación ni escritura de DB.