# E7 OFF — contrato de integración

Construcción autorizada de atribución y Grupo 1, no activación, aceptación
autenticada ni cierre de Prompt P. E3, históricos 51/52/53 y grupos 2–4 intactos.

Interfaz publicada en OpenAPI; fuentes backend completas con typecheck source-only
sin emit: 0 diagnósticos. YAML parseado estáticamente: cinco operaciones E7.
No generados ni casos ejecutados. Revisados mapa/matriz frontend: ClienteDetail
puede conectar ACCIONES/PREVIEW DE EXPORTACIÓN Grupo 1, pero sustituir su estado
de cuenta interactivo sería Grupo 4 y queda fuera. A no recibe un nuevo lector
E7 ni retención añadida a E11; conserva íntegramente su lector E11 saneado. Si la
matriz espera expansión A o Grupo 4, MAIN debe resolver esa tensión antes de
implementarla. P9 posterior prevalece sobre la frase anterior de U.

Contrato UI estable:
- GET /e7/disponibilidad → {enabled:boolean}; sin consulta DB si OFF.
- GET /e7/atribucion?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&ubicacionId=N
  (o ubicacionIds=N,M): fuente para Cuentas Destino / Tiempo real. ADMIN o
  SISTEMAS conforme lectura de Cuentas Destino; no concede acceso al tablero
  Tiempo real a SISTEMAS. Alcance real resuelto con criterio Cartera.
- GET /e7/clientes/{clienteId}/exportacion: proyección compartida de las
  exportaciones Grupo 1, no habilita ficha/directorio/operaciones grupos 2–4.
  Mismos filtros de sitios, permiso clientes_finanzas.ver real.
- GET /e7/atribucion.xlsx y /e7/atribucion.pdf: mismo lector y mismos filtros,
  puentes y leyendas internas. Cinco operaciones E7 en total, todas GET.

Todos los endpoints E7 salvo disponibilidad fallan 403 E7_DISABLED antes de
auth/DB cuando OFF. CONTADOR no entra por override: F sigue sólo fiscal E11 y A
sólo financiero saneado E11 existente. E7 no añade permiso ni consulta Fondo.

Ambas lecturas devuelven alcance {tipo:GLOBAL|SITIOS,ubicaciones:[{id,nombre}],
generadoEn,saldoAFavorDisponible}, leyendas:string[], y generadoEn.
Exportación además clienteId, resumenGlobal exactamente
{deudaActual,saldoAFavor,limiteCredito,creditoDisponible}, movimientos,
retenidos y totalRetenido del ALCANCE, nunca quinta cifra global irrestricta.
Movimientos: id:string,fecha:ISO,tipo:string,importe:decimal,
ubicacionId:number|null,folio:string|null,saldoPendiente:decimal|null.
Retenidos: cobroId:UUID,fechaRecepcion:ISO,ubicacionId:number,
importePendiente:decimal,antiguedadDias:integer.

Atribución devuelve cobranzaTotal:string|null, recepcionesFisicas:string|null,
aplicacionesNotas:string, movimientos (id,fecha,tipo,importe,ubicacionId,
cuentaDestino), puente por tipo/cuentaDestino con total y totalRetenido del
alcance y retenidos (sin IDs cliente/notas ni receptor). Tipo distingue
VENTA_CONTADO, RECEPCION, REGISTRO_HISTORICO, APLICACION, REVERSO_APLICACION,
CORRECCION y DEVOLUCION. Retenido es un stock separado, no fila de cobranza.
RECEPCION se cuenta globalmente una sola vez en fecha
recepción; APLICACION es otra dimensión, nunca segundo ingreso. Sitio recibe
aplicaciones comprobadas, no recepción inferida del ticket del abono.
Sin sitio determinado existe sólo en global, no se inventa atribución.
En SITIOS cobranzaTotal y recepcionesFisicas son null: la tarjeta es aplicaciones
comprobables, no cobro inferido. En global cobranzaTotal suma contado, recepción,
registro histórico, corrección y devolución firmados; NUNCA aplicaciones.
recepcionesFisicas separa contado/recepción explícita, sin convertir registros
históricos o correcciones en nuevos ingresos. Puente agrupa por fuente, cuenta
y sitio; ninguna cuenta se infiere por la factura de una nota receptora.
Retenido es stock al generadoEn, NO limitado a recepciones dentro del rango
desde/hasta. El rango de cobranza es inclusivo, zona México y máximo 366 días.

Leyendas literales en UI y dentro de todos los archivos:
“El resumen global de crédito considera todos los sitios.”
“El detalle corresponde solo a los sitios autorizados y no representa la deuda total del cliente.”
Además: “Las aplicaciones a notas no son nuevos ingresos.”
“El dinero retenido pendiente de aplicación no es saldo a favor ni reduce la deuda.”
“Sin sitio determinado”.

Dependencias reales: E5 recepción inmutable y aplicaciones/vínculos propios;
ABONO E5 ya es OPERACION_CREDITO_SIN_DINERO con cuenta_destino NULL.
E4 salidas no son cobranza; E9/E12/Fondo/capital/traslados no se suman.
No modificar definición de FIFO ni riesgo/antigüedad de deuda; sólo antigüedad
del retenido es una dimensión nueva. Fuente ausente/incoherente falla explícito,
no lector alternativo ni cero inventado. MAIN genera clientes/validadores.

## Integración real y límites

Los tres handlers existentes /clientes/:id/estado-cuenta.xlsx, .pdf e /imprimir
delegan a e7Reader.statement y serializadores e7-export cuando E7_ENABLED=true.
OFF pasa a sus handlers anteriores sin cambios de cifras. En ON nunca se
recurre al exportador anterior por un error. Analítica XLSX conserva su consulta
scoped de Grupo 1 y leyendas; sólo agrega guarda CONTADOR acorde E11. No se tocan
las consultas JSON ficha/directorio/operaciones de grupos 2–4.

UI Cuentas Destino/Tiempo real debe consumir getE7Atribucion cuando el gate UI y
disponibilidad lo permitan, y enlazar sus exportaciones E7 a los dos archivos
nuevos. No sumar la cobranza legacy a cobranzaTotal, ni sumar aplicaciones al
ingreso, ni deducir cero a partir de null. Ventas/otros indicadores legacy
conservan su lector y valores; la nueva proyección es la fuente de atribución
de cobranza/aplicaciones/retención, no un segundo motor de ventas o cartera.
Los endpoints administrativos legacy no se reescriben como DTO E7: no romper
su contrato ni grupos ajenos. La guarda CONTADOR también cubre Cuentas Destino
legacy cuando E7 está ON; A/F siguen sólo sus superficies E11.

Estado de cuenta ON: exactamente cuatro cifras globales, sin clasificación
global SALDO_DEUDOR ni saldos corridos fuera de alcance. Saldo pendiente de cada
nota autorizada sí viaja. Abonos sin ticket se representan por deltas de trazas
de prefijos del MISMO projectCreditLedger(global), con reversos/repartos/favor
canónicos; no se usa suma de aplicaciones_credito como reemplazo de FIFO.
Las aplicaciones E5 conservan vínculo real e5_vinculos_credito → aplicación
→ recepción para cuenta; nunca se deduce por monto/fecha/cliente.
En el estado global se conservan filas RECEPCION_RETENIDA y DEVOLUCION_RETENIDA
con sus fechas reales E5 incluso después de que pendiente llegue a cero.
Son evidencia física separada: no entran a los cuatro saldos globales ni al
proyector de deuda, y APLICACION_SIN_DINERO no se presenta como segundo ingreso.

## Infraestructura interna para pruebas (sin reemplazar política)

createE7Reader({enabled?,e5Enabled?,now?,database?,permissionDatabase?,transaction?})
expone statement({userId,sessionId},clienteId,query) y
attribution({userId,sessionId},{desde,hasta,...scope}).
database implementa CreditLedgerQuery.query; permissionDatabase es el adapter
Drizzle select de resolvePermiso; transaction(work(database)) opcional permite
simular snapshot. No admite identity/authorize/scope/projector alternativos.
Gates/clock son código interno congelado por factory, nunca HTTP/env/usuario.
DB, sesión/usuario activo, expiración y límite absoluto 16h se leen realmente;
resolvePermiso central y normalizador Cartera/resolveReadScope reales se usan
sin mocks de política. Reautoriza permiso e identidad/alcance antes de devolver.
resolveReadScope se movió sin cambio funcional a lib/read-scope y conserva
reexport en inventario; no cambia ningún veto de acción por rol.

Producción usa pool lazy, lectura READ ONLY REPEATABLE READ (sin escritura de
datos), siempre rollback/release ante error. Fake database sin transaction debe
proveer su propia semántica de snapshot. E7 OFF no importa DB en sus nuevos
handlers; E7 ON con dependencia E5 OFF falla explícito 503, no inventa cero.
E4 fuente real inspeccionada: salidas_dinero_caja + sidecar de revisión, excluidas
de cobranza. E6 nomenclatura existente no es una tabla ni motor que inventar.
E5 fuentes inspeccionadas: recepciones, aplicaciones, vínculos y devoluciones;
fecha devolución se obtiene de aggregate E5 real guardado atómicamente con
e5_devoluciones (esa tabla NO tiene snapshot ni created_at). No se leen saldos
Fondo ni sus movimientos; la devolución E5 no revela IDs/fuentes Fondo.

Sin nuevo esquema, SQL preparado/ejecutado, escrituras de datos, casos de prueba,
ejecución API, apps, workflows, bundles ni dist. No afirmar aceptación autenticada
Grupo 1 ni liberar E3. MAIN es dueño de generados y verificación posterior.