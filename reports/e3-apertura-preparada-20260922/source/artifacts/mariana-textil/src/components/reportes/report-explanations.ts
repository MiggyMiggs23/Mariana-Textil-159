const scope = "del periodo y filtros seleccionados, en el sitio elegido o todos los sitios permitidos";
const sales = `de tickets vendidos, con subtotales sin IVA ${scope}`;
const dimensions = `Agrupa cantidad por unidad, tickets y subtotal sin IVA ${scope}; las líneas sin costo cuentan en ventas pero dejan costo, utilidad y margen pendientes.`;

export const REPORT_BLOCK_EXPLANATIONS: Record<string, string> = {
  timeline: `Suma el subtotal sin IVA por fecha local de México ${scope}.`,
  horas: `Suma el subtotal sin IVA de tickets vendidos por hora local ${scope}.`,
  semana: `Acumula el subtotal sin IVA de tickets vendidos por día de semana, no por fecha, ${scope}.`,
  "margen-evolucion": `Suma la utilidad sin IVA por día ${scope}; si un grupo contiene una línea sin costo congelado, su utilidad queda pendiente.`,
  "existencia-producto": "Muestra la cantidad física actual por SKU, unidad y sitio, sin depender del periodo para la existencia.",
  "cierres-diarios": `Reconstruye por día la cantidad física por SKU, sitio y unidad dentro del rango seleccionado, excluyendo pares cuya existencia no concilia con rollos disponibles.`,
  "mes-producto": `Suma cantidad vendida por mes local y SKU, separada por unidad, ${scope}; las líneas sin costo también cuentan.`,
  "mes-color": `Suma cantidad vendida por mes local y color, separada por unidad, ${scope}; las líneas sin costo también cuentan.`,
  "mes-tela": `Suma cantidad vendida por mes local y tela, separada por unidad, ${scope}; las líneas sin costo también cuentan.`,
  "mes-sitio": `Suma cantidad vendida por mes local y sitio, separada por unidad, ${scope}; las líneas sin costo también cuentan.`,
  "color-tela": `Suma cantidad vendida por color y tela, separada por unidad, ${scope}; las líneas sin costo también cuentan.`,
  "costo-por-rollo": `Calcula el costo unitario recibido ponderado por cantidad para cada fecha, SKU y unidad ${scope}; toda recepción es por rollo.`,
  "clientes-top": `Suma el subtotal sin IVA de tickets vendidos por cliente ${scope}; las líneas sin costo siguen contando en ventas.`,

  "ventas-diarias": dimensions,
  "por-dia-semana": dimensions,
  "por-hora": dimensions,
  "por-sitio": dimensions,
  "por-producto": dimensions,
  "por-tela": dimensions,
  "por-color": dimensions,
  "por-vendedor": dimensions,
  "por-cliente": dimensions,
  "por-factura": dimensions,
  "por-pago": `Prorratea el cobro sin IVA por forma de pago y modalidad según el subtotal de línea ${scope}.`,
  "mejores-productos": `Muestra los 20 SKU con mayor subtotal sin IVA ${scope}, separados por modalidad y unidad; las líneas sin costo no excluyen ventas.`,
  "peores-productos": `Muestra los 20 SKU con menor subtotal sin IVA ${scope}, separados por modalidad y unidad; las líneas sin costo no excluyen ventas.`,
  "abc-productos": `Ordena SKU por subtotal sin IVA ${scope} y clasifica el porcentaje acumulado en A hasta 80%, B hasta 95% y C después.`,
  "canasta-pares": `Cuenta los tickets vendidos que contienen cada par de SKU distinto ${scope}, conservando modalidad y unidad de cada línea.`,
  "resumen-cancelaciones": `Cuenta tickets cancelados y suma su subtotal sin IVA por modalidad ${scope}; no representa ventas realizadas.`,
  cancelaciones: `Lista cada ticket cancelado con líneas e importe de subtotal sin IVA ${scope}; no usa costo.`,
  "productos-cancelados": `Agrupa líneas canceladas por SKU, modalidad y unidad con su cantidad e importe sin IVA ${scope}.`,

  "utilidad-por-modalidad": `Calcula subtotal sin IVA, costo congelado y utilidad por modalidad ${scope}; cualquier línea sin costo congelado deja el grupo pendiente.`,
  "utilidad-tela": dimensions,
  "utilidad-producto": dimensions,
  "utilidad-color": dimensions,
  "utilidad-sitio": dimensions,
  "utilidad-vendedor": dimensions,
  "divergencia-cantidad-utilidad": `Calcula por producto, modalidad y unidad la diferencia entre variaciones porcentuales de cantidad y utilidad frente al periodo anterior ${scope}; queda pendiente sin costo actual o anterior.`,
  "productos-alza": `Muestra productos cuya utilidad sin IVA aumentó frente al periodo anterior comparable ${scope}; queda pendiente si falta costo congelado.`,
  "productos-baja": `Muestra productos cuya utilidad sin IVA disminuyó frente al periodo anterior comparable ${scope}; queda pendiente si falta costo congelado.`,
  "dispersion-precios": `Calcula mínimo, máximo y promedios de precio unitario de venta sin IVA por SKU, modalidad, unidad, cliente y vendedor ${scope}.`,
  "precios-por-sitio": `Calcula el precio unitario promedio sin IVA por SKU, modalidad, unidad y sitio ${scope}, y la diferencia entre el mayor y menor sitio.`,
  "calidad-costos": `Cuenta líneas vendidas por modalidad y calidad de costo ${scope}; las líneas sin costo se muestran como pendientes y no se excluyen.`,
  "descuentos-y-margen": `Lista líneas vendidas ${scope} cuyo descuento contra el precio sugerido actual supera 30% o cuyo margen sin IVA está bajo el umbral; el margen queda pendiente sin costo.`,

  "existencia-actual": `Muestra existencia física y rollos actuales por producto, sitio y unidad, con salidas ROLLOS y METRAJE del periodo seleccionado sin combinarlas.`,
  "perdidas-extraordinarias": `Agrupa cantidad física por merma, robo o muestra, producto, sitio y unidad ${scope}; el valor monetario estimado permanece en cero porque la consulta no dispone de precio observado.`,
  "comprado-vendido": `Suma cantidades físicas compradas, vendidas y ajustadas negativamente por producto, sitio y unidad ${scope}.`,
  "sin-movimiento": "Lista productos por unidad cuyo último movimiento no existe o es anterior a 30 días antes del fin del rango, respetando los filtros de producto y sitio.",
  "ranking-color": `Agrupa cantidad física por unidad y subtotal sin IVA por color, tela, modalidad y sitio ${scope}; las líneas sin costo también cuentan.`,
  "color-sitio": `Agrupa cantidad física por unidad, color, modalidad y sitio ${scope}; las líneas sin costo también cuentan.`,
  "sin-movimiento-90": "Lista color, tela y unidad sin movimiento o con último movimiento anterior a 90 días antes del fin del rango, sin aplicar modalidad.",

  "compras-por-rollo": `Lista cada rollo recibido con cantidad por unidad y costos de compra ${scope}; no intervienen líneas de venta ni su costo.`,
  proveedores: `Suma rollos y costo de compra por proveedor y unidad ${scope}; toda recepción es por rollo y el IVA no se desglosa.`,
  productos: `Suma cantidad, rollos y costo de compra por SKU y unidad ${scope}; la referencia METRAJE es un promedio histórico de 12 meses que excluye costos nulos.`,
  telas: `Suma cantidad por unidad, rollos y costo de compra por tela ${scope}; toda recepción es por rollo.`,
  colores: `Suma cantidad por unidad, rollos y costo de compra por color ${scope}; toda recepción es por rollo.`,
  incrementos: "Lista recepciones del rango cuyo costo unitario supera en más de 10% al costo anterior del SKU; esta consulta sólo filtra fechas, no sitio ni proveedor.",
  "alternativas-proveedor": `Compara costo unitario por proveedor y ahorro potencial frente al máximo del producto dentro de las compras filtradas ${scope}.`,

  clientes: `Agrupa tickets, ventas sin IVA y utilidad por cliente ${scope}; las líneas sin costo cuentan en ventas pero dejan utilidad pendiente.`,
  "publico-registrado": `Agrupa tickets y subtotal sin IVA de vendidos entre público y clientes registrados ${scope}; las líneas sin costo siguen contando.`,
  "formas-pago": `Prorratea el importe sin IVA de pagos por forma y modalidad según el subtotal de línea ${scope}.`,
  "cuentas-por-cobrar-fifo": "Muestra saldo monetario y antigüedad de la proyección autorizada global de los clientes seleccionados, sin depender de periodo, sitio, producto o modalidad.",
  "pagos-dirigidos": "Lista pagos dirigidos aprobados por fecha y monto dentro del rango; esta consulta no filtra sitio, producto ni modalidad.",
  "castigos-y-reversos": `Lista importes de crédito incobrable o reverso asociados a tickets vendidos ${scope}.`,
  "pagos-dirigidos-resueltos": "Lista solicitudes aprobadas o rechazadas por fecha resuelta o creada, sitio y monto dentro del rango seleccionado; excluye las pendientes.",
};

const SECTION_OVERRIDES: Record<string, string> = {
  "compras:productos": REPORT_BLOCK_EXPLANATIONS.productos,
  "compras:telas": REPORT_BLOCK_EXPLANATIONS.telas,
  "compras:colores": REPORT_BLOCK_EXPLANATIONS.colores,
  "pagos-dirigidos:pagos-dirigidos": REPORT_BLOCK_EXPLANATIONS["pagos-dirigidos-resueltos"],
};

export function getReportBlockExplanation(id: string, section?: string): string {
  return SECTION_OVERRIDES[`${section}:${id}`] ?? REPORT_BLOCK_EXPLANATIONS[id] ?? "Esta estadística usa los datos y filtros aplicados al reporte.";
}