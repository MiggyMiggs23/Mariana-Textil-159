# Línea base segura de contratos frontend

## Captura previa

- Captura de fuente realizada antes de ejecutar la suite o de cualquier edición concurrente:
  `/tmp/mariana-textil-baseline-20260917T155749Z/source/source-and-suite.tgz`
- Commit en la captura: `b08408eb74517cb6ed655e6c80a930c0e652c6e9`
- Estado Git en la captura: limpio.
- La captura incluye `artifacts/mariana-textil/src`, sus `package`/`tsconfig`, el
  runner de typecheck, `pnpm-lock.yaml` y el informe previo
  `reports/verificacion-suites-sin-poblacion.md`.

## Inspección de suite y runner

El paquete frontend declara `test: "tsx --test src/**/*.contract.test.ts"`, que
no cubre los tests `.render.test.ts`, `.test.ts` ni los tres `.test.mjs` de
regresión PDF. El runner utilizado por `pnpm run typecheck` fue inspeccionado
antes de ejecutar: `scripts/src/typecheck-runner.mjs` descubre todos los
paquetes `artifacts/*`/`scripts`, ejecuta librerías primero y luego cada paquete
secuencialmente sin abortar silenciosamente ante un fallo previo.

La suite frontend amplia se construyó con `find ... | sort`, se inventarió en
un archivo explícito y se pasó al runner mediante rutas explícitas. Se
descubrieron 102 archivos de prueba; 99 son seguros para este alcance. Se
excluyeron y registraron explícitamente, no silenciosamente, estos tres:

1. `src/pages/entrada-etiquetas-pdf-regression.test.mjs`
2. `src/pages/laser-documents-pdf-regression.test.mjs`
3. `src/pages/laser-other-documents-pdf-regression.test.mjs`

Esos archivos importan `node:child_process`, levantan Chromium/servidores o
usan `fetch`/WebSocket hacia una aplicación; requieren un workflow web activo
y contradicen la prohibición de network/API restart de esta línea base.

## Manifiesto y comando reproducible

- Manifiesto seguro explícito (99 rutas): `/tmp/mariana-textil-suite-amplia-baseline.manifest`
- Exclusiones explícitas: `/tmp/mariana-textil-suite-amplia-baseline-exclusions.txt`
- Inventario auxiliar: `/tmp/mariana-textil-frontend-baseline-files.txt`
- Log completo: `/tmp/mariana-textil-suite-amplia-baseline.log`
- Código de salida: `/tmp/mariana-textil-suite-amplia-baseline.exit` (`1`)

Comando exacto:

```sh
(cd artifacts/mariana-textil &&
  env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test \
  pnpm exec tsx --test $(cat /tmp/mariana-textil-suite-amplia-baseline.manifest))
```

No se ejecutó descubrimiento por defecto, `test:isolated`, una suite API, un
servidor ni un workflow. El entorno no recibió variables de conexión y los
tests seguros no hacen `fetch`, HTTP, `child_process`, escritura de archivos
de aplicación, conexión de base de datos, creación de usuarios o sesiones.

## Resultado baseline

| Alcance | Archivos | Tests | Pasaron | Fallaron | Skipped |
|---|---:|---:|---:|---:|---:|
| Frontend seguro amplio | 99 | 354 | 337 | 17 | 0 |

El resultado no es verde: se conservaron los 17 fallos reales en el log; no se
convirtieron fallos en skips.

Los cinco contratos requeridos quedaron incluidos en el manifiesto y suman
exactamente 16 tests:

| Archivo | Tests | Pasaron | Fallaron | Skipped |
|---|---:|---:|---:|---:|
| `src/components/reportes/report-explanations.contract.test.ts` | 2 | 1 | 1 | 0 |
| `src/pages/detail-link-tables.contract.test.ts` | 3 | 2 | 1 | 0 |
| `src/pages/productos.contract.test.ts` | 3 | 2 | 1 | 0 |
| `src/pages/salidas-status.contract.test.ts` | 4 | 3 | 1 | 0 |
| `src/pages/salidas-venta-errors.contract.test.ts` | 4 | 3 | 1 | 0 |
| **Total** | **16** | **11** | **5** | **0** |

La referencia previa `reports/verificacion-suites-sin-poblacion.md` registraba
71 archivos/253 tests frontend. Esta captura actual explícita cubre esos
contratos y la expansión segura actual (99 archivos/354 tests), sin omisiones
silenciosas. Los fallos adicionales fuera de los cinco requeridos están
conservados en el log, incluyendo contratos de dashboard, navegación, caja,
cliente, proveedor, nota, kardex, utilidad y otros.

## Typecheck completo baseline

- Log: `/tmp/mariana-textil-typecheck-completo-baseline.log`
- Código de salida: `/tmp/mariana-textil-typecheck-completo-baseline.exit` (`0`)
- Diagnósticos TypeScript únicos: `0`
- Fallos de proceso/parser: `0`
- Paquetes artifacts/scripts seleccionados: `4`
- Resultados de librerías: `7`

Comando exacto:

```sh
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test pnpm run typecheck
```

Resultado: `PASS (all selected checks completed; 0 TypeScript errors)`.
El typecheck puede actualizar archivos `.tsbuildinfo`; no se modificaron
producción ni pruebas.

## Infraestructura para pruebas montadas

- Contratos estáticos: `node:test` + `tsx --test`, leyendo fuente con
  `readFileSync`/`readFile`; no montan una aplicación ni necesitan base de
  datos.
- SSR/montaje: `react-dom/server` (`renderToStaticMarkup`) y React real; los
  ejemplos existentes son
  `src/components/cliente-nota-credito.render.contract.test.ts`,
  `src/components/cliente-nota-estado-badge.render.test.ts` y
  `src/pages/detail-identity-links.render.test.ts`.
- Helper de bundle: `src/render-test-bundle.ts`. Usa el `esbuild` ya disponible
  desde `artifacts/api-server`, JSX automático, alias `@/` y aliases inyectados
  para `@workspace/api-client-react`; limpia el bundle temporal en `finally`.
- No se usa `jsdom`, Playwright, instalación de paquetes ni API real para este
  patrón. Los dobles locales se escriben únicamente bajo `/tmp` y se eliminan
  al terminar.
- Patrón recomendado: `loadRenderTestModule(entry, { moduleAliases })`,
  reemplazar el cliente generado por un stub local determinista, montar con
  `renderToStaticMarkup` y validar HTML/identidad/enlaces. Para contratos
  puramente estructurales, preferir lectura de fuente y regex/assertions.

No se modificaron archivos de producción ni de pruebas para obtener esta
evidencia.