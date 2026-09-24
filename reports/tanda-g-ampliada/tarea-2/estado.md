# Tarea 2 — tramo estático / preparación

Estado: preparado, ejecución DB/API pendiente de readiness explícito de MAIN. No se ha conectado a ningún cluster, aplicado DDL, arrancado workflow ni modificado producto.

Fuente inspeccionada: ee1bb641e0513b7df18027ad351a72ebbe99af74 (identidad inicial; cambios paralelos deben registrarse separadamente). Baseline solicitado: currentsource61d strict; el runner exige identidad y rutas del setup, no lo sustituye por HEAD.

Se leyó `.agents/memory/inventory-numeric-boundaries.md` y el antecedente `reports/tanda-g/candidate/negative-api-results.json`: activación METRO/KILO -2 aceptada HTTP 200. Esto es evidencia anterior, NO reproducción de esta tanda.

Handoff requerido: manifiesto con database URL privado de copia, databaseName (prefijo tanda_ga_inventory), dataDirectory, sourceRoot del baseline currentsource61d strict, fixtureManifest, apiOrigin/API pid y credentialsFile. El runner requiere además MAIN_READY=yes explícito. No reutiliza DATABASE_URL ambiental.

La ejecución preparada cubre dos sitios × cuatro unidades × cantidades -2, 0, 1.5, 2 y límites ±9999999.999/10000000 para productores crearRollo, crearEntrada, activarRollo, ajustarRollo, y activación API. Se compara sin/con CHECK en copia, conservando evidencia y copias para teardown MAIN. Corre primero CON CHECK y luego baseline, porque baseline API dejará negativos reales conservados como evidencia. No sanea filas existentes. Si la copia ya contiene negativos, ADD CHECK normal falla y se detiene. El inventario estático enumera además productores no cubiertos por ese barrido; ninguna batería finita demuestra exhaustividad.

Verificación local SIN DB: `node --check build.mjs`, `node --check run.mjs` y transformación esbuild de matrix.ts exitosas. No es typecheck integrado ni resultado funcional. Build/matrix.bundle.mjs es salida generada local, no se debe commitear.

Comandos tras handoff/readiness: `INVENTORY_HANDOFF=/ruta/privada.json node reports/tanda-g-ampliada/tarea-2/build.mjs`; después `MAIN_READY=yes INVENTORY_HANDOFF=/ruta/privada.json node reports/tanda-g-ampliada/tarea-2/run.mjs`. El handoff debe incluir sourceIdentity="currentsource61d-strict", databaseName, databaseUrl, dataDirectory, sourceRoot, fixtureManifest y (obligatorios para aceptación API completa) apiOrigin, apiPid, apiModule, credentialsFile. No imprimir archivo privado. API identity se comprueba en /proc, no se arranca desde el runner.