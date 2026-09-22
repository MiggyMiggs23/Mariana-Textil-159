# E4 backend — entrega preparada OFF

## Estado y límites

Implementación conectada a los productores reales, no liberada. No se ejecutó
SQL, app, workflow, bundle ni commit. No se tocaron paquetes E2/CLOSED/E3 sellados
ni dists retenidos. Frontend e informe único pertenecen a MAIN.

Contrato acordado: `frontend-contract.md`. Sin cambios posteriores de interfaz.
Codegen y `typecheck:libs` PASS en `logs/codegen.log`. Comprobación sintáctica
en memoria PASS de cinco archivos TS en `logs/backend-syntax.log`; `node --check`
de runner/guard y `bash -n` del runner de tipos PASS. Esto **no equivale** a
typecheck backend, ejecución de tests ni validación PostgreSQL.

**Actualización MAIN:** 32 GREEN y 32 RED aislados PASS en
`logs/backend-2026-09-22T17-43-24.422Z/manifest.json`. El primer typecheck backend
falló únicamente por TS2305: `Tx` no se exporta de `@workspace/db`.
Se corrigió el import **solo de tipo** a `./inventario`, que ya exporta el
tipo derivado de `db.transaction`. El JS emitido antes/después es byte-idéntico,
comprobado en `logs/tx-type-only-fix.log`; no cambia comportamiento de los casos.
Pendiente MAIN repetir solamente typecheck. El manifiesto de tests conserva
correctamente el hash de fuente anterior al ajuste de tipo.

```sh
node reports/tanda-b-20260922/e4/run-backend-offline.mjs
bash reports/tanda-b-20260922/e4/run-backend-types.sh
```

## Conexión real

- `lib/pos.ts:crearSalidaDineroCaja` despacha E4 al repositorio transaccional
  cuando el gate fuente se libere. OFF mantiene el productor anterior;
  rechaza una intención E4 explícita antes de consultar tablas nuevas.
- `routes/pos.ts` preserva permisos de captura, deriva actor del servidor y
  registra revisión bajo sesión autenticada y `cortes/ver`. Error E4 se traduce
  localmente a 400/403/404/409, sin modificar el manejador global.
- `e4-cash-out.ts` decide clasificación, alcance, roles, sesión/cuenta,
  idempotencia y transiciones. Proveedor vacío no evade clasificación.
- `e4-cash-out-repository.ts` escribe el mismo `salidas_dinero_caja` que leen
  corte/reporte y una extensión separada de revisión. Clave global con advisory
  lock, sesión `FOR UPDATE`, revisión `FOR UPDATE` y CAS de versión; operación,
  salida y auditoría comparten transacción. No importa cliente DB en runtime.
- `buildCorteCaja` agrega metadata sin filtrar ni esperar aceptación. El
  cálculo financiero previo suma todos los egresos por cuenta. E2 lee la misma
  salida física y conserva su snapshot al cerrar. Revisión solo altera metadata.
- Histórico sin extensión E4 permanece sin clasificación/revisión; no se migra.
- SQL preparado en `01-preparado.sql`; reversión en `02-reversion-preparada.sql`.
  No auto-ensure, no arranque que aplique migración. La reversión SQL aborta si
  existe evidencia E4; volver código OFF conserva egresos y datos, no los purga.

## Cobertura reproducible preparada

El runner tiene manifiesto explícito de **32 casos**, uno a uno contra un
defecto aislado en copia física. Conserva logs green/red y manifiesto con hashes,
mutación exacta y exit por caso en `logs/backend-<timestamp>/`. Si hay error de
setup, import, sintaxis, red/DB o timeout, no lo acepta como rojo. Un test
seleccionado debe existir y fallar por `ERR_ASSERTION`. Revalida hashes fuente
al terminar; nunca sustituye fuentes vigiladas ni usa symlinks mutables.

Cobertura:

- Gate OFF de captura, revisión y lectura sin repositorio/SQL nuevo.
- Roles, tienda propia, proveedor Mariana/activo/obligatorio, clasificación
  explícita, caja física extraordinaria sin proveedor/Fondo, motivo/monto/sesión.
- Reintento de captura y revisión, divergencia de contenido/actor y decisiones
  concurrentes sobre misma versión.
- ADMIN reclama/acepta, SUPERVISOR responde en su tienda con explicación;
  comprobante ausente válido, enlace inseguro rechazado, sin autoaceptación.
- Ciclo pendiente/reclamo/respuesta/aceptación conserva egreso inmediato y
  permite revisión después del cierre; creación en tres tiendas sintéticas.
- Fallo de última auditoría revierte captura y revisión en repositorio sintético.
- Adaptador real: SQL parametrizado de candados, inserción en tabla canónica,
  metadata/operación/auditoría, CAS y lectura; no SQL enviado a ningún servidor.
- Parsers reales del endpoint de captura, listado, detalle completo de corte y
  revisión preservan metadata. No se usa un cast para añadir campos de respuesta.
- Preload de bloqueo de sockets/fetch/DNS/drivers/hijos verificado por caso propio.

**Límites honestos:** repositorio sintético serializa transacciones y simula
rollback; no acredita scheduling MVCC, constraints/triggers ni rollback real en
PostgreSQL. Adaptador prueba queries producidas, no su ejecución. No hay tests
HTTP con router completo ni arranque del artefacto, y no se ha verificado aquí
la UI. SQL requiere validación/aplicación futura separadamente autorizada.
MAIN conserva responsabilidad de retypecheck y pruebas frontend.

## Ajuste coordinado de permisos operativos

Se añadió `e4CashOutPermission` y se conectó a GET/POST de salidas y catálogo
mínimo de proveedores. ON usa `cobros_pagos`, OFF conserva `cortes`.
Revisión y endpoints administrativos no cambiaron. Contrato frontend actualizado
por instrucción MAIN; ningún archivo frontend tocado por este ajuste.

Dos tests nuevos con mutantes independientes (total declarado ahora 34).
Los 32 casos previamente aceptados no cambiaron su cuerpo ni lógica de dominio;
solo se agregó import del selector y casos al final. MAIN puede ejecutar:

```sh
node reports/tanda-b-20260922/e4/run-backend-offline.mjs E4-PERMISSIONS-ON E4-PERMISSIONS-OFF
bash reports/tanda-b-20260922/e4/run-backend-types.sh
```

El runner verifica nombres no vacíos/duplicados/desconocidos y conserva
manifiesto de selección de 2 sobre total 34. No se ha ejecutado esta selección
desde el subagente. P12 queda documentada en `p12-alcance.md`, sin ampliar E12
ni inventar un permiso de sobregiro.

## Archivos backend/contrato

- Nuevos `artifacts/api-server/src/lib/e4-cash-out{,-repository,.test}.ts`.
- Modificados `artifacts/api-server/src/lib/pos.ts` y `src/routes/pos.ts`.
- OpenAPI y outputs normales de codegen en `lib/api-client-react` y
  `lib/api-zod` (incluidos tipos nuevos de revisión y metadata de corte).
- `replit.md`: regla de implementación E4, sin abrir gates o ampliar vetos.
- Evidencia, SQL/reversión y runners bajo este directorio.

No se identificó contradicción de negocio que impida el alcance backend
implementado. E12 permanece fuera.