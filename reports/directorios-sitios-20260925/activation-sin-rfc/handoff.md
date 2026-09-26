# Candidatos sin RFC proveedor — entrega a MAIN; todavía NO activados

Autorización literal del propietario: **«Osea activa todo menos ese, ese cambio no lo quiero»**. Se interpreta que «ese cambio» es el RFC nuevo de proveedores. La exclusión se aplica a API, interfaz, contrato de proveedor y esquema; no se ejecuta DDL. Los RFC de **clientes** preexistentes continúan intactos.

## Artefactos y trazabilidad

- Manifest: `candidate-ready.json`; fuentes congeladas y composición: `approval.json`, `build.mjs`, `api-provenance.json`, `frontend-provenance.json`.
- API: `artifacts/api-server/dist-directorios-sitios-20260925-sin-rfc/index.mjs`, SHA-256 `4366c5679e58432587b91a88c843df5ad2490096c73707f7bcb88b4d64806ae1`.
- Frontend: `artifacts/mariana-textil/dist-directorios-sitios-20260925-sin-rfc/index.html`, SHA-256 `7f7650f603302b32a985eac9fbb64e0fd4e3897c17093f307f912dcede21b926`.
- Desde la raíz, verificar **antes de cualquier cambio de configuración**:
  `sha256sum -c reports/directorios-sitios-20260925/activation-sin-rfc/api-artifact.sha256`
  y `sha256sum -c reports/directorios-sitios-20260925/activation-sin-rfc/frontend-artifact.sha256`.

El API se recompuso desde **todas** las fuentes del sourcemap del candidato anterior, eliminando únicamente cuatro líneas RFC del router, siete propiedades RFC de schemas Zod de proveedor y recuperando el esquema de proveedores del sourcemap activo anterior al RFC. La comparación del nuevo sourcemap indica exactamente esos tres deltas de workspace; los otros módulos del candidato (incluido el orden de clientes) no cambiaron. Se verificó que el router, esquema y bloque Zod del proveedor emitidos carecen de RFC. El frontend parte del staging aislado **simplificado** aprobado: se sustituyeron solo las dos páginas de proveedor revisadas y se quitaron cuatro propiedades RFC de interfaces de proveedor en el codegen seguro; no se copió el codegen completo de HEAD, que contiene cambios no autorizados. No se cambió búsqueda ni RFC de clientes, selección de crédito, alcance, historial, directorios, permisos o simplificaciones aprobadas.

Los cinco módulos API pasaron `node --check`; los módulos de frontend con referencias y proyecto principal pasaron `tsc` en staging aislado. Vite compiló 5673 módulos. El agente de proveedores registró `pnpm --filter @workspace/api-server run typecheck` sobre HEAD, pero **no** se atribuye ese chequeo a un árbol API TypeScript aislado; el control de aislamiento API fue esbuild + sourcemap. No hubo prueba HTTP ni autenticada ni captura de sesión. Los candidatos anteriores y sus pruebas/procedencia permanecen.

## Pasos de activación pendientes exclusivamente de MAIN

1. Capturar evidencia **antes** con el método anterior `reports/clientes-lista-20260925/activation/capture.mjs`, pero primero copiar ese archivo intacto a `reports/directorios-sitios-20260925/activation-sin-rfc/capture.mjs` (igual profundidad relativa, mismo import de `pg`). Revisar que el `DATABASE_URL` operativo corresponda al entorno autorizado **sin imprimir su valor**. Desde la raíz ejecutar `node reports/directorios-sitios-20260925/activation-sin-rfc/capture.mjs before`. El script usa `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, comprueba `transaction_read_only`, registra huellas de esquema y tablas sin filas; rehúsa sobrescribir evidencia. Si falla, detenerse. **No ejecutar DDL, migraciones ni escrituras.**
2. Revalidar los dos comandos `sha256sum -c` indicados arriba. Preparar copias temporales del contenido actual de los dos `.replit-artifact/artifact.toml`, preservando todo excepto `services.development.run`. Reemplazar ambos TOML **solo** con el callback validado `verifyAndReplaceArtifactToml({tempFilePath: "/ruta/absoluta/al/temporal", artifactTomlPath: "/ruta/absoluta/al/artifacts/<slug>/.replit-artifact/artifact.toml"})`, uno por artefacto; nunca editar los TOML activos directamente ni crear un workflow paralelo. Comandos `run` exactos:

   API: `cd /home/runner/workspace && sha256sum -c reports/directorios-sitios-20260925/activation-sin-rfc/api-artifact.sha256 && API_STARTUP_MODE=NORMAL API_INSPECTION_BOOT=1 NODE_ENV=development exec node artifacts/api-server/dist-directorios-sitios-20260925-sin-rfc/index.mjs`

   Frontend: `cd /home/runner/workspace && sha256sum -c reports/directorios-sitios-20260925/activation-sin-rfc/frontend-artifact.sha256 && cd artifacts/mariana-textil && exec pnpm exec vite preview --config vite.config.ts --outDir dist-directorios-sitios-20260925-sin-rfc --host 0.0.0.0 --port "$PORT" --strictPort`

3. MAIN reinicia **una vez cada uno** los workflows administrados exactos `artifacts/api-server: API Server` y `artifacts/mariana-textil: web` mediante herramienta de workflow, no comandos de shell paralelos. Confirmar estado, puerto, hash protegido efectivo y respuestas de salud/sesión con herramientas del agente MAIN; no confundir 401 sin sesión con una prueba autenticada.
4. Tras verificar los procesos, ejecutar `node reports/directorios-sitios-20260925/activation-sin-rfc/capture.mjs after`. Exigir `passed: true`, `sameDatabase: true`, `sameSchema: true`, listas vacías de `changedCounts` y `changedHashes`. Si hay cambios, detenerse, informar y no afirmar preservación. No publicar una activación exitosa sin **ambos** procesos correctos y comparación de evidencia `before/after`.

Esta entrega no ejecutó esos pasos: la activación y las URL efectivas corresponden a MAIN.