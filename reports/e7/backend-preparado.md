# E7 backend — matriz offline preparada

## Estado

**PREPARED_NOT_EXECUTED.** Se prepararon 14 obligaciones conductuales y 14
mutantes semánticos aislados. MAIN es el único ejecutor. No se ejecutaron casos,
API, PostgreSQL, workflows ni aplicación.

La cardinalidad 14 no proviene de dividir aserciones: cada ID protege una
decisión independiente que tiene un mutante único en una fuente productiva
realmente alcanzada.

## Cobertura

1. OFF rechaza antes de DB/transacción.
2. E5 OFF falla explícitamente, sin fallback ni cero fabricado.
3. Sesión activa, no expirada y dentro del límite absoluto de 16 horas.
4. CONTADOR A/F queda fuera incluso si un override concedería lectura.
5. `resolvePermiso`, `normalizeCarteraScope` y `resolveReadScope` reales
   conservan permiso central y sitio propio.
6. Segunda autorización detecta cambio de identidad/alcance antes de entrega.
7. Resumen conserva exactamente cuatro cifras globales y detalle sólo del sitio.
8. Porciones se derivan de trazas del `projectCreditLedger` global real.
9. Recepción E5 y aplicación a nota no duplican ingreso.
10. Retenido es stock neto al generar, con antigüedad, aunque su recepción quede
    fuera del rango de flujo.
11. Históricos 51/52/53 permanecen sin sitio y sólo aparecen globalmente.
12. Fuente monetaria ausente falla; no se infiere cuenta ni cero.
13. Estado de cuenta usa workbook ExcelJS, PDF y HTML reales con leyendas.
14. Atribución usa workbook ExcelJS y PDF reales con puente/retención/leyendas.

Los padres `GetE7ClienteExportacionResponse` y `GetE7AtribucionResponse`
generados validan las proyecciones positivas. No hubo colisión del alias
`GetE7ClienteExportacionParams`.

## Fixture y límites

El fixture sólo sustituye infraestructura:

- allowlist SQL finita; toda consulta no reconocida falla con
  `E7_FIXTURE_SQL_NOT_ALLOWED`;
- sesión/usuario se leen por la consulta productiva;
- permisos y alcance usan servicios productivos, sin inyectar
  `identity/authorize/scope/projector`;
- transacción fake conserva el boundary de `createE7Reader`;
- ledger real pasa por `loadCustomerCreditLedger` y `projectCreditLedger`;
- documentos se generan y vuelven a abrir como XLSX; PDF valida bytes reales.

Esto acredita preparación de captura SQL sintética, no PostgreSQL, locks,
aislamiento real, HTTP ni aceptación autenticada. No agrega esquema ni SQL.
Grupo 1 de exportación queda cubierto; Grupo 4 interactivo permanece fuera.

## Aislamiento y evidencia durable

El runner copia fuentes físicas a snapshots temporales, resuelve
`@workspace/db`, sus subpaths, `@workspace/api-zod` y
`@workspace/number-format` hacia esas copias, y rechaza inputs workspace vivos
según realpath/metafile. Limpia snapshots al finalizar.

El primer intento de MAIN queda preservado como FAIL en
`reports/e7/logs/backend-2026-09-23T02-34-57.108Z/`: el green inicial no llegó
a registrar ningún caso porque el bundle ESM no disponía de `require` para el
CJS interno de ExcelJS (`Dynamic require of "crypto" is not supported`). No fue
un fallo funcional ni del fixture. La corrección mínima conserva ESM por los
top-level await de `@workspace/db` e instala `createRequire(import.meta.url)` en
el banner del bundle.

Build-only ahora también construye y ejecuta bajo las guardas offline/escritura
un probe dedicado que importa ExcelJS, ambos módulos E7 y los dos padres Zod.
El probe no importa `e7.test.ts`, no registra tests ni ejecuta casos. Esto prueba
compatibilidad de imports en runtime, no sólo compatibilidad de esbuild.

Cuando MAIN ejecute, cada caso conserva en `reports/e7/logs/backend-*/`:

- green raw;
- red raw con `ERR_ASSERTION` e ID exacto;
- restored-green raw;
- `manifest.json` con hashes de fuente/mutante/restauración/logs;
- `stdout.txt` durable dentro del mismo directorio, sin dependencia de `/tmp`.

## Preflight autorizado ejecutado

- validate-only: 14/14 IDs y anclas únicas;
- source-only TypeScript API: 357 roots, `noEmit`, `projectReferences: []`,
  `rootDir` workspace y `configFilePath` absoluto; 0 diagnósticos;
- build-only aislado: 1772 inputs alcanzados e imports runtime OK;
- `node --check`: runner y catálogo válidos;
- tests ejecutados: **0**.

Comando reservado a MAIN:

```sh
node reports/e7/run-backend-offline.mjs
```