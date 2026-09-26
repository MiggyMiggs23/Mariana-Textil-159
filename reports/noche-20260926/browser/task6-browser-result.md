# Tarea 6 — exploración real complementaria

Se recorrieron **41 rutas observadas** de navegación y documentos con sesiones sintéticas. La última salida general está en `../tarea-6/broad/result.json`, con 41 capturas. No se afirma cobertura exhaustiva de todos los botones ni de cada cifra.

## Casos añadidos con evidencia positiva

`../tarea-6/native-drilldown-units-color/result.json`:

- Cifra **Contado cobrado → diálogo de desglose → enlace por folio 9 → `/tickets/9`**. Capturas `amount-detail.png` y `folio-document.png`.
- Colores del tablero acompañados de etiquetas operativas y estados semánticos `attention/neutral`. Esto no certifica todos los colores de la aplicación.
- Altas nativas de productos KILO, PIEZA y BOLSA. Entrada mixta nativa **5**, con **METRO 11, KILO 13, PIEZA 17, BOLSA 19**. La revisión y los totales de pantalla separan las cuatro dimensiones, sin presentar 60 como cantidad: **60.00 es el costo monetario**, correctamente diferenciado. Captura `four-units-review.png`.

## Hallazgos para MAIN / tarea 7

- `/api/precios` devolvió **500** al visitar Precios.
- `/api/clientes/2584/comportamiento-pago` y `/api/clientes/2584/pagos` devolvieron **500**.
- Auditoría concurrente: pantalla completa técnica `REVISION_OBSOLETA`; ver tarea 4.
- Contador A: identidad 503 y negaciones 500; ver tarea 5.
- Al capturar varias líneas de entrada apareció confirmación de cancelar una captura después de haber agregado la línea a la lista. Se continuó explícitamente conservando las líneas ya listadas; la segunda tentativa completó la entrada mixta. Revisar experiencia/modal, no afirmar pérdida de datos.

## Límites del harness, no defectos afirmados

Algunas rutas no usan `h1` (POS, Cobros, detalle de producto/rollo y E5), por lo que la expectativa genérica agotó el tiempo aunque la captura muestre contenido válido. Los chequeos genéricos vacíos `coverage-detailChains/unitChecks/colorChecks` quedaron bloqueados: los casos nativos específicos posteriores de arriba son la evidencia válida, sin cambiar retrospectivamente esos resultados.

No se modificó la aplicación ni se activó el candidato de tarea 7. MAIN decidirá correcciones y liberación; estos recorridos corresponden al bundle original congelado.