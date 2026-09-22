# Contrato frontend E4 — preparado, no liberado

Backend: gate fuente `E4_CASH_OUT_ENABLED = false` en
`artifacts/api-server/src/lib/e4-cash-out.ts`. Frontend debe conservar su gate
fuente OFF. OFF mantiene formulario y lecturas anteriores; enviar campos E4 o
llamar revisión devuelve 403 antes de leer esquema nuevo. No activar E2/E3/E12.

## Captura

`POST /api/sesiones-caja/:id/salidas-dinero` conserva hook
`useCrearSalidaDineroCaja`. Body:
`{monto:string, motivo:string, cuentaOrigen, proveedorId?:number|null,
tipo?:'EXTRAORDINARIA'|'PROVEEDOR', claveOperacion?:UUID}`.
Los dos campos opcionales por compatibilidad OFF son **obligatorios con E4 ON**.
Clave UUID por intención; reintento conserva clave y contenido. No regenerarla
por fallo de red. Cambio de contenido exige nueva intención.

E4 ON: ADMIN puede capturar en cualquier tienda autorizada; SUPERVISOR y CAJA
solo en su tienda. **Actualización coordinada E4:** ON usa permisos operativos
`cobros_pagos/ver` y `cobros_pagos/crear` en captura; ON usa `cobros_pagos/ver`
para listar salidas y catálogo mínimo `/caja/proveedores-activos`. OFF conserva
`cortes/ver` y `cortes/crear` anteriores. No cambia filas de la matriz ni abre
permisos administrativos de cortes a CAJA. Frontend ON debe derivar `canCreate`
de `cobros_pagos/crear`, lectura de `cobros_pagos/ver`, además de rol/tienda.
El contenedor padre no debe exigir Mariana para EXTRAORDINARIA ON:
Coco/Cruces también deben montar el panel; PROVEEDOR sí queda Mariana.
Sesión abierta de tienda obligatoria. EXTRAORDINARIA: motivo 1–500 caracteres,
sin proveedor, exclusivamente CAJA_FISICA (Coco/Cruces nunca Fondo).
PROVEEDOR: exclusivamente Mariana (id constante 1), proveedor activo obligatorio;
conserva cuentas CAJA_FISICA/CUENTA_NO_FISCAL/CUENTA_FISCAL existentes. No pagos
partidos ni Fondo. El tipo no se infiere de proveedor vacío.

Respuesta 201: `SalidaDineroCaja` existente más `e4`. Repetir la misma captura
devuelve la misma salida sin nuevo egreso; una clave con contenido distinto da
409. El egreso afecta el corte inmediatamente, aun PENDIENTE/RECLAMADA.

## Lectura y revisión

GET existente de salidas por sesión (`useListarSalidasDineroCaja`) y detalle
de corte agregan `e4?: SalidaDineroRevision` a cada salida. Ausente significa
histórico sin clasificación E4: no inventar clasificación ni habilitar revisión.

`e4 = {tipo, estado, version, claveOperacion, historial}`.
Estados: EXTRAORDINARIA inicia PENDIENTE; proveedor NO_APLICA.
Historial ordenado por versión:
`{accion,version,usuarioId,createdAt,explicacion:string|null,comprobanteUrl:string|null}`.
No hay una nueva bandeja global: se revisa en el detalle de sesión/corte.

`POST /api/sesiones-caja/:id/salidas-dinero/:salidaId/revision`
hook generado `useRevisarSalidaDineroCaja`.
Body `{accion:'ACEPTAR'|'RECLAMAR'|'RESPONDER',version:number,
claveOperacion:UUID,explicacion?:string,comprobanteUrl?:string|null}`.
Respuesta 200: `SalidaDineroRevision` (sin envelope).

- ADMIN ACEPTAR/RECLAMAR sobre PENDIENTE o RESPONDIDA.
- RECLAMAR exige explicación 1–2000 caracteres.
- SUPERVISOR de la misma tienda RESPONDER sobre RECLAMADA; explicación obligatoria
  1–2000, comprobante opcional. Responder pasa a RESPONDIDA, nunca autoacepta.
- CAJA no revisa/responde. ADMIN no responde en nombre de supervisor.
- Comprobante es enlace HTTPS opcional a documento ya disponible, no carga de
  bytes; no se ejecuta fetch del enlace. Solo RESPONDER admite comprobante.
- Permiso de revisión: `cortes/ver` más rol y tienda validados en servidor.
- Versión optimista y UUID por intención. 409 indica conflicto: refrescar y
  pedir nueva decisión; no repetir automáticamente sobre otra versión.
- Se puede revisar después de cerrar sesión; ninguna revisión modifica importes.

En éxito invalidar lista de salidas, detalle/listados de cortes y sesión actual.
Mantener frescura para otros actores mediante polling o refetch-on-focus.
Mostrar errores 400 validación, 403 alcance/gate/rol, 404 inexistente y 409
sesión cerrada/conflicto, sin éxito optimista ficticio.

## Codegen

`pnpm --filter @workspace/api-spec codegen`

Esquemas de servidor: `CrearSalidaDineroCajaBody`,
`RevisarSalidaDineroCajaParams`, `RevisarSalidaDineroCajaBody`,
`RevisarSalidaDineroCajaResponse`.
No cambiar la UI OFF ni inventar egresos de inventario.