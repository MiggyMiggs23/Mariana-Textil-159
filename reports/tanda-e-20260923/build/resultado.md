# Build offline final Tanda E — 2026-09-23

## Resultado

**PASS.** Se construyeron una vez API y UI desde la fuente coherente posterior
a las tareas 2/3/4:

- `artifacts/api-server/dist-tanda-e-20260923/index.mjs`
- `artifacts/mariana-textil/dist-tanda-e-20260923/index.html`

El bundle API contiene 12 archivos y el bundle UI 11. Todos los directorios
`dist*` anteriores se conservaron. `build-inputs-before.sha256` y
`build-inputs-after.sha256` son idénticos: no entraron cambios de fuente durante
typecheck/build. Si el browser testing principal cambia cualquier insumo listado
en esos inventarios, este candidato deja de representar la fuente actual y debe
notificarse antes de una liberación.

## Verificaciones

- Typecheck API: PASS, ejecutado una vez.
- Typecheck UI: PASS, ejecutado una vez.
- Check enfocado del error de login: PASS. Confirma el contrato de `ApiError.status`,
  mensaje seguro para HTTP 5xx, conservación del fallback de credenciales para
  no-5xx y presencia del mensaje seguro en el bundle UI final.
- Gates actuales: E3, E4, E7 y E9 ON.
- E3 dirigido OFF; E5 monetario/dirigido/retenido OFF.
- Ingreso E9 al Fondo OFF; Fondo/E10 OFF mediante entorno explícito de build.
- E12 API/UI OFF.

La evidencia está en `build-gates.log`, `login-error-focused.log`,
`login-message-bundle-check.log`, los dos logs de typecheck y
`build-output.log`.

## Comandos de build ejecutados

```sh
API_BUILD_OUTPUT_DIR="$PWD/artifacts/api-server/dist-tanda-e-20260923" NODE_ENV=production FONDO_E10_ENABLED=false node artifacts/api-server/build.mjs
(cd artifacts/mariana-textil && BASE_PATH=/ NODE_ENV=production PORT=20329 VITE_FONDO_E10_ENABLED=false pnpm exec vite build --outDir dist-tanda-e-20260923)
```

Ambos terminaron con exit code 0. `build-bundles.sha256` contiene los hashes de
los 23 archivos finales.

## Recomendación de liberación, no aplicada

Cuando el agente principal autorice el cambio de runtime, los únicos cambios
recomendados para los comandos de desarrollo de los TOML de artefacto son los
siguientes. Conservan los selectores, puerto, host y `strictPort` actuales; sólo
reemplazan la ruta del bundle. Ambas entradas finales existen y los comandos
referidos fueron validados por este build. **No se editaron los TOML ni se
ejecutaron estos comandos.**

API, en `artifacts/api-server/.replit-artifact/artifact.toml`:

```toml
run = "cd /home/runner/workspace && API_STARTUP_MODE=NORMAL API_INSPECTION_BOOT=1 NODE_ENV=development exec node artifacts/api-server/dist-tanda-e-20260923/index.mjs"
```

UI, en `artifacts/mariana-textil/.replit-artifact/artifact.toml`:

```toml
run = "cd /home/runner/workspace/artifacts/mariana-textil && exec pnpm exec vite preview --config vite.config.ts --outDir dist-tanda-e-20260923 --host 0.0.0.0 --port \"$PORT\" --strictPort"
```

No se recomienda apuntar producción al candidato como efecto lateral de este
trabajo: el cambio y reinicio deben quedar en una acción separada y autorizada.

## Advertencias no fatales y límites

Vite informó cinco avisos conocidos de sourcemap y un chunk mayor a 500 kB. La
API informó el bundle principal de 9.0 MB. No se repitieron las pruebas POS6,
E4 ni E7 ya aprobadas por los workers. No se arrancó ni reinició ningún
workflow o aplicación; no se modificó `.replit`, `artifact.toml` ni runtime; no
hubo acceso ni escrituras a base de datos, SQL, secretos o commits.