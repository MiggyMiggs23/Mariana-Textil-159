# E7 frontend construido OFF

Contrato: `reports/e7/contrato.md`, cinco GET generados por MAIN. Sólo UI
productiva; no motores monetarios, escrituras, nuevas operaciones ni cambios a
grupos 2–4. E11 A/F intacto: no hooks E7 ni retención añadida al lector A; F
exclusivamente fiscal. No se atribuyen ni modifican históricos 51–53.

## Interfaces estables para MAIN/helper UI

- Gates literales false: `src/lib/e7-feature-flags.ts`, E7_ENABLED y
  E7_UI_ENABLED; `e7On()` exige ambos. Sin override HTTP/env/usuario.
- `src/components/e7-readers.tsx`: E7Attribution({desde,hasta,surface:
  "cuentas"|"tiempo-real"}) y E7ClientExport({clienteId}).
- Hooks generados useGetE7Disponibilidad, useGetE7Atribucion,
  useGetE7ClienteExportacion; descarga explícita por funciones generadas
  exportE7AtribucionPdf/exportE7AtribucionXlsx. No fetchers E7 manuales.
- Marcadores: e7-attribution, e7-collection (sólo GLOBAL), e7-applications,
  e7-bridge, e7-movements, e7-retained, e7-legends, e7-range-error,
  e7-export-pdf, e7-export-xlsx; e7-client-export, e7-global-four,
  e7-client-export-pdf/xlsx/imprimir; e7-legacy-detail-notice.
- Query keys tienen prefijo /api/e7/, parámetros reales e identidad serializada
  del usuario actual. Sin almacenamiento local de datos financieros.
  Cambio de identidad desmonta el árbol y cancela/retira su caché E7; cambio
  sitio/periodo/cliente remonta lector y no muestra caché sin consulta de montaje.
- OFF no monta hooks ni vínculos E7. ON exige identidad consultada al montaje,
  disponibilidad y autorización. Errores se muestran, sin fallback ni cero
  fabricado. CONTADOR excluido incluso con override. ADMIN/SISTEMAS sólo en
  atribución Cuentas Destino; panel Tiempo real sólo ADMIN, sin ampliar su ruta
  ni permiso RESUMEN_CAJA. Exportación exige clientes_finanzas.ver.

## Integración de padres y coherencia ON

Cuentas Destino y Tiempo real montan E7 con sitio del selector real y fechas del
padre (Tiempo real usa día CDMX). La proyección es independiente de la carga del
resto de indicadores: fallo legacy no elimina lector E7 y fallo E7 no muestra
cobranza legacy como sustitución.

En ON se retiran tarjeta/banda y desgloses de cobranza legacy, links de archivos
legacy de Cuentas Destino, gráfica legacy de flujos por cuenta y columna de
cobranza por tienda. Se sustituyen por cobranza global/recepciones comprobadas,
aplicaciones, puente por fuente/cuenta/sitio, movimientos, retención y archivos
E7. No se suman dos fuentes ni se presenta aplicación como ingreso.
Ventas, matriz de ventas, por cobrar, IVA y otros indicadores conservan fuentes
y cifras. El desglose por tienda mantiene columnas de ventas/por cobrar.

CuentaDestinoDetalle conserva su lector operativo existente para los enlaces de
ventas y consultas anteriores. En ON muestra aviso explícito: NO representa
cobranza/recepciones E7 ni incluye retención E5; no sumar su subtotal a E7.
Enlace de retorno conduce al padre para consultar atribución y archivos.
El contrato E7 no tiene filtro por cuenta/facturado/medio ni endpoint de detalle
operativo: no se inventaron filtros ni se sustituyó ese lector por una
proyección de alcance distinto. El detalle de atribución E7 está en el propio
padre (puente y movimientos del mismo DTO). MAIN debe evaluar esta delimitación
si quiere reemplazar también la ruta operativa; requiere contrato adicional.

ClienteDetail integra exclusivamente preview/acciones de archivos Grupo 1:
oculta los botones PDF/impresión/XLSX anteriores cuando ON y ofrece vínculos
reales a /api/clientes/:id/estado-cuenta.pdf, .xlsx y /estado-cuenta/imprimir,
con ubicacionId del selector. No usa window.print de la ficha, no altera su
estado de cuenta interactivo, cálculos, filtros ni operaciones Grupo 4.
El preview muestra exactamente cuatro cifras globales, saldo pendiente de
nota autorizada y retención del alcance separada, sin clasificación global.

## Reglas visibles

Las cuatro leyendas literales del contrato aparecen en lectores/preview.
GLOBAL muestra “Sin sitio determinado”. SITIOS no convierte null de cobranza
ni recepción en cero: muestra aplicaciones comprobables y aclara que no se
infiere recepción física allí. Cifras monetarias provienen del DTO, sin sumas
ni FIFO cliente. Registro histórico/corrección no atesta ingreso físico nuevo.

Retenido es stock al generadoEn fuera del filtro temporal de recepción;
antigüedad proviene del servidor, destacada desde 3 días, separada de favor y
deuda. Rango inválido o mayor a 366 días inclusivos produce error explícito antes
de consultar; no truncar fechas. PDF/XLSX usan los mismos filtros y se descartan
si cambia identidad o se desmonta la vista durante descarga. Errores de archivo
visibles. Leyendas internas y reautorización de archivos son del backend real.

## Verificación y límites

Compiler API noEmit, incremental/composite desactivados, sin project references,
incluyendo tests en análisis estático: 0 diagnósticos en revisión realizada.
git diff --check limpio. No se ejecutaron tests, aplicaciones, API, SQL, DB,
workflows, builds, instalaciones ni commits; no revisión visual/autenticada.
No se acredita Grupo 1 ni se liberan gates. Regresión dinámica corresponde a MAIN.