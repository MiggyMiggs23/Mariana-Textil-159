# E12 — contrato frontend definitivo para construir OFF

## Estado y gates

Backend: `E12_SUPPLIER_CASH_ENABLED = false` en
`artifacts/api-server/src/lib/e12-supplier-cash.ts` (implementación a continuación).
Frontend: gate fuente `E12_ENABLED=false`, independiente de E3/E4/Fondo.
**No abrir otros gates.** UI OFF no cambia llamadas, formularios ni experiencia.
Nuevas opciones OFF responden `{enabled:false,motivoInactivo:...}` sin consultar
esquema E12/E10. Intentos con campos E12 OFF: 403 `E12_DISABLED`, nunca ignorarlos
para terminar en el productor legado. Lectores OFF omiten metadata nueva.

No frontend editado por backend. OpenAPI conserva rutas, envelopes y formas de
pago anteriores; añade campos opcionales por compatibilidad OFF/históricos.

## 1. Pago FIFO: productor existente

`POST /api/proveedores/:id/pagos`, `useRegistrarPagoProveedor()`.

Body existente `{importe:number,formaPago,fecha?,referencia?,notas?}` más:

```json
{
  "efectivoE12": {
    "claveOperacion": "UUID por intención",
    "caja": "247000.00",
    "fondo": "1000000.00",
    "sesionCajaId": 123,
    "desbloqueoCaja": { "motivo": "Solo ADMIN; opcional salvo insuficiencia" }
  }
}
```

- E12 ON + EFECTIVO: desglose obligatorio. `caja+fondo=importe` exactamente a
  centavos; partes no negativas y total positivo. `fondo` omitido equivale a cero.
- TRANSFERENCIA/FACTURADO no admiten desglose. Históricos CHEQUE/OTRO no se
  convierten en opciones seleccionables.
- Caja positiva exige sesión abierta de **Mariana (id=1)**. Fondo puro (`caja:
  "0.00"`) no exige sesión; omitirla o null. No inventar sesión ni abrir turno
  para pagar solo desde Fondo.
- Un solo pago financiero/aplicación FIFO por el total, una salida caja por
  su parte y un retiro Fondo por la suya, en la misma transacción.
- UUID se conserva al reintentar mismo contenido; no regenerar por timeout.
  Contenido cambiado exige nueva intención. Reintento devuelve mismo pago.
- Respuesta 201 `PagoProveedorRow` existente, con `efectivoE12` **solo ADMIN**.
  No interpretar ausencia como partes cero ni construir Fondo en frontend.

`POST /proveedores/:id/pagos/preview` / `usePreviewPagoProveedor` conserva cálculo
FIFO, sin reservar saldo ni escribir. Confirmación revalida montos/saldos/sesión.

## 2. Disponibilidad (no reserva)

Nuevo `GET /api/proveedores/:id/pagos/efectivo-opciones`,
`useGetOpcionesPagoEfectivoProveedor(id, {query:{enabled:E12_ENABLED&&...}})`.

Respuesta ON:

```text
{
 enabled:true, ubicacionId:1, sesionCajaId:number|null, saldoCaja:string|null,
 puedeDesbloquearCaja:boolean,
 fondo?:{saldo:string,versionSaldo:UUID|null}
}
```

Sin sesión: caja/saldoCaja null. `fondo` existe **solo ADMIN**, aun si saldo cero.
No mostrar control Fondo ni saldo para no ADMIN. Refrescar al abrir/reabrir
diálogo y tras cada mutación, pero el servidor es autoridad al confirmar.

Permisos:
- Pago caja-only conserva `proveedores_finanzas/crear` y alcance operativo
  Mariana: no ADMIN necesita tienda asignada Mariana, no se le concede permiso
  nuevo por rol. No ampliar los 69 vetos ni asumir contador con acceso Fondo.
- Solo ADMIN usa, ve o retira Fondo. Un payload manipulado se rechaza.
- Opciones usa permiso de crear pago, no habilita el módulo Fondo global.
- Desbloqueo por saldo insuficiente es **solo ADMIN**, motivo 1–1000 obligatorio
  e historial. No se habilita un permiso de matriz que permita a otro actor
  desbloquear. Caja puede quedar negativa por esta excepción explícita.
- Fondo retiro **nunca** deja saldo negativo, incluso ADMIN. Corrección contable
  E10 es operación distinta; no reutilizarla para pagar proveedor sin saldo.

## 3. Metadata de pago, detalle e historial

ADMIN recibe `efectivoE12?: E12PagoEfectivoDetalle` en `PagoProveedorRow`
(creación/lista/detalle) y `MovimientoLedger` (estado de cuenta):

```text
{
 claveOperacion,pagoProveedorId,total,caja,fondo,
 sesionCajaId:number|null,salidaCajaId:number|null,movimientoFondoId:UUID|null,
 createdAt,
 desbloqueoCaja:null|{motivo,usuarioId,createdAt,saldoAntes,egreso},
 retorno:null|{
   claveOperacion,naturaleza,motivo,reversoProveedorId,caja,fondo,
   sesionCajaId:number|null,ingresoCajaId:number|null,movimientoFondoId:UUID|null,
   createdAt
 }
}
```

Otros roles reciben contratos financieros permitidos existentes **sin este
campo**, incluidos enlaces/IDs de Fondo; ni null con detalle parcial.
Históricos sin origen E12 no se reclasifican ni permiten retorno E12 inferido.
Preservar privacidad en exportadores, solicitudes y notificaciones.

Links usan destinos existentes de proveedor/pago, corte por sesión y movimiento
Fondo ya definido por app; no inventar slugs ni activar menú Fondo OFF.
La ausencia del gate de navegación Fondo no bloquea construir su vínculo.

## 4. Reversar/corregir/recuperar completo — P14

Ruta/hook existentes:
`POST /api/proveedores/:id/pagos/:pagoId/reversar`,
`useReversarPagoProveedor()`.

Body `{motivo:string,efectivoE12?:{claveOperacion:UUID,
naturaleza:'CORRECCION_CAPTURA'|'RECUPERACION_EFECTIVO'}}`.

En pago E12 el objeto es obligatorio y la naturaleza se elige explícitamente:
corrección de error de captura no se etiqueta como devolución física; recuperación
identifica efectivo efectivamente recuperado. Motivo obligatorio (1–1000).
No hay importes o destinos editables, ni devolución parcial: servidor deriva
exactamente las dos partes originales y registra un solo reverso de proveedor.

Si retorna caja, servidor exige y deriva la sesión **actual abierta de Mariana**,
que puede ser la original si sigue abierta. No se altera corte ya cerrado.
Fondo puro retorna sin requerir turno. Un único retorno completo por pago,
independiente de naturaleza; UUID asegura reintento sin segundo ingreso/reverso.
No corregir el gasto eliminándolo ni registrar de nuevo otro pago para “reversar”.

Permiso existente `proveedores_finanzas/autorizar` más scope Mariana. Si hay
Fondo, solo ADMIN; los lectores no ADMIN no reciben un desglose para decidirlo.
Los inversos genéricos E10 de movimientos ligados a E12 no pueden evadir este
recorrido; deben indicar usar reversión de pago proveedor.

Respuesta 201 `PagoProveedorRow` del reverso, con metadata E12 solo ADMIN.
Refrescar también detalle original (ahora contiene retorno), compras aplicadas,
saldo/estado de cuenta, caja/corte y Fondo autorizado.

## 5. Pago dirigido proveedor: mismo productor monetario, no bypass

`useCreateSolicitudPagoDirigido`:
`SolicitudPagoDirigidoInput.efectivoE12` usa exactamente el desglose anterior para
tipo PROVEEDOR + EFECTIVO ON. Se persiste la intención/fuentes junto a solicitud.
No ADMIN envía caja-only; una solicitud pendiente **no mueve dinero**. ADMIN,
cuando el flujo vigente aplica inmediatamente, usa la misma transacción E12.
Los casos CLIENTE/E1/E3 no admiten estos campos ni cambian de comportamiento.

`SolicitudPagoDirigido.efectivoE12` expone propuesta **solo ADMIN**.
El solicitante conserva su estado/movimiento autorizado, no obtiene Fondo.

`useAprobarSolicitudPagoDirigido`: body existente `CreditDirectedApprovalInput`
añade `aprobacionE12:{claveOperacion:UUID,desbloqueoCaja?:{motivo}}`, obligatorio
para aprobar PROVEEDOR + EFECTIVO E12. ADMIN aprueba fuentes/importes persistidos:
no elige otro reparto en la aprobación. Puede motivar desbloqueo caja si falta
saldo al momento. Caja/sesión y Fondo se revalidan bajo candados. Si la sesión
propuesta ya cerró, 409: no mover dinero ni sustituirla silenciosamente; resolver
la solicitud y preparar otra intención en la sesión vigente.

Respuesta `SolicitudPagoDirigidoAplicada` conserva campos y añade metadata E12
para ADMIN. Doble aprobación/reintento no duplica movimiento ni aplicaciones.
La aplicación dirigida sigue apuntando al documento autorizado, no se transforma
en FIFO accidentalmente; ambas vías comparten integración financiera E12.

## 6. Integración con salida E4 / P12

`CrearSalidaDineroCajaBody` añade
`desbloqueoCajaE12?:{motivo}`. E4 + E12 ON: todas las extraordinarias de caja usan
el mismo saldo/candado P12, con override solo ADMIN e histórico. SUPERVISOR/CAJA
no muestran desbloqueo, aun con permisos personalizados. Aceptar un gasto E4
no autoriza insuficiencia ni cambia su importe.

Salida clasificada PROVEEDOR + caja física recorre el pago único E12 en vez de
añadir otro egreso independiente; proveedor/sesión/clave E4 se reutilizan.
No ofrecer división Fondo en formulario E4: se hace en diálogo proveedor.
Pagos no efectivos no reciben reparto caja/Fondo.

Salida/lista/corte puede agregar `pagoProveedorIdE12` y `e12DesbloqueoCaja` solo
ADMIN. La respuesta base E4 y su revisión no se cambian.

Retornos al saldo caja se reflejan en `EfectivoDesglose.retornosProveedor?` y
documentos `origen:'RETORNO_PROVEEDOR'`, con
`evidencia.naturalezaRetornoE12` distinguiendo corrección/recuperación. Cantidades
positivas, sumadas una sola vez al efectivo esperado. No se cuentan como venta,
cobranza de cliente, Fondo inicial ni pago recibido de cliente.
Históricos/OFF no requieren los campos nuevos.

## 7. Superficies actuales, sin rediseñar

- `components/proveedor-pago-dialog.tsx`: FIFO/dirigido, fuentes de efectivo,
  disponibilidad y confirmación/desbloqueo.
- Detalle de proveedor y su componente de compra/pago: evidencia, enlaces y
  retorno completo. Rastrear componentes realmente montados.
- `pages/pagos-dirigidos.tsx`: propuesta proveedor y aprobación E12.
- `components/salidas-dinero-e4-panel.tsx`: motivo de desbloqueo ADMIN (solo gates
  correspondientes); no alterar experiencia OFF.
- `pages/corte-detail-shared.tsx` y lector/presentación común de efectivo:
  retorno proveedor y evidencia, sin duplicar cálculo local.
- Fondo existente: detalle vinculado sin exponer controles a otros roles ni
  activar gate E10 por conveniencia.

Tras éxito invalidar/refrescar pago original/reverso, lista/estado de cuenta/
compras del proveedor, solicitudes afectadas, opciones de pago, sesión/corte/
lista salidas, Fondo únicamente ADMIN. Mantener polling/focus/refetch-on-mount
para cambios de otras sesiones. No borrar UUID hasta éxito confirmado o nueva
intención consciente. 409 de saldo/versión no se autoaprueba.

Errores de dominio `{error,code}`:
`E12_DISABLED` 403, `E12_FORBIDDEN` 403, validaciones 400, inexistentes 404;
409 para `E12_CAJA_INSUFICIENTE`, `E12_FONDO_INSUFICIENTE`,
`E12_SESSION_CLOSED`, `E12_IDEMPOTENCY_CONFLICT`, `E12_ALREADY_RETURNED`.
El código de insuficiencia caja permite ADMIN mostrar el campo de motivo,
no reintentar automáticamente con autorización implícita.

## Codegen / orden

`pnpm --filter @workspace/api-spec codegen`.
Nuevos tipos E12 están en outputs habituales; no hand-written DTO paralelo.
Primero entregar esta interfaz/codegen a MAIN; backend/SQL/tests siguen en
segunda etapa. Nadie libera gates, ejecuta SQL o arranca apps con este contrato.