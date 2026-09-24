# Tanda E — continuación en copia desechable

## Dictamen y alcance

**Recorrido financiero, PDF digital real y signo de CANCELACION acreditados.** La verificación final de impresión del trabajador concluyó a las **03:36:45 UTC del 24/09/2026**, sobre build servido real, sin intercepción ni inyección CSS, en Chromium140 y153. Sesión46 quedó ABIERTA en la instantánea final; después se destruyó exclusivamente el entorno privado por autorización, sin simular un cierre contable. Impresora física no probada.

Se ejecutaron por interfaz real: recuperación y cobro de ticket pendiente, venta por transferencia, Nota autorizada, abono E3 ordinario, consulta de recibo/reimpresión, remate bajo costo, salida E4 suficiente y cancelación de otro ticket pendiente. Las comprobaciones posteriores de base fueron de solo lectura.

**No hubo escrituras de prueba en la base de aplicación, permisos excepcionales, apertura de gates ni cierre automático.** Los preparativos sí escribieron en la copia autorizada: restauración, aislamiento de actores y fixtures sintéticos. No se fabricaron deuda, aplicaciones de crédito ni snapshots de recibo: los produjo el flujo UI. Tras verificar los arreglos, se actualizó únicamente el workflow web para servir el build aceptado; API y base de aplicación no se modificaron.

## Entorno y procedencia

- Fuente efectiva comprobada: `heliumdb`, PostgreSQL 160010, conexión de captura con solo lectura. Configuración del API vivo y del proceso de captura comparadas internamente, sin mostrar secretos.
- Dump nuevo, transaccionalmente consistente; no se afirma quiescencia ni igualdad posterior. Restauración local `tanda_e_continuacion_copy`, puerto 55439; testigo local distinto.
- Actores restaurados anonimizados/deshabilitados, contraseñas sustituidas aleatoriamente y sesiones de autenticación restauradas eliminadas **solo en la copia**.
- Sitio sintético TEC835; ADMIN234 y CAJA235; cliente8 con límite5000 y plazo30; producto2078, lista150, costo físico100 por rollo.
- Proveedor226 → entrada468/folio1 → diez rollos `993000001`–`993000010`, cada uno con recepción canónica y existencia/ledger conciliados. No se relajó ninguna guarda de procedencia.
- Sesión46 preparada abierta con fondo500 y guardián diario. Fecha operativa mexicana23/09; horas de esta cronología en UTC24/09.
- Fuente privada congelada en HEAD `588a13640e6a56ee8d401a9e04d002da3c359f5d`; bundles servidos copiados con hashes. Posteriormente solo se sustituyó la UI privada por el candidato de impresión, conservando la anterior.

Referencias: [identidad de fuente](source-identity.txt), [fixtures redactados](fixture-manifest-redacted.json), [verificación inicial](fixture-check.json), [identidad de build](build-identity.txt), [salud e identidad de conexión servida](health-check.txt).

## Cronología acotada y recuperación del navegador

- **02:45–02:48:** captura, restauración, fixtures y verificaciones.
- **02:49–02:50:** el launcher inicialmente rechazó la falta de ADMIN canónico. Se renombró únicamente el ADMIN sintético a `admin`, conservando su contraseña privada y la guarda. API y proxy aislados quedaron disponibles.
- **02:52:35:** el primer testing-worker creó ticket109/folio1003, pero no lo cobró. Fue cancelado por atasco tras aproximadamente12 minutos, según la coordinación del recorrido.
- El segundo testing-worker también se canceló tras aproximadamente5 minutos sin progreso útil. Son duraciones comunicadas por coordinación, **no timestamps exactos de inicio/fin reconstruidos**. La instantánea03:05:21 solo acredita ticket109 pendiente, sin pagos; último request registrado02:52:35.463. No había respuesta500 que probara un defecto de cobro. No se atribuye causa técnica al atasco.
- **03:14–03:15:** alternativa local Playwright/Chromium exitosa. Bibliotecas Nix existentes, sin instalaciones; todas las mutaciones por UI del origen aislado43820. Acciones acotadas, capturas tempranas y scripts separados.
- **03:17–03:21:** Nota, autorización, abono ordinario, recibo, impresión fallida y conciliación.
- **03:22–03:24:** remate, E4 suficiente y cancelación de pendiente.
- **03:24–03:26:** primer candidato de impresión probado con hashes servidos; persistió PDF vacío. Corte consultado sin cierre.
- **03:31–03:33:** candidato de visibilidad servido real: signo CANCELACION corregido, pero el PDF seguía vacío después de la captura. Se rechazó declarar PASS y se preservó el entorno para diagnóstico.
- **03:35–03:36:** corrección adicional de medición durante resize: botón auditado real, captura completa y PDF natural de dos páginas no vacías en Chromium140/153. Conciliación final de solo lectura y desmontaje privado documentados después.

La evidencia del atasco actual no se confunde con la ejecución histórica de Tanda E, cuyo informe anterior conserva sus propios tiempos y resultados.

## Resultados financieros y evidencia UI

### 1. Recuperación del pendiente y transferencia — acreditado

CAJA recuperó ticket109/folio1003 desde `/cobros` y cobró150 en efectivo, pago91. ADMIN creó ticket110/folio1004 con rollo002 a150; CAJA cobró transferencia150 con referencia, pago92. La transferencia no aumentó efectivo físico.

[Captura: ambos cobros y sus medios](evidence/transfer-caja-05-paid.png) · [conciliación durable](cash-transfer-state.json).

### 2. Nota, E3 ordinario y recibo — dinero acreditado

ADMIN creó Nota111/folio1005, cliente8, rollo003,150 y30días. CAJA la autorizó con permisos naturales: movimiento55 VENTA_CREDITO150. ADMIN registró **abono ordinario E3**, no E1 genérico ni E5: efectivo50 a CAJA_FISICA, movimiento56, aplicación FIFO10 a la venta55. Deuda resultante100; efectivo700 en ese momento.

Recibo único `E3-835-00000001`: ADMIN ve las copias Cliente/Tienda y la aplicación150→100; CAJA recibe «Sin acceso». No se duplicó el dinero al solicitar impresión.

[Vista previa FIFO](evidence/abono-05-preview.png) · [confirmación del abono](evidence/abono-06-success.png) · [recibo visible](evidence/receipt-02-visible.png) · [CAJA denegado](evidence/credit-final-caja-02-receipt-denied.png) · [conciliación E3](credit-reconciliation.json).

### 3. Remate — acreditado

ADMIN marcó rollo005/id6237 con motivo, auditoría4356. Ticket112/**folio1006 de esta copia nueva** se vendió a90 frente a costo congelado100: margen−10, sin ocultar la pérdida. CAJA cobró efectivo90, pago93. La marca y venta están en auditoría y costos congelados.

[Cobro del remate](evidence/remate-caja-04-paid.png) · [ledger, costos y auditoría](remate-e4-cancel-reconciliation.json).

Límite de captura: `remate-05-created.png` conserva un estado de carga; **no se usa como prueba visual del detalle**. La captura inmediata del cobro aún muestra saldo anterior700 durante el refresco; la pantalla inicial E4 muestra790 y la conciliación confirma el incremento90.

### 4. E4 suficiente — registrado, no aprobado

CAJA235 registró salida25 con motivo en el tipo operativo disponible **EXTRAORDINARIA**, desde CAJA_FISICA; salida1/auditoría4361, `desbloqueoCaja:null`. Caja790→765. No hubo excepción por insuficiencia, Fondo ni mezcla E12.

El estado operativo de revisión sigue **PENDIENTE**: el egreso existe y reduce efectivo; **no se declara aceptado/aprobado ni se accionaron Aceptar/Reclamar**.

[Saldo790 anterior](evidence/e4-02-balance790.png) · [salida pendiente y saldo765](evidence/e4-04-success765.png).

### 5. Cancelación de ticket pendiente — acreditado

ADMIN creó ticket113/folio1007 por150 con rollo006/id6238, sin cobrar. Se verificó el botón Cancelar Ticket del detalle, motivo y confirmación exacta del folio1007. Cancelación por ADMIN234: ticket CANCELADO, pago cero y movimientos de crédito cero. Rollo DISPONIBLE1.000; venta−1 y reversión canónica CANCELACION+1, movimiento7385. No se tocó deuda100 ni efectivo765.

[Botón del pendiente](evidence/pending-cancel-03-created-button.png) · [confirmación exacta](evidence/pending-cancel-06-exact-confirmation.png) · [cancelado](evidence/pending-cancel-07-cancelled.png) · [rollo restaurado](evidence/pending-cancel-08-roll-restored.png).

Hallazgo visual separado, **resuelto y comprobado**: el historial había mostrado CANCELACION en rojo−1.00 aunque el ledger era correcto. La [captura final del signo](evidence/final-focused-05-cancellation-plus1.png) muestra CANCELACION+1.00 en verde, saldo6 y rollo DISPONIBLE1.00; VENTA conserva−1.00. No se modificó el ledger para corregir la presentación.

## Qué significa un ticket pendiente; no confundir los ID112

El **ticket112 histórico** pertenecía a la copia anterior ya destruida, segundo sitio/sesión47, importe150, sin cobro y sin sesión de caja asignada. Su rollo6248 había sido consumido por la venta. **No es** el ticket112 nuevo de este informe: sitio835, folio1006, remate90 y cobrado en sesión46. Los ID son locales a cada base; no existe continuidad de identidad entre copias.

La [revisión del pendiente histórico](ticket-150-audit.md) corrigió la hipótesis de «huérfano/oculto»: la consulta de Caja incorpora TICKET VENDIDO no cobrado por sitio, independientemente de la sesión de creación. No se identificó caducidad ni cancelación automática; puede permanecer pendiente indefinidamente. Una sesión abierta posterior del mismo sitio puede cobrarlo, o una cancelación autorizada desde su detalle revierte inventario.

Un pendiente representa trabajo/documento e inventario consumido, **no efectivo recibido ni venta financiera cobrada**. El corte lo muestra en una sección de pendientes separada de los totales financieros. Cerrar no equivale a cobrarlo o cancelarlo. En esta continuación se demostraron por UI ambas salidas del estado pendiente: cobro109 y cancelación113. No se alteró ni recuperó materialmente el antiguo112.

## Corte y conciliación final — sesión abierta

**Efectivo esperado: 500 +150 +90 +50 −25 = 765.00.**

- Fondo inicial500.
- Tickets en efectivo240: folios1003/150 y1006/90.
- Abono físico E3:50.
- Salida física E4:25.
- Transferencia150 separada; no entra en efectivo.
- Deuda cliente8:150−50=100.
- Cobros de tickets por todos los medios390; no confundirlos con el abono ni con las ventas a crédito.
- Pendientes de ticket:0; cancelado1007 excluido.

ADMIN abrió **solo la vista previa** «Realizar Corte», verificó desglose E2 y pulsó Cancelar. No capturó contado ni confirmó cierre. Sesión46 ABIERTA, `cerrada_at` y contado nulos.

[Captura corte765](evidence/open-corte-03-preview765.png) · [respuesta GET y texto completo](evidence/open-corte-read-evidence.json) · [sesión abierta después](evidence/open-corte-04-left-open.png) · [comprobación posterior](candidate-print-db-check.json).

## Impresión — PASS digital sobre build servido real

Los candidatos anteriores están **superados, no borrados**: auditorías4351/4367 y posteriores disparaban impresión, pero el PDF era una página A5 vacía. Corregir la visibilidad de ancestros `display:contents` no bastó en el recorrido completo: la captura/resize en media print volvía a medir el probe oculto y vaciaba ambas páginas. La guarda de rectángulos de layout evita esa re-medición inválida. La regresión causal falla al retirar solo esa guarda.

[Resultado del candidato](print-candidate-verification.json) · [pantalla de impresión vacía](evidence/candidate-print-04-print-media.png) · [PDF fallido conservado](evidence/candidate-receipt-natural-pages.pdf) · [eventos y geometría](evidence/candidate-print-result.json).

**Resultado final del trabajador revisado sin repetir mutaciones:** en Chromium140 y153 se pulsó el botón real (POST200, auditoría), se tomó screenshot completo y después se exportaron todas las páginas naturales: **dos páginas A5 horizontales,594.96×420pt, Cliente/Tienda**, texto requerido en cada una;23200 y23213bytes respectivamente. Sin `pageRanges`, intercepción de assets ni CSS inyectado. Ambos raster finales fueron revisados visualmente y contienen solo cliente/actores sintéticos. **No acredita impresora física.**

[Verificación final](evidence/print-resize-final-verification.json) · [recorrido140](evidence/print-resize-fixed-focused140.json) · [recorrido153](evidence/print-resize-fixed-focused153.json) · [PDF140 correcto](evidence/print-resize-fixed-chromium140.pdf) · [PDF153 correcto](evidence/print-resize-fixed-chromium153.pdf) · [Cliente rasterizado](evidence/print-resize-fixed-raster-1.png) · [Tienda rasterizada](evidence/print-resize-fixed-raster-2.png).

Build `dist-tanda-e-print-resize-final-20260924`, revisión `11a070a2acf718650fa346cbd60b320ba718a01c`; HTML SHA256 `6909b2638576c8735ccffa14959c6f0872fffbeaac5adce48e22520e9dabbea4`; JS `d3930f905a084b71292fc3ffaaa88059cd27ccf3cee0f0378228e178a070c6ce`. Auditorías finales4383/4385 corresponden a las solicitudes exitosas de los dos navegadores. El expediente separa explícitamente el PASS final servido del PASS parcial previo por intercepción. UI liberada en el runtime del workspace mediante TOML validado y un reinicio web; pantalla de login comprobada sin iniciar sesión en la base de aplicación (`evidence/released-login.jpg`). API no modificada ni reiniciada. No se publicó en la nube.

## Seguridad, conservación y pendientes

Las capturas seleccionadas para el HTML se revisaron: muestran solo operaciones/actores/clientes sintéticos, el catálogo de sistema Venta al Público o navegación, sin clientes reales heredados ni credenciales; no fue necesario enmascararlas. Se omiten capturas de login/global no revisadas y archivos privados. [Auditoría documental de secretos](report-security-audit.json).

No se hizo commit desde esta tarea. No reejecutar scripts de mutación ya exitosos: crearían nuevas operaciones. No se repitieron en esta tanda las negativas de bajo costo sin marca, exceso de caja, cierre/doble cierre ni otros casos históricos; no se atribuye cobertura nueva a esos puntos.

Última evidencia financiera: [instantánea final](final-financial-state-db.json) y [reconciliación final](final-economic-reconciliation.json). Se preservan saldo765, deuda100, un solo abono56, sin pagos/crédito del cancelado113. Las solicitudes de reimpresión no duplicaron dinero.

El entorno privado fue retirado después de la instantánea03:38:20 UTC, sin cerrar la sesión por negocio. A las03:39:15 se verificaron launcher/API/proxy/cluster detenidos, puertos43820/43821/55439 sin escucha y directorio privado eliminado, incluyendo dump, credenciales y copia fuente. [Verificación de teardown](teardown-verification.json). Los reportes, PDFs y evidencias se conservan; ese desmontaje no afectó al runtime de la aplicación. Separadamente, la liberación anterior reinició solo el frontend real, no la API. Las instrucciones históricas de [handoff](handoff.md) describen un entorno que ya no existe.