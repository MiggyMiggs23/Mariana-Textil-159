# Liberación de crearEntrada

2026-09-24 16:36 UTC. MAIN sustituyó exclusivamente la ruta del bundle de API mediante validación de artifact.toml y reinició una vez el workflow administrado.

- Bundle: artifacts/api-server/dist-tanda-h-entry-guard/index.mjs.
- SHA-256: 7d5e47f61c1c9b9d78430e0f109d6e8fd4ad33f8ad0fc74c36ed100d601db366.
- Log: API PID 2520, Server listening a las 16:36:10 UTC.
- API_INSPECTION_BOOT=1 conservado; inicializadores, backfill y monitor pausados según log.
- GET /api/healthz posterior devolvió HTTP 200, {"status":"ok"}.
- UI y puertas sin cambios; no se hicieron operaciones de prueba ni login en la base de la aplicación.
- Fuente del productor idéntica a c5ad7db, que ya tiene prueba RED/GREEN real. No se repitieron esos ensayos.
- Los dos índices fueron aplicados antes de este reinicio; evidencia separada en ../application/application-result.json. El CHECK existente no fue reaplicado.

No representa publicación en nube. Se conserva el bundle anterior para recuperación técnica.