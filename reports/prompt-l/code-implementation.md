# Prompt L — implementación de código (activación confirmada)

## Alcance

Se implementó únicamente el cambio de código de la serie de rollo. No se ejecutó
ninguna escritura en la base, no se llamó a `reserveSeries` contra una base real,
no se reinició ni reanudó el API y no se crearon usuarios ni sesiones.

## Cambios implementados

- `lib/db/src/schema/series.ts`: el default del contador es `10000000`; el
  comentario documenta la primera serie `10000001` y la capacidad exacta de
  `89,999,999` números hasta `99999999`.
- `artifacts/api-server/src/lib/inventario.ts`: el seed explícito de
  `reserveSeries` es `10000000`. Se conserva el `FOR UPDATE`, la reserva global
  consecutiva y la no reutilización. La función se exporta únicamente para el
  arnés unitario aislado.
- `lib/scanned-code/src/index.ts`: la única normalización compartida acepta
  siete u ocho dígitos al final, prefiere ocho, rechaza nueve y conserva el texto
  libre.
- `artifacts/mariana-textil/src/pages/etiquetas.tsx`: la vista previa genera
  series sintéticas con `padStart(8, "0").slice(-8)`. No se modificaron fuentes,
  layout, dimensiones del QR ni el payload `SKU-SERIE`.
- Las pruebas cubren el caso ambiguo `SKU-12345678` (elige `12345678`, no
  `2345678`), series de siete y ocho dígitos solas y en payload, nueve dígitos,
  texto libre, discrepancia de SKU no bloqueante y el primer número del
  generador mediante un mock de transacción sin DB.

## Verificación de código

- Parser compartido: **16/16 PASS** (`pnpm --filter @workspace/scanned-code
  test`).
- Arnés aislado del generador: **3/3 PASS** (`reserveSeries` devuelve
  `10000001`, acepta `99999999` como frontera y rechaza el siguiente número
  sin ejecutar el mock update; no abre una conexión ni ejecuta SQL).
- Contratos API de escaneo: **3/3 PASS**.
- Contratos focales de frontend (selección y etiquetas): **8/8 PASS**.
- Typecheck de frontend, API y DB: **PASS**.
- Typecheck completo de raíz final: **PASS**, 0 diagnósticos únicos y 0
  repetidos (`reports/prompt-l/typecheck-final.txt`).
- Codegen: snapshot antes/después de **734 rutas generadas rastreadas**; se
  ejecutó Orval y el parche de barrel, con **0 diferencias**.

Hash agregado SHA-256 de los archivos de código y pruebas de este cambio:
`0d4d9da89b5f13239f9618ecbb0454339fd29245de3189f553044df979d67912`.

## Evidencia de etiquetas

La evidencia previa de catálogo completo en
`reports/prompt-l/full-catalog-label-fit.md` y `.json` reporta 1234/1234
etiquetas con la serie de ocho dígitos, 1234/1234 QR exactos y cero
desbordamientos introducidos por el octavo dígito. También reporta una única
advertencia de AutoFit ya existente para el nombre largo
`CAMFLOMAR-AMA` (presente igualmente con siete dígitos). Es evidencia de la
verificación previa del catálogo y no una nueva ejecución en esta sesión; la
impresión y lectura física siguen pendientes.

## Activación

La activación autorizada quedó registrada como `COMMITTED` en
`reports/prompt-l/counter-update.json`. La comprobación posterior de solo lectura
(`reports/prompt-l/post-activation-check.json` y `.md`) confirma la fila
`series_consecutivo.id=1` en `10000000`, los demás contadores esperados y los
catálogos protegidos sin cambio. Las cifras de siete dígitos de Prompt H y sus
respaldos se conservan explícitamente como evidencia histórica y no se
reescriben.

La comprobación física con una etiqueta impresa y una pistola o cámara sigue
pendiente; una prueba digital no la acredita.