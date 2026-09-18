# Bundle autorizado desde la revisión E10

Fecha UTC de autorización y comprobación: `2026-09-18T22:06:50Z`.

## Identidad autorizada

- Commit fuente: `7cb77f8cfc6287fa51325a25122c48af392a7ada`.
- Árbol Git: `c36407dc8310b9da47a0d3bbc40ffe44c6183f60`.
- Bundle `dist/index.mjs`: `3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98`.
- Línea base: `80eaa93d4300e86d9be54492e634f88f0c0abc90`.
- Ancestría: **PASS**; `git merge-base --is-ancestor 80eaa93d… 7cb77f8c…` terminó con código cero.

El propietario aceptó expresamente este resultado como el bundle autorizado. El
hash identifica y protege estos bytes a partir de ahora; la procedencia se
acredita por el commit y por las entradas fuente limpias.

## Fuente limpia de la construcción

La compilación se hizo sobre una extracción `git archive` del commit exacto, no
sobre el worktree activo. Por ello ese directorio no contiene metadatos `.git` y
no corresponde afirmar que allí se ejecutó `git status`.

La comprobación equivalente y más fuerte para esa extracción dio:

- 3,116 rutas versionadas comparadas, una por una, contra los blobs y enlaces del
  commit;
- faltantes: cero;
- contenidos distintos: cero;
- `@workspace/db` y `@workspace/api-zod` resolvieron dentro de la extracción;
- no hubo instalación o actualización de dependencias;
- `build.mjs` solamente escribió `dist`, que no forma parte del archivo fuente.

La comparación se repitió sobre la extracción conservada después de compilar.
Por tanto, las entradas versionadas usadas permanecen exactamente iguales al
commit. El protocolo, versiones y hashes de entradas están en `protocolo.md` y
`source-and-dependencies.txt`.

## Preflight y modo de arranque autorizado

El arranque previsto usaba primero `runtime-preflight.mjs`, entonces fijado por
SHA-256
`ba2dc1cea6a0b449bb5f2f7faeed09a533b1675c364cbba742bc90386311df94`.
Ese proceso abre una transacción `REPEATABLE READ READ ONLY`, compara identidad,
69 tablas, 1,519 filas de catálogo, el SHA canónico E10
`37f6af5a2e06748a8499b995caeec072770090c36f2ad741d35c65953421bec8`,
las tres guardas E1 cerradas/habilitadas y la ausencia de event triggers
habilitados, y termina con `ROLLBACK`.

El comando previsto comprobaba primero el hash del preflight y el hash del
bundle, después ejecutaba el preflight y, solo si este aprobaba, ejecutaba la
API. **El incidente posterior invalidó la afirmación de modo efectivo:** la
metadata administrada no hizo efectivo `API_INSPECTION_BOOT=1` para Node, que
entró al modo normal. El workflow fue detenido y ahora permanece bloqueado. Ver
`../recuperacion/incidente-arranque-escritor/resultado.md`.

La revisión 7cb crea el pool de aplicación exclusivamente desde `DATABASE_URL`;
el preflight `psql` usa las variables libpq `PG*`. Antes del arranque se
comprobaron ambos canales en transacciones `REPEATABLE READ READ ONLY`: host,
puerto, base y usuario configurados coinciden, y ambos resolvieron a la misma
identidad (`heliumdb`, OID `16384`, rol `postgres`, PostgreSQL `160010`,
`system_identifier` `7676894468493955091`, mismo directorio de datos y conexión
local efectiva). No se imprimieron ni conservaron contraseñas.

## Instalación preparada

El candidato completo —bundle, mapas, workers Pino y fuentes tipográficas— fue
copiado a `artifacts/api-server/dist`; su `index.mjs` instalado se volvió a
comprobar con el hash autorizado. El `dist` sustituido con SHA-256
`75d1e77f34e040af2c05e86befd6e2a6f288ca5fa5683f52a2919651c31794b9`
se preservó en
`.local/api-dist-before-authorized-7cb-20260918T220650Z`.

El comando administrado había quedado configurado con dos barreras antes de
importar la API: hash exacto del preflight y hash exacto del bundle. Después
ejecutaba el preflight y solo en PASS hacía `exec` del bundle. Aunque la
configuración declaraba `API_INSPECTION_BOOT=1` y `NODE_ENV=development`, el
incidente demostró que no fueron efectivas para Node.

La configuración por sí sola no es un arranque. El reinicio del workflow y su
comprobación operativa deben registrarse separadamente por el agente principal.

El segundo reinicio sí ocurrió después: ejecutó mantenimiento normal no
autorizado y fue detenido. Tras revisar el incidente, el agente principal aceptó
la corrección dentro de la autorización vigente. El comando final exporta
explícitamente inspection/desarrollo, ejecuta el preflight que valida esas
variables antes de consultar la base y vuelve a comprobar el hash del bundle
justo antes de `exec`.

El arranque controlado final aprobó a `2026-09-18T22:16:58Z`: preflight PASS,
mensaje explícito de inspection con inicializadores/backfill/poller pausados,
puerto 8080 escuchando y `/api/healthz` HTTP 200. El bundle autorizado permanece
en ejecución. Evidencia final y el incidente histórico en
`../recuperacion/incidente-arranque-escritor/resultado.md`.

## Primer intento y corrección de ruta

El primer intento administrado falló antes de ejecutar Node o consultar la base:
el workflow tenía como directorio de trabajo el directorio del artefacto y la
ruta relativa de `runtime-preflight.mjs` no existía desde allí. `sha256sum`
devolvió “No such file or directory” y no se importó el bundle.

A las `2026-09-18T22:10:20Z` se corrigió únicamente el comando administrado,
mediante validación de `artifact.toml`. Ahora comienza con
`cd /home/runner/workspace`, que es la raíz confirmada del proyecto, y ambas
comparaciones usan `test "$(sha256sum ... | cut ...)" = <hash>`. Así, una ruta
ausente o una salida vacía falla cerrada sin el diagnóstico ambiguo del operador
unario. Los hashes, el preflight, el bundle y sus variables de modo permanecen
sin cambios. Esta corrección no arrancó el workflow.
