# Bloque 3 — POS: contrato de renglones sin solapamiento

## Alcance implementado

- Fuente modificada: `artifacts/mariana-textil/src/pages/pos.tsx`.
- El renglón de **Ticket de Venta** usa una cuadrícula explícita: identidad
  reducible (`minmax(0, 1fr)`), precio, cantidad/unidad, importe y acción de
  borrar en celdas separadas.
- El nombre permite partir palabras y el SKU permite cortar cadenas largas;
  los importes, cantidad/unidad y el botón de borrar no se encogen ni invaden
  esas celdas. La etiqueta de precio está asociada al input y la cantidad
  METREADO se presenta como `Cant. / unidad`.
- Los badges ROLLO/METREADO y el de nivel de precio pueden envolver/truncarse
  dentro de la celda de identidad. La expansión de series usa su propia
  cuadrícula con serie truncable y acción fija.
- Contrato añadido en
  `artifacts/mariana-textil/src/pages/pos.contract.test.ts`; revisa la
  cuadrícula, las celdas y cadenas representativas de nombre/SKU extensos.

## Auditoría estática de pantallas densas (sin cambios fuera de POS)

| Pantalla | Fuente auditada | Riesgo reproducible en fuente | Estado |
| --- | --- | --- | --- |
| Movimientos | `src/pages/movimientos.tsx` | Tabla desktop de diez columnas; varias cabeceras `whitespace-nowrap`, producto con ancho mínimo y contenedor horizontal. Con viewport angosto o textos largos se depende del desplazamiento horizontal; hay truncado de producto, por lo que SKU/nombre completo depende de `title`. | Riesgo documentado; no modificado por este bloque. |
| Inventario | `src/pages/inventario.tsx` | Tabla con `min-w-[720px]`; la tabla excede contenedores angostos de forma intencional. Verificar scroll y lectura de columnas numéricas con nombres/SKU máximos. | Riesgo documentado; no modificado por este bloque. |
| Historial de compras de proveedor | `src/pages/proveedor-detail.tsx` | Historial financiero y compras concentran fecha, referencia, sitio e importes; la referencia tiene `max-w-[200px]` y el total de columnas puede requerir ancho/scroll. Comprobar que texto truncado no esconda identificadores operativos. | Riesgo documentado; no modificado por este bloque. |
| Reportes | `src/pages/reportes.tsx` y `src/components/reportes/report-table.tsx` | Pestañas usan `overflow-x-auto`/`min-w-max`; las tablas internas deben revisarse con todos los filtros y series de datos, particularmente encabezados e importes a 1366 px. | Riesgo documentado; no modificado por este bloque. |

No se corrigió ninguna otra pantalla o tabla en este bloque: la lista anterior
es una auditoría de fuente y no amplía el alcance de la corrección POS.

## Verificación final

- **Contratos frontend completos:** aprobados, 136/136.
- **Suite POS:** aprobada, 36/36.
- **Typechecks y builds:** aprobados.
- **Visual/navegador:** no certificado a 1366×768. El intento de abrir `/pos`
  redirigió a login y no se usaron credenciales ni una sesión autenticada. El
  tester observó 1280×720, por lo que esa observación no certifica el requisito
  de 1366×768.

Permanece pendiente un barrido visual autenticado a 1366×768 con varios
renglones NORMAL y METREADO, nombre y SKU máximos, expansión de series y
errores de precio. La auditoría de Movimientos, Inventario, historial de
proveedor y Reportes sigue siendo solo de fuente, no evidencia visual.