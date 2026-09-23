# Build combinado offline E4 — 2026-09-23

Resultado: **PASS**. Se construyeron una sola vez la API y la UI desde las
fuentes actuales, ambas con exit code 0. No se inició ni reinició ningún
workflow o aplicación, no se usó una base real, no se editaron TOML ni fuentes,
y no se realizó commit.

## Gates verificados antes del build

La revisión estática de fuente terminó en PASS:

- E4 API y UI: ON.
- E12 API y UI: OFF.
- E3 ordinario, matriz, remate API/UI/matriz, precio mínimo API/UI y borrado
  individual de historial API/UI: conservados ON.
- E3 dirigido: OFF.
- E11 lectores, UI y conciliación: conservados ON; asignación de perfiles y
  preparación E5: OFF.
- E1 (capturas, pendientes, atribución, devoluciones y evidencias), E5, E7 y E9:
  OFF en API/UI según corresponda.

La evidencia línea por línea está en `build-gates.log`. La comprobación leyó
archivos como texto; no importó módulos de runtime ni accedió a una base. Antes
de construir también confirmó que ambos destinos nuevos no existían.

## Comandos exactos de build

Ejecutados desde `/home/runner/workspace`, en este orden y sin ejecutar
typechecks nuevamente:

```sh
API_BUILD_OUTPUT_DIR="$PWD/artifacts/api-server/dist-e4-20260923" NODE_ENV=production node artifacts/api-server/build.mjs
(cd artifacts/mariana-textil && BASE_PATH=/ NODE_ENV=production PORT=20329 pnpm exec vite build --outDir dist-e4-20260923)
```

## Bundles resultantes

- API: `/home/runner/workspace/artifacts/api-server/dist-e4-20260923/`
  - entrada: `/home/runner/workspace/artifacts/api-server/dist-e4-20260923/index.mjs`
- UI: `/home/runner/workspace/artifacts/mariana-textil/dist-e4-20260923/`
  - entrada: `/home/runner/workspace/artifacts/mariana-textil/dist-e4-20260923/index.html`

Los bundles anteriores se conservaron. `build-output.log` registra 12 archivos
en el bundle API, 11 en el bundle UI, las entradas PASS y el inventario de
directorios `dist*` previos. `build-bundles.sha256` contiene SHA-256 de todos los
archivos de ambos bundles nuevos.

## Logs

- `build-gates.log`: inventario estático de gates y precondición de destinos.
- `build-api.log`: build API exit 0.
- `build-ui.log`: build UI exit 0.
- `build-output.log`: entradas, conteos y preservación de bundles anteriores.
- `build-bundles.sha256`: hashes de los artefactos finales.

Vite emitió avisos no fatales de sourcemap para cinco componentes UI y de un
chunk mayor a 500 kB. El build UI finalizó correctamente. No se capturó ni
volcó el entorno ni sus valores.