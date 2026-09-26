# Activación realizada — directorios y sitios SIN RFC proveedor

**Autorización exacta del propietario:** «Osea activa todo menos ese, ese cambio no lo quiero». «Ese cambio» es el nuevo RFC de proveedores; fue excluido de router, esquema, contratos y UI. No se ejecutó DDL ni migración. Se preservan RFC de clientes, directorios e historiales, selectores de crédito según sitio y simplificaciones aprobadas 1, 2, 6, 7 y 8. No se liberaron bloques ajenos de HEAD.

MAIN validó los dos TOML de artefactos mediante la herramienta de reemplazo validado y reinició una vez cada workflow administrado (`artifacts/api-server: API Server` y `artifacts/mariana-textil: web`). Comandos protegidos de arranque y hashes completos: `api-artifact.sha256`, `frontend-artifact.sha256`, `handoff.md`. Manifiesto efectivo: `candidate-ready.json`; fuentes y derivación: `approval.json`, `api-provenance.json`, `frontend-provenance.json`.

| Artefacto efectivo | SHA-256 |
|---|---|
| `artifacts/api-server/dist-directorios-sitios-20260925-sin-rfc/index.mjs` | `4366c5679e58432587b91a88c843df5ad2490096c73707f7bcb88b4d64806ae1` |
| `artifacts/mariana-textil/dist-directorios-sitios-20260925-sin-rfc/index.html` | `7f7650f603302b32a985eac9fbb64e0fd4e3897c17093f307f912dcede21b926` |

MAIN confirmó API PID **20373**, inspection boot sin inicializadores, frontend HTTP **200** sirviendo el índice con el hash anterior y `/healthz` HTTP **200**. Los snapshots `before.json` y `after.json`, tomados del `DATABASE_URL` del proceso efectivo por `capture.mjs` en transacción **READ ONLY**, abarcan **108 tablas**. `after.json` registra `passed: true`, `sameDatabase: true`, `sameSchema: true`, `changedCounts: []` y `changedHashes: []`: ninguna diferencia de contenido, conteo ni esquema detectada.

La verificación de salud y los snapshots no constituyen una prueba de flujos autenticados ni garantizan rendimiento. Las galerías existentes corresponden a escenarios locales sintéticos/candidatos anteriores, no a una sesión de producción autenticada. No se hicieron pruebas adicionales en esta actualización documental.