# Cierre revisado — Tarea 5

Único archivo ejecutable del manifiesto: `artifacts/api-server/src/lib/tarea5-permissions-redaction.no-db.test.mjs`.
Importa exclusivamente assert, fs (lectura), module/createRequire, path, node:test, node:vm y TypeScript ya instalado.
No importa app.ts, index.ts, routers, auth, seed ni un entrypoint de aplicación.

Se transpilan **completos y sin reescribir** tres módulos de producción:

* `lib/sensitive-data.ts`: cero imports; se observan salidas anidadas, datos retenidos y ausencia de mutación.
* `lib/tarea4-gates.ts`: cero imports, tres constantes booleanas false. Dependencia nueva de permisos
  incorporada concurrentemente por Tarea 4: se lee el módulo real, no se fabrica ni cambia su valor.
  Ningún test de Tarea 4 se ejecuta.
* `lib/permisos.ts`: imports Express/RolUsuario son type-only; imports runtime son `drizzle-orm`,
  `@workspace/db`, `@workspace/db/advisory-locks` y `./tarea4-gates`. Los tres primeros nunca se resuelven:
  require es un mapa cerrado de dobles locales. Eq/and construyen predicados en memoria;
  select/from/where/limit/innerJoin seleccionan filas de permisos locales. No generan ni ejecutan SQL.
  Sql/or/isNotNull/transactionAdvisoryLock arrojan error si alguien intenta ejecutarlos.
  Los exports financieros/recuperación con SQL no se invocan. No hay usuarios ni sesiones persistidos
  ni filas de usuarios: el identificador escalar 91 es un contexto de autorización;
  usuariosTable es exclusivamente metadato de columnas del adaptador.
  El enlace de ubicación se representa en el resultado del adaptador; **no** se acredita el JOIN real.

La VM no dispone de process, fetch, sockets, timers ni filesystem, y todo import no revisado falla.
`no-io.cjs` bloquea sockets HTTP/TLS/TCP/UDP, fetch, WebSocket, procesos hijos y drivers SQL en el proceso
de pruebas. El runner externo sólo ejecuta git y Node con argumentos fijos; sus hijos de pruebas reciben
un entorno mínimo sin variables DB y el preload explícito. No se usa CLI tsx, descubrimiento, API ni SQL,
ni siquiera contra PostgreSQL local. TypeScript es compilación en memoria de tres archivos, no build/dist.

Revisión de conexión con producción, sólo lectura:
`routes/productos.ts` importa y llama omitTerminalSensitiveFields; la suite original cache observa
ausencia de precio/costo en TERMINAL. `role-access-matrix.integration.test.ts` observa recursivamente
confidencialidad SUPERVISOR con isSupervisorSensitiveKey. El adaptador prueba también el omisor real
y la preservación de campos operativos, pero **no** que cada endpoint lo invoque.

Originales retenidos sin editar: las tres suites mantienen toda cobertura de login/SQL/endpoints/seed,
prohibida en esta tanda. La separación no sustituye sus aserciones por mocks ni las declara aprobadas.
Tampoco se cambia la política global de test:isolated ni su guard.

## Exclusión Tarea 3 y otros trabajos

Fuente correcta: `reports/e2-verificacion-2026-09-18/baseline-backend-manifest.txt` y
`latest-final-after-backend.log`: cinco fallos en tres archivos:
`clientes-notas-credito.contract.test.ts` (2), `clientes-pagos.contract.test.ts` (1),
`pos-caja-final.contract.test.ts` (2). Ninguno entra al manifiesto ni se edita.
No se usa el manifiesto Prompt S como inventario de suites creadoras de usuarios.
No se ejecutan tests de remate/Tarea 4, ni se toca A+C, devoluciones, guardas E1 o corte E2.

`preflight-import-blocked.log` conserva el primer intento bloqueado correctamente por el import
concurrente no revisado `./tarea4-gates`. No es un mutante ni un verde: después de leer su contenido
y ampliar el cierre a sus constantes reales se repitió la prueba completa.

## Identidad y límites

`execution-identity.json` registra commit completo, árbol de trabajo capturado con índice Git temporal
(sin modificar staging), hashes SHA-256 de todas las entradas ejecutadas, lockfile y versiones.
Cada log referencia ese árbol; logs generados posteriormente no forman parte de ese árbol.
El commit final corresponde al agente principal: **no se hizo commit** y no se atribuye esta prueba
a cambios posteriores. El runner comprueba que los archivos ejecutados no cambiaron durante la prueba.
No hubo verificación visual: el trabajo es sólo de pruebas sin UI/API.