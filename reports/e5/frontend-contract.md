# E5 — contrato de construcción OFF

## Estado y autoridad

Primera entrega: contrato OpenAPI, clientes/Zod y gates false. Backend en
construcción posterior; no presentar endpoints como operativos todavía.
No E11/E7, migraciones ejecutadas, activaciones, SQL/DB, apps ni tests ejecutados
por el implementador. E9 cerrado OFF en 100bdca; E3 y sus paquetes/dists intactos.

Norma: replit.md P4–P7 y naturaleza/captura canónica E1/E3; plan U E5/E11
interpretado con respuestas P4/P5/P6/P7 posteriores. P6 NO otorga permiso para
aplicar a ContadorA. A prepara, cualquier ADMIN autoriza. No allowlist personal.
No favor automático, FIFO alternativo, reapertura ni modificación histórica.

Recepción sin ADMIN exige exactamente la suma del saldo vigente de las notas
indicadas del mismo cliente. Varias notas permitidas, identificadores únicos.
ADMIN puede recibir importe parcial y autorizar reparto parcial/al momento;
todo sobrante queda retenido, no favor utilizable. La aplicación al momento
es una transacción con recepción, recibo, consumo, crédito y constancia.

P4: rechazo deja dinero esperando. P5: aplicación parcial permite otra propuesta
para el resto, pero desde la primera aplicación el residual nunca es devolvible.
P6: si la nota se pagó mientras esperaba, detener propuesta; no redirigirla
automáticamente. P7: aviso ADMIN desde tres días de recepción original.

## Puertas y entradas reales

Frontend: src/lib/e5-feature-flags.ts, E5_ENABLED=false. Backend:
src/lib/e5-feature.ts, E5_ENABLED=false y E5_CONTADOR_A_ENABLED=false.
OFF impide montar queries, mutaciones, botones, navegación e impresión nuevos.
GET disponibilidad devuelve enabled:false/capacidades false sin auth/DB E5;
las demás rutas E5 rechazan 403 E5_DISABLED antes de DB.

Entradas previstas para la implementación UI:

- pages/cobros.tsx: Caja/cartera realmente montada; acción «Recibir dirigido»
  y sección pendientes. Reutilizar selección de cliente/contexto, no confirmar
  un abono ordinario ni recaptura para simular recepción retenida.
- pages/cliente-detail.tsx: acceso contextual desde ficha/estado de cuenta,
  pendientes del cliente, recibo y constancias (ADMIN).
- Nueva ruta realmente montada /cobros/pendientes para bandeja/avisos;
  /cobros/pendientes/:id para cronología y acciones.
- ADMIN imprime desde /cobros/pendientes/:id/documentos/:documentoId.
- Nota: /tickets/:notaId, ruta existente montada en App.tsx; notaId identifica
  el documento, no movimientoVentaId del ledger. Respetar autorización existente.
- No implementar en pages/pagos-dirigidos.tsx: no está montada.
  /pagos-dirigidos redirige al tab real de reportes; no es la bandeja E5.

MAIN/UI deben montar las rutas E5 anteriores detrás del gate y su autorización.
No hay impresión automática en Caja. Puede reutilizarse el patrón visual A5,
dos copias, firmas/márgenes, sin editar fuente/evidencia sellada E3.

## API, hooks y cuerpos

Base /api; imports @workspace/api-client-react. Todos los hooks siguientes
se generan del OpenAPI; prefix use + operationId con inicial mayúscula.

| Método/ruta | operationId | Cuerpo/consulta |
|---|---|---|
| GET /e5/disponibilidad | getE5Disponibilidad | ubicacionId |
| GET /e5/contexto | getE5Contexto | clienteId, ubicacionId |
| GET /e5/cobros | listE5Cobros | ubicacionId requerido; clienteId/estado/cursor/limit opcionales |
| POST /e5/cobros/vista-previa | previewE5Cobro | E5RecepcionInput |
| POST /e5/cobros | createE5Cobro | E5RecepcionInput |
| GET /e5/cobros/{id} | getE5Cobro | UUID de recepción |
| POST /e5/cobros/{id}/propuestas | createE5Propuesta | claveOperacion, revisionEsperada, versionContexto, asignaciones, evidencia |
| POST /e5/cobros/{id}/autorizar | authorizeE5Aplicacion | anteriores más propuestaId |
| POST /e5/cobros/{id}/rechazar | rejectE5Propuesta | claveOperacion, revisionEsperada, propuestaId, motivo |
| GET /e5/cobros/{id}/devolucion/opciones | getE5DevolucionOpciones | Solo ADMIN |
| POST /e5/cobros/{id}/devolver | returnE5Cobro | claveOperacion, revisionEsperada, peticionCliente, evidencia, fuente |
| GET /e5/avisos | listE5Avisos | ubicacionId; cursor/limit; ADMIN |
| GET /e5/cobros/{id}/documentos/{documentoId} | getE5Documento | ADMIN, snapshot inmutable |
| POST /e5/cobros/{id}/documentos/{documentoId}/impresiones | recordE5Impresion | claveOperacion, motivo; ADMIN |

E5RecepcionInput: claveOperacion UUID, clienteId, ubicacionId, versionContexto,
entrada CAJA/CLIENTE, importe string decimal, formaPago EFECTIVO/TRANSFERENCIA,
cuentaDestino CAJA_FISICA/CUENTA_FISCAL/CUENTA_NO_FISCAL, notasIndicadas:number[],
evidencia, sesionOperativaId?/sesionCajaId?, aplicarAhora?:asignaciones.
No FACTURADO como tercer medio: factura no prueba recepción física.

Efectivo exige sesión física abierta del sitio y CAJA_FISICA. Transferencia
exige cuenta bancaria y prohíbe sesionCajaId. Entrada CAJA exige además sesión
operativa abierta aun en transferencia (regla canónica E3); no convierte la
transferencia en efectivo. Desde CLIENTE, recepción real no es recaptura:
efectivo también requiere sesión física; transferencia no fabrica una.

Asignaciones: [{notaId,movimientoVentaId,importe}], positivas, sin duplicar
movimientoVentaId, mismo cliente. Un ticket puede tener varios cargos; la
autoridad dirigida apunta al movimiento exacto, no a todos los cargos de la nota.
notasIndicadas de recepción sigue siendo lista única de IDs de documentos; la
exactitud compara la suma de sus cargos pendientes vigentes, sin contarlos dos veces.
Al autorizar, ADMIN declara explícitamente el subconjunto/importes de propuesta
vigente que aprueba; no puede ampliar ni cambiar destinos sin nueva propuesta.
Tras aprobación parcial la propuesta queda resuelta y el residual exige otra.
Preparar nueva versión conserva anteriores. Motivo/evidencia obligatorios,
referencias son texto, no URLs descargadas ni HTML ejecutable.

Favor explícito: el plan admite favor autorizado, no favor automático.
Propuesta ADMIN puede declarar importeFavorPropuesto; autorización declara
importeFavorAutorizado <= lo propuesto. Solo se permite cuando, después de
las asignaciones explícitas, la proyección global canónica no tenga deuda:
de otro modo el FIFO consumiría ese dinero en destinos no aprobados. Se rechaza,
no se cambia FIFO ni se convierte silenciosamente en otras aplicaciones.
ContadorA futuro prepara notas, no esta opción ADMIN. El importe autorizado
consume retenido, deja algunaVezAplicado=true y aparece como
importeFavorGenerado en aplicación/constancia; omisión significa cero.
No convertir residual en favor por recibir de más o por nota saldada.

## Frescura, dinero, fechas y capacidades

Contexto da notas con notaId, movimientoVentaId, folio, sitio, fecha, saldo
actual y condición facturada; sesiones autorizadas y capacidades.
versionContexto es token opaco servidor del contexto canónico permitido:
copiarlo, nunca calcularlo ni usar timestamp como sustituto. consultadoAt informa.
Vista previa no reserva. Confirmación revalida bajo locks; cambios requieren
recargar contexto y confirmación, no cambiar automáticamente una intención.

UUID estable por intención/reintento. Misma clave/actor/contenido devuelve
resultado original; otra intención, conflicto. revisionEsperada es revisión
de agregado y propuestaId identifica versión inmutable. Nuevas propuestas no
reciclan UUID. Tras timeout, consultar/reintentar; nunca crear segundo cobro.

Dinero strings de dos decimales; no floats ni sumas autoritativas del navegador.
Estados dinero PENDIENTE/PARCIAL/APLICADO/DEVUELTO; propuestas/rechazos/aplicaciones
son historia aparte. Recibido = aplicado + pendiente + devuelto. Deuda,
disponible y favor no cambian durante espera/preparación/rechazo.

fechaRecepcion real servidor no editable; fechaAplicacion es instante real
posterior/actual, no retroactivo. antiguedadDias y avisoAdmin vienen del servidor:
umbral tres días transcurridos desde recepción, sin reinicio por propuesta,
rechazo, remesa E9 o impresión. No cron/job ni quinta cifra global irrestricta.

Capacidades servidor: puedeRecibir, puedePreparar, puedeAutorizar, puedeRechazar,
puedeDevolver, puedeVerAvisos, puedeImprimir, preparacionADisponible.
ADMIN puede preparar/autorizar; futuro A solamente preparar por integración
E11 explícita hoy false. CONTADOR legacy ni permiso genérico crear la sustituyen.
Recepción conserva actores operativos/permiso efectivo/alcance existentes E1;
no habilita CONTADOR, SISTEMAS o BODEGA. UI no infiere facultades solo del rol.

## Devolución y privacidad

Integración cuentas destino: AdminCuentaDestinoMovimiento añade fuentes
E5_RECEPCION/E5_DEVOLUCION y e5CobroId UUID nullable. documentoTipo=CLIENTE y
documentoId conservan el cliente real; e5CobroId identifica el cobro para enlace
E5 y clave de fila junto con fuente. Aplicaciones no son otro ingreso; Fondo
no se publica como cuenta destino. Esta ampliación requiere regenerar contratos.
El encabezado cobrado añade recepcionesRetenidas/devolucionesRetenidas opcionales
cuando hay filas E5: total incluye la recepción y resta la salida de caja/cuenta,
sin presentar estos importes como abonos, ventas ni favor.
En contexto sin cobro, puedeAutorizar indica ADMIN habilitado para aplicarAhora;
en detalle de cobro sigue exigiendo propuestaVigenteId. No se añadió capacidad.

ADMIN, solicitud expresa del cliente, total original íntegro nunca aplicado.
El cuerpo no acepta importe parcial editable. algunaVezAplicado es irreversible.
GET opciones no convierte elegibilidad en reserva; POST revalida todo.
Fuentes identifican dinero que sale AHORA, no saldo del cierre de recepción:
CAJA con sesión actual abierta; CUENTA con cuenta bancaria real y asociación
operativa cuando el productor la exige; FONDO únicamente identidad Mariana
ADMIN y retiro explícito, jamás inverso de remesa E9. Solo ofrecer fuentes
que servidor pueda verificar conforme a guardas/dependencias; no fabricar
disponibilidad o autoelegir caja original. Sin fuente comprobada, error explícito.
No extender desbloqueo E12 de proveedor a esta devolución.

Una salida física única/transferencia/retiro debe quedar ligada atómicamente a
la devolución; no ABONO ficticio ni reverso de crédito inexistente. No altera
corte cerrado, remesa E9 ni ingreso Fondo anterior. La dependencia de cada
productor cerrado se expresa como E5_DEPENDENCY_DISABLED, no bypass de puertas.

Lista/detalle están filtrados por alcance; no totales globales nuevos. Futuros
A/F no reciben identificación/dirección/costos/margen/Fondo ni documentos o
enlaces que permitan inferirlos. A/F no habilitados en esta fase.
fuente/salidaId/movimientoFondoId de devolución solo ADMIN; tienda ve hecho,
importe, fecha y evidencia documental saneada, no datos del Fondo.
Recibos/constancias imprimibles ADMIN conforme acceso canónico E3; el detalle
operativo permitido no concede acceso al documento completo.

## Recibo y constancia

Recepción crea recibo inmutable inmediato, antes de imprimir. Sin aplicación:
«Recibido, pendiente de aplicación», sin notas pagadas ni favor inventado.
Aplicación genera constancia distinta vinculada al recibo; recibo original no
se reescribe, aun en aplicación al momento. Documentos guardan folios/notas,
actores, importes y fechas tal como se emitieron. No recalcular al reimprimir.
Impresión auditada e idempotente, jamás efecto monetario; fallo de impresora no
repite recepción ni autorización. A5 horizontal, dos copias, firmas separadas.

## Errores e integración

Envelope {error:{code,message}}. 403 E5_DISABLED/E5_DEPENDENCY_DISABLED/
E5_FORBIDDEN; 404 E5_NOT_FOUND; 400 E5_VALIDATION/E5_EXACT_REQUIRED;
409 E5_NOTA_STALE/E5_VERSION_STALE/E5_IDEMPOTENCY_CONFLICT/E5_STATE_CONFLICT/
E5_ALREADY_APPLIED/E5_REFUND_INELIGIBLE/E5_SOURCE_UNAVAILABLE/
E5_INSUFFICIENT_FUNDS. Errores infraestructura no se convierten en cero/éxito.

Reutilizables: useGetCajaAbonoE3Context para entrada existente, lectores
useGetClienteCredito/useGetClienteEstadoCuenta/useGetClientePagos/
useGetClientePagoDetalle. E5 usa su propio contexto frescura y contratos.
No llamar useConfirmCajaAbonoE3 ni recaptura al retener/aplicar; no tratar
useCreateSolicitudPagoDirigido legacy como prueba de recepción.
E1 tiene insertPendingCreditReceiptE1/COBRO_PENDIENTE y tabla separada retenida.
La aplicación requiere productor explícito sin dinero, no disfraz CORRECCION.
E7/E11 siguen posteriores. No modificar reparto FIFO, proyección global,
privacidad previa, paquete E3 ni gates aceptados para construir esta integración.