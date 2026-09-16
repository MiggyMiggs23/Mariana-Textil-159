# Prompt B — cuatro errores de tipos y verificación completa

Fecha local: **2026-09-15**, Ciudad de México.

## Resultado ejecutivo

- Comando corregido **antes** de modificar los cuatro errores.
- Inventario real: **4 errores únicos**, no 2; **6 emisiones** porque scripts repetía los dos de API.
- `pnpm run typecheck` final: **0 errores**, código 0.
- Codegen: **sin diferencias**, comparación SHA-256 idéntica de todos los archivos fuente de cliente API y Zod antes/después.
- `pnpm run build` completo: **aprobado**, código 0.
- Mismo manifiesto de pruebas existentes antes/después: **93 casos, 88 aprobados, 5 fallos preexistentes, 0 omitidos**. No se repararon esas pruebas; no es aprobación de toda la suite del repositorio.
- Regresiones nuevas del verificador: **8/8**.
- Comprobación de valores efectivos Excel/Alertas: **8/8**.
- Desfase de vencimiento localizado y reproducido, **pendiente sin corregir**, como se solicitó.

## Secuencia y precisión de la evidencia

1. Se ejecutó y conservó la salida del comando original.
2. Se cambió únicamente el verificador; se ejecutó nuevamente con los errores todavía presentes y se obtuvo el inventario completo.
3. Se ejecutó el build real todavía con errores: salió con código 1, sin compilar los artefactos.
4. Se guardó `reports/prompt-b-diagnostico-previo.md` y se explicó en el chat el comportamiento de cada error **antes de corregirlo**.
5. Se aplicaron los cambios mínimos, se compararon pruebas y valores, se endurecieron/probaron los estados de fallo del verificador y se realizaron los chequeos finales.

**Matiz frente al planteamiento inicial:** la salida original sí anunciaba API, frontend y scripts como iniciados en paralelo, pero el proceso terminaba sin recoger los resultados completos de los dos últimos. Anunciar el inicio no acredita que el chequeo haya terminado.

## Bloque 1 — verificador

`typecheck` raíz ejecuta el orquestador de `scripts/src/`. Descubre artefactos y scripts desde pnpm, comprueba las seis bibliotecas referenciadas y después cada paquete seleccionado, sin cancelar los restantes por un fallo previo. La biblioteca API-spec aporta el generador, no un proyecto adicional de TypeScript referenciado por el build de bibliotecas.

- Fuerza `tsc --build --pretty false --stopBuildOnErrors false`.
- Resume ubicación/código/mensaje y paquete emisor; deduplica sólo el total.
- Reporta diagnósticos globales, fallos de proceso/parser y estados `UNVERIFIED` cuando no se puede acreditar una biblioteca.
- Falla ante selección vacía, ejecutable ausente, señal o errores, incluso si la salida parcial parecía limpia.
- `build` conserva `typecheck && …`; después de pasar esa barrera, `pnpm -r --no-bail --if-present run build` recoge también todos los resultados de compilación.

La regresión con dos bibliotecas fallidas se ejecutó con **TypeScript 5.9 real en un directorio temporal**, no introduciendo errores en la app. Las demás pruebas cubren deduplicación, diagnóstico global, señal, ejecutable ausente, selección vacía y barrera de build.

## Bloques 2 y 3 — inventario y correcciones

Las ubicaciones siguientes corresponden al inventario previo; la eliminación de líneas puede desplazarlas después.

| Paquete | Archivo / ubicación previa | Código | Comportamiento y corrección |
|---|---|---|---|
| API | `src/lib/pos.ts:445:41` | TS2339 | Fecha normalizada `string | null`; rama Date muerta. Se pasa directamente el valor, sin modificar la fecha ni su contrato. |
| API | `src/routes/clientes.ts:1380:10` | TS1117 | La segunda llave sobrescribía la primera. Se elimina la primera y se conserva la conversión numérica final para Excel. |
| Frontend | `src/pages/alertas.tsx:241:58` | TS2339 | Prop del badge leía `pendiente`, ausente. Usa `importe`; el badge no consume esa prop para renderizar y no cambia visualmente. |
| Frontend | `src/pages/alertas.tsx:260:54` | TS2339 | `formatNumber(undefined)` mostraba «—». Ahora usa el saldo vigente `importe` entregado por la API. **Sí cambia el importe visible.** |

Los mensajes completos y todas sus emisiones figuran en las salidas pegadas abajo y en el diagnóstico previo. No se añadieron `any`, supresiones ni tipos ensanchados para silenciar errores.

### Excel: cuál quedó, cuál se eliminó y qué se probó

- Eliminada: la primera propiedad abreviada `saldoPendiente`, que entregaría texto monetario o null.
- Conservada: `saldoPendiente: saldoPendiente == null ? null : toExcelNumber(saldoPendiente)`.
- No eran idénticas en tipo: `"123.45"` es texto; `123.45` es número. La segunda era ya la efectiva en ejecución.
- La comprobación extrae mediante AST el objeto real anterior y el actual, los evalúa sin cargar routers/DB y compara resultados. Conserva el número, cero, null y los demás campos; las claves duplicadas pasan de dos a una.
- **No cambia el contenido exportado.** Por ello no se activó la condición de generar un XLSX y comprobarlo con un lector independiente. No se presenta una generación de archivo ni una validación independiente de XLSX que no se realizaron.

### Fecha de vencimiento: hallazgo separado

La prueba usa las clases/parsers instalados, el esquema Zod generado y el formateador de impresión reales. Drizzle entrega texto calendario; el parser de pg directo es una vía distinta. No se cambió el schema para hacer que el dato fuese Date.

Con `TZ=America/Mexico_City`:

`2026-10-02` → esquema del endpoint de tarjeta → `2026-10-02T00:00:00.000Z` → pantalla `01/10/2026`.

La impresión mediante `formatDateOnlyMx` conserva `02/10/2026`. La rama muerta eliminada de POS no causa ese corrimiento: la conversión sucede en otra frontera del mismo campo. No se modificaron esa coerción, el formatter de la tarjeta ni la impresión.

Evidencias: `prompt-b-fecha-runtime.ts` y los cuatro logs `prompt-b-fecha-*.txt`.

## Bloque 4 — prevención y decisión pendiente

No se encontró CI ni hook que exija el typecheck antes de integrar cambios. El build raíz manual sí lo exige. `scripts/post-merge.sh` existe, no comprueba tipos y contiene operaciones ajenas a este trabajo: no se ejecutó ni modificó.

**Recomendación pendiente de aprobación:** incorporar un chequeo obligatorio de CI con `pnpm run typecheck` y `pnpm --filter @workspace/scripts run test:typecheck-runner`, bloqueando la integración ante cualquier fallo. No se creó CI ni hook por cuenta propia. Tener pruebas disponibles no equivale a tener una barrera automática instalada.

`replit.md` quedó actualizado con cero errores, los cuatro comportamientos, la regla de recorridos completos y el pendiente de fecha.

## Suites existentes: antes y después

| Grupo del manifiesto | Total | Antes PASS / FAIL | Después PASS / FAIL |
|---|---:|---:|---:|
| Kardex focal | 3 | 3 / 0 | 3 / 0 |
| Backend puro/contratos | 50 | 48 / 2 | 48 / 2 |
| Frontend puro/render/contratos | 40 | 37 / 3 | 37 / 3 |
| **Total** | **93** | **88 / 5** | **88 / 5** |

Mismas cinco firmas de fallo: regex de moneyState en clientes-notas-credito, regex de ruta de ticket en kardex-block2, React no definido en dos pruebas de render y regex de estadoNota en nota. No se las reparó ni se inventó que constituyen exactamente las cinco pruebas frágiles mencionadas por el propietario. Los 69 vetos de rol no se modificaron.

Manifiesto y comandos exactos: `prompt-b-pruebas-baseline-manifest.txt`. Los seis logs completos baseline/after están guardados como `.txt`, no sólo como `.log` ignorados. Esta selección no comprende integraciones con DB, autenticación ni todas las pruebas del repositorio.

## Límites y conservación

- Sin usuarios, ADMIN, sesiones de prueba, SQL de escritura ni comandos de migración creados/ejecutados para la verificación.
- No se modificaron reglas financieras, saldo a favor, vetos históricos ni Bloque 5.
- Los servicios se reiniciaron una vez al final; el arranque normal de API ejecutó sus inicializadores existentes. No se afirma identidad de DB sin una comparación que no se realizó.
- Ambos workflows arrancaron. La captura `prompt-b-preview.jpg` muestra login y 401 sin sesión: **no acredita Alertas autenticada ni un recorrido financiero real**.
- Build conserva advertencias de sourcemaps y tamaño de bundle; no se ocultaron. Desapareció el warning de llave duplicada.
- Revisión del código: PASS, sin bloqueadores detectados.

## Salidas completas de comandos

Los siguientes anexos se incorporan literalmente desde las capturas, incluyendo códigos de salida. Las salidas previas se conservan como evidencia histórica del orden de trabajo, no como estado actual.
### 1. Typecheck original — antes de cambiar el comando

```text

> workspace@0.0.0 typecheck /home/runner/workspace
> pnpm run typecheck:libs && pnpm -r --filter "./artifacts/**" --filter "./scripts" --if-present run typecheck


> workspace@0.0.0 typecheck:libs /home/runner/workspace
> tsc --build

Scope: 3 of 11 workspace projects
artifacts/api-server typecheck$ tsc -p tsconfig.json --noEmit
artifacts/mariana-textil typecheck$ tsc -p tsconfig.json --noEmit
scripts typecheck$ tsc -p tsconfig.json --noEmit
artifacts/api-server typecheck: src/lib/pos.ts(445,41): error TS2339: Property 'toISOString' does not exist on type 'never'.
artifacts/api-server typecheck: src/routes/clientes.ts(1380,10): error TS1117: An object literal cannot have multiple properties with the same name.
artifacts/api-server typecheck: Failed
/home/runner/workspace/artifacts/api-server:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @workspace/api-server@0.0.0 typecheck: `tsc -p tsconfig.json --noEmit`
Exit status 1
 ELIFECYCLE  Command failed with exit code 1.

EXIT_CODE=1
```

### 2. Typecheck completo — comando corregido, errores aún presentes

```text

> workspace@0.0.0 typecheck /home/runner/workspace
> node ./scripts/src/typecheck-runner.mjs


> @workspace/api-server@0.0.0 typecheck /home/runner/workspace/artifacts/api-server
> tsc -p tsconfig.json --noEmit

src/lib/pos.ts(445,41): error TS2339: Property 'toISOString' does not exist on type 'never'.
src/routes/clientes.ts(1380,10): error TS1117: An object literal cannot have multiple properties with the same name.
 ELIFECYCLE  Command failed with exit code 1.

> @workspace/mariana-textil@0.0.0 typecheck /home/runner/workspace/artifacts/mariana-textil
> tsc -p tsconfig.json --noEmit

src/pages/alertas.tsx(241,58): error TS2339: Property 'pendiente' does not exist on type 'AdminAlertaCredito'.
src/pages/alertas.tsx(260,54): error TS2339: Property 'pendiente' does not exist on type 'AdminAlertaCredito'.
 ELIFECYCLE  Command failed with exit code 2.

> @workspace/scripts@0.0.0 typecheck /home/runner/workspace/scripts
> tsc -p tsconfig.json --noEmit

../artifacts/api-server/src/lib/pos.ts(445,41): error TS2339: Property 'toISOString' does not exist on type 'never'.
../artifacts/api-server/src/routes/clientes.ts(1380,10): error TS1117: An object literal cannot have multiple properties with the same name.
 ELIFECYCLE  Command failed with exit code 2.

=== Typecheck summary ===
Packages selected: 3
PASS @workspace/scanned-code [library] (0 TypeScript errors)
PASS @workspace/number-format [library] (0 TypeScript errors)
PASS @workspace/metered-pricing [library] (0 TypeScript errors)
PASS @workspace/db [library] (0 TypeScript errors)
PASS @workspace/api-client-react [library] (0 TypeScript errors)
PASS @workspace/api-zod [library] (0 TypeScript errors)
PASS @workspace/libraries [library-stage] (0 TypeScript errors)
FAIL @workspace/api-server [package] (2 TypeScript errors)
  artifacts/api-server/src/lib/pos.ts:445:41 TS2339: Property 'toISOString' does not exist on type 'never'.
  artifacts/api-server/src/routes/clientes.ts:1380:10 TS1117: An object literal cannot have multiple properties with the same name.
FAIL @workspace/mariana-textil [package] (2 TypeScript errors)
  artifacts/mariana-textil/src/pages/alertas.tsx:241:58 TS2339: Property 'pendiente' does not exist on type 'AdminAlertaCredito'.
  artifacts/mariana-textil/src/pages/alertas.tsx:260:54 TS2339: Property 'pendiente' does not exist on type 'AdminAlertaCredito'.
FAIL @workspace/scripts [package] (2 TypeScript errors)
  artifacts/api-server/src/lib/pos.ts:445:41 TS2339: Property 'toISOString' does not exist on type 'never'.
  artifacts/api-server/src/routes/clientes.ts:1380:10 TS1117: An object literal cannot have multiple properties with the same name.
Unique TypeScript diagnostics: 4
Repeated diagnostic emissions: 2
Process/parser failures: 0
RESULT: FAIL (all selected checks were attempted)
 ELIFECYCLE  Command failed with exit code 1.

EXIT_CODE=1
```

### 3. Build bloqueado con los errores todavía presentes

```text

> workspace@0.0.0 build /home/runner/workspace
> pnpm run typecheck && pnpm -r --if-present run build


> workspace@0.0.0 typecheck /home/runner/workspace
> node ./scripts/src/typecheck-runner.mjs


> @workspace/api-server@0.0.0 typecheck /home/runner/workspace/artifacts/api-server
> tsc -p tsconfig.json --noEmit

src/lib/pos.ts(445,41): error TS2339: Property 'toISOString' does not exist on type 'never'.
src/routes/clientes.ts(1380,10): error TS1117: An object literal cannot have multiple properties with the same name.
 ELIFECYCLE  Command failed with exit code 1.

> @workspace/mariana-textil@0.0.0 typecheck /home/runner/workspace/artifacts/mariana-textil
> tsc -p tsconfig.json --noEmit

src/pages/alertas.tsx(241,58): error TS2339: Property 'pendiente' does not exist on type 'AdminAlertaCredito'.
src/pages/alertas.tsx(260,54): error TS2339: Property 'pendiente' does not exist on type 'AdminAlertaCredito'.
 ELIFECYCLE  Command failed with exit code 1.

> @workspace/scripts@0.0.0 typecheck /home/runner/workspace/scripts
> tsc -p tsconfig.json --noEmit

../artifacts/api-server/src/lib/pos.ts(445,41): error TS2339: Property 'toISOString' does not exist on type 'never'.
../artifacts/api-server/src/routes/clientes.ts(1380,10): error TS1117: An object literal cannot have multiple properties with the same name.
 ELIFECYCLE  Command failed with exit code 1.

=== Typecheck summary ===
Packages selected: 3
PASS @workspace/scanned-code [library] (0 TypeScript errors)
PASS @workspace/number-format [library] (0 TypeScript errors)
PASS @workspace/metered-pricing [library] (0 TypeScript errors)
PASS @workspace/db [library] (0 TypeScript errors)
PASS @workspace/api-client-react [library] (0 TypeScript errors)
PASS @workspace/api-zod [library] (0 TypeScript errors)
PASS @workspace/libraries [library-stage] (0 TypeScript errors)
FAIL @workspace/api-server [package] (2 TypeScript errors)
  artifacts/api-server/src/lib/pos.ts:445:41 TS2339: Property 'toISOString' does not exist on type 'never'.
  artifacts/api-server/src/routes/clientes.ts:1380:10 TS1117: An object literal cannot have multiple properties with the same name.
FAIL @workspace/mariana-textil [package] (2 TypeScript errors)
  artifacts/mariana-textil/src/pages/alertas.tsx:241:58 TS2339: Property 'pendiente' does not exist on type 'AdminAlertaCredito'.
  artifacts/mariana-textil/src/pages/alertas.tsx:260:54 TS2339: Property 'pendiente' does not exist on type 'AdminAlertaCredito'.
FAIL @workspace/scripts [package] (2 TypeScript errors)
  artifacts/api-server/src/lib/pos.ts:445:41 TS2339: Property 'toISOString' does not exist on type 'never'.
  artifacts/api-server/src/routes/clientes.ts:1380:10 TS1117: An object literal cannot have multiple properties with the same name.
Unique TypeScript diagnostics: 4
Repeated diagnostic emissions: 2
Process/parser failures: 0
RESULT: FAIL (all selected checks were attempted)
 ELIFECYCLE  Command failed with exit code 1.
 ELIFECYCLE  Command failed with exit code 1.

EXIT_CODE=1
```

### 4. Typecheck final en cero

```text

> workspace@0.0.0 typecheck /home/runner/workspace
> node ./scripts/src/typecheck-runner.mjs


> @workspace/api-server@0.0.0 typecheck /home/runner/workspace/artifacts/api-server
> tsc -p tsconfig.json --noEmit


> @workspace/mariana-textil@0.0.0 typecheck /home/runner/workspace/artifacts/mariana-textil
> tsc -p tsconfig.json --noEmit


> @workspace/scripts@0.0.0 typecheck /home/runner/workspace/scripts
> tsc -p tsconfig.json --noEmit


=== Typecheck summary ===
Packages selected: 3 artifacts/scripts; library results: 7
PASS @workspace/scanned-code [library] (0 TypeScript errors)
PASS @workspace/number-format [library] (0 TypeScript errors)
PASS @workspace/metered-pricing [library] (0 TypeScript errors)
PASS @workspace/db [library] (0 TypeScript errors)
PASS @workspace/api-client-react [library] (0 TypeScript errors)
PASS @workspace/api-zod [library] (0 TypeScript errors)
PASS @workspace/libraries [library-stage] (0 TypeScript errors)
PASS @workspace/api-server [package] (0 TypeScript errors)
PASS @workspace/mariana-textil [package] (0 TypeScript errors)
PASS @workspace/scripts [package] (0 TypeScript errors)
Unique TypeScript diagnostics: 0
Repeated diagnostic emissions: 0
Process/parser failures: 0
RESULT: PASS (all selected checks completed; 0 TypeScript errors)

EXIT_CODE=0
```

### 5. Codegen y comparación de contenidos

```text

> @workspace/api-spec@0.0.0 codegen /home/runner/workspace/lib/api-spec
> orval --config ./orval.config.ts && node ./fix-api-zod-barrel.mjs && pnpm -w run typecheck:libs

🍻 orval v8.23.0 - A swagger client generator for typescript
api-client-react Cleaning output folder
🎉 api-client-react - Your OpenAPI spec has been converted into ready to use orval!
zod Cleaning output folder
🎉 zod - Your OpenAPI spec has been converted into ready to use orval!
[fix-api-zod-barrel] Rewrote /home/runner/workspace/lib/api-zod/src/index.ts (704 direct + 24 aliased exports)

> workspace@0.0.0 typecheck:libs /home/runner/workspace
> tsc --build


EXIT_CODE=0
SHA256_COMPARISON=IDENTICAL
```

### 6. Build completo final

```text

> workspace@0.0.0 build /home/runner/workspace
> pnpm run typecheck && pnpm -r --no-bail --if-present run build


> workspace@0.0.0 typecheck /home/runner/workspace
> node ./scripts/src/typecheck-runner.mjs


> @workspace/api-server@0.0.0 typecheck /home/runner/workspace/artifacts/api-server
> tsc -p tsconfig.json --noEmit


> @workspace/mariana-textil@0.0.0 typecheck /home/runner/workspace/artifacts/mariana-textil
> tsc -p tsconfig.json --noEmit


> @workspace/scripts@0.0.0 typecheck /home/runner/workspace/scripts
> tsc -p tsconfig.json --noEmit


=== Typecheck summary ===
Packages selected: 3 artifacts/scripts; library results: 7
PASS @workspace/scanned-code [library] (0 TypeScript errors)
PASS @workspace/number-format [library] (0 TypeScript errors)
PASS @workspace/metered-pricing [library] (0 TypeScript errors)
PASS @workspace/db [library] (0 TypeScript errors)
PASS @workspace/api-client-react [library] (0 TypeScript errors)
PASS @workspace/api-zod [library] (0 TypeScript errors)
PASS @workspace/libraries [library-stage] (0 TypeScript errors)
PASS @workspace/api-server [package] (0 TypeScript errors)
PASS @workspace/mariana-textil [package] (0 TypeScript errors)
PASS @workspace/scripts [package] (0 TypeScript errors)
Unique TypeScript diagnostics: 0
Repeated diagnostic emissions: 0
Process/parser failures: 0
RESULT: PASS (all selected checks completed; 0 TypeScript errors)
Scope: 10 of 11 workspace projects
artifacts/api-server build$ node ./build.mjs
artifacts/mariana-textil build$ vite build --config vite.config.ts
artifacts/mariana-textil build: vite v7.3.6 building client environment for production...
artifacts/mariana-textil build: transforming...
artifacts/mariana-textil build: src/components/ui/tooltip.tsx (2:0): Error when using sourcemap for reporting an error: Can't resolve original location of error.
artifacts/api-server build:   dist/index.mjs                       8.0mb ⚠️
artifacts/api-server build:   dist/pino-worker.mjs               153.4kb
artifacts/api-server build:   dist/pino-file.mjs                 142.1kb
artifacts/api-server build:   dist/pino-pretty.mjs               114.4kb
artifacts/api-server build:   dist/thread-stream-worker.mjs        7.3kb
artifacts/api-server build:   dist/index.mjs.map                  14.0mb
artifacts/api-server build:   dist/pino-worker.mjs.map           256.9kb
artifacts/api-server build:   dist/pino-file.mjs.map             229.0kb
artifacts/api-server build:   dist/pino-pretty.mjs.map           203.6kb
artifacts/api-server build:   dist/thread-stream-worker.mjs.map   12.0kb
artifacts/api-server build: ⚡ Done in 1812ms
artifacts/api-server build: Done
artifacts/mariana-textil build: src/components/ui/calendar.tsx (2:0): Error when using sourcemap for reporting an error: Can't resolve original location of error.
artifacts/mariana-textil build: src/components/ui/toggle-group.tsx (2:0): Error when using sourcemap for reporting an error: Can't resolve original location of error.
artifacts/mariana-textil build: src/components/ui/sheet.tsx (2:0): Error when using sourcemap for reporting an error: Can't resolve original location of error.
artifacts/mariana-textil build: src/components/ui/command.tsx (2:0): Error when using sourcemap for reporting an error: Can't resolve original location of error.
artifacts/mariana-textil build: ✓ 5341 modules transformed.
artifacts/mariana-textil build: rendering chunks...
artifacts/mariana-textil build: computing gzip size...
artifacts/mariana-textil build: dist/public/index.html                                              1.33 kB │ gzip:   0.53 kB
artifacts/mariana-textil build: dist/public/assets/mariana-textil-logo-monochrome-_7AVoW2A.png    166.39 kB
artifacts/mariana-textil build: dist/public/assets/mariana-textil-logo-FFOiXRd3.png               818.20 kB
artifacts/mariana-textil build: dist/public/assets/index-CTwFjwBL.css                             207.57 kB │ gzip:  31.70 kB
artifacts/mariana-textil build: dist/public/assets/index-CJ5sQYvB.js                              458.30 kB │ gzip: 117.57 kB
artifacts/mariana-textil build: dist/public/assets/index-DQkHrn5E.js                            2,644.22 kB │ gzip: 654.96 kB
artifacts/mariana-textil build: ✓ built in 10.99s
artifacts/mariana-textil build: (!) Some chunks are larger than 500 kB after minification. Consider:
artifacts/mariana-textil build: - Using dynamic import() to code-split the application
artifacts/mariana-textil build: - Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
artifacts/mariana-textil build: - Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
artifacts/mariana-textil build: Done

EXIT_CODE=0
```

### 7. Pruebas del verificador

```text
✔ parser normaliza la ubicación y deduplica sólo al contar (2.94328ms)
✔ parser conserva diagnósticos globales sin archivo (1.118603ms)
✔ runner continúa después de fallas de libs y paquetes y reporta contextos (280.687831ms)
✔ tsc real fuerza la continuación de referencias y después comprueba artifacts/scripts (3134.368768ms)
✔ tsc ausente deja libraries UNVERIFIED y conserva código de error (153.819863ms)
✔ crash de tsc con stderr parcial no acredita libraries (339.391766ms)
✔ selección vacía aborta antes de ejecutar tsc (47.722299ms)
✔ build conserva la barrera && después de typecheck (1.103964ms)
ℹ tests 8
ℹ suites 0
ℹ pass 8
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4042.646403

EXIT_CODE=0
```

### 8. Comparación de pruebas existentes

```text
# Prompt B — resultado AFTER con el mismo manifest

## Ejecución

Se ejecutaron exactamente los tres comandos del baseline, sin discovery
adicional, sin cambiar tests, sin corregir suites, sin DB, typecheck, build,
servidor ni workflow. El manifest literal y las exclusiones son los mismos:

- `reports/prompt-b-pruebas-baseline-manifest.txt`
- `reports/prompt-b-pruebas-baseline-summary.txt`

El Kardex focal conservó el mismo `--test-name-pattern` y se ejecutó en
proceso separado.

## Conteos AFTER comparados contra BASELINE

| Grupo | Baseline tests/pass/fail/skip | AFTER tests/pass/fail/skip | Cambio |
|---|---:|---:|---:|
| Backend Kardex focal | 3 / 3 / 0 / 0 | 3 / 3 / 0 / 0 | 0 |
| Backend puro/contract | 50 / 48 / 2 / 0 | 50 / 48 / 2 / 0 | 0 |
| Frontend contract/unit/render | 40 / 37 / 3 / 0 | 40 / 37 / 3 / 0 | 0 |
| **Total manifest** | **93 / 88 / 5 / 0** | **93 / 88 / 5 / 0** | **0** |

Los tres Kardex focales siguen reportando `tests 3`, `pass 3`, `fail 0`,
`skipped 0`. No hubo skips en ningún grupo.

## Firmas de fallos AFTER

Las cinco firmas son las mismas cinco conocidas del baseline; no apareció
ningún fallo nuevo:

### Backend (2)

1. `src/clientes-notas-credito.contract.test.ts`
   - `contrato de notas de crédito deriva los tres estados sin persistirlos`
   - Sigue fallando la regex que busca `function moneyState ... balanceCents`.

2. `src/kardex-block2.contract.test.ts`
   - `outgoing preset retains read scope and supplies destination, documents, units and absolute totals`
   - Sigue fallando la regex `route: \`/tickets/\${ticketId}\``.

### Frontend (3)

1. `src/components/cliente-nota-estado-badge.render.test.ts`
   - `Los cuatro estados reales renderizan icono y estado, nunca un importe en la insignia`
   - Sigue `ReferenceError: React is not defined`.

2. `src/pages/cliente-ticket-links.contract.test.ts`
   - `the second client ticket row links by its real ticket id, not by list position`
   - Sigue `ReferenceError: React is not defined`.

3. `src/pages/nota.contract.test.ts`
   - `Block 4 functionality in ticket detail`
   - Sigue fallando la regex `/estadoNota === "PENDIENTE"/`.

La comparación de nombres de tests y firmas `AssertionError`/`ReferenceError`
es idéntica. La única diferencia textual en el log backend puro está dentro
del enorme payload `actual` truncado por Node, porque el source leído cambió
con los fixes; no cambia la firma ni el conteo del fallo.

## Copias de evidencia completas AFTER

- `reports/prompt-b-pruebas-after-backend-kardex.txt`
- `reports/prompt-b-pruebas-after-backend-pure.txt`
- `reports/prompt-b-pruebas-after-frontend.txt`

Las copias completas del baseline permanecen en los tres archivos
`reports/prompt-b-pruebas-baseline-*.txt` para comparación directa. Los
`.log` originales quedan ignorados por configuración; los `.txt` son la
evidencia versionable del mismo contenido.

## Limitación explícita

El resultado `88 pass` significa únicamente que se conservaron las 88
pruebas verdes dentro de este manifest focal de 93 pruebas. No es una
afirmación de que todo el repositorio esté verde ni una ejecución completa
del repositorio. Los cinco fallos del baseline se preservaron con las mismas
firmas; no se repararon tests ni se modificaron los 69 vetos de rol. No se
verificó la identidad exhaustiva de un conjunto separado de “cinco frágiles”,
por lo que este informe no afirma su exclusión ni presenta una lista
inventada de 74. Las exclusiones conservadoras de schema son lecturas
estáticas y no ejecutan migraciones.
```

### 9. Valores efectivos de Excel y Alertas

```text
Prompt B — evidencia de valores (AST + Node vm, sin DB)
Comando ejecutado: node reports/prompt-b-valores.mjs
Fuentes comparadas: git show HEAD:artifacts/api-server/src/routes/clientes.ts vs archivo actual; git show HEAD:artifacts/mariana-textil/src/pages/alertas.tsx vs archivo actual.
Datos: exclusivamente sintéticos; no se importó ningún route ni se hicieron conexiones de red/DB.

1) Excel: retorno REAL de sheet.addRows(result.rows.map(...))
   AST objeto retorno antes: { ...row, saldoPendiente, estadoNota, ...(row.formaPago === "FACTURADO" ? (() => { const breakdown = breakdownIvaIncluded( Math.abs(moneyToCents(row.importe)), ); return { subtotalFacturado: breakdown.subtotalCents / 100, ivaFacturado: breakdown.ivaCents / 100, }; })() : {}), folio: row.folio == null ? "" : String(row.folio), importe: toExcelNumber(row.importe), saldoCorridoHistorico: toExcelNumber(row.saldoCorridoHistorico), saldoDeudorProyectado: saldoDeudorProyectado == null ? null : toExcelNumber(saldoDeudorProyectado), saldoAFavorProyectado: saldoAFavorProyectado == null ? null : toExcelNumber(saldoAFavorProyectado), saldoPendiente: saldoPendiente == null ? null : toExcelNumber(saldoPendiente), }
   AST objeto retorno actual: { ...row, estadoNota, ...(row.formaPago === "FACTURADO" ? (() => { const breakdown = breakdownIvaIncluded( Math.abs(moneyToCents(row.importe)), ); return { subtotalFacturado: breakdown.subtotalCents / 100, ivaFacturado: breakdown.ivaCents / 100, }; })() : {}), folio: row.folio == null ? "" : String(row.folio), importe: toExcelNumber(row.importe), saldoCorridoHistorico: toExcelNumber(row.saldoCorridoHistorico), saldoDeudorProyectado: saldoDeudorProyectado == null ? null : toExcelNumber(saldoDeudorProyectado), saldoAFavorProyectado: saldoAFavorProyectado == null ? null : toExcelNumber(saldoAFavorProyectado), saldoPendiente: saldoPendiente == null ? null : toExcelNumber(saldoPendiente), }
   Keys AST saldoPendiente antes: 2; actual: 1.
   Duplicados AST antes: ["saldoPendiente"]; actual: [].
   Objeto efectivo ANTES: {"id":"7","fecha":"2026-01-01","tipo":"VENTA_CREDITO","importe":123.45,"fechaVencimiento":"2026-01-01","formaPago":"CREDITO","referencia":null,"folio":"","usuario":"synthetic","saldoCorridoHistorico":0,"estadoNota":"PENDIENTE","saldoDeudorProyectado":null,"saldoAFavorProyectado":null,"saldoPendiente":123.45}
   Objeto efectivo DESPUÉS: {"id":"7","fecha":"2026-01-01","tipo":"VENTA_CREDITO","importe":123.45,"fechaVencimiento":"2026-01-01","formaPago":"CREDITO","referencia":null,"folio":"","usuario":"synthetic","saldoCorridoHistorico":0,"estadoNota":"PENDIENTE","saldoDeudorProyectado":null,"saldoAFavorProyectado":null,"saldoPendiente":123.45}
   Keys efectivos ANTES (14): ["id","fecha","tipo","importe","fechaVencimiento","formaPago","referencia","folio","usuario","saldoCorridoHistorico","estadoNota","saldoDeudorProyectado","saldoAFavorProyectado","saldoPendiente"]
   Keys efectivos DESPUÉS (14): ["id","fecha","tipo","importe","fechaVencimiento","formaPago","referencia","folio","usuario","saldoCorridoHistorico","estadoNota","saldoDeudorProyectado","saldoAFavorProyectado","saldoPendiente"]
   Igualdad profunda efectiva: true
   tipos/celdas: importe=number(123.45), saldoCorridoHistorico=number(0), saldoPendiente=number(123.45), saldoDeudorProyectado=null, saldoAFavorProyectado=null.
   Conservación de valores sintéticos: true
   Caso null efectivo ANTES: {"id":"8","fecha":"2026-01-01","tipo":"AJUSTE","importe":0,"fechaVencimiento":"2026-01-01","formaPago":"CONTADO","referencia":null,"folio":"","usuario":"synthetic","saldoCorridoHistorico":0,"estadoNota":null,"saldoDeudorProyectado":null,"saldoAFavorProyectado":null,"saldoPendiente":null}
   Caso null efectivo DESPUÉS: {"id":"8","fecha":"2026-01-01","tipo":"AJUSTE","importe":0,"fechaVencimiento":"2026-01-01","formaPago":"CONTADO","referencia":null,"folio":"","usuario":"synthetic","saldoCorridoHistorico":0,"estadoNota":null,"saldoDeudorProyectado":null,"saldoAFavorProyectado":null,"saldoPendiente":null}
   Conservación null + igualdad: true

2) Alertas: expresiones JSX REALES ubicadas por AST
   Prop saldoPendiente antes: credito.pendiente
   Prop saldoPendiente actual: credito.importe
   Prop evaluada antes con credito={importe:"123.45", pendiente:undefined}: undefined
   Prop evaluada actual con credito={importe:"123.45", pendiente:undefined}: "123.45"
   formatNumber real antes: formatNumber(credito.pendiente, { kind: "money" })
   formatNumber real actual: formatNumber(credito.importe, { kind: "money" })
   Visible formatNumber antes (undefined): "—"
   Visible formatNumber actual (importe 123.45): "$123.45"
   Cambio visible demostrado: true

3) Badge
   Destructuring real de ClienteNotaEstadoBadge: ["estadoNota","id","className"]
   Ignora saldoPendiente (no se destructura ni se lee en el cuerpo): true
   Conclusión: cambiar solo ese prop no cambia el badge; el badge presenta estadoNota/id/className.

RESULTADO: PASS (8/8 comprobaciones)
```

### 10. Reproducción del desfase pendiente

```text
$ TZ=America/Mexico_City artifacts/api-server/node_modules/.bin/tsx reports/prompt-b-fecha-runtime.ts ui

## Zod endpoint y calendario LCD/impresión
{
  "tz": "America/Mexico_City",
  "endpoint": "GetClienteNotaCreditoResponse",
  "endpointDateInput": "2026-10-02",
  "endpointDateRuntime": {
    "type": "object",
    "isDate": true,
    "iso": "2026-10-02T00:00:00.000Z"
  },
  "endpointJsonWire": "2026-10-02T00:00:00.000Z",
  "lcdDateFnsFromIso": "01/10/2026",
  "printDateOnlyMx": "02/10/2026",
  "expectedDifferenceUnderMexico": "LCD -1 día; impresión conserva día"
}
```
