# Tarea 2 — tramo estático / preparación

Estado: preparado, ejecución DB/API pendiente de readiness explícito de MAIN. No se ha conectado a ningún cluster, aplicado DDL, arrancado workflow ni modificado producto.

## Tramo 2 — readiness recibido / baseline productores ejecutado

MAIN autorizó cluster55442 y API43852. Se construyó handoff privado desde setup, sin imprimir secretos. Identidad efectiva SQL: tanda_ga_inventory / puerto55442 / ga_inventory; directorio/proceso comprobados por postmaster.pid y cmdline. No se elevó el rol (data_directory no es visible al no-owner; intento read-only devolvió 42501 y se reemplazó por comprobación de proceso).

`results-baseline-services.json`: 224 casos reales, todos en transacciones rollback, dos sitios y cuatro unidades; 32/32 controles válidos cantidad2 aceptados. -2 aceptado por crearRollo y activarRollo para METRO/KILO en ambos sitios; crearEntrada aceptó -2 en **las cuatro unidades** por servicio directo. ajustarRollo rechazó -2 en todas. Esto no afirma que API crearEntrada lo acepte: su guarda independiente de positividad sigue documentada.

Cambio de procedimiento: el rol ga_inventory NO puede ALTER. El runner ahora NO contiene DDL y corre una fase por invocación (`INVENTORY_PHASE=baseline-services|check|baseline`). MAIN debe ejecutar el operador acotado antes de fase check:

`MAIN_COPY_OPERATOR=yes node reports/tanda-g-ampliada/tarea-2/copy-operator.mjs add`

El operador conecta exclusivamente localhost55442/tanda_ga_inventory como postgres, verifica SQL db/directorio/puerto/actor, y agrega SOLO tanda_ga_t2_physical_nonnegative con CHECK(cantidad_actual>=0). No usa URL ambiental, NOT VALID ni saneamiento. Una copia ya corrupta causa fallo normal al agregar. Después de fase check, MAIN ejecuta mismo comando con `drop`; luego corre baseline API y conserva corrupción de ensayo. Operador preparado, **no ejecutado por este worker**.

Comando runner: `MAIN_READY=yes INVENTORY_PHASE=check INVENTORY_HANDOFF=.local/tanda-g-ampliada/inventory-handoff.json node reports/tanda-g-ampliada/tarea-2/run.mjs`. Pendientes: instalación MAIN, fase check, retiro MAIN y fase baseline API. Las instrucciones históricas de instalación automática del primer tramo quedan sustituidas por este procedimiento no-owner.

## Tramo 3 — CHECK y API ejecutados

MAIN instaló constraint en copia y reinició procesos privados; handoff PID refrescado. `operator-add.json` acredita destino inventory55442. `results-check.json`: 224 casos servicios + 56 solicitudes API; 48/48 controles de comparación aprobados. Constraint observado convalidated=true. API METRO/KILO -2: HTTP500, fila permanece PROGRAMADO/10.000 y cero movimientos, ambos sitios. PIEZA/BOLSA -2: HTTP400 por guarda existente. Cantidad2: HTTP200 en cuatro unidades/dos sitios. Es protección de persistencia, **no mejora UX**: error500 sigue siendo pendiente de diseño/producto; no se corrigió automáticamente.

Hubo dos intentos previos sin ensayos por URL login con doble slash en runner. Se corrigió a origin.origin, sin modificación de producto. Luego ejecución exitosa completa.

Se amplió runtime en `chains.ts` / `chains-check.json`: 38/38 escenarios con rollback, cuatro unidades/dos sitios. Transferencia inmediata ida/vuelta conserva cantidad10 y asientos -10/+10, origen obsoleto rechazado; venta y reversión devuelve DISPONIBLE10; mostrador y salida extraordinaria dejan0 y rechazan venta posterior; BOLSA FIFO consume2 con ledger-2, rechaza negativo e insuficiencia. Reconstrucción caché real invocada en cada cadena y revertida junto al caso. Son secuencias, NO carreras simultáneas.

Pendiente inmediato: MAIN retirar SOLO constraint de ensayo mediante `MAIN_COPY_OPERATOR=yes node reports/tanda-g-ampliada/tarea-2/copy-operator.mjs drop`, luego worker ejecuta fase baseline API. No se ha aplicado constraint en aplicación ni migración. Aún no se prueban en esta tanda recepción en tránsito, consumo metreado con entrada autoritativa, reactivación auditoría, costos/piso/metadatos ni carreras simultáneas; no se reportan aprobados.

Fuente inspeccionada: ee1bb641e0513b7df18027ad351a72ebbe99af74 (identidad inicial; cambios paralelos deben registrarse separadamente). Baseline solicitado: currentsource61d strict; el runner exige identidad y rutas del setup, no lo sustituye por HEAD.

Se leyó `.agents/memory/inventory-numeric-boundaries.md` y el antecedente `reports/tanda-g/candidate/negative-api-results.json`: activación METRO/KILO -2 aceptada HTTP 200. Esto es evidencia anterior, NO reproducción de esta tanda.

Handoff requerido: manifiesto con database URL privado de copia, databaseName (prefijo tanda_ga_inventory), dataDirectory, sourceRoot del baseline currentsource61d strict, fixtureManifest, apiOrigin/API pid y credentialsFile. El runner requiere además MAIN_READY=yes explícito. No reutiliza DATABASE_URL ambiental.

La ejecución preparada cubre dos sitios × cuatro unidades × cantidades -2, 0, 1.5, 2 y límites ±9999999.999/10000000 para productores crearRollo, crearEntrada, activarRollo, ajustarRollo, y activación API. Se compara sin/con CHECK en copia, conservando evidencia y copias para teardown MAIN. Corre primero CON CHECK y luego baseline, porque baseline API dejará negativos reales conservados como evidencia. No sanea filas existentes. Si la copia ya contiene negativos, ADD CHECK normal falla y se detiene. El inventario estático enumera además productores no cubiertos por ese barrido; ninguna batería finita demuestra exhaustividad.

Verificación local SIN DB: `node --check build.mjs`, `node --check run.mjs` y transformación esbuild de matrix.ts exitosas. No es typecheck integrado ni resultado funcional. Build/matrix.bundle.mjs es salida generada local, no se debe commitear.

Comandos tras handoff/readiness: `INVENTORY_HANDOFF=/ruta/privada.json node reports/tanda-g-ampliada/tarea-2/build.mjs`; después `MAIN_READY=yes INVENTORY_HANDOFF=/ruta/privada.json node reports/tanda-g-ampliada/tarea-2/run.mjs`. El handoff debe incluir sourceIdentity="currentsource61d-strict", databaseName, databaseUrl, dataDirectory, sourceRoot, fixtureManifest y (obligatorios para aceptación API completa) apiOrigin, apiPid, apiModule, credentialsFile. No imprimir archivo privado. API identity se comprueba en /proc, no se arranca desde el runner.