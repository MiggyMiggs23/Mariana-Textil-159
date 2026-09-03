# Auditoría de identificadores derivados de posiciones

Fecha: 3 de septiembre de 2026

## Riesgos de navegación o identidad de registro

### Corregidos en detalle de cliente

- `artifacts/mariana-textil/src/pages/cliente-detail.tsx:316` — Estado de cuenta
  agregaba `String(index)` al renglón y el folio terminaba enlazando a la posición.
  Ahora pasa `movimientoId` como identidad del renglón y `ticketId` como destino.
- `artifacts/mariana-textil/src/pages/cliente-detail.tsx:317` — Compras agregaba
  `String(index)` al renglón. Ahora usa `item.id`, el ID real del ticket, tanto para
  la identidad como para `/tickets/:id`.
- El anterior `ResponsiveTable` local, en
  `artifacts/mariana-textil/src/pages/cliente-detail.tsx:593-595`, trataba
  `row.at(-1)` como metadato oculto. Se sustituyó por filas explícitas con
  `{ id, cells, ticketId? }`.

### Fuera de detalle de cliente

No se encontraron otros enlaces, rutas o IDs de registros construidos con
`row.at(-1)`, `String(index)` o una posición de lista.

## Claves React basadas total o parcialmente en posición

Estos casos no construyen rutas ni seleccionan registros. Son claves de renderizado,
contenido estático, esqueletos o posiciones de formularios; se reportan y no se
corrigen en este commit.

- `artifacts/mariana-textil/src/pages/viaje-detail.tsx:43` — la clave combina
  `rollo.documento` con `index`.
- `artifacts/mariana-textil/src/pages/entrada-documento.tsx:187` — renglones de
  impresión con `key={index}`.
- `artifacts/mariana-textil/src/pages/entrada-documento.tsx:218` — encabezados de
  impresión con `key={index}`.
- `artifacts/mariana-textil/src/pages/entrada-documento.tsx:298` — encabezados de
  impresión con `key={index}`.
- `artifacts/mariana-textil/src/components/cliente-nota-credito.tsx:155` — renglón
  impreso con `key={i}`.
- `artifacts/mariana-textil/src/components/reportes/report-charts.tsx:65` — segmento
  gráfico con `key={i}`.
- `artifacts/mariana-textil/src/components/reportes/report-warnings.tsx:16` —
  advertencia con `key={i}`.
- `artifacts/mariana-textil/src/pages/productos.tsx:75` y `:79` — fragmentos de texto
  resaltado con `key={i}`.
- `artifacts/mariana-textil/src/pages/productos.tsx:812` — renglón visual con
  `key={i}`.
- `artifacts/mariana-textil/src/pages/cobros.tsx:295` — usa índice solo como fallback
  de clave cuando la nota no tiene folio; no forma el enlace.
- `artifacts/mariana-textil/src/pages/cobros.tsx:875` — elemento visual con `key={i}`.
- `artifacts/mariana-textil/src/pages/salida-detail.tsx:291` — bloque de resumen con
  `key={i}`.
- `artifacts/mariana-textil/src/pages/salida-nueva.tsx:496` — bloque de resumen con
  `key={i}`.
- `artifacts/mariana-textil/src/pages/corte-detail-shared.tsx:128`, `:159`, `:182` y
  `:200` — renglones de tablas de resumen con `key={i}`.
- `artifacts/mariana-textil/src/pages/clientes.tsx:399` — clave compuesta con el
  primer valor del renglón y `index`.
- `artifacts/mariana-textil/src/pages/clientes.tsx:494` — esqueletos de carga con
  `key={index}`.
- `artifacts/mariana-textil/src/pages/contenedores/index.tsx:691` — esqueletos de
  carga con `key={i}`.
- `artifacts/mariana-textil/src/pages/viaje-documento.tsx:44` — renglón de documento
  con `key={index}`.
- `artifacts/mariana-textil/src/components/ui/field.tsx:210` — mensaje de validación
  con `key={index}`.
- `artifacts/mariana-textil/src/pages/caja/tiempo-real.tsx:304` — etiqueta visual con
  `key={i}`.
- `artifacts/mariana-textil/src/pages/entradas.tsx:1012` — renglón de formulario con
  `key={i}`.
- `artifacts/mariana-textil/src/pages/caja/comparativo.tsx:227` — celda de gráfica
  con `key={`cell-${index}`}`.
- `artifacts/mariana-textil/src/pages/caja/cuentas-destino.tsx:179` y `:246` —
  bloques de resumen con clave posicional.
- `artifacts/mariana-textil/src/pages/caja/diferencias.tsx:191` — bloque de diferencia
  con `key={i}`.

## Usos de `.at(-1)` que no son identificadores

- `artifacts/mariana-textil/src/pages/entrada-documento.tsx:68` — consulta la
  capacidad de la última página para paginación de impresión.
- `artifacts/mariana-textil/src/components/label-print.tsx:50` — toma el último paso
  tipográfico como límite de autoajuste.

Ninguno de estos dos usos construye enlaces o identifica registros.