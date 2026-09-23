# T5 — Etiqueta de rollo: render real y opciones de composición

## Alcance

Investigación estática del render actual. No se modificó la aplicación. La fuente principal es `artifacts/mariana-textil/src/components/label-print.tsx:1-186`; la geometría de impresión está en `artifacts/mariana-textil/src/index.css:343-346,678-686,777-803`; el uso real desde entradas está en `artifacts/mariana-textil/src/pages/entrada-etiquetas.tsx:147-163`.

## Lo que se renderiza hoy

- **Papel:** 100 × 70 mm, margen de página 0.
- **Caja de etiqueta:** 100 × 70 mm, `box-sizing: border-box`, `overflow: hidden`, relleno de 3 mm y esquinas de 3 mm.
- **Área interior nominal:** 94 × 64 mm. El encabezado usa 11 mm de alto, 1 mm de relleno lateral por lado y una regla negra de 1.2 mm.
- **Cuerpo:** tres columnas de **31 mm + 30 mm + remanente**, con dos separaciones de 1 mm. Dentro de los 94 mm disponibles, la tercera columna resulta de aproximadamente 31 mm.
- **Columna izquierda:** SKU, número de serie y cantidad. Tiene 3 mm de relleno derecho, por lo que el ancho útil del texto ronda 28 mm.
- **Columna central:** logo monocromático, máximo 33 × 44 mm, más el texto `MARIANA TEXTIL` a 10 px.
- **Columna derecha:** QR de 29 × 29 mm dentro de una caja con 1 mm de relleno, borde negro y fondo blanco; debajo se imprime el payload.
- **Contenido QR real:** concatenación exacta `${sku}-${serie}`, nivel de corrección Q, margen interno incluido, negro `#000000` sobre blanco `#ffffff`.
- **Nombre real:** `${tela} - ${color}` convertido a mayúsculas, en una sola línea.
- **Tipografía:** `font-sans` resuelve a `'Inter', ui-sans-serif, system-ui, sans-serif...` (`index.css:48,147`). No hay una fuente Inter embebida en la etiqueta; si Inter no está disponible se usa la sans del sistema. Pesos predominantes: `font-black` para nombre, identificadores, cantidad y payload; `font-medium` para rótulos.
- **Color:** etiqueta blanca, texto principal negro, regla negra; rótulos y líneas auxiliares grises. El logo fuente es `mariana-textil-logo-monochrome.png`, PNG de 909 × 963 px en escala de grises.

### Ajuste actual

`AutoFitText` mide el ancho renderizado, espera `document.fonts.ready` y elige el primer escalón que cabe:

| Campo | Escalones actuales |
|---|---|
| Nombre de producto | 30, 24, 18, 14 px |
| Cantidad | 29, 24, 19, 13 px |
| SKU | 15, 12, 9, 6 px |
| Texto del payload QR | 9, 7, 5, 4 px |

La medición tiene tolerancia de 0.5 px. Si ni el mínimo cabe, el estado queda `overflow`, pero el texto continúa en una sola línea y la caja exterior lo recorta. **La serie visible usa hoy `truncate` a 21 px**, mientras el QR conserva la serie completa. Por ello, actualmente puede existir una diferencia entre identificador visible e identificador codificado.

## Límites orientativos

No se alteró ni ejecutó la aplicación para obtener métricas del catálogo. Estos límites son presupuestos conservadores calculados sobre los anchos reales y una mayúscula sans pesada promedio de 0.60–0.65 em; deben confirmarse con el reporte renderizado ya existente (`CatalogLabelFitReport`, `pages/etiquetas.tsx:537-600`) en la fuente efectiva de producción.

| Campo / ancho útil | Tamaño | Orientación segura | Zona de riesgo |
|---|---:|---:|---:|
| Nombre, ~92 mm | 30 px | 17–19 caracteres | 20+ baja de escalón |
| Nombre, ~92 mm | 24 px | 22–24 | 25+ |
| Nombre, ~92 mm | 18 px | 29–32 | 33+ |
| Nombre, ~92 mm | 14 px | **38–41** | **42+ puede recortarse** |
| SKU, ~28 mm | 15 px | 10–11 | 12+ baja de escalón |
| SKU, ~28 mm | 9 px | 17–19 | 20+ |
| SKU, ~28 mm | 6 px | **26–29** | **30+ puede recortarse** |
| Serie fija, ~28 mm a 21 px | — | **8–10 caracteres** | 11+ puede truncarse hoy |
| Payload bajo QR, ~31 mm | 4 px mínimo | **45–50 caracteres** | más puede desbordar |

No son límites de validación: `W`, `M`, guiones y espacios consumen más; `I`, `1` y puntos consumen menos. Los límites deben decidirse por **ancho medido**, no sólo por conteo.

## Invariantes para cualquier rediseño

1. El valor del QR debe seguir siendo exactamente `sku + "-" + serie`; no abreviar, normalizar, hashear ni omitir caracteres.
2. SKU y serie visibles deben imprimirse completos. Nunca usar elipsis ni cortar identificadores.
3. Si un identificador no cabe, debe cambiar la composición: bajar fuente hasta un mínimo legible, usar dos líneas con cortes explícitos o reservar una banda adicional. Si aun así no cabe, bloquear la impresión con un error que muestre el valor completo; no imprimir una etiqueta ambigua.
4. Mantener QR de 29 mm, zona blanca, corrección Q y contraste negro/blanco. Reducirlo aumenta espacio, pero empeora lectura en impresoras térmicas y no se recomienda.
5. El nombre descriptivo sí puede repartirse en líneas; no sustituye a SKU/serie y no debe desplazar ni alterar el QR.

## Tres diseños concretos

### A. Conservador: encabezado de dos líneas

Mantiene las tres columnas y el QR actual. Sólo reserva más altura para el nombre.

```text
100 × 70 mm
┌──────────────────────────────────────────────────┐
│ NOMBRE TELA - COLOR                 94 × 16 mm   │
│ segunda línea si se necesita                     │
├──────────────────────────────────────────────────┤
│ SKU completo │      LOGO       │   QR 29 × 29    │
│ SERIE        │ MARIANA TEXTIL  │                 │
│ CANTIDAD     │                 │ sku-serie       │
└──────────────────────────────────────────────────┘
  31 mm          30 mm             ~31 mm
```

- Nombre: 1 línea a 24/18 px hasta ~30 caracteres; 2 líneas a 18/14 px, objetivo orientativo 55–64 caracteres totales.
- Identificadores: SKU y serie con ajuste independiente y opción de dos líneas sólo en separadores seguros.
- **Ventaja:** cambio visual menor; conserva logo y lectura QR.
- **Costo:** quita unos 5 mm al cuerpo; cantidades e identificadores extremos siguen estrechos.

### B. Identificadores prioritarios: QR a la derecha, logo reducido

Reparte el cuerpo en una columna de datos ancha y una columna QR fija. El logo pasa al encabezado.

```text
100 × 70 mm
┌──────────────────────────────────────────────────┐
│ logo 12 mm │ NOMBRE EN 1–2 LÍNEAS      94×16 mm │
├───────────────────────────────┬──────────────────┤
│ SKU COMPLETO          58 mm   │                  │
│ SERIE COMPLETA                │   QR 29 × 29     │
│ CANTIDAD + UNIDAD             │                  │
│                               │ payload completo │
└───────────────────────────────┴──────────────────┘
                                  34 mm
```

- Datos útiles: aproximadamente 58 mm; a 12 px admite orientativamente 28–32 caracteres por línea y, con dos líneas, identificadores mucho más largos sin elipsis.
- Nombre: 1–2 líneas, 18/14 px; objetivo 55–64 caracteres.
- Payload: puede ocupar dos líneas bajo el QR sin cambiar su valor.
- **Ventaja:** mejor garantía para SKU/serie y operación manual; recomendación principal.
- **Costo:** logo menos dominante y composición distinta a la actual.

### C. Banda inferior de identidad

Mantiene logo y QR como protagonistas y mueve los identificadores a todo el ancho.

```text
100 × 70 mm
┌──────────────────────────────────────────────────┐
│ NOMBRE EN DOS LÍNEAS                    94×15 mm │
├───────────────────────┬──────────────────────────┤
│ LOGO ~28 × 27 mm      │ QR 29 × 29 + cantidad   │
├───────────────────────┴──────────────────────────┤
│ SKU: valor completo                     94×7 mm  │
│ SERIE: valor completo                   94×7 mm  │
└──────────────────────────────────────────────────┘
```

- Cada identificador dispone de ~90 mm: a 10–12 px, orientación segura de 42–55 caracteres.
- **Ventaja:** máxima capacidad y comparación visual inmediata con el QR.
- **Costo:** payload legible del QR compite con cantidad; el logo debe reducirse y el cuerpo queda más denso.

## Tratamiento propuesto de excedentes

1. Medir después de cargar la fuente efectiva, igual que hoy.
2. Para nombres: escalones discretos; luego dos líneas balanceadas, prefiriendo corte en ` - ` o espacio. Si supera dos líneas, mostrar señal de revisión antes de imprimir. El nombre puede abreviarse **sólo mediante un alias comercial explícito guardado como dato**, nunca por recorte automático.
3. Para SKU/serie/payload: una línea, luego dos líneas mediante `overflow-wrap:anywhere` visual. El contenido subyacente y el QR permanecen exactos. No insertar caracteres en el valor; los saltos son sólo de presentación.
4. Si el mínimo legible o dos líneas no bastan, impedir esa etiqueta e informar campo, valor, ancho medido y ancho disponible.
5. Registrar para revisión cualquier etiqueta que use el escalón mínimo. Esto permite corregir nombres descriptivos sin degradar identificadores.

## Recomendación

Adoptar conceptualmente el **diseño B**: da prioridad a los identificadores operativos, conserva el QR en 29 mm y permite nombre largo en dos líneas. Antes de decidir tamaños definitivos, medir con la fuente realmente cargada y con los nombres/SKU/series máximos del catálogo usando el reporte renderizado existente. No cambiar el payload QR ni aceptar truncamiento visible de SKU o serie.