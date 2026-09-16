# Prompt L — resultado final

## Estado: activación operativa confirmada

El operador confirmó `reports/prompt-l/counter-update.json` como
`COMMITTED`: únicamente cambió `public.series_consecutivo`, con la fila
`id=1` pasando de `1000000` a `10000000`. Los PIDs huérfanos se detuvieron
graciosamente y ambos workflows administrados se reiniciaron una vez con éxito.
La comprobación posterior está en
`reports/prompt-l/post-activation-check.json` y
`reports/prompt-l/post-activation-check.md`.

## Comprobación posterior de solo lectura

La consulta directa contra `heliumdb.public` usó
`REPEATABLE READ READ ONLY`; no hizo escrituras, inicialización,
autenticación, pausa ni reinicio del API.

- `series_consecutivo`: exactamente `id=1`, `ultimo_numero=10000000`.
- `rollos`: `0` filas y `0` series asignadas; no se ejecutó ningún reset.
- `entrada_folio`, `salida_folio`, `viaje_folio` y
  `auditoria_inventario_folio`: todos sus valores permanecen en `0`.
- `ticket_folio`: permanece en `999`.
- Default físico PostgreSQL: permanece en `1000000`; no hubo `ALTER TABLE` ni
  DDL. El default de Drizzle y el seed explícito del reservador son `10000000`.
- `productos`: 1234 filas, hash
  `9b5a7bfb4133c1c700f9d242628c0c46`.
- `precio_historial`: 1016 filas, hash
  `64f5ec3242e70cdfe37e1a242c26b506`.

## Bundle, pruebas y límites

La inspección estática de `artifacts/api-server/dist/index.mjs` encontró el
parser de siete/ocho dígitos con preferencia por ocho, seed explícito
`10000000`, guard de `99999999` y error `SERIES_EXHAUSTED`; el bundle no se
importó ni se inició.

Se conserva la evidencia de Prompt L: parser **16/16**, mock de
`reserveSeries` **3/3**, contratos API **3/3**, contratos frontend **8/8**,
codegen de **734 rutas rastreadas / 0 diferencias** y typecheck final
**PASS / 0 diagnósticos** (`reports/prompt-l/typecheck-final.txt`). Las pruebas
no crearon rollos reales.

La compuerta previa de etiquetas conserva 1234/1234 etiquetas, QR 1234/1234
exactos y cero desbordamientos introducidos por el octavo dígito. Permanece una
advertencia AutoFit preexistente de `CAMFLOMAR-AMA`: texto de 353 px frente a
345.72 px utilizables al mínimo de 14 px, con el texto completo presente. La
impresión y lectura física siguen pendientes; el catálogo completo no se
reejecutó en este subturno.

La regla vigente genera únicamente ocho dígitos: primera serie `10000001`,
máximo `99999999`, capacidad exacta `89999999` (aproximadamente 90 millones,
unos 300 años al ritmo actual). El contador de siete dígitos `1000000` de
Prompt H y sus respaldos permanecen explícitamente históricos, no son una
regla actual y no fueron reescritos. Las escrituras normales de arranque fueron
autorizadas por separado.