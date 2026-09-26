// Synthetic, read-only HTTP fixtures. Nothing here reaches the managed API or database.
export const locations = [
  { id: 1, nombre: "Tienda Centro", iniciales: "TC", tipo: "TIENDA", activa: true, esSistema: false },
  { id: 2, nombre: "Tienda Norte", iniciales: "TN", tipo: "TIENDA", activa: true, esSistema: false },
  { id: 3, nombre: "Tienda Sur", iniciales: "TS", tipo: "TIENDA", activa: true, esSistema: false },
  { id: 4, nombre: "Bodega Tomás", iniciales: "BT", tipo: "BODEGA", activa: true, esSistema: false },
  { id: 5, nombre: "Bodega Don Nacho", iniciales: "BDN", tipo: "BODEGA", activa: true, esSistema: false },
  { id: 6, nombre: "Bodega Lucas Alamán", iniciales: "BLA", tipo: "BODEGA", activa: true, esSistema: false },
  { id: 7, nombre: "Bodega Cruces", iniciales: "BC", tipo: "BODEGA", activa: true, esSistema: false },
];
const client = { id: 41, nombre: "Textiles Aurora", rfc: "TAU250101AB1", telefono: "5512345678", correo: "compras@aurora.example", activo: true, esSistema: false, recibeNotaSinPrecios: false, createdAt: "2025-01-10T12:00:00.000Z", updatedAt: "2026-09-20T12:00:00.000Z", limiteCredito: "50000.00", saldoActual: "12400.00", saldoAFavor: "0.00", diasCredito: 30, movementCount: 8, lastActivity: "2026-09-20T12:00:00.000Z" };
const supplier = { id: 12, nombre: "Hilados del Centro", rfc: "HCE250101AB1", contactoNombre: "Ana López", telefono: "5555555555", correo: "ventas@hilados.example", activo: true, tipo: "NACIONAL", monedaDefault: "MXN", pais: "México", notas: null, createdAt: "2025-01-10T12:00:00.000Z" };
const date = "2026-09-25T12:00:00.000Z";
const cartera = (url) => {
  const raw = url.searchParams.get("ubicacionIds") || url.searchParams.get("ubicacionId");
  const ids = raw ? raw.split(",").map(Number) : [];
  return {
    alcance: { tipo: ids.length ? "SITIOS" : "GLOBAL", ubicaciones: locations.filter(x => ids.includes(x.id)).map(x => ({ id: x.id, nombre: x.nombre })), generadoEn: date, saldoAFavorDisponible: true },
    resumen: { totalCartera: "12400.00", totalVencido: "2000.00", clientesConSaldo: 1, totalClientes: 1 },
    clientes: [], antiguedad: [], porUbicacion: [], distribucion: [],
  };
};
export function response(url, { crucesStore = false } = {}) {
  const p = url.pathname;
  const sites = locations.map(x => x.id === 7 && crucesStore ? { ...x, tipo: "TIENDA" } : x);
  if (p === "/api/e11/disponibilidad") return { enabled: true, perfiles: true, conciliacion: true, preparacionE5: true };
  if (p === "/api/e11/identidad") return { usuarioId: 7, rolBase: "ADMIN", perfil: null, perfilVersion: 3, permisosVersion: "fixture-v1", capacidades: ["PERFILES_ADMINISTRAR"] };
  if (p === "/api/e7/disponibilidad") return { enabled: true, clienteFinanzas: true, atribucion: true };
  if (p === "/api/e7/clientes/41/exportacion") return { clienteId: 41, alcance: { tipo: "GLOBAL", ubicaciones: [], generadoEn: date, saldoAFavorDisponible: true }, generadoEn: date, leyendas: [], resumenGlobal: { deudaActual: "12400.00", saldoAFavor: "0.00", limiteCredito: "50000.00", creditoDisponible: "37600.00" }, movimientos: [], retenidos: [], totalRetenido: "0.00" };
  if (p === "/api/auth/me") return { id: 7, nombre: "Administrador de fixture local", usuario: "admin-fixture", rol: "ADMIN", ubicacion: sites[0], alcanceConsulta: "TODAS", permisos: [
    "dashboard", "ubicaciones", "usuarios", "permisos", "inventario", "entradas", "salidas", "viajes", "movimientos", "clientes", "clientes_finanzas", "clientes_credito", "proveedores", "proveedores_finanzas", "reportes", "cobros_pagos", "ajustes", "productos", "pos", "auditoria_inventario"
  ].map(modulo => ({ modulo, puedeVer: true, puedeCrear: true, puedeEditar: true, puedeAutorizar: true })) };
  if (p === "/api/locations" || p === "/api/inventario/ubicaciones" || p === "/api/ubicaciones" || p === "/api/ubicaciones/inventario" || p === "/api/salidas/ubicaciones") return sites;
  if (p === "/api/clientes/listado") return { items: [client], total: 1, page: 1, pageSize: 50 };
  if (p === "/api/clientes") return { items: [client], total: 1 };
  if (p === "/api/clientes/41") return client;
  if (p === "/api/clientes/41/compras") return { clienteId: 41, compras: [{ id: 725, fecha: date, total: "1200.00", folio: 725, subtotal: "1034.48", iva: "165.52", rollosMetros: "1", rollosKilos: "0", rollosBolsas: "0", metrajeMetros: "12", metrajeBolsas: "0", margen: "300.00", lineasSinCosto: 0 }], total: 1, periodo: {} };
  if (p === "/api/clientes/41/estadisticas") return { clienteId: 41, totalCompras: "1200.00", comprasCount: 1, metros: "12", kilos: "0", bolsas: "0", costo: "900.00", margen: "300.00", lineasSinCosto: 0, comprasPorMes: [] };
  if (p === "/api/clientes/41/analitica") return { clienteId: 41, periodo: { desde: null, hasta: null }, productos: [], telasColores: [], tendencia: [], mezclaPagos: [], actividad: {} };
  if (p === "/api/clientes/41/credito") return { clienteId: 41, limiteCredito: "50000.00", saldoActual: "12400.00", saldoAFavor: "0.00", creditoDisponible: "37600.00", puedeComprarCredito: true, diasCredito: 30, utilizacion: "24.8", totalVencido: "2000.00", antiguedad: [] };
  if (p === "/api/clientes/41/estado-cuenta") return { clienteId: 41, movimientos: [], saldoActual: "12400.00", saldoAFavor: "0.00" };
  if (p === "/api/clientes/41/pagos") return { clienteId: 41, pagos: [] };
  if (p === "/api/clientes/41/precios") return { clienteId: 41, precios: [] };
  if (p === "/api/clientes/41/documentos") return [];
  if (p === "/api/clientes/41/comportamiento-pago") return { clienteId: 41, clienteNombre: client.nombre, percentage: 100, settledNotes: 1, evaluatedNotes: 1, onTimeNotes: 1, overdueOpenNotes: 0, openNotDueNotes: 0, color: "GREEN", sufficientHistory: false, utilizationPercent: 24.8, suggestCreditIncrease: false, period: "Últimos 12 meses", explanation: "Fixture sintético sin base de datos." };
  if (p === "/api/clientes/41/evidencia-credito") return { clienteId: 41, atribucionHabilitada: false, movimientos: [] };
  if (p === "/api/pagos-dirigidos") return { solicitudes: [], total: 0 };
  if (p === "/api/tickets/725") return { id: 725, folio: 725, ubicacionId: 1, nombreUbicacion: "Tienda Centro", usuarioTerminalId: 7, nombreUsuarioTerminal: "Administrador de fixture local", clienteId: 41, nombreCliente: client.nombre, notaSinPrecios: false, subtotal: "1034.48", iva: "165.52", tasaIva: "16.00", total: "1200.00", estado: "VENDIDO", cobrado: true, facturado: false, uuidCliente: "11111111-1111-4111-8111-111111111111", createdAt: date, canceladoAt: null, canceladoPor: null, nombreUsuarioCancelacion: null, motivoCancelacion: null, autorizadoPor: null, nombreUsuarioAutorizacion: null, esCredito: false, importeCredito: "0.00", diasPlazo: null, fechaVencimiento: null, saldoPendiente: "0.00", estadoNota: null, telefonoCliente: client.telefono, correoCliente: client.correo, direccionCliente: null, documentoTipo: "TICKET", convertidoANotaPorCobro: false, lineas: [], pagos: [], salidas: [] };
  if (p === "/api/clientes/cartera") return cartera(url);
  if (p === "/api/clientes/analitica") return { resumen: {}, clientes: [], porMes: [], serieMensual: [], ranking: [] };
  if (p === "/api/clientes/comportamiento-pago") return [];
  if (p === "/api/proveedores") return { items: [supplier], totalProveedores: 1, totalDeuda: "2300.00", comprasMes: "17500.00", proveedoresConSaldo: 1 };
  if (p === "/api/proveedores/12") return supplier;
  if (p === "/api/proveedores/12/compras") return { items: [], total: 0, totalCostoPeriodo: "0.00", page: 1, pageSize: 1000 };
  if (p === "/api/proveedores/12/estado-cuenta") return { movimientos: [], saldoActual: "2300.00" };
  if (p === "/api/proveedores/12/estadisticas") return { desde: url.searchParams.get("desde"), hasta: url.searchParams.get("hasta"), totalCompras: "0.00", comprasCount: 0, totalRollos: 0, costoPorMetro: null, costoPorKilo: null, ticketPromedio: "0.00", diasDesdeUltimaCompra: null, ultimaCompra: null, frecuencia: { promedioDiasEntreCompras: null, ultimaCompra: null }, estacionalidad: { mesMayor: null, mesMenor: null }, concentracion: { productoPrincipalPct: "0.00", tresPrincipalesPct: "0.00" }, productosExclusivos: [], diasPromedioPago: null, antiguedadDeuda: { hasta30: "0.00", de31a60: "0.00", de61a90: "0.00", mas90: "0.00" }, margenGenerado: { ventas: "0.00", costo: "0.00", margen: "0.00", margenPct: null, lineasIncluidas: 0, lineasExcluidasSinRollo: 0, lineasExcluidasSinCosto: 0, nota: "Fixture sintético sin base de datos." }, porMes: [], porProducto: [], porTela: [], porColor: [] };
  if (p === "/api/proveedores/directorio") return { items: [{ proveedorId: 12, purchaseCount: 4, totalComprado: "17500.00", saldoPendiente: "2300.00", ultimaCompra: date, demanda: "ALTA" }], total: 1 };
  if (p === "/api/proveedores/historial-compras") return { items: [{ entradaId: 418, fecha: date, productoId: 31, producto: "Lino", color: "Azul", unidad: "METRO", proveedorId: 12, proveedor: supplier.nombre, ubicacionId: 4, sitio: "Bodega Tomás", cantidad: "20.000" }], total: 1, page: 1, pageSize: 50, sitios: locations.map(x => ({ id: x.id, nombre: x.nombre })), telas: ["Lino"], colores: ["Azul"] };
  if (p === "/api/proveedores/analitica-global") return { tendenciaMensual: [], deuda: [], pareto: [], costosAlAlza: [], comparacionCostos: [], antiguedadDeuda: { hasta30: "0", de31a60: "0", de61a90: "0", mas90: "0" } };
  if (p === "/api/inventario/existencias/agrupadas" || p === "/api/inventario/existencias-agrupadas") return [];
  if (p === "/api/inventario/rollos") return { items: [], total: 0, page: 1, pageSize: 20 };
  if (p === "/api/inventario/entradas") return { items: [], total: 0, page: 1, pageSize: 20 };
  if (p === "/api/inventario/entradas/catalogos") return { proveedores: [supplier], productos: [], ubicaciones: sites, pisos: [] };
  if (p === "/api/inventario/entradas/pendientes-costo/count") return { count: 0 };
  if (p === "/api/salidas") return { items: [], total: 0, page: 1, pageSize: 20 };
  if (p === "/api/viajes") return [];
  if (p === "/api/inventario/kardex/grouped" || p === "/api/inventario/kardex/agrupado") return { grupos: [], total: 0, page: 1, pageSize: 20, totalPages: 0, resumen: {} };
  if (p === "/api/inventario/ajustes/pendientes") return [];
  if (p === "/api/etiquetas/alertas") return { items: [], total: 0 };
  if (p === "/api/notificaciones") return { sistema: [], notificaciones: [], totalNoLeidas: 0 };
  if (p === "/api/notificaciones/feed") return { events: [], total: 0, cursor: null };
  if (p === "/api/admin/test-reset") return { enabled: false, protectCustomers: true, preserves: [], clears: [], confirmation: "BORRAR" };
  if (p === "/api/etiquetas/alertas/count") return { count: 0, threshold: 3 };
  if (p === "/api/reportes/catalogos") return { sites: sites.map(x => ({ id: x.id, label: x.nombre })), comparisonLocations: sites.map(x => ({ id: x.id, label: x.nombre })), suppliers: [{ id: 12, label: supplier.nombre }], clients: [{ id: 41, label: client.nombre }], products: [], fabrics: [], colors: [], units: [], users: [], paymentMethods: [] };
  if (p === "/api/inventario/fecha-servidor") return { fecha: date, zonaHoraria: "America/Mexico_City" };
  if (p === "/api/inventario/kardex/filtros") return { productos: [], usuarios: [], ubicaciones: sites.map(x => ({ id: x.id, nombre: x.nombre })), tipos: [] };
  if (p === "/api/admin/comparacion-tiendas") return { tiendas: [], ventasPorFecha: [], periodo: "mes" };
  if (p === "/api/users") return { items: [], total: 0 };
  if (/^\/api\/locations\/\d+\/pisos$/.test(p)) return [];
  if (/^\/api\/reportes\/(ventas|clientes|pagos-dirigidos|utilidad|inventario|mapas-calor|color|compras|que-comprar|control-operativo)$/.test(p)) return { section: p.split("/").at(-1), generatedAt: date, hasEconomicAccess: true, range: {}, activeFilters: [], warnings: [], kpis: [], charts: [], tables: [] };
  if (p.startsWith("/api/reportes/secciones/") || p.startsWith("/api/reportes/vistas/")) return { resumen: {}, items: [], rows: [], series: [], datos: [], columnas: [], totales: {} };
  if (p.startsWith("/api/ubicaciones/") && p.endsWith("/pisos")) return [];
  if (p === "/api/productos") return { items: [], total: 0 };
  if (p === "/api/usuarios") return { items: [], total: 0 };
  return undefined;
}