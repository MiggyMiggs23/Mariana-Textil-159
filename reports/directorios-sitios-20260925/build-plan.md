# Directorios por sitio — preparación, NO ejecutar todavía

> **Actualización posterior (tras autorización expresa de MAIN):** ambos candidatos fueron construidos y verificados sin activación. Las instrucciones pendientes de este documento describen el plan original, ya ejecutado solo para builds/typechecks. Para rutas, hashes, exclusiones y bloqueo RFC/DDL ver `candidate-ready.json`, `hunk-inventory.json` y `candidate-build-result.md`. **No repetir los scripts de build:** rehúsan sobrescribir los candidatos existentes.

Estado: **scripts preparados, sin candidato construido ni activado**. No se abrió conexión a DB, no hubo escrituras, workflows, reinicios ni sustitución de `dist`. Se verificó solo por lectura que los padres activos siguen siendo:

- API `artifacts/api-server/dist-clientes-lista-20260925/index.mjs` SHA-256 `a53d9a0d31c1713db1e57409a74d2c894935fa7327ec3617b5b58717b63eb5cd`.
- Web `artifacts/mariana-textil/dist-clientes-lista-20260925/index.html` SHA-256 `1e22ee20dcdd712dd0018688f9fe0b30e322de7f0e7b9db7a8f5c65fa091b4c9`.

`build-candidate.mjs` prepara candidatos **separados**, sin reutilizar `build` normal ni escribir `dist` o el dist activo. API se recompone exclusivamente del sourcemap del padre activo más overlays explícitos. Web se compone de `.local/e7-text-baseline` copiada a `reports/directorios-sitios-20260925/staging/frontend-root`; se sustituyen únicamente overlays aprobados. Los binarios se escribirían a `artifacts/{api-server,mariana-textil}/dist-directorios-sitios-20260925`, jamás al directorio servido. Los hashes de ambos padres, bytes de cada overlay, hash de origen de cada archivo y diferencias finales del sourcemap API son comprobaciones obligatorias. Se prohíben referencias *nuevas* a devolución comercial detectadas por nombre; además hace falta inspección humana del diff semántico. No existe todavía `approval.json` ni `approved/`: cualquier ejecución ahora falla cerrada.

## MAIN debe entregar después, antes de autorizar ejecución

1. Diff revisado **por hunk** frente al sourcemap activo de API y la fuente E7 segura (no `git diff HEAD` completo). Enumerar rutas exactas y la semántica autorizada de selectores de crédito por sitio, historial/UI clientes, directorio proveedores y contrato generado. En particular, los archivos de clientes, crédito y schemas mezclan trabajo ajeno; no copiar los archivos de HEAD completos sin separar esos hunks. Confirmar que GET existentes, permisos y respuestas no cambian indebidamente.
2. Archivos completos *ya compuestos y revisados* bajo `reports/directorios-sitios-20260925/approved/<ruta-desde-raíz>`. Para API, las versiones de archivos existentes deben partir del contenido en `dist-clientes-lista-20260925/index.mjs.map`; los módulos nuevos requieren autorización explícita. Para frontend, partir de `.local/e7-text-baseline` (que ya contiene los cambios previamente aprobados de listado clientes). Contrato generado: insertar únicamente el fragmento necesario en la versión base, nunca copiar el generado entero de HEAD que incluye devolución comercial. El árbol `approved/` es material de revisión, no una ruta de producción.
3. Un `approval.json` revisado junto con esos archivos, esquema:

   ```json
   {
     "parentApiSha256": "a53d9a0d31c1713db1e57409a74d2c894935fa7327ec3617b5b58717b63eb5cd",
     "parentFrontIndexSha256": "1e22ee20dcdd712dd0018688f9fe0b30e322de7f0e7b9db7a8f5c65fa091b4c9",
     "api": [{ "path": "artifacts/api-server/src/routes/index.ts", "baseSha256": "<hash de texto en sourcemap activo>", "sha256": "<hash de approved/archivo>" }],
     "front": [{ "path": "artifacts/mariana-textil/src/pages/clientes.tsx", "baseSha256": "<hash en baseline E7>", "sha256": "<hash de approved/archivo>" }]
   }
   ```

   `baseSha256: null` **solo** para archivos verdaderamente nuevos; cada arreglo requiere por lo menos un cambio. Escribir autorización explícita para ejecutar cada etapa; ninguna se ejecutó con esta preparación.
4. Confirmar que ningún path autorizado incorpora cambios comerciales no liberados; indicar si frontend precisa tipos/hooks nuevos, hashes de assets permitidos y si los nuevos archivos solo son pruebas (las pruebas no se necesitan en el binario). Ante un hunk dudoso, detener preparación y solicitar separación al agente dueño.

## Comandos para la fase posterior — NO EJECUTADOS

Solo tras revisión y autorización del punto anterior, desde raíz y en secuencia:

```sh
node reports/directorios-sitios-20260925/build-candidate.mjs api
node reports/directorios-sitios-20260925/build-candidate.mjs front
```

Salidas de procedencia separadas `api-candidate-provenance.json` y `front-candidate-provenance.json`. El script rehúsa sobrescribir staging/candidatos/procedencias existentes; un reintento debe investigarse antes de cualquier limpieza manual. La construcción de API usa `esbuild` y `esbuild-plugin-pino` del paquete `artifacts/api-server` con flags de `artifacts/api-server/build.mjs`, pero **no** ejecuta `pnpm --filter @workspace/api-server build` (que borra su destino por defecto). Web usa `pnpm exec vite build --config vite.config.ts --outDir <ruta-absoluta-del-candidato>` desde el workspace aislado, con `NODE_ENV=production BASE_PATH=/`; no usa `pnpm --filter @workspace/mariana-textil build` (destino por defecto `dist/public`).

Pruebas independientes disponibles, previa autorización para correrlas: `pnpm --filter @workspace/api-server run typecheck` y `pnpm --filter @workspace/mariana-textil run typecheck` sobre HEAD; `pnpm --filter @workspace/mariana-textil test` ejecuta `scripts/src/frontend-test-runner.mjs`. Para pruebas frontend seleccionadas desde `artifacts/mariana-textil`: `node ../../scripts/src/frontend-test-runner.mjs src/components/client-directory.test.tsx src/components/credit-site-scope.contract.test.ts src/lib/clientes-api.contract.test.ts`. Para contratos API sin DB desde `artifacts/api-server`: `pnpm exec tsx --test src/lib/clientes-aging.test.ts src/supplier-trace.contract.test.ts`; inspeccionar nuevos tests concretos antes de ampliar. **No ejecutar** suites `integration` o scripts con `TEST_DATABASE_URL` sin DB desechable, explícita y autorizada; tampoco `verify:supplier-utility-readonly`, health checks o tráfico autenticado bajo esta tarea. Los typechecks HEAD no prueban por sí mismos el contenido aislado de los candidatos; revalidar en el staging y revisar los hashes/procedencias al construir.

La lista de diferencias inicial (que puede cambiar por edición concurrente) está en `baseline-differences.md`. Ninguna activación, cambio de workflow, ni validación con DB forma parte de esta preparación; MAIN controla la liberación.

**Bloqueo adicional observado al revisar la entrega RFC:** la nueva proyección de proveedor leería `proveedores.rfc`; la migración SQL candidata no se ha aplicado. MAIN debe decidir y autorizar el orden de migración/activación por separado. El build no es permiso para ejecutar DDL; una API con RFC activada antes de la columna fallaría en lecturas de proveedores. El inventario de hunks inspeccionados mientras crédito y proveedor siguen cambiando se conserva en `hunk-review-in-progress.md`.