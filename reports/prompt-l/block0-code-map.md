# Prompt L — Bloque 0 y evaluación previa, sin modificar producción

## Cierre de H por el propietario

El propietario aprobó el catálogo en su propia sesión autenticada el **15 de septiembre de 2026**, America/Mexico_City. La atribución y sus palabras están en `reports/prompt-h/cierre-propietario.md`. No se presenta como una prueba visual del agente.

## Base actual: puerta de solo lectura aprobada

Consulta en `heliumdb/public`, PostgreSQL 16.10, a las **22:40:38.967** de Ciudad de México:

- Rollos: **0**.
- Series asignadas no vacías: **0**.
- Contador: una fila, id 1, `ultimo_numero=1000000`.
- Columna: `int4`; ocho dígitos caben en su rango.
- Productos: **1234**, con huella completa igual al respaldo, incluidos colores y precios.
- Historial de precios: **1016**, con huella completa igual al respaldo.

Evidencia y consultas: `block0-database-gate.json` y `.md`. No se ejecutó ninguna escritura, autenticación, reserva de series ni `nextval`.

## Los cuatro puntos confirmados

### 1. Generador

`lib/db/src/schema/series.ts` declara el contador entero con default `1000000`.

`artifacts/api-server/src/lib/inventario.ts`, `reserveSeries`, contiene:

```ts
.values({ id: SERIES_ROW_ID, ultimoNumero: 1000000 })
.onConflictDoNothing();
```

Selecciona la fila con `.for("update")`, calcula `start + quantity`, actualiza el contador y devuelve `String(start + i)`. `rollos.serie` almacena la cadena numérica. No se modificó esa mecánica.

### 2. Intérprete

`lib/scanned-code/src/index.ts`:

```ts
const SERIE_AL_FINAL = /(?:^|\D)(\d{7})$/;
```

El comentario actual exige siete dígitos. La normalización está compartida por las rutas de POS, Salidas y Etiquetas; también la usan Inventario y Auditorías, además de variantes de salida.

### 3. Vista previa

`artifacts/mariana-textil/src/pages/etiquetas.tsx`:

```ts
serie: String(product.id).padStart(7, "0").slice(-7)
```

Es una serie sintética de vista previa, no una asignación de rollo.

### 4. QR

`artifacts/mariana-textil/src/components/label-print.tsx`, línea 101:

```ts
const qrPayload = `${data.sku}-${data.serie}`;
```

El componente QR usa ese valor, tamaño **29 × 29 mm**, nivel Q y fondo blanco. `pages/rollo-detail.tsx` también construye `${rollo.skuProducto}-${rollo.serie}`.

## Hallazgos adicionales

- El valor inicial aparece tanto en el esquema como dentro del generador.
- Las pruebas del intérprete y `label-selection.contract.test.ts` contienen supuestos de siete dígitos. El literal de prueba `10002874` tiene ocho dígitos, no nueve.
- `replit.md` documenta la interpretación de siete dígitos; deberá sustituirse la regla de generación solo cuando se implemente el cambio, conservando la futura tolerancia al leer siete.
- Capacidad exacta propuesta: **89,999,999** números entre `10000001` y `99999999`, aproximadamente noventa millones.
- La etiqueta conserva los escalones de fuente actuales, nombre de producto mínimo de 14 px y cantidad con tres decimales.

## Etiquetas de todo el catálogo, antes de cambiar el contador

Se montó el componente real con sus estilos, logotipo y modo de impresión. Se midieron **1234 etiquetas por escenario**: siete dígitos, `10000001` y `99999999`.

- Series de ocho dígitos completas: **1234/1234**.
- Desbordamientos introducidos por ocho dígitos: **0**.
- QR decodificados digitalmente con payload exacto: **1234/1234**.
- Desbordamiento previo del ancho útil del nombre: **1**, SKU `CAMFLOMAR-AMA`, **Campesina Flor Margarita — Amarillo Mango**. Ocurre también con siete dígitos: texto de **353 px** frente a **345.72 px** útiles, en el escalón mínimo existente de **14 px**. El texto completo está presente y la captura no demuestra pérdida del color; la advertencia corresponde al ancho útil reservado, no a un producto o color ausente. No se corrigió ni ocultó.
- Impresión física y lectura con pistola/cámara: **pendientes**, no acreditadas por la prueba digital.

Evidencia: `full-catalog-label-fit.md`, `.json` y sus imágenes.

## Restricción pendiente antes de implementar y activar

El parser se integra en el bundle del API. Para activar su cambio hace falta reconstruir y reanudar ese proceso. El arranque normal ejecuta inicializadores y procesos de fondo que escriben en la base, como se comprobó en H. **No existe actualmente un modo de arranque que omita esos escritores y sirva el API**; `NODE_ENV=test` omite el servidor completo.

Por tanto, un reinicio normal excedería la autorización de L de ejecutar únicamente el `UPDATE` del contador. No se inventó un bypass, no se modificaron inicializadores y no se reinició el API.

**Estado:** Bloque 0 aprobado; evaluación de etiquetas realizada con el hallazgo previo reportado. Implementación y `UPDATE` del contador pendientes de resolver la autorización de arranque. El código de producción sigue generando e interpretando siete dígitos; no se afirma haber implementado ocho.