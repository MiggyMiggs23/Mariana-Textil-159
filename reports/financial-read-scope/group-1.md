# Prompt P — Grupo 1: exportaciones

## Estado

Se realizaron cambios únicamente en:

- `GET /api/clientes/analitica.xlsx`
- `GET /api/clientes/:id/estado-cuenta/imprimir`
- `GET /api/clientes/:id/estado-cuenta.xlsx`
- `GET /api/clientes/:id/estado-cuenta.pdf`

**Grupo 1 no queda aprobado ni cerrado.** La comprobación posterior identificó
un bloqueo de semántica de detalle por sitio descrito en
`Límites de esta etapa`. No se modificaron los handlers de los grupos 2 a 4,
no se inició ni reinició ningún servicio y no se ejecutaron solicitudes
autenticadas ni escrituras de base de datos.

## Criterio aplicado

`resolveClienteFinancialReadScope` delega la validación de consulta y permisos
a `normalizeCarteraScope`, que es el normalizador de `loadClientesCartera`, y
recibe el mismo `resolveReadScope`. Un usuario con alcance restringido conserva
las mismas reglas para `ubicacionId`, `ubicacionIds`, CAJA y PROPIA; el
resultado también valida que las ubicaciones solicitadas existan.

La consulta común `buildEstadoCuentaExportReadQuery` calcula primero el saldo
corrido sobre el ledger completo y solo después limita filas cuyo ticket tiene
`ubicacion_id` autorizado. Esto conserva la proyección FIFO global, pero el
filtro actual excluye también los ABONOs ordinarios sin ticket. Esa diferencia
requiere resolver atribución canónica por alcance antes de cerrar el grupo.

Para una exportación por sitio, los únicos valores globales agregados al
archivo son deuda actual, saldo a favor, límite de crédito y crédito
disponible. Los saldos acumulados por fila se suprimen fuera de alcance para
no transportar cifras globales como si fueran detalle local. Los cuatro
valores se presentan con sus etiquetas globales; el límite no se prorratea.

Todos los archivos incluyen:

1. `El resumen global de crédito considera todos los sitios.`
2. `El detalle corresponde solo a los sitios autorizados y no representa la deuda total del cliente.`

En XLSX se incluyen en la hoja `Alcance`; en HTML y PDF aparecen antes del
detalle. El PDF de esta exportación usa codificación WinAnsi para conservar
literalmente `crédito` en el archivo.

## Verificación ejecutada

### Línea base aislada y regresiones existentes

Se creó `/tmp/prompt-p-group1-baseline` desde `git archive HEAD`; no se
sustituyó ningún archivo vigilado. A esa copia aislada se le enlazaron las
dependencias ya instaladas, sin usar la aplicación en ejecución. Se ejecutó
el mismo manifiesto existente contra HEAD y contra el árbol actual:

```sh
pnpm --filter @workspace/api-server exec tsx --test \
  src/clientes-estado-cuenta.contract.test.ts \
  src/lib/clientes-cartera-read-model.test.ts \
  src/lib/clientes-aging.test.ts \
  src/lib/credit-allocation.test.ts \
  src/lib/admin-alertas-credit-risk.test.ts \
  src/clientes-pagos.contract.test.ts
```

Resultado medido: **51/51 antes** y **51/51 después**. El manifiesto no
incluye la nueva prueba de Grupo 1 y cubre cartera, crédito/FIFO, cobros y
alertas.

`src/lib/pdf.test.ts` se ejecutó también de manera independiente en ambos
árboles: **4/5 antes** y **4/5 después**, con el mismo fallo de la URL de
evidencia larga en `createReadableReportPdf`. No fue corregido ni contado como
regresión de este grupo.

### Comparación global antes/después de los handlers reales

Desde ambos árboles se invocaron los handlers reales de las cuatro rutas con
el mismo request global ADMIN y el mismo adaptador de consultas en memoria. El
adaptador entregó las mismas filas de tickets y ledger a los loaders de
producción; no realizó conexión ni escritura de base de datos. Se serializaron
los cuatro artefactos antes y después.

- **Analítica XLSX, hoja `Analítica`:** 3 filas, 8 columnas y 5 celdas
  numéricas/de cantidad en ambos artefactos; cero diferencias de valor en
  todas las celdas, encabezados, orden y formatos numéricos.
- **Estado de cuenta XLSX, hoja `Estado de cuenta`:** 5 filas, 17 columnas y
  19 celdas numéricas en ambos artefactos; cero diferencias de valor en todas
  las celdas, encabezados, orden y formatos numéricos. La nueva hoja
  `Alcance` es metadato y, para alcance global, no agrega cifras: conserva las
  dos leyendas y marca los cuatro campos como no incluidos para no alterar el
  contenido global anterior.
- **Imprimir HTML:** al extraer texto, normalizar acentos y retirar únicamente
  las dos leyendas y la línea de alcance agregadas, el texto restante fue
  idéntico. La secuencia completa de 16 tokens monetarios fue idéntica.
- **Estado de cuenta PDF:** se extrajo con `pdftotext`; al normalizar acentos
  y retirar solo las tres líneas de metadatos agregadas, el texto restante y
  sus 12 tokens monetarios extraíbles fueron idénticos. El PDF posterior
  contiene literalmente ambas leyendas con `crédito` codificado WinAnsi.

### Pruebas del cambio

Se ejecutó, sin conexión ni escritura de base de datos:

```sh
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/api-server exec tsx --test \
  src/clientes-financial-exports-scope.test.ts \
  src/clientes-estado-cuenta.xlsx.test.ts \
  src/clientes-estado-cuenta.contract.test.ts \
  src/lib/clientes-cartera-read-model.test.ts \
  src/lib/clientes-aging.test.ts
```

Resultado: typecheck de API en cero; 38 pruebas aprobadas, 0 fallidas.

Como ampliación explícita de regresión de crédito, cobros y alertas, también se
ejecutó:

```sh
pnpm --filter @workspace/api-server exec tsx --test \
  src/clientes-financial-exports-scope.test.ts \
  src/clientes-estado-cuenta.contract.test.ts \
  src/lib/clientes-cartera-read-model.test.ts \
  src/lib/clientes-aging.test.ts \
  src/lib/credit-allocation.test.ts \
  src/lib/admin-alertas-credit-risk.test.ts \
  src/clientes-pagos.contract.test.ts
```

Resultado: 54 pruebas aprobadas, 0 fallidas (51 existentes más 3 de Grupo 1).

La prueba nueva usa el resolver real de alcance con un driver SQL simulado de
solo lectura. Comprueba alcance global, un sitio y varios sitios; comprueba el
predicado producido por la consulta común; abre bytes XLSX reales con
ExcelJS; revisa bytes PDF del generador real y HTML del renderizador real. En
el fixture de un sitio no aparecen el folio ni el nombre del sitio ajeno, las
columnas de saldos acumulados por fila quedan vacías y los cuatro valores
globales y ambas leyendas sí aparecen. Para alcance global comprueba las
celdas monetarias y de cantidad existentes del estado de cuenta y de
analítica.

## Límites de esta etapa

- **Bloqueo funcional de Grupo 1:** el filtro actual por ticket elimina todo
  ABONO ordinario con `ticket_id` nulo. En clientes con compras en varios
  sitios, decidir qué parte de un abono puede acompañar el detalle autorizado
  exige atribución derivada de la proyección FIFO global canónica. No se puede
  sustituir por filtrar ciegamente `aplicaciones_credito`, porque esa tabla es
  evidencia de pagos dirigidos y no la fuente de saldo FIFO ordinario.
- El saldo pendiente de una compra autorizada está actualmente suprimido
  junto con los saldos acumulados por fila; se requiere decidir y modelar la
  presentación permitida para esa cifra local sin volver a exponer un saldo
  global por fila.
- La fila XLSX `SALDO ACTUAL PROYECTADO` conserva la clasificación
  `SALDO_DEUDOR`; con alcance por sitio puede revelar una clasificación global
  fuera de las cuatro cifras aprobadas. Debe eliminarse o marcarse
  explícitamente como no incluida dentro del rediseño de atribución.
- En consecuencia, aún no existe prueba positiva completa de compras mixtas,
  abonos comunes y aplicaciones parciales para alcance de uno o varios sitios.
  Se detuvo la implementación antes de introducir un modelo de asignación
  nuevo o cambiar el proyector global.
- La comparación global anterior usa los handlers y serializers reales, pero
  un adaptador de consultas determinista; no es una descarga HTTP autenticada
  ni una lectura de datos de producción.
- No se ejecutó PostgreSQL en transacción `READ ONLY`; la semántica positiva se
  verificó con el constructor SQL de producción y el fixture de salida.
- No se abrió un archivo descargado por HTTP: se abrió el byte stream real de
  los builders de producción. El acceso HTTP autenticado queda pendiente.
- No se ejecutó codegen porque no cambió `lib/api-spec/openapi.yaml`.
- `pdftotext` del renderer histórico trunca visualmente las colas de líneas
  muy largas: los mismos tres renglones de movimientos ya se truncaban en
  HEAD. Por ello la comparación PDF acredita igualdad de todo el texto
  extraíble y sus 12 cifras extraíbles, pero no acredita visibilidad de los
  campos situados después del corte histórico. Es un límite preexistente que
  requiere un trabajo separado de composición PDF si se exige esa legibilidad.

Los grupos 2, 3 y 4 no fueron implementados. El Grupo 1 tampoco acredita el
cierre de Prompt P hasta resolver los bloqueos anteriores.